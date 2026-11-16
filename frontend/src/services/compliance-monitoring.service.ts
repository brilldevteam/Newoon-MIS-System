import { api } from './api';
import { CddType, ClientDocument, ClientRiskLevel } from './compliance-clients.service';

export type ScreeningResult = 'PENDING' | 'CLEAR' | 'REVIEW' | 'ALERT';
export type RiskReason =
  | 'PEP_IDENTIFIED' | 'SANCTIONS_FINDING' | 'ADVERSE_MEDIA' | 'OWNERSHIP_COMPLEXITY' | 'COUNTRY_RISK'
  | 'INDUSTRY_RISK' | 'SOURCE_OF_FUNDS_CONCERN' | 'ENHANCED_MONITORING_REQUIRED' | 'PROFESSIONAL_JUDGEMENT' | 'OTHER';
export type ExpiryDocumentType = 'PASSPORT' | 'QID' | 'CR' | 'TRADE_LICENSE' | 'COMPUTER_CARD' | 'OTHER';
export type ExpiryState = 'EXPIRED' | 'DUE_30' | 'DUE_60' | 'DUE_90' | 'VALID';
export type ReviewOutcome = 'NO_CHANGE' | 'RISK_CHANGE_REQUESTED' | 'EXIT_RECOMMENDED';
type UserSummary = { id: string; firstName: string; lastName: string; email: string } | null;

export const screeningLists = ['UN', 'OFAC', 'EU', 'NCTC', 'PPO_LIST', 'WORLD_CHECK', 'GOOGLE', 'OTHER'] as const;
export const screeningListLabels: Record<string, string> = {
  UN: 'UN', OFAC: 'OFAC', EU: 'EU', NCTC: 'NCTC', PPO_LIST: 'PPO list', WORLD_CHECK: 'World-Check', GOOGLE: 'Google / adverse media', OTHER: 'Other'
};
export const screeningResultLabels: Record<ScreeningResult, string> = { PENDING: 'Pending', CLEAR: 'Clear', REVIEW: 'Review', ALERT: 'Alert' };
export const riskReasonLabels: Record<RiskReason, string> = {
  PEP_IDENTIFIED: 'PEP identified',
  SANCTIONS_FINDING: 'Sanctions finding',
  ADVERSE_MEDIA: 'Adverse media',
  OWNERSHIP_COMPLEXITY: 'Ownership complexity',
  COUNTRY_RISK: 'Country risk',
  INDUSTRY_RISK: 'Industry risk',
  SOURCE_OF_FUNDS_CONCERN: 'Source of funds concern',
  ENHANCED_MONITORING_REQUIRED: 'Enhanced monitoring required',
  PROFESSIONAL_JUDGEMENT: 'Professional judgement',
  OTHER: 'Other'
};
export const expiryTypeLabels: Record<ExpiryDocumentType, string> = {
  PASSPORT: 'Passport', QID: 'QID', CR: 'Commercial registration', TRADE_LICENSE: 'Trade licence', COMPUTER_CARD: 'Computer card', OTHER: 'Other'
};
export const reviewOutcomeLabels: Record<ReviewOutcome, string> = {
  NO_CHANGE: 'No change', RISK_CHANGE_REQUESTED: 'Risk change requested', EXIT_RECOMMENDED: 'Exit recommended'
};

export type ClientScreeningRecord = {
  id: string;
  reviewId: string | null;
  screenedAt: string;
  scope: string | null;
  listsChecked: string[];
  result: ScreeningResult;
  summary: string;
  performedBy: UserSummary;
  documents: ClientDocument[];
  createdAt: string;
};

export type ClientRiskChangeRecord = {
  id: string;
  previousRisk: ClientRiskLevel | null;
  proposedRisk: ClientRiskLevel;
  previousCdd: CddType | null;
  proposedCdd: CddType | null;
  reasonCategory: RiskReason;
  explanation: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedById: string | null;
  requestedBy: UserSummary;
  decidedBy: UserSummary;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  review: { id: string } | null;
};

