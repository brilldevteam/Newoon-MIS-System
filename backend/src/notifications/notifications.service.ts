import { Injectable } from '@nestjs/common';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser) {
    return this.prisma.notification.findMany({
      where: user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: user.tenantId || '' },
      orderBy: { createdAt: 'desc' }
    });
  }
}
