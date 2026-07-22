import { AuthUser } from '../services/auth.service';

export type AppRole =
  | 'SUPER_ADMIN'
  | 'COMPANY_ADMIN'
  | 'OPERATING_TEAM'
  | 'AML_TEAM'
  | 'AML_SUPERVISOR'
  | 'DMLRO'
  | 'MLRO'
  | 'SEF'
  | 'ACCOUNTING_TEAM'
  | 'HR_TEAM';

export const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  OPERATING_TEAM: 'Operations Team',
  AML_TEAM: 'AML Team',
  AML_SUPERVISOR: 'AML Supervisor',
  DMLRO: 'DMLRO',
  MLRO: 'MLRO',
  SEF: 'SEF',
  ACCOUNTING_TEAM: 'Accounting Team',
  HR_TEAM: 'HR Team'
};

export const workflowRoles = {
  clientIntake: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATING_TEAM'],
  caseCreation: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATING_TEAM'],
  documentUpload: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATING_TEAM', 'AML_TEAM', 'AML_SUPERVISOR'],
  documentDelete: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'AML_TEAM', 'AML_SUPERVISOR'],
  kycPreparation: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'AML_TEAM', 'AML_SUPERVISOR'],
  kycFormBuilder: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO'],
  amlDashboard: [],
  reviewTasks: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DMLRO', 'MLRO', 'SEF'],
  supervisorReview: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'AML_TEAM', 'AML_SUPERVISOR'],
  dmlroReview: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DMLRO'],
  mlroReview: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'MLRO'],
  sefReview: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'SEF'],
  signedDocuments: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DMLRO', 'MLRO'],
  admin: ['SUPER_ADMIN'],
  userAdmin: ['SUPER_ADMIN', 'COMPANY_ADMIN']
};

export function hasAnyRole(user: AuthUser | null | undefined, roles: readonly string[]) {
  if (!user) return false;
  return user.roles.some((role) => roles.includes(role));
}

export function roleList(user: AuthUser | null | undefined) {
  return user?.roles.map((role) => roleLabels[role] || role).join(', ') || 'No role assigned';
}

export function defaultRouteForUser(user: AuthUser | null | undefined) {
  if (hasAnyRole(user, workflowRoles.clientIntake)) return '/dashboard';
  if (hasAnyRole(user, workflowRoles.kycPreparation)) return '/kyc-workflow';
  if (hasAnyRole(user, workflowRoles.reviewTasks)) return '/review-tasks';
  return '/dashboard';
}

export function allowedReviewStages(user: AuthUser | null | undefined) {
  return {
    SUPERVISOR: hasAnyRole(user, workflowRoles.supervisorReview),
    DMLRO: hasAnyRole(user, workflowRoles.dmlroReview),
    MLRO: hasAnyRole(user, workflowRoles.mlroReview),
    SEF: hasAnyRole(user, workflowRoles.sefReview)
  };
}
