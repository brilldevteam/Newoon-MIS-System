import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { standardDocumentKinds, uploadInterceptorOptions } from '../common/security/upload-security';
import { RequestUser } from '../common/types/request-user.type';
import { ComplianceClientQuery, ComplianceClientsService } from './compliance-clients.service';
import { UploadedClientFile } from './compliance-documents.service';
import { LinkKycIdentityDocumentDto, UpdateProfileFieldDto, UploadIdentityDocumentDto } from './dto/profile-edit.dto';
import { UpdateComplianceClientDto } from './dto/update-compliance-client.dto';

// Access follows the "compliance" area of the role matrix (see RolesGuard): GET needs view, PATCH needs edit.
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('compliance/clients')
export class ComplianceClientsController {
  constructor(private readonly complianceClientsService: ComplianceClientsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: ComplianceClientQuery) {
    return this.complianceClientsService.list(user, this.pickQuery(query));
  }

  @Get('export/excel')
  async exportExcel(@CurrentUser() user: RequestUser, @Query() query: ComplianceClientQuery, @Res() response: Response) {
    const file = await this.complianceClientsService.exportExcel(user, this.pickQuery(query));
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('X-Export-Truncated', file.truncated ? 'true' : 'false');
    response.send(file.content);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.complianceClientsService.findOne(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateComplianceClientDto) {
    return this.complianceClientsService.update(user, id, dto);
  }

  // One company or person detail edited on the client page; stored as an audited overlay on the current KYC.
  @Patch(':id/profile')
  updateProfileField(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateProfileFieldDto) {
    return this.complianceClientsService.updateProfileField(user, id, dto);
  }

  // A QID or passport copy for one person (multipart: files, section, rowId, identityType, documentNumber, expiryDate).
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

  // Uses an ID file uploaded on one of the client's KYC cases as a person's QID / passport copy.
  @Post(':id/identity-documents/from-kyc')
  linkKycIdentityDocument(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: LinkKycIdentityDocumentDto) {
    return this.complianceClientsService.linkKycIdentityDocument(user, id, dto);
  }

  // Starts a periodic re-KYC prefilled from the current profile; earlier KYCs are kept as history.
  @Post(':id/rekyc')
  startRekyc(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.complianceClientsService.startRekyc(user, id);
  }

  private pickQuery(query: Record<string, unknown>): ComplianceClientQuery {
    const text = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : undefined);
    return {
      search: text('search'),
      status: text('status'),
      riskLevel: text('riskLevel'),
      cddType: text('cddType'),
      jurisdiction: text('jurisdiction'),
      review: text('review'),
      attention: text('attention'),
      page: text('page'),
      pageSize: text('pageSize')
    };
  }
}
