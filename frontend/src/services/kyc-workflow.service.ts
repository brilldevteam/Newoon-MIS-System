import { api } from './api';

export type KycCaseStatus =
  | 'INQUIRY_RECEIVED'
  | 'PROPOSAL_OPTIONAL'
  | 'LEGAL_DOCUMENTS_PENDING'
  | 'LEGAL_DOCUMENTS_UPLOADED'
  | 'SUBMITTED_TO_AML'
  | 'AML_REVIEW_STARTED'
  | 'SUPERVISOR_REVIEW_PENDING'
  | 'SUPERVISOR_REVIEW_IN_PROGRESS'
  | 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'
  | 'SUPERVISOR_REVIEW_COMPLETED'
  | 'DMLRO_REVIEW_PENDING'
  | 'DMLRO_REVIEW_IN_PROGRESS'
  | 'DMLRO_ADDITIONAL_INFORMATION_REQUIRED'
  | 'DMLRO_REVIEW_COMPLETED'
  | 'MLRO_REVIEW_PENDING'
  | 'MLRO_REVIEW_IN_PROGRESS'
  | 'MLRO_ADDITIONAL_INFORMATION_REQUIRED'
  | 'MLRO_APPROVED'
  | 'MLRO_APPROVED_WITH_CONDITIONS'
  | 'MLRO_REJECTED'
  | 'FINAL_SIGNATURES_PENDING'
  | 'FINAL_DOCUMENTS_PENDING'
  | 'KYC_FINAL_APPROVED'
  | 'CLIENT_ACTIVATION_PENDING'
  | 'CLIENT_ACTIVE'
  | 'CLIENT_REJECTED'
  | 'CLIENT_ON_HOLD';

export type ReviewStage = 'SUPERVISOR' | 'DMLRO' | 'MLRO';

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
  type?: string;
  isRead?: boolean;
  createdAt: string;
  kycCase?: KycCase | null;
};

export type ReviewTask = {
  id: string;
  stage: ReviewStage;
  status: string;
  createdAt: string;
  dueAt?: string | null;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  kycCase: KycCase;
};

export type ReviewTaskDashboard = {
  tasks: ReviewTask[];
  notifications: AmlNotification[];
  stages: ReviewStage[];
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

export type InternalReviewWorkspace = {
  kycCase: KycCase;
  tasks: Array<Record<string, any>>;
  reviews: Array<Record<string, any>>;
  comments: Array<Record<string, any>>;
  signedDocuments: Array<Record<string, any>>;
  riskReclassifications: Array<Record<string, any>>;
  activationChecklist: {
    checklist: Array<{ key: string; label: string; completed: boolean }>;
    blockingIssues?: Array<{ key: string; label: string; completed: boolean }>;
    isReady: boolean;
  };
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
  const mimeType = blob.type.toLowerCase();
  const canPreview = mimeType.startsWith('image/') || mimeType === 'application/pdf' || mimeType.startsWith('text/');

  if (canPreview) {
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

export function getMyReviewTasks() {
  return api.get<ReviewTaskDashboard>('/kyc/review/tasks').then((response) => response.data);
}

export function getInternalReviewWorkspace(caseId: string) {
  return api.get<InternalReviewWorkspace>(`/kyc/${caseId}/internal-reviews`).then((response) => response.data);
}

export function startInternalReview(caseId: string, stage: ReviewStage) {
  return api.post(`/kyc/${caseId}/internal-reviews/${stage}/start`).then((response) => response.data);
}

export function saveInternalReviewDraft(caseId: string, stage: ReviewStage, payload: Record<string, any>) {
  return api.patch(`/kyc/${caseId}/internal-reviews/${stage}/draft`, payload).then((response) => response.data);
}

export function submitSupervisorReview(caseId: string, payload: Record<string, any>) {
  return api.post<KycCase>(`/kyc/${caseId}/internal-reviews/supervisor/submit`, payload).then((response) => response.data);
}

export function submitDmlroReview(caseId: string, payload: Record<string, any>) {
  return api.post<KycCase>(`/kyc/${caseId}/internal-reviews/dmlro/submit`, payload).then((response) => response.data);
}

export function decideMlroReview(caseId: string, payload: Record<string, any>) {
  return api.post<KycCase>(`/kyc/${caseId}/internal-reviews/mlro/decision`, payload).then((response) => response.data);
}

export function addReviewerComment(caseId: string, stage: ReviewStage, payload: Record<string, any>) {
  return api.post(`/kyc/${caseId}/internal-reviews/${stage}/comments`, payload).then((response) => response.data);
}

export function uploadSignedKycDocument(caseId: string, payload: Record<string, any>) {
  return api.post(`/kyc/${caseId}/internal-reviews/signed-documents`, payload).then((response) => response.data);
}

export function uploadSignedKycDocumentFile(caseId: string, payload: { reviewStage: string; file: File }) {
  const data = new FormData();
  data.append('reviewStage', payload.reviewStage);
  data.append('file', payload.file);
  return api.post(`/kyc/${caseId}/internal-reviews/signed-documents/upload`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((response) => response.data);
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
