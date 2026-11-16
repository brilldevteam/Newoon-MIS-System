import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { AuditLogsService } from './audit-logs.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Roles('SUPER_ADMIN')
  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.auditLogsService.findAll(user);
  }
}
