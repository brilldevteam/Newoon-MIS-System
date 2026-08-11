import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { EnquiryType } from '@prisma/client';

class CreateEnquiryAttachmentDto {
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

export class CreateEnquiryDto {
  @IsEnum(EnquiryType)
  enquiryType!: EnquiryType;

  @IsOptional()
  @IsString()
  clientId?: string;

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
  @Type(() => CreateEnquiryAttachmentDto)
  attachments?: CreateEnquiryAttachmentDto[];
}
