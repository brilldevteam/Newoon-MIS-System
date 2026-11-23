import { api } from './api';

export type ComplianceClientStatus = 'ACTIVE' | 'INACTIVE' | 'ON_HOLD';
export type CddType = 'SIMPLIFIED' | 'REGULAR' | 'ENHANCED';
export type ClientRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ClientJurisdiction = 'QFC' | 'MOCI' | 'QFZ' | 'OTHER';
export type ReviewState = 'OVERDUE' | 'DUE_SOON' | 'SCHEDULED' | 'NOT_SCHEDULED';

export type ComplianceClient = {
  id: string;
  clientCode: string | null;
  name: string;
  registrationNumber: string | null;
  jurisdiction: ClientJurisdiction | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  primaryContactName: string | null;
  status: ComplianceClientStatus;
  statusReason: string | null;
  cddType: CddType | null;
  riskLevel: ClientRiskLevel | null;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  activatedAt: string | null;
  reviewState: ReviewState;
  engagementCount: number;
  kycCaseCount: number;
  latestEngagement: { engagementNumber: string; serviceName: string; status: string; startDate: string | null } | null;
  latestKycCase: { id: string; kycNumber: string; status: string } | null;
  pendingRiskChange: { id: string; proposedRisk: ClientRiskLevel } | null;
  reviewInProgress: boolean;
  latestScreening: { result: 'PENDING' | 'CLEAR' | 'REVIEW' | 'ALERT'; screenedAt: string } | null;
  nearestExpiry: { expiryDate: string; state: 'EXPIRED' | 'DUE_30' | 'DUE_60' | 'DUE_90' | 'VALID' } | null;
};

export type ComplianceClientStats = {
  total: number;
  active: number;
  inactive: number;
  onHold: number;
  edd: number;
  highRisk: number;
  riskPending: number;
  reviewOverdue: number;
  reviewDueSoon: number;
  riskApprovals: number;
  reviewsInProgress: number;
  expiringDocuments: number;
  screeningAlerts: number;
};

export type ComplianceClientFilters = {
  search?: string;
  status?: string;
  riskLevel?: string;
  cddType?: string;
  jurisdiction?: string;
  review?: string;
  attention?: string;
  page?: number;
  pageSize?: number;
};

export type ComplianceClientPage = {
  // What the signed-in user sees (backend client-access.ts).
  access: ClientAccess;
  items: ComplianceClient[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  stats: ComplianceClientStats;
};

export type ComplianceClientUpdate = {
  name?: string;
  clientCode?: string;
  registrationNumber?: string;
  country?: string;
  industry?: string;
  cddType?: CddType | 'NONE';
  jurisdiction?: ClientJurisdiction | 'NONE';
  email?: string;
  phone?: string;
  address?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  statusReason?: string;
};

function cleanParams(filters: ComplianceClientFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '' && value !== 'ALL'));
}

export function listComplianceClients(filters: ComplianceClientFilters) {
  return api.get<ComplianceClientPage>('/compliance/clients', { params: cleanParams(filters) }).then((response) => response.data);
}

// Client records (2026-11-22): one record for the company and one per person. A person holds any number of roles
// and appears on every tab that lists one of them, so an edit shows everywhere.
export type PersonRoleType =
  | 'SHAREHOLDER' | 'UBO' | 'DIRECTOR' | 'MANAGER' | 'SECRETARY' | 'SEF' | 'AUTHORISED_SIGNATORY' | 'KEY_CONTACT'
  | 'CEO' | 'CFO' | 'COO' | 'MANAGING_DIRECTOR' | 'GENERAL_MANAGER' | 'CHAIRMAN' | 'OTHER';

export const personRoleLabels: Record<PersonRoleType, string> = {
  SHAREHOLDER: 'Shareholder',
  UBO: 'UBO',
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  SECRETARY: 'Secretary',
  SEF: 'SEF',
  AUTHORISED_SIGNATORY: 'Authorised Signatory',
  KEY_CONTACT: 'Key Communication Person',
  CEO: 'CEO',
  CFO: 'CFO',
  COO: 'COO',
  MANAGING_DIRECTOR: 'Managing Director',
  GENERAL_MANAGER: 'General Manager',
  CHAIRMAN: 'Chairman',
  OTHER: 'Other'
};

// Same rules as the backend (client-records.ts).
export const corporateRoles: PersonRoleType[] = ['SHAREHOLDER', 'DIRECTOR', 'SECRETARY', 'OTHER'];
export const percentRoles: PersonRoleType[] = ['SHAREHOLDER', 'UBO'];
export const personTitles = ['Mr', 'Ms', 'Mrs', 'Dr', 'Sheikh', 'Sheikha'];

