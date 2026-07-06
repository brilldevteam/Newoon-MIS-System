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
      where: this.tenantWhere(user),
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
}
