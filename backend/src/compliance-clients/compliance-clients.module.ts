import { Module } from '@nestjs/common';
import { KycModule } from '../kyc/kyc.module';
import { ComplianceClientsController } from './compliance-clients.controller';
import { ComplianceClientsService } from './compliance-clients.service';
import { ComplianceDocumentsController } from './compliance-documents.controller';
import { ComplianceDocumentsService } from './compliance-documents.service';
import { ComplianceMonitoringController, ComplianceRemindersController } from './compliance-monitoring.controller';
import { ComplianceMonitoringService } from './compliance-monitoring.service';
import { ComplianceRemindersService } from './compliance-reminders.service';

@Module({
  imports: [KycModule],
  controllers: [ComplianceClientsController, ComplianceDocumentsController, ComplianceMonitoringController, ComplianceRemindersController],
  providers: [ComplianceClientsService, ComplianceDocumentsService, ComplianceMonitoringService, ComplianceRemindersService]
})
export class ComplianceClientsModule {}
