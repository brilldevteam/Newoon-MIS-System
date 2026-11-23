import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/types/request-user.type';

// Which compliance clients and client-page tabs a user sees (requirements R04-R06, decided 2026-11-22). The access
// matrix still decides whether a role may use the compliance area at all (RolesGuard); this narrows what it sees:
//   FULL       AML Team, AML Supervisor, DMLRO, MLRO, SEF, CEO, Company Admin, Super Admin: every tab.
//   OPERATIONS Operations: every client; profile, people, legal documents (with passports), engagements, compliance
//              documents and expiry. No UBO, KYC, CRRF, screening or EDD (monitoring, reviews and risk).
//   ALLOCATED  Accounting, HR and any other role: only the clients allocated to them; profile, people, legal
//              documents without passports, and engagements.
// The data of hidden tabs is not sent; the frontend only hides what the API already leaves out.

export type ClientAccessLevel = 'FULL' | 'OPERATIONS' | 'ALLOCATED';

export const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'CEO'];
export const OPERATIONS_ROLES = ['OPERATING_TEAM'];
// Roles that allocate clients to staff.
export const ALLOCATION_MANAGER_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'AML_SUPERVISOR', 'DMLRO', 'MLRO'];
// Roles that work only on allocated clients (offered when allocating).
export const ALLOCATED_ROLES = ['ACCOUNTING_TEAM', 'HR_TEAM'];

const PEOPLE_TABS = ['overview', 'company', 'shareholders', 'officers', 'signatories', 'sef', 'secretary', 'documents', 'engagements'];
export const CLIENT_TABS: Record<ClientAccessLevel, string[]> = {
  FULL: [...PEOPLE_TABS, 'compliance-docs', 'expiry', 'ubos', 'kyc', 'crrf', 'screening', 'cdd'],
  OPERATIONS: [...PEOPLE_TABS, 'compliance-docs', 'expiry'],
  ALLOCATED: PEOPLE_TABS
};

export function clientAccessLevel(user: Pick<RequestUser, 'roles'>): ClientAccessLevel {
  if (user.roles.some((role) => FULL_ACCESS_ROLES.includes(role))) return 'FULL';
  if (user.roles.some((role) => OPERATIONS_ROLES.includes(role))) return 'OPERATIONS';
  return 'ALLOCATED';
}

export function clientAccess(user: Pick<RequestUser, 'roles'>) {
  const level = clientAccessLevel(user);
  return {
    level,
    tabs: CLIENT_TABS[level],
    canManageAllocation: user.roles.some((role) => ALLOCATION_MANAGER_ROLES.includes(role)),
    seesPassports: level !== 'ALLOCATED',
    seesAmlData: level === 'FULL'
  };
}

// Narrows client queries to the clients the user may see.
export function clientScopeWhere(user: Pick<RequestUser, 'id' | 'roles'>): Prisma.ClientWhereInput {
  return clientAccessLevel(user) === 'ALLOCATED' ? { allocations: { some: { userId: user.id } } } : {};
}

// Refuses a client-page area the user's level does not include.
export function assertClientTab(user: Pick<RequestUser, 'roles'>, tab: string) {
  if (!CLIENT_TABS[clientAccessLevel(user)].includes(tab)) throw new ForbiddenException('Your role does not have access to this part of the client.');
}
