import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { roles: { include: { role: true } }, tenant: true }
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roles = user.roles.map((userRole) => userRole.role.name);
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles
    };

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id
      }
    });

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.toPublicUser(user, roles)
    };
  }

  async currentUser(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { roles: { include: { role: true } }, tenant: true }
    });

    return this.toPublicUser(
      user,
      user.roles.map((userRole) => userRole.role.name)
    );
  }

  private toPublicUser(user: any, roles: string[]) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      tenant: user.tenant,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles
    };
  }
}
