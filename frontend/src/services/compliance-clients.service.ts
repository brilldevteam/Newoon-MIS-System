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
  items: ComplianceClient[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  stats: ComplianceClientStats;
};

export type ComplianceClientUpdate = {
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

export type OfficerRole = 'DIRECTOR' | 'MANAGER' | 'SECRETARY' | 'SEF' | 'SIGNATORY' | 'OTHER';

export type ProfileParty = {
  id: string | null;
  fullName: string;
  partyType: string | null;
  nationality: string | null;
  identityNumber: string | null;
  dateOfBirth: string | null;
  address: string | null;
  percentage: string | null;
  isUbo: boolean;
  linkedCompany: string | null;
};

export type ProfileOfficer = {
  id: string | null;
  fullName: string;
  positions: string[];
  roles: OfficerRole[];
  entityName: string | null;
  nationality: string | null;
  identityNumber: string | null;
  dateOfBirth: string | null;
  address: string | null;
  isAuthorizedSignatory: boolean;
};

export type ComplianceClientDetail = {
  client: ComplianceClient & { industry: string | null };
  contacts: Array<{ id: string; name: string; email: string | null; phone: string | null; position: string | null; isPrimary: boolean }>;
  engagements: Array<{ id: string; engagementNumber: string; serviceName: string; description: string | null; status: string; startDate: string | null; endDate: string | null; kycCaseId: string | null; createdAt: string }>;
  kycCases: Array<{ id: string; kycNumber: string; title: string; status: string; createdAt: string; updatedAt: string; serviceName: string | null; hasForm: boolean }>;
  profileCase: { id: string; kycNumber: string; status: string } | null;
  profile: {
    formVersion: number;
    formStatus: string;
    formUpdatedAt: string;
    company: Record<
      | 'legalName' | 'legalForm' | 'commercialRegistrationNo' | 'countryOfIncorporation' | 'dateOfIncorporation' | 'registeredOfficeAddress'
      | 'telephone' | 'email' | 'website' | 'businessNature' | 'relatedIndustry' | 'licenseActivities' | 'taxIdentificationNo' | 'prospectiveServices',
      string | null
    >;
    shareholders: ProfileParty[];
    ubos: ProfileParty[];
    officers: ProfileOfficer[];
    keyContact: { fullName: string | null; position: string | null; nationality: string | null; identityNumber: string | null; mobileNumber: string | null; email: string | null } | null;
  } | null;
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

export async function viewClientDocument(clientId: string, document: ClientDocument) {
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