export type ClientReviewRecord = {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate: string | null;
  riskAtStart: ClientRiskLevel | null;
  outcome: ReviewOutcome | null;
  findings: string | null;
  startedAt: string;
  completedAt: string | null;
  startedBy: UserSummary;
  completedBy: UserSummary;
  riskChange: { id: string; status: string; proposedRisk: ClientRiskLevel } | null;
  _count: { screenings: number };
};

export type ClientExpiryRecord = {
  id: string;
  documentType: ExpiryDocumentType;
  documentLabel: string | null;
  holderName: string;
  holderRole: string | null;
  documentNumber: string | null;
  expiryDate: string;
  notes: string | null;
  isActive: boolean;
  expiryState: ExpiryState;
};

export type ClientMonitoring = {
  screenings: ClientScreeningRecord[];
  riskChanges: ClientRiskChangeRecord[];
  reviews: ClientReviewRecord[];
  expiryItems: ClientExpiryRecord[];
  canDecideRisk: boolean;
};

const base = (clientId: string) => `/compliance/clients/${clientId}`;

export function getClientMonitoring(clientId: string) {
  return api.get<ClientMonitoring>(`${base(clientId)}/monitoring`).then((response) => response.data);
}

export function createClientScreening(
  clientId: string,
  payload: { screenedAt: string; result: ScreeningResult; summary: string; scope?: string; listsChecked: string[]; reviewId?: string; files: File[] }
) {
  const data = new FormData();
  data.append('screenedAt', payload.screenedAt);
  data.append('result', payload.result);
  data.append('summary', payload.summary);
  if (payload.scope?.trim()) data.append('scope', payload.scope.trim());
  if (payload.listsChecked.length) data.append('listsChecked', payload.listsChecked.join(','));
  if (payload.reviewId) data.append('reviewId', payload.reviewId);
  payload.files.forEach((file) => data.append('files', file));
  return api.post<ClientMonitoring>(`${base(clientId)}/screenings`, data, { timeout: 120000 }).then((response) => response.data);
}

export function requestClientRiskChange(clientId: string, payload: { proposedRisk: ClientRiskLevel; proposedCdd?: CddType; reasonCategory: RiskReason; explanation: string }) {
  return api.post<ClientMonitoring>(`${base(clientId)}/risk-changes`, payload).then((response) => response.data);
}

export function decideClientRiskChange(clientId: string, changeId: string, payload: { decision: 'APPROVE' | 'REJECT'; note?: string }) {
  return api.post<ClientMonitoring>(`${base(clientId)}/risk-changes/${changeId}/decision`, payload).then((response) => response.data);
}

export function cancelClientRiskChange(clientId: string, changeId: string) {
  return api.post<ClientMonitoring>(`${base(clientId)}/risk-changes/${changeId}/cancel`, {}).then((response) => response.data);
}

export function startClientReview(clientId: string) {
  return api.post<ClientMonitoring>(`${base(clientId)}/reviews`, {}).then((response) => response.data);
}

export function completeClientReview(
  clientId: string,
  reviewId: string,
  payload: { outcome: ReviewOutcome; findings: string; proposedRisk?: ClientRiskLevel; proposedCdd?: CddType; reasonCategory?: RiskReason; explanation?: string }
) {
  return api.post<ClientMonitoring>(`${base(clientId)}/reviews/${reviewId}/complete`, payload).then((response) => response.data);
}

export function cancelClientReview(clientId: string, reviewId: string, reason: string) {
  return api.post<ClientMonitoring>(`${base(clientId)}/reviews/${reviewId}/cancel`, { reason }).then((response) => response.data);
}

export type ExpiryPayload = {
  documentType: ExpiryDocumentType;
  documentLabel?: string;
  holderName: string;
  holderRole?: string;
  documentNumber?: string;
  expiryDate: string;
  notes?: string;
  isActive?: boolean;
};

export function saveClientExpiryItem(clientId: string, payload: ExpiryPayload, itemId?: string) {
  const request = itemId ? api.patch<ClientMonitoring>(`${base(clientId)}/expiry-items/${itemId}`, payload) : api.post<ClientMonitoring>(`${base(clientId)}/expiry-items`, payload);
  return request.then((response) => response.data);
}
