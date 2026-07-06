import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { KycGeneratedDocumentType } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { AddWorkflowCommentDto } from './dto/add-workflow-comment.dto';
import { AssignServiceDto } from './dto/assign-service.dto';
import { CreateKycCaseDto } from './dto/create-kyc-case.dto';
import { UpdateKycCaseDto } from './dto/update-kyc-case.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';
import { UploadLegalDocumentDto } from './dto/upload-legal-document.dto';
import { KycService } from './kyc.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.kycService.findAll(user);
  }

  @Roles('OPERATING_TEAM', 'COMPANY_ADMIN')
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateKycCaseDto) {
    return this.kycService.create(user, dto);
  }

  @Roles('AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get('aml/notifications')
  getPendingAmlNotifications(@CurrentUser() user: RequestUser) {
    return this.kycService.getPendingAmlNotifications(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.findOne(user, id);
  }

  @Roles('OPERATING_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateKycCaseDto) {
    return this.kycService.update(user, id, dto);
  }

  @Roles('OPERATING_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.remove(user, id);
  }

  @Post(':id/form')
  createForm(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.createForm(user, id);
  }

  @Get(':id/form')
  getForm(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.getForm(user, id);
  }

  @Patch(':id/form/autosave')
  autoSaveForm(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.autoSaveForm(user, id, dto);
  }

  @Patch(':id/form/section-a')
  saveSectionA(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveSectionA(user, id, dto);
  }

  @Patch(':id/form/section-b')
  saveSectionB(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveOwnership(user, id, dto);
  }

  @Patch(':id/form/section-c')
  saveSectionC(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveManagers(user, id, dto);
  }

  @Patch(':id/form/section-d')
  saveSectionD(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveSectionD(user, id, dto);
  }

  @Patch(':id/form/section-e')
  saveSectionE(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveSectionE(user, id, dto);
  }

  @Patch(':id/form/section-f')
  saveSectionF(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveRequiredDocuments(user, id, dto);
  }

  @Patch(':id/form/section-g')
  saveSectionG(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveSectionG(user, id, dto);
  }

  @Patch(':id/form/section-h')
  saveSectionH(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveInternalReview(user, id, dto);
  }

  @Post(':id/form/generate-docx')
  generateDocx(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.generateDocument(user, id, KycGeneratedDocumentType.DOCX);
  }

  @Post(':id/form/generate-pdf')
  generatePdf(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.generateDocument(user, id, KycGeneratedDocumentType.PDF);
  }

  @Get(':id/form/generated-documents/:documentId/download')
  async downloadGeneratedDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() response: Response
  ) {
    const document = await this.kycService.downloadGeneratedDocument(user, id, documentId);
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    response.send(Buffer.from(document.content));
  }

  @Roles('OPERATING_TEAM', 'COMPANY_ADMIN')
  @Patch(':id/service')
  assignService(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: AssignServiceDto) {
    return this.kycService.assignService(user, id, dto);
  }

  @Roles('OPERATING_TEAM', 'COMPANY_ADMIN')
  @Patch(':id/proposal-status')
  updateProposalStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateProposalStatusDto
  ) {
    return this.kycService.updateProposalStatus(user, id, dto);
  }

  @Roles('OPERATING_TEAM', 'COMPANY_ADMIN')
  @Post(':id/legal-documents')
  uploadLegalDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UploadLegalDocumentDto
  ) {
    return this.kycService.uploadLegalDocument(user, id, dto);
  }

  @Roles('OPERATING_TEAM', 'COMPANY_ADMIN')
  @Post(':id/submit-to-aml')
  submitToAml(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.submitToAml(user, id);
  }

  @Roles('AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/start-aml-review')
  startAmlReview(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.startAmlReview(user, id);
  }

  @Post(':id/comments')
  addComment(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: AddWorkflowCommentDto) {
    return this.kycService.addComment(user, id, dto);
  }

  @Get(':id/timeline')
  getTimeline(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.getTimeline(user, id);
  }
}
