import { ClientEntityProfile, Prisma } from '@prisma/client';
import {
  draftsFromProfile, ENTITY_FIELDS, ENTITY_KYC_FIELDS, matchPerson, PERSON_KYC_FIELDS, PersonDraft, PersonKycField, recordExpiries,
  RecordEntity, RecordLegalDocument, RecordPerson, RoleType
} from './client-records';
import { legalDocumentType } from './legal-document-catalogue';
import { personKey, profileFromForm, ProfileOverride } from './compliance-client-profile';
import { syncIdentityExpiryItems } from './identity-expiry-sync';

// Database side of the client records (see client-records.ts). Every function takes a transaction client, so the
// callers decide the transaction: activation and re-KYC approval in KycService, page loads and edits in
// ComplianceClientsService.

type Db = Prisma.TransactionClient;
type Client = { id: string; tenantId: string; name?: string | null };
type FormLike = Parameters<typeof profileFromForm>[0];

export const personInclude = {
  roles: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  passports: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] }
} satisfies Prisma.ClientPersonInclude;

export type StoredPerson = Prisma.ClientPersonGetPayload<{ include: typeof personInclude }>;

const DATE_FIELDS = new Set(['crExpiryDate', 'dateOfIncorporation', 'dateOfBirth', 'qidExpiry', 'nationalAddressExpiry']);
// Yes / No answers typed in the KYC form are kept as booleans on the person record.
const BOOLEAN_FIELDS = new Set(['dualCitizenship', 'isPep']);

export const isoDate = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : null);
export const dateValue = (value: string | null | undefined) => (value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null);

function storedValue(field: string, value: string | null): string | Date | boolean | null {
  if (value === null || value === undefined) return null;
  if (BOOLEAN_FIELDS.has(field)) return /^yes$/i.test(value.trim()) ? true : /^no$/i.test(value.trim()) ? false : null;
  if (DATE_FIELDS.has(field)) {
    const date = dateValue(value);
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }
  return value;
}

export function editedMap(value: Prisma.JsonValue | null | undefined): Record<string, string> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, string>) : {};
}

export function toRecordPerson(person: StoredPerson): RecordPerson {
  return {
    id: person.id,
    partyType: person.partyType,
    title: person.title,
    fullName: person.fullName,
    nationality: person.nationality,
    dualCitizenship: person.dualCitizenship,
    otherNationality: person.otherNationality,
    dateOfBirth: isoDate(person.dateOfBirth),
    address: person.address,
    telephone: person.telephone,
    email: person.email,
    isPep: person.isPep,
    pepDetails: person.pepDetails,
    representedEntity: person.representedEntity,
    qidNumber: person.qidNumber,
    qidExpiry: isoDate(person.qidExpiry),
    nationalAddressExpiry: isoDate(person.nationalAddressExpiry),
    registrationNumber: person.registrationNumber,
    linkedClientName: person.linkedClientName,
    legacyIdentity: person.legacyIdentity,
    passports: person.passports.map((passport) => ({
      id: passport.id, passportNumber: passport.passportNumber, issuingCountry: passport.issuingCountry, expiryDate: isoDate(passport.expiryDate), isPrimary: passport.isPrimary
    })),
    roles: person.roles.map((role) => ({
      id: role.id, role: role.role as RoleType, title: role.title, percentage: role.percentage === null ? null : String(Number(role.percentage)),
      viaPersonId: role.viaPersonId, sourceSection: role.sourceSection, sourceRowId: role.sourceRowId
    })),
    edited: Object.keys(editedMap(person.fieldEditedAt))
  };
}

export function toRecordEntity(entity: ClientEntityProfile | null): RecordEntity | null {
  if (!entity) return null;
  const result: RecordEntity = {};
  for (const field of Object.keys(ENTITY_FIELDS)) {
    const value = (entity as unknown as Record<string, unknown>)[field];
    result[field] = value instanceof Date ? isoDate(value) : (value as string | null) ?? null;
  }
  return result;
}

