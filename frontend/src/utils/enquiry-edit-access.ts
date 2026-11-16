import { AuthUser } from '../services/auth.service';
import { hasAnyRole, workflowRoles } from './access-control';

export function canEditEnquiryArea(user: AuthUser | null | undefined) {
  if (!user) return false;
  if (user.roles.includes('SUPER_ADMIN')) return true;
  return user.accessControlConfigured ? Boolean(user.permissions?.includes('enquiries.edit')) : hasAnyRole(user, workflowRoles.enquiryEditing);
}

export function canEditEnquiryRecord(user: AuthUser | null | undefined, enquiry: { status: string; generatedKycCases?: { status: string }[] }) {
  if (!canEditEnquiryArea(user)) return false;
  if (hasAnyRole(user, ['COMPANY_ADMIN', 'SUPER_ADMIN'])) return true;
  const preparation = ['INQUIRY_RECEIVED', 'PROPOSAL_OPTIONAL', 'LEGAL_DOCUMENTS_PENDING', 'LEGAL_DOCUMENTS_UPLOADED', 'RETURNED_TO_BD', 'SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'];
  if (enquiry.generatedKycCases?.some((item) => !preparation.includes(item.status))) return false;
  return hasAnyRole(user, ['AML_SUPERVISOR', 'AML_TEAM']) || ['DRAFT', 'RETURNED_TO_BD'].includes(enquiry.status);
}
