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
  | 'SEF_DECISION_PENDING'
  | 'SEF_DECISION_IN_PROGRESS'
  | 'SEF_APPROVED'
  | 'SEF_REJECTED'
  | 'FINAL_SIGNATURES_PENDING'
  | 'FINAL_DOCUMENTS_PENDING'
  | 'KYC_FINAL_APPROVED'
  | 'CLIENT_ACTIVATION_PENDING'
  | 'CLIENT_ACTIVE'
  | 'CLIENT_REJECTED'
  | 'CLIENT_ON_HOLD';

export type ReviewStage = 'SUPERVISOR' | 'DMLRO' | 'MLRO' | 'SEF';

export type ProposalStatus = 'NOT_REQUIRED' | 'REQUIRED' | 'SENT' | 'ACCEPTED' | 'REJECTED';

export type EnquiryType = 'EXISTING_LEGAL_ENTITY' | 'PROPOSED_COMPANY' | 'CURRENT_CLIENT_NEW_SERVICES';

export type EnquiryStatus = 'DRAFT' | 'SUBMITTED_TO_AML_SUPERVISOR' | 'RETURNED_TO_BD' | 'READY_FOR_KYC' | 'CONVERTED_TO_KYC' | 'CLOSED';

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

export type ScreeningEntityType = 'CLIENT_COMPANY' | 'SHAREHOLDER' | 'UBO' | 'MANAGER' | 'MANUAL';

export type ScreeningCheckType = 'NCTC' | 'UN' | 'OFAC' | 'EU' | 'PPO_LIST' | 'WORLD_CHECK' | 'GOOGLE' | 'OTHER';

export type ScreeningResultStatus = 'NOT_CHECKED' | 'CLEAR' | 'POTENTIAL_MATCH' | 'CONFIRMED_MATCH' | 'NEGATIVE_NEWS_FOUND' | 'NO_NEGATIVE_NEWS' | 'PREVIOUSLY_NEGATIVE_NEWS' | 'PREVIOUSLY_VIOLATIONS';

export type ScreeningConclusionStatus = 'CLEAR' | 'NOT_CLEAR' | 'NO_SANCTION_FOUND' | 'SANCTION_FOUND';

export type ScreeningRecordStatus = 'DRAFT' | 'COMPLETED';

export type CrrfRiskRating = 'LOW' | 'MEDIUM' | 'HIGH';

export type ScreeningDocument = {
  id: string;
  documentType: string;
  checkType?: ScreeningCheckType;
  fileName: string;
  storagePath?: string | null;
  mimeType?: string | null;
  size?: number | null;
  createdAt: string;
};

export type ScreeningCheck = {
  id: string;
  checkType: ScreeningCheckType;
  isSelected: boolean;
  resultStatus: ScreeningResultStatus;
  notes?: string | null;
  documents: ScreeningDocument[];
};

export type ScreeningCaseCheck = {
  id: string;
  checkType: ScreeningCheckType;
  resultStatus: ScreeningResultStatus;
  notes?: string | null;
  documents: ScreeningDocument[];
};

export type ScreeningRecord = {
  id: string;
  entityType: ScreeningEntityType;
  entitySourceId?: string | null;
  entityName: string;
  identifier?: string | null;
  country?: string | null;
  status: ScreeningRecordStatus;
  conclusionStatus?: ScreeningConclusionStatus | null;
  remarks?: string | null;
  checks: ScreeningCheck[];
  documents: ScreeningDocument[];
  createdAt: string;
};

export type ScreeningListItem = ScreeningRecord & {
  kycCase: Pick<KycCase, 'id' | 'title' | 'status' | 'createdAt'> & {
    client: Pick<Client, 'id' | 'name' | 'registrationNumber' | 'country'>;
    service?: ClientService | null;
  };
  completedChecks: number;
  totalChecks: number;
  documentCount: number;
};

export type CrrfDocument = {
  id: string;
  fileName: string;
  storagePath?: string | null;
  mimeType?: string | null;
  size?: number | null;
  createdAt: string;
};

export type CrrfRecord = {
  id: string;
  kycCaseId: string;
  riskRating?: CrrfRiskRating | null;
  internalComment?: string | null;
  dmlroComment?: string | null;
  mlroComment?: string | null;
  documents: CrrfDocument[];
  createdAt: string;
  updatedAt: string;
};

export type CrrfWorkspace = {
  clientInfo: {
    caseId: string;
    caseTitle: string;
    kycNumber: string;
    clientId: string;
    clientName: string;
    clientCode?: string | null;
    crNumber?: string | null;
    country?: string | null;
    serviceName?: string | null;
  };
  record: CrrfRecord;
};

