import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SelfPasswordController, SelfPasswordService } from './self-password.controller';
import { JwtStrategy } from './jwt.strategy';
import { AccessControlModule } from '../access-control/access-control.module';

@Module({
  imports: [
    PassportModule,
    AccessControlModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || '1d'
        }
      })
    })
  ],
  controllers: [AuthController, SelfPasswordController],
  providers: [AuthService, JwtStrategy, SelfPasswordService],
  exports: [AuthService]
})
export class AuthModule {}
