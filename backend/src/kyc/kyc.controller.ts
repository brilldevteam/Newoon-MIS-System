import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { KycGeneratedDocumentType, ReviewStage } from '@prisma/client';
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

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get('review/tasks')
  getMyReviewTasks(@CurrentUser() user: RequestUser) {
    return this.kycService.getMyReviewTasks(user);
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

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/form')
  createForm(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.createForm(user, id);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Get(':id/form')
  getForm(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.getForm(user, id);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/form/autosave')
  autoSaveForm(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.autoSaveForm(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/form/section-a')
  saveSectionA(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveSectionA(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/form/section-b')
  saveSectionB(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveOwnership(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/form/section-c')
  saveSectionC(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveManagers(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/form/section-d')
  saveSectionD(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveSectionD(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/form/section-e')
  saveSectionE(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveSectionE(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/form/section-f')
  saveSectionF(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveRequiredDocuments(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/form/section-g')
  saveSectionG(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveSectionG(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/form/section-h')
  saveSectionH(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.saveInternalReview(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/form/generate-docx')
  generateDocx(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.generateDocument(user, id, KycGeneratedDocumentType.DOCX);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/form/generate-pdf')
  generatePdf(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.generateDocument(user, id, KycGeneratedDocumentType.PDF);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
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

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/service')
  assignService(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: AssignServiceDto) {
    return this.kycService.assignService(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/proposal-status')
  updateProposalStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateProposalStatusDto
  ) {
    return this.kycService.updateProposalStatus(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/legal-documents')
  uploadLegalDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UploadLegalDocumentDto
  ) {
    return this.kycService.uploadLegalDocument(user, id, dto);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/legal-documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadLegalDocumentFile(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('documentType') documentType: string,
    @UploadedFile() file: { originalname: string; mimetype?: string; size: number; buffer?: Buffer }
  ) {
    return this.kycService.uploadLegalDocumentFile(user, id, documentType, file);
  }

  @Get(':id/legal-documents/:documentId/view')
  async viewLegalDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() response: Response
  ) {
    const document = await this.kycService.getLegalDocumentFile(user, id, documentId);
    response.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    response.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
    response.send(document.content);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Delete(':id/legal-documents/:documentId')
  deleteLegalDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string
  ) {
    return this.kycService.deleteLegalDocument(user, id, documentId);
  }

  @Roles('AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/submit-to-aml')
  submitToAml(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.submitToAml(user, id);
  }

  @Roles('AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/start-aml-review')
  startAmlReview(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.startAmlReview(user, id);
  }

  @Get(':id/internal-reviews')
  getInternalReviewWorkspace(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.getInternalReviewWorkspace(user, id);
  }

  @Roles('AML_SUPERVISOR', 'AML_TEAM', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/internal-reviews/:stage/start')
  startInternalReview(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('stage') stage: ReviewStage) {
    return this.kycService.startReviewStage(user, id, stage);
  }

  @Roles('AML_SUPERVISOR', 'AML_TEAM', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/internal-reviews/:stage/draft')
  saveInternalReviewDraft(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('stage') stage: ReviewStage,
    @Body() dto: Record<string, unknown>
  ) {
    return this.kycService.saveReviewDraft(user, id, stage, dto);
  }

  @Roles('AML_SUPERVISOR', 'AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/internal-reviews/supervisor/submit')
  submitSupervisorReview(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.submitSupervisorReview(user, id, dto);
  }

  @Roles('DMLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/internal-reviews/dmlro/submit')
  submitDmlroReview(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.submitDmlroReview(user, id, dto);
  }

  @Roles('MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/internal-reviews/mlro/decision')
  decideMlroReview(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.decideMlroReview(user, id, dto);
  }

  @Roles('SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/internal-reviews/sef/decision')
  decideSefReview(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.decideSefReview(user, id, dto);
  }

  @Roles('AML_SUPERVISOR', 'AML_TEAM', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/internal-reviews/:stage/comments')
  addReviewerComment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('stage') stage: ReviewStage,
    @Body() dto: Record<string, unknown>
  ) {
    return this.kycService.addReviewerComment(user, id, stage, dto);
  }

  @Roles('DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/internal-reviews/signed-documents')
  uploadSignedKycDocument(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.kycService.uploadSignedKycDocument(user, id, dto);
  }

  @Roles('DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/internal-reviews/signed-documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadSignedKycDocumentFile(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('reviewStage') reviewStage: string,
    @UploadedFile() file?: { originalname: string; mimetype?: string; size: number; buffer?: Buffer }
  ) {
    return this.kycService.uploadSignedKycDocumentFile(user, id, reviewStage, file);
  }

  @Get(':id/activation-readiness')
  activationReadiness(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kycService.recalculateActivationReadiness(user, id);
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
