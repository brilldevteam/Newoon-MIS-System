import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword: string;

  @IsString()
  @MinLength(16)
  @MaxLength(72)
  newPassword: string;

  @IsString()
  @MinLength(16)
  @MaxLength(72)
  confirmPassword: string;
}
