import { Transform } from 'class-transformer';
import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyLoginCodeDto {
  @IsUUID()
  challengeId: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.replace(/\s+/g, '') : value)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from the email.' })
  code: string;
}

export class ResendLoginCodeDto {
  @IsUUID()
  challengeId: string;
}
