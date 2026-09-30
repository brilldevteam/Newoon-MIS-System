import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScreeningController, ScreeningListController } from './screening.controller';
import { ScreeningService } from './screening.service';

@Module({
  imports: [PrismaModule],
  controllers: [ScreeningController, ScreeningListController],
  providers: [ScreeningService]
})
export class ScreeningModule {}
