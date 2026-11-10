import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_BYTES, PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../../common/security/password-policy';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword: string;

  @IsString()
  @MaxLength(PASSWORD_MAX_BYTES, { message: PASSWORD_RULE_MESSAGE })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword: string;

  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_BYTES, { message: PASSWORD_RULE_MESSAGE })
  confirmPassword: string;
}
