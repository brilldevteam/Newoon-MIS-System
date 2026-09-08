import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EnquiryStatus, EnquiryType, KycCaseStatus, KycFormSectionKey, NotificationType, Prisma } from '@prisma/client';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { basename, isAbsolute, join, normalize, relative } from 'path';
import { isPathInsideRoot, validateUploadFile } from '../common/security/upload-security';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { AddEnquiryCommentDto, UpdateEnquiryDto, UpdateEnquiryStatusDto } from './dto/update-enquiry.dto';

const REQUIRED_DOCUMENT_TYPES = [
  'Commercial Registration / CR Extract',
  'Entity Card / Computer Card',
  'Certificate of Incorporation',
  'Articles of Association',
  'QID / Passport copies',
  'CR of legal entity shareholders',
  'National address certificates',
  'Latest Audited Financial Statements',
  'Tax Card'
];

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

        const reviewerRecipients = await prisma.user.findMany({
          where: {
            tenantId,
            roles: {
              some: {
                role: { name: { in: ['DMLRO', 'MLRO'] } }
              }
            }
          },
          select: { id: true }
        });

        if (reviewerRecipients.length) {
          await prisma.notification.createMany({
            data: reviewerRecipients.map((recipient) => ({
              tenantId,
              recipientId: recipient.id,
              type: NotificationType.GENERAL,
              title: 'New enquiry created',
              message: `${this.enquiryDisplayName(enquiry)} was created by BD and is awaiting enquiry workflow action.`
            }))
          });
        }

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

      if (dto.status === EnquiryStatus.SUBMITTED_TO_AML_SUPERVISOR) {
        const recipients = await prisma.user.findMany({
          where: {
            tenantId: existing.tenantId,
            roles: {
              some: {
                role: { name: { in: ['AML_SUPERVISOR', 'AML_TEAM'] } }
              }
            }
          },
          select: { id: true }
        });

        await prisma.notification.createMany({
          data: (recipients.length ? recipients : [{ id: null }]).map((recipient) => ({
            tenantId: existing.tenantId,
            recipientId: recipient.id,
            type: NotificationType.AML_CASE_SUBMITTED,
            title: 'Enquiry submitted to AML Supervisor',
            message: `${this.enquiryDisplayName(existing)} is ready for AML Supervisor review.`
          }))
        });
      }

      if (dto.status === EnquiryStatus.RETURNED_TO_BD) {
        const recipients = await prisma.user.findMany({
          where: {
            tenantId: existing.tenantId,
            roles: {
              some: {
                role: { name: 'OPERATING_TEAM' }
              }
            }
          },
          select: { id: true }
        });

        await prisma.notification.createMany({
          data: (recipients.length ? recipients : [{ id: null }]).map((recipient) => ({
            tenantId: existing.tenantId,
            recipientId: recipient.id,
            type: NotificationType.ADDITIONAL_INFORMATION_REQUESTED,
            title: 'Enquiry returned to Operations',
            message: `${this.enquiryDisplayName(existing)} was returned by AML for additional documents or information.`
          }))
        });
      }
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

  async convertToKyc(user: RequestUser, id: string) {
    try {
      return await this.convertToKycUnsafe(user, id);
    } catch (error) {
      this.logConvertFailure(user, id, error);
      if (error instanceof HttpException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        throw new BadRequestException('Unable to create KYC case from this enquiry. Confirm the latest database migrations are applied and try again.');
      }
      throw new BadRequestException('Unable to create KYC case from this enquiry. Check the server log for the exact conversion error.');
    }
  }

  private async convertToKycUnsafe(user: RequestUser, id: string) {
    const enquiry = await this.findOne(user, id);

    if (enquiry.status === EnquiryStatus.CONVERTED_TO_KYC) {
      throw new BadRequestException('This enquiry has already been converted to a KYC case.');
    }

    if (enquiry.status !== EnquiryStatus.READY_FOR_KYC) {
      throw new BadRequestException('Mark the enquiry as ready for KYC before creating the KYC case.');
    }

    const tenantId = this.getTenantId(user);
    const displayName = this.enquiryDisplayName(enquiry);
    const details = this.objectValue(enquiry.details);

    return this.prisma.$transaction(async (prisma) => {
      let clientId = enquiry.clientId;

      if (!clientId) {
        const client = await prisma.client.create({
          data: {
            tenantId,
            name: displayName,
            industry: this.optionalText(details.proposedBusinessActivity),
            country: enquiry.headOfficeCountry || enquiry.branchCountry,
            contacts: enquiry.keyContactName
              ? {
                  create: {
                    tenantId,
                    name: enquiry.keyContactName,
                    email: enquiry.keyContactEmail,
                    phone: enquiry.keyContactPhone,
                    position: enquiry.keyContactPosition,
                    isPrimary: true
                  }
                }
              : undefined
          }
        });
        clientId = client.id;
      }

      const serviceName = this.serviceDisplayName(enquiry.requestedServices);
      const service = serviceName
        ? await prisma.clientService.upsert({
            where: { tenantId_name: { tenantId, name: serviceName } },
            update: {},
            create: { tenantId, name: serviceName }
          })
        : null;

      const createdCase = await prisma.kycCase.create({
        data: {
          tenantId,
          clientId,
          serviceId: service?.id,
          title: `${displayName} KYC`,
          status: enquiry.attachments.length ? KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED : KycCaseStatus.LEGAL_DOCUMENTS_PENDING,
          createdById: user.id
        }
      });

      const legalDocuments = enquiry.attachments.map((attachment) => ({
        tenantId,
        kycCaseId: createdCase.id,
        documentType: attachment.documentType,
        fileName: attachment.fileName,
        storagePath: this.copyEnquiryAttachmentToLegalDocuments(enquiry.tenantId, createdCase.id, attachment),
        mimeType: attachment.mimeType,
        size: attachment.size,
        uploadedById: user.id
      }));

      if (legalDocuments.length) {
        await prisma.legalDocument.createMany({ data: legalDocuments });
      }

      const form = await prisma.kycForm.create({
        data: {
          tenantId,
          kycCaseId: createdCase.id,
          createdBy: user.id,
          updatedBy: user.id
        }
      });

      const sectionA = this.enquirySectionA(enquiry, details);
      const sectionE = this.enquirySectionE(enquiry, details);
      const requiredRows = this.requiredDocumentRows(legalDocuments);

      await prisma.kycSectionData.createMany({
        data: [
          {
            tenantId,
            kycCaseId: createdCase.id,
            kycFormId: form.id,
            sectionKey: KycFormSectionKey.GENERAL_COMPANY,
            data: this.requiredJsonValue(sectionA),
            createdBy: user.id,
            updatedBy: user.id
          },
          {
            tenantId,
            kycCaseId: createdCase.id,
            kycFormId: form.id,
            sectionKey: KycFormSectionKey.COMMUNICATION_PERSON,
            data: this.requiredJsonValue(sectionE),
            createdBy: user.id,
            updatedBy: user.id
          },
          {
            tenantId,
            kycCaseId: createdCase.id,
            kycFormId: form.id,
            sectionKey: KycFormSectionKey.REQUIRED_DOCUMENTS,
            data: this.requiredJsonValue({ documents: requiredRows }),
            createdBy: user.id,
            updatedBy: user.id
          }
        ]
      });

      await prisma.kycRequiredDocument.createMany({
        data: requiredRows.map((row, index) => ({
          tenantId,
          kycCaseId: createdCase.id,
          kycFormId: form.id,
          documentType: row.documentType,
          isRequired: true,
          isProvided: Boolean(row.isProvided),
          fileName: row.fileName || null,
          storagePath: row.storagePath || null,
          mimeType: row.mimeType || null,
          size: row.size || null,
          sortOrder: index,
          createdBy: user.id,
          updatedBy: user.id
        }))
      });

      await prisma.kycCaseStatusHistory.create({
        data: {
          tenantId,
          kycCaseId: createdCase.id,
          toStatus: createdCase.status,
          changedById: user.id,
          note: `KYC case created from enquiry ${enquiry.enquiryCode}`
        }
      });

      await prisma.workflowComment.create({
        data: {
          tenantId,
          kycCaseId: createdCase.id,
          authorId: user.id,
          body: `Created from enquiry ${enquiry.enquiryCode}.`
        }
      });

      await prisma.enquiry.update({
        where: { id: enquiry.id },
        data: { status: EnquiryStatus.CONVERTED_TO_KYC, clientId }
      });

      await prisma.enquiryStatusHistory.create({
        data: {
          tenantId,
          enquiryId: enquiry.id,
          fromStatus: enquiry.status,
          toStatus: EnquiryStatus.CONVERTED_TO_KYC,
          note: `Converted to KYC case ${createdCase.title}`,
          changedById: user.id
        }
      });

      return prisma.kycCase.findUniqueOrThrow({
        where: { id: createdCase.id },
        include: {
          client: { include: { contacts: true } },
          service: true,
          legalDocuments: { orderBy: { createdAt: 'desc' } },
          comments: { include: { author: true }, orderBy: { createdAt: 'desc' } },
          statusHistory: { orderBy: { createdAt: 'asc' } },
          notifications: { orderBy: { createdAt: 'desc' } }
        }
      });
    });
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

    validateUploadFile(file, ['pdf', 'word', 'excel', 'image'], 'enquiry attachment');

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

  private requiredJsonValue(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
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

  private legalDocumentUploadRoot() {
    return normalize(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads', 'legal-documents'));
  }

  private logCreateFailure(user: RequestUser, dto: CreateEnquiryDto, error: unknown) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Unable to create enquiry for user=${user.email} roles=${user.roles.join(',')} tenantId=${user.tenantId || 'none'} enquiryType=${dto.enquiryType}: ${errorName}: ${errorMessage}`
    );
  }

  private logConvertFailure(user: RequestUser, enquiryId: string, error: unknown) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    this.logger.error(
      `Unable to convert enquiry=${enquiryId} for user=${user.email} roles=${user.roles.join(',')} tenantId=${user.tenantId || 'none'}: ${errorName}: ${errorMessage}`,
      errorStack
    );
  }

  private enquiryDisplayName(enquiry: { companyName: string | null; proposedCompanyName: string | null; enquiryCode: string }) {
    return enquiry.companyName || enquiry.proposedCompanyName || enquiry.enquiryCode;
  }

  private serviceDisplayName(services: string[]) {
    return services.filter(Boolean).join(', ');
  }

  private objectValue(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private enquirySectionA(
    enquiry: Awaited<ReturnType<EnquiriesService['findOne']>>,
    details: Record<string, unknown>
  ) {
    return {
      legalName: enquiry.companyName || enquiry.proposedCompanyName || enquiry.client?.name || '',
      countryOfIncorporation: enquiry.headOfficeCountry || enquiry.branchCountry || '',
      registeredOfficeAddress: this.optionalText(details.proposedRegisteredOfficeAddress) || '',
      telephone: enquiry.keyContactPhone || '',
      email: enquiry.keyContactEmail || '',
      businessNature: this.optionalText(details.proposedBusinessActivity) || '',
      licenseActivities: this.optionalText(details.proposedBusinessActivity) || '',
      relatedIndustry: this.optionalText(details.relatedIndustry) || '',
      prospectiveService: enquiry.requestedServices || []
    };
  }

  private enquirySectionE(enquiry: Awaited<ReturnType<EnquiriesService['findOne']>>, details: Record<string, unknown>) {
    return {
      fullName: enquiry.keyContactName || '',
      position: enquiry.keyContactPosition || '',
      nationality: this.optionalText(details.keyContactNationality) || '',
      identityNumber: this.optionalText(details.keyContactIdentityNumber) || '',
      mobileNumber: enquiry.keyContactPhone || '',
      email: enquiry.keyContactEmail || ''
    };
  }

  private requiredDocumentRows(
    legalDocuments: Array<{ documentType: string; fileName: string; storagePath: string | null; mimeType: string | null; size: number | null }>
  ) {
    const matched = new Set<number>();
    const rows = REQUIRED_DOCUMENT_TYPES.map((documentType) => {
      const matchIndex = legalDocuments.findIndex((document, index) => !matched.has(index) && this.isSameDocumentType(document.documentType, documentType));
      const match = matchIndex >= 0 ? legalDocuments[matchIndex] : null;
      if (matchIndex >= 0) matched.add(matchIndex);
      return {
        documentType,
        isRequired: true,
        isProvided: Boolean(match),
        fileName: match?.fileName || '',
        storagePath: match?.storagePath || '',
        mimeType: match?.mimeType || '',
        size: match?.size || null
      };
    });

    return rows;
  }

  private isSameDocumentType(source: string, required: string) {
    const normalizeLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const sourceText = normalizeLabel(source);
    const requiredText = normalizeLabel(required);
    return sourceText.includes(requiredText) || requiredText.includes(sourceText);
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
      .find((candidate) => isPathInsideRoot(candidate, normalizedRoot) && existsSync(candidate)) || null;
  }

  private copyEnquiryAttachmentToLegalDocuments(
    tenantId: string,
    kycCaseId: string,
    attachment: { id: string; fileName: string; storagePath: string | null }
  ) {
    if (!attachment.storagePath) return null;
    const source = this.resolveEnquiryAttachmentPath(attachment.storagePath);
    if (!source) return null;

    const uploadRoot = this.legalDocumentUploadRoot();
    const caseDirectory = join(uploadRoot, tenantId, kycCaseId);
    mkdirSync(caseDirectory, { recursive: true });

    const storedFileName = `${Date.now()}-${attachment.id}-${this.safeFileName(attachment.fileName)}`;
    writeFileSync(join(caseDirectory, storedFileName), readFileSync(source));
    return join(tenantId, kycCaseId, storedFileName);
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

    if (!isPathInsideRoot(enquiryDirectory, normalizedRoot)) return;

    rmSync(enquiryDirectory, { recursive: true, force: true });
  }
}
