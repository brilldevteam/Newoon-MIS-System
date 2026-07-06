import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, clients: true, tenantModules: true } }
      }
    });
  }

  findOne(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id },
      include: {
        users: true,
        tenantModules: { include: { module: true } }
      }
    });
  }

  create(dto: CreateTenantDto) {
    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug.toLowerCase(),
        isActive: dto.isActive ?? true
      }
    });
  }
}
