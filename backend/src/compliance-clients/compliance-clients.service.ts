import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientJurisdiction, DueDiligenceType, Prisma, RiskClassification } from '@prisma/client';
import { Workbook } from 'exceljs';
import { AccessControlService } from '../access-control/access-control.service';
import { COMPLIANCE_REGISTER_STATUSES, COMPLIANCE_REGISTER_WHERE } from '../common/client-compliance';
import { userSummarySelect } from '../common/user-summary';
import { KycService } from '../kyc/kyc.service';
import { applyOverrides, identityExpiries, optionText, personKey, profileFieldSpec, profileFromForm, ProfileOverride, rowKey, text } from './compliance-client-profile';
import { ComplianceDocumentsService, UploadedClientFile } from './compliance-documents.service';
import { syncIdentityExpiryItems } from './identity-expiry-sync';
import { UpdateProfileFieldDto } from './dto/profile-edit.dto';
import { expiryState } from './compliance-monitoring.service';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateComplianceClientDto } from './dto/update-compliance-client.dto';

export type ComplianceClientQuery = {
  search?: string;
  status?: string;
  riskLevel?: string;
  cddType?: string;
  jurisdiction?: string;
  review?: string;
  attention?: string;
  page?: string;
  pageSize?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 30;
const EXPORT_LIMIT = 5000;
// Codes are text (CL-2026-0001, CL-LEG-0263), so order by onboarding date rather than by code.
const REGISTER_ORDER: Prisma.ClientOrderByWithRelationInput[] = [{ activatedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];

const listSelect = {
  id: true,
  clientCode: true,
  name: true,
  registrationNumber: true,
  jurisdiction: true,
  email: true,
  phone: true,
  address: true,
  country: true,
  status: true,
  statusReason: true,
  cddType: true,
  riskLevel: true,
  lastReviewDate: true,
  nextReviewDate: true,
  activatedAt: true,
  createdAt: true,
  contacts: { where: { isPrimary: true }, take: 1, select: { name: true, email: true, phone: true } },
  engagements: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { engagementNumber: true, serviceName: true, status: true, startDate: true }
  },
  kycCases: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, kycNumber: true, status: true } },
  riskChanges: { where: { status: 'PENDING' }, take: 1, select: { id: true, proposedRisk: true } },
  reviews: { where: { status: 'IN_PROGRESS' }, take: 1, select: { id: true } },
  screenings: { orderBy: [{ screenedAt: 'desc' }, { createdAt: 'desc' }], take: 1, select: { result: true, screenedAt: true } },
  expiryItems: { where: { isActive: true }, orderBy: { expiryDate: 'asc' }, take: 1, select: { expiryDate: true } },
  _count: { select: { engagements: true, kycCases: true } }
} satisfies Prisma.ClientSelect;

type ListedClient = Prisma.ClientGetPayload<{ select: typeof listSelect }>;

