import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AssignTenantModuleDto } from './dto/assign-tenant-module.dto';
import { TenantModulesService } from './tenant-modules.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tenant-modules')
export class TenantModulesController {
  constructor(private readonly tenantModulesService: TenantModulesService) {}

  @Roles('SUPER_ADMIN')
  @Get(':tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.tenantModulesService.findByTenant(tenantId);
  }

  @Roles('SUPER_ADMIN')
  @Put()
  assign(@Body() dto: AssignTenantModuleDto) {
    return this.tenantModulesService.assign(dto);
  }
}