export type ClientPersonRole = {
  id: string;
  role: PersonRoleType;
  title: string;
  percentage: string | null;
  viaPersonId: string | null;
  sourceSection: string | null;
  sourceRowId: string | null;
};

export type ClientPassport = { id: string; passportNumber: string; issuingCountry: string | null; expiryDate: string | null; isPrimary: boolean };

export type ClientPerson = {
  id: string;
  partyType: 'INDIVIDUAL' | 'CORPORATE';
  title: string | null;
  fullName: string;
  nationality: string | null;
  dualCitizenship: boolean | null;
  otherNationality: string | null;
  dateOfBirth: string | null;
  address: string | null;
  telephone: string | null;
  email: string | null;
  isPep: boolean | null;
  pepDetails: string | null;
  representedEntity: string | null;
  qidNumber: string | null;
  qidExpiry: string | null;
  nationalAddressExpiry: string | null;
  registrationNumber: string | null;
  linkedClientName: string | null;
  // Combined "QID / Passport" value from an older KYC that has not been split yet.
  legacyIdentity: string | null;
  passports: ClientPassport[];
  roles: ClientPersonRole[];
  // Fields changed on the client page (passport changes are "passport:<id>").
  edited: string[];
};

export type EntityField =
  | 'legalName' | 'legalForm' | 'commercialRegistrationNo' | 'crExpiryDate' | 'dateOfIncorporation' | 'countryOfIncorporation' | 'placeOfIncorporation'
  | 'registeredOfficeAddress' | 'shareCapital' | 'taxIdentificationNo' | 'poBox' | 'telephone' | 'email' | 'website' | 'businessNature'
  | 'relatedIndustry' | 'licenseActivities' | 'prospectiveServices' | 'financialYearEnd' | 'auditorName';

export type ClientEntity = Partial<Record<EntityField, string | null>> & { edited: string[] };

// What the signed-in user sees on a client (backend client-access.ts): the tabs and whether they manage allocations.
export type ClientAccess = {
  level: 'FULL' | 'OPERATIONS' | 'ALLOCATED';
  tabs: string[];
  canManageAllocation: boolean;
  seesPassports: boolean;
  seesAmlData: boolean;
};

export type StaffUser = { id: string; firstName: string; lastName: string; email: string; roles: string[] };
export type ClientAllocation = { id: string; createdAt: string; user: StaffUser };

export type ComplianceClientDetail = {
  access: ClientAccess;
  // Staff allocated to the client (shown to full access only).
  allocations: ClientAllocation[];
  client: ComplianceClient & { industry: string | null };
  contacts: Array<{ id: string; name: string; email: string | null; phone: string | null; position: string | null; isPrimary: boolean }>;
  engagements: Array<{ id: string; engagementNumber: string; serviceName: string; description: string | null; status: string; startDate: string | null; endDate: string | null; kycCaseId: string | null; createdAt: string }>;
  kycCases: Array<{
    id: string; kycNumber: string; title: string; status: string; createdAt: string; updatedAt: string; serviceName: string | null; hasForm: boolean;
    purpose: 'ONBOARDING' | 'REKYC'; previousKycCaseId: string | null;
  }>;
  profileCase: { id: string; kycNumber: string; status: string } | null;
  profile: {
    // KYC the KYC-held values were last taken from.
    source: { id: string; kycNumber: string } | null;
    company: ClientEntity;
    people: ClientPerson[];
  };
  identityDocuments: IdentityDocument[];
  legalDocuments: Array<{ id: string; kycCaseId: string; documentType: string; fileName: string; mimeType: string | null; createdAt: string }>;
  riskHistory: Array<{
    id: string; kycCaseId: string; previousRisk: ClientRiskLevel | null; newRisk: ClientRiskLevel; reasonCategory: string; explanation: string; effectiveDate: string;
    changedBy: { id: string; firstName: string; lastName: string; email: string } | null;
  }>;
  crrf: { riskRating: ClientRiskLevel | null; updatedAt: string; documents: Array<{ id: string; fileName: string; createdAt: string }> } | null;
  crrfRestricted: boolean;
  internalReview: { riskClassification: ClientRiskLevel | null; dueDiligenceType: CddType | null } | null;
};

export function getComplianceClient(id: string) {
  return api.get<ComplianceClientDetail>(`/compliance/clients/${id}`).then((response) => response.data);
}

export function updateComplianceClient(id: string, payload: ComplianceClientUpdate) {
  return api.patch<ComplianceClient>(`/compliance/clients/${id}`, payload).then((response) => response.data);
}

const detailUrl = (id: string) => `/compliance/clients/${id}`;

export function updateEntityField(id: string, field: EntityField, value: string | null) {
  return api.patch<ComplianceClientDetail>(`${detailUrl(id)}/entity`, { field, value }).then((response) => response.data);
}

