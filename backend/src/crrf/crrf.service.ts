import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CrrfRiskRating, KycFormSectionKey, Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { basename, isAbsolute, join, normalize, relative } from 'path';
import { clampPage, pagingOf, searchTerm, TablePage, TableQueryDto } from '../common/table-query';
import { crrfDocumentKinds, isPathInsideRoot, validateUploadFiles } from '../common/security/upload-security';
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
        kycCase: {
          include: {
            client: true,
            service: true,
            kycSectionData: { where: { sectionKey: KycFormSectionKey.GENERAL_COMPANY } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return records.map((record) => ({
      ...record,
      clientInfo: this.clientInfo(record.kycCase),
      documentCount: record.documents.length
    }));
  }

  // The CRRF register as a table: same tenant scoping as listRecords, with search, risk filter, quick tab, sort and
  // paging done here. counts also carries `documents` (uploaded files across the matching records) for the summary cards.
  async table(user: RequestUser, query: TableQueryDto): Promise<TablePage<unknown>> {
    const q = searchTerm(query);
    const risk = (Object.values(CrrfRiskRating) as string[]).includes(query.risk || '') ? { riskRating: query.risk as CrrfRiskRating } : {};
    const common: Prisma.CrrfRecordWhereInput = {
      AND: [
        this.recordTenantWhere(user),
        risk,
        q
          ? {
              OR: [
                { kycCase: { title: { contains: q, mode: 'insensitive' } } },
                { kycCase: { kycNumber: { contains: q, mode: 'insensitive' } } },
                { kycCase: { client: { name: { contains: q, mode: 'insensitive' } } } },
                { kycCase: { client: { registrationNumber: { contains: q, mode: 'insensitive' } } } },
                { kycCase: { service: { name: { contains: q, mode: 'insensitive' } } } },
                // Names and CR numbers entered in the KYC company section (JSON, so the match is case-sensitive).
                { kycCase: { kycSectionData: { some: { sectionKey: KycFormSectionKey.GENERAL_COMPANY, OR: [
                  { data: { path: ['legalName'], string_contains: q } },
                  { data: { path: ['legalNameOfCompany'], string_contains: q } },
                  { data: { path: ['commercialRegistrationNo'], string_contains: q } },
                  { data: { path: ['clientCode'], string_contains: q } }
                ] } } } },
                ...((Object.values(CrrfRiskRating) as string[]).includes(q.toUpperCase()) ? [{ riskRating: q.toUpperCase() as CrrfRiskRating }] : [])
              ]
            }
          : {}
      ]
    };
    const tabs: Record<string, Prisma.CrrfRecordWhereInput> = {
      rated: { riskRating: { not: null } },
      pending: { riskRating: null },
      high: { riskRating: CrrfRiskRating.HIGH }
    };
    const tab = query.tab && tabs[query.tab] ? query.tab : 'all';
    const where: Prisma.CrrfRecordWhereInput = tab === 'all' ? common : { AND: [common, tabs[tab]] };
    const direction = query.dir === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.CrrfRecordOrderByWithRelationInput[] =
      query.sort === 'client' ? [{ kycCase: { client: { name: direction } } }]
      : query.sort === 'case' ? [{ kycCase: { title: direction } }]
      : query.sort === 'risk' ? [{ riskRating: direction }, { updatedAt: 'desc' }]
      : query.sort === 'documents' ? [{ documents: { _count: direction } }, { updatedAt: 'desc' }]
      : [{ updatedAt: query.dir === 'asc' ? 'asc' : 'desc' }];
    const { pageSize, requested } = pagingOf(query);
    const [total, groups, documents] = await Promise.all([
      this.prisma.crrfRecord.count({ where }),
      this.prisma.crrfRecord.groupBy({ by: ['riskRating'], where: common, _count: { _all: true } }),
      this.prisma.crrfDocument.count({ where: { crrfRecord: common } })
    ]);
    const page = clampPage(requested, total, pageSize);
    const records = await this.prisma.crrfRecord.findMany({
      where,
      orderBy: [...orderBy, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        kycCase: {
          include: {
            client: true,
            service: true,
            kycSectionData: { where: { sectionKey: KycFormSectionKey.GENERAL_COMPANY } }
          }
        }
      }
    });
    const items = records.map((record) => ({
      ...record,
      clientInfo: this.clientInfo(record.kycCase),
      documentCount: record.documents.length
    }));
    const all = groups.reduce((sum, group) => sum + group._count._all, 0);
    const unrated = groups.filter((group) => group.riskRating === null).reduce((sum, group) => sum + group._count._all, 0);
    const high = groups.filter((group) => group.riskRating === CrrfRiskRating.HIGH).reduce((sum, group) => sum + group._count._all, 0);
    return { items, total, page, pageSize, counts: { all, rated: all - unrated, pending: unrated, high, documents } };
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
    if (!record.documents.length) {
      throw new BadRequestException('Upload at least one supporting CRRF document before saving the record.');
    }

    await this.prisma.crrfRecord.update({
      where: { id: record.id },
      data: {
        riskRating,
        internalComment: this.internalCommentValue(dto),
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

    validateUploadFiles(files, crrfDocumentKinds, 'CRRF document');

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
      include: {
        client: true,
        service: true,
        kycSectionData: { where: { sectionKey: KycFormSectionKey.GENERAL_COMPANY } }
      }
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

  private clientInfo(kycCase: Awaited<ReturnType<CrrfService['findCase']>>) {
    const sectionA = this.generalCompanySection(kycCase);
    const crNumber = this.stringValue(sectionA.commercialRegistrationNo) || kycCase.client.registrationNumber || null;
    return {
      caseId: kycCase.id,
      caseTitle: kycCase.title,
      kycNumber: kycCase.kycNumber,
      clientId: kycCase.client.id,
      clientName: this.stringValue(sectionA.legalName) || this.stringValue(sectionA.legalNameOfCompany) || kycCase.client.name,
      clientCode: this.stringValue(sectionA.clientCode) || kycCase.client.registrationNumber || crNumber || kycCase.client.id,
      crNumber,
      country: this.stringValue(sectionA.countryOfIncorporation) || kycCase.client.country || null,
      serviceName: kycCase.service?.name || null
    };
  }

  private generalCompanySection(kycCase: Awaited<ReturnType<CrrfService['findCase']>>) {
    const data = kycCase.kycSectionData[0]?.data;
    return this.isRecord(data) ? data : {};
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

    return candidates.map((candidate) => normalize(candidate)).find((candidate) => isPathInsideRoot(candidate, normalizedRoot) && existsSync(candidate)) || null;
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

  private internalCommentValue(dto: JsonRecord) {
    const internalComment = this.stringValue(dto.internalComment);
    if (internalComment !== null) return internalComment;
    return [this.stringValue(dto.dmlroComment), this.stringValue(dto.mlroComment)].filter(Boolean).join('\n\n') || null;
  }

  private isRecord(value: unknown): value is JsonRecord {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
