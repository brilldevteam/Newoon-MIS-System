import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../types/request-user.type';
import { AccessControlService } from '../../access-control/access-control.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly accessControlService: AccessControlService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const userRoles = request.user?.roles || [];
    const area = areaForController(context.getClass().name);
    if (area) {
      const allowed = await this.accessControlService.allows(userRoles, area, context.switchToHttp().getRequest().method !== 'GET');
      if (allowed !== null) return allowed;
    }
    return requiredRoles.some((role) => userRoles.includes(role));
  }
}

function areaForController(name: string) {
  const areas: Record<string, string> = {
    EnquiriesController: 'enquiries',
    ClientsController: 'clients',
    KycController: 'kyc',
    ScreeningController: 'screening',
    CrrfController: 'crrf',
    DocumentsController: 'kyc',
    ApprovalsController: 'approvals',
    UsersController: 'administration',
    RolesController: 'administration',
    PermissionsController: 'administration',
    TenantsController: 'administration',
    ModulesController: 'administration',
    TenantModulesController: 'administration',
    AuditLogsController: 'administration'
  };
  return areas[name];
}
