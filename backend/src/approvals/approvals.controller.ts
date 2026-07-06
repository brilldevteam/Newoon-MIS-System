import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user.type';
import { ApprovalsService } from './approvals.service';

@UseGuards(AuthGuard('jwt'))
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.approvalsService.findAll(user);
  }
}
