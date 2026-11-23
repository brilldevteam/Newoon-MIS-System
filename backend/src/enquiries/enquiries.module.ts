import { Module } from '@nestjs/common';
import { EnquiriesController } from './enquiries.controller';
import { EnquiriesService } from './enquiries.service';
import { KycPdfRenderer } from '../kyc/export/kyc-pdf-renderer';
import { IdDocumentReaderModule } from '../compliance-clients/id-document-reader.module';

@Module({
  imports: [IdDocumentReaderModule],
  controllers: [EnquiriesController],
  providers: [EnquiriesService, KycPdfRenderer]
})
export class EnquiriesModule {}