@Injectable()
export class ComplianceClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kycService?: KycService,
    private readonly accessControl?: AccessControlService,
    private readonly documents?: ComplianceDocumentsService
  ) {}

  // Client profile for the compliance client page. Company and party details are read from the client's
  // profile KYC case (the latest activated case, else the latest case with a form); nothing is copied or created.
  async findOne(user: RequestUser, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...this.tenantWhere(user), ...COMPLIANCE_REGISTER_WHERE },
      select: {
        ...listSelect,
        tenantId: true,
        industry: true,
        currentKycCaseId: true,
        contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], select: { id: true, name: true, email: true, phone: true, position: true, isPrimary: true } },
        engagements: {
          orderBy: [{ startDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
          select: { id: true, engagementNumber: true, serviceName: true, description: true, status: true, startDate: true, endDate: true, kycCaseId: true, createdAt: true }
        },
        kycCases: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, kycNumber: true, title: true, status: true, createdAt: true, updatedAt: true,
            purpose: true, previousKycCaseId: true,
            service: { select: { name: true } },
            kycForm: { select: { id: true } }
          }
        }
      }
    });
    if (!client) throw new NotFoundException('Compliance client not found');

    const profileCase = this.pickProfileCase(client);
    const caseIds = client.kycCases.map((kycCase) => kycCase.id);
    const [form, overrides, identityDocuments, legalDocuments, riskHistory, crrf, review, canViewCrrf] = await Promise.all([
      profileCase && this.kycService ? this.kycService.formSnapshot(profileCase.id) : Promise.resolve(null),
      profileCase ? this.profileOverrides(client.tenantId, profileCase.id) : Promise.resolve([]),
      this.prisma.clientDocument.findMany({
        where: { clientId: client.id, tenantId: client.tenantId, deletedAt: null, personKey: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, personKey: true, personName: true, identityType: true, documentNumber: true, documentExpiry: true,
          fileName: true, mimeType: true, createdAt: true, uploadedBy: { select: userSummarySelect }
        }
      }),
      this.prisma.legalDocument.findMany({
        where: { kycCaseId: { in: caseIds }, tenantId: client.tenantId, storagePath: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, kycCaseId: true, documentType: true, fileName: true, mimeType: true, createdAt: true }
      }),
      this.prisma.riskReclassification.findMany({
        where: { kycCaseId: { in: caseIds }, tenantId: client.tenantId },
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true, kycCaseId: true, previousRisk: true, newRisk: true, reasonCategory: true, explanation: true, effectiveDate: true,
          changedBy: { select: userSummarySelect }
        }
      }),
      profileCase
        ? this.prisma.crrfRecord.findFirst({
            where: { kycCaseId: profileCase.id, tenantId: client.tenantId },
            select: { riskRating: true, updatedAt: true, documents: { orderBy: { createdAt: 'desc' }, select: { id: true, fileName: true, createdAt: true } } }
          })
        : Promise.resolve(null),
      profileCase
        ? this.prisma.kycInternalReview.findFirst({ where: { kycCaseId: profileCase.id, tenantId: client.tenantId }, select: { riskClassification: true, dueDiligenceType: true } })
        : Promise.resolve(null),
      this.canView(user, 'crrf')
    ]);

    const { contacts, engagements, kycCases, industry, tenantId: _tenantId, currentKycCaseId: _current, ...rest } = client;
    const summary = this.toListItem({ ...rest, contacts: contacts.filter((contact) => contact.isPrimary).slice(0, 1), engagements: engagements.slice(0, 1), kycCases: kycCases.slice(0, 1) });
    return {
      client: { ...summary, industry },
      contacts,
      engagements,
      kycCases: kycCases.map(({ kycForm, service, ...kycCase }) => ({ ...kycCase, serviceName: service?.name || null, hasForm: Boolean(kycForm) })),
      profileCase: profileCase ? { id: profileCase.id, kycNumber: profileCase.kycNumber, status: profileCase.status } : null,
      profile: profileFromForm(form, overrides),
      // Values changed on this page (section|rowId|field), shown with an "edited" marker.
      editedFields: overrides.map((override) => `${override.section}|${override.rowId}|${override.field}`),
      // QID / passport copies per person (personKey = normalized full name), newest first; earlier copies are history.
      identityDocuments,
      legalDocuments,
      riskHistory,
      // CRRF ratings and files follow the CRRF area of the role matrix; reviewer comments are never included here.
      crrf: canViewCrrf && crrf ? { riskRating: crrf.riskRating, updatedAt: crrf.updatedAt, documents: crrf.documents } : null,
      crrfRestricted: !canViewCrrf,
      internalReview: review
    };
  }

  // The client's current KYC: the case recorded on activation or re-KYC approval, else (clients activated before
  // that was recorded) the latest activated case with a form, else the latest case with a form.
  private pickProfileCase<T extends { id: string; status: string; kycForm: { id: string } | null }>(client: { currentKycCaseId: string | null; kycCases: T[] }) {
    return client.kycCases.find((kycCase) => kycCase.id === client.currentKycCaseId && kycCase.kycForm) ||
      client.kycCases.find((kycCase) => kycCase.status === 'CLIENT_ACTIVE' && kycCase.kycForm) ||
      client.kycCases.find((kycCase) => kycCase.kycForm) ||
      null;
  }

  private profileOverrides(tenantId: string, kycCaseId: string): Promise<ProfileOverride[]> {
    return this.prisma.clientProfileOverride.findMany({
      where: { tenantId, kycCaseId },
      orderBy: { updatedAt: 'asc' },
      select: { section: true, rowId: true, rowLabel: true, field: true, value: true }
    });
  }

  private async clientWithProfileCase(user: RequestUser, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...this.tenantWhere(user), ...COMPLIANCE_REGISTER_WHERE },
      select: {
        id: true, tenantId: true, name: true, status: true, currentKycCaseId: true,
        kycCases: { orderBy: { createdAt: 'desc' }, select: { id: true, kycNumber: true, status: true, serviceId: true, kycForm: { select: { id: true } } } }
      }
    });
    if (!client) throw new NotFoundException('Compliance client not found');
    const profileCase = this.pickProfileCase(client);
    const form = profileCase && this.kycService ? await this.kycService.formSnapshot(profileCase.id) : null;
    if (!profileCase || !form) throw new BadRequestException('This client has no KYC form to take the details from yet.');
    return { client, profileCase, form };
  }

  // Saves one value edited with the pencil icon. The approved KYC form is not changed: the value is stored as an
  // overlay on the client's current KYC, audited, and used for the page and to prefill the next re-KYC.
  async updateProfileField(user: RequestUser, id: string, dto: UpdateProfileFieldDto) {
    const spec = profileFieldSpec(dto.section, dto.field);
    if (!spec) throw new BadRequestException('This detail cannot be edited here.');
    const { client, profileCase, form } = await this.clientWithProfileCase(user, id);
    const value = this.profileValue(spec.kind, dto.value);

    const rowId = dto.section === 'COMPANY' || dto.section === 'KEY_CONTACT' ? '' : this.optionalText(dto.rowId) || '';
    const overrides = await this.profileOverrides(client.tenantId, profileCase.id);
    const existing = overrides.find((override) => override.section === dto.section && override.rowId === rowId && override.field === dto.field);
    let rowLabel: string | null = null;
    let previous: unknown;
    if (dto.section === 'COMPANY' || dto.section === 'KEY_CONTACT') {
      const source = (dto.section === 'COMPANY' ? form.sectionA : form.sectionE) as Record<string, unknown>;
      previous = source?.[dto.field];
    } else {
      const raw = dto.section === 'OFFICER'
        ? (form.sectionC as { managers?: unknown }).managers
        : (form.sectionB as Record<string, unknown>)[dto.section === 'SHAREHOLDER' ? 'shareholders' : 'ubos'];
      const list = (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>;
      const index = list.findIndex((row, position) => rowKey(row, position) === rowId);
      if (!rowId || index < 0) throw new BadRequestException('This person is no longer on the client profile. Refresh the page.');
      const row = list[index];
      if (row.shareholderType === 'Corporate Entity' && ['qidNumber', 'qidExpiry', 'passportNumber', 'passportExpiry'].includes(dto.field)) {
        throw new BadRequestException('QID and passport apply to individuals. Use the CR number for a corporate shareholder.');
      }
      rowLabel = existing?.rowLabel ?? text(row.fullName);
      previous = row[dto.field];
    }
    const from = existing ? existing.value : spec.kind === 'list' ? optionText(previous) : text(previous);
    if ((from ?? null) === value) return this.findOne(user, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.clientProfileOverride.upsert({
        where: { kycCaseId_section_rowId_field: { kycCaseId: profileCase.id, section: dto.section, rowId, field: dto.field } },
        update: { value, updatedById: user.id },
        create: { tenantId: client.tenantId, clientId: client.id, kycCaseId: profileCase.id, section: dto.section, rowId, rowLabel, field: dto.field, value, updatedById: user.id }
      });
      await tx.auditLog.create({
        data: {
          tenantId: client.tenantId,
          actorId: user.id,
          action: 'UPDATE',
          entityType: 'ComplianceClient',
          entityId: client.id,
          metadata: {
            action: 'CLIENT_PROFILE_FIELD_EDITED',
            kycCaseId: profileCase.id,
            kycNumber: profileCase.kycNumber,
            section: dto.section,
            rowId,
            person: rowLabel,
            field: dto.field,
            from: from ?? null,
            to: value
          } as Prisma.InputJsonValue
        }
      });
      if (dto.section !== 'COMPANY') {
        const updated = await tx.clientProfileOverride.findMany({
          where: { tenantId: client.tenantId, kycCaseId: profileCase.id },
          orderBy: { updatedAt: 'asc' },
          select: { section: true, rowId: true, rowLabel: true, field: true, value: true }
        });
        await syncIdentityExpiryItems(tx, client, user.id, identityExpiries(profileFromForm(form, updated)));
      }
    });
    return this.findOne(user, id);
  }

  // Uploads a QID or passport copy for one person on the profile into the "Identity Documents" folder. When a new
  // number or expiry date is given, the person's details are updated through the audited profile edit, which also
  // keeps the Expiry record in step (a new expiry date starts a new set of reminders).
  async uploadIdentityDocument(
    user: RequestUser, id: string,
    input: { section?: string; rowId?: string; identityType?: string; documentNumber?: string; expiryDate?: string },
    files: UploadedClientFile[]
  ) {
    if (!this.documents) throw new BadRequestException('Document uploads are not available.');
    const identityType = input.identityType === 'QID' || input.identityType === 'PASSPORT' ? input.identityType : null;
    if (!identityType) throw new BadRequestException('Choose QID or passport.');
    if (files.length !== 1) throw new BadRequestException('Select one file: the copy of the QID or passport.');
    const section = String(input.section || '');
    if (!['SHAREHOLDER', 'UBO', 'OFFICER', 'KEY_CONTACT'].includes(section)) throw new BadRequestException('Choose the person this copy belongs to.');
    const { client, form } = await this.clientWithProfileCase(user, id);
    const rowId = section === 'KEY_CONTACT' ? '' : this.optionalText(input.rowId) || '';
    const raw = section === 'KEY_CONTACT'
      ? [form.sectionE as Record<string, unknown>]
      : ((section === 'OFFICER' ? (form.sectionC as { managers?: unknown }).managers : (form.sectionB as Record<string, unknown>)[section === 'SHAREHOLDER' ? 'shareholders' : 'ubos']) || []) as Array<Record<string, unknown>>;
    const row = section === 'KEY_CONTACT' ? raw[0] : raw.find((item, position) => rowKey(item, position) === rowId);
    if (!row) throw new BadRequestException('This person is no longer on the client profile. Refresh the page.');
    if (row.shareholderType === 'Corporate Entity') throw new BadRequestException('QID and passport copies apply to individuals.');
    // The person's current (edited) name is the link, so the copy follows a name changed on this page.
    const overrides = await this.profileOverrides(client.tenantId, form.kycCaseId);
    const nameOverride = overrides.find((override) => override.section === section && override.rowId === rowId && override.field === 'fullName');
    const fullName = text(nameOverride?.value) || text(row.fullName);
    if (!fullName) throw new BadRequestException('Enter the name of the person before uploading an ID copy.');
    const documentNumber = this.optionalText(input.documentNumber)?.slice(0, 100) || null;
    const expiry = this.profileValue('date', input.expiryDate);
    const section_ = await this.documents.sectionByKey(client.tenantId, 'identity');
    const label = identityType === 'QID' ? 'QID' : 'Passport';
    await this.documents.storeFiles(user, client, section_, files, {
      title: `${label} copy - ${fullName}`.slice(0, 200),
      notes: [documentNumber && `${label} no. ${documentNumber}`, expiry && `expires ${expiry}`].filter(Boolean).join(', ') || null,
      identity: {
        personKey: personKey(fullName), personName: fullName, identityType,
        documentNumber, documentExpiry: expiry ? new Date(`${expiry}T00:00:00.000Z`) : null
      }
    });
    const prefix = identityType === 'QID' ? 'qid' : 'passport';
    if (documentNumber) await this.updateProfileField(user, id, { section: section as never, rowId, field: `${prefix}Number`, value: documentNumber });
    if (expiry) await this.updateProfileField(user, id, { section: section as never, rowId, field: `${prefix}Expiry`, value: expiry });
    return this.findOne(user, id);
  }

  // Starts a periodic re-KYC prefilled from the current profile (including edits made on this page). The earlier
  // KYC cases stay unchanged and listed; the new case becomes current when its final approval is given.
  async startRekyc(user: RequestUser, id: string) {
    if (!this.kycService) throw new BadRequestException('Re-KYC is not available.');
    const { client, profileCase, form } = await this.clientWithProfileCase(user, id);
    if (client.status !== 'ACTIVE') throw new BadRequestException('Only active clients can start a re-KYC.');
    const overrides = await this.profileOverrides(client.tenantId, profileCase.id);
    const effective = applyOverrides(form, overrides);
    return this.kycService.createRekycCase(
      user,
      { id: client.id, tenantId: client.tenantId, name: client.name },
      { id: profileCase.id, kycNumber: profileCase.kycNumber, serviceId: profileCase.serviceId },
      effective
    );
  }

  private profileValue(kind: string, input: string | null | undefined) {
    const value = typeof input === 'string' ? input.trim() : '';
    if (!value) return null;
    if (kind === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) throw new BadRequestException('Enter the date as YYYY-MM-DD.');
      return value;
    }
    if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new BadRequestException('Enter a valid email address.');
    if (kind === 'percent') {
      const number = Number(value.replace(/%$/, ''));
      if (!Number.isFinite(number) || number < 0 || number > 100) throw new BadRequestException('Enter a percentage between 0 and 100.');
      return String(number);
    }
    if (kind !== 'longtext' && value.length > 500) throw new BadRequestException('This value is too long.');
    return value;
  }

  async list(user: RequestUser, query: ComplianceClientQuery) {
    const where = await this.buildWhere(user, query);
    const pageSize = this.boundedInt(query.pageSize, 25, 1, 100);
    const total = await this.prisma.client.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(this.boundedInt(query.page, 1, 1, 100000), totalPages);

    const [clients, stats] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: listSelect,
        orderBy: REGISTER_ORDER,
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.stats(user)
    ]);

    return {
      items: clients.map((client) => this.toListItem(client)),
      pagination: { page, pageSize, total, totalPages },
      stats
    };
  }

  async update(user: RequestUser, id: string, dto: UpdateComplianceClientDto) {
    const existing = await this.prisma.client.findFirst({
      where: { id, ...this.tenantWhere(user), ...COMPLIANCE_REGISTER_WHERE }
    });
    if (!existing) throw new NotFoundException('Compliance client not found');

    const data: Prisma.ClientUpdateInput = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const track = <K extends keyof typeof existing>(key: K, value: (typeof existing)[K] | undefined) => {
      if (value === undefined || value === existing[key]) return;
      (data as Record<string, unknown>)[key as string] = value;
      changes[key as string] = { from: existing[key], to: value };
    };

    if (dto.name !== undefined) {
      const name = this.optionalText(dto.name);
      if (!name) throw new BadRequestException('The client name cannot be empty.');
      track('name', name);
    }
    if (dto.clientCode !== undefined) {
      const code = this.optionalText(dto.clientCode)?.toUpperCase() || null;
      if (!code || !/^[A-Z0-9][A-Z0-9-]*$/.test(code)) throw new BadRequestException('Enter a client code such as CL-2026-0001 (letters, digits and dashes).');
      track('clientCode', code);
    }
    if (dto.registrationNumber !== undefined) track('registrationNumber', this.optionalText(dto.registrationNumber));
    if (dto.country !== undefined) track('country', this.optionalText(dto.country));
    if (dto.industry !== undefined) track('industry', this.optionalText(dto.industry));
    if (dto.cddType !== undefined) track('cddType', dto.cddType === 'NONE' ? null : (dto.cddType as DueDiligenceType));
    if (dto.jurisdiction !== undefined) track('jurisdiction', dto.jurisdiction === 'NONE' ? null : (dto.jurisdiction as ClientJurisdiction));
    if (dto.email !== undefined) track('email', this.optionalText(dto.email));
    if (dto.phone !== undefined) track('phone', this.optionalText(dto.phone));
    if (dto.address !== undefined) track('address', this.optionalText(dto.address));

    if (dto.status !== undefined && dto.status !== existing.status) {
      const reason = this.optionalText(dto.statusReason);
      if (dto.status === 'INACTIVE' && !reason) {
        throw new BadRequestException('Provide a reason when marking a client inactive.');
      }
      if (dto.status === 'ACTIVE' && existing.status !== 'INACTIVE') {
        throw new BadRequestException('Only inactive clients can be reactivated here. Clients on hold are released through their KYC engagement decision.');
      }
      track('status', dto.status);
      track('statusReason', dto.status === 'INACTIVE' ? reason : null);
    } else if (dto.statusReason !== undefined) {
      track('statusReason', this.optionalText(dto.statusReason));
    }

    if (!Object.keys(changes).length) return this.findListItem(user, existing.id);

    if (data.clientCode !== undefined) {
      const taken = await this.prisma.client.findFirst({ where: { tenantId: existing.tenantId, clientCode: data.clientCode as string, id: { not: existing.id } }, select: { name: true } });
      if (taken) throw new BadRequestException(`Client code ${data.clientCode} is already used by ${taken.name}.`);
    }

    await this.prisma.$transaction([
      this.prisma.client.update({ where: { id: existing.id }, data }),
      this.prisma.auditLog.create({
        data: {
          tenantId: existing.tenantId,
          actorId: user.id,
          action: 'UPDATE',
          entityType: 'ComplianceClient',
          entityId: existing.id,
          metadata: { changes } as Prisma.InputJsonValue
        }
      })
    ]);

    return this.findListItem(user, existing.id);
  }

  async exportExcel(user: RequestUser, query: ComplianceClientQuery) {
    const clients = await this.prisma.client.findMany({
      where: await this.buildWhere(user, query),
      select: listSelect,
      orderBy: REGISTER_ORDER,
      take: EXPORT_LIMIT
    });

    const workbook = new Workbook();
    workbook.creator = 'Newoon MIS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Compliance Clients', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'Client Code', key: 'clientCode', width: 16 },
      { header: 'Client Name', key: 'name', width: 42 },
      { header: 'CR / QFC No.', key: 'registrationNumber', width: 18 },
      { header: 'Jurisdiction', key: 'jurisdiction', width: 13 },
      { header: 'CDD Type', key: 'cddType', width: 11 },
      { header: 'Risk Level', key: 'riskLevel', width: 11 },
      { header: 'Status', key: 'status', width: 11 },
      { header: 'Status Reason', key: 'statusReason', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Address', key: 'address', width: 40 },
      { header: 'Activated', key: 'activatedAt', width: 13 },
      { header: 'Last Review', key: 'lastReviewDate', width: 13 },
      { header: 'Next Review', key: 'nextReviewDate', width: 13 },
      { header: 'Review Status', key: 'reviewState', width: 14 },
      { header: 'Engagements', key: 'engagementCount', width: 12 },
      { header: 'Latest Service', key: 'latestService', width: 36 },
      { header: 'Latest KYC No.', key: 'latestKycNumber', width: 16 },
      { header: 'Latest Screening', key: 'latestScreening', width: 16 },
      { header: 'Screening Date', key: 'latestScreeningDate', width: 14 },
      { header: 'Nearest Expiry', key: 'nearestExpiry', width: 14 },
      { header: 'Risk Change Pending', key: 'riskChangePending', width: 18 }
    ];

    for (const client of clients) {
      const item = this.toListItem(client);
      sheet.addRow({
        clientCode: item.clientCode ?? '',
        name: item.name,
        registrationNumber: item.registrationNumber || '',
        jurisdiction: item.jurisdiction || '',
        cddType: this.cddLabel(item.cddType),
        riskLevel: item.riskLevel || 'Pending',
        status: item.status,
        statusReason: item.statusReason || '',
        email: item.email || '',
        phone: item.phone || '',
        address: item.address || '',
        activatedAt: item.activatedAt || null,
        lastReviewDate: item.lastReviewDate || null,
        nextReviewDate: item.nextReviewDate || null,
        reviewState: { OVERDUE: 'Overdue', DUE_SOON: 'Due soon', SCHEDULED: 'Scheduled', NOT_SCHEDULED: 'Not scheduled' }[item.reviewState],
        engagementCount: item.engagementCount,
        latestService: item.latestEngagement?.serviceName || '',
        latestKycNumber: item.latestKycCase?.kycNumber || '',
        latestScreening: item.latestScreening?.result || '',
        latestScreeningDate: item.latestScreening?.screenedAt || null,
        nearestExpiry: item.nearestExpiry?.expiryDate || null,
        riskChangePending: item.pendingRiskChange ? `Yes (${item.pendingRiskChange.proposedRisk})` : ''
      });
    }

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF792326' } };
    header.alignment = { vertical: 'middle' };
    for (const key of ['activatedAt', 'lastReviewDate', 'nextReviewDate', 'latestScreeningDate', 'nearestExpiry']) {
      sheet.getColumn(key).numFmt = 'dd mmm yyyy';
    }
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      fileName: `compliance-clients-${stamp}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: Buffer.from(await workbook.xlsx.writeBuffer()),
      truncated: clients.length >= EXPORT_LIMIT
    };
  }

  private async canView(user: RequestUser, area: string) {
    if (!this.accessControl) return false;
    const allowed = await this.accessControl.allows(user.roles, area, false);
    return allowed ?? this.accessControl.allowsByDefault(user.roles, area, false);
  }

  private async stats(user: RequestUser) {
    const base: Prisma.ClientWhereInput = { ...this.tenantWhere(user), ...COMPLIANCE_REGISTER_WHERE };
    const now = new Date();
    const soon = new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS);
    const [byStatus, edd, highRisk, riskPending, overdue, dueSoon, riskApprovals, reviewsInProgress, expiring, screeningAlerts] = await Promise.all([
      this.prisma.client.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
      this.prisma.client.count({ where: { ...base, cddType: 'ENHANCED' } }),
      this.prisma.client.count({ where: { ...base, riskLevel: 'HIGH' } }),
      this.prisma.client.count({ where: { ...base, riskLevel: null } }),
      this.prisma.client.count({ where: { ...base, status: 'ACTIVE', nextReviewDate: { lt: now } } }),
      this.prisma.client.count({ where: { ...base, status: 'ACTIVE', nextReviewDate: { gte: now, lte: soon } } }),
      this.prisma.client.count({ where: { ...base, riskChanges: { some: { status: 'PENDING' } } } }),
      this.prisma.client.count({ where: { ...base, reviews: { some: { status: 'IN_PROGRESS' } } } }),
      this.prisma.client.count({ where: { ...base, expiryItems: { some: { isActive: true, expiryDate: { lte: soon } } } } }),
      this.screeningAlertClientIds(user)
    ]);
    const count = (status: string) => byStatus.find((row) => row.status === status)?._count._all || 0;
    return {
      total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
      active: count('ACTIVE'),
      inactive: count('INACTIVE'),
      onHold: count('ON_HOLD'),
      edd,
      highRisk,
      riskPending,
      reviewOverdue: overdue,
      reviewDueSoon: dueSoon,
      riskApprovals,
      reviewsInProgress,
      expiringDocuments: expiring,
      screeningAlerts: screeningAlerts.length
    };
  }

  // Clients whose most recent ongoing screening ended in Review or Alert (a later Clear screening closes it).
  private async screeningAlertClientIds(user: RequestUser) {
    const scope = this.tenantWhere(user) as { tenantId?: string };
    const rows = await this.prisma.$queryRaw<Array<{ clientId: string; result: string }>>(Prisma.sql`
      SELECT DISTINCT ON (s."clientId") s."clientId", s."result"::text AS "result"
      FROM "ClientScreening" s
      JOIN "Client" c ON c."id" = s."clientId"
      WHERE c."status" IN ('ACTIVE', 'INACTIVE', 'ON_HOLD') ${scope.tenantId ? Prisma.sql`AND s."tenantId" = ${scope.tenantId}` : Prisma.empty}
      ORDER BY s."clientId", s."screenedAt" DESC, s."createdAt" DESC`);
    return rows.filter((row) => row.result === 'ALERT' || row.result === 'REVIEW').map((row) => row.clientId);
  }

  private async findListItem(user: RequestUser, id: string) {
    const client = await this.prisma.client.findFirst({ where: { id, ...this.tenantWhere(user) }, select: listSelect });
    if (!client) throw new NotFoundException('Compliance client not found');
    return this.toListItem(client);
  }

  private async buildWhere(user: RequestUser, query: ComplianceClientQuery): Promise<Prisma.ClientWhereInput> {
    const and: Prisma.ClientWhereInput[] = [this.tenantWhere(user)];

    const status = this.optionalText(query.status)?.toUpperCase();
    if (status && status !== 'ALL') {
      if (!(COMPLIANCE_REGISTER_STATUSES as readonly string[]).includes(status)) throw new BadRequestException('Invalid status filter.');
      and.push({ status });
    }
    and.push(COMPLIANCE_REGISTER_WHERE);

    const risk = this.optionalText(query.riskLevel)?.toUpperCase();
    if (risk && risk !== 'ALL') {
      if (risk === 'PENDING') and.push({ riskLevel: null });
      else and.push({ riskLevel: this.enumValue(risk, Object.values(RiskClassification), 'risk level') });
    }

    const cdd = this.optionalText(query.cddType)?.toUpperCase();
    if (cdd && cdd !== 'ALL') {
      if (cdd === 'NONE') and.push({ cddType: null });
      else and.push({ cddType: this.enumValue(cdd, Object.values(DueDiligenceType), 'CDD type') });
    }

    const jurisdiction = this.optionalText(query.jurisdiction)?.toUpperCase();
    if (jurisdiction && jurisdiction !== 'ALL') {
      if (jurisdiction === 'NONE') and.push({ jurisdiction: null });
      else and.push({ jurisdiction: this.enumValue(jurisdiction, Object.values(ClientJurisdiction), 'jurisdiction') });
    }

    const review = this.optionalText(query.review)?.toUpperCase();
    if (review && review !== 'ALL') {
      const now = new Date();
      if (review === 'OVERDUE') and.push({ status: 'ACTIVE', nextReviewDate: { lt: now } });
      else if (review === 'DUE_SOON') and.push({ status: 'ACTIVE', nextReviewDate: { gte: now, lte: new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS) } });
      else if (review === 'NOT_SCHEDULED') and.push({ nextReviewDate: null });
      else throw new BadRequestException('Invalid review filter.');
    }

    const attention = this.optionalText(query.attention)?.toUpperCase();
    if (attention && attention !== 'ALL') {
      if (attention === 'RISK_APPROVAL') and.push({ riskChanges: { some: { status: 'PENDING' } } });
      else if (attention === 'REVIEW_IN_PROGRESS') and.push({ reviews: { some: { status: 'IN_PROGRESS' } } });
      else if (attention === 'EXPIRING') and.push({ expiryItems: { some: { isActive: true, expiryDate: { lte: new Date(Date.now() + DUE_SOON_DAYS * DAY_MS) } } } });
      else if (attention === 'SCREENING_ALERT') and.push({ id: { in: await this.screeningAlertClientIds(user) } });
      else throw new BadRequestException('Invalid attention filter.');
    }

    const search = this.optionalText(query.search)?.slice(0, 120);
    if (search) {
      const or: Prisma.ClientWhereInput[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { clientCode: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { contacts: { some: { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } } },
        { engagements: { some: { OR: [{ engagementNumber: { contains: search, mode: 'insensitive' } }, { serviceName: { contains: search, mode: 'insensitive' } }] } } },
        { kycCases: { some: { kycNumber: { contains: search, mode: 'insensitive' } } } }
      ];
      and.push({ OR: or });
    }

    return { AND: and };
  }

  private toListItem(client: ListedClient) {
    const now = Date.now();
    const next = client.nextReviewDate?.getTime();
    const reviewState: 'OVERDUE' | 'DUE_SOON' | 'SCHEDULED' | 'NOT_SCHEDULED' = !next
      ? 'NOT_SCHEDULED'
      : client.status === 'ACTIVE' && next < now
        ? 'OVERDUE'
        : client.status === 'ACTIVE' && next <= now + DUE_SOON_DAYS * DAY_MS
          ? 'DUE_SOON'
          : 'SCHEDULED';
    const primary = client.contacts[0];
    return {
      id: client.id,
      clientCode: client.clientCode,
      name: client.name,
      registrationNumber: client.registrationNumber,
      jurisdiction: client.jurisdiction,
      email: client.email || primary?.email || null,
      phone: client.phone || primary?.phone || null,
      address: client.address,
      country: client.country,
      primaryContactName: primary?.name || null,
      status: client.status,
      statusReason: client.statusReason,
      cddType: client.cddType,
      riskLevel: client.riskLevel,
      lastReviewDate: client.lastReviewDate,
      nextReviewDate: client.nextReviewDate,
      activatedAt: client.activatedAt,
      reviewState,
      engagementCount: client._count.engagements,
      kycCaseCount: client._count.kycCases,
      latestEngagement: client.engagements[0] || null,
      latestKycCase: client.kycCases[0] || null,
      pendingRiskChange: client.riskChanges[0] || null,
      reviewInProgress: Boolean(client.reviews[0]),
      latestScreening: client.screenings[0] || null,
      nearestExpiry: client.expiryItems[0] ? { expiryDate: client.expiryItems[0].expiryDate, state: expiryState(client.expiryItems[0].expiryDate) } : null
    };
  }

  private cddLabel(value: DueDiligenceType | null) {
    return value === 'SIMPLIFIED' ? 'SDD' : value === 'REGULAR' ? 'RDD' : value === 'ENHANCED' ? 'EDD' : '';
  }

  private enumValue<T extends string>(value: string, allowed: readonly T[], label: string): T {
    if (!(allowed as readonly string[]).includes(value)) throw new BadRequestException(`Invalid ${label} filter.`);
    return value as T;
  }

  private boundedInt(value: string | undefined, fallback: number, min: number, max: number) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
  }

  private optionalText(value: unknown) {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || null;
  }

  private tenantWhere(user: RequestUser): Prisma.ClientWhereInput {
    // Same scoping as the Clients register: Super Admin spans tenants.
    if (user.roles.includes('SUPER_ADMIN')) return {};
    if (!user.tenantId) throw new ForbiddenException('User is not assigned to a tenant');
    return { tenantId: user.tenantId };
  }
}
