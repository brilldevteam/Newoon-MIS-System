import { Injectable } from '@nestjs/common';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser) {
    return this.prisma.document.findMany({
      where: user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: user.tenantId || '' },
      orderBy: { createdAt: 'desc' }
    });
  }
}
