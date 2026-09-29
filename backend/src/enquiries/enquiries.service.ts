import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { EnquiryStatus, EnquiryType, KycCaseStatus, KycFormSectionKey, NotificationType, Prisma } from '@prisma/client';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { basename, isAbsolute, join, normalize, relative } from 'path';
import PizZip from 'pizzip';
import { isPathInsideRoot, validateUploadFiles } from '../common/security/upload-security';
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

      const enquiryId = await this.prisma.$transaction(async (prisma) => {
        const enquiryCode = await this.nextEnquiryCode(prisma, tenantId);
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
                role: { name: { in: ['DMLRO', 'MLRO', 'SEF'] } }
              }
            }
          },
          select: { id: true }
        });

        if (reviewerRecipients.length) {
          await prisma.notification.createMany({
            data: reviewerRecipients.map((recipient) => ({
              tenantId,
              enquiryId: enquiry.id,
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw this.enquiryCreateDatabaseException(error);
      }
      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new ServiceUnavailableException(
          'Unable to create the enquiry because the application and database schema are not compatible. Please contact the system administrator.'
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
        generatedKycCases: { select: { id: true, kycNumber: true, title: true, status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
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
        generatedKycCases: { select: { id: true, kycNumber: true, title: true, status: true }, orderBy: { createdAt: 'asc' } },
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
    if (!this.canModifyEnquiry(user, existing.status)) {
      throw new BadRequestException('This enquiry has already been submitted. It can be edited again only after AML returns it to BD.');
    }

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
          details: this.jsonValue({ ...this.objectValue(existing.details), ...this.objectValue(dto.details) }),
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

    if (existing.status === EnquiryStatus.CONVERTED_TO_KYC) {
      throw new BadRequestException('This enquiry has already been converted to KYC and its status cannot be changed.');
    }

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
        const submittableStatuses: EnquiryStatus[] = [EnquiryStatus.DRAFT, EnquiryStatus.RETURNED_TO_BD];
        if (!submittableStatuses.includes(existing.status)) {
          throw new BadRequestException('This enquiry has already been submitted to AML Supervisor.');
        }
        if (existing.enquiryType === EnquiryType.PROPOSED_COMPANY) {
          this.assertCompletePreliminaryKyc(this.objectValue(this.objectValue(existing.details).preliminaryKyc));
        }

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
            enquiryId: existing.id,
            recipientId: recipient.id,
            type: NotificationType.AML_CASE_SUBMITTED,
            title: 'Enquiry submitted to AML Supervisor',
            message: `${this.enquiryDisplayName(existing)} is ready for AML Supervisor review.`
          }))
        });
      }

      if (dto.status === EnquiryStatus.RETURNED_TO_BD) {
        if (!this.hasAnyRole(user, ['AML_SUPERVISOR', 'AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
          throw new ForbiddenException('Only AML reviewers can return an enquiry to BD.');
        }

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
            enquiryId: existing.id,
            recipientId: recipient.id,
            type: NotificationType.ADDITIONAL_INFORMATION_REQUESTED,
            title: 'Enquiry returned to BD',
            message: `${this.enquiryDisplayName(existing)} was returned to BD by AML for additional documents or information.`
          }))
        });
      }

      if (dto.status === EnquiryStatus.READY_FOR_KYC && !this.hasAnyRole(user, ['AML_SUPERVISOR', 'AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
        throw new ForbiddenException('Only AML reviewers can mark an enquiry ready for KYC.');
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
      const existingKycCase = await prisma.kycCase.findFirst({
        where: { tenantId, sourceEnquiryId: enquiry.id }
      });
      if (existingKycCase) {
        const resumedStatus = enquiry.attachments.length ? KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED : KycCaseStatus.LEGAL_DOCUMENTS_PENDING;
        const claimed = await prisma.enquiry.updateMany({
          where: { id: enquiry.id, tenantId, status: EnquiryStatus.READY_FOR_KYC },
          data: { status: EnquiryStatus.CONVERTED_TO_KYC }
        });
        if (claimed.count !== 1) {
          throw new BadRequestException('This enquiry is no longer ready to resume its KYC case.');
        }
        await prisma.kycCase.update({ where: { id: existingKycCase.id }, data: { status: resumedStatus, updatedAt: new Date() } });
        await prisma.kycCaseStatusHistory.create({
          data: {
            tenantId,
            kycCaseId: existingKycCase.id,
            fromStatus: existingKycCase.status,
            toStatus: resumedStatus,
            changedById: user.id,
            note: `KYC case resumed after BD corrected enquiry ${enquiry.enquiryCode}`
          }
        });
        return prisma.kycCase.findUniqueOrThrow({ where: { id: existingKycCase.id } });
      }

      const claimed = await prisma.enquiry.updateMany({
        where: {
          id: enquiry.id,
          tenantId,
          status: EnquiryStatus.READY_FOR_KYC,
          generatedKycCases: { none: {} }
        },
        data: { status: EnquiryStatus.CONVERTED_TO_KYC }
      });

      if (claimed.count !== 1) {
        throw new BadRequestException('This enquiry has already been converted to a KYC case.');
      }

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

      const kycNumber = await this.nextKycNumber(prisma, tenantId);
      const createdCase = await prisma.kycCase.create({
        data: {
          tenantId,
          sourceEnquiryId: enquiry.id,
          clientId,
          serviceId: service?.id,
          title: `${displayName} KYC`,
          kycNumber,
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

      const preliminaryKyc = this.objectValue(details.preliminaryKyc);
      const preliminaryShareholders = this.asArray<Record<string, unknown>>(preliminaryKyc.shareholders);
      const preliminaryUbos = this.asArray<Record<string, unknown>>(preliminaryKyc.ubos);
      const preliminaryManagement = this.asArray<Record<string, unknown>>(preliminaryKyc.management);
      if (preliminaryShareholders.length) {
        await prisma.kycShareholder.createMany({
          data: preliminaryShareholders.filter((row) => this.optionalText(row.fullName)).map((row, index) => ({
            tenantId, kycCaseId: createdCase.id, kycFormId: form.id, fullName: this.optionalText(row.fullName) || '', nationality: this.optionalText(row.nationality),
            identityNumber: this.optionalText(row.identityNumber), residenceAddress: this.optionalText(row.address), ownershipPercentage: this.ownershipPercentageValue(row.ownershipPercentage),
            sortOrder: index, createdBy: user.id, updatedBy: user.id
          }))
        });
        const ubos = (preliminaryUbos.length ? preliminaryUbos : preliminaryShareholders.filter((row) => Boolean(row.isUbo))).filter((row) => this.optionalText(row.fullName));
        if (ubos.length) {
          await prisma.kycUbo.createMany({ data: ubos.map((row, index) => ({
            tenantId, kycCaseId: createdCase.id, kycFormId: form.id, fullName: this.optionalText(row.fullName) || '', nationality: this.optionalText(row.nationality),
            identityNumber: this.optionalText(row.identityNumber), residenceAddress: this.optionalText(row.address), ownershipPercentage: this.ownershipPercentageValue(row.ownershipPercentage),
            sortOrder: index, createdBy: user.id, updatedBy: user.id
          })) });
        }
      }
      if (preliminaryManagement.length) {
        await prisma.kycManager.createMany({ data: preliminaryManagement.filter((row) => this.optionalText(row.fullName)).map((row, index) => ({
          tenantId, kycCaseId: createdCase.id, kycFormId: form.id, fullName: this.optionalText(row.fullName) || '', identityNumber: this.optionalText(row.identityNumber),
          nationality: this.optionalText(row.nationality), position: this.optionalText(row.position) || this.asArray<string>(row.positions).map(String).filter(Boolean).join(', ') || null, sortOrder: index, createdBy: user.id, updatedBy: user.id
        })) });
      }

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
        data: { clientId }
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
    const updated = await this.uploadAttachmentFiles(user, id, documentType, file ? [file] : []);
    return updated;
  }

  async getPreliminaryKyc(user: RequestUser, id: string) {
    const enquiry = await this.findOne(user, id);
    this.assertProposedCompanyEnquiry(enquiry);
    const details = this.objectValue(enquiry.details);
    return { enquiry, data: this.objectValue(details.preliminaryKyc), completedAt: this.optionalText(this.objectValue(details.preliminaryKyc).completedAt) };
  }

  async savePreliminaryKyc(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const enquiry = await this.findOne(user, id);
    this.assertProposedCompanyEnquiry(enquiry);
    if (!this.canModifyEnquiry(user, enquiry.status)) {
      throw new BadRequestException('The Preliminary KYC form is locked after the enquiry is submitted. AML must return the enquiry before it can be edited.');
    }
    const data = this.preliminaryKycData(dto, enquiry);
    await this.prisma.enquiry.update({
      where: { id: enquiry.id },
      data: { details: this.requiredJsonValue({ ...this.objectValue(enquiry.details), preliminaryKyc: data }) }
    });
    return this.getPreliminaryKyc(user, id);
  }

  async completePreliminaryKyc(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const saved = await this.savePreliminaryKyc(user, id, dto);
    this.assertCompletePreliminaryKyc(saved.data);
    const data = { ...saved.data, completedAt: new Date().toISOString(), completedById: user.id };
    await this.prisma.enquiry.update({
      where: { id },
      data: { details: this.requiredJsonValue({ ...this.objectValue(saved.enquiry.details), preliminaryKyc: data }) }
    });
    return this.getPreliminaryKyc(user, id);
  }

  async uploadAttachmentFiles(
    user: RequestUser,
    id: string,
    documentType: string,
    files: Array<{ originalname: string; mimetype?: string; size: number; buffer?: Buffer }> = []
  ) {
    if (!documentType?.trim()) {
      throw new BadRequestException('Document type is required');
    }

    if (!files.length) {
      throw new BadRequestException('Upload enquiry attachment files');
    }

    validateUploadFiles(files, ['pdf', 'word', 'excel', 'image'], 'enquiry attachment');

    const enquiry = await this.findOne(user, id);
    if (!this.canModifyEnquiry(user, enquiry.status)) {
      throw new BadRequestException('This enquiry has already been submitted. Uploads are enabled again only after AML returns it to BD.');
    }

    const uploadRoot = this.enquiryAttachmentUploadRoot();
    const enquiryDirectory = join(uploadRoot, enquiry.tenantId, enquiry.id);
    mkdirSync(enquiryDirectory, { recursive: true });

    const attachments = files.map((file, index) => {
      const fileName = this.safeFileName(file.originalname);
      const storedFileName = `${Date.now()}-${index}-${fileName}`;
      writeFileSync(join(enquiryDirectory, storedFileName), file.buffer!);

      return {
        tenantId: enquiry.tenantId,
        enquiryId: enquiry.id,
        documentType: documentType.trim(),
        fileName,
        storagePath: join(enquiry.tenantId, enquiry.id, storedFileName),
        mimeType: file.mimetype,
        size: file.size,
        createdBy: user.id
      };
    });

    await this.prisma.enquiryAttachment.createMany({ data: attachments });

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

  async getAttachmentGroupZip(user: RequestUser, id: string, documentType: string) {
    if (!documentType?.trim()) {
      throw new BadRequestException('Document type is required');
    }

    const enquiry = await this.findOne(user, id);
    const attachments = enquiry.attachments.filter((item) => item.documentType === documentType && item.storagePath);

    if (!attachments.length) {
      throw new NotFoundException('No uploaded files are available for this attachment group');
    }

    const zip = new PizZip();
    const usedNames = new Set<string>();

    for (const attachment of attachments) {
      const absolutePath = this.resolveEnquiryAttachmentPath(attachment.storagePath!);
      if (!absolutePath || !existsSync(absolutePath)) continue;

      const fileName = this.uniqueArchiveFileName(this.safeFileName(attachment.fileName), usedNames);
      zip.file(fileName, readFileSync(absolutePath));
    }

    if (!Object.keys(zip.files).length) {
      throw new NotFoundException('Uploaded files are not available for this attachment group');
    }

    return {
      fileName: `${this.safeFileName(documentType)}.zip`,
      content: zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
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

  private async nextEnquiryCode(prisma: Prisma.TransactionClient, tenantId: string) {
    const year = new Date().getFullYear();
    const prefix = `ENQ-${year}-`;

    await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), CAST(${year} AS INTEGER))`;
    const latest = await prisma.enquiry.findFirst({
      where: {
        tenantId,
        enquiryCode: { startsWith: prefix }
      },
      orderBy: { enquiryCode: 'desc' },
      select: { enquiryCode: true }
    });

    const latestSequence = latest?.enquiryCode.startsWith(prefix)
      ? Number.parseInt(latest.enquiryCode.slice(prefix.length), 10)
      : 0;
    const nextSequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1;
    return `${prefix}${String(nextSequence).padStart(4, '0')}`;
  }

  private async nextKycNumber(prisma: Prisma.TransactionClient, tenantId: string) {
    const year = new Date().getFullYear();
    const prefix = `KYC-${year}-`;
    const count = await prisma.kycCase.count({
      where: {
        tenantId,
        kycNumber: { startsWith: prefix }
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

  private canModifyEnquiry(user: RequestUser, status: EnquiryStatus) {
    if (!this.hasAnyRole(user, ['OPERATING_TEAM']) || this.hasAnyRole(user, ['COMPANY_ADMIN', 'SUPER_ADMIN', 'AML_SUPERVISOR', 'AML_TEAM'])) {
      return true;
    }

    const editableStatuses: EnquiryStatus[] = [EnquiryStatus.DRAFT, EnquiryStatus.RETURNED_TO_BD];
    return editableStatuses.includes(status);
  }

  private assertProposedCompanyEnquiry(enquiry: { enquiryType: EnquiryType }) {
    if (enquiry.enquiryType !== EnquiryType.PROPOSED_COMPANY) {
      throw new BadRequestException('Preliminary KYC is available only for Proposed Company - No Legal Status Yet enquiries.');
    }
  }

  private preliminaryKycData(dto: Record<string, unknown>, enquiry: { proposedCompanyName: string | null; details: unknown }) {
    const existing = this.objectValue(this.objectValue(enquiry.details).preliminaryKyc);
    const expectedBusiness = dto.expectedBusiness === undefined
      ? existing.expectedBusiness
      : (Array.isArray(dto.expectedBusiness) ? dto.expectedBusiness : [dto.expectedBusiness])
          .map((value) => this.optionalText(value))
          .filter((value): value is string => Boolean(value));
    return {
      ...existing,
      companyName: this.optionalText(dto.companyName) || enquiry.proposedCompanyName || '',
      proposedLegalForm: this.optionalText(dto.proposedLegalForm),
      jurisdiction: this.optionalText(dto.jurisdiction),
      businessActivity: this.optionalText(dto.businessActivity),
      registeredOfficeAddress: this.optionalText(dto.registeredOfficeAddress),
      sourceOfFunds: this.optionalText(dto.sourceOfFunds),
      expectedBusiness,
      shareholders: this.asArray<Record<string, unknown>>(dto.shareholders).map((row) => ({
        fullName: this.optionalText(row.fullName), nationality: this.optionalText(row.nationality), identityNumber: this.optionalText(row.identityNumber),
        address: this.optionalText(row.address), ownershipPercentage: this.optionalText(row.ownershipPercentage), isUbo: Boolean(row.isUbo)
      })),
      ubos: this.asArray<Record<string, unknown>>(dto.ubos).map((row) => ({
        fullName: this.optionalText(row.fullName), nationality: this.optionalText(row.nationality), identityNumber: this.optionalText(row.identityNumber),
        address: this.optionalText(row.address), ownershipPercentage: this.optionalText(row.ownershipPercentage), isUbo: true
      })),
      management: this.asArray<Record<string, unknown>>(dto.management).map((row) => ({
        fullName: this.optionalText(row.fullName), identityNumber: this.optionalText(row.identityNumber), nationality: this.optionalText(row.nationality), position: this.optionalText(row.position) || this.asArray<string>(row.positions).map(String).filter(Boolean).join(', '), positions: this.asArray<string>(row.positions).map(String).filter(Boolean)
      })),
      documents: this.asArray<Record<string, unknown>>(dto.documents).map((row) => ({
        documentType: this.optionalText(row.documentType), description: this.optionalText(row.description), available: Boolean(row.available)
      })),
      contact: this.objectValue(dto.contact),
      declaration: this.objectValue(dto.declaration),
      updatedAt: new Date().toISOString()
    };
  }

  private assertCompletePreliminaryKyc(data: Record<string, unknown>) {
    const required = ['companyName', 'proposedLegalForm', 'jurisdiction', 'businessActivity', 'registeredOfficeAddress', 'sourceOfFunds'];
    if (required.some((key) => !this.optionalText(data[key]))) {
      throw new BadRequestException('Complete all Preliminary KYC company details before submitting the enquiry.');
    }
    const shareholders = this.asArray<Record<string, unknown>>(data.shareholders);
    if (!shareholders.length || shareholders.some((row) => !this.optionalText(row.fullName) || !this.optionalText(row.ownershipPercentage))) {
      throw new BadRequestException('Add at least one proposed shareholder with name and ownership percentage.');
    }
    const management = this.asArray<Record<string, unknown>>(data.management);
    if (!management.length || management.some((row) => !this.optionalText(row.fullName) || !this.optionalText(row.position))) {
      throw new BadRequestException('Add at least one proposed management or control person with name and position.');
    }
    if (!this.asArray<Record<string, unknown>>(data.documents).some((row) => Boolean(row.available))) {
      throw new BadRequestException('Confirm at least one required Preliminary KYC document is available.');
    }
  }

  private hasAnyRole(user: RequestUser, roles: string[]) {
    return user.roles.some((role) => roles.includes(role));
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

  private asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private ownershipPercentageValue(value: unknown) {
    const text = this.optionalText(value);
    if (!text) return null;

    const normalized = text.replace(/\s*%\s*$/, '').replace(',', '.').trim();
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
      throw new BadRequestException('Ownership percentage must be a number between 0 and 100.');
    }

    const percentage = Number(normalized);
    if (percentage < 0 || percentage > 100) {
      throw new BadRequestException('Ownership percentage must be a number between 0 and 100.');
    }

    return new Prisma.Decimal(normalized);
  }

  private enquirySectionA(
    enquiry: Awaited<ReturnType<EnquiriesService['findOne']>>,
    details: Record<string, unknown>
  ) {
    const preliminary = this.objectValue(details.preliminaryKyc);
    return {
      legalName: this.optionalText(preliminary.companyName) || enquiry.companyName || enquiry.proposedCompanyName || enquiry.client?.name || '',
      countryOfIncorporation: this.optionalText(preliminary.jurisdiction) || enquiry.headOfficeCountry || enquiry.branchCountry || '',
      legalForm: this.optionalText(preliminary.proposedLegalForm) || '',
      registeredOfficeAddress: this.optionalText(preliminary.registeredOfficeAddress) || this.optionalText(details.proposedRegisteredOfficeAddress) || '',
      telephone: enquiry.keyContactPhone || '',
      email: enquiry.keyContactEmail || '',
      businessNature: this.optionalText(preliminary.businessActivity) || this.optionalText(details.proposedBusinessActivity) || '',
      licenseActivities: this.optionalText(preliminary.businessActivity) || this.optionalText(details.proposedBusinessActivity) || '',
      relatedIndustry: this.optionalText(details.relatedIndustry) || '',
      prospectiveService: enquiry.requestedServices || [],
      formVariant: enquiry.enquiryType === EnquiryType.PROPOSED_COMPANY ? 'PRELIMINARY_PROPOSED_COMPANY' : 'STANDARD'
    };
  }

  private enquiryCreateDatabaseException(error: Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021' || error.code === 'P2022') {
      return new ServiceUnavailableException(
        'Unable to create the enquiry because the enquiry database schema is not up to date. Please contact the system administrator.'
      );
    }

    if (error.code === 'P2002') {
      return new ConflictException(
        'An enquiry with the generated reference already exists. Please submit the enquiry again.'
      );
    }

    if (error.code === 'P2003' || error.code === 'P2025') {
      return new BadRequestException(
        'A linked tenant, client, or user record is no longer available. Refresh the page and try again.'
      );
    }

    return new BadRequestException(
      `The database rejected the enquiry request (reference ${error.code}). Please contact the system administrator.`
    );
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

  private uniqueArchiveFileName(fileName: string, usedNames: Set<string>) {
    const baseName = this.safeFileName(fileName);
    if (!usedNames.has(baseName)) {
      usedNames.add(baseName);
      return baseName;
    }

    const dotIndex = baseName.lastIndexOf('.');
    const name = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
    const extension = dotIndex > 0 ? baseName.slice(dotIndex) : '';
    let counter = 2;
    let candidate = `${name} (${counter})${extension}`;

    while (usedNames.has(candidate)) {
      counter += 1;
      candidate = `${name} (${counter})${extension}`;
    }

    usedNames.add(candidate);
    return candidate;
  }

  private removeEnquiryAttachmentDirectory(tenantId: string, enquiryId: string) {
    const uploadRoot = this.enquiryAttachmentUploadRoot();
    const normalizedRoot = normalize(uploadRoot);
    const enquiryDirectory = normalize(join(uploadRoot, tenantId, enquiryId));

    if (!isPathInsideRoot(enquiryDirectory, normalizedRoot)) return;

    rmSync(enquiryDirectory, { recursive: true, force: true });
  }
}
