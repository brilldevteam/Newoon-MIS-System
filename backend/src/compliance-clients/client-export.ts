import { Workbook, Worksheet } from 'exceljs';
import { ClientAccessLevel } from './client-access';
import { RecordEntity, RecordPerson, roleSummary } from './client-records';

// The client details added to the register Excel export (requirement R07, Phase 4): one sheet each for the company
// details (entity profile), the people with all their roles and personal details, and the legal documents with
// number, name, nationality / location and expiry. Every sheet follows the user's access level (client-access.ts):
// Operations gets no UBO-only people or UBO percentages, and allocated staff also get no passports.
// The column order and names are ours until the CIS file layout is supplied; they live in the three column lists
// below so they can be rearranged in one place.

export type ExportClient = { id: string; clientCode: string | null; name: string };
export type ExportEntity = RecordEntity & { clientId: string };
export type ExportPerson = RecordPerson & { clientId: string };
export type ExportDocument = {
  clientId: string; typeLabel: string; nature: 'COMPANY' | 'INDIVIDUAL'; documentNumber: string | null; holderName: string;
  location: string | null; issueDate: string | null; expiryDate: string | null; personRoles: string | null; source: 'REGISTER' | 'PERSON';
};

type Column = { header: string; key: string; width: number };

const COMPANY_COLUMNS: Column[] = [
  { header: 'Client Code', key: 'clientCode', width: 15 },
  { header: 'Client', key: 'client', width: 38 },
  { header: 'Legal Name of Company', key: 'legalName', width: 38 },
  { header: 'Commercial Registration No', key: 'commercialRegistrationNo', width: 22 },
  { header: 'CR Expiry Date', key: 'crExpiryDate', width: 15 },
  { header: 'Legal Form', key: 'legalForm', width: 24 },
  { header: 'Date of Incorporation', key: 'dateOfIncorporation', width: 18 },
  { header: 'Country of Incorporation', key: 'countryOfIncorporation', width: 22 },
  { header: 'Place of Incorporation', key: 'placeOfIncorporation', width: 22 },
  { header: 'Registered Office Address', key: 'registeredOfficeAddress', width: 44 },
  { header: 'Share Capital', key: 'shareCapital', width: 18 },
  { header: 'Tax Card No (TIN)', key: 'taxIdentificationNo', width: 18 },
  { header: 'PO Box', key: 'poBox', width: 12 },
  { header: 'Telephone', key: 'telephone', width: 18 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Website', key: 'website', width: 26 },
  { header: 'Main Purpose / Nature of Business', key: 'businessNature', width: 32 },
  { header: 'Related Industry', key: 'relatedIndustry', width: 26 },
  { header: 'License Activities', key: 'licenseActivities', width: 44 },
  { header: 'Financial Year End', key: 'financialYearEnd', width: 18 },
  { header: 'Approved Auditor', key: 'auditorName', width: 28 },
  { header: 'Services Requested', key: 'prospectiveServices', width: 36 }
];

const PEOPLE_COLUMNS: Column[] = [
  { header: 'Client Code', key: 'clientCode', width: 15 },
  { header: 'Client', key: 'client', width: 34 },
  { header: 'Type', key: 'type', width: 11 },
  { header: 'Title', key: 'title', width: 9 },
  { header: 'Full Name / Company', key: 'fullName', width: 34 },
  { header: 'Designation', key: 'designation', width: 40 },
  { header: 'Key Communication Person', key: 'keyContact', width: 14 },
  { header: 'Authorised Signatory', key: 'signatory', width: 12 },
  { header: 'Shareholder %', key: 'shareholderPercent', width: 12 },
  { header: 'UBO %', key: 'uboPercent', width: 9 },
  { header: 'UBO Held Through', key: 'heldThrough', width: 26 },
  { header: 'Entity Represented', key: 'representedEntity', width: 26 },
  { header: 'Nationality', key: 'nationality', width: 18 },
  { header: 'Dual Citizenship', key: 'dualCitizenship', width: 11 },
  { header: 'Other Nationality', key: 'otherNationality', width: 18 },
  { header: 'Date of Birth', key: 'dateOfBirth', width: 14 },
  { header: 'QID Number', key: 'qidNumber', width: 16 },
  { header: 'QID Expiry', key: 'qidExpiry', width: 13 },
  { header: 'Passport Number', key: 'passportNumber', width: 16 },
  { header: 'Passport Expiry', key: 'passportExpiry', width: 14 },
  { header: 'Other Passports', key: 'otherPassports', width: 30 },
  { header: 'National Address Expiry', key: 'nationalAddressExpiry', width: 16 },
  { header: 'Address', key: 'address', width: 40 },
  { header: 'Telephone', key: 'telephone', width: 18 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'PEP', key: 'pep', width: 8 },
  { header: 'PEP Details', key: 'pepDetails', width: 30 },
  { header: 'CR / Registration No (companies)', key: 'registrationNumber', width: 22 }
];

const DOCUMENT_COLUMNS: Column[] = [
  { header: 'Client Code', key: 'clientCode', width: 15 },
  { header: 'Client', key: 'client', width: 34 },
  { header: 'Document Type', key: 'type', width: 40 },
  { header: 'Nature', key: 'nature', width: 12 },
  { header: 'Number', key: 'number', width: 22 },
  { header: 'Name', key: 'name', width: 34 },
  { header: 'Role', key: 'role', width: 30 },
  { header: 'Nationality / Location', key: 'location', width: 20 },
  { header: 'Issue Date', key: 'issueDate', width: 13 },
  { header: 'Expiry Date', key: 'expiryDate', width: 13 },
  { header: 'Days Left', key: 'daysLeft', width: 10 },
  { header: 'Status', key: 'status', width: 16 }
];

const DATE_KEYS = new Set(['crExpiryDate', 'dateOfIncorporation', 'dateOfBirth', 'qidExpiry', 'passportExpiry', 'nationalAddressExpiry', 'issueDate', 'expiryDate']);
const DAY_MS = 86_400_000;

const date = (value: string | null | undefined) => (value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null);
const yesNo = (value: boolean | null) => (value === null ? '' : value ? 'Yes' : 'No');
const label = (person: RecordPerson, role: string) => person.roles.some((item) => item.role === role);

function styled(sheet: Worksheet, columns: Column[]) {
  sheet.columns = columns;
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF792326' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  for (const column of columns) if (DATE_KEYS.has(column.key)) sheet.getColumn(column.key).numFmt = 'dd mmm yyyy';
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

// What an access level may see of a person (mirrors the client page in compliance-clients.service.ts).
export function peopleForLevel(people: ExportPerson[], level: ClientAccessLevel): ExportPerson[] {
  if (level === 'FULL') return people;
  return people
    .map((person) => ({ ...person, roles: person.roles.filter((role) => role.role !== 'UBO'), passports: level === 'ALLOCATED' ? [] : person.passports }))
    .filter((person) => person.roles.length);
}

export function addClientDetailSheets(
  workbook: Workbook,
  data: { clients: ExportClient[]; entities: ExportEntity[]; people: ExportPerson[]; documents: ExportDocument[] },
  level: ClientAccessLevel,
  now = new Date()
) {
  const byId = new Map(data.clients.map((client) => [client.id, client]));
  const order = (clientId: string) => data.clients.findIndex((client) => client.id === clientId);
  const head = (clientId: string) => ({ clientCode: byId.get(clientId)?.clientCode ?? '', client: byId.get(clientId)?.name ?? '' });

  // Company details.
  const company = workbook.addWorksheet('Company Details');
  styled(company, COMPANY_COLUMNS);
  for (const client of data.clients) {
    const entity = data.entities.find((item) => item.clientId === client.id);
    const row: Record<string, unknown> = { ...head(client.id), legalName: client.name };
    if (entity) {
      for (const column of COMPANY_COLUMNS.slice(2)) {
        const value = (entity as Record<string, unknown>)[column.key] as string | null | undefined;
        row[column.key] = DATE_KEYS.has(column.key) ? date(value) : value ?? '';
      }
    }
    company.addRow(row);
  }

  // People: one row per person with all their roles, so a shareholder who is also a UBO and a director is one row.
  const hidePassports = level === 'ALLOCATED';
  const hideUbo = level !== 'FULL';
  const hidden = new Set<string>([...(hidePassports ? ['passportNumber', 'passportExpiry', 'otherPassports'] : []), ...(hideUbo ? ['uboPercent', 'heldThrough'] : [])]);
  const peopleSheet = workbook.addWorksheet('People');
  styled(peopleSheet, PEOPLE_COLUMNS.filter((column) => !hidden.has(column.key)));
  const people = peopleForLevel(data.people, level).sort((a, b) => order(a.clientId) - order(b.clientId));
  for (const person of people) {
    const main = person.passports.find((item) => item.isPrimary) || person.passports[0] || null;
    const others = person.passports.filter((item) => item !== main).map((item) => `${item.passportNumber}${item.expiryDate ? ` (exp. ${item.expiryDate})` : ''}`).join('; ');
    const shares = person.roles.find((role) => role.role === 'SHAREHOLDER');
    const ubo = person.roles.find((role) => role.role === 'UBO');
    const through = ubo?.viaPersonId ? people.concat(data.people).find((item) => item.id === ubo.viaPersonId)?.fullName : null;
    const corporate = person.partyType === 'CORPORATE';
    peopleSheet.addRow({
      ...head(person.clientId),
      type: corporate ? 'Company' : 'Individual',
      title: person.title ?? '',
      fullName: person.fullName,
      designation: roleSummary(person),
      keyContact: label(person, 'KEY_CONTACT') ? 'Yes' : 'No',
      signatory: label(person, 'AUTHORISED_SIGNATORY') ? 'Yes' : 'No',
      shareholderPercent: shares?.percentage === null || shares?.percentage === undefined ? '' : Number(shares.percentage),
      uboPercent: ubo?.percentage === null || ubo?.percentage === undefined ? '' : Number(ubo.percentage),
      heldThrough: through ?? (ubo ? 'Direct' : ''),
      representedEntity: person.representedEntity ?? '',
      nationality: person.nationality ?? '',
      dualCitizenship: corporate ? '' : yesNo(person.dualCitizenship),
      otherNationality: person.otherNationality ?? '',
      dateOfBirth: date(person.dateOfBirth),
      qidNumber: person.qidNumber ?? '',
      qidExpiry: date(person.qidExpiry),
      passportNumber: main?.passportNumber ?? '',
      passportExpiry: date(main?.expiryDate),
      otherPassports: others,
      nationalAddressExpiry: date(person.nationalAddressExpiry),
      address: person.address ?? '',
      telephone: person.telephone ?? '',
      email: person.email ?? '',
      pep: corporate ? '' : yesNo(person.isPep),
      pepDetails: person.pepDetails ?? '',
      registrationNumber: person.registrationNumber ?? ''
    });
  }

  // Legal documents: the register plus each person's QID and passports (no passports for allocated staff).
  const documents = workbook.addWorksheet('Legal Documents');
  styled(documents, DOCUMENT_COLUMNS);
  const statusOf = (expiry: string | null) => {
    if (!expiry) return { days: '' as number | '', status: '' };
    const days = Math.floor((date(expiry)!.getTime() - now.getTime()) / DAY_MS);
    return { days, status: days < 0 ? 'Expired' : days <= 30 ? 'Within 30 days' : days <= 60 ? 'Within 60 days' : 'Valid' };
  };
  const rows: ExportDocument[] = [
    ...data.documents,
    ...people.filter((person) => person.partyType === 'INDIVIDUAL').flatMap((person) => {
      const roles = roleSummary(person);
      const identity: ExportDocument[] = [];
      if (person.qidNumber || person.qidExpiry) {
        identity.push({ clientId: person.clientId, typeLabel: 'QID', nature: 'INDIVIDUAL', documentNumber: person.qidNumber, holderName: person.fullName, location: person.nationality, issueDate: null, expiryDate: person.qidExpiry, personRoles: roles, source: 'PERSON' });
      }
      for (const passport of person.passports) {
        identity.push({ clientId: person.clientId, typeLabel: 'Passport', nature: 'INDIVIDUAL', documentNumber: passport.passportNumber, holderName: person.fullName, location: passport.issuingCountry || person.nationality, issueDate: null, expiryDate: passport.expiryDate, personRoles: roles, source: 'PERSON' });
      }
      return identity;
    })
  ].sort((a, b) => order(a.clientId) - order(b.clientId) || (a.nature === b.nature ? 0 : a.nature === 'COMPANY' ? -1 : 1));
  for (const document of rows) {
    const { days, status } = statusOf(document.expiryDate);
    documents.addRow({
      ...head(document.clientId), type: document.typeLabel, nature: document.nature === 'COMPANY' ? 'Company' : 'Individual', number: document.documentNumber ?? '',
      name: document.holderName, role: document.personRoles ?? '', location: document.location ?? '', issueDate: date(document.issueDate), expiryDate: date(document.expiryDate),
      daysLeft: days, status
    });
  }
  return { companyRows: company.rowCount - 1, peopleRows: peopleSheet.rowCount - 1, documentRows: documents.rowCount - 1 };
}