export async function loadRecords(db: Db, client: Client) {
  const [entity, people] = await Promise.all([
    db.clientEntityProfile.findUnique({ where: { clientId: client.id } }),
    db.clientPerson.findMany({
      where: { clientId: client.id, tenantId: client.tenantId, archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: personInclude
    })
  ]);
  return { entity, people };
}

// Keeps the Expiry tab in step with the records (QID, passports, national address certificate, CR) and the current
// documents of the legal documents register.
export async function syncRecordExpiries(db: Db, client: Client, userId: string) {
  const [{ entity, people }, documents] = await Promise.all([
    loadRecords(db, client),
    db.clientLegalDocument.findMany({ where: { clientId: client.id, tenantId: client.tenantId, status: 'CURRENT' } })
  ]);
  const legal: RecordLegalDocument[] = documents.map((document) => {
    const type = legalDocumentType(document.typeKey);
    return {
      id: document.id, typeLabel: document.typeLabel, expiryType: type?.expiryType || 'OTHER', isRegistration: Boolean(type?.isRegistration),
      isNationalAddress: document.typeKey === 'NATIONAL_ADDRESS', documentNumber: document.documentNumber, holderName: document.holderName,
      personId: document.personId, expiryDate: isoDate(document.expiryDate)
    };
  });
  return syncIdentityExpiryItems(db, client, userId, recordExpiries(toRecordEntity(entity), people.map(toRecordPerson), legal));
}

// Tells the AML team that a legal or identity document of a client was added, replaced, changed or removed
// (requirement L09). Shown to AML Team, AML Supervisor, DMLRO and MLRO (NotificationsService).
export function notifyLegalDocumentChange(db: Db, client: { id: string; tenantId: string; name: string }, title: string, message: string) {
  return db.notification.create({
    data: { tenantId: client.tenantId, clientId: client.id, type: 'COMPLIANCE_LEGAL_DOCUMENT_CHANGED', title: `${title}: ${client.name}`.slice(0, 200), message: message.slice(0, 1000) }
  });
}

// QID / passport copies uploaded before the records existed are linked by the person's normalized name.
export async function linkPersonDocuments(db: Db, client: Client) {
  const [documents, people] = await Promise.all([
    db.clientDocument.findMany({ where: { clientId: client.id, tenantId: client.tenantId, personId: null, personKey: { not: null } }, select: { id: true, personKey: true } }),
    db.clientPerson.findMany({ where: { clientId: client.id, tenantId: client.tenantId, archivedAt: null, partyType: 'INDIVIDUAL' }, select: { id: true, fullName: true } })
  ]);
  let linked = 0;
  for (const key of new Set(documents.map((document) => document.personKey as string))) {
    const person = people.find((item) => personKey(item.fullName) === key);
    if (!person) continue;
    const result = await db.clientDocument.updateMany({ where: { clientId: client.id, tenantId: client.tenantId, personId: null, personKey: key }, data: { personId: person.id } });
    linked += result.count;
  }
  return linked;
}

// Client-page edit field names for the older KYC-overlay edits, so the records show them as edited.
const OVERRIDE_FIELD: Record<string, string> = {
  fullName: 'fullName', nationality: 'nationality', dateOfBirth: 'dateOfBirth', residenceAddress: 'address', address: 'address',
  entityName: 'representedEntity', mobileNumber: 'telephone', email: 'email', qidNumber: 'qidNumber', qidExpiry: 'qidExpiry', identityNumber: 'registrationNumber'
};

function editedAt(override: ProfileOverride) {
  return (override.updatedAt || new Date()).toISOString();
}

function personData(draft: PersonDraft, fields: readonly PersonKycField[]) {
  const data: Record<string, string | Date | boolean | null> = {};
  for (const field of fields) {
    const value = draft.values[field];
    if (value === null || value === undefined || value === '') continue;
    const stored = storedValue(field, value);
    if (stored !== null) data[field] = stored;
  }
  return data;
}

export type RecordsSyncResult = { seeded: boolean; created: number; updated: number; archived: number; documentsLinked: number };

// Fills or updates the client records from a KYC form.
// - First time (no entity record yet): everything is taken from the form, with any older client-page edits on that
//   KYC applied, so nothing entered on the client page before the records existed is lost.
// - Later (activation of another KYC, re-KYC approval): the KYC values replace the record values, except values
//   edited on the client page after `since` (the time the KYC was started), roles added on the client page after
//   `since`, and client-only values (title, PEP, dual citizenship, extra passports, ...). An empty KYC value never
//   clears a record value. People no longer on the KYC lose their KYC roles and are archived when none are left.
export async function syncClientRecordsFromKyc(
  db: Db,
  input: { client: Client; kycCaseId: string | null; form: FormLike; overrides?: ProfileOverride[]; userId: string; since: Date | null }
): Promise<RecordsSyncResult> {
  const { client, userId } = input;
  const overrides = input.overrides || [];
  const { entity: entityDraft, people: drafts } = draftsFromProfile(profileFromForm(input.form, overrides));
  const now = new Date();
  const lateEdit = (map: Record<string, string>, field: string) => Boolean(input.since && map[field] && new Date(map[field]) > input.since);

  const existingEntity = await db.clientEntityProfile.findUnique({ where: { clientId: client.id } });
  const seeded = !existingEntity;
  if (!existingEntity) {
    const data: Record<string, string | Date | boolean | null> = {};
    for (const field of ENTITY_KYC_FIELDS) data[field] = storedValue(field, entityDraft[field] ?? null);
    if (!data.legalName && client.name) data.legalName = client.name;
    const edited: Record<string, string> = {};
    for (const override of overrides.filter((item) => item.section === 'COMPANY')) {
      edited[override.field === 'prospectiveService' ? 'prospectiveServices' : override.field] = editedAt(override);
    }
    await db.clientEntityProfile.create({
      data: { ...data, tenantId: client.tenantId, clientId: client.id, sourceKycCaseId: input.kycCaseId, fieldEditedAt: edited, updatedById: userId }
    });
  } else if (input.form) {
    const edited = editedMap(existingEntity.fieldEditedAt);
    const data: Record<string, string | Date | boolean | null> = {};
    for (const field of ENTITY_KYC_FIELDS) {
      const value = entityDraft[field];
      if (value !== null && value !== undefined && value !== '' && !lateEdit(edited, field)) data[field] = storedValue(field, value);
    }
    await db.clientEntityProfile.update({ where: { id: existingEntity.id }, data: { ...data, sourceKycCaseId: input.kycCaseId, updatedById: userId } });
  }

  const existing = seeded ? [] : await db.clientPerson.findMany({
    where: { clientId: client.id, tenantId: client.tenantId, archivedAt: null },
    include: personInclude
  });
  const records = existing.map(toRecordPerson);
  let sortOrder = existing.reduce((max, person) => Math.max(max, person.sortOrder), -1) + 1;
  const placed: Array<{ personId: string; draft: PersonDraft }> = [];
  const reset = new Set<string>();
  const summary: RecordsSyncResult = { seeded, created: 0, updated: 0, archived: 0, documentsLinked: 0 };

  for (const draft of drafts) {
    const match = matchPerson(records, draft);
    if (match) {
      const stored = existing.find((person) => person.id === match.id)!;
      const edited = editedMap(stored.fieldEditedAt);
      const data = personData(draft, PERSON_KYC_FIELDS.filter((field) => !lateEdit(edited, field)));
      if (draft.legacyIdentity && !stored.legacyIdentity && !stored.qidNumber && !stored.passports.length) data.legacyIdentity = draft.legacyIdentity;
      if (draft.linkedClientName && !stored.linkedClientName) data.linkedClientName = draft.linkedClientName;
      await db.clientPerson.update({ where: { id: stored.id }, data: { ...data, updatedById: userId } });
      for (const [index, item] of draft.passports.entries()) {
        const number = item.number.replace(/\s+/g, '').toUpperCase();
        const passport = stored.passports.find((existing) => existing.passportNumber.replace(/\s+/g, '').toUpperCase() === number);
        if (passport) {
          const expiry = dateValue(item.expiry);
          if (expiry && passport.expiryDate?.getTime() !== expiry.getTime() && !lateEdit(edited, `passport:${passport.id}`)) {
            await db.clientPersonPassport.update({ where: { id: passport.id }, data: { expiryDate: expiry, updatedById: userId } });
          }
        } else {
          // A new main passport on the KYC becomes the one printed on the next KYC; earlier passports stay listed.
          if (index === 0) await db.clientPersonPassport.updateMany({ where: { personId: stored.id }, data: { isPrimary: false } });
          await db.clientPersonPassport.create({
            data: { tenantId: client.tenantId, personId: stored.id, passportNumber: item.number, expiryDate: dateValue(item.expiry), isPrimary: index === 0, createdById: userId }
          });
        }
      }
      if (!reset.has(stored.id)) {
        reset.add(stored.id);
        if (input.since) await db.clientPersonRole.deleteMany({ where: { personId: stored.id, createdAt: { lte: input.since } } });
      }
      placed.push({ personId: stored.id, draft });
      summary.updated += 1;
    } else {
      const edited: Record<string, string> = {};
      if (seeded) {
        for (const override of overrides) {
          const field = OVERRIDE_FIELD[override.field];
          const fromRow = draft.roles.some((role) => role.sourceSection === override.section && (role.sourceRowId || '') === (override.rowId || ''));
          if (field && fromRow) edited[field] = editedAt(override);
        }
      }
      const person = await db.clientPerson.create({
        data: {
          ...personData(draft, PERSON_KYC_FIELDS),
          fullName: draft.fullName,
          partyType: draft.partyType,
          legacyIdentity: draft.legacyIdentity,
          linkedClientName: draft.linkedClientName,
          tenantId: client.tenantId,
          clientId: client.id,
          sortOrder: sortOrder++,
          fieldEditedAt: edited,
          createdById: userId,
          updatedById: userId
        }
      });
      for (const [index, item] of draft.passports.entries()) {
        const passport = await db.clientPersonPassport.create({
          data: { tenantId: client.tenantId, personId: person.id, passportNumber: item.number, expiryDate: dateValue(item.expiry), isPrimary: index === 0, createdById: userId }
        });
        const passportEdit = seeded && overrides.find((override) => ['passportNumber', 'passportExpiry'].includes(override.field) &&
          override.section === item.sourceSection && (override.rowId || '') === (item.sourceRowId || ''));
        if (passportEdit) edited[`passport:${passport.id}`] = editedAt(passportEdit);
      }
      if (Object.keys(edited).length) await db.clientPerson.update({ where: { id: person.id }, data: { fieldEditedAt: edited } });
      placed.push({ personId: person.id, draft });
      summary.created += 1;
    }
  }

  // Roles last, so a UBO can point at the corporate shareholder it holds through.
  const corporates = await db.clientPerson.findMany({
    where: { clientId: client.id, tenantId: client.tenantId, archivedAt: null, partyType: 'CORPORATE' },
    select: { id: true, fullName: true }
  });
  for (const { personId, draft } of placed) {
    for (const role of draft.roles) {
      const via = role.viaName ? corporates.find((item) => personKey(item.fullName) === personKey(role.viaName)) : null;
      const percentage = role.percentage !== null && Number.isFinite(Number(role.percentage)) ? new Prisma.Decimal(Number(role.percentage)) : null;
      await db.clientPersonRole.upsert({
        where: { personId_role_title: { personId, role: role.role, title: role.title } },
        update: { percentage, viaPersonId: via?.id ?? null, sourceSection: role.sourceSection, sourceRowId: role.sourceRowId },
        create: {
          tenantId: client.tenantId, personId, role: role.role, title: role.title, percentage, viaPersonId: via?.id ?? null,
          sourceSection: role.sourceSection, sourceRowId: role.sourceRowId, createdById: userId
        }
      });
    }
  }

  // People who are no longer on the KYC keep only the roles added on the client page after the KYC started.
  if (!seeded && input.form) {
    const placedIds = new Set(placed.map((item) => item.personId));
    for (const person of existing.filter((item) => !placedIds.has(item.id))) {
      if (input.since) await db.clientPersonRole.deleteMany({ where: { personId: person.id, createdAt: { lte: input.since } } });
      const remaining = await db.clientPersonRole.count({ where: { personId: person.id } });
      if (!remaining) {
        await db.clientPerson.update({ where: { id: person.id }, data: { archivedAt: now, updatedById: userId } });
        summary.archived += 1;
      }
    }
  }

  summary.documentsLinked = await linkPersonDocuments(db, client);
  await syncRecordExpiries(db, client, userId);
  await db.auditLog.create({
    data: {
      tenantId: client.tenantId,
      actorId: userId,
      action: 'UPDATE',
      entityType: 'ComplianceClient',
      entityId: client.id,
      metadata: { action: seeded ? 'CLIENT_RECORDS_CREATED' : 'CLIENT_RECORDS_UPDATED_FROM_KYC', kycCaseId: input.kycCaseId, ...summary } as Prisma.InputJsonValue
    }
  });
  return summary;
}