export type CrrfListItem = CrrfRecord & {
  clientInfo: CrrfWorkspace['clientInfo'];
  documentCount: number;
  kycCase: Pick<KycCase, 'id' | 'title' | 'status' | 'createdAt'> & {
    client: Pick<Client, 'id' | 'name' | 'registrationNumber' | 'country'>;
    service?: ClientService | null;
  };
};

export type ScreeningEntityOption = {
  sourceId: string;
  entityType: ScreeningEntityType;
  name: string;
  identifier?: string | null;
  country?: string | null;
  role: string;
  linkedClientId?: string | null;
};

export type ScreeningContext = {
  clientInfo: {
    caseId: string;
    caseTitle: string;
    kycNumber: string;
    clientId: string;
    clientName: string;
    clientCode?: string | null;
    crNumber?: string | null;
    serviceName?: string | null;
  };
  entities: ScreeningEntityOption[];
  mandatoryChecks: ScreeningCheckType[];
  resultRequiredChecks: ScreeningCheckType[];
  individualFilterChecks: ScreeningCheckType[];
  mergedEvidenceChecks: ScreeningCheckType[];
  mergedResultChecks: ScreeningCheckType[];
  individualEvidenceChecks: ScreeningCheckType[];
  mergedChecks: ScreeningCaseCheck[];
  mergedDocuments: ScreeningDocument[];
  records: ScreeningRecord[];
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
  sourceEnquiry?: { id: string; enquiryType: EnquiryType; details?: Record<string, unknown> | null } | null;
  kycForm?: { status: string } | null;
  title: string;
  kycNumber?: string;
  status: KycCaseStatus;
  proposalStatus: ProposalStatus;
  client: Client;
  service?: ClientService | null;
  legalDocuments: LegalDocument[];
  comments: WorkflowComment[];
  statusHistory: StatusHistory[];
  createdAt: string;
};

export type EnquiryAttachment = {
  id: string;
  documentType: string;
  fileName: string;
  storagePath?: string | null;
  mimeType?: string | null;
  size?: number | null;
  createdAt: string;
};

