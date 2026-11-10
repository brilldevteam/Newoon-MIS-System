import { Injectable } from '@nestjs/common';
import { userSummarySelect } from '../common/user-summary';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  // Access is granted through the role matrix; only Super Admin sees audit logs across companies.
  findAll(user: RequestUser) {
    return this.prisma.auditLog.findMany({
      where: user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: user.tenantId || '' },
      include: { actor: { select: userSummarySelect }, tenant: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }
}
