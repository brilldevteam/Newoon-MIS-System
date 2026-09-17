import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: RequestUser, dto: CreateClientDto) {
    const tenantId = this.getTenantId(user);

    return this.prisma.client.create({
      data: {
        tenantId,
        name: dto.name,
        status: 'ACTIVE',
        registrationNumber: dto.registrationNumber,
        industry: dto.industry,
        country: dto.country,
        contacts: {
          create:
            dto.contacts?.map((contact, index) => ({
              tenantId,
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              position: contact.position,
              isPrimary: index === 0
            })) || []
        }
      },
      include: { contacts: true, kycCases: true }
    });
  }

  findAll(user: RequestUser) {
    return this.prisma.client.findMany({
      where: { ...this.tenantWhere(user), status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        contacts: true,
        kycCases: {
          include: { service: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async findOne(user: RequestUser, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...this.tenantWhere(user) },
      include: {
        contacts: true,
        kycCases: {
          include: {
            service: true,
            legalDocuments: true,
            comments: { orderBy: { createdAt: 'desc' } },
            statusHistory: { orderBy: { createdAt: 'desc' } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async matchByIdentifier(user: RequestUser, type: string, identifier: string, excludeClientId?: string) {
    const normalizedType = String(type || '').toLowerCase();
    const value = String(identifier || '').trim();
    const excludedClientId = String(excludeClientId || '').trim();
    const comparableValue = this.normalizedIdentifier(value);

    if (!value) {
      return { match: null };
    }

    if (normalizedType === 'corporate') {
      const client = await this.prisma.client.findFirst({
        where: {
          ...this.tenantWhere(user),
          ...(excludedClientId ? { id: { not: excludedClientId } } : {}),
          registrationNumber: { equals: value, mode: 'insensitive' }
        }
      });

      if (client) {
        return { match: this.clientMatch(client, 'client-registration') };
      }

      const normalizedClient = await this.matchClientRegistrationByNormalizedValue(user, comparableValue, excludedClientId);
      if (normalizedClient) {
        return { match: this.clientMatch(normalizedClient, 'client-registration') };
      }

      const kycCompany = await this.matchKycCompanyRegistration(user, comparableValue, excludedClientId);
      if (kycCompany) {
        return { match: this.clientMatch(kycCompany, 'kyc-general-company') };
      }

      return { match: await this.matchKycOwnerByIdentifier(user, value, excludedClientId) };
    }

    return { match: await this.matchKycOwnerByIdentifier(user, value, excludedClientId) };
  }

  private async matchClientRegistrationByNormalizedValue(user: RequestUser, value: string, excludeClientId?: string) {
    if (!value) return null;

    const clients = await this.prisma.client.findMany({
      where: {
        ...this.tenantWhere(user),
        ...(excludeClientId ? { id: { not: excludeClientId } } : {}),
        registrationNumber: { not: null }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return clients.find((client) => this.normalizedIdentifier(client.registrationNumber) === value) || null;
  }

  private async matchKycCompanyRegistration(user: RequestUser, value: string, excludeClientId?: string) {
    if (!value) return null;

    const sectionData = await this.prisma.kycSectionData.findMany({
      where: {
        ...this.tenantWhere(user),
        sectionKey: 'GENERAL_COMPANY',
        ...(excludeClientId ? { kycCase: { clientId: { not: excludeClientId } } } : {})
      },
      include: { kycCase: { include: { client: true } } },
      orderBy: { updatedAt: 'desc' }
    });

    const match = sectionData.find((section) => {
      const data = this.recordValue(section.data);
      return this.normalizedIdentifier(data.commercialRegistrationNo) === value;
    });

    return match?.kycCase.client || null;
  }

  private async matchKycOwnerByIdentifier(user: RequestUser, value: string, excludeClientId?: string) {
    const comparableValue = this.normalizedIdentifier(value);
    const shareholder = await this.prisma.kycShareholder.findFirst({
      where: {
        ...this.tenantWhere(user),
        identityNumber: { equals: value, mode: 'insensitive' },
        ...(excludeClientId ? { kycCase: { clientId: { not: excludeClientId } } } : {})
      },
      include: { kycCase: { include: { client: true } } },
      orderBy: { createdAt: 'desc' }
    });

    if (shareholder?.kycCase.client) {
      return this.clientMatch(shareholder.kycCase.client, 'kyc-shareholder');
    }

    const normalizedShareholder = await this.matchKycOwnerByNormalizedValue(user, comparableValue, 'shareholder', excludeClientId);
    if (normalizedShareholder) return normalizedShareholder;

    const ubo = await this.prisma.kycUbo.findFirst({
      where: {
        ...this.tenantWhere(user),
        identityNumber: { equals: value, mode: 'insensitive' },
        ...(excludeClientId ? { kycCase: { clientId: { not: excludeClientId } } } : {})
      },
      include: { kycCase: { include: { client: true } } },
      orderBy: { createdAt: 'desc' }
    });

    if (ubo?.kycCase.client) {
      return this.clientMatch(ubo.kycCase.client, 'kyc-ubo');
    }

    return this.matchKycOwnerByNormalizedValue(user, comparableValue, 'ubo', excludeClientId);
  }

  private async matchKycOwnerByNormalizedValue(user: RequestUser, value: string, source: 'shareholder' | 'ubo', excludeClientId?: string) {
    if (!value) return null;

    const where = {
      ...this.tenantWhere(user),
      identityNumber: { not: null },
      ...(excludeClientId ? { kycCase: { clientId: { not: excludeClientId } } } : {})
    };
    const include = { kycCase: { include: { client: true } } };
    const orderBy = { createdAt: 'desc' as const };

    const rows =
      source === 'shareholder'
        ? await this.prisma.kycShareholder.findMany({ where, include, orderBy })
        : await this.prisma.kycUbo.findMany({ where, include, orderBy });
    const match = rows.find((row) => this.normalizedIdentifier(row.identityNumber) === value);

    return match?.kycCase.client ? this.clientMatch(match.kycCase.client, source === 'shareholder' ? 'kyc-shareholder' : 'kyc-ubo') : null;
  }

  async update(user: RequestUser, id: string, dto: UpdateClientDto) {
    const existing = await this.findOne(user, id);
    const tenantId = existing.tenantId;

    return this.prisma.$transaction(async (prisma) => {
      if (dto.contacts) {
        await prisma.clientContact.deleteMany({
          where: { clientId: existing.id, tenantId: existing.tenantId }
        });
      }

      return prisma.client.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          registrationNumber: dto.registrationNumber,
          industry: dto.industry,
          country: dto.country,
          ...(dto.contacts
            ? {
                contacts: {
                  create: dto.contacts.map((contact, index) => ({
                    tenantId,
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone,
                    position: contact.position,
                    isPrimary: index === 0
                  }))
                }
              }
            : {})
        },
        include: {
          contacts: true,
          kycCases: {
            include: { service: true },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
    });
  }

  async remove(user: RequestUser, id: string) {
    const existing = await this.findOne(user, id);

    await this.prisma.client.delete({
      where: { id: existing.id }
    });

    return { id: existing.id };
  }

  private tenantWhere(user: RequestUser) {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
  }

  private getTenantId(user: RequestUser) {
    if (user.roles.includes('SUPER_ADMIN') && !user.tenantId) {
      throw new ForbiddenException('Super admin must act within a tenant for this operation');
    }

    if (!user.tenantId) {
      throw new ForbiddenException('User is not assigned to a tenant');
    }

    return user.tenantId;
  }

  private clientMatch(client: { id: string; name: string; registrationNumber?: string | null; industry?: string | null; country?: string | null; status: string }, source: string) {
    return {
      id: client.id,
      name: client.name,
      registrationNumber: client.registrationNumber,
      industry: client.industry,
      country: client.country,
      status: client.status,
      source
    };
  }

  private normalizedIdentifier(value: unknown) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}
