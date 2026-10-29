import { Transform } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const MANAGED_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATING_TEAM', 'AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'ACCOUNTING_TEAM', 'HR_TEAM'];

export class UserProfileDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(MANAGED_ROLES, { each: true })
  roles!: string[];
}

export class CreateUserDto extends UserProfileDto {
  @IsString()
  @MinLength(16)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class UpdateUserDto extends UserProfileDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';
}

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(16)
  @MaxLength(72)
  password!: string;
}
