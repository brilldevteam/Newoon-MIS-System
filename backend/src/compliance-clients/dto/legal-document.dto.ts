import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

// Fields of one legal document (multipart with a file, or JSON when the file comes from a KYC upload). Dates are
// YYYY-MM-DD; an empty value clears it on edit.
export class LegalDocumentFieldsDto {
  @IsOptional() @IsString() @MaxLength(100) personId?: string;
  @IsOptional() @ValidateIf((dto: LegalDocumentFieldsDto) => dto.documentNumber !== null) @IsString() @MaxLength(100) documentNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(300) holderName?: string;
  @IsOptional() @ValidateIf((dto: LegalDocumentFieldsDto) => dto.location !== null) @IsString() @MaxLength(100) location?: string | null;
  @IsOptional() @ValidateIf((dto: LegalDocumentFieldsDto) => dto.issueDate !== null) @IsString() @MaxLength(10) issueDate?: string | null;
  @IsOptional() @ValidateIf((dto: LegalDocumentFieldsDto) => dto.expiryDate !== null) @IsString() @MaxLength(10) expiryDate?: string | null;
  @IsOptional() @ValidateIf((dto: LegalDocumentFieldsDto) => dto.notes !== null) @IsString() @MaxLength(1000) notes?: string | null;
}

export class CreateLegalDocumentDto extends LegalDocumentFieldsDto {
  @IsString() @MaxLength(40) typeKey!: string;
  // The document name for "Other".
  @IsOptional() @IsString() @MaxLength(150) typeLabel?: string;
  // For "Other": whether it is a company or an individual document.
  @IsOptional() @IsIn(['COMPANY', 'INDIVIDUAL']) nature?: 'COMPANY' | 'INDIVIDUAL';
  // The current document this one replaces (renewal or correction).
  @IsOptional() @IsString() @MaxLength(100) replacesId?: string;
  // How the values were filled: MANUAL, LOCAL or AI (from the read step).
  @IsOptional() @IsIn(['MANUAL', 'LOCAL', 'AI']) readMethod?: 'MANUAL' | 'LOCAL' | 'AI';
  // Use a file uploaded on one of the client's KYC cases instead of uploading one.
  @IsOptional() @IsString() @MaxLength(100) kycDocumentId?: string;
}

export class ReadLegalDocumentDto {
  @IsString() @MaxLength(40) typeKey!: string;
}

export class RemoveLegalDocumentDto {
  @IsString() @MaxLength(1000) reason!: string;
}
