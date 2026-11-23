import { Body, Controller, Param, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { standardDocumentKinds, uploadInterceptorOptions } from '../common/security/upload-security';
import { RequestUser } from '../common/types/request-user.type';
import { LegalDocumentsAccessGuard } from './client-legal-documents.controller';
import { ComplianceClientsService } from './compliance-clients.service';
import { UploadedClientFile } from './compliance-documents.service';
import { LinkKycIdentityDocumentDto, UploadIdentityDocumentDto } from './dto/client-records.dto';
import { ReadIdentityDocumentDto } from './dto/profile-edit.dto';

// QID and passport copies of a client's people. They are legal documents, so they follow the same access rule as the
// legal documents register (compliance Edit or clients Edit: Operations replaces documents) and notify the AML team.
@UseGuards(AuthGuard('jwt'), LegalDocumentsAccessGuard)
@Controller('compliance/clients')
export class ClientIdentityDocumentsController {
  constructor(private readonly complianceClientsService: ComplianceClientsService) {}

  // A QID or passport copy for one person (multipart: files, personId, identityType, passportId, documentNumber, expiryDate).
  @Post(':id/identity-documents')
  @UseInterceptors(FilesInterceptor('files', 1, uploadInterceptorOptions(standardDocumentKinds)))
  uploadIdentityDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: UploadIdentityDocumentDto,
    @UploadedFiles() files: UploadedClientFile[]
  ) {
    return this.complianceClientsService.uploadIdentityDocument(user, id, body, files || []);
  }

  // Reads the number and expiry date from a QID / passport file to pre-fill the upload form; nothing is stored.
  @Post(':id/identity-documents/read')
  @UseInterceptors(FilesInterceptor('files', 1, uploadInterceptorOptions(standardDocumentKinds)))
  readIdentityDocument(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ReadIdentityDocumentDto, @UploadedFiles() files: UploadedClientFile[]) {
    return this.complianceClientsService.readIdentityDocument(user, id, dto.identityType, files || []);
  }

  // Uses an ID file uploaded on one of the client's KYC cases as a person's QID / passport copy.
  @Post(':id/identity-documents/from-kyc')
  linkKycIdentityDocument(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: LinkKycIdentityDocumentDto) {
    return this.complianceClientsService.linkKycIdentityDocument(user, id, dto);
  }

}
