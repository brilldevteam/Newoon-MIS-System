import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { EnquiryStatus, EnquiryType } from '@prisma/client';

class UpdateEnquiryAttachmentDto {
  @IsString()
  documentType!: string;

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  storagePath?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  size?: number;
}

export class UpdateEnquiryDto {
  @IsOptional()
  @IsEnum(EnquiryType)
  enquiryType?: EnquiryType;

  @IsOptional()
  @IsString()
  clientId?: string | null;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  proposedCompanyName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requestedServices?: string[];

  @IsOptional()
  @IsString()
  keyContactName?: string;

  @IsOptional()
  @IsEmail()
  keyContactEmail?: string;

  @IsOptional()
  @IsString()
  keyContactPhone?: string;

  @IsOptional()
  @IsString()
  keyContactPosition?: string;

  @IsOptional()
  @IsString()
  headOfficeCountry?: string;

  @IsOptional()
  @IsString()
  branchCountry?: string;

  @IsOptional()
  @IsString()
  areaOfOperation?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateEnquiryAttachmentDto)
  attachments?: UpdateEnquiryAttachmentDto[];
}

export class UpdateEnquiryStatusDto {
  @IsEnum(EnquiryStatus)
  status!: EnquiryStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AddEnquiryCommentDto {
  @IsString()
  body!: string;
}
