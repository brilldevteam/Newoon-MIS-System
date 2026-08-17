import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser) {
    return this.prisma.notification.findMany({
      where: this.notificationWhere(user),
      include: {
        kycCase: { include: { client: true, service: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  async markRead(user: RequestUser, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, ...this.notificationWhere(user) }
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
      include: {
        kycCase: { include: { client: true, service: true } }
      }
    });
  }

  async markAllRead(user: RequestUser) {
    await this.prisma.notification.updateMany({
      where: { ...this.notificationWhere(user), isRead: false },
      data: { isRead: true }
    });

    return this.findAll(user);
  }

  private notificationWhere(user: RequestUser): Prisma.NotificationWhereInput {
    const tenantWhere = user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: user.tenantId || '' };
    const roleTypes = this.notificationTypesForUser(user);
    return {
      ...tenantWhere,
      ...(user.roles.includes('SUPER_ADMIN') || this.hasAnyRole(user, ['COMPANY_ADMIN'])
        ? {}
        : { OR: [{ recipientId: user.id }, { recipientId: null }] }),
      ...(roleTypes.length ? { type: { in: roleTypes } } : {})
    };
  }

  private notificationTypesForUser(user: RequestUser): NotificationType[] {
    if (this.hasAnyRole(user, ['SUPER_ADMIN', 'COMPANY_ADMIN'])) {
      return [];
    }

    const types = new Set<NotificationType>([NotificationType.GENERAL]);

    if (this.hasAnyRole(user, ['OPERATING_TEAM'])) {
      types.add(NotificationType.ADDITIONAL_INFORMATION_REQUESTED);
      types.add(NotificationType.CLIENT_READY_FOR_ACTIVATION);
      types.add(NotificationType.CLIENT_ACTIVATED);
    }

    if (this.hasAnyRole(user, ['AML_TEAM', 'AML_SUPERVISOR'])) {
      types.add(NotificationType.AML_CASE_SUBMITTED);
      types.add(NotificationType.SUPERVISOR_TASK_ASSIGNED);
      types.add(NotificationType.ADDITIONAL_INFORMATION_REQUESTED);
      types.add(NotificationType.RISK_CLASSIFICATION_CHANGED);
    }

    if (this.hasAnyRole(user, ['DMLRO'])) {
      types.add(NotificationType.DMLRO_TASK_ASSIGNED);
      types.add(NotificationType.ADDITIONAL_INFORMATION_REQUESTED);
    }

    if (this.hasAnyRole(user, ['MLRO'])) {
      types.add(NotificationType.MLRO_TASK_ASSIGNED);
      types.add(NotificationType.DMLRO_REVIEW_COMPLETED);
    }

    if (this.hasAnyRole(user, ['SEF'])) {
      types.add(NotificationType.SEF_TASK_ASSIGNED);
      types.add(NotificationType.MLRO_APPROVAL_COMPLETED);
      types.add(NotificationType.MLRO_APPROVAL_WITH_CONDITIONS);
    }

    return [...types];
  }

  private hasAnyRole(user: RequestUser, roles: string[]) {
    return user.roles.some((role) => roles.includes(role));
  }
}
