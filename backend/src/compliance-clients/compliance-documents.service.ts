import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientDocumentCategory, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { extname, join, normalize } from 'path';
import { COMPLIANCE_REGISTER_WHERE } from '../common/client-compliance';
import { isPathInsideRoot, standardDocumentKinds, validateUploadFiles } from '../common/security/upload-security';
import { RequestUser } from '../common/types/request-user.type';
import { userSummarySelect } from '../common/user-summary';
import { PrismaService } from '../prisma/prisma.service';

export type UploadedClientFile = { originalname: string; mimetype?: string; size?: number; buffer: Buffer };

// Folders every tenant starts with: the legacy CDD and Monitoring tabs plus its four Compliance Documentation sections.
export const DEFAULT_DOCUMENT_SECTIONS: Array<{ key: string; title: string; description: string; category: ClientDocumentCategory; sortOrder: number }> = [
  { key: 'cdd', title: 'CDD Documents', description: 'Customer due diligence evidence for this client.', category: 'CDD', sortOrder: 10 },
  { key: 'screening', title: 'Screening Evidence', description: 'Evidence attached to ongoing screening records.', category: 'SCREENING', sortOrder: 15 },
  { key: 'monitoring', title: 'Ongoing Monitoring', description: 'Ongoing monitoring evidence, reviews and correspondence.', category: 'MONITORING', sortOrder: 20 },
  { key: 'policy-manual', title: 'Policy & Procedure Manual', description: 'Company policies and standard operating procedures.', category: 'COMPLIANCE', sortOrder: 30 },
  { key: 'training', title: 'Training Materials', description: 'Employee training documents and resources.', category: 'COMPLIANCE', sortOrder: 40 },
  { key: 'review-reports', title: 'Review Reports', description: 'Compliance review and audit reports.', category: 'COMPLIANCE', sortOrder: 50 },
  { key: 'meeting-minutes', title: 'Meeting Minutes', description: 'Records of compliance meetings and decisions.', category: 'COMPLIANCE', sortOrder: 60 }
];

const documentSelect = {
  id: true,
  sectionId: true,
  title: true,
  notes: true,
  fileName: true,
  mimeType: true,
  size: true,
  createdAt: true,
  uploadedBy: { select: userSummarySelect }
} satisfies Prisma.ClientDocumentSelect;

