import type { AuthUser } from '../services/auth.service';
import type { KycCase } from '../services/kyc-workflow.service';
import { hasAnyRole } from './access-control';

// Whether the case is still open for the AML team to prepare (documents, form). Shared by the case page and the
// case workspace tabs so both agree on who can open the KYC form and when.
export function isPreparationEditable(kycCase: Pick<KycCase, 'status' | 'kycForm'>) {
  return ['INQUIRY_RECEIVED', 'PROPOSAL_OPTIONAL', 'LEGAL_DOCUMENTS_PENDING', 'LEGAL_DOCUMENTS_UPLOADED', 'SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED', 'DMLRO_ADDITIONAL_INFORMATION_REQUIRED', 'MLRO_ADDITIONAL_INFORMATION_REQUIRED'].includes(kycCase.status) ||
    (kycCase.status === 'AML_REVIEW_STARTED' && kycCase.kycForm?.fullKycStarted === true && kycCase.kycForm.status === 'AMENDMENT_DRAFT' && !kycCase.kycForm.isLocked);
}

// The person's turn to work in the KYC form (admins always).
export function canOpenKycFormForActiveStage(user: AuthUser | null | undefined, kycCase: Pick<KycCase, 'status' | 'kycForm'>) {
  return hasAnyRole(user, ['SUPER_ADMIN', 'COMPANY_ADMIN']) ||
    (hasAnyRole(user, ['AML_TEAM', 'AML_SUPERVISOR']) && isPreparationEditable(kycCase)) ||
    (hasAnyRole(user, ['DMLRO']) && ['DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS'].includes(kycCase.status)) ||
    (hasAnyRole(user, ['MLRO']) && ['MLRO_REVIEW_PENDING', 'MLRO_REVIEW_IN_PROGRESS', 'DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS'].includes(kycCase.status)) ||
    (hasAnyRole(user, ['SEF']) && ['SEF_DECISION_PENDING', 'SEF_DECISION_IN_PROGRESS'].includes(kycCase.status));
}
