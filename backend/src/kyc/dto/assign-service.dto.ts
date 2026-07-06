import { IsOptional, IsString } from 'class-validator';

export class AssignServiceDto {
  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  serviceName?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
