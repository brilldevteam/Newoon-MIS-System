import { Module } from '@nestjs/common';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';
import { DocumentReaderService } from './document-reader.service';
import { IdDocumentReaderModule } from './id-document-reader.module';

// The company document reader (the company's AI service, or this server) shared by the legal documents register,
// the enquiry form and the KYC form. It reuses the single on-server OCR worker of the passport / QID reader.
@Module({
  imports: [AiSettingsModule, IdDocumentReaderModule],
  providers: [DocumentReaderService],
  exports: [DocumentReaderService, IdDocumentReaderModule]
})
export class DocumentReaderModule {}
