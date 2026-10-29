import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { UsersService } from './users.service';
import { CreateUserDto, ResetUserPasswordDto, UpdateUserDto } from './dto/manage-user.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.usersService.findAll(user);
  }

  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  @Get('options')
  options(@CurrentUser() user: RequestUser) { return this.usersService.options(user); }

  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateUserDto) { return this.usersService.create(user, dto); }

  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateUserDto) { return this.usersService.update(user, id, dto); }

  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN')
  @Post(':id/reset-password')
  resetPassword(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ResetUserPasswordDto) { return this.usersService.resetPassword(user, id, dto); }
}
