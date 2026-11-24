import { AuthUser } from '../services/auth.service';
import { hasAreaAccess, workflowRoles } from './access-control';

export const workspaceModules = [
  { id: 'enquiry', label: 'Enquiry', description: 'Client enquiries and preliminary information.', to: '/enquiries', areas: [{ area: 'enquiries', roles: workflowRoles.enquiries }] },
  { id: 'kyc', label: 'KYC', description: 'Preparation, screening, risk assessment and reviews.', to: '/kyc-workflow', areas: [
    { area: 'kyc', roles: [...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks] },
    { area: 'screening', roles: workflowRoles.screening }, { area: 'crrf', roles: workflowRoles.crrf }, { area: 'approvals', roles: workflowRoles.reviewTasks }
  ] },
  { id: 'compliance', label: 'Compliance Clients', description: 'Onboarded clients, monitoring and ongoing compliance.', to: '/compliance/clients', areas: [{ area: 'compliance', roles: workflowRoles.complianceView }] }
] as const;

export function availableWorkspaceModules(user: AuthUser | null | undefined) {
  const destinations: Record<string, string> = { kyc: '/kyc-workflow', screening: '/screening', crrf: '/crrf', approvals: '/review-tasks' };
  return workspaceModules.flatMap((module) => {
    const first = module.areas.find(({ area, roles }) => hasAreaAccess(user, area, false, roles));
    return first ? [{ ...module, to: module.id === 'kyc' ? destinations[first.area] : module.to }] : [];
  });
}

export function workspaceForPath(path: string) {
  if (/^\/enquiries(?:\/|$)/.test(path)) return 'enquiry';
  if (/^\/(?:kyc|kyc-workflow|screening|crrf|review-tasks)(?:\/|$)/.test(path)) return 'kyc';
  if (/^\/(?:compliance|clients)(?:\/|$)/.test(path)) return 'compliance';
  return null;
}

export function navigationInWorkspace(path: string, destination: string) {
  const active = workspaceForPath(path);
  const target = workspaceForPath(destination);
  return target === null || target === active;
}
