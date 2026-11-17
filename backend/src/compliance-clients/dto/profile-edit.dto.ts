import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export const PROFILE_SECTIONS = ['COMPANY', 'SHAREHOLDER', 'UBO', 'OFFICER', 'KEY_CONTACT'] as const;

// One value edited with the pencil icon on the compliance client page. The field is checked against the
// section's allowed fields (PROFILE_FIELDS) in the service; an empty value clears it.
export class UpdateProfileFieldDto {
  @IsIn(PROFILE_SECTIONS)
  section!: (typeof PROFILE_SECTIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  rowId?: string;

  @IsString()
  @MaxLength(60)
  field!: string;

  @IsOptional()
  @ValidateIf((dto: UpdateProfileFieldDto) => dto.value !== null)
  @IsString()
  @MaxLength(2000)
  value?: string | null;
}

// Multipart fields sent with a QID / passport copy for one person on the profile.
export class UploadIdentityDocumentDto {
  @IsIn(['SHAREHOLDER', 'UBO', 'OFFICER', 'KEY_CONTACT'])
  section!: 'SHAREHOLDER' | 'UBO' | 'OFFICER' | 'KEY_CONTACT';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  rowId?: string;

  @IsIn(['QID', 'PASSPORT'])
  identityType!: 'QID' | 'PASSPORT';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  expiryDate?: string;
}

// Uses a file uploaded on one of the client's KYC cases as a person's QID / passport copy.
export class LinkKycIdentityDocumentDto extends UploadIdentityDocumentDto {
  @IsString()
  @MaxLength(100)
  legalDocumentId!: string;
}
