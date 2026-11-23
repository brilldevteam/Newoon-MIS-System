import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Param, Patch, Post, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AccessControlService } from '../access-control/access-control.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { safeResponseFileName, standardDocumentKinds, uploadInterceptorOptions } from '../common/security/upload-security';
import { RequestUser } from '../common/types/request-user.type';
import { ClientLegalDocumentsService } from './client-legal-documents.service';
import { UploadedClientFile } from './compliance-documents.service';
import { CreateLegalDocumentDto, LegalDocumentFieldsDto, ReadLegalDocumentDto, RemoveLegalDocumentDto } from './dto/legal-document.dto';

// Reading the register follows compliance View. Adding, replacing, editing and removing documents needs compliance
// Edit or clients Edit: Operations replaces legal documents (the AML team is notified of every change).
@Injectable()
export class LegalDocumentsAccessGuard implements CanActivate {
  constructor(private readonly accessControl: AccessControlService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser; method: string }>();
    const roles = request.user?.roles || [];
    const write = request.method !== 'GET';
    const allows = async (area: string) => (await this.accessControl.allows(roles, area, write)) ?? this.accessControl.allowsByDefault(roles, area, write);
    if (await allows('compliance')) return true;
    return write ? allows('clients') : false;
  }
}

@UseGuards(AuthGuard('jwt'), LegalDocumentsAccessGuard)
@Controller('compliance/clients/:clientId/legal-documents')
export class ClientLegalDocumentsController {
  constructor(private readonly documents: ClientLegalDocumentsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string) {
    return this.documents.list(user, clientId);
  }

  // Reads one file to pre-fill the form (multipart: files, typeKey). Nothing is stored.
  @Post('read')
  @UseInterceptors(FilesInterceptor('files', 1, uploadInterceptorOptions(standardDocumentKinds)))
  read(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Body() dto: ReadLegalDocumentDto, @UploadedFiles() files: UploadedClientFile[]) {
    return this.documents.read(user, clientId, dto.typeKey, files || []);
  }

  // Adds a document (multipart: files + fields), or takes the file from a KYC upload (kycDocumentId).
  @Post()
  @UseInterceptors(FilesInterceptor('files', 1, uploadInterceptorOptions(standardDocumentKinds)))
  create(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Body() dto: CreateLegalDocumentDto, @UploadedFiles() files: UploadedClientFile[]) {
    return this.documents.create(user, clientId, dto, files || []);
  }

  @Patch(':documentId')
  update(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('documentId') documentId: string, @Body() dto: LegalDocumentFieldsDto) {
    return this.documents.update(user, clientId, documentId, dto);
  }

  @Post(':documentId/remove')
  remove(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('documentId') documentId: string, @Body() dto: RemoveLegalDocumentDto) {
    return this.documents.remove(user, clientId, documentId, dto.reason);
  }

  @Get(':documentId/view')
  async view(@CurrentUser() user: RequestUser, @Param('clientId') clientId: string, @Param('documentId') documentId: string, @Res() response: Response) {
    const file = await this.documents.getFile(user, clientId, documentId);
    response.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeResponseFileName(file.fileName)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(file.content);
  }
}
