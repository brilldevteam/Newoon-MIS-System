import { AuthUser } from '../services/auth.service';
import { AppNotification } from '../services/kyc-workflow.service';
import { hasAnyRole } from './access-control';
import { canEditEnquiryRecord } from './enquiry-edit-access';

export function enquiryNotificationLink(notification: AppNotification, user: AuthUser | null) {
  const enquiry = notification.enquiry;
  if (!enquiry?.id) return null;
  const status = enquiry.status || notification.kycCase?.status;
  const returned = notification.type === 'ADDITIONAL_INFORMATION_REQUESTED' && status === 'RETURNED_TO_BD';
  const editable = returned && hasAnyRole(user, ['OPERATING_TEAM']) && canEditEnquiryRecord(user, {
    status, generatedKycCases: notification.kycCase ? [{ status: notification.kycCase.status }] : []
  });
  return `/enquiries/${enquiry.id}${editable ? '/edit' : ''}`;
}
