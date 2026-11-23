import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ROLE_TYPES } from '../client-records';

// One entity or person value edited on the compliance client page. The field is checked against ENTITY_FIELDS /
// PERSON_FIELDS in the service; an empty value clears it.
export class UpdateRecordFieldDto {
  @IsString()
  @MaxLength(60)
  field!: string;

  @IsOptional()
  @ValidateIf((dto: UpdateRecordFieldDto) => dto.value !== null)
  @IsString()
  @MaxLength(2000)
  value?: string | null;
}

// A person added on the client page with their first role.
export class CreatePersonDto {
  @IsIn(['INDIVIDUAL', 'CORPORATE'])
  partyType!: 'INDIVIDUAL' | 'CORPORATE';

  @IsString()
  @MaxLength(300)
  fullName!: string;

  @IsIn(ROLE_TYPES)
  role!: (typeof ROLE_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  percentage?: string;
}

export class AddRoleDto {
  @IsIn(ROLE_TYPES)
  role!: (typeof ROLE_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  percentage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  viaPersonId?: string;
}

export class UpdateRoleDto {
  @IsOptional()
  @ValidateIf((dto: UpdateRoleDto) => dto.percentage !== null)
  @IsString()
  @MaxLength(10)
  percentage?: string | null;

  @IsOptional()
  @ValidateIf((dto: UpdateRoleDto) => dto.viaPersonId !== null)
  @IsString()
  @MaxLength(100)
  viaPersonId?: string | null;
}

export class PassportDto {
  @IsString()
  @MaxLength(100)
  passportNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  issuingCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  expiryDate?: string;
}

export class AllocateStaffDto {
  @IsString()
  @MaxLength(100)
  userId!: string;
}

export class RemoveRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// Multipart fields sent with a QID / passport copy for one person. passportId names the passport a copy belongs to;
// without it a passport copy updates the person's main passport, or adds one when the person has none.
export class UploadIdentityDocumentDto {
  @IsString()
  @MaxLength(100)
  personId!: string;

  @IsIn(['QID', 'PASSPORT'])
  identityType!: 'QID' | 'PASSPORT';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  passportId?: string;

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
