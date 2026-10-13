import { Module } from '@nestjs/common';
import { KycPdfRenderer } from './export';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  controllers: [KycController],
  providers: [KycService, KycPdfRenderer]
})
export class KycModule {}
