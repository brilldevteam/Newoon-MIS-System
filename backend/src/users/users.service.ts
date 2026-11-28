import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { clampPage, pagingOf, searchTerm, TablePage, TableQueryDto } from '../common/table-query';
import * as bcrypt from 'bcrypt';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, MANAGED_ROLES, ResetUserPasswordDto, UpdateUserDto } from './dto/manage-user.dto';
import { passwordPolicyError } from '../common/security/password-policy';

const publicUser = {
  id: true, tenantId: true, email: true, firstName: true, lastName: true, status: true, createdAt: true,
  tenant: { select: { id: true, name: true } }, roles: { include: { role: true } }
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: RequestUser) {
    // Area grants must not confer user-management or role-assignment privileges.
    if (!user.roles.some((role) => ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(role))) throw new ForbiddenException('Only administrators can manage users.');
    if (!user.roles.includes('SUPER_ADMIN') && !user.tenantId) throw new ForbiddenException('A company administrator must belong to a company.');
  }

  findAll(user: RequestUser) {
    this.assertAdmin(user);
    return this.prisma.user.findMany({ where: user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: user.tenantId }, select: publicUser, orderBy: { createdAt: 'desc' } });
  }

  // Server-driven list: same tenant scoping and row shape as findAll, plus search, filters, tabs, sort and paging.
  async table(user: RequestUser, query: TableQueryDto): Promise<TablePage<unknown>> {
    this.assertAdmin(user);
    const scope: Prisma.UserWhereInput = user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: user.tenantId };
    const q = searchTerm(query);
    const role = MANAGED_ROLES.includes(query.role || '') ? query.role : undefined;
    const status = (Object.values(UserStatus) as string[]).includes(query.status || '') ? (query.status as UserStatus) : undefined;
    const common: Prisma.UserWhereInput = {
      AND: [
        scope,
        role ? { roles: { some: { role: { name: role } } } } : {},
        status ? { status } : {},
        q
          ? {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { tenant: { name: { contains: q, mode: 'insensitive' } } },
                ...q.split(/\s+/).length > 1 ? [{ AND: q.split(/\s+/).map((word) => ({ OR: [{ firstName: { contains: word, mode: 'insensitive' as const } }, { lastName: { contains: word, mode: 'insensitive' as const } }] })) }] : []
              ]
            }
          : {}
      ]
    };
    const tabs: Record<string, UserStatus> = { active: UserStatus.ACTIVE, suspended: UserStatus.SUSPENDED, invited: UserStatus.INVITED };
    const tab = query.tab && tabs[query.tab] ? query.tab : 'all';
    const where: Prisma.UserWhereInput = tab === 'all' ? common : { AND: [common, { status: tabs[tab] }] };
    const direction = query.dir === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      query.sort === 'name' ? [{ firstName: direction }, { lastName: direction }]
      : query.sort === 'email' ? [{ email: direction }]
      : query.sort === 'status' ? [{ status: direction }, { createdAt: 'desc' }]
      : [{ createdAt: query.sort === 'created' ? direction : 'desc' }];
    const { pageSize, requested } = pagingOf(query);
    const [total, groups, scopeGroups, scopeAdmins] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({ by: ['status'], where: common, _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
      this.prisma.user.count({ where: { AND: [scope, { roles: { some: { role: { name: { in: ['SUPER_ADMIN', 'COMPANY_ADMIN'] } } } } }] } })
    ]);
    const page = clampPage(requested, total, pageSize);
    const items = await this.prisma.user.findMany({
      where,
      select: publicUser,
      orderBy: [...orderBy, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    const byStatus = new Map(groups.map((group) => [group.status, group._count._all]));
    const scopeByStatus = new Map(scopeGroups.map((group) => [group.status, group._count._all]));
    const counts: Record<string, number> = { all: groups.reduce((sum, group) => sum + group._count._all, 0) };
    for (const [key, value] of Object.entries(tabs)) counts[key] = byStatus.get(value) || 0;
    // Overall figures for the summary cards: the whole visible user set, whatever the search or filters.
    counts.scopeAll = scopeGroups.reduce((sum, group) => sum + group._count._all, 0);
    counts.scopeActive = scopeByStatus.get(UserStatus.ACTIVE) || 0;
    counts.scopeSuspended = scopeByStatus.get(UserStatus.SUSPENDED) || 0;
    counts.scopeAdmins = scopeAdmins;
    return { items, total, page, pageSize, counts };
  }

  async options(user: RequestUser) {
    this.assertAdmin(user);
    const isSuper = user.roles.includes('SUPER_ADMIN');
    return {
      roles: await this.prisma.role.findMany({ where: { name: { in: MANAGED_ROLES.filter((role) => isSuper || role !== 'SUPER_ADMIN') } }, select: { name: true }, orderBy: { name: 'asc' } }),
      tenants: await this.prisma.tenant.findMany({ where: isSuper ? { isActive: true } : { id: user.tenantId || '', isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
    };
  }

  private async scopedTarget(user: RequestUser, id: string, db: Prisma.TransactionClient) {
    const target = await db.user.findFirst({ where: { id, ...(user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: user.tenantId }) }, select: publicUser });
    if (!target) throw new NotFoundException('User not found.');
    if (!user.roles.includes('SUPER_ADMIN') && target.roles.some((row) => row.role.name === 'SUPER_ADMIN')) throw new ForbiddenException('Company administrators cannot manage platform administrators.');
    return target;
  }

  private async assignedRoles(user: RequestUser, names: string[], db: Prisma.TransactionClient) {
    if (!names.length || new Set(names).size !== names.length || names.some((name) => !MANAGED_ROLES.includes(name))) throw new BadRequestException('Select valid workflow roles.');
    if (!user.roles.includes('SUPER_ADMIN') && names.includes('SUPER_ADMIN')) throw new ForbiddenException('Only a Super Admin can assign the Super Admin role.');
    const roles = await db.role.findMany({ where: { name: { in: names } }, select: { id: true, name: true } });
    if (roles.length !== names.length) throw new BadRequestException('A selected role is not configured. Contact the platform administrator.');
    return roles;
  }

  private async passwordHash(password: string) {
    const policyError = passwordPolicyError(password);
    if (policyError) throw new BadRequestException(policyError);
    return bcrypt.hash(password, 12);
  }

  private duplicateEmail(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('An account with that email address already exists.');
    throw error;
  }

  async create(user: RequestUser, dto: CreateUserDto) {
    this.assertAdmin(user);
    if (!user.roles.includes('SUPER_ADMIN') && dto.tenantId && dto.tenantId !== user.tenantId) throw new ForbiddenException('You can only create users for your own company.');
    const tenantId = user.roles.includes('SUPER_ADMIN') ? dto.tenantId : user.tenantId;
    if (!tenantId) throw new BadRequestException('Select a company for this account.');
    const passwordHash = await this.passwordHash(dto.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await tx.tenant.findFirst({ where: { id: tenantId, isActive: true } }))) throw new BadRequestException('Company is not active or does not exist.');
        const roles = await this.assignedRoles(user, dto.roles, tx);
        const created = await tx.user.create({ data: {
          tenantId, email: dto.email.trim().toLowerCase(), firstName: dto.firstName.trim(), lastName: dto.lastName.trim(),
          passwordHash, status: 'ACTIVE', roles: { create: roles.map((role) => ({ roleId: role.id })) }
        }, select: publicUser });
        await tx.auditLog.create({ data: { tenantId, actorId: user.id, action: 'CREATE', entityType: 'User', entityId: created.id, metadata: { roles: dto.roles } } });
        return created;
      });
    } catch (error) { this.duplicateEmail(error); }
  }

  async update(user: RequestUser, id: string, dto: UpdateUserDto) {
    this.assertAdmin(user);
    const original = await this.scopedTarget(user, id, this.prisma);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize company admin changes, including last-admin protection.
        if (original.tenantId) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Tenant" WHERE id = ${original.tenantId} FOR UPDATE`);
        const target = await this.scopedTarget(user, id, tx);
        const previous = target.roles.map((row) => row.role.name).sort();
        const roles = await this.assignedRoles(user, dto.roles, tx);
        if (id === user.id && (dto.status !== 'ACTIVE' || JSON.stringify([...dto.roles].sort()) !== JSON.stringify(previous))) throw new BadRequestException('You cannot suspend your own account or change your own roles.');
        if (target.tenantId && target.status === 'ACTIVE' && previous.includes('COMPANY_ADMIN') && (dto.status !== 'ACTIVE' || !dto.roles.includes('COMPANY_ADMIN'))) {
          const remaining = await tx.user.count({ where: { tenantId: target.tenantId, id: { not: id }, status: 'ACTIVE', roles: { some: { role: { name: 'COMPANY_ADMIN' } } } } });
          if (!remaining) throw new BadRequestException('Keep at least one active Company Admin for this company.');
        }
        if (previous.includes('SUPER_ADMIN') && (dto.status !== 'ACTIVE' || !dto.roles.includes('SUPER_ADMIN'))) throw new BadRequestException('Platform administrator removal is protected.');
        await tx.userRole.deleteMany({ where: { userId: id } });
        const updated = await tx.user.update({ where: { id }, data: {
          email: dto.email.trim().toLowerCase(), firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), status: dto.status,
          // Suspending a user ends their signed-in sessions immediately.
          ...(dto.status === 'SUSPENDED' && target.status !== 'SUSPENDED' ? { sessionVersion: { increment: 1 } } : {}),
          roles: { create: roles.map((role) => ({ roleId: role.id })) }
        }, select: publicUser });
        await tx.auditLog.create({ data: { tenantId: target.tenantId, actorId: user.id, action: 'UPDATE', entityType: 'User', entityId: id, metadata: { roles: dto.roles, status: dto.status } } });
        return updated;
      });
    } catch (error) { this.duplicateEmail(error); }
  }

  // Delete is only for accounts that never did workflow work (for example a mistaken or test account). Anyone who
  // prepared, reviewed or approved something keeps their account for the audit trail and should be suspended instead.
  async remove(user: RequestUser, id: string) {
    this.assertAdmin(user);
    if (id === user.id) throw new BadRequestException('You cannot delete your own account.');
    await this.scopedTarget(user, id, this.prisma);
    return this.prisma.$transaction(async (tx) => {
      const target = await this.scopedTarget(user, id, tx);
      if (target.tenantId) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Tenant" WHERE id = ${target.tenantId} FOR UPDATE`);
      const roleNames = target.roles.map((row) => row.role.name);
      if (roleNames.includes('SUPER_ADMIN')) throw new BadRequestException('Platform administrator removal is protected.');
      if (target.tenantId && target.status === 'ACTIVE' && roleNames.includes('COMPANY_ADMIN')) {
        const remaining = await tx.user.count({ where: { tenantId: target.tenantId, id: { not: id }, status: 'ACTIVE', roles: { some: { role: { name: 'COMPANY_ADMIN' } } } } });
        if (!remaining) throw new BadRequestException('Keep at least one active Company Admin for this company.');
      }
      const work = await tx.user.findUniqueOrThrow({ where: { id }, select: { _count: { select: {
        createdEnquiries: true, enquiryComments: true, enquiryStatusHistory: true, createdCases: true, assignedCases: true,
        uploadedDocuments: true, comments: true, statusHistory: true, createdKycForms: true, updatedKycForms: true,
        assignedReviewTasks: true, submittedInternalReviews: true, reviewerComments: true, uploadedSignedKycDocuments: true,
        riskReclassifications: true, createdClientEngagements: true, uploadedClientDocuments: true, performedClientScreenings: true,
        requestedClientRiskChanges: true, decidedClientRiskChanges: true, startedClientReviews: true, completedClientReviews: true
      } } } });
      const recorded = Object.values(work._count).reduce((sum, count) => sum + count, 0);
      if (recorded) {
        throw new BadRequestException(`${target.firstName} ${target.lastName} has work recorded in the system (${recorded} item${recorded === 1 ? '' : 's'} such as enquiries, KYC reviews or comments), so the account cannot be deleted without losing the audit trail. Use Edit and set the status to Suspended instead - they will no longer be able to sign in.`);
      }
      await tx.auditLog.create({ data: { tenantId: target.tenantId, actorId: user.id, action: 'DELETE', entityType: 'User', entityId: id, metadata: { email: target.email, roles: roleNames } } });
      await tx.user.delete({ where: { id } });
      return { id };
    });
  }

  async resetPassword(user: RequestUser, id: string, dto: ResetUserPasswordDto) {
    this.assertAdmin(user);
    await this.scopedTarget(user, id, this.prisma);
    const passwordHash = await this.passwordHash(dto.password);
    await this.prisma.$transaction(async (tx) => {
      const target = await this.scopedTarget(user, id, tx);
      // A reset ends all existing sessions and clears any sign-in lockout.
      await tx.user.update({ where: { id }, data: { passwordHash, sessionVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null } });
      await tx.auditLog.create({ data: { tenantId: target.tenantId, actorId: user.id, action: 'UPDATE', entityType: 'User', entityId: id, metadata: { event: 'ADMIN_PASSWORD_RESET' } } });
    });
    return { success: true };
  }
}
