import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UploadLegalDocumentDto {
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
  @IsInt()
  @Min(1)
  size?: number;
}
