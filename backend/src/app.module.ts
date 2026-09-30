import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ModulesModule } from './modules/modules.module';
import { TenantModulesModule } from './tenant-modules/tenant-modules.module';
import { ClientsModule } from './clients/clients.module';
import { EnquiriesModule } from './enquiries/enquiries.module';
import { KycModule } from './kyc/kyc.module';
import { DocumentsModule } from './documents/documents.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ScreeningModule } from './screening/screening.module';
import { CrrfModule } from './crrf/crrf.module';
import { AccessControlModule } from './access-control/access-control.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    RolesModule,
    PermissionsModule,
    ModulesModule,
    TenantModulesModule,
    ClientsModule,
    EnquiriesModule,
    KycModule,
    DocumentsModule,
    ApprovalsModule,
    NotificationsModule,
    AuditLogsModule,
    DashboardModule,
    ScreeningModule,
    CrrfModule,
    AccessControlModule
  ],
  controllers: [AppController]
})
export class AppModule {}
