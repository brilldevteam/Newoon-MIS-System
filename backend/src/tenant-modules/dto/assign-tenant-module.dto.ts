import { IsBoolean, IsString } from 'class-validator';

export class AssignTenantModuleDto {
  @IsString()
  tenantId: string;

  @IsString()
  moduleId: string;

  @IsBoolean()
  isEnabled: boolean;
}
