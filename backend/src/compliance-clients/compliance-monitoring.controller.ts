import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { standardDocumentKinds, uploadInterceptorOptions } from '../common/security/upload-security';
import { RequestUser } from '../common/types/request-user.type';
import { UploadedClientFile } from './compliance-documents.service';
import { ComplianceMonitoringService } from './compliance-monitoring.service';
import { ComplianceRemindersService } from './compliance-reminders.service';
import { CancelDto, CompleteReviewDto, CreateScreeningDto, DecideRiskChangeDto, RequestRiskChangeDto, SaveExpiryItemDto } from './dto/compliance-monitoring.dto';

// Ongoing monitoring of a compliance client. Access follows the "compliance" area (RolesGuard): GET needs view,
// other methods edit. Risk decisions additionally require the DMLRO/MLRO role in the service.
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('compliance/clients/:clientId')
export class ComplianceMonitoringController {
  constructor(private readonly monitoring: ComplianceMonitoringService) {}

  @Get('monitoring')
  overview(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string) {
    return this.monitoring.overview(user, clientId);
  }

  @Post('screenings')
  @UseInterceptors(FilesInterceptor('files', 20, uploadInterceptorOptions(standardDocumentKinds)))
  createScreening(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Body() dto: CreateScreeningDto, @UploadedFiles() files: UploadedClientFile[]) {
    return this.monitoring.createScreening(user, clientId, dto, files || []);
  }

  @Post('risk-changes')
  requestRiskChange(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Body() dto: RequestRiskChangeDto) {
    return this.monitoring.requestRiskChange(user, clientId, dto);
  }

  @Post('risk-changes/:changeId/decision')
  decideRiskChange(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('changeId') changeId: string, @Body() dto: DecideRiskChangeDto) {
    return this.monitoring.decideRiskChange(user, clientId, changeId, dto);
  }

  @Post('risk-changes/:changeId/cancel')
  cancelRiskChange(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('changeId') changeId: string) {
    return this.monitoring.cancelRiskChange(user, clientId, changeId);
  }

  @Post('reviews')
  startReview(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string) {
    return this.monitoring.startReview(user, clientId);
  }

  @Post('reviews/:reviewId/complete')
  completeReview(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('reviewId') reviewId: string, @Body() dto: CompleteReviewDto) {
    return this.monitoring.completeReview(user, clientId, reviewId, dto);
  }

  @Post('reviews/:reviewId/cancel')
  cancelReview(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('reviewId') reviewId: string, @Body() dto: CancelDto) {
    return this.monitoring.cancelReview(user, clientId, reviewId, dto.reason);
  }

  @Post('expiry-items')
  createExpiryItem(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Body() dto: SaveExpiryItemDto) {
    return this.monitoring.saveExpiryItem(user, clientId, dto);
  }

  @Patch('expiry-items/:itemId')
  updateExpiryItem(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('itemId') itemId: string, @Body() dto: SaveExpiryItemDto) {
    return this.monitoring.saveExpiryItem(user, clientId, dto, itemId);
  }
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('compliance/reminders')
export class ComplianceRemindersController {
  constructor(private readonly reminders: ComplianceRemindersService) {}

  // Manual run of the reminder sweep for the administrator's own company (the scheduled run covers all companies).
  @Post('run')
  run(@CurrentUser() user: RequestUser) {
    if (!user.roles.some((role) => ['COMPANY_ADMIN', 'SUPER_ADMIN'].includes(role))) {
      throw new ForbiddenException('Only administrators can run compliance reminders manually.');
    }
    if (!user.tenantId && !user.roles.includes('SUPER_ADMIN')) throw new ForbiddenException('User is not assigned to a tenant');
    return this.reminders.sweep(user.tenantId || undefined);
  }
}
