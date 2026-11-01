import { BadRequestException, Body, Controller, Get, Injectable, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

export class UpdateSelfProfileDto {
  @IsString() @MinLength(1) @MaxLength(80) firstName: string;
  @IsString() @MinLength(1) @MaxLength(80) lastName: string;
  @IsString() @MaxLength(500) bio: string;
  @ValidateIf((_object, value) => value !== null)
  @IsString() @MaxLength(180000) avatarDataUrl: string | null;
}

@Injectable()
export class SelfProfileService {
  constructor(private readonly prisma: PrismaService) {}
  get(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: {
      firstName: true, lastName: true, email: true, roles: { select: { role: { select: { name: true } } } },
      profile: { select: { bio: true, avatarDataUrl: true } }
    } });
  }
  async update(id: string, dto: UpdateSelfProfileDto) {
    const firstName = dto.firstName.trim(); const lastName = dto.lastName.trim();
    if (!firstName || !lastName) throw new BadRequestException('First and last name are required.');
    let avatarDataUrl: string | null = null;
    if (dto.avatarDataUrl) {
      if (!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(dto.avatarDataUrl)) throw new BadRequestException('Use a PNG profile picture.');
      const bytes = Buffer.from(dto.avatarDataUrl.split(',')[1], 'base64');
      if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || bytes.readUInt32BE(16) > 1024 || bytes.readUInt32BE(20) > 1024) throw new BadRequestException('Invalid or oversized picture.');
      try {
        const image = await loadImage(bytes);
        const canvas = createCanvas(256, 256); const context = canvas.getContext('2d');
        const size = Math.min(image.width, image.height);
        context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 256, 256);
        avatarDataUrl = canvas.toDataURL('image/png');
      } catch { throw new BadRequestException('Unable to read profile picture.'); }
    }
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: { firstName, lastName }, select: { tenantId: true } });
      const data = { bio: dto.bio.trim(), avatarDataUrl };
      await tx.userProfile.upsert({ where: { userId: id }, create: { userId: id, ...data }, update: data });
      await tx.auditLog.create({ data: { tenantId: user.tenantId, actorId: id, action: 'UPDATE', entityType: 'UserProfile', entityId: id, metadata: { event: 'SELF_PROFILE_UPDATED' } } });
    });
    return this.get(id);
  }
}

@Controller('auth/profile')
@UseGuards(AuthGuard('jwt'))
export class SelfProfileController {
  constructor(private readonly profiles: SelfProfileService) {}
  @Get() get(@CurrentUser() user: RequestUser) { return this.profiles.get(user.id); }
  @Patch() update(@CurrentUser() user: RequestUser, @Body() dto: UpdateSelfProfileDto) { return this.profiles.update(user.id, dto); }
}
