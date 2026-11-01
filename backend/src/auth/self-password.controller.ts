import { BadRequestException, Body, Controller, HttpCode, Injectable, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class SelfPasswordService {
  private readonly failures = new Map<string, { count: number; expires: number }>();
  constructor(private readonly prisma: PrismaService) {}

  async change(id: string, dto: ChangePasswordDto) {
    const attempt = this.failures.get(id);
    if (attempt && attempt.expires > Date.now() && attempt.count >= 5) throw new BadRequestException('Too many attempts. Try again in 15 minutes.');
    if (dto.newPassword !== dto.confirmPassword) throw new BadRequestException('New passwords do not match.');
    if (dto.newPassword.length < 16 || Buffer.byteLength(dto.newPassword, 'utf8') > 72) throw new BadRequestException('Use at least 16 characters and no more than 72 UTF-8 bytes.');
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, tenantId: true, status: true, passwordHash: true } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid session');
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      const now = Date.now();
      for (const [key, value] of this.failures) if (value.expires <= now) this.failures.delete(key);
      this.failures.set(id, { count: attempt && attempt.expires > now ? attempt.count + 1 : 1, expires: attempt && attempt.expires > now ? attempt.expires : now + 900000 });
      throw new BadRequestException('Current password is incorrect.');
    }
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) throw new BadRequestException('Choose a different new password.');
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({ where: { id, passwordHash: user.passwordHash, status: 'ACTIVE' }, data: { passwordHash } });
      if (!result.count) throw new BadRequestException('Account changed. Sign in again before retrying.');
      await tx.auditLog.create({ data: { tenantId: user.tenantId, actorId: id, action: 'UPDATE', entityType: 'User', entityId: id, metadata: { event: 'SELF_PASSWORD_CHANGED' } } });
    });
    this.failures.delete(id);
    return { message: 'Password changed. Sign in again with your new password.' };
  }
}

@Controller('auth')
@UseGuards(AuthGuard('jwt'))
export class SelfPasswordController {
  constructor(private readonly passwords: SelfPasswordService) {}
  @Post('change-password')
  @HttpCode(200)
  change(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) { return this.passwords.change(user.id, dto); }
}
