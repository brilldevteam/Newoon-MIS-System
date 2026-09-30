import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const ACCESS_AREAS = [
  { key: 'enquiries', label: 'Enquiries', description: 'Enquiry register, details, and preliminary KYC intake.' },
  { key: 'clients', label: 'Clients', description: 'Client register and client records.' },
  { key: 'kyc', label: 'KYC Workflow', description: 'KYC cases, KYC forms, legal documents, and review decisions.' },
  { key: 'screening', label: 'Screening', description: 'Screening checks, evidence, and conclusions.' },
  { key: 'crrf', label: 'CRRF', description: 'Client risk-rating records and CRRF files.' },
  { key: 'approvals', label: 'Approvals & Reviews', description: 'Approval queue and assigned review tasks.' },
  { key: 'administration', label: 'Administration', description: 'Users, tenants, modules, roles, and system configuration.' }
] as const;

export type AccessLevel = 'NONE' | 'VIEW' | 'EDIT';

const CONFIGURED_KEY = 'access-control.configured';
const managedPermissionKeys = ACCESS_AREAS.flatMap((area) => [`${area.key}.view`, `${area.key}.edit`]);

const defaults: Record<string, Partial<Record<(typeof ACCESS_AREAS)[number]['key'], AccessLevel>>> = {
  SUPER_ADMIN: Object.fromEntries(ACCESS_AREAS.map((area) => [area.key, 'EDIT'])) as Record<(typeof ACCESS_AREAS)[number]['key'], AccessLevel>,
  COMPANY_ADMIN: Object.fromEntries(ACCESS_AREAS.map((area) => [area.key, 'EDIT'])) as Record<(typeof ACCESS_AREAS)[number]['key'], AccessLevel>,
  OPERATING_TEAM: { enquiries: 'EDIT', clients: 'EDIT', kyc: 'EDIT' },
  AML_TEAM: { enquiries: 'EDIT', kyc: 'EDIT', screening: 'EDIT', crrf: 'EDIT' },
  AML_SUPERVISOR: { enquiries: 'EDIT', kyc: 'EDIT', screening: 'EDIT', crrf: 'EDIT' },
  DMLRO: { enquiries: 'VIEW', kyc: 'EDIT', screening: 'VIEW', crrf: 'EDIT', approvals: 'EDIT' },
  MLRO: { enquiries: 'VIEW', kyc: 'EDIT', screening: 'VIEW', crrf: 'EDIT', approvals: 'EDIT' },
  SEF: { enquiries: 'VIEW', kyc: 'EDIT', screening: 'VIEW', crrf: 'VIEW', approvals: 'EDIT' },
  ACCOUNTING_TEAM: { enquiries: 'VIEW' },
  HR_TEAM: { enquiries: 'VIEW' }
};

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatrix() {
    await this.ensureCatalog();
    const [configured, roles] = await Promise.all([
      this.isConfigured(),
      this.prisma.role.findMany({
        orderBy: { name: 'asc' },
        include: { permissions: { include: { permission: true } } }
      })
    ]);

    return {
      configured,
      areas: ACCESS_AREAS,
      roles: roles.map((role) => ({
        name: role.name,
        description: role.description,
        levels: Object.fromEntries(ACCESS_AREAS.map((area) => [area.key, this.levelFor(role.name, role.permissions.map((item) => item.permission.key), configured, area.key)]))
      }))
    };
  }

  async updateRole(roleName: string, levels: Record<string, AccessLevel>) {
    if (roleName === 'SUPER_ADMIN') {
      throw new BadRequestException('Super Admin access is fixed to prevent an administrative lockout.');
    }

    await this.ensureCatalog();
    await this.bootstrapDefaults();
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new BadRequestException('Role not found.');

    const validLevels = new Set<AccessLevel>(['NONE', 'VIEW', 'EDIT']);
    for (const area of ACCESS_AREAS) {
      if (!validLevels.has(levels[area.key] || 'NONE')) {
        throw new BadRequestException(`Invalid access level for ${area.label}.`);
      }
    }

    const permissions = await this.prisma.permission.findMany({ where: { key: { in: managedPermissionKeys } } });
    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
    const permissionIds = ACCESS_AREAS.flatMap((area) => {
      const level = levels[area.key] || 'NONE';
      if (level === 'NONE') return [];
      const viewId = permissionByKey.get(`${area.key}.view`);
      const editId = permissionByKey.get(`${area.key}.edit`);
      return level === 'EDIT' ? [viewId, editId].filter(Boolean) as string[] : [viewId].filter(Boolean) as string[];
    });

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id, permission: { key: { in: managedPermissionKeys } } } }),
      this.prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })), skipDuplicates: true })
    ]);

    return this.getMatrix();
  }

  async effectivePermissions(roleNames: string[]) {
    if (roleNames.includes('SUPER_ADMIN')) return { configured: true, permissions: managedPermissionKeys };
    if (!(await this.isConfigured())) return { configured: false, permissions: [] };

    const grants = await this.prisma.rolePermission.findMany({
      where: { role: { name: { in: roleNames } }, permission: { key: { in: managedPermissionKeys } } },
      include: { permission: true }
    });
    return { configured: true, permissions: [...new Set(grants.map((grant) => grant.permission.key))] };
  }

  async allows(roleNames: string[], area: string, write: boolean) {
    if (roleNames.includes('SUPER_ADMIN')) return true;
    if (!(await this.isConfigured())) return null;
    const required = write ? `${area}.edit` : `${area}.view`;
    const grant = await this.prisma.rolePermission.findFirst({
      where: { role: { name: { in: roleNames } }, permission: { key: required } }
    });
    return Boolean(grant);
  }

  private async ensureCatalog() {
    await this.prisma.permission.createMany({
      data: [
        { key: CONFIGURED_KEY, description: 'Enables managed role access.' },
        ...ACCESS_AREAS.flatMap((area) => [
          { key: `${area.key}.view`, description: `View ${area.label}` },
          { key: `${area.key}.edit`, description: `Edit ${area.label}` }
        ])
      ],
      skipDuplicates: true
    });
  }

  private async bootstrapDefaults() {
    const configured = await this.prisma.permission.findUnique({ where: { key: CONFIGURED_KEY } });
    if (!configured) return;
    const linked = await this.prisma.rolePermission.count({ where: { permissionId: configured.id } });
    if (linked) return;

    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany(),
      this.prisma.permission.findMany({ where: { key: { in: managedPermissionKeys } } })
    ]);
    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
    const grants = roles.flatMap((role) => ACCESS_AREAS.flatMap((area) => {
      const level = defaults[role.name]?.[area.key] || 'NONE';
      const keys = level === 'EDIT' ? [`${area.key}.view`, `${area.key}.edit`] : level === 'VIEW' ? [`${area.key}.view`] : [];
      return keys.map((key) => ({ roleId: role.id, permissionId: permissionByKey.get(key)! })).filter((item) => item.permissionId);
    }));
    await this.prisma.$transaction([
      this.prisma.rolePermission.createMany({ data: grants, skipDuplicates: true }),
      this.prisma.rolePermission.create({ data: { roleId: roles.find((role) => role.name === 'SUPER_ADMIN')!.id, permissionId: configured.id } })
    ]);
  }

  private async isConfigured() {
    const configured = await this.prisma.permission.findUnique({ where: { key: CONFIGURED_KEY }, include: { roles: true } });
    return Boolean(configured?.roles.length);
  }

  private levelFor(roleName: string, keys: string[], configured: boolean, area: string): AccessLevel {
    if (roleName === 'SUPER_ADMIN') return 'EDIT';
    const values = configured ? keys : [];
    if (configured) return values.includes(`${area}.edit`) ? 'EDIT' : values.includes(`${area}.view`) ? 'VIEW' : 'NONE';
    return defaults[roleName]?.[area as (typeof ACCESS_AREAS)[number]['key']] || 'NONE';
  }
}
