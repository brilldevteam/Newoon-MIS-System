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
      openEnquiries,
      pendingKyc,
      pendingApprovals,
      approvedKyc,
      enabledModules
    ] = await Promise.all([
      isSuperAdmin ? this.prisma.tenant.count() : Promise.resolve(1),
      this.prisma.client.count({ where: tenantFilter }),
      this.prisma.enquiry.count({ where: { ...tenantFilter, status: { in: ['DRAFT', 'SUBMITTED_TO_AML_SUPERVISOR', 'RETURNED_TO_BD', 'READY_FOR_KYC'] } } }),
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
      this.prisma.kycCase.count({
        where: {
          ...tenantFilter,
          status: { in: [KycCaseStatus.SUPERVISOR_REVIEW_PENDING, KycCaseStatus.DMLRO_REVIEW_PENDING, KycCaseStatus.MLRO_REVIEW_PENDING, KycCaseStatus.SEF_DECISION_PENDING] }
        }
      }),
      this.prisma.kycCase.count({
        where: { ...tenantFilter, status: { in: [KycCaseStatus.KYC_FINAL_APPROVED, KycCaseStatus.CLIENT_ACTIVATION_PENDING, KycCaseStatus.CLIENT_ACTIVE] } }
      }),
      this.prisma.tenantModule.count({
        where: { ...(isSuperAdmin ? {} : { tenantId: user.tenantId || '' }), isEnabled: true }
      })
    ]);

    return {
      totalTenants,
      totalClients,
      openEnquiries,
      pendingKyc,
      pendingApprovals,
      approvedKyc,
      enabledModules
    };
  }
}
