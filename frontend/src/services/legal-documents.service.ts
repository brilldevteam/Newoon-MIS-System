import { api } from './api';

// Legal documents register of a compliance client (2026-11-22, Phase 2). Same catalogue as the backend
// (legal-document-catalogue.ts), returned by the list call as `types`.

export type LegalDocumentTypeKey =
  | 'CR_EXTRACT_EN' | 'CR_EXTRACT_AR' | 'PUBLIC_CR' | 'CERT_INCORPORATION' | 'COMMERCIAL_LICENSE' | 'COMPUTER_CARD'
  | 'ARTICLES' | 'TAX_CARD' | 'COMPANY_PROFILE' | 'ORG_CHART' | 'AUDITED_FS' | 'NATIONAL_ADDRESS' | 'POWER_OF_ATTORNEY'
  | 'QID' | 'PASSPORT' | 'OTHER';

export type LegalDocumentType = {
  key: LegalDocumentTypeKey;
  label: string;
  nature: 'COMPANY' | 'INDIVIDUAL';
  hasExpiry: boolean;
  personIdentity?: boolean;
  isRegistration?: boolean;
  overview?: boolean;
};

export type LegalDocument = {
  id: string;
  typeKey: LegalDocumentTypeKey;
  typeLabel: string;
  nature: 'COMPANY' | 'INDIVIDUAL';
  personId: string | null;
  personRoles: string | null;
  documentNumber: string | null;
  holderName: string;
  location: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  status: 'CURRENT' | 'REPLACED' | 'DELETED';
  replacesId: string | null;
  replacedById: string | null;
  sourceKycDocumentId: string | null;
  readMethod: 'MANUAL' | 'LOCAL' | 'AI' | null;
  statusReason: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// A QID or passport of a person, listed with the register (kept on the person).
export type IdentityRegisterRow = {
  key: string;
  typeKey: 'QID' | 'PASSPORT';
  typeLabel: string;
  nature: 'INDIVIDUAL';
  personId: string;
  personRoles: string;
  passportId: string | null;
  documentNumber: string | null;
  holderName: string;
  location: string | null;
  expiryDate: string | null;
  copy: { id: string; fileName: string; mimeType: string | null; createdAt: string } | null;
};

export type LegalDocumentRegister = {
  types: LegalDocumentType[];
  documents: LegalDocument[];
  identity: IdentityRegisterRow[];
  people: Array<{ id: string; fullName: string; partyType: 'INDIVIDUAL' | 'CORPORATE'; nationality: string | null; roles: string }>;
};

export type SuggestedRole = 'SHAREHOLDER' | 'DIRECTOR' | 'MANAGER' | 'AUTHORISED_SIGNATORY' | 'SECRETARY' | 'CHAIRMAN' | 'MANAGING_DIRECTOR' | 'GENERAL_MANAGER' | 'CEO' | 'OTHER';

export type DocumentReading = {
  method: 'AI' | 'LOCAL' | 'NONE';
  message: string;
  aiConfigured: boolean;
  document: { documentNumber: string | null; holderName: string | null; location: string | null; issueDate: string | null; expiryDate: string | null };
  company: Partial<Record<
    'legalName' | 'commercialRegistrationNo' | 'dateOfIncorporation' | 'crExpiryDate' | 'countryOfIncorporation' | 'placeOfIncorporation'
    | 'legalForm' | 'registeredOfficeAddress' | 'shareCapital' | 'taxIdentificationNo' | 'licenseActivities',
    string
  >>;
  people: Array<{ fullName: string; nationality: string | null; roles: SuggestedRole[]; sharePercentage: string | null; idNumber: string | null }>;
};

export type LegalDocumentInput = {
  typeKey: LegalDocumentTypeKey;
  typeLabel?: string;
  nature?: 'COMPANY' | 'INDIVIDUAL';
  personId?: string;
  documentNumber?: string;
  holderName?: string;
  location?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
  replacesId?: string;
  readMethod?: 'MANUAL' | 'LOCAL' | 'AI';
  kycDocumentId?: string;
};

const base = (clientId: string) => `/compliance/clients/${clientId}/legal-documents`;

export function getLegalDocuments(clientId: string) {
  return api.get<LegalDocumentRegister>(base(clientId)).then((response) => response.data);
}

export function readLegalDocument(clientId: string, typeKey: string, file: File) {
  const data = new FormData();
  data.append('typeKey', typeKey);
  data.append('files', file);
  return api.post<DocumentReading>(`${base(clientId)}/read`, data, { timeout: 150000 }).then((response) => response.data);
}

export function createLegalDocument(clientId: string, input: LegalDocumentInput, file: File | null) {
  const fields = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')) as Record<string, string>;
  if (!file) {
    return api.post<LegalDocumentRegister & { id: string }>(base(clientId), fields).then((response) => response.data);
  }
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  data.append('files', file);
  return api.post<LegalDocumentRegister & { id: string }>(base(clientId), data, { timeout: 120000 }).then((response) => response.data);
}

export function updateLegalDocument(clientId: string, documentId: string, input: Partial<Record<'personId' | 'documentNumber' | 'holderName' | 'location' | 'issueDate' | 'expiryDate' | 'notes', string | null>>) {
  return api.patch<LegalDocumentRegister>(`${base(clientId)}/${documentId}`, input).then((response) => response.data);
}

export function removeLegalDocument(clientId: string, documentId: string, reason: string) {
  return api.post<LegalDocumentRegister>(`${base(clientId)}/${documentId}/remove`, { reason }).then((response) => response.data);
}

export async function openLegalDocumentFile(clientId: string, document: Pick<LegalDocument, 'id' | 'mimeType' | 'fileName'>) {
  const response = await api.get(`${base(clientId)}/${document.id}/view`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: document.mimeType || response.data.type || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  if (blob.type.startsWith('image/') || blob.type === 'application/pdf') {
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    return;
  }
  const link = window.document.createElement('a');
  link.href = url;
  link.download = document.fileName || 'document';
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// A KYC upload as a File, so it can be read before it is added to the register.
export async function kycDocumentAsFile(kycCaseId: string, document: { id: string; fileName: string; mimeType: string | null }) {
  const response = await api.get(`/kyc/${kycCaseId}/legal-documents/${document.id}/view`, { responseType: 'blob' });
  return new File([response.data], document.fileName, { type: document.mimeType || response.data.type || 'application/octet-stream' });
}

export type ExpiryWindow = 'ALL' | 'EXPIRED' | '30' | '60';

// Expiring documents as Excel: one client, or all clients of the register when clientId is null.
export async function downloadExpiryExcel(clientId: string | null, window: ExpiryWindow) {
  const url = clientId ? `/compliance/clients/${clientId}/expiry/export` : '/compliance/clients/export/expiry';
  const response = await api.get(url, { params: { window }, responseType: 'blob', timeout: 120000 });
  const disposition = String(response.headers['content-disposition'] || '');
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || 'expiring-documents.xlsx';
  const href = globalThis.URL.createObjectURL(response.data);
  const link = globalThis.document.createElement('a');
  link.href = href;
  link.download = fileName;
  globalThis.document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.URL.revokeObjectURL(href);
}
