import { Module } from '@nestjs/common';
import { DocumentReaderModule } from '../compliance-clients/document-reader.module';
import { KycPdfRenderer } from './export';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [DocumentReaderModule],
  controllers: [KycController],
  providers: [KycService, KycPdfRenderer],
  exports: [KycService]
})
export class KycModule {}
