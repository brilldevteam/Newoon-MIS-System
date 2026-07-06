import { Injectable } from '@nestjs/common';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser) {
    const isSuperAdmin = user.roles.includes('SUPER_ADMIN');
    return this.prisma.user.findMany({
      where: isSuperAdmin ? {} : { tenantId: user.tenantId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        roles: { include: { role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
