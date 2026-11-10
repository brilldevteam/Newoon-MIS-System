import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user.type';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ResendLoginCodeDto, VerifyLoginCodeDto } from './dto/login-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Step 1: email and password. Returns a session, or `otpRequired` when email codes are enabled.
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, request.ip);
  }

  // Step 2 (email codes enabled): the 6-digit code from the email.
  @Post('login/verify')
  @HttpCode(200)
  verifyLoginCode(@Body() dto: VerifyLoginCodeDto, @Req() request: Request) {
    return this.authService.verifyLoginCode(dto, request.ip);
  }

  @Post('login/resend')
  @HttpCode(200)
  resendLoginCode(@Body() dto: ResendLoginCodeDto, @Req() request: Request) {
    return this.authService.resendLoginCode(dto, request.ip);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.authService.currentUser(user.id);
  }
}
