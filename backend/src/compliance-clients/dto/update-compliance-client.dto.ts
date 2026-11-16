import { IsEmail, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateComplianceClientDto {
  @IsOptional()
  @IsIn(['SIMPLIFIED', 'REGULAR', 'ENHANCED', 'NONE'])
  cddType?: 'SIMPLIFIED' | 'REGULAR' | 'ENHANCED' | 'NONE';

  @IsOptional()
  @IsIn(['QFC', 'MOCI', 'QFZ', 'OTHER', 'NONE'])
  jurisdiction?: 'QFC' | 'MOCI' | 'QFZ' | 'OTHER' | 'NONE';

  @IsOptional()
  @ValidateIf((dto: UpdateComplianceClientDto) => Boolean(dto.email?.trim()))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // Activation happens only through the KYC engagement decision; here a client can be marked inactive or reactivated.
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  statusReason?: string;
}
