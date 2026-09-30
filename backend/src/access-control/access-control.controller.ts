import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { AccessControlService, AccessLevel } from './access-control.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('access-control')
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Roles('SUPER_ADMIN')
  @Get()
  matrix() {
    return this.accessControlService.getMatrix();
  }

  @Get('me')
  mine(@CurrentUser() user: RequestUser) {
    return this.accessControlService.effectivePermissions(user.roles);
  }

  @Roles('SUPER_ADMIN')
  @Put('roles/:roleName')
  update(@Param('roleName') roleName: string, @Body() body: { levels?: Record<string, AccessLevel> }) {
    return this.accessControlService.updateRole(roleName, body.levels || {});
  }
}
