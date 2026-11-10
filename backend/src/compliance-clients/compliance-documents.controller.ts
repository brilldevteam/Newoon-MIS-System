import { Body, Controller, Get, Param, Patch, Post, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { safeResponseFileName, standardDocumentKinds, uploadInterceptorOptions } from '../common/security/upload-security';
import { RequestUser } from '../common/types/request-user.type';
import { ComplianceDocumentsService, UploadedClientFile } from './compliance-documents.service';
import { CreateDocumentSectionDto, DeleteClientDocumentDto, UpdateDocumentSectionDto, UploadClientDocumentDto } from './dto/client-document.dto';

// Client document folders. Access follows the "compliance" area (RolesGuard): GET needs view, everything else edit.
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('compliance/clients/:clientId')
export class ComplianceDocumentsController {
  constructor(private readonly documentsService: ComplianceDocumentsService) {}

  @Get('documents')
  list(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string) {
    return this.documentsService.listClientDocuments(user, clientId);
  }

  @Post('documents')
  @UseInterceptors(FilesInterceptor('files', 20, uploadInterceptorOptions(standardDocumentKinds)))
  upload(
    @CurrentUser() user: RequestUser,
    @Param('clientId') clientId: string,
    @Body() dto: UploadClientDocumentDto,
    @UploadedFiles() files: UploadedClientFile[]
  ) {
    return this.documentsService.upload(user, clientId, dto, files || []);
  }

  @Get('documents/:documentId/view')
  async view(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('documentId') documentId: string, @Res() response: Response) {
    const file = await this.documentsService.getFile(user, clientId, documentId);
    response.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeResponseFileName(file.fileName)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(file.content);
  }

  // POST rather than DELETE so the reason travels in a normal JSON body.
  @Post('documents/:documentId/delete')
  remove(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('documentId') documentId: string, @Body() dto: DeleteClientDocumentDto) {
    return this.documentsService.remove(user, clientId, documentId, dto.reason);
  }

  @Post('document-sections')
  createSection(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Body() dto: CreateDocumentSectionDto) {
    return this.documentsService.createSection(user, clientId, dto);
  }

  @Patch('document-sections/:sectionId')
  updateSection(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('sectionId') sectionId: string, @Body() dto: UpdateDocumentSectionDto) {
    return this.documentsService.updateSection(user, clientId, sectionId, dto);
  }
}
