import { Injectable } from '@nestjs/common';
import { KycCaseStatus } from '@prisma/client';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: RequestUser) {
    const isSuperAdmin = user.roles.includes('SUPER_ADMIN');
    const tenantFilter = isSuperAdmin ? {} : { tenantId: user.tenantId || '' };

    const [
      totalTenants,
      totalClients,
      pendingKyc,
      pendingApprovals,
      enabledModules
    ] = await Promise.all([
      isSuperAdmin ? this.prisma.tenant.count() : Promise.resolve(1),
      this.prisma.client.count({ where: tenantFilter }),
      this.prisma.kycCase.count({
        where: {
          ...tenantFilter,
          status: {
            in: [
              KycCaseStatus.INQUIRY_RECEIVED,
              KycCaseStatus.PROPOSAL_OPTIONAL,
              KycCaseStatus.LEGAL_DOCUMENTS_PENDING,
              KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED
            ]
          }
        }
      }),
      this.prisma.approval.count({ where: { ...tenantFilter, status: 'PENDING' } }),
      this.prisma.tenantModule.count({
        where: { ...(isSuperAdmin ? {} : { tenantId: user.tenantId || '' }), isEnabled: true }
      })
    ]);

    return {
      totalTenants,
      totalClients,
      pendingKyc,
      pendingApprovals,
      enabledModules
    };
  }
}
