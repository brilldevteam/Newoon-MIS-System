import { IsOptional, IsString } from 'class-validator';

export class CreateKycCaseDto {
  @IsString()
  clientId!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  serviceName?: string;
}
