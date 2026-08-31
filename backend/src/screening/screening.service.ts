import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  KycFormSectionKey,
  Prisma,
  ScreeningCheckType,
  ScreeningEntityType,
  ScreeningRecordStatus,
  ScreeningResultStatus
} from '@prisma/client';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { basename, isAbsolute, join, normalize, relative } from 'path';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

const MANDATORY_CHECKS: ScreeningCheckType[] = [
  ScreeningCheckType.NCTC,
  ScreeningCheckType.UN,
  ScreeningCheckType.OFAC,
  ScreeningCheckType.EU,
  ScreeningCheckType.PPO_LIST,
  ScreeningCheckType.WORLD_CHECK,
  ScreeningCheckType.GOOGLE
];

type ScreeningEntityOption = {
  sourceId: string;
  entityType: ScreeningEntityType;
  name: string;
  identifier?: string | null;
  country?: string | null;
  role: string;
  linkedClientId?: string | null;
};

type JsonRecord = Record<string, unknown>;

@Injectable()
export class ScreeningService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecords(user: RequestUser) {
    const records = await this.prisma.screeningRecord.findMany({
      where: this.recordTenantWhere(user),
      include: {
        kycCase: {
          include: {
            client: true,
            service: true
          }
        },
        checks: { include: { documents: true }, orderBy: { checkType: 'asc' } },
        documents: { where: { screeningCheckId: null }, orderBy: { createdAt: 'desc' } }
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }]
    });

    return records.map((record) => ({
      ...record,
      completedChecks: record.checks.filter((check) => check.resultStatus !== ScreeningResultStatus.NOT_CHECKED && check.documents.length > 0).length,
      totalChecks: MANDATORY_CHECKS.length,
      documentCount: record.documents.length + record.checks.reduce((sum, check) => sum + check.documents.length, 0)
    }));
  }

  async getContext(user: RequestUser, kycCaseId: string) {
    const kycCase = await this.findCase(user, kycCaseId);
    const sectionData = await this.prisma.kycSectionData.findMany({
      where: { kycCaseId, ...this.sectionTenantWhere(user) }
    });
    const sections = this.sectionMap(sectionData);
    const records = await this.prisma.screeningRecord.findMany({
      where: { kycCaseId, ...this.recordTenantWhere(user) },
      include: {
        checks: { include: { documents: { orderBy: { createdAt: 'desc' } } }, orderBy: { checkType: 'asc' } },
        documents: { where: { screeningCheckId: null }, orderBy: { createdAt: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      clientInfo: this.clientInfo(kycCase, sections.sectionA),
      entities: this.extractEntities(kycCase, sections),
      mandatoryChecks: MANDATORY_CHECKS,
      records
    };
  }

  async createRecord(user: RequestUser, kycCaseId: string, dto: JsonRecord) {
    const tenantId = this.getTenantId(user);
    const context = await this.getContext(user, kycCaseId);
    const sourceId = this.stringValue(dto.entitySourceId);
    const selectedEntity = sourceId ? context.entities.find((entity) => entity.sourceId === sourceId) : null;
    const entityType = this.enumValue(ScreeningEntityType, dto.entityType) || selectedEntity?.entityType || ScreeningEntityType.MANUAL;
    const entityName = selectedEntity?.name || this.stringValue(dto.entityName);

    if (!entityName) {
      throw new BadRequestException('Select an entity or enter a manual screening name.');
    }

    await this.prisma.screeningRecord.create({
      data: {
        tenantId,
        kycCaseId,
        clientId: selectedEntity?.linkedClientId || (selectedEntity?.entityType === ScreeningEntityType.CLIENT_COMPANY ? context.clientInfo.clientId : null),
        entityType,
        entitySourceId: selectedEntity?.sourceId || null,
        entityName,
        identifier: selectedEntity?.identifier || this.stringValue(dto.identifier) || null,
        country: selectedEntity?.country || this.stringValue(dto.country) || null,
        createdById: user.id,
        updatedById: user.id,
        checks: {
          create: MANDATORY_CHECKS.map((checkType) => ({
            tenantId,
            checkType,
            resultStatus: ScreeningResultStatus.NOT_CHECKED
          }))
        }
      }
    });

    return this.getContext(user, kycCaseId);
  }

  async updateRecord(user: RequestUser, kycCaseId: string, recordId: string, dto: JsonRecord) {
    await this.findRecord(user, kycCaseId, recordId);
    const checks = Array.isArray(dto.checks) ? dto.checks : [];

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.screeningRecord.update({
        where: { id: recordId },
        data: {
          entityName: this.stringValue(dto.entityName) || undefined,
          identifier: this.stringValue(dto.identifier),
          country: this.stringValue(dto.country),
          remarks: this.stringValue(dto.remarks),
          updatedById: user.id
        }
      });

      for (const item of checks) {
        if (!this.isRecord(item)) continue;
        const checkType = this.enumValue(ScreeningCheckType, item.checkType);
        if (!checkType || checkType === ScreeningCheckType.OTHER) continue;
        await tx.screeningCheck.upsert({
          where: { screeningRecordId_checkType: { screeningRecordId: recordId, checkType } },
          create: {
            tenantId: this.getTenantId(user),
            screeningRecordId: recordId,
            checkType,
            resultStatus: this.enumValue(ScreeningResultStatus, item.resultStatus) || ScreeningResultStatus.NOT_CHECKED,
            notes: this.stringValue(item.notes)
          },
          update: {
            resultStatus: this.enumValue(ScreeningResultStatus, item.resultStatus) || ScreeningResultStatus.NOT_CHECKED,
            notes: this.stringValue(item.notes)
          }
        });
      }
    });

    return this.getContext(user, kycCaseId);
  }

  async completeRecord(user: RequestUser, kycCaseId: string, recordId: string) {
    const record = await this.findRecord(user, kycCaseId, recordId);
    const remarks = (record.remarks || '').trim();
    const missingChecks = MANDATORY_CHECKS.filter((checkType) => {
      const check = record.checks.find((item) => item.checkType === checkType);
      return !check || check.resultStatus === ScreeningResultStatus.NOT_CHECKED || check.documents.length === 0;
    });

    if (!remarks) {
      throw new BadRequestException('Observation and remarks are required before finalizing screening.');
    }

    if (missingChecks.length) {
      throw new BadRequestException(`Complete result status and PDF evidence for: ${missingChecks.map((item) => this.checkLabel(item)).join(', ')}.`);
    }

    await this.prisma.screeningRecord.update({
      where: { id: recordId },
      data: { status: ScreeningRecordStatus.COMPLETED, updatedById: user.id }
    });

    return this.getContext(user, kycCaseId);
  }

  async uploadDocuments(
    user: RequestUser,
    kycCaseId: string,
    recordId: string,
    dto: JsonRecord,
    files: Array<{ originalname: string; mimetype?: string; size?: number; buffer: Buffer }>
  ) {
    const record = await this.findRecord(user, kycCaseId, recordId);
    if (!files.length) {
      throw new BadRequestException('Select at least one screening document to upload.');
    }

    const checkType = this.enumValue(ScreeningCheckType, dto.checkType);
    if (!checkType) {
      throw new BadRequestException('Select the screening check type before uploading.');
    }

    const check = checkType === ScreeningCheckType.OTHER ? null : record.checks.find((item) => item.checkType === checkType);
    if (checkType !== ScreeningCheckType.OTHER && !check) {
      throw new BadRequestException('Screening check row not found for this upload.');
    }

    if (checkType !== ScreeningCheckType.OTHER) {
      const invalidFile = files.find((file) => !this.isPdf(file));
      if (invalidFile) {
        throw new BadRequestException(`${invalidFile.originalname} is not a PDF. Mandatory screening evidence must be uploaded as PDF.`);
      }
    }

    const root = this.screeningUploadRoot();
    const folder = join(root, record.tenantId, kycCaseId, recordId);
    mkdirSync(folder, { recursive: true });

    for (const [index, file] of files.entries()) {
      const fileName = this.safeFileName(file.originalname);
      const storedFileName = `${Date.now()}-${index}-${fileName}`;
      writeFileSync(join(folder, storedFileName), file.buffer);
      await this.prisma.screeningDocument.create({
        data: {
          tenantId: record.tenantId,
          screeningRecordId: record.id,
          screeningCheckId: check?.id || null,
          documentType: checkType === ScreeningCheckType.OTHER ? this.stringValue(dto.documentType) || 'Other screening document' : this.checkLabel(checkType),
          fileName,
          storagePath: `${record.tenantId}/${kycCaseId}/${recordId}/${storedFileName}`,
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size || file.buffer.length,
          uploadedById: user.id
        }
      });
    }

    return this.getContext(user, kycCaseId);
  }

  async getDocumentFile(user: RequestUser, kycCaseId: string, documentId: string) {
    const document = await this.prisma.screeningDocument.findFirst({
      where: { id: documentId, screeningRecord: { kycCaseId }, ...this.documentTenantWhere(user) }
    });

    if (!document?.storagePath) {
      throw new NotFoundException('Screening document file not found.');
    }

    const filePath = this.resolveScreeningDocumentPath(document.storagePath);
    if (!filePath) {
      throw new NotFoundException('Screening document file is missing from storage.');
    }

    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      content: readFileSync(filePath)
    };
  }

  async deleteDocument(user: RequestUser, kycCaseId: string, documentId: string) {
    const document = await this.prisma.screeningDocument.findFirst({
      where: { id: documentId, screeningRecord: { kycCaseId }, ...this.documentTenantWhere(user) }
    });

    if (!document) {
      throw new NotFoundException('Screening document not found.');
    }

    if (document.storagePath) {
      const filePath = this.resolveScreeningDocumentPath(document.storagePath);
      if (filePath && existsSync(filePath)) unlinkSync(filePath);
    }

    await this.prisma.screeningDocument.delete({ where: { id: document.id } });
    return this.getContext(user, kycCaseId);
  }

  private async findCase(user: RequestUser, kycCaseId: string) {
    const kycCase = await this.prisma.kycCase.findFirst({
      where: { id: kycCaseId, ...this.caseTenantWhere(user) },
      include: { client: { include: { contacts: true } }, service: true }
    });

    if (!kycCase) {
      throw new NotFoundException('KYC case not found.');
    }

    return kycCase;
  }

  private async findRecord(user: RequestUser, kycCaseId: string, recordId: string) {
    const record = await this.prisma.screeningRecord.findFirst({
      where: { id: recordId, kycCaseId, ...this.recordTenantWhere(user) },
      include: {
        checks: { include: { documents: true } },
        documents: { where: { screeningCheckId: null } }
      }
    });

    if (!record) {
      throw new NotFoundException('Screening record not found.');
    }

    return record;
  }

  private extractEntities(kycCase: Awaited<ReturnType<ScreeningService['findCase']>>, sections: Record<string, JsonRecord>) {
    const entities: ScreeningEntityOption[] = [];
    const sectionA = sections.sectionA || {};
    const sectionB = sections.sectionB || {};
    const sectionC = sections.sectionC || {};
    const sectionE = sections.sectionE || {};

    this.pushEntity(entities, {
      sourceId: `client:${kycCase.clientId}`,
      entityType: ScreeningEntityType.CLIENT_COMPANY,
      name: this.stringValue(sectionA.legalName) || this.stringValue(sectionA.legalNameOfCompany) || kycCase.client.name,
      identifier: this.stringValue(sectionA.commercialRegistrationNo) || kycCase.client.registrationNumber,
      country: this.stringValue(sectionA.countryOfIncorporation) || kycCase.client.country,
      role: 'Client company',
      linkedClientId: kycCase.clientId
    });

    this.listValue(sectionB.shareholders).forEach((row, index) => {
      if (!this.isRecord(row)) return;
      this.pushEntity(entities, {
        sourceId: `shareholder:${this.stringValue(row.id) || index}`,
        entityType: this.stringValue(row.shareholderType) === 'Corporate Entity' ? ScreeningEntityType.SHAREHOLDER : ScreeningEntityType.UBO,
        name: this.stringValue(row.fullName),
        identifier: this.stringValue(row.identityNumber),
        country: this.firstText(row.nationality),
        role: this.stringValue(row.shareholderType) || 'Shareholder',
        linkedClientId: this.stringValue(row.linkedClientId)
      });
    });

    this.listValue(sectionB.ubos).forEach((row, index) => {
      if (!this.isRecord(row)) return;
      this.pushEntity(entities, {
        sourceId: `ubo:${this.stringValue(row.id) || index}`,
        entityType: ScreeningEntityType.UBO,
        name: this.stringValue(row.fullName),
        identifier: this.stringValue(row.identityNumber),
        country: this.firstText(row.nationality),
        role: 'UBO',
        linkedClientId: this.stringValue(row.linkedClientId)
      });
    });

    this.listValue(sectionC.managers).forEach((row, index) => {
      if (!this.isRecord(row)) return;
      this.pushEntity(entities, {
        sourceId: `manager:${this.stringValue(row.id) || index}`,
        entityType: ScreeningEntityType.MANAGER,
        name: this.stringValue(row.fullName),
        identifier: this.stringValue(row.identityNumber),
        country: this.firstText(row.nationality),
        role: this.firstText(row.position) || 'Manager / authorized signatory'
      });
    });

    this.pushEntity(entities, {
      sourceId: 'communication-person',
      entityType: ScreeningEntityType.MANAGER,
      name: this.stringValue(sectionE.fullName),
      identifier: this.stringValue(sectionE.identityNumber),
      country: this.firstText(sectionE.nationality),
      role: this.firstText(sectionE.position) || 'Key communication person'
    });

    return entities;
  }

  private clientInfo(kycCase: Awaited<ReturnType<ScreeningService['findCase']>>, sectionA: JsonRecord = {}) {
    const crNumber = this.stringValue(sectionA.commercialRegistrationNo) || kycCase.client.registrationNumber || null;
    return {
      caseId: kycCase.id,
      caseTitle: kycCase.title,
      clientId: kycCase.clientId,
      clientName: this.stringValue(sectionA.legalName) || this.stringValue(sectionA.legalNameOfCompany) || kycCase.client.name,
      clientCode: kycCase.client.registrationNumber || crNumber || kycCase.clientId,
      crNumber,
      serviceName: kycCase.service?.name || null
    };
  }

  private sectionMap(rows: Array<{ sectionKey: KycFormSectionKey; data: Prisma.JsonValue }>) {
    return rows.reduce<Record<string, JsonRecord>>((accumulator, row) => {
      const keyMap: Record<KycFormSectionKey, string> = {
        GENERAL_COMPANY: 'sectionA',
        OWNERSHIP: 'sectionB',
        MANAGEMENT: 'sectionC',
        COMPLIANCE_RISK: 'sectionD',
        COMMUNICATION_PERSON: 'sectionE',
        REQUIRED_DOCUMENTS: 'sectionF',
        CLIENT_DECLARATION: 'sectionG'
      };
      accumulator[keyMap[row.sectionKey]] = this.isRecord(row.data) ? row.data : {};
      return accumulator;
    }, {});
  }

  private pushEntity(entities: ScreeningEntityOption[], entity: ScreeningEntityOption) {
    if (!entity.name) return;
    const fingerprint = `${entity.entityType}:${entity.name.toLowerCase()}:${(entity.identifier || '').toLowerCase()}`;
    const exists = entities.some((item) => `${item.entityType}:${item.name.toLowerCase()}:${(item.identifier || '').toLowerCase()}` === fingerprint);
    if (!exists) entities.push(entity);
  }

  private checkLabel(checkType: ScreeningCheckType) {
    const labels: Record<ScreeningCheckType, string> = {
      NCTC: 'NCTC',
      UN: 'UN',
      OFAC: 'OFAC',
      EU: 'EU',
      PPO_LIST: 'PPO List',
      WORLD_CHECK: 'World-Check',
      GOOGLE: 'Google',
      OTHER: 'Other screening document'
    };
    return labels[checkType];
  }

  private caseTenantWhere(user: RequestUser): Prisma.KycCaseWhereInput {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
  }

  private sectionTenantWhere(user: RequestUser): Prisma.KycSectionDataWhereInput {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
  }

  private recordTenantWhere(user: RequestUser): Prisma.ScreeningRecordWhereInput {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
  }

  private documentTenantWhere(user: RequestUser): Prisma.ScreeningDocumentWhereInput {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
  }

  private getTenantId(user: RequestUser) {
    if (!user.tenantId) {
      throw new ForbiddenException('User is not assigned to a tenant.');
    }
    return user.tenantId;
  }

  private screeningUploadRoot() {
    return normalize(process.env.SCREENING_UPLOAD_DIR || join(process.cwd(), 'uploads', 'screening-documents'));
  }

  private resolveScreeningDocumentPath(storagePath: string) {
    const uploadRoot = this.screeningUploadRoot();
    const normalizedRoot = normalize(uploadRoot);
    const normalizedStoragePath = normalize(storagePath);
    const legacyUploadPrefix = normalize(join(process.cwd(), 'uploads'));
    const candidates = [
      isAbsolute(normalizedStoragePath) ? normalizedStoragePath : join(uploadRoot, normalizedStoragePath),
      join(process.cwd(), normalizedStoragePath)
    ];

    if (normalizedStoragePath.startsWith(legacyUploadPrefix)) {
      candidates.push(join(uploadRoot, relative(legacyUploadPrefix, normalizedStoragePath)));
    }

    return candidates.map((candidate) => normalize(candidate)).find((candidate) => candidate.startsWith(normalizedRoot) && existsSync(candidate)) || null;
  }

  private safeFileName(fileName: string) {
    const name = basename(fileName || 'document')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return name || 'document';
  }

  private isPdf(file: { originalname: string; mimetype?: string }) {
    return (file.mimetype || '').toLowerCase() === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
  }

  private enumValue<T extends Record<string, string>>(source: T, value: unknown): T[keyof T] | null {
    return typeof value === 'string' && Object.values(source).includes(value) ? (value as T[keyof T]) : null;
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private listValue(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private firstText(value: unknown) {
    if (Array.isArray(value)) return value.find((item): item is string => typeof item === 'string' && Boolean(item.trim())) || '';
    return this.stringValue(value);
  }

  private isRecord(value: unknown): value is JsonRecord {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
