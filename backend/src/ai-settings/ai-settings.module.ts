import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';

@Module({
  imports: [AccessControlModule],
  controllers: [AiSettingsController],
  providers: [AiSettingsService],
  exports: [AiSettingsService]
})
export class AiSettingsModule {}
