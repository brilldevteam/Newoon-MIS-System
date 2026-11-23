import { Module } from '@nestjs/common';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';
import { KycModule } from '../kyc/kyc.module';
import { ClientIdentityDocumentsController } from './client-identity-documents.controller';
import { ClientLegalDocumentsController, LegalDocumentsAccessGuard } from './client-legal-documents.controller';
import { ClientLegalDocumentsService } from './client-legal-documents.service';
import { DocumentReaderService } from './document-reader.service';
import { ComplianceClientsController } from './compliance-clients.controller';
import { ComplianceClientsService } from './compliance-clients.service';
import { ComplianceDocumentsController } from './compliance-documents.controller';
import { ComplianceDocumentsService } from './compliance-documents.service';
import { ComplianceMonitoringController, ComplianceRemindersController } from './compliance-monitoring.controller';
import { ComplianceMonitoringService } from './compliance-monitoring.service';
import { ComplianceRemindersService } from './compliance-reminders.service';
import { IdDocumentReaderService } from './id-document-reader.service';

@Module({
  imports: [KycModule, AiSettingsModule],
  controllers: [ComplianceClientsController, ComplianceDocumentsController, ComplianceMonitoringController, ComplianceRemindersController, ClientLegalDocumentsController, ClientIdentityDocumentsController],
  providers: [
    ComplianceClientsService, ComplianceDocumentsService, ComplianceMonitoringService, ComplianceRemindersService, IdDocumentReaderService,
    ClientLegalDocumentsService, DocumentReaderService, LegalDocumentsAccessGuard
  ]
})
export class ComplianceClientsModule {}
