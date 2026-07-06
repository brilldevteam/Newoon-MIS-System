import { Module } from '@nestjs/common';
import { TenantModulesController } from './tenant-modules.controller';
import { TenantModulesService } from './tenant-modules.service';

@Module({
  controllers: [TenantModulesController],
  providers: [TenantModulesService],
  exports: [TenantModulesService]
})
export class TenantModulesModule {}
