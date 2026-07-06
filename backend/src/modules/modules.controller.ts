import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ModulesService } from './modules.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Roles('SUPER_ADMIN')
  @Get()
  findAll() {
    return this.modulesService.findAll();
  }
}
