import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, MANAGED_ROLES, ResetUserPasswordDto, UpdateUserDto } from './dto/manage-user.dto';

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
    if (password.length < 16 || Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('Passwords must contain at least 16 characters and no more than 72 UTF-8 bytes.');
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
          roles: { create: roles.map((role) => ({ roleId: role.id })) }
        }, select: publicUser });
        await tx.auditLog.create({ data: { tenantId: target.tenantId, actorId: user.id, action: 'UPDATE', entityType: 'User', entityId: id, metadata: { roles: dto.roles, status: dto.status } } });
        return updated;
      });
    } catch (error) { this.duplicateEmail(error); }
  }

  async resetPassword(user: RequestUser, id: string, dto: ResetUserPasswordDto) {
    this.assertAdmin(user);
    await this.scopedTarget(user, id, this.prisma);
    const passwordHash = await this.passwordHash(dto.password);
    await this.prisma.$transaction(async (tx) => {
      const target = await this.scopedTarget(user, id, tx);
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.auditLog.create({ data: { tenantId: target.tenantId, actorId: user.id, action: 'UPDATE', entityType: 'User', entityId: id, metadata: { event: 'ADMIN_PASSWORD_RESET' } } });
    });
    return { success: true };
  }
}
