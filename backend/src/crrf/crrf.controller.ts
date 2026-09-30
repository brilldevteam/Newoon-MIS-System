import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { crrfDocumentKinds, safeResponseFileName, uploadInterceptorOptions } from '../common/security/upload-security';
import { RequestUser } from '../common/types/request-user.type';
import { CrrfService } from './crrf.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('kyc/:kycCaseId/crrf')
export class CrrfController {
  constructor(private readonly crrfService: CrrfService) {}

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get()
  getWorkspace(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string) {
    return this.crrfService.getWorkspace(user, kycCaseId);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch()
  saveWorkspace(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string, @Body() dto: Record<string, unknown>) {
    return this.crrfService.saveWorkspace(user, kycCaseId, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post('documents/upload')
  @UseInterceptors(FilesInterceptor('files', 20, uploadInterceptorOptions(crrfDocumentKinds)))
  uploadDocuments(
    @CurrentUser() user: RequestUser,
    @Param('kycCaseId') kycCaseId: string,
    @UploadedFiles() files: Array<{ originalname: string; mimetype?: string; size?: number; buffer: Buffer }>
  ) {
    return this.crrfService.uploadDocuments(user, kycCaseId, files || []);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get('documents/:documentId/view')
  async viewDocument(
    @CurrentUser() user: RequestUser,
    @Param('kycCaseId') kycCaseId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response
  ) {
    const document = await this.crrfService.getDocumentFile(user, kycCaseId, documentId);
    response.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeResponseFileName(document.fileName)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(document.content);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Delete('documents/:documentId')
  deleteDocument(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string, @Param('documentId') documentId: string) {
    return this.crrfService.deleteDocument(user, kycCaseId, documentId);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get('export/excel')
  async exportExcel(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string, @Res() response: Response) {
    const exportFile = await this.crrfService.exportExcel(user, kycCaseId);
    response.setHeader('Content-Type', exportFile.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${exportFile.fileName}"`);
    response.send(exportFile.content);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get('export/pdf')
  async exportPdf(@CurrentUser() user: RequestUser, @Param('kycCaseId') kycCaseId: string, @Res() response: Response) {
    const exportFile = await this.crrfService.exportPdf(user, kycCaseId);
    response.setHeader('Content-Type', exportFile.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${exportFile.fileName}"`);
    response.send(exportFile.content);
  }
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('crrf')
export class CrrfListController {
  constructor(private readonly crrfService: CrrfService) {}

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get()
  listRecords(@CurrentUser() user: RequestUser) {
    return this.crrfService.listRecords(user);
  }
}
