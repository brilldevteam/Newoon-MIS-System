import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { ScreeningService } from './screening.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('kyc/:kycCaseId/screening')
export class ScreeningController {
  constructor(private readonly screeningService: ScreeningService) {}

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get('context')
  getContext(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string) {
    return this.screeningService.getContext(user, kycCaseId);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post('records')
  createRecord(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string, @Body() dto: Record<string, unknown>) {
    return this.screeningService.createRecord(user, kycCaseId, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch('records/:recordId')
  updateRecord(
    @CurrentUser() user: RequestUser,
    @Param('kycCaseId') kycCaseId: string,
    @Param('recordId') recordId: string,
    @Body() dto: Record<string, unknown>
  ) {
    return this.screeningService.updateRecord(user, kycCaseId, recordId, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post('records/:recordId/complete')
  completeRecord(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string, @Param('recordId') recordId: string) {
    return this.screeningService.completeRecord(user, kycCaseId, recordId);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Delete('records/:recordId')
  deleteRecord(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string, @Param('recordId') recordId: string) {
    return this.screeningService.deleteRecord(user, kycCaseId, recordId);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post('merged-documents/upload')
  @UseInterceptors(FilesInterceptor('files', 20))
  uploadMergedDocuments(
    @CurrentUser() user: RequestUser,
    @Param('kycCaseId') kycCaseId: string,
    @Body() dto: Record<string, unknown>,
    @UploadedFiles() files: Array<{ originalname: string; mimetype?: string; size?: number; buffer: Buffer }>
  ) {
    return this.screeningService.uploadMergedDocuments(user, kycCaseId, dto, files || []);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch('merged-checks/:checkType')
  updateMergedCheck(
    @CurrentUser() user: RequestUser,
    @Param('kycCaseId') kycCaseId: string,
    @Param('checkType') checkType: string,
    @Body() dto: Record<string, unknown>
  ) {
    return this.screeningService.updateMergedCheck(user, kycCaseId, checkType, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get('merged-documents/:documentId/view')
  async viewMergedDocument(
    @CurrentUser() user: RequestUser,
    @Param('kycCaseId') kycCaseId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response
  ) {
    const document = await this.screeningService.getMergedDocumentFile(user, kycCaseId, documentId);
    response.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
    response.send(document.content);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Delete('merged-documents/:documentId')
  deleteMergedDocument(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string, @Param('documentId') documentId: string) {
    return this.screeningService.deleteMergedDocument(user, kycCaseId, documentId);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post('records/:recordId/documents/upload')
  @UseInterceptors(FilesInterceptor('files', 20))
  uploadDocuments(
    @CurrentUser() user: RequestUser,
    @Param('kycCaseId') kycCaseId: string,
    @Param('recordId') recordId: string,
    @Body() dto: Record<string, unknown>,
    @UploadedFiles() files: Array<{ originalname: string; mimetype?: string; size?: number; buffer: Buffer }>
  ) {
    return this.screeningService.uploadDocuments(user, kycCaseId, recordId, dto, files || []);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get('documents/:documentId/view')
  async viewDocument(
    @CurrentUser() user: RequestUser,
    @Param('kycCaseId') kycCaseId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response
  ) {
    const document = await this.screeningService.getDocumentFile(user, kycCaseId, documentId);
    response.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
    response.send(document.content);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Delete('documents/:documentId')
  deleteDocument(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string, @Param('documentId') documentId: string) {
    return this.screeningService.deleteDocument(user, kycCaseId, documentId);
  }
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('screening')
export class ScreeningListController {
  constructor(private readonly screeningService: ScreeningService) {}

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get()
  listRecords(@CurrentUser() user: RequestUser) {
    return this.screeningService.listRecords(user);
  }
}
