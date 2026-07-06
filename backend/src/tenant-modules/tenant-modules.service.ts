import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTenantModuleDto } from './dto/assign-tenant-module.dto';

@Injectable()
export class TenantModulesService {
  constructor(private readonly prisma: PrismaService) {}

  findByTenant(tenantId: string) {
    return this.prisma.tenantModule.findMany({
      where: { tenantId },
      include: { module: true },
      orderBy: { module: { name: 'asc' } }
    });
  }

  assign(dto: AssignTenantModuleDto) {
    return this.prisma.tenantModule.upsert({
      where: {
        tenantId_moduleId: {
          tenantId: dto.tenantId,
          moduleId: dto.moduleId
        }
      },
      update: { isEnabled: dto.isEnabled },
      create: {
        tenantId: dto.tenantId,
        moduleId: dto.moduleId,
        isEnabled: dto.isEnabled
      },
      include: { module: true, tenant: true }
    });
  }
}
