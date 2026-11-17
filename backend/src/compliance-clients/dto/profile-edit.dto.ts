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
