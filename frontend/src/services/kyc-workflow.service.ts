import { api } from './api';

export type KycCaseStatus =
  | 'INQUIRY_RECEIVED'
  | 'PROPOSAL_OPTIONAL'
  | 'LEGAL_DOCUMENTS_PENDING'
  | 'LEGAL_DOCUMENTS_UPLOADED'
  | 'SUBMITTED_TO_AML'
  | 'AML_REVIEW_STARTED';

export type ProposalStatus = 'NOT_REQUIRED' | 'REQUIRED' | 'SENT' | 'ACCEPTED' | 'REJECTED';

export type ClientContact = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  isPrimary: boolean;
};

export type Client = {
  id: string;
  name: string;
  registrationNumber?: string | null;
  industry?: string | null;
  country?: string | null;
  status: string;
  contacts: ClientContact[];
  kycCases: KycCase[];
  createdAt: string;
};

export type ClientService = {
  id: string;
  name: string;
  description?: string | null;
};

export type LegalDocument = {
  id: string;
  documentType: string;
  fileName: string;
  storagePath?: string | null;
  mimeType?: string | null;
  size?: number | null;
  status: string;
  createdAt: string;
};

export type WorkflowComment = {
  id: string;
  body: string;
  createdAt: string;
  author?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export type StatusHistory = {
  id: string;
  fromStatus?: KycCaseStatus | null;
  toStatus: KycCaseStatus;
  note?: string | null;
  createdAt: string;
};

export type KycCase = {
  id: string;
  title: string;
  status: KycCaseStatus;
  proposalStatus: ProposalStatus;
  client: Client;
  service?: ClientService | null;
  legalDocuments: LegalDocument[];
  comments: WorkflowComment[];
  statusHistory: StatusHistory[];
  createdAt: string;
};

export type AmlNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  kycCase?: KycCase | null;
};

export type KycGeneratedDocument = {
  id: string;
  documentType: 'DOCX' | 'PDF';
  version: number;
  fileName: string;
  mimeType: string;
  createdAt: string;
};

export type KycFormData = {
  id: string;
  tenantId: string;
  kycCaseId: string;
  status: string;
  isLocked: boolean;
  version: number;
  sectionA: Record<string, any>;
  sectionB: Record<string, any> & { shareholders: Array<Record<string, any>>; ubos: Array<Record<string, any>> };
  sectionC: Record<string, any> & { managers: Array<Record<string, any>> };
  sectionD: Record<string, any>;
  sectionE: Record<string, any>;
  sectionF: Record<string, any> & { documents: Array<Record<string, any>> };
  sectionG: Record<string, any>;
  sectionH: Record<string, any> | null;
  generatedDocuments: KycGeneratedDocument[];
  updatedAt: string;
};

export function listClients() {
  return api.get<Client[]>('/clients').then((response) => response.data);
}

export function createClient(payload: {
  name: string;
  registrationNumber?: string;
  industry?: string;
  country?: string;
  contacts?: Array<{ name: string; email?: string; phone?: string; position?: string }>;
}) {
  return api.post<Client>('/clients', payload).then((response) => response.data);
}

export function getClient(id: string) {
  return api.get<Client>(`/clients/${id}`).then((response) => response.data);
}

export function updateClient(
  id: string,
  payload: {
    name: string;
    registrationNumber?: string;
    industry?: string;
    country?: string;
    contacts?: Array<{ name: string; email?: string; phone?: string; position?: string }>;
  }
) {
  return api.patch<Client>(`/clients/${id}`, payload).then((response) => response.data);
}

export function deleteClient(id: string) {
  return api.delete<{ id: string }>(`/clients/${id}`).then((response) => response.data);
}

export function listKycCases() {
  return api.get<KycCase[]>('/kyc').then((response) => response.data);
}

export function createKycCase(payload: { clientId: string; title?: string; serviceName?: string }) {
  return api.post<KycCase>('/kyc', payload).then((response) => response.data);
}

export function getKycCase(id: string) {
  return api.get<KycCase>(`/kyc/${id}`).then((response) => response.data);
}

export function updateKycCase(id: string, payload: { clientId?: string; title?: string; serviceName?: string }) {
  return api.patch<KycCase>(`/kyc/${id}`, payload).then((response) => response.data);
}

export function deleteKycCase(id: string) {
  return api.delete<{ id: string }>(`/kyc/${id}`).then((response) => response.data);
}

export function assignService(id: string, payload: { serviceName: string; description?: string }) {
  return api.patch<KycCase>(`/kyc/${id}/service`, payload).then((response) => response.data);
}

export function updateProposalStatus(id: string, proposalStatus: ProposalStatus, note?: string) {
  return api.patch<KycCase>(`/kyc/${id}/proposal-status`, { proposalStatus, note }).then((response) => response.data);
}

export function uploadLegalDocument(
  id: string,
  payload: { documentType: string; fileName: string; storagePath?: string; mimeType?: string; size?: number }
) {
  return api.post<KycCase>(`/kyc/${id}/legal-documents`, payload).then((response) => response.data);
}

export function uploadLegalDocumentFile(id: string, payload: { documentType: string; file: File }) {
  const data = new FormData();
  data.append('documentType', payload.documentType);
  data.append('file', payload.file);

  return api.post<KycCase>(`/kyc/${id}/legal-documents/upload`, data).then((response) => response.data);
}

export async function viewLegalDocument(caseId: string, document: LegalDocument) {
  const response = await api.get(`/kyc/${caseId}/legal-documents/${document.id}/view`, {
    responseType: 'blob'
  });
  const blob = new Blob([response.data], { type: document.mimeType || response.data.type || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

export function deleteLegalDocument(caseId: string, documentId: string) {
  return api.delete<KycCase>(`/kyc/${caseId}/legal-documents/${documentId}`).then((response) => response.data);
}

export function submitToAml(id: string) {
  return api.post<KycCase>(`/kyc/${id}/submit-to-aml`).then((response) => response.data);
}

export function addWorkflowComment(id: string, body: string) {
  return api.post<KycCase>(`/kyc/${id}/comments`, { body }).then((response) => response.data);
}

export function getAmlNotifications() {
  return api.get<AmlNotification[]>('/kyc/aml/notifications').then((response) => response.data);
}

export function getKycForm(caseId: string) {
  return api.get<KycFormData>(`/kyc/${caseId}/form`).then((response) => response.data);
}

export function createKycForm(caseId: string) {
  return api.post<KycFormData>(`/kyc/${caseId}/form`).then((response) => response.data);
}

export function autoSaveKycForm(caseId: string, payload: Partial<KycFormData>) {
  return api.patch<KycFormData>(`/kyc/${caseId}/form/autosave`, payload).then((response) => response.data);
}

export function saveKycFormSection(caseId: string, section: string, payload: Record<string, any>) {
  return api.patch<KycFormData>(`/kyc/${caseId}/form/${section}`, payload).then((response) => response.data);
}

export function generateKycDocument(caseId: string, type: 'docx' | 'pdf') {
  return api.post<KycGeneratedDocument>(`/kyc/${caseId}/form/generate-${type}`).then((response) => response.data);
}

export async function downloadGeneratedKycDocument(caseId: string, documentId: string, fileName: string) {
  const response = await api.get(`/kyc/${caseId}/form/generated-documents/${documentId}/download`, {
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
