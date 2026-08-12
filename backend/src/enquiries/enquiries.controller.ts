import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { AddEnquiryCommentDto, UpdateEnquiryDto, UpdateEnquiryStatusDto } from './dto/update-enquiry.dto';
import { EnquiriesService } from './enquiries.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly enquiriesService: EnquiriesService) {}

  @Roles('OPERATING_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateEnquiryDto) {
    return this.enquiriesService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.enquiriesService.findAll(user);
  }

  @Roles('AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/convert-to-kyc')
  convertToKyc(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.enquiriesService.convertToKyc(user, id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.enquiriesService.findOne(user, id);
  }

  @Roles('OPERATING_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateEnquiryDto) {
    return this.enquiriesService.update(user, id, dto);
  }

  @Roles('OPERATING_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Patch(':id/status')
  updateStatus(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateEnquiryStatusDto) {
    return this.enquiriesService.updateStatus(user, id, dto);
  }

  @Post(':id/comments')
  addComment(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: AddEnquiryCommentDto) {
    return this.enquiriesService.addComment(user, id, dto);
  }

  @Roles('OPERATING_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post(':id/attachments/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachmentFile(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('documentType') documentType: string,
    @UploadedFile() file: { originalname: string; mimetype?: string; size: number; buffer?: Buffer }
  ) {
    return this.enquiriesService.uploadAttachmentFile(user, id, documentType, file);
  }

  @Get(':id/attachments/:attachmentId/view')
  async viewAttachment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response
  ) {
    const document = await this.enquiriesService.getAttachmentFile(user, id, attachmentId);
    response.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    response.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
    response.send(document.content);
  }

  @Roles('OPERATING_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.enquiriesService.remove(user, id);
  }
}
