import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CrrfController, CrrfListController } from './crrf.controller';
import { CrrfService } from './crrf.service';

@Module({
  imports: [PrismaModule],
  controllers: [CrrfController, CrrfListController],
  providers: [CrrfService]
})
export class CrrfModule {}
