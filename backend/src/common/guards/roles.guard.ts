import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_AREA_KEY } from '../decorators/access-area.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../types/request-user.type';
import { AccessControlService } from '../../access-control/access-control.service';

// Areas holding KYC/AML case data and identity documents. Before the matrix is first saved, their endpoints
// without a role list follow the matrix defaults; other areas keep their previous open-to-signed-in behaviour.
const COMPLIANCE_AREAS = new Set(['enquiries', 'kyc', 'screening', 'crrf', 'approvals', 'compliance']);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly accessControlService: AccessControlService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    const request = context.switchToHttp().getRequest<{ user?: RequestUser; method: string }>();
    const userRoles = request.user?.roles || [];
    const write = request.method !== 'GET';
    const area = this.reflector.get<string>(ACCESS_AREA_KEY, context.getHandler()) || areaForController(context.getClass().name);
    if (area) {
      // The Access Control matrix is the authority: administrators decide what each role may view or edit.
      const allowed = await this.accessControlService.allows(userRoles, area, write);
      if (allowed !== null) return allowed;
      // Matrix not yet saved: compliance endpoints without their own role list follow the matrix defaults
      // instead of being open to every signed-in user.
      if (!requiredRoles?.length && COMPLIANCE_AREAS.has(area)) return this.accessControlService.allowsByDefault(userRoles, area, write);
    }
    if (!requiredRoles?.length) return true;
    return requiredRoles.some((role) => userRoles.includes(role));
  }
}

function areaForController(name: string) {
  const areas: Record<string, string> = {
    EnquiriesController: 'enquiries',
    ClientsController: 'clients',
    ComplianceClientsController: 'compliance',
    ComplianceDocumentsController: 'compliance',
    ComplianceMonitoringController: 'compliance',
    ComplianceRemindersController: 'compliance',
    KycController: 'kyc',
    ScreeningController: 'screening',
    CrrfController: 'crrf',
    DocumentsController: 'kyc',
    ApprovalsController: 'approvals',
    UsersController: 'administration',
    RolesController: 'administration',
    AuditLogsController: 'administration'
    // Tenants, TenantModules, Modules and Permissions manage the whole platform across companies,
    // so they stay Super Admin only (their @Roles) and are deliberately not grantable through the matrix.
  };
  return areas[name];
}
