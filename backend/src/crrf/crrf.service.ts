import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CrrfRiskRating, Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { basename, isAbsolute, join, normalize, relative } from 'path';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class CrrfService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecords(user: RequestUser) {
    const records = await this.prisma.crrfRecord.findMany({
      where: this.recordTenantWhere(user),
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        kycCase: { include: { client: true, service: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return records.map((record) => ({
      ...record,
      clientInfo: this.clientInfo(record.kycCase),
      documentCount: record.documents.length
    }));
  }

  async getWorkspace(user: RequestUser, kycCaseId: string) {
    const kycCase = await this.findCase(user, kycCaseId);
    const record = await this.ensureRecord(user, kycCase);
    return {
      clientInfo: this.clientInfo(kycCase),
      record
    };
  }

  async saveWorkspace(user: RequestUser, kycCaseId: string, dto: JsonRecord) {
    const kycCase = await this.findCase(user, kycCaseId);
    const record = await this.ensureRecord(user, kycCase);
    const riskRating = this.enumValue(CrrfRiskRating, dto.riskRating);
    if (!riskRating) {
      throw new BadRequestException('Risk rating is required before saving the CRRF record.');
    }

    await this.prisma.crrfRecord.update({
      where: { id: record.id },
      data: {
        riskRating,
        dmlroComment: this.stringValue(dto.dmlroComment),
        mlroComment: this.stringValue(dto.mlroComment),
        updatedById: user.id
      }
    });

    return this.getWorkspace(user, kycCaseId);
  }

  async uploadDocuments(
    user: RequestUser,
    kycCaseId: string,
    files: Array<{ originalname: string; mimetype?: string; size?: number; buffer: Buffer }>
  ) {
    const kycCase = await this.findCase(user, kycCaseId);
    const record = await this.ensureRecord(user, kycCase);
    if (!files.length) {
      throw new BadRequestException('Select at least one CRRF document to upload.');
    }

    const invalidFile = files.find((file) => !this.isAllowedDocument(file));
    if (invalidFile) {
      throw new BadRequestException(`${invalidFile.originalname} is not supported. Upload PDF, XLS, or XLSX files only.`);
    }

    const root = this.uploadRoot();
    const folder = join(root, record.tenantId, kycCaseId, record.id);
    mkdirSync(folder, { recursive: true });

    for (const [index, file] of files.entries()) {
      const fileName = this.safeFileName(file.originalname);
      const storedFileName = `${Date.now()}-${index}-${fileName}`;
      writeFileSync(join(folder, storedFileName), file.buffer);
      await this.prisma.crrfDocument.create({
        data: {
          tenantId: record.tenantId,
          crrfRecordId: record.id,
          fileName,
          storagePath: `${record.tenantId}/${kycCaseId}/${record.id}/${storedFileName}`,
          mimeType: file.mimetype || this.mimeTypeForFile(fileName),
          size: file.size || file.buffer.length,
          uploadedById: user.id
        }
      });
    }

    return this.getWorkspace(user, kycCaseId);
  }

  async getDocumentFile(user: RequestUser, kycCaseId: string, documentId: string) {
    const document = await this.prisma.crrfDocument.findFirst({
      where: { id: documentId, crrfRecord: { kycCaseId }, ...this.documentTenantWhere(user) }
    });

    if (!document?.storagePath) {
      throw new NotFoundException('CRRF document file not found.');
    }

    const filePath = this.resolveDocumentPath(document.storagePath);
    if (!filePath) {
      throw new NotFoundException('CRRF document file is missing from storage.');
    }

    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      content: readFileSync(filePath)
    };
  }

  async deleteDocument(user: RequestUser, kycCaseId: string, documentId: string) {
    const document = await this.prisma.crrfDocument.findFirst({
      where: { id: documentId, crrfRecord: { kycCaseId }, ...this.documentTenantWhere(user) }
    });
    if (!document) throw new NotFoundException('CRRF document not found.');

    if (document.storagePath) {
      const filePath = this.resolveDocumentPath(document.storagePath);
      if (filePath && existsSync(filePath)) unlinkSync(filePath);
    }

    await this.prisma.crrfDocument.delete({ where: { id: document.id } });
    return this.getWorkspace(user, kycCaseId);
  }

  async exportExcel(user: RequestUser, kycCaseId: string) {
    const workspace = await this.getWorkspace(user, kycCaseId);
    const record = workspace.record;
    const rows = [
      ['Client Name', workspace.clientInfo.clientName],
      ['Client Code', workspace.clientInfo.clientCode || '-'],
      ['CR Number', workspace.clientInfo.crNumber || '-'],
      ['Risk Rating', record.riskRating || '-'],
      ['DMLRO Comment', record.dmlroComment || '-'],
      ['MLRO Comment', record.mlroComment || '-'],
      ['Uploaded Documents', record.documents.map((document) => document.fileName).join(', ') || '-']
    ];
    const tableRows = rows.map(([label, value]) => `<tr><th>${this.escapeHtml(label)}</th><td>${this.escapeHtml(value)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Arial,sans-serif}th,td{border:1px solid #999;padding:8px;text-align:left}th{background:#f1f5f9}</style></head><body><h2>CRRF Report</h2><table>${tableRows}</table></body></html>`;
    return {
      fileName: `${this.safeExportName(workspace.clientInfo.clientName)}-crrf-report.xls`,
      mimeType: 'application/vnd.ms-excel',
      content: Buffer.from(html, 'utf8')
    };
  }

  async exportPdf(user: RequestUser, kycCaseId: string) {
    const workspace = await this.getWorkspace(user, kycCaseId);
    const record = workspace.record;
    const document = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    document.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const done = new Promise<Buffer>((resolve) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
    });

    document.fontSize(18).text('CRRF Report', { underline: true });
    document.moveDown();
    this.pdfRow(document, 'Client Name', workspace.clientInfo.clientName);
    this.pdfRow(document, 'Client Code', workspace.clientInfo.clientCode || '-');
    this.pdfRow(document, 'CR Number', workspace.clientInfo.crNumber || '-');
    this.pdfRow(document, 'Risk Rating', record.riskRating || '-');
    document.moveDown();
    document.fontSize(13).text('Compliance Officer Comments', { underline: true });
    document.moveDown(0.5);
    this.pdfRow(document, 'DMLRO Comment', record.dmlroComment || '-');
    this.pdfRow(document, 'MLRO Comment', record.mlroComment || '-');
    document.moveDown();
    document.fontSize(13).text('Uploaded Documents', { underline: true });
    document.moveDown(0.5);
    if (record.documents.length) {
      record.documents.forEach((file, index) => document.fontSize(10).text(`${index + 1}. ${file.fileName}`));
    } else {
      document.fontSize(10).text('No CRRF documents uploaded.');
    }
    document.end();

    return {
      fileName: `${this.safeExportName(workspace.clientInfo.clientName)}-crrf-report.pdf`,
      mimeType: 'application/pdf',
      content: await done
    };
  }

  private async findCase(user: RequestUser, kycCaseId: string) {
    const kycCase = await this.prisma.kycCase.findFirst({
      where: { id: kycCaseId, ...this.caseTenantWhere(user) },
      include: { client: true, service: true }
    });
    if (!kycCase) throw new NotFoundException('KYC case not found.');
    return kycCase;
  }

  private async ensureRecord(user: RequestUser, kycCase: Awaited<ReturnType<CrrfService['findCase']>>) {
    const existing = await this.prisma.crrfRecord.findFirst({
      where: { kycCaseId: kycCase.id, ...this.recordTenantWhere(user) },
      include: { documents: { orderBy: { createdAt: 'desc' } } }
    });
    if (existing) return existing;

    return this.prisma.crrfRecord.create({
      data: {
        tenantId: kycCase.tenantId,
        kycCaseId: kycCase.id,
        createdById: user.id,
        updatedById: user.id
      },
      include: { documents: true }
    });
  }

  private clientInfo(kycCase: { id: string; title: string; client: { id: string; name: string; registrationNumber?: string | null; country?: string | null }; service?: { name: string } | null }) {
    return {
      caseId: kycCase.id,
      caseTitle: kycCase.title,
      clientId: kycCase.client.id,
      clientName: kycCase.client.name,
      clientCode: kycCase.client.registrationNumber || kycCase.client.id,
      crNumber: kycCase.client.registrationNumber || null,
      country: kycCase.client.country || null,
      serviceName: kycCase.service?.name || null
    };
  }

  private pdfRow(document: PDFKit.PDFDocument, label: string, value: string) {
    document.fontSize(10).font('Helvetica-Bold').text(`${label}: `, { continued: true });
    document.font('Helvetica').text(value);
    document.moveDown(0.4);
  }

  private caseTenantWhere(user: RequestUser): Prisma.KycCaseWhereInput {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
  }

  private recordTenantWhere(user: RequestUser): Prisma.CrrfRecordWhereInput {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
  }

  private documentTenantWhere(user: RequestUser): Prisma.CrrfDocumentWhereInput {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
  }

  private getTenantId(user: RequestUser) {
    if (!user.tenantId) {
      throw new ForbiddenException('User is not assigned to a tenant.');
    }
    return user.tenantId;
  }

  private uploadRoot() {
    return normalize(process.env.CRRF_UPLOAD_DIR || join(process.cwd(), 'uploads', 'crrf-documents'));
  }

  private resolveDocumentPath(storagePath: string) {
    const uploadRoot = this.uploadRoot();
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

  private isAllowedDocument(file: { originalname: string; mimetype?: string }) {
    const fileName = file.originalname.toLowerCase();
    const mimeType = (file.mimetype || '').toLowerCase();
    return (
      fileName.endsWith('.pdf') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.xlsx') ||
      mimeType === 'application/pdf' ||
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }

  private mimeTypeForFile(fileName: string) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
    return 'application/octet-stream';
  }

  private safeFileName(fileName: string) {
    const name = basename(fileName || 'document')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return name || 'document';
  }

  private safeExportName(value: string) {
    return this.safeFileName(value || 'client').replace(/\.[^.]+$/, '').replace(/\s+/g, '-').toLowerCase();
  }

  private escapeHtml(value: string) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private enumValue<T extends Record<string, string>>(source: T, value: unknown): T[keyof T] | null {
    return typeof value === 'string' && Object.values(source).includes(value) ? (value as T[keyof T]) : null;
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