export function addClientPerson(id: string, payload: { partyType: 'INDIVIDUAL' | 'CORPORATE'; fullName: string; role: PersonRoleType; title?: string; percentage?: string }) {
  return api.post<ComplianceClientDetail>(`${detailUrl(id)}/people`, payload).then((response) => response.data);
}

export function updatePersonField(id: string, personId: string, field: string, value: string | null) {
  return api.patch<ComplianceClientDetail>(`${detailUrl(id)}/people/${personId}`, { field, value }).then((response) => response.data);
}

export function addPersonRole(id: string, personId: string, payload: { role: PersonRoleType; title?: string; percentage?: string; viaPersonId?: string }) {
  return api.post<ComplianceClientDetail>(`${detailUrl(id)}/people/${personId}/roles`, payload).then((response) => response.data);
}

export function updatePersonRole(id: string, personId: string, roleId: string, payload: { percentage?: string | null; viaPersonId?: string | null }) {
  return api.patch<ComplianceClientDetail>(`${detailUrl(id)}/people/${personId}/roles/${roleId}`, payload).then((response) => response.data);
}

export function removePersonRole(id: string, personId: string, roleId: string, reason?: string) {
  return api.post<ComplianceClientDetail>(`${detailUrl(id)}/people/${personId}/roles/${roleId}/remove`, { reason: reason?.trim() || undefined }).then((response) => response.data);
}

export function addPersonPassport(id: string, personId: string, payload: { passportNumber: string; issuingCountry?: string; expiryDate?: string }) {
  const body = { passportNumber: payload.passportNumber, issuingCountry: payload.issuingCountry?.trim() || undefined, expiryDate: payload.expiryDate || undefined };
  return api.post<ComplianceClientDetail>(`${detailUrl(id)}/people/${personId}/passports`, body).then((response) => response.data);
}

export type PassportField = 'passportNumber' | 'issuingCountry' | 'expiryDate' | 'isPrimary';

export function updatePersonPassport(id: string, personId: string, passportId: string, field: PassportField, value: string | null) {
  return api.patch<ComplianceClientDetail>(`${detailUrl(id)}/people/${personId}/passports/${passportId}`, { field, value }).then((response) => response.data);
}

export function removePersonPassport(id: string, personId: string, passportId: string, reason?: string) {
  return api.post<ComplianceClientDetail>(`${detailUrl(id)}/people/${personId}/passports/${passportId}/remove`, { reason: reason?.trim() || undefined }).then((response) => response.data);
}

// A QID or passport copy uploaded from a person's details, linked by personId (older copies by personKey, the
// person's normalized full name, until they are linked).
export type IdentityDocument = {
  id: string;
  personId: string | null;
  personKey: string;
  personName: string | null;
  identityType: 'QID' | 'PASSPORT';
  documentNumber: string | null;
  documentExpiry: string | null;
  fileName: string;
  mimeType: string | null;
  createdAt: string;
  uploadedBy: { id: string; firstName: string; lastName: string; email: string } | null;
};

