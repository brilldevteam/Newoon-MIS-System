import { Module } from '@nestjs/common';
import { EnquiriesController } from './enquiries.controller';
import { EnquiriesService } from './enquiries.service';
import { KycPdfRenderer } from '../kyc/export/kyc-pdf-renderer';
import { DocumentReaderModule } from '../compliance-clients/document-reader.module';

@Module({
  imports: [DocumentReaderModule],
  controllers: [EnquiriesController],
  providers: [EnquiriesService, KycPdfRenderer]
})
export class EnquiriesModule {}
