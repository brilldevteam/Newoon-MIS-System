import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientJurisdiction, DueDiligenceType, Prisma, RiskClassification } from '@prisma/client';
import { Workbook } from 'exceljs';
import { AccessControlService } from '../access-control/access-control.service';
import { COMPLIANCE_REGISTER_STATUSES, COMPLIANCE_REGISTER_WHERE } from '../common/client-compliance';
import { userSummarySelect } from '../common/user-summary';
import { KycService } from '../kyc/kyc.service';
import {
  CORPORATE_ROLES, ENTITY_FIELDS, formFromRecords, INDIVIDUAL_ONLY_FIELDS, PERCENT_ROLES, PERSON_FIELDS, PERSON_TITLES, RecordFieldKind, ROLE_LABELS,
  ROLE_TYPES, RoleType, roleSummary
} from './client-records';
import {
  dateValue, editedMap, isoDate, loadRecords, notifyLegalDocumentChange, personInclude, syncClientRecordsFromKyc, syncRecordExpiries, toRecordEntity, toRecordPerson
} from './client-records-store';
import { ALLOCATED_ROLES, ALLOCATION_MANAGER_ROLES, assertClientTab, clientAccess, clientAccessLevel, clientScopeWhere } from './client-access';
import { addClientDetailSheets } from './client-export';
import { personKey, ProfileOverride } from './compliance-client-profile';
import { ComplianceDocumentsService, UploadedClientFile } from './compliance-documents.service';
import { IdDocumentReaderService } from './id-document-reader.service';
import { standardDocumentKinds, validateUploadFiles } from '../common/security/upload-security';
import { MrzResult } from '../common/mrz';
import { AddRoleDto, CreatePersonDto, PassportDto, RemoveRecordDto, UpdateRecordFieldDto, UpdateRoleDto } from './dto/client-records.dto';
import { expiryState } from './compliance-monitoring.service';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateComplianceClientDto } from './dto/update-compliance-client.dto';
import { clientPersonSearchWhere, clientSearchWhere } from './client-search';

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
    private readonly documents?: ComplianceDocumentsService,
    private readonly reader?: IdDocumentReaderService
  ) {}

  // Client profile for the compliance client page. The company and its people come from the client records
  // (ClientEntityProfile, ClientPerson), which are created from the current KYC the first time the page is opened
  // (older client-page edits on that KYC included). The approved KYC form itself is never changed.
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
    await this.ensureRecords(user, client, profileCase);
    const caseIds = client.kycCases.map((kycCase) => kycCase.id);
    const [records, identityDocuments, legalDocuments, riskHistory, crrf, review, canViewCrrf] = await Promise.all([
      loadRecords(this.prisma, client),
      this.prisma.clientDocument.findMany({
        where: { clientId: client.id, tenantId: client.tenantId, deletedAt: null, personKey: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, personId: true, personKey: true, personName: true, identityType: true, documentNumber: true, documentExpiry: true,
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
    const sourceCase = records.entity?.sourceKycCaseId ? kycCases.find((kycCase) => kycCase.id === records.entity!.sourceKycCaseId) : null;
    const access = clientAccess(user);
    const allocations = access.level === 'FULL' ? await this.allocationList(client.id) : [];
    const detail = {
      access,
      allocations,
      client: { ...this.forAccess(user, summary), industry },
      contacts,
      engagements,
      kycCases: kycCases.map(({ kycForm, service, ...kycCase }) => ({ ...kycCase, serviceName: service?.name || null, hasForm: Boolean(kycForm) })),
      profileCase: profileCase ? { id: profileCase.id, kycNumber: profileCase.kycNumber, status: profileCase.status } : null,
      profile: {
        // KYC the KYC-held values were last taken from.
        source: sourceCase ? { id: sourceCase.id, kycNumber: sourceCase.kycNumber } : null,
        company: { ...toRecordEntity(records.entity), edited: Object.keys(editedMap(records.entity?.fieldEditedAt)) },
        // One entry per person with all of their roles; each tab of the page lists the people holding its roles.
        people: records.people.map(toRecordPerson)
      },
      // QID / passport copies, newest first; personId links them to a person (earlier copies are history).
      identityDocuments,
      legalDocuments,
      riskHistory,
      // CRRF ratings and files follow the CRRF area of the role matrix; reviewer comments are never included here.
      crrf: canViewCrrf && crrf ? { riskRating: crrf.riskRating, updatedAt: crrf.updatedAt, documents: crrf.documents } : null,
      crrfRestricted: !canViewCrrf,
      internalReview: review
    };
    return this.detailForAccess(detail);
  }

  // Leaves out the data of the tabs the user's access level does not include (client-access.ts): UBOs, the KYC
  // assessment, CRRF and risk history for Operations and allocated staff; KYC cases, KYC uploads and passports for
  // allocated staff.
  private detailForAccess<T extends {
    access: ReturnType<typeof clientAccess>;
    kycCases: unknown[]; legalDocuments: unknown[]; riskHistory: unknown[]; crrf: unknown; crrfRestricted: boolean; internalReview: unknown;
    profileCase: unknown; identityDocuments: Array<{ identityType: string | null }>;
    profile: { people: Array<ReturnType<typeof toRecordPerson>>; source: unknown; company: unknown };
  }>(detail: T): T {
    if (detail.access.level === 'FULL') return detail;
    const allocated = detail.access.level === 'ALLOCATED';
    const people = detail.profile.people
      .map((person) => ({
        ...person,
        roles: person.roles.filter((role) => role.role !== 'UBO'),
        passports: allocated ? [] : person.passports,
        edited: (person.edited || []).filter((key) => !allocated || !key.startsWith('passport:'))
      }))
      .filter((person) => person.roles.length);
    return {
      ...detail,
      profile: { ...detail.profile, people },
      riskHistory: [],
      crrf: null,
      crrfRestricted: true,
      internalReview: null,
      kycCases: allocated ? [] : detail.kycCases,
      profileCase: allocated ? null : detail.profileCase,
      legalDocuments: allocated ? [] : detail.legalDocuments,
      identityDocuments: allocated ? detail.identityDocuments.filter((document) => document.identityType === 'QID') : detail.identityDocuments
    };
  }

  // Register values outside full access: no screening, risk-change or review status; allocated staff also do not see
  // the risk level or CDD type.
  private forAccess<T extends { latestScreening: unknown; pendingRiskChange: unknown; reviewInProgress: boolean; riskLevel: unknown; cddType: unknown; nearestExpiry: unknown; lastReviewDate: unknown; nextReviewDate: unknown; reviewState: unknown }>(user: RequestUser, item: T): T {
    const level = clientAccessLevel(user);
    if (level === 'FULL') return item;
    return {
      ...item, latestScreening: null, pendingRiskChange: null, reviewInProgress: false,
      ...(level === 'ALLOCATED' ? { riskLevel: null, cddType: null, nearestExpiry: null, lastReviewDate: null, nextReviewDate: null, reviewState: 'NOT_SCHEDULED' } : {})
    };
  }

  // ---------- Staff allocation (Accounting, HR) ----------

  private allocationList(clientId: string) {
    return this.prisma.clientAllocation.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, user: { select: { id: true, firstName: true, lastName: true, email: true, roles: { select: { role: { select: { name: true } } } } } } }
    }).then((rows) => rows.map((row) => ({ id: row.id, createdAt: row.createdAt, user: { ...row.user, roles: row.user.roles.map((item) => item.role.name) } })));
  }

  private assertAllocationManager(user: RequestUser) {
    if (!user.roles.some((role) => ALLOCATION_MANAGER_ROLES.includes(role))) {
      throw new ForbiddenException('Only Company Admin, AML Supervisor, DMLRO or MLRO allocate clients to staff.');
    }
  }

  // Staff who can be allocated: active users of the company with a role that works on allocated clients only.
  async allocationCandidates(user: RequestUser, id: string) {
    this.assertAllocationManager(user);
    const client = await this.editableClient(user, id);
    const [users, current] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId: client.tenantId, status: 'ACTIVE', roles: { some: { role: { name: { in: ALLOCATED_ROLES } } } } },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, email: true, roles: { select: { role: { select: { name: true } } } } }
      }),
      this.prisma.clientAllocation.findMany({ where: { clientId: client.id }, select: { userId: true } })
    ]);
    const taken = new Set(current.map((row) => row.userId));
    return users.filter((item) => !taken.has(item.id)).map((item) => ({ ...item, roles: item.roles.map((row) => row.role.name) }));
  }

  async allocate(user: RequestUser, id: string, userId: string) {
    this.assertAllocationManager(user);
    const client = await this.editableClient(user, id);
    const staff = await this.prisma.user.findFirst({ where: { id: userId, tenantId: client.tenantId, status: 'ACTIVE' }, select: { id: true, email: true } });
    if (!staff) throw new BadRequestException('Choose an active user of this company.');
    const existing = await this.prisma.clientAllocation.findUnique({ where: { clientId_userId: { clientId: client.id, userId: staff.id } } });
    if (existing) throw new BadRequestException('This user is already allocated to the client.');
    await this.prisma.$transaction(async (tx) => {
      await tx.clientAllocation.create({ data: { tenantId: client.tenantId, clientId: client.id, userId: staff.id, createdById: user.id } });
      await this.recordAudit(tx, user, client, { action: 'CLIENT_STAFF_ALLOCATED', userId: staff.id, user: staff.email });
    });
    return this.findOne(user, id);
  }

  async removeAllocation(user: RequestUser, id: string, allocationId: string) {
    this.assertAllocationManager(user);
    const client = await this.editableClient(user, id);
    const allocation = await this.prisma.clientAllocation.findFirst({ where: { id: allocationId, clientId: client.id }, include: { user: { select: { email: true } } } });
    if (!allocation) throw new NotFoundException('This allocation no longer exists. Refresh the page.');
    await this.prisma.$transaction(async (tx) => {
      await tx.clientAllocation.delete({ where: { id: allocation.id } });
      await this.recordAudit(tx, user, client, { action: 'CLIENT_STAFF_UNALLOCATED', userId: allocation.userId, user: allocation.user.email });
    });
    return this.findOne(user, id);
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
      select: { section: true, rowId: true, rowLabel: true, field: true, value: true, updatedAt: true }
    });
  }

  // Creates the client records from the current KYC the first time they are needed (clients activated before the
  // records existed). Two first loads at once are harmless: the entity record is unique per client, so the second
  // transaction fails and rolls back while the first one's records are used.
  private async ensureRecords(
    user: RequestUser,
    client: { id: string; tenantId: string; name: string },
    profileCase: { id: string } | null
  ) {
    const exists = await this.prisma.clientEntityProfile.findUnique({ where: { clientId: client.id }, select: { id: true } });
    if (exists) return;
    const [form, overrides] = await Promise.all([
      profileCase && this.kycService ? this.kycService.formSnapshot(profileCase.id) : Promise.resolve(null),
      profileCase ? this.profileOverrides(client.tenantId, profileCase.id) : Promise.resolve([] as ProfileOverride[])
    ]);
    try {
      await this.prisma.$transaction(
        (tx) => syncClientRecordsFromKyc(tx, { client, kycCaseId: profileCase?.id ?? null, form, overrides, userId: user.id, since: null }),
        { timeout: 60000 }
      );
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }

  private async editableClient(user: RequestUser, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...this.tenantWhere(user), ...COMPLIANCE_REGISTER_WHERE },
      select: {
        id: true, tenantId: true, name: true, status: true, currentKycCaseId: true,
        kycCases: { orderBy: { createdAt: 'desc' }, select: { id: true, kycNumber: true, status: true, serviceId: true, kycForm: { select: { id: true } } } }
      }
    });
    if (!client) throw new NotFoundException('Compliance client not found');
    await this.ensureRecords(user, client, this.pickProfileCase(client));
    return client;
  }

  private async personOf(client: { id: string; tenantId: string }, personId: string | undefined) {
    const person = personId
      ? await this.prisma.clientPerson.findFirst({ where: { id: personId, clientId: client.id, tenantId: client.tenantId, archivedAt: null }, include: personInclude })
      : null;
    if (!person) throw new NotFoundException('This person is no longer on the client profile. Refresh the page.');
    return person;
  }

  private recordAudit(tx: Prisma.TransactionClient, user: RequestUser, client: { id: string; tenantId: string }, metadata: Record<string, unknown>) {
    return tx.auditLog.create({
      data: { tenantId: client.tenantId, actorId: user.id, action: 'UPDATE', entityType: 'ComplianceClient', entityId: client.id, metadata: metadata as Prisma.InputJsonValue }
    });
  }

  // Checks one entered value and returns it in its stored form (text, Date, boolean or null).
  private recordValue(kind: RecordFieldKind, input: string | null | undefined): { text: string | null; stored: string | Date | boolean | null } {
    if (kind === 'bool') {
      const value = (input || '').trim().toLowerCase();
      if (!value) return { text: null, stored: null };
      if (['yes', 'true'].includes(value)) return { text: 'Yes', stored: true };
      if (['no', 'false'].includes(value)) return { text: 'No', stored: false };
      throw new BadRequestException('Choose Yes or No.');
    }
    if (kind === 'title') {
      const value = (input || '').trim();
      if (!value) return { text: null, stored: null };
      const title = PERSON_TITLES.find((item) => item.toLowerCase() === value.toLowerCase().replace(/\.$/, ''));
      if (!title) throw new BadRequestException(`Choose a title: ${PERSON_TITLES.join(', ')}.`);
      return { text: title, stored: title };
    }
    const value = this.profileValue(kind, input);
    return { text: value, stored: kind === 'date' ? dateValue(value) : value };
  }

  private shownValue(value: unknown) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return isoDate(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  // One company detail edited on the client page; audited, and kept by a later re-KYC approval.
  async updateEntityField(user: RequestUser, id: string, dto: UpdateRecordFieldDto) {
    const kind = ENTITY_FIELDS[dto.field];
    if (!kind) throw new BadRequestException('This detail cannot be edited here.');
    const client = await this.editableClient(user, id);
    const entity = await this.prisma.clientEntityProfile.findUniqueOrThrow({ where: { clientId: client.id } });
    const { text: value, stored } = this.recordValue(kind, dto.value);
    if (dto.field === 'legalName' && !value) throw new BadRequestException('The legal name cannot be empty.');
    const from = this.shownValue((entity as unknown as Record<string, unknown>)[dto.field]);
    if (from === value) return this.findOne(user, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.clientEntityProfile.update({
        where: { id: entity.id },
        data: { [dto.field]: stored, fieldEditedAt: { ...editedMap(entity.fieldEditedAt), [dto.field]: new Date().toISOString() }, updatedById: user.id }
      });
      await this.recordAudit(tx, user, client, { action: 'CLIENT_ENTITY_FIELD_EDITED', field: dto.field, from, to: value });
      if (['crExpiryDate', 'legalName', 'commercialRegistrationNo'].includes(dto.field)) await syncRecordExpiries(tx, client, user.id);
    });
    return this.findOne(user, id);
  }

  // One person detail edited on the client page. The person is the same on every tab, so the change shows everywhere.
  async updatePersonField(user: RequestUser, id: string, personId: string, dto: UpdateRecordFieldDto) {
    const client = await this.editableClient(user, id);
    await this.applyPersonField(user, client, personId, dto.field, dto.value);
    return this.findOne(user, id);
  }

  private async applyPersonField(user: RequestUser, client: { id: string; tenantId: string }, personId: string, field: string, input: string | null | undefined) {
    const kind = PERSON_FIELDS[field];
    if (!kind) throw new BadRequestException('This detail cannot be edited here.');
    const person = await this.personOf(client, personId);
    if (person.partyType === 'CORPORATE' && INDIVIDUAL_ONLY_FIELDS.includes(field)) {
      throw new BadRequestException('QID, title, PEP and similar details apply to individuals. Use the CR number for a corporate party.');
    }
    const { text: value, stored } = this.recordValue(kind, input);
    if (field === 'fullName' && !value) throw new BadRequestException('The name cannot be empty.');
    const from = this.shownValue((person as unknown as Record<string, unknown>)[field]);
    if (from === value) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.clientPerson.update({
        where: { id: person.id },
        data: { [field]: stored, fieldEditedAt: { ...editedMap(person.fieldEditedAt), [field]: new Date().toISOString() }, updatedById: user.id }
      });
      await this.recordAudit(tx, user, client, { action: 'CLIENT_PERSON_FIELD_EDITED', personId: person.id, person: person.fullName, field, from, to: value });
      if (['fullName', 'qidNumber', 'qidExpiry', 'nationalAddressExpiry'].includes(field)) await syncRecordExpiries(tx, client, user.id);
    });
  }

  private roleInput(role: RoleType, partyType: 'INDIVIDUAL' | 'CORPORATE', input: { title?: string; percentage?: string | null }) {
    if (partyType === 'CORPORATE' && !CORPORATE_ROLES.includes(role)) {
      throw new BadRequestException(`A company can be ${CORPORATE_ROLES.map((item) => ROLE_LABELS[item]).join(', ')}. ${ROLE_LABELS[role]} applies to individuals.`);
    }
    const title = role === 'OTHER' ? (this.optionalText(input.title) || '').slice(0, 100) : '';
    if (role === 'OTHER' && !title) throw new BadRequestException('Enter the position for "Other".');
    const percentText = PERCENT_ROLES.includes(role) ? this.profileValue('percent', input.percentage ?? null) : null;
    return { title, percentage: percentText === null ? null : new Prisma.Decimal(Number(percentText)) };
  }

  private async viaPerson(client: { id: string; tenantId: string }, role: RoleType, viaPersonId: string | null | undefined) {
    if (!viaPersonId) return null;
    if (role !== 'UBO') throw new BadRequestException('Only a UBO can be held through a company.');
    const via = await this.prisma.clientPerson.findFirst({ where: { id: viaPersonId, clientId: client.id, tenantId: client.tenantId, archivedAt: null, partyType: 'CORPORATE' }, select: { id: true } });
    if (!via) throw new BadRequestException('Choose a corporate shareholder of this client.');
    return via.id;
  }

  // A person added on the client page with their first role. Someone already on the client gets the role added
  // instead, so one person is never listed twice.
  async addPerson(user: RequestUser, id: string, dto: CreatePersonDto) {
    const client = await this.editableClient(user, id);
    const fullName = this.optionalText(dto.fullName);
    if (!fullName) throw new BadRequestException('Enter the name.');
    const partyType = dto.partyType === 'CORPORATE' ? 'CORPORATE' : 'INDIVIDUAL';
    const role = this.enumValue(dto.role, ROLE_TYPES, 'role');
    const { title, percentage } = this.roleInput(role, partyType, dto);
    const others = await this.prisma.clientPerson.findMany({ where: { clientId: client.id, tenantId: client.tenantId, archivedAt: null, partyType }, select: { fullName: true } });
    if (others.some((other) => personKey(other.fullName) === personKey(fullName))) {
      throw new BadRequestException(`${fullName} is already on this client. Add the role to that person instead, so the same person is linked on every tab.`);
    }
    const last = await this.prisma.clientPerson.aggregate({ where: { clientId: client.id }, _max: { sortOrder: true } });
    await this.prisma.$transaction(async (tx) => {
      const person = await tx.clientPerson.create({
        data: {
          tenantId: client.tenantId, clientId: client.id, partyType, fullName: fullName.slice(0, 300), sortOrder: (last._max.sortOrder ?? -1) + 1,
          createdById: user.id, updatedById: user.id,
          roles: { create: [{ tenantId: client.tenantId, role, title, percentage, createdById: user.id }] }
        }
      });
      await this.recordAudit(tx, user, client, { action: 'CLIENT_PERSON_ADDED', personId: person.id, person: person.fullName, partyType, role, title });
    });
    return this.findOne(user, id);
  }

  async addRole(user: RequestUser, id: string, personId: string, dto: AddRoleDto) {
    const client = await this.editableClient(user, id);
    const person = await this.personOf(client, personId);
    const role = this.enumValue(dto.role, ROLE_TYPES, 'role');
    const { title, percentage } = this.roleInput(role, person.partyType, dto);
    if (person.roles.some((item) => item.role === role && item.title === title)) throw new BadRequestException(`${person.fullName} already has this role.`);
    const viaPersonId = await this.viaPerson(client, role, dto.viaPersonId);
    if (viaPersonId === person.id) throw new BadRequestException('A company cannot hold itself.');
    await this.prisma.$transaction(async (tx) => {
      await tx.clientPersonRole.create({ data: { tenantId: client.tenantId, personId: person.id, role, title, percentage, viaPersonId, createdById: user.id } });
      await this.recordAudit(tx, user, client, { action: 'CLIENT_PERSON_ROLE_ADDED', personId: person.id, person: person.fullName, role, title, percentage: percentage?.toString() ?? null });
      await syncRecordExpiries(tx, client, user.id);
    });
    return this.findOne(user, id);
  }

  async updateRole(user: RequestUser, id: string, personId: string, roleId: string, dto: UpdateRoleDto) {
    const client = await this.editableClient(user, id);
    const person = await this.personOf(client, personId);
    const role = person.roles.find((item) => item.id === roleId);
    if (!role) throw new NotFoundException('This role is no longer on the client profile. Refresh the page.');
    const data: Prisma.ClientPersonRoleUpdateInput = {};
    const changes: Record<string, unknown> = {};
    if (dto.percentage !== undefined) {
      if (!PERCENT_ROLES.includes(role.role as RoleType)) throw new BadRequestException('Only shareholders and UBOs have a percentage.');
      const value = this.profileValue('percent', dto.percentage);
      data.percentage = value === null ? null : new Prisma.Decimal(Number(value));
      changes.percentage = { from: role.percentage?.toString() ?? null, to: value };
    }
    if (dto.viaPersonId !== undefined) {
      const viaPersonId = await this.viaPerson(client, role.role as RoleType, dto.viaPersonId);
      data.via = viaPersonId ? { connect: { id: viaPersonId } } : { disconnect: true };
      changes.viaPersonId = { from: role.viaPersonId, to: viaPersonId };
    }
    if (!Object.keys(changes).length) return this.findOne(user, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.clientPersonRole.update({ where: { id: role.id }, data });
      await this.recordAudit(tx, user, client, { action: 'CLIENT_PERSON_ROLE_EDITED', personId: person.id, person: person.fullName, role: role.role, title: role.title, changes });
    });
    return this.findOne(user, id);
  }

  // Removing a person's last role archives the person (kept with their documents and history, hidden from the tabs).
  async removeRole(user: RequestUser, id: string, personId: string, roleId: string, dto: RemoveRecordDto) {
    const client = await this.editableClient(user, id);
    const person = await this.personOf(client, personId);
    const role = person.roles.find((item) => item.id === roleId);
    if (!role) throw new NotFoundException('This role is no longer on the client profile. Refresh the page.');
    const archived = person.roles.length === 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.clientPersonRole.delete({ where: { id: role.id } });
      if (archived) await tx.clientPerson.update({ where: { id: person.id }, data: { archivedAt: new Date(), updatedById: user.id } });
      await this.recordAudit(tx, user, client, {
        action: archived ? 'CLIENT_PERSON_REMOVED' : 'CLIENT_PERSON_ROLE_REMOVED', personId: person.id, person: person.fullName, role: role.role, title: role.title,
        reason: this.optionalText(dto.reason)
      });
      await syncRecordExpiries(tx, client, user.id);
    });
    return this.findOne(user, id);
  }

  async addPassport(user: RequestUser, id: string, personId: string, dto: PassportDto) {
    const client = await this.editableClient(user, id);
    await this.createPassport(user, client, personId, dto);
    return this.findOne(user, id);
  }

  private async createPassport(user: RequestUser, client: { id: string; tenantId: string }, personId: string, dto: { passportNumber?: string | null; issuingCountry?: string | null; expiryDate?: string | null }) {
    const person = await this.personOf(client, personId);
    if (person.partyType === 'CORPORATE') throw new BadRequestException('Passports apply to individuals.');
    const passportNumber = this.optionalText(dto.passportNumber)?.slice(0, 100);
    if (!passportNumber) throw new BadRequestException('Enter the passport number.');
    const normal = (value: string) => value.replace(/\s+/g, '').toUpperCase();
    if (person.passports.some((item) => normal(item.passportNumber) === normal(passportNumber))) throw new BadRequestException('This passport is already listed for the person.');
    const expiryDate = dateValue(this.profileValue('date', dto.expiryDate ?? null));
    const created = await this.prisma.$transaction(async (tx) => {
      const passport = await tx.clientPersonPassport.create({
        data: {
          tenantId: client.tenantId, personId: person.id, passportNumber, issuingCountry: this.optionalText(dto.issuingCountry)?.slice(0, 100) || null, expiryDate,
          isPrimary: !person.passports.length, createdById: user.id, updatedById: user.id
        }
      });
      await this.recordAudit(tx, user, client, { action: 'CLIENT_PERSON_PASSPORT_ADDED', personId: person.id, person: person.fullName, passportNumber, expiryDate: isoDate(expiryDate) });
      await syncRecordExpiries(tx, client, user.id);
      return passport;
    });
    return created;
  }

  async updatePassport(user: RequestUser, id: string, personId: string, passportId: string, dto: UpdateRecordFieldDto) {
    const client = await this.editableClient(user, id);
    await this.applyPassportField(user, client, personId, passportId, dto.field, dto.value);
    return this.findOne(user, id);
  }

  private async applyPassportField(user: RequestUser, client: { id: string; tenantId: string }, personId: string, passportId: string, field: string, input: string | null | undefined) {
    const person = await this.personOf(client, personId);
    const passport = person.passports.find((item) => item.id === passportId);
    if (!passport) throw new NotFoundException('This passport is no longer listed. Refresh the page.');
    let data: Prisma.ClientPersonPassportUpdateInput;
    let to: string | null;
    if (field === 'passportNumber') {
      to = this.optionalText(input)?.slice(0, 100) || null;
      if (!to) throw new BadRequestException('Enter the passport number.');
      data = { passportNumber: to };
    } else if (field === 'issuingCountry') {
      to = this.optionalText(input)?.slice(0, 100) || null;
      data = { issuingCountry: to };
    } else if (field === 'expiryDate') {
      to = this.profileValue('date', input);
      data = { expiryDate: dateValue(to) };
    } else if (field === 'isPrimary') {
      to = 'Yes';
      data = { isPrimary: true };
    } else {
      throw new BadRequestException('This detail cannot be edited here.');
    }
    const from = field === 'expiryDate' ? isoDate(passport.expiryDate) : field === 'isPrimary' ? (passport.isPrimary ? 'Yes' : 'No') : (passport as unknown as Record<string, string | null>)[field];
    if (from === to) return;
    await this.prisma.$transaction(async (tx) => {
      if (field === 'isPrimary') await tx.clientPersonPassport.updateMany({ where: { personId: person.id }, data: { isPrimary: false } });
      await tx.clientPersonPassport.update({ where: { id: passport.id }, data: { ...data, updatedById: user.id } });
      await tx.clientPerson.update({ where: { id: person.id }, data: { fieldEditedAt: { ...editedMap(person.fieldEditedAt), [`passport:${passport.id}`]: new Date().toISOString() } } });
      await this.recordAudit(tx, user, client, { action: 'CLIENT_PERSON_PASSPORT_EDITED', personId: person.id, person: person.fullName, passportId: passport.id, field, from, to });
      await syncRecordExpiries(tx, client, user.id);
    });
  }

  async removePassport(user: RequestUser, id: string, personId: string, passportId: string, dto: RemoveRecordDto) {
    const client = await this.editableClient(user, id);
    const person = await this.personOf(client, personId);
    const passport = person.passports.find((item) => item.id === passportId);
    if (!passport) throw new NotFoundException('This passport is no longer listed. Refresh the page.');
    await this.prisma.$transaction(async (tx) => {
      await tx.clientPersonPassport.delete({ where: { id: passport.id } });
      const next = person.passports.find((item) => item.id !== passport.id);
      if (passport.isPrimary && next) await tx.clientPersonPassport.update({ where: { id: next.id }, data: { isPrimary: true } });
      await this.recordAudit(tx, user, client, {
        action: 'CLIENT_PERSON_PASSPORT_REMOVED', personId: person.id, person: person.fullName, passportNumber: passport.passportNumber, reason: this.optionalText(dto.reason)
      });
      await notifyLegalDocumentChange(tx, client, 'Passport removed',
        `Passport ${passport.passportNumber} of ${person.fullName} was removed by ${user.email || 'a user'}${this.optionalText(dto.reason) ? `. Reason: ${this.optionalText(dto.reason)}` : ''}.`);
      await syncRecordExpiries(tx, client, user.id);
    });
    return this.findOne(user, id);
  }

  // Uploads a QID or passport copy for one person into the "Identity Documents" folder, linked to the person. A new
  // number or expiry date given with the copy updates the person (QID) or that passport, through the audited edits,
  // which also keep the Expiry tab in step (a new expiry date starts a new set of reminders).
  async uploadIdentityDocument(
    user: RequestUser, id: string,
    input: { personId?: string; identityType?: string; passportId?: string; documentNumber?: string; expiryDate?: string },
    files: UploadedClientFile[],
    sourceNote?: string
  ) {
    if (!this.documents) throw new BadRequestException('Document uploads are not available.');
    const identityType = input.identityType === 'QID' || input.identityType === 'PASSPORT' ? input.identityType : null;
    if (!identityType) throw new BadRequestException('Choose QID or passport.');
    if (files.length !== 1) throw new BadRequestException('Select one file: the copy of the QID or passport.');
    const client = await this.editableClient(user, id);
    const person = await this.personOf(client, this.optionalText(input.personId) || undefined);
    if (person.partyType === 'CORPORATE') throw new BadRequestException('QID and passport copies apply to individuals.');
    const documentNumber = this.optionalText(input.documentNumber)?.slice(0, 100) || null;
    const expiry = this.profileValue('date', input.expiryDate);
    const passportId = this.optionalText(input.passportId);
    const passport = identityType === 'PASSPORT'
      ? (passportId ? person.passports.find((item) => item.id === passportId) : person.passports.find((item) => item.isPrimary) || person.passports[0]) || null
      : null;
    if (passportId && !passport) throw new NotFoundException('This passport is no longer listed. Refresh the page.');
    // Without new values the copy records the number and expiry the person currently has.
    const copyNumber = documentNumber || (identityType === 'QID' ? person.qidNumber : passport?.passportNumber) || null;
    const copyExpiry = expiry || isoDate(identityType === 'QID' ? person.qidExpiry : passport?.expiryDate) || null;
    const section = await this.documents.sectionByKey(client.tenantId, 'identity');
    const label = identityType === 'QID' ? 'QID' : 'Passport';
    await this.documents.storeFiles(user, client, section, files, {
      title: `${label} copy - ${person.fullName}`.slice(0, 200),
      notes: [sourceNote, copyNumber && `${label} no. ${copyNumber}`, copyExpiry && `expires ${copyExpiry}`].filter(Boolean).join(', ') || null,
      identity: {
        personKey: personKey(person.fullName), personId: person.id, personName: person.fullName, identityType,
        documentNumber: copyNumber, documentExpiry: dateValue(copyExpiry)
      }
    });
    await notifyLegalDocumentChange(this.prisma, client, `${label} copy uploaded`,
      `A ${label} copy of ${person.fullName}${copyNumber ? ` (no. ${copyNumber}${copyExpiry ? `, expires ${copyExpiry}` : ''})` : ''} was uploaded by ${user.email || 'a user'}${sourceNote ? ` (${sourceNote})` : ''}. Check whether the KYC needs updating.`);
    if (identityType === 'QID') {
      if (documentNumber) await this.applyPersonField(user, client, person.id, 'qidNumber', documentNumber);
      if (expiry) await this.applyPersonField(user, client, person.id, 'qidExpiry', expiry);
    } else if (passport) {
      if (documentNumber) await this.applyPassportField(user, client, person.id, passport.id, 'passportNumber', documentNumber);
      if (expiry) await this.applyPassportField(user, client, person.id, passport.id, 'expiryDate', expiry);
    } else if (documentNumber) {
      await this.createPassport(user, client, person.id, { passportNumber: documentNumber, expiryDate: expiry });
    }
    return this.findOne(user, id);
  }

  // Uses a QID / passport file uploaded on one of this client's KYC cases as a person's copy. The file is copied into
  // the Identity Documents folder (the KYC file is unchanged); reading it goes through the KYC access checks.
  async linkKycIdentityDocument(
    user: RequestUser, id: string,
    input: { legalDocumentId?: string; personId?: string; identityType?: string; passportId?: string; documentNumber?: string; expiryDate?: string }
  ) {
    if (!this.kycService) throw new BadRequestException('KYC documents are not available.');
    const client = await this.prisma.client.findFirst({ where: { id, ...this.tenantWhere(user), ...COMPLIANCE_REGISTER_WHERE }, select: { id: true, tenantId: true } });
    if (!client) throw new NotFoundException('Compliance client not found');
    const legal = await this.prisma.legalDocument.findFirst({
      where: { id: this.optionalText(input.legalDocumentId) || '', tenantId: client.tenantId, storagePath: { not: null }, kycCase: { clientId: client.id } },
      select: { id: true, kycCaseId: true, documentType: true, kycCase: { select: { kycNumber: true } } }
    });
    if (!legal) throw new NotFoundException('KYC document not found for this client.');
    const file = await this.kycService.getLegalDocumentFile(user, legal.kycCaseId, legal.id);
    const upload = { originalname: file.fileName, mimetype: file.mimeType || undefined, size: file.content.length, buffer: file.content };
    // Without typed values, use the number and expiry read from the file, but only when both pass their check digits
    // exactly as read and the document is the right kind; otherwise staff enter them with the pencils.
    let readFromDocument: { documentNumber: string; expiryDate: string } | null = null;
    if (!this.optionalText(input.documentNumber) && !this.optionalText(input.expiryDate)) {
      const read = await this.readSafely(upload);
      if (read && read.documentNumber && read.expiryDate && read.documentNumberCheck === 'OK' && read.expiryValid && this.typeMatches(read, input.identityType)) {
        readFromDocument = { documentNumber: read.documentNumber, expiryDate: read.expiryDate };
      }
    }
    const detail = await this.uploadIdentityDocument(user, id, { ...input, ...(readFromDocument || {}) }, [upload], `From ${legal.kycCase.kycNumber} (${legal.documentType})`);
    return { ...detail, readFromDocument };
  }

  // Reads the number and expiry date from a QID / passport copy (machine-readable zone, local OCR) to pre-fill the
  // upload form. Nothing is stored; staff check the values before saving.
  async readIdentityDocument(user: RequestUser, id: string, identityType: string | undefined, files: UploadedClientFile[]) {
    const client = await this.prisma.client.findFirst({ where: { id, ...this.tenantWhere(user), ...COMPLIANCE_REGISTER_WHERE }, select: { id: true } });
    if (!client) throw new NotFoundException('Compliance client not found');
    if (files.length !== 1) throw new BadRequestException('Select one file to read.');
    validateUploadFiles(files, standardDocumentKinds, 'document');
    const read = await this.readSafely(files[0]);
    if (!read || (!read.documentNumber && !read.expiryDate)) {
      // A card without machine-readable lines (older residency permit) is read from its printed labels; without
      // check digits the values are always shown as values to check.
      const card = this.reader ? await this.reader.readPrintedCard(files[0]).catch(() => null) : null;
      const number = identityType === 'PASSPORT' ? card?.passportNumber : card?.qidNumber;
      if (card && number) {
        return {
          found: true,
          format: 'TEXT',
          documentType: identityType === 'PASSPORT' ? 'P' : 'ID',
          issuingCountry: '',
          documentNumber: number,
          documentNumberCheck: 'FAILED',
          expiryDate: identityType === 'PASSPORT' ? card.passportExpiry : card.qidExpiry,
          expiryValid: false,
          nameOnDocument: card.fullName || '',
          nationality: card.nationality || '',
          typeMatches: true
        };
      }
      return { found: false, message: 'The number and expiry date could not be read from this file. Enter them from the document.' };
    }
    return {
      found: true,
      format: read.format,
      documentType: read.documentType,
      issuingCountry: read.issuingCountry,
      documentNumber: read.documentNumber,
      documentNumberCheck: read.documentNumberCheck,
      expiryDate: read.expiryDate,
      expiryValid: read.expiryValid,
      nameOnDocument: [read.givenNames, read.surname].filter(Boolean).join(' '),
      nationality: read.nationality,
      typeMatches: this.typeMatches(read, identityType)
    };
  }

  private async readSafely(file: UploadedClientFile) {
    if (!this.reader) return null;
    try {
      return await this.reader.read(file);
    } catch (error) {
      // Reading is a convenience: a file that cannot be read (or a reader problem) falls back to manual entry.
      return null;
    }
  }

  // A passport has a TD3 zone with document type P; an ID card such as the QID a TD1 zone.
  private typeMatches(read: MrzResult, identityType: string | undefined) {
    return identityType === 'PASSPORT' ? read.format === 'TD3' && read.documentType.startsWith('P') : identityType === 'QID' ? read.format === 'TD1' : false;
  }

  // Starts a periodic re-KYC prefilled from the client records (company, people and roles as kept on the client
  // page). The earlier KYC cases stay unchanged and listed; the new case updates the records on final approval.
  async startRekyc(user: RequestUser, id: string) {
    if (!this.kycService) throw new BadRequestException('Re-KYC is not available.');
    const client = await this.editableClient(user, id);
    if (client.status !== 'ACTIVE') throw new BadRequestException('Only active clients can start a re-KYC.');
    const profileCase = this.pickProfileCase(client);
    const form = profileCase ? await this.kycService.formSnapshot(profileCase.id) : null;
    if (!profileCase || !form) throw new BadRequestException('This client has no KYC form to take the details from yet.');
    const records = await loadRecords(this.prisma, client);
    const effective = formFromRecords(form, toRecordEntity(records.entity), records.people.map(toRecordPerson), Object.keys(editedMap(records.entity?.fieldEditedAt)));
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

    const search = this.optionalText(query.search)?.slice(0, 120);
    const level = clientAccessLevel(user);
    const scope = user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: user.tenantId || '' };
    const matchedPeople = search && clients.length ? await this.prisma.clientPerson.findMany({
      where: { AND: [{ clientId: { in: clients.map(client => client.id) } }, clientPersonSearchWhere(user, search)] },
      select: {
        id: true, clientId: true, fullName: true, title: true, qidNumber: true, email: true,
        legacyIdentity: level !== 'ALLOCATED',
        roles: { where: { ...scope, ...(level === 'FULL' ? {} : { role: { not: 'UBO' as const } }) }, select: { role: true, title: true } },
        passports: level !== 'ALLOCATED' ? { where: scope, select: { passportNumber: true } } : false
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }]
    }) : [];
    return {
      access: clientAccess(user),
      items: clients.map((client) => ({
        ...this.forAccess(user, this.toListItem(client)),
        matchedPeople: matchedPeople.filter(person => person.clientId === client.id).map(person => ({
          id: person.id, name: person.fullName, title: person.title, qidNumber: person.qidNumber, email: person.email,
          identity: level !== 'ALLOCATED' ? person.legacyIdentity : null,
          passports: level !== 'ALLOCATED' ? person.passports.map(passport => passport.passportNumber) : [],
          roles: [...new Set(person.roles.map(role => role.role === 'OTHER' ? role.title || ROLE_LABELS.OTHER : ROLE_LABELS[role.role]))]
        }))
      })),
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
    await this.addDetailSheets(user, workbook, clients);
    // Columns of data the user's access level does not show are left out (client-access.ts).
    const level = clientAccessLevel(user);
    const hiddenColumns = new Set<string>(
      level === 'FULL' ? [] : level === 'OPERATIONS'
        ? ['latestScreening', 'latestScreeningDate', 'riskChangePending']
        : ['cddType', 'riskLevel', 'lastReviewDate', 'nextReviewDate', 'reviewState', 'latestKycNumber', 'latestScreening', 'latestScreeningDate', 'nearestExpiry', 'riskChangePending']
    );
    const allColumns = [
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
    sheet.columns = allColumns.filter((column) => !hiddenColumns.has(column.key));

    for (const client of clients) {
      const item = this.forAccess(user, this.toListItem(client));
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
      if (!hiddenColumns.has(key)) sheet.getColumn(key).numFmt = 'dd mmm yyyy';
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

  // Company details, people and legal documents of the exported clients as extra sheets (Phase 4, requirement R07).
  // Clients whose records were never created (not opened since the records were introduced) get them first.
  private async addDetailSheets(user: RequestUser, workbook: Workbook, clients: Array<{ id: string; clientCode: string | null; name: string }>) {
    const ids = clients.map((client) => client.id);
    if (!ids.length) {
      // Same sheets every time, with headers only, so a spreadsheet built on the export keeps working.
      addClientDetailSheets(workbook, { clients: [], entities: [], people: [], documents: [] }, clientAccessLevel(user));
      return;
    }
    const missing = await this.prisma.client.findMany({
      where: { id: { in: ids }, entityProfile: { is: null } },
      select: { id: true, tenantId: true, name: true, currentKycCaseId: true, kycCases: { orderBy: { createdAt: 'desc' }, select: { id: true, status: true, kycForm: { select: { id: true } } } } }
    });
    for (const client of missing) await this.ensureRecords(user, client, this.pickProfileCase(client));

    const [entities, people, documents] = await Promise.all([
      this.prisma.clientEntityProfile.findMany({ where: { clientId: { in: ids } } }),
      this.prisma.clientPerson.findMany({ where: { clientId: { in: ids }, archivedAt: null }, include: personInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.clientLegalDocument.findMany({ where: { clientId: { in: ids }, status: 'CURRENT' }, orderBy: { createdAt: 'asc' } })
    ]);
    const roleNames = new Map(people.map((person) => [person.id, roleSummary(toRecordPerson(person))]));
    addClientDetailSheets(
      workbook,
      {
        clients,
        entities: entities.map((entity) => ({ ...toRecordEntity(entity)!, clientId: entity.clientId })),
        people: people.map((person) => ({ ...toRecordPerson(person), clientId: person.clientId })),
        documents: documents
          // QID and passports are listed from the people; the register rows are company and individual documents.
          .map((document) => ({
            clientId: document.clientId, typeLabel: document.typeLabel, nature: document.nature, documentNumber: document.documentNumber, holderName: document.holderName,
            location: document.location, issueDate: isoDate(document.issueDate), expiryDate: isoDate(document.expiryDate),
            personRoles: document.personId ? roleNames.get(document.personId) || null : null, source: 'REGISTER' as const
          }))
      },
      clientAccessLevel(user)
    );
  }

  // Expiry list as Excel (requirement R09): one client, or every client of the register. window: EXPIRED, 30, 60 or ALL
  // (all active records). Document name and expiry date first, as asked; days left is counted from today.
  async exportExpiry(user: RequestUser, clientId: string | null, window: string | undefined) {
    assertClientTab(user, 'expiry');
    const scope = clientId
      ? { id: clientId, ...this.tenantWhere(user), ...COMPLIANCE_REGISTER_WHERE }
      : { ...this.tenantWhere(user), ...COMPLIANCE_REGISTER_WHERE };
    const clients = await this.prisma.client.findMany({ where: scope, select: { id: true, name: true, clientCode: true } });
    if (clientId && !clients.length) throw new NotFoundException('Compliance client not found');
    const now = new Date();
    const days = window === 'EXPIRED' ? 0 : window === '30' ? 30 : window === '60' ? 60 : null;
    const items = await this.prisma.clientExpiryItem.findMany({
      where: {
        clientId: { in: clients.map((client) => client.id) }, isActive: true,
        // Same windows as the Expiry tab: expired, or not yet expired and due within 30 / 60 days.
        ...(days === 0 ? { expiryDate: { lt: now } } : days !== null ? { expiryDate: { gte: now, lte: new Date(now.getTime() + days * DAY_MS) } } : {})
      },
      orderBy: [{ expiryDate: 'asc' }]
    });
    const workbook = new Workbook();
    workbook.creator = 'Newoon MIS';
    workbook.created = now;
    const sheet = workbook.addWorksheet('Expiring documents', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'Document', key: 'document', width: 38 },
      { header: 'Expiry Date', key: 'expiryDate', width: 14 },
      { header: 'Days Left', key: 'daysLeft', width: 10 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Holder', key: 'holder', width: 34 },
      { header: 'Holder Role', key: 'role', width: 30 },
      { header: 'Number', key: 'number', width: 20 },
      { header: 'Client Code', key: 'clientCode', width: 15 },
      { header: 'Client', key: 'client', width: 38 }
    ];
    const typeLabels: Record<string, string> = { PASSPORT: 'Passport', QID: 'QID', CR: 'Commercial Registration', TRADE_LICENSE: 'Commercial License', COMPUTER_CARD: 'Computer card', OTHER: 'Document' };
    const statusLabels: Record<string, string> = { EXPIRED: 'Expired', DUE_30: 'Within 30 days', DUE_60: 'Within 60 days', DUE_90: 'Within 90 days', VALID: 'Valid' };
    for (const item of items) {
      const client = clients.find((entry) => entry.id === item.clientId)!;
      sheet.addRow({
        document: item.documentLabel || typeLabels[item.documentType] || item.documentType,
        expiryDate: item.expiryDate,
        daysLeft: Math.floor((item.expiryDate.getTime() - now.getTime()) / DAY_MS),
        status: statusLabels[expiryState(item.expiryDate, now)],
        holder: item.holderName,
        role: item.holderRole || '',
        number: item.documentNumber || '',
        clientCode: client.clientCode || '',
        client: client.name
      });
    }
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF792326' } };
    sheet.getColumn('expiryDate').numFmt = 'dd mmm yyyy';
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
    const stamp = now.toISOString().slice(0, 10);
    const name = clientId ? (clients[0].clientCode || 'client').replace(/[^A-Za-z0-9-]/g, '') : 'all-clients';
    return {
      fileName: `expiring-documents-${name}-${window && days !== null ? window.toLowerCase() : 'all'}-${stamp}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: Buffer.from(await workbook.xlsx.writeBuffer())
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
      clientAccessLevel(user) === 'FULL' ? this.screeningAlertClientIds(user) : Promise.resolve([] as string[])
    ]);
    const count = (status: string) => byStatus.find((row) => row.status === status)?._count._all || 0;
    const level = clientAccessLevel(user);
    // Counts follow what the access level shows (client-access.ts): Operations has no screening, risk-approval or
    // review-in-progress counts; allocated staff only the number of their clients.
    const risk = level !== 'ALLOCATED';
    return {
      total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
      active: count('ACTIVE'),
      inactive: count('INACTIVE'),
      onHold: count('ON_HOLD'),
      edd: risk ? edd : 0,
      highRisk: risk ? highRisk : 0,
      riskPending: risk ? riskPending : 0,
      reviewOverdue: risk ? overdue : 0,
      reviewDueSoon: risk ? dueSoon : 0,
      riskApprovals: level === 'FULL' ? riskApprovals : 0,
      reviewsInProgress: level === 'FULL' ? reviewsInProgress : 0,
      expiringDocuments: risk ? expiring : 0,
      screeningAlerts: level === 'FULL' ? screeningAlerts.length : 0
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
    // Filters on data the user's access level does not show are ignored, so they cannot be used to find it out.
    const level = clientAccessLevel(user);

    const status = this.optionalText(query.status)?.toUpperCase();
    if (status && status !== 'ALL') {
      if (!(COMPLIANCE_REGISTER_STATUSES as readonly string[]).includes(status)) throw new BadRequestException('Invalid status filter.');
      and.push({ status });
    }
    and.push(COMPLIANCE_REGISTER_WHERE);

    const risk = level === 'ALLOCATED' ? undefined : this.optionalText(query.riskLevel)?.toUpperCase();
    if (risk && risk !== 'ALL') {
      if (risk === 'PENDING') and.push({ riskLevel: null });
      else and.push({ riskLevel: this.enumValue(risk, Object.values(RiskClassification), 'risk level') });
    }

    const cdd = level === 'ALLOCATED' ? undefined : this.optionalText(query.cddType)?.toUpperCase();
    if (cdd && cdd !== 'ALL') {
      if (cdd === 'NONE') and.push({ cddType: null });
      else and.push({ cddType: this.enumValue(cdd, Object.values(DueDiligenceType), 'CDD type') });
    }

    const jurisdiction = this.optionalText(query.jurisdiction)?.toUpperCase();
    if (jurisdiction && jurisdiction !== 'ALL') {
      if (jurisdiction === 'NONE') and.push({ jurisdiction: null });
      else and.push({ jurisdiction: this.enumValue(jurisdiction, Object.values(ClientJurisdiction), 'jurisdiction') });
    }

    const review = level === 'ALLOCATED' ? undefined : this.optionalText(query.review)?.toUpperCase();
    if (review && review !== 'ALL') {
      const now = new Date();
      if (review === 'OVERDUE') and.push({ status: 'ACTIVE', nextReviewDate: { lt: now } });
      else if (review === 'DUE_SOON') and.push({ status: 'ACTIVE', nextReviewDate: { gte: now, lte: new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS) } });
      else if (review === 'NOT_SCHEDULED') and.push({ nextReviewDate: null });
      else throw new BadRequestException('Invalid review filter.');
    }

    // Risk approvals, reviews in progress and screening alerts are for full access; Operations keeps expiring documents.
    const attentionText = this.optionalText(query.attention)?.toUpperCase();
    const attention = level === 'FULL' || (level === 'OPERATIONS' && attentionText === 'EXPIRING') ? attentionText : undefined;
    if (attention && attention !== 'ALL') {
      if (attention === 'RISK_APPROVAL') and.push({ riskChanges: { some: { status: 'PENDING' } } });
      else if (attention === 'REVIEW_IN_PROGRESS') and.push({ reviews: { some: { status: 'IN_PROGRESS' } } });
      else if (attention === 'EXPIRING') and.push({ expiryItems: { some: { isActive: true, expiryDate: { lte: new Date(Date.now() + DUE_SOON_DAYS * DAY_MS) } } } });
      else if (attention === 'SCREENING_ALERT') and.push({ id: { in: await this.screeningAlertClientIds(user) } });
      else throw new BadRequestException('Invalid attention filter.');
    }

    const search = this.optionalText(query.search)?.slice(0, 120);
    if (search) {
      and.push(clientSearchWhere(user, search));
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
    // Same scoping as the Clients register: Super Admin spans tenants. Accounting, HR and other roles without full or
    // Operations access see only the clients allocated to them (client-access.ts).
    if (user.roles.includes('SUPER_ADMIN')) return {};
    if (!user.tenantId) throw new ForbiddenException('User is not assigned to a tenant');
    return { tenantId: user.tenantId, ...clientScopeWhere(user) };
  }
}
