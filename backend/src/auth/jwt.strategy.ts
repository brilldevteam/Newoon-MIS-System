import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    tenantId: string | null;
    roles: string[];
    sv?: number;
  }): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } }
    });

    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Invalid session');
    }

    // Tokens issued before a password reset or suspension carry an older session version and stop working.
    // Tokens from before this check existed have no `sv` and count as version 0.
    if ((payload.sv ?? 0) !== user.sessionVersion) {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles.map((userRole) => userRole.role.name)
    };
  }
}