export type EnquiryComment = {
  id: string;
  body: string;
  createdAt: string;
  author?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export type EnquiryStatusHistory = {
  id: string;
  fromStatus?: EnquiryStatus | null;
  toStatus: EnquiryStatus;
  note?: string | null;
  createdAt: string;
  changedBy?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export type Enquiry = {
  id: string;
  enquiryCode: string;
  enquiryType: EnquiryType;
  status: EnquiryStatus;
  client?: Client | null;
  clientId?: string | null;
  companyName?: string | null;
  proposedCompanyName?: string | null;
  requestedServices: string[];
  keyContactName?: string | null;
  keyContactEmail?: string | null;
  keyContactPhone?: string | null;
  keyContactPosition?: string | null;
  headOfficeCountry?: string | null;
  branchCountry?: string | null;
  areaOfOperation?: string | null;
  details?: Record<string, any> | null;
  notes?: string | null;
  attachments: EnquiryAttachment[];
  comments: EnquiryComment[];
  statusHistory: EnquiryStatusHistory[];
  generatedKycCases?: Array<{ id: string; kycNumber: string; title: string; status: KycCaseStatus }>;
  createdAt: string;
  updatedAt: string;
};

export type PreliminaryKycData = {
  companyName?: string;
  proposedLegalForm?: string;
  jurisdiction?: string;
  businessActivity?: string;
  registeredOfficeAddress?: string;
  sourceOfFunds?: string;
  expectedBusiness?: string | string[];
  shareholders?: Array<{ fullName?: string; nationality?: string; identityNumber?: string; address?: string; ownershipPercentage?: string; isUbo?: boolean }>;
  management?: Array<{ fullName?: string; identityNumber?: string; nationality?: string; position?: string }>;
  documents?: Array<{ documentType?: string; description?: string; available?: boolean }>;
  completedAt?: string;
};

export type PreliminaryKycWorkspace = { enquiry: Enquiry; data: PreliminaryKycData; completedAt?: string | null };

export type EnquiryPayload = {
  enquiryType?: EnquiryType;
  clientId?: string;
  companyName?: string;
  proposedCompanyName?: string;
  requestedServices?: string[];
  keyContactName?: string;
  keyContactEmail?: string;
  keyContactPhone?: string;
  keyContactPosition?: string;
  headOfficeCountry?: string;
  branchCountry?: string;
  areaOfOperation?: string;
  details?: Record<string, any>;
  notes?: string;
  attachments?: Array<{ documentType: string; fileName: string; storagePath?: string; mimeType?: string; size?: number }>;
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

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  kycCase?: KycCase | null;
  enquiry?: { id: string } | null;
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

export type AiKycReview = {
  summary: string;
  missingItems: Array<{ section: string; field: string; reason: string }>;
  inconsistencies: Array<{ subject: string; details: string; severity: 'INFO' | 'REVIEW' }>;
  reviewerQuestions: string[];
  recommendedActions: string[];
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

export function matchClientByIdentifier(type: 'corporate' | 'individual', identifier: string, excludeClientId?: string) {
  return api
    .get<{ match: (Pick<Client, 'id' | 'name' | 'registrationNumber' | 'industry' | 'country' | 'status'> & { source: string }) | null }>('/clients/match', {
      params: { type, identifier, ...(excludeClientId ? { excludeClientId } : {}) }
    })
    .then((response) => response.data);
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

export function listEnquiries() {
  return api.get<Enquiry[]>('/enquiries').then((response) => response.data);
}

export function createEnquiry(payload: EnquiryPayload) {
  return api.post<Enquiry>('/enquiries', payload).then((response) => response.data);
}

export function getEnquiry(id: string) {
  return api.get<Enquiry>(`/enquiries/${id}`).then((response) => response.data);
}

export function updateEnquiry(id: string, payload: EnquiryPayload) {
  return api.patch<Enquiry>(`/enquiries/${id}`, payload).then((response) => response.data);
}

export function updateEnquiryStatus(id: string, payload: { status: EnquiryStatus; note?: string }) {
  return api.patch<Enquiry>(`/enquiries/${id}/status`, payload).then((response) => response.data);
}

export function convertEnquiryToKyc(id: string) {
  return api.post<KycCase>(`/enquiries/${id}/convert-to-kyc`).then((response) => response.data);
}

export function getPreliminaryKyc(id: string) {
  return api.get<PreliminaryKycWorkspace>(`/enquiries/${id}/preliminary-kyc`).then((response) => response.data);
}

export function savePreliminaryKyc(id: string, payload: PreliminaryKycData) {
  return api.patch<PreliminaryKycWorkspace>(`/enquiries/${id}/preliminary-kyc`, payload).then((response) => response.data);
}

export function completePreliminaryKyc(id: string, payload: PreliminaryKycData) {
  return api.post<PreliminaryKycWorkspace>(`/enquiries/${id}/preliminary-kyc/complete`, payload).then((response) => response.data);
}

export function addEnquiryComment(id: string, payload: { body: string }) {
  return api.post<Enquiry>(`/enquiries/${id}/comments`, payload).then((response) => response.data);
}

export function uploadEnquiryAttachmentFile(id: string, payload: { documentType: string; file: File }) {
  const data = new FormData();
  data.append('documentType', payload.documentType);
  data.append('file', payload.file);

  return api.post<Enquiry>(`/enquiries/${id}/attachments/upload`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((response) => response.data);
}

export function uploadEnquiryAttachmentFiles(id: string, payload: { documentType: string; files: File[] }) {
  if (payload.files.length === 1) {
    return uploadEnquiryAttachmentFile(id, { documentType: payload.documentType, file: payload.files[0] });
  }

  const data = new FormData();
  data.append('documentType', payload.documentType);
  payload.files.forEach((file) => data.append('files', file));

  return api.post<Enquiry>(`/enquiries/${id}/attachments/upload-many`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((response) => response.data);
}

export async function viewEnquiryAttachment(enquiryId: string, attachment: EnquiryAttachment) {
  const response = await api.get(`/enquiries/${enquiryId}/attachments/${attachment.id}/view`, {
    responseType: 'blob'
  });
  const blob = new Blob([response.data], { type: attachment.mimeType || response.data.type || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const mimeType = blob.type.toLowerCase();
  const canPreview = mimeType.startsWith('image/') || mimeType === 'application/pdf' || mimeType.startsWith('text/');

  if (canPreview) {
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    return;
  }

  downloadBlob(url, attachment.fileName);
  window.URL.revokeObjectURL(url);
}

export async function downloadEnquiryAttachment(enquiryId: string, attachment: EnquiryAttachment) {
  const response = await api.get(`/enquiries/${enquiryId}/attachments/${attachment.id}/view`, {
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(response.data);
  downloadBlob(url, attachment.fileName);
  window.URL.revokeObjectURL(url);
}

export async function downloadEnquiryAttachmentGroup(enquiryId: string, documentType: string) {
  const response = await api.get(`/enquiries/${enquiryId}/attachments/download-group`, {
    params: { documentType },
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(response.data);
  downloadBlob(url, `${safeDownloadName(documentType)}.zip`);
  window.URL.revokeObjectURL(url);
}

export function deleteEnquiry(id: string) {
  return api.delete<{ id: string }>(`/enquiries/${id}`).then((response) => response.data);
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

export function completeEngagementDecision(id: string, payload: { decision: 'CONVERT_TO_CLIENT' | 'REJECT' | 'ON_HOLD'; reason?: string }) {
  return api.post<KycCase>(`/kyc/${id}/engagement-decision`, payload).then((response) => response.data);
}

export function startKycAmendment(id: string, payload: { sections: string[]; reason: string }) {
  return api.post<KycCase>(`/kyc/${id}/amendments`, payload).then((response) => response.data);
}

export function completeFinalKycDecision(id: string, payload: { decision: 'SAME_KYC_FINAL' | 'AMENDMENT_REQUIRED'; sections?: string[]; reason?: string }) {
  return api.post<KycCase>(`/kyc/${id}/final-kyc-decision`, payload).then((response) => response.data);
}

export function uploadLegalDocumentFiles(id: string, payload: { documentType: string; files: File[] }) {
  if (payload.files.length === 1) {
    return uploadLegalDocumentFile(id, { documentType: payload.documentType, file: payload.files[0] });
  }

  const data = new FormData();
  data.append('documentType', payload.documentType);
  payload.files.forEach((file) => data.append('files', file));

  return api.post<KycCase>(`/kyc/${id}/legal-documents/upload-many`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((response) => response.data);
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

export async function downloadLegalDocument(caseId: string, document: LegalDocument) {
  const response = await api.get(`/kyc/${caseId}/legal-documents/${document.id}/view`, {
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(response.data);
  downloadBlob(url, document.fileName);
  window.URL.revokeObjectURL(url);
}

export async function downloadLegalDocumentGroup(caseId: string, documentType: string) {
  const response = await api.get(`/kyc/${caseId}/legal-documents/download-group`, {
    params: { documentType },
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(response.data);
  downloadBlob(url, `${safeDownloadName(documentType)}.zip`);
  window.URL.revokeObjectURL(url);
}

export function deleteLegalDocument(caseId: string, documentId: string) {
  return api.delete<KycCase>(`/kyc/${caseId}/legal-documents/${documentId}`).then((response) => response.data);
}

export function getScreeningContext(caseId: string) {
  return api.get<ScreeningContext>(`/kyc/${caseId}/screening/context`).then((response) => response.data);
}

export function listScreeningRecords() {
  return api.get<ScreeningListItem[]>('/screening').then((response) => response.data);
}

export function createScreeningRecord(caseId: string, payload: Record<string, any>) {
  return api.post<ScreeningContext>(`/kyc/${caseId}/screening/records`, payload).then((response) => response.data);
}

export function updateScreeningRecord(caseId: string, recordId: string, payload: Record<string, any>) {
  return api.patch<ScreeningContext>(`/kyc/${caseId}/screening/records/${recordId}`, payload).then((response) => response.data);
}

export function completeScreeningRecord(caseId: string, recordId: string) {
  return api.post<ScreeningContext>(`/kyc/${caseId}/screening/records/${recordId}/complete`).then((response) => response.data);
}

export function deleteScreeningRecord(caseId: string, recordId: string) {
  return api.delete<ScreeningContext>(`/kyc/${caseId}/screening/records/${recordId}`).then((response) => response.data);
}

export function uploadMergedScreeningDocuments(caseId: string, payload: { checkType: ScreeningCheckType; files: File[] }) {
  const data = new FormData();
  data.append('checkType', payload.checkType);
  payload.files.forEach((file) => data.append('files', file));

  return api
    .post<ScreeningContext>(`/kyc/${caseId}/screening/merged-documents/upload`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    .then((response) => response.data);
}

export function updateMergedScreeningCheck(caseId: string, checkType: ScreeningCheckType, payload: { resultStatus: ScreeningResultStatus; notes?: string }) {
  return api.patch<ScreeningContext>(`/kyc/${caseId}/screening/merged-checks/${checkType}`, payload).then((response) => response.data);
}

export function uploadScreeningDocuments(
  caseId: string,
  recordId: string,
  payload: { checkType: ScreeningCheckType; documentType?: string; files: File[] }
) {
  const data = new FormData();
  data.append('checkType', payload.checkType);
  if (payload.documentType) data.append('documentType', payload.documentType);
  payload.files.forEach((file) => data.append('files', file));

  return api
    .post<ScreeningContext>(`/kyc/${caseId}/screening/records/${recordId}/documents/upload`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    .then((response) => response.data);
}

export async function viewMergedScreeningDocument(caseId: string, document: ScreeningDocument) {
  const response = await api.get(`/kyc/${caseId}/screening/merged-documents/${document.id}/view`, {
    responseType: 'blob'
  });
  const blob = new Blob([response.data], { type: document.mimeType || response.data.type || 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

export async function viewScreeningDocument(caseId: string, document: ScreeningDocument) {
  const response = await api.get(`/kyc/${caseId}/screening/documents/${document.id}/view`, {
    responseType: 'blob'
  });
  const blob = new Blob([response.data], { type: document.mimeType || response.data.type || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const canPreview = blob.type.toLowerCase().startsWith('image/') || blob.type.toLowerCase() === 'application/pdf' || blob.type.toLowerCase().startsWith('text/');

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

export function deleteScreeningDocument(caseId: string, documentId: string) {
  return api.delete<ScreeningContext>(`/kyc/${caseId}/screening/documents/${documentId}`).then((response) => response.data);
}

export function deleteMergedScreeningDocument(caseId: string, documentId: string) {
  return api.delete<ScreeningContext>(`/kyc/${caseId}/screening/merged-documents/${documentId}`).then((response) => response.data);
}

export function listCrrfRecords() {
  return api.get<CrrfListItem[]>('/crrf').then((response) => response.data);
}

export function getCrrfWorkspace(caseId: string) {
  return api.get<CrrfWorkspace>(`/kyc/${caseId}/crrf`).then((response) => response.data);
}

export function saveCrrfWorkspace(caseId: string, payload: { riskRating?: CrrfRiskRating | ''; internalComment?: string; dmlroComment?: string; mlroComment?: string }) {
  return api.patch<CrrfWorkspace>(`/kyc/${caseId}/crrf`, payload).then((response) => response.data);
}

export function uploadCrrfDocuments(caseId: string, files: File[]) {
  const data = new FormData();
  files.forEach((file) => data.append('files', file));
  return api
    .post<CrrfWorkspace>(`/kyc/${caseId}/crrf/documents/upload`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    .then((response) => response.data);
}

export async function viewCrrfDocument(caseId: string, document: CrrfDocument) {
  const response = await api.get(`/kyc/${caseId}/crrf/documents/${document.id}/view`, {
    responseType: 'blob'
  });
  const blob = new Blob([response.data], { type: document.mimeType || response.data.type || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const canPreview = blob.type.toLowerCase().startsWith('image/') || blob.type.toLowerCase() === 'application/pdf' || blob.type.toLowerCase().startsWith('text/');
  if (canPreview) {
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    return;
  }
  downloadBlob(url, document.fileName);
  window.URL.revokeObjectURL(url);
}

export function deleteCrrfDocument(caseId: string, documentId: string) {
  return api.delete<CrrfWorkspace>(`/kyc/${caseId}/crrf/documents/${documentId}`).then((response) => response.data);
}

export async function exportCrrf(caseId: string, type: 'excel' | 'pdf') {
  const response = await api.get(`/kyc/${caseId}/crrf/export/${type}`, {
    responseType: 'blob'
  });
  const contentDisposition = String(response.headers['content-disposition'] || '');
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || `crrf-report.${type === 'excel' ? 'xls' : 'pdf'}`;
  const url = window.URL.createObjectURL(response.data);
  downloadBlob(url, fileName);
  window.URL.revokeObjectURL(url);
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

export function getNotifications() {
  return api.get<AppNotification[]>('/notifications').then((response) => response.data);
}

export function markNotificationRead(id: string) {
  return api.patch<AppNotification>(`/notifications/${id}/read`).then((response) => response.data);
}

export function markAllNotificationsRead() {
  return api.patch<AppNotification[]>('/notifications/read-all').then((response) => response.data);
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

export function decideSefReview(caseId: string, payload: Record<string, any>) {
  return api.post<KycCase>(`/kyc/${caseId}/internal-reviews/sef/decision`, payload).then((response) => response.data);
}

export function returnKycToBusinessDevelopment(caseId: string, reason: string) {
  return api.post<KycCase>(`/kyc/${caseId}/return-to-bd`, { reason }).then((response) => response.data);
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

export function reviewKycWithAi(caseId: string) {
  return api.post<AiKycReview>(`/kyc/${caseId}/ai-review`).then((response) => response.data);
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

function downloadBlob(url: string, fileName: string) {
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}

function safeDownloadName(value: string) {
  return (value || 'attachments').replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim() || 'attachments';
}
