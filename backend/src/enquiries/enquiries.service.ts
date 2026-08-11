import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EnquiryStatus, EnquiryType, Prisma } from '@prisma/client';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { basename, isAbsolute, join, normalize, relative } from 'path';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { AddEnquiryCommentDto, UpdateEnquiryDto, UpdateEnquiryStatusDto } from './dto/update-enquiry.dto';

@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(user: RequestUser, dto: CreateEnquiryDto) {
    try {
      const tenantId = this.getTenantId(user);
      await this.assertClientTenant(user, dto.clientId);
      const enquiryCode = await this.nextEnquiryCode(tenantId);

      const enquiryId = await this.prisma.$transaction(async (prisma) => {
        const enquiry = await prisma.enquiry.create({
          data: {
            tenantId,
            enquiryCode,
            enquiryType: dto.enquiryType,
            clientId: dto.enquiryType === EnquiryType.CURRENT_CLIENT_NEW_SERVICES ? dto.clientId : undefined,
            companyName: dto.companyName,
            proposedCompanyName: dto.proposedCompanyName,
            requestedServices: dto.requestedServices || [],
            keyContactName: dto.keyContactName,
            keyContactEmail: dto.keyContactEmail,
            keyContactPhone: dto.keyContactPhone,
            keyContactPosition: dto.keyContactPosition,
            headOfficeCountry: dto.headOfficeCountry,
            branchCountry: dto.branchCountry,
            areaOfOperation: dto.areaOfOperation,
            details: this.jsonValue(dto.details),
            notes: dto.notes,
            createdById: user.id,
            attachments: {
              create:
                dto.attachments?.map((attachment) => ({
                  tenantId,
                  documentType: attachment.documentType,
                  fileName: attachment.fileName,
                  storagePath: attachment.storagePath,
                  mimeType: attachment.mimeType,
                  size: attachment.size,
                  createdBy: user.id
                })) || []
            }
          }
        });

        await prisma.enquiryStatusHistory.create({
          data: {
            tenantId,
            enquiryId: enquiry.id,
            toStatus: EnquiryStatus.DRAFT,
            note: 'Enquiry created',
            changedById: user.id
          }
        });

        return enquiry.id;
      });

      return this.findOne(user, enquiryId);
    } catch (error) {
      this.logCreateFailure(user, dto, error);
      if (error instanceof HttpException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        throw new BadRequestException(
          'Unable to create enquiry. Confirm this Operating Team user is assigned to a tenant and the latest enquiry database migrations are applied.'
        );
      }
      throw error;
    }
  }

  findAll(user: RequestUser) {
    return this.prisma.enquiry.findMany({
      where: this.tenantWhere(user),
      orderBy: { createdAt: 'desc' },
      include: {
        client: true,
        attachments: true,
        comments: { orderBy: { createdAt: 'desc' }, include: { author: true } },
        statusHistory: { orderBy: { createdAt: 'desc' }, include: { changedBy: true } }
      }
    });
  }

  async findOne(user: RequestUser, id: string) {
    const enquiry = await this.prisma.enquiry.findFirst({
      where: { id, ...this.tenantWhere(user) },
      include: {
        client: { include: { contacts: true, kycCases: true } },
        attachments: { orderBy: { createdAt: 'desc' } },
        comments: { orderBy: { createdAt: 'desc' }, include: { author: true } },
        statusHistory: { orderBy: { createdAt: 'desc' }, include: { changedBy: true } },
        createdBy: true
      }
    });

    if (!enquiry) {
      throw new NotFoundException('Enquiry not found');
    }

    return enquiry;
  }

  async update(user: RequestUser, id: string, dto: UpdateEnquiryDto) {
    const existing = await this.findOne(user, id);
    await this.assertClientTenant(user, dto.clientId || undefined);
    const nextClientId =
      dto.enquiryType && dto.enquiryType !== EnquiryType.CURRENT_CLIENT_NEW_SERVICES
        ? null
        : dto.clientId === undefined
          ? undefined
          : dto.clientId || null;

    await this.prisma.$transaction(async (prisma) => {
      if (dto.attachments) {
        await prisma.enquiryAttachment.deleteMany({
          where: { enquiryId: existing.id, tenantId: existing.tenantId }
        });
      }

      await prisma.enquiry.update({
        where: { id: existing.id },
        data: {
          enquiryType: dto.enquiryType,
          clientId: nextClientId,
          companyName: dto.companyName,
          proposedCompanyName: dto.proposedCompanyName,
          requestedServices: dto.requestedServices,
          keyContactName: dto.keyContactName,
          keyContactEmail: dto.keyContactEmail,
          keyContactPhone: dto.keyContactPhone,
          keyContactPosition: dto.keyContactPosition,
          headOfficeCountry: dto.headOfficeCountry,
          branchCountry: dto.branchCountry,
          areaOfOperation: dto.areaOfOperation,
          details: this.jsonValue(dto.details),
          notes: dto.notes,
          ...(dto.attachments
            ? {
                attachments: {
                  create: dto.attachments.map((attachment) => ({
                    tenantId: existing.tenantId,
                    documentType: attachment.documentType,
                    fileName: attachment.fileName,
                    storagePath: attachment.storagePath,
                    mimeType: attachment.mimeType,
                    size: attachment.size,
                    createdBy: user.id
                  }))
                }
              }
            : {})
        }
      });
    });

    return this.findOne(user, id);
  }

  async updateStatus(user: RequestUser, id: string, dto: UpdateEnquiryStatusDto) {
    const existing = await this.findOne(user, id);

    await this.prisma.$transaction(async (prisma) => {
      await prisma.enquiry.update({
        where: { id: existing.id },
        data: { status: dto.status }
      });

      await prisma.enquiryStatusHistory.create({
        data: {
          tenantId: existing.tenantId,
          enquiryId: existing.id,
          fromStatus: existing.status,
          toStatus: dto.status,
          note: dto.note,
          changedById: user.id
        }
      });
    });

    return this.findOne(user, id);
  }

  async addComment(user: RequestUser, id: string, dto: AddEnquiryCommentDto) {
    const existing = await this.findOne(user, id);

    await this.prisma.enquiryComment.create({
      data: {
        tenantId: existing.tenantId,
        enquiryId: existing.id,
        body: dto.body,
        authorId: user.id
      }
    });

    return this.findOne(user, id);
  }

  async uploadAttachmentFile(
    user: RequestUser,
    id: string,
    documentType: string,
    file?: { originalname: string; mimetype?: string; size: number; buffer?: Buffer }
  ) {
    if (!documentType?.trim()) {
      throw new BadRequestException('Document type is required');
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('Upload an enquiry attachment file');
    }

    const enquiry = await this.findOne(user, id);
    const uploadRoot = this.enquiryAttachmentUploadRoot();
    const enquiryDirectory = join(uploadRoot, enquiry.tenantId, enquiry.id);
    mkdirSync(enquiryDirectory, { recursive: true });

    const fileName = this.safeFileName(file.originalname);
    const storedFileName = `${Date.now()}-${fileName}`;
    writeFileSync(join(enquiryDirectory, storedFileName), file.buffer);

    await this.prisma.enquiryAttachment.create({
      data: {
        tenantId: enquiry.tenantId,
        enquiryId: enquiry.id,
        documentType: documentType.trim(),
        fileName,
        storagePath: join(enquiry.tenantId, enquiry.id, storedFileName),
        mimeType: file.mimetype,
        size: file.size,
        createdBy: user.id
      }
    });

    return this.findOne(user, id);
  }

  async getAttachmentFile(user: RequestUser, id: string, attachmentId: string) {
    const enquiry = await this.findOne(user, id);
    const attachment = enquiry.attachments.find((item) => item.id === attachmentId);

    if (!attachment) {
      throw new NotFoundException('Enquiry attachment not found');
    }

    if (!attachment.storagePath) {
      throw new NotFoundException('Uploaded file is not available for this attachment');
    }

    const absolutePath = this.resolveEnquiryAttachmentPath(attachment.storagePath);

    if (!absolutePath || !existsSync(absolutePath)) {
      throw new NotFoundException('Uploaded file is not available for this attachment');
    }

    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      content: readFileSync(absolutePath)
    };
  }

  async remove(user: RequestUser, id: string) {
    const existing = await this.findOne(user, id);

    await this.prisma.enquiry.delete({
      where: { id: existing.id }
    });

    this.removeEnquiryAttachmentDirectory(existing.tenantId, existing.id);

    return { id: existing.id };
  }

  private async nextEnquiryCode(tenantId: string) {
    const year = new Date().getFullYear();
    const prefix = `ENQ-${year}-`;
    const count = await this.prisma.enquiry.count({
      where: {
        tenantId,
        enquiryCode: { startsWith: prefix }
      }
    });

    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async assertClientTenant(user: RequestUser, clientId?: string) {
    if (!clientId) return;
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, ...this.tenantWhere(user) }
    });

    if (!client) {
      throw new NotFoundException('Client not found for this enquiry');
    }
  }

  private jsonValue(data?: Record<string, unknown>) {
    return data === undefined ? undefined : (JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue);
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

  private enquiryAttachmentUploadRoot() {
    return normalize(process.env.ENQUIRY_UPLOAD_DIR || join(process.cwd(), 'uploads', 'enquiry-attachments'));
  }

  private logCreateFailure(user: RequestUser, dto: CreateEnquiryDto, error: unknown) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Unable to create enquiry for user=${user.email} roles=${user.roles.join(',')} tenantId=${user.tenantId || 'none'} enquiryType=${dto.enquiryType}: ${errorName}: ${errorMessage}`
    );
  }

  private resolveEnquiryAttachmentPath(storagePath: string) {
    const uploadRoot = this.enquiryAttachmentUploadRoot();
    const normalizedRoot = normalize(uploadRoot);
    const normalizedStoragePath = normalize(storagePath);
    const legacyUploadPrefix = normalize(join(process.cwd(), 'uploads'));
    const candidates = [
      isAbsolute(normalizedStoragePath) ? normalizedStoragePath : join(uploadRoot, normalizedStoragePath),
      join(process.cwd(), normalizedStoragePath)
    ];

    if (normalizedStoragePath.startsWith(legacyUploadPrefix)) {
      candidates.push(join(uploadRoot, relative(legacyUploadPrefix, normalizedStoragePath)));
    }

    return candidates
      .map((candidate) => normalize(candidate))
      .find((candidate) => candidate.startsWith(normalizedRoot) && existsSync(candidate)) || null;
  }

  private safeFileName(fileName: string) {
    const name = basename(fileName || 'document')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return name || 'document';
  }

  private removeEnquiryAttachmentDirectory(tenantId: string, enquiryId: string) {
    const uploadRoot = this.enquiryAttachmentUploadRoot();
    const normalizedRoot = normalize(uploadRoot);
    const enquiryDirectory = normalize(join(uploadRoot, tenantId, enquiryId));

    if (!enquiryDirectory.startsWith(normalizedRoot)) return;

    rmSync(enquiryDirectory, { recursive: true, force: true });
  }
}
