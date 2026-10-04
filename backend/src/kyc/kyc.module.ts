import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { AiModule } from '../ai/ai.module';

@Module({
  controllers: [KycController],
  imports: [AiModule],
  providers: [KycService]
})
export class KycModule {}