@Injectable()
export class ComplianceDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Sections with this client's current (not deleted) documents. Inactive sections still show when they hold files.
  async listClientDocuments(user: RequestUser, clientId: string) {
    const client = await this.findClient(user, clientId);
    await this.ensureDefaultSections(client.tenantId);
    const [sections, documents] = await Promise.all([
      this.prisma.clientDocumentSection.findMany({
        where: { tenantId: client.tenantId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, key: true, title: true, description: true, category: true, isSystem: true, isActive: true }
      }),
      this.prisma.clientDocument.findMany({
        where: { clientId: client.id, tenantId: client.tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: documentSelect
      })
    ]);
    return {
      sections: sections
        .map((section) => ({ ...section, documents: documents.filter((document) => document.sectionId === section.id) }))
        .filter((section) => section.isActive || section.documents.length)
    };
  }

  async upload(user: RequestUser, clientId: string, input: { sectionId?: string; title?: string; notes?: string }, files: UploadedClientFile[]) {
    const client = await this.findClient(user, clientId);
    const sectionId = this.optionalText(input.sectionId);
    if (!sectionId) throw new BadRequestException('Choose the folder for this document.');
    const section = await this.prisma.clientDocumentSection.findFirst({ where: { id: sectionId, tenantId: client.tenantId } });
    if (!section) throw new NotFoundException('Document folder not found.');
    if (!section.isActive) throw new BadRequestException('This folder is archived. Choose an active folder.');
    if (section.category === 'SCREENING') throw new BadRequestException('Add screening evidence through a screening record.');
    await this.storeFiles(user, client, section, files, {
      title: this.optionalText(input.title)?.slice(0, 200) || null,
      notes: this.optionalText(input.notes)?.slice(0, 2000) || null
    });
    return this.listClientDocuments(user, clientId);
  }

  // Validates, stores and audits files in one folder. Used by uploads and by screening evidence (screeningId).
  async storeFiles(
    user: RequestUser,
    client: { id: string; tenantId: string },
    section: { id: string; key: string },
    files: UploadedClientFile[],
    options: { title?: string | null; notes?: string | null; screeningId?: string | null }
  ) {
    if (!files.length) throw new BadRequestException('Select at least one file to upload.');
    validateUploadFiles(files, standardDocumentKinds, 'document');
    const folder = join(this.uploadRoot(), client.tenantId, client.id);
    mkdirSync(folder, { recursive: true });

    for (const file of files) {
      const fileName = this.safeFileName(file.originalname);
      const storedFileName = `${Date.now()}-${randomBytes(6).toString('hex')}${extname(fileName).toLowerCase()}`;
      writeFileSync(join(folder, storedFileName), file.buffer);
      await this.prisma.$transaction(async (tx) => {
        const row = await tx.clientDocument.create({
          data: {
            tenantId: client.tenantId,
            clientId: client.id,
            sectionId: section.id,
            screeningId: options.screeningId || null,
            // With several files, a shared title is suffixed by each file name so the entries stay distinguishable.
            title: options.title ? (files.length > 1 ? `${options.title} — ${fileName}` : options.title) : fileName,
            notes: options.notes || null,
            fileName,
            storagePath: `${client.tenantId}/${client.id}/${storedFileName}`,
            mimeType: file.mimetype || null,
            size: file.size || file.buffer.length,
            uploadedById: user.id
          },
          select: { id: true, title: true }
        });
        await tx.auditLog.create({
          data: {
            tenantId: client.tenantId,
            actorId: user.id,
            action: 'CREATE',
            entityType: 'ClientDocument',
            entityId: row.id,
            metadata: { clientId: client.id, section: section.key, title: row.title, fileName, screeningId: options.screeningId || null }
          }
        });
      });
    }
  }

  async sectionByKey(tenantId: string, key: string) {
    await this.ensureDefaultSections(tenantId);
    return this.prisma.clientDocumentSection.findFirstOrThrow({ where: { tenantId, key } });
  }

  async getFile(user: RequestUser, clientId: string, documentId: string) {
    const client = await this.findClient(user, clientId);
    const document = await this.prisma.clientDocument.findFirst({
      where: { id: documentId, clientId: client.id, tenantId: client.tenantId, deletedAt: null }
    });
    if (!document) throw new NotFoundException('Document not found.');
    const filePath = this.resolvePath(document.storagePath);
    if (!filePath) throw new NotFoundException('The document file is missing from storage.');
    return { fileName: document.fileName, mimeType: document.mimeType, content: readFileSync(filePath) };
  }

  // Soft delete: the record leaves the folder but the row and file are kept, and the reason is audited.
  async remove(user: RequestUser, clientId: string, documentId: string, reason?: string) {
    const client = await this.findClient(user, clientId);
    const document = await this.prisma.clientDocument.findFirst({
      where: { id: documentId, clientId: client.id, tenantId: client.tenantId, deletedAt: null },
      include: { section: { select: { key: true } } }
    });
    if (!document) throw new NotFoundException('Document not found.');
    const deleteReason = this.optionalText(reason)?.slice(0, 1000) || null;
    await this.prisma.$transaction([
      this.prisma.clientDocument.update({ where: { id: document.id }, data: { deletedAt: new Date(), deletedById: user.id, deleteReason } }),
      this.prisma.auditLog.create({
        data: {
          tenantId: client.tenantId,
          actorId: user.id,
          action: 'DELETE',
          entityType: 'ClientDocument',
          entityId: document.id,
          metadata: { clientId: client.id, section: document.section.key, title: document.title, fileName: document.fileName, reason: deleteReason }
        }
      })
    ]);
    return this.listClientDocuments(user, clientId);
  }

  // Folders are shared by all clients of the company; the client being viewed identifies the company.
  async createSection(user: RequestUser, clientId: string, input: { title?: string; description?: string }) {
    const { tenantId } = await this.findClient(user, clientId);
    const title = this.optionalText(input.title)?.slice(0, 120);
    if (!title) throw new BadRequestException('Enter a folder name.');
    await this.ensureDefaultSections(tenantId);
    const duplicate = await this.prisma.clientDocumentSection.findFirst({ where: { tenantId, title: { equals: title, mode: 'insensitive' } } });
    if (duplicate) throw new BadRequestException(`A folder named "${duplicate.title}" already exists.`);
    const last = await this.prisma.clientDocumentSection.aggregate({ where: { tenantId }, _max: { sortOrder: true } });
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'folder';
    return this.prisma.$transaction(async (tx) => {
      const section = await tx.clientDocumentSection.create({
        data: {
          tenantId,
          key: `custom-${slug}-${randomBytes(3).toString('hex')}`,
          title,
          description: this.optionalText(input.description)?.slice(0, 300) || null,
          category: 'COMPLIANCE',
          sortOrder: (last._max.sortOrder || 0) + 10,
          createdById: user.id
        },
        select: { id: true, key: true, title: true, description: true, category: true, isSystem: true, isActive: true }
      });
      await tx.auditLog.create({ data: { tenantId, actorId: user.id, action: 'CREATE', entityType: 'ClientDocumentSection', entityId: section.id, metadata: { title } } });
      return section;
    });
  }

  // Only custom folders can be renamed or archived; the default folders mirror fixed legacy tabs.
  async updateSection(user: RequestUser, clientId: string, sectionId: string, input: { title?: string; description?: string; isActive?: boolean }) {
    const { tenantId } = await this.findClient(user, clientId);
    const section = await this.prisma.clientDocumentSection.findFirst({ where: { id: sectionId, tenantId } });
    if (!section) throw new NotFoundException('Document folder not found.');
    if (section.isSystem) throw new BadRequestException('Default folders cannot be renamed or archived.');
    const data: Prisma.ClientDocumentSectionUpdateInput = {};
    if (input.title !== undefined) {
      const title = this.optionalText(input.title)?.slice(0, 120);
      if (!title) throw new BadRequestException('Enter a folder name.');
      const duplicate = await this.prisma.clientDocumentSection.findFirst({ where: { tenantId, id: { not: section.id }, title: { equals: title, mode: 'insensitive' } } });
      if (duplicate) throw new BadRequestException(`A folder named "${duplicate.title}" already exists.`);
      data.title = title;
    }
    if (input.description !== undefined) data.description = this.optionalText(input.description)?.slice(0, 300) || null;
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.clientDocumentSection.update({
        where: { id: section.id },
        data,
        select: { id: true, key: true, title: true, description: true, category: true, isSystem: true, isActive: true }
      });
      await tx.auditLog.create({ data: { tenantId, actorId: user.id, action: 'UPDATE', entityType: 'ClientDocumentSection', entityId: section.id, metadata: { changes: input } as Prisma.InputJsonValue } });
      return updated;
    });
  }

  private async ensureDefaultSections(tenantId: string) {
    await this.prisma.clientDocumentSection.createMany({
      data: DEFAULT_DOCUMENT_SECTIONS.map((section) => ({ ...section, tenantId, isSystem: true })),
      skipDuplicates: true
    });
  }

  private async findClient(user: RequestUser, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, ...COMPLIANCE_REGISTER_WHERE, ...this.tenantWhere(user) },
      select: { id: true, tenantId: true }
    });
    if (!client) throw new NotFoundException('Compliance client not found');
    return client;
  }

  // Same scoping as the compliance register: Super Admin spans tenants, everyone else stays in their own.
  private tenantWhere(user: RequestUser) {
    if (user.roles.includes('SUPER_ADMIN')) return {};
    if (!user.tenantId) throw new ForbiddenException('User is not assigned to a tenant');
    return { tenantId: user.tenantId };
  }

  private uploadRoot() {
    return normalize(process.env.CLIENT_DOCUMENT_UPLOAD_DIR || join(process.cwd(), 'uploads', 'client-documents'));
  }

  private resolvePath(storagePath: string) {
    const root = this.uploadRoot();
    const candidate = normalize(join(root, normalize(storagePath)));
    return isPathInsideRoot(candidate, root) && existsSync(candidate) ? candidate : null;
  }

  private safeFileName(value: string) {
    const cleaned = (value || 'document').replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned.slice(-180) || 'document';
  }

  private optionalText(value: unknown) {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || null;
  }
}
