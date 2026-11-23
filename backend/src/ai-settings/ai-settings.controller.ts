import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { AiSettingsService } from './ai-settings.service';

export class SaveAiSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

// Company AI settings. Access follows the "administration" area of the role matrix (see RolesGuard); before the matrix
// is saved, only Company Admin and Super Admin (the same fallback as Users).
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
@Controller('ai-settings')
export class AiSettingsController {
  constructor(private readonly aiSettings: AiSettingsService) {}

  @Get()
  get(@CurrentUser() user: RequestUser) {
    return this.aiSettings.get(user);
  }

  @Put()
  save(@CurrentUser() user: RequestUser, @Body() dto: SaveAiSettingsDto) {
    return this.aiSettings.save(user, dto);
  }

  @Post('test')
  test(@CurrentUser() user: RequestUser) {
    return this.aiSettings.test(user);
  }

  @Post('remove')
  remove(@CurrentUser() user: RequestUser) {
    return this.aiSettings.remove(user);
  }
}
