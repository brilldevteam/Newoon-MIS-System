import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { canEncryptSecrets, decryptSecret, encryptSecret } from './secret-box';

// The company's own AI service for reading uploaded documents (requirements A01-A07). Each company adds its own
// OpenAI API key; with a key set and enabled, documents are sent to OpenAI to read their details. Without one, the
// local reader on the server is used. The key is stored encrypted, never returned, never logged.

export const DEFAULT_AI_MODEL = 'gpt-4.1-mini';
const OPENAI_URL = 'https://api.openai.com/v1';
const TEST_TIMEOUT_MS = 20_000;

export type AiCredentials = { provider: 'OPENAI'; apiKey: string; model: string };

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(user: RequestUser) {
    const tenantId = this.tenantOf(user);
    const setting = await this.prisma.tenantAiSetting.findUnique({ where: { tenantId } });
    return this.view(setting);
  }

  async save(user: RequestUser, input: { apiKey?: string; model?: string; enabled?: boolean }) {
    const tenantId = this.tenantOf(user);
    const existing = await this.prisma.tenantAiSetting.findUnique({ where: { tenantId } });
    const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
    const model = this.modelValue(input.model ?? existing?.model ?? DEFAULT_AI_MODEL);
    if (!existing && !apiKey) throw new BadRequestException('Enter the OpenAI API key.');
    if (apiKey && !/^sk-[A-Za-z0-9_\-]{16,}$/.test(apiKey)) throw new BadRequestException('This does not look like an OpenAI API key (it starts with "sk-").');
    if (apiKey && !canEncryptSecrets()) {
      throw new BadRequestException('The server cannot store keys yet: SETTINGS_ENCRYPTION_KEY must be set on the server first.');
    }
    const data = {
      model,
      enabled: input.enabled ?? existing?.enabled ?? true,
      updatedById: user.id,
      ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey), apiKeyLast4: apiKey.slice(-4) } : {})
    };
    const saved = await this.prisma.$transaction(async (tx) => {
      const row = existing
        ? await tx.tenantAiSetting.update({ where: { id: existing.id }, data })
        : await tx.tenantAiSetting.create({ data: { ...data, tenantId, provider: 'OPENAI', apiKeyEncrypted: data.apiKeyEncrypted!, apiKeyLast4: data.apiKeyLast4! } });
      await this.audit(tx, user, tenantId, row.id, {
        action: existing ? 'AI_SETTINGS_UPDATED' : 'AI_SETTINGS_CREATED', model, enabled: row.enabled, keyChanged: Boolean(apiKey)
      });
      return row;
    });
    return this.view(saved);
  }

  async remove(user: RequestUser) {
    const tenantId = this.tenantOf(user);
    const existing = await this.prisma.tenantAiSetting.findUnique({ where: { tenantId } });
    if (!existing) return this.view(null);
    await this.prisma.$transaction(async (tx) => {
      await tx.tenantAiSetting.delete({ where: { id: existing.id } });
      await this.audit(tx, user, tenantId, existing.id, { action: 'AI_SETTINGS_REMOVED' });
    });
    return this.view(null);
  }

  // Checks the stored key and model with OpenAI (no document is sent).
  async test(user: RequestUser) {
    const credentials = await this.credentialsFor(this.tenantOf(user), true);
    if (!credentials) return { ok: false, message: 'No usable key is stored. Enter the API key again.' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${OPENAI_URL}/models/${encodeURIComponent(credentials.model)}`, {
        headers: { Authorization: `Bearer ${credentials.apiKey}` },
        signal: controller.signal
      });
      if (response.ok) return { ok: true, message: `Connected. The model ${credentials.model} is available to this key.` };
      if (response.status === 401) return { ok: false, message: 'OpenAI refused the key (401). Check the key and enter it again.' };
      if (response.status === 404) return { ok: false, message: `The key works, but the model "${credentials.model}" is not available to it. Choose another model.` };
      if (response.status === 429) return { ok: false, message: 'OpenAI reports the key is over its quota or rate limit (429).' };
      return { ok: false, message: `OpenAI answered with status ${response.status}.` };
    } catch (error) {
      this.logger.warn(`AI settings test failed: ${(error as Error).name}`);
      return { ok: false, message: 'OpenAI could not be reached from the server.' };
    } finally {
      clearTimeout(timer);
    }
  }

  // Decrypted credentials for the document reader; null when not set, disabled or unreadable.
  async credentialsFor(tenantId: string, includeDisabled = false): Promise<AiCredentials | null> {
    const setting = await this.prisma.tenantAiSetting.findUnique({ where: { tenantId } });
    if (!setting || (!setting.enabled && !includeDisabled)) return null;
    const apiKey = decryptSecret(setting.apiKeyEncrypted);
    if (!apiKey) {
      this.logger.warn('A stored AI key could not be decrypted (SETTINGS_ENCRYPTION_KEY missing or changed).');
      return null;
    }
    return { provider: 'OPENAI', apiKey, model: setting.model };
  }

  private view(setting: { model: string; enabled: boolean; apiKeyLast4: string; apiKeyEncrypted: string; updatedAt: Date } | null) {
    return {
      provider: 'OPENAI',
      configured: Boolean(setting),
      enabled: setting?.enabled ?? false,
      model: setting?.model ?? DEFAULT_AI_MODEL,
      keyHint: setting ? `sk-…${setting.apiKeyLast4}` : null,
      keyReadable: setting ? decryptSecret(setting.apiKeyEncrypted) !== null : null,
      updatedAt: setting?.updatedAt ?? null,
      serverCanStoreKeys: canEncryptSecrets()
    };
  }

  private modelValue(value: string) {
    const model = value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9.\-:_]{1,79}$/.test(model)) throw new BadRequestException('Enter a model name such as gpt-4.1-mini.');
    return model;
  }

  private tenantOf(user: RequestUser) {
    if (!user.tenantId) throw new ForbiddenException('AI settings belong to a company. Sign in with a company account.');
    return user.tenantId;
  }

  private audit(tx: Prisma.TransactionClient, user: RequestUser, tenantId: string, entityId: string, metadata: Record<string, unknown>) {
    return tx.auditLog.create({ data: { tenantId, actorId: user.id, action: 'UPDATE', entityType: 'TenantAiSetting', entityId, metadata: metadata as Prisma.InputJsonValue } });
  }
}
