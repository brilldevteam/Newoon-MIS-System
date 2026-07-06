import { IsOptional, IsString } from 'class-validator';

export class UpdateKycCaseDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  serviceName?: string;
}
