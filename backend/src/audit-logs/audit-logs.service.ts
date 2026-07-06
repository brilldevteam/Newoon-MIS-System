import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.auditLog.findMany({
      include: { actor: true, tenant: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }
}