// Same normalization as the backend (personKey in compliance-client-profile.ts).
export function personKey(fullName: string | null | undefined) {
  return (fullName || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function uploadIdentityDocument(
  clientId: string,
  payload: { personId: string; identityType: 'QID' | 'PASSPORT'; passportId?: string; documentNumber?: string; expiryDate?: string; file: File }
) {
  const data = new FormData();
  data.append('personId', payload.personId);
  data.append('identityType', payload.identityType);
  if (payload.passportId) data.append('passportId', payload.passportId);
  if (payload.documentNumber?.trim()) data.append('documentNumber', payload.documentNumber.trim());
  if (payload.expiryDate) data.append('expiryDate', payload.expiryDate);
  data.append('files', payload.file);
  return api.post<ComplianceClientDetail>(`/compliance/clients/${clientId}/identity-documents`, data, { timeout: 120000 }).then((response) => response.data);
}

// What the server read from a QID / passport file's machine-readable lines; used only to pre-fill the upload form.
export type IdentityDocumentReading =
  | { found: false; message: string }
  | {
      found: true;
      format: 'TD3' | 'TD1';
      documentType: string;
      issuingCountry: string;
      documentNumber: string | null;
      documentNumberCheck: 'OK' | 'CORRECTED' | 'FAILED';
      expiryDate: string | null;
      expiryValid: boolean;
      nameOnDocument: string;
      nationality: string;
      typeMatches: boolean;
    };

export function readIdentityDocument(clientId: string, identityType: 'QID' | 'PASSPORT', file: File) {
  const data = new FormData();
  data.append('identityType', identityType);
  data.append('files', file);
  return api.post<IdentityDocumentReading>(`/compliance/clients/${clientId}/identity-documents/read`, data, { timeout: 120000 }).then((response) => response.data);
}

export function linkKycIdentityDocument(
  clientId: string,
  payload: { legalDocumentId: string; personId: string; identityType: 'QID' | 'PASSPORT'; passportId?: string }
) {
  return api
    .post<ComplianceClientDetail & { readFromDocument: { documentNumber: string; expiryDate: string } | null }>(`/compliance/clients/${clientId}/identity-documents/from-kyc`, { ...payload, passportId: payload.passportId || undefined }, { timeout: 120000 })
    .then((response) => response.data);
}

export function getAllocationCandidates(id: string) {
  return api.get<StaffUser[]>(`/compliance/clients/${id}/allocations/candidates`).then((response) => response.data);
}

export function allocateStaff(id: string, userId: string) {
  return api.post<ComplianceClientDetail>(`/compliance/clients/${id}/allocations`, { userId }).then((response) => response.data);
}

export function removeStaffAllocation(id: string, allocationId: string) {
  return api.post<ComplianceClientDetail>(`/compliance/clients/${id}/allocations/${allocationId}/remove`, {}).then((response) => response.data);
}

export function startComplianceRekyc(id: string) {
  return api.post<{ id: string; kycNumber: string }>(`/compliance/clients/${id}/rekyc`).then((response) => response.data);
}

export async function exportComplianceClients(filters: ComplianceClientFilters) {
  const { page: _page, pageSize: _pageSize, ...rest } = filters;
  const response = await api.get('/compliance/clients/export/excel', { params: cleanParams(rest), responseType: 'blob', timeout: 120000 });
  const disposition = String(response.headers['content-disposition'] || '');
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || 'compliance-clients.xlsx';
  const url = window.URL.createObjectURL(response.data);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return { truncated: response.headers['x-export-truncated'] === 'true' };
}

export const cddLabels: Record<CddType, string> = { SIMPLIFIED: 'SDD', REGULAR: 'RDD', ENHANCED: 'EDD' };
export const riskLabels: Record<ClientRiskLevel, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
export const jurisdictionLabels: Record<ClientJurisdiction, string> = { QFC: 'QFC', MOCI: 'MOCI', QFZ: 'QFZ', OTHER: 'Other' };
export const complianceStatusLabels: Record<ComplianceClientStatus, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', ON_HOLD: 'On hold' };

export type ClientDocumentCategory = 'CDD' | 'MONITORING' | 'COMPLIANCE';

export type ClientDocument = {
  id: string;
  sectionId: string;
  title: string;
  notes: string | null;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
  uploadedBy: { id: string; firstName: string; lastName: string; email: string } | null;
};

export type ClientDocumentSection = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  category: ClientDocumentCategory;
  isSystem: boolean;
  isActive: boolean;
  documents: ClientDocument[];
};

export type ClientDocumentFolders = { sections: ClientDocumentSection[] };

export function getClientDocuments(clientId: string) {
  return api.get<ClientDocumentFolders>(`/compliance/clients/${clientId}/documents`).then((response) => response.data);
}

export function uploadClientDocuments(clientId: string, payload: { sectionId: string; title?: string; notes?: string; files: File[] }) {
  const data = new FormData();
  data.append('sectionId', payload.sectionId);
  if (payload.title?.trim()) data.append('title', payload.title.trim());
  if (payload.notes?.trim()) data.append('notes', payload.notes.trim());
  payload.files.forEach((file) => data.append('files', file));
  return api.post<ClientDocumentFolders>(`/compliance/clients/${clientId}/documents`, data, { timeout: 120000 }).then((response) => response.data);
}

export function deleteClientDocument(clientId: string, documentId: string, reason?: string) {
  return api.post<ClientDocumentFolders>(`/compliance/clients/${clientId}/documents/${documentId}/delete`, { reason: reason?.trim() || undefined }).then((response) => response.data);
}

export async function viewClientDocument(clientId: string, document: Pick<ClientDocument, 'id' | 'mimeType' | 'fileName'>) {
  const response = await api.get(`/compliance/clients/${clientId}/documents/${document.id}/view`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: document.mimeType || response.data.type || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const type = blob.type.toLowerCase();
  if (type.startsWith('image/') || type === 'application/pdf') {
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    return;
  }
  const link = window.document.createElement('a');
  link.href = url;
  link.download = document.fileName;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function createDocumentSection(clientId: string, payload: { title: string; description?: string }) {
  return api.post(`/compliance/clients/${clientId}/document-sections`, payload).then((response) => response.data);
}

export function updateDocumentSection(clientId: string, sectionId: string, payload: { title?: string; description?: string; isActive?: boolean }) {
  return api.patch(`/compliance/clients/${clientId}/document-sections/${sectionId}`, payload).then((response) => response.data);
}
