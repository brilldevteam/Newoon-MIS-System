import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResendLoginCodeDto, VerifyLoginCodeDto } from './dto/login-otp.dto';
import { AccessControlService } from '../access-control/access-control.service';
import { LoginRateLimiter } from './login-rate-limiter';
import { MailService, maskEmail } from './mail.service';

// Login protection settings.
export const LOGIN_POLICY = {
  maxFailedAttempts: 5,
  lockMinutes: 15,
  codeMinutes: 10,
  maxCodeAttempts: 5,
  resendSeconds: 60,
  maxCodeSends: 5,
  networkLimit: 30,
  networkWindowMinutes: 15
};

const INVALID_LOGIN = 'Invalid email or password';
const userInclude = { roles: { include: { role: true } }, tenant: true } as const;

type LoginUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly limiter: LoginRateLimiter;
  // Compared against when the email is unknown, so response time does not reveal which accounts exist.
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly accessControlService: AccessControlService,
    private readonly config: ConfigService,
    private readonly mail: MailService
  ) {
    this.limiter = new LoginRateLimiter(LOGIN_POLICY.networkLimit, LOGIN_POLICY.networkWindowMinutes * 60000, Boolean(this.config.get<string>('TRUST_PROXY')));
  }

  otpEnabled() {
    return this.config.get<string>('LOGIN_OTP_ENABLED') === 'true';
  }

  async login(dto: LoginDto, ip?: string) {
    this.throttle(ip);
    const user = (await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() }, include: userInclude })) as LoginUser | null;

    if (!user) {
      await bcrypt.compare(dto.password, await this.timingHash());
      throw new UnauthorizedException(INVALID_LOGIN);
    }
    this.assertNotLocked(user);

    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.registerFailure(user);
      throw new UnauthorizedException(INVALID_LOGIN);
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User account is not active');
    }

    if (!this.otpEnabled()) {
      return this.completeLogin(user);
    }

    return this.startCodeChallenge(user);
  }

  async verifyLoginCode(dto: VerifyLoginCodeDto, ip?: string) {
    this.throttle(ip);
    const challenge = await this.activeChallenge(dto.challengeId);
    const user = challenge.user as LoginUser;
    this.assertNotLocked(user);

    if (challenge.attempts >= LOGIN_POLICY.maxCodeAttempts) {
      throw new UnauthorizedException('Too many incorrect codes. Sign in again to receive a new code.');
    }

    if (!this.codeMatches(challenge.id, dto.code, challenge.codeHash)) {
      const updated = await this.prisma.loginChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      await this.registerFailure(user);
      const left = LOGIN_POLICY.maxCodeAttempts - updated.attempts;
      throw new UnauthorizedException(left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect codes. Sign in again to receive a new code.');
    }

    // Consume once: a code can never be reused, even by two simultaneous requests.
    const consumed = await this.prisma.loginChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() }
    });
    if (!consumed.count) throw new UnauthorizedException('This sign-in code has expired. Sign in again.');

    if (user.status === 'SUSPENDED') throw new UnauthorizedException('User account is not active');
    return this.completeLogin(user);
  }

  async resendLoginCode(dto: ResendLoginCodeDto, ip?: string) {
    this.throttle(ip);
    const challenge = await this.activeChallenge(dto.challengeId);
    const waitSeconds = Math.ceil((challenge.lastSentAt.getTime() + LOGIN_POLICY.resendSeconds * 1000 - Date.now()) / 1000);
    if (waitSeconds > 0) {
      throw new HttpException(`Wait ${waitSeconds} seconds before requesting a new code.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (challenge.sendCount >= LOGIN_POLICY.maxCodeSends) {
      throw new HttpException('Too many codes requested. Sign in again.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = this.newCode();
    await this.prisma.loginChallenge.update({
      where: { id: challenge.id },
      data: {
        codeHash: this.hashCode(challenge.id, code),
        expiresAt: new Date(Date.now() + LOGIN_POLICY.codeMinutes * 60000),
        attempts: 0,
        sendCount: { increment: 1 },
        lastSentAt: new Date()
      }
    });
    await this.deliverCode(challenge.user as LoginUser, code, challenge.id);
    return this.challengeResponse(challenge.id, challenge.user.email);
  }

  async currentUser(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id }, include: userInclude });
    return this.toPublicUser(user, user.roles.map((userRole) => userRole.role.name));
  }

  async changePassword(id: string, dto: ChangePasswordDto, ip?: string) {
    this.throttle(ip);
    if (dto.newPassword !== dto.confirmPassword) throw new BadRequestException('New passwords do not match.');
    if (dto.newPassword.length < 16 || Buffer.byteLength(dto.newPassword, 'utf8') > 72) {
      throw new BadRequestException('Use at least 16 characters and no more than 72 UTF-8 bytes.');
    }
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user || user.status === 'SUSPENDED') throw new UnauthorizedException('Invalid session');
    this.assertNotLocked(user);
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      await this.registerFailure(user);
      throw new BadRequestException('Current password is incorrect.');
    }
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) throw new BadRequestException('Choose a different new password.');
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      // A stale tab must not overwrite a password changed since verification.
      const result = await tx.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash, sessionVersion: user.sessionVersion, status: 'ACTIVE' },
        data: { passwordHash, sessionVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null }
      });
      if (!result.count) throw new BadRequestException('Account changed. Sign in again before retrying.');
      await tx.loginChallenge.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, action: 'UPDATE', entityType: 'User', entityId: user.id, metadata: { event: 'SELF_PASSWORD_CHANGED' } } });
    });
    return { message: 'Password changed. Sign in again with your new password.' };
  }

  private async startCodeChallenge(user: LoginUser) {
    // The password was correct: clear the failure count, and replace any earlier unfinished code.
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0 } });
    await this.prisma.loginChallenge.deleteMany({ where: { userId: user.id, consumedAt: null } });

    const challenge = await this.prisma.loginChallenge.create({
      data: { userId: user.id, codeHash: 'pending', expiresAt: new Date(Date.now() + LOGIN_POLICY.codeMinutes * 60000) }
    });
    const code = this.newCode();
    await this.prisma.loginChallenge.update({ where: { id: challenge.id }, data: { codeHash: this.hashCode(challenge.id, code) } });
    await this.deliverCode(user, code, challenge.id);
    return this.challengeResponse(challenge.id, user.email);
  }

  private async deliverCode(user: LoginUser, code: string, challengeId: string) {
    if (!this.mail.isConfigured()) {
      // Development only: without SMTP the code is written to the server log so sign-in can be tested.
      if (process.env.NODE_ENV !== 'production' && this.config.get<string>('LOGIN_OTP_DEV_LOG') === 'true') {
        this.logger.warn(`[development] Sign-in code for ${maskEmail(user.email)}: ${code}`);
        return;
      }
      await this.prisma.loginChallenge.delete({ where: { id: challengeId } }).catch(() => undefined);
      this.logger.error('LOGIN_OTP_ENABLED is true but SMTP_HOST/MAIL_FROM are not configured.');
      throw new ServiceUnavailableException('Sign-in codes cannot be sent right now. Contact your administrator.');
    }
    try {
      await this.mail.sendLoginCode(user.email, user.firstName, code, LOGIN_POLICY.codeMinutes);
    } catch (error) {
      await this.prisma.loginChallenge.delete({ where: { id: challengeId } }).catch(() => undefined);
      this.logger.error(`Sign-in code email failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('We could not send the sign-in code. Try again in a moment or contact your administrator.');
    }
  }

  private challengeResponse(challengeId: string, email: string) {
    return {
      otpRequired: true as const,
      challengeId,
      maskedEmail: maskEmail(email),
      expiresInSeconds: LOGIN_POLICY.codeMinutes * 60,
      resendAfterSeconds: LOGIN_POLICY.resendSeconds
    };
  }

  private async activeChallenge(challengeId: string) {
    const challenge = await this.prisma.loginChallenge.findUnique({ where: { id: challengeId }, include: { user: { include: userInclude } } });
    if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('This sign-in code has expired. Sign in again.');
    }
    return challenge;
  }

  private async completeLogin(user: LoginUser) {
    const roles = user.roles.map((userRole) => userRole.role.name);
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    await this.prisma.auditLog.create({
      data: { tenantId: user.tenantId, actorId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, metadata: { otp: this.otpEnabled() } }
    });

    // `sv` ties the token to the account's session version; raising it (password reset, suspension) ends all sessions.
    const payload = { sub: user.id, email: user.email, tenantId: user.tenantId, roles, sv: user.sessionVersion };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: await this.toPublicUser(user, roles)
    };
  }

  private assertNotLocked(user: LoginUser) {
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
      throw new HttpException(`Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask an administrator to reset your password.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async registerFailure(user: LoginUser) {
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: { increment: 1 } } });
    if (updated.failedLoginCount < LOGIN_POLICY.maxFailedAttempts) return;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOGIN_POLICY.lockMinutes * 60000) }
    });
    await this.prisma.auditLog.create({
      data: { tenantId: user.tenantId, actorId: user.id, action: 'UPDATE', entityType: 'User', entityId: user.id, metadata: { event: 'ACCOUNT_LOCKED', minutes: LOGIN_POLICY.lockMinutes } }
    });
    this.logger.warn(`Account ${maskEmail(user.email)} locked for ${LOGIN_POLICY.lockMinutes} minutes after repeated failed sign-ins.`);
  }

  private throttle(ip?: string) {
    const wait = this.limiter.hit(ip);
    if (wait > 0) {
      throw new HttpException(`Too many sign-in attempts from this network. Try again in ${Math.ceil(wait / 60)} minute(s).`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private newCode() {
    return String(randomInt(0, 1000000)).padStart(6, '0');
  }

  // Keyed hash: a database leak alone does not reveal codes.
  private hashCode(challengeId: string, code: string) {
    return createHmac('sha256', this.config.get<string>('JWT_SECRET') || '').update(`${challengeId}:${code}`).digest('hex');
  }

  private codeMatches(challengeId: string, code: string, expected: string) {
    const actual = Buffer.from(this.hashCode(challengeId, code), 'hex');
    const stored = Buffer.from(expected, 'hex');
    return actual.length === stored.length && timingSafeEqual(actual, stored);
  }

  private timingHash() {
    if (!this.dummyHash) this.dummyHash = bcrypt.hash('timing-equaliser-not-a-password', 12);
    return this.dummyHash;
  }

  private async toPublicUser(user: any, roles: string[]) {
    const access = await this.accessControlService.effectivePermissions(roles);
    return {
      id: user.id,
      tenantId: user.tenantId,
      tenant: user.tenant,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles,
      permissions: access.permissions,
      accessControlConfigured: access.configured
    };
  }
}
