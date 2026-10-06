import { BadRequestException, ForbiddenException, HttpException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { hasComment, safeComment } from '../common/review-comments';
import { beneficialOwners } from '../common/ownership';
import {
  ConfidentialVisibilityScope,
  DueDiligenceType,
  EnquiryStatus,
  EnquiryType,
  KycCaseStatus,
  KycFormSectionKey,
  KycGeneratedDocument,
  KycGeneratedDocumentType,
  NotificationType,
  Prisma,
  ProposalStatus,
  ReviewCommentType,
  ReviewDecision,
  ReviewStage,
  ReviewSubmissionStatus,
  ReviewTaskStatus,
  RiskClassification,
  RiskOverrideReason,
  SignedKycDocumentStage
} from '@prisma/client';
import PizZip from 'pizzip';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { basename, isAbsolute, join, normalize, relative } from 'path';
import { isPathInsideRoot, validateUploadFile, validateUploadFiles } from '../common/security/upload-security';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { AddWorkflowCommentDto } from './dto/add-workflow-comment.dto';
import { AssignServiceDto } from './dto/assign-service.dto';
import { CreateKycCaseDto } from './dto/create-kyc-case.dto';
import { UpdateKycCaseDto } from './dto/update-kyc-case.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';
import { UploadLegalDocumentDto } from './dto/upload-legal-document.dto';
import { exportKycDocx, exportKycPdf, KYC_DOCX_MIME, KYC_PDF_MIME, KycPdfRenderer } from './export';

const REQUIRED_DOCUMENT_TYPES = [
  'Commercial Registration / CR Extract',
  'Entity Card / Computer Card',
  'Certificate of Incorporation',
  'Articles of Association',
  'QID / Passport copies',
  'CR of legal entity parties',
  'National address certificates',
  'Latest Audited Financial Statements',
  'Tax Card'
];

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfRenderer: KycPdfRenderer
  ) {}

  async findAll(user: RequestUser) {
    const where: Prisma.KycCaseWhereInput = this.tenantWhere(user);

    const cases = await this.prisma.kycCase.findMany({
      where,
      include: this.caseInclude(),
      orderBy: { createdAt: 'desc' }
    });

    return Promise.all(cases.map((kycCase) => this.withKycNumber(kycCase)));
  }

  async findOne(user: RequestUser, id: string) {
    const kycCase = await this.prisma.kycCase.findFirst({
      where: { id, ...this.tenantWhere(user) },
      include: this.caseInclude()
    });

    if (!kycCase) {
      throw new NotFoundException('KYC case not found');
    }

    return this.withKycNumber(kycCase);
  }

  async create(user: RequestUser, dto: CreateKycCaseDto) {
    const tenantId = this.getTenantId(user);

    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId }
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const service = dto.serviceName
      ? await this.prisma.clientService.upsert({
          where: { tenantId_name: { tenantId, name: dto.serviceName } },
          update: {},
          create: { tenantId, name: dto.serviceName }
        })
      : null;

    const title = dto.title || `${client.name} KYC Intake`;

    return this.prisma.$transaction(async (tx) => {
      const kycNumber = await this.nextKycNumber(tx, tenantId);
      const kycCase = await tx.kycCase.create({
        data: {
          tenantId,
          clientId: client.id,
          serviceId: service?.id,
          title,
          kycNumber,
          status: service ? KycCaseStatus.LEGAL_DOCUMENTS_PENDING : KycCaseStatus.INQUIRY_RECEIVED,
          createdById: user.id
        }
      });

      await tx.kycCaseStatusHistory.create({
        data: {
          tenantId,
          kycCaseId: kycCase.id,
          toStatus: kycCase.status,
          changedById: user.id,
          note: 'Client inquiry received'
        }
      });

      return tx.kycCase.findUniqueOrThrow({
        where: { id: kycCase.id },
        include: this.caseInclude()
      });
    });
  }

  async update(user: RequestUser, id: string, dto: UpdateKycCaseDto) {
    const existing = await this.requireWritableCase(user, id);
    let serviceId: string | null | undefined;

    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, tenantId: existing.tenantId }
      });

      if (!client) {
        throw new NotFoundException('Client not found');
      }
    }

    if (dto.serviceName !== undefined) {
      const serviceName = dto.serviceName.trim();
      if (serviceName) {
        const service = await this.prisma.clientService.upsert({
          where: { tenantId_name: { tenantId: existing.tenantId, name: serviceName } },
          update: {},
          create: { tenantId: existing.tenantId, name: serviceName }
        });
        serviceId = service.id;
      } else {
        serviceId = null;
      }
    }

    return this.prisma.kycCase.update({
      where: { id: existing.id },
      data: {
        clientId: dto.clientId,
        title: dto.title,
        serviceId
      },
      include: this.caseInclude()
    });
  }

  async remove(user: RequestUser, id: string) {
    const existing = await this.requireWritableCase(user, id);

    await this.prisma.kycCase.delete({
      where: { id: existing.id }
    });

    return { id: existing.id };
  }

  async assignService(user: RequestUser, id: string, dto: AssignServiceDto) {
    const kycCase = await this.requireWritableCase(user, id);
    const service = await this.resolveService(kycCase.tenantId, dto);

    return this.updateStatus(
      user,
      id,
      KycCaseStatus.LEGAL_DOCUMENTS_PENDING,
      'Requested service selected',
      {
        serviceId: service.id
      }
    );
  }

  async updateProposalStatus(user: RequestUser, id: string, dto: UpdateProposalStatusDto) {
    await this.requireWritableCase(user, id);
    const nextStatus =
      dto.proposalStatus === ProposalStatus.REQUIRED || dto.proposalStatus === ProposalStatus.SENT
        ? KycCaseStatus.PROPOSAL_OPTIONAL
        : KycCaseStatus.LEGAL_DOCUMENTS_PENDING;

    return this.updateStatus(user, id, nextStatus, dto.note || `Proposal status changed to ${dto.proposalStatus}`, {
      proposalStatus: dto.proposalStatus
    });
  }

  async uploadLegalDocument(user: RequestUser, id: string, dto: UploadLegalDocumentDto) {
    const kycCase = await this.requireWritableCase(user, id);

    return this.prisma.$transaction(async (tx) => {
      const existingMetadataOnly = await tx.legalDocument.findFirst({
        where: {
          tenantId: kycCase.tenantId,
          kycCaseId: id,
          documentType: dto.documentType,
          fileName: dto.fileName,
          OR: [{ storagePath: null }, { storagePath: '' }]
        }
      });
      if (existingMetadataOnly) {
        await tx.legalDocument.update({
          where: { id: existingMetadataOnly.id },
          data: {
            storagePath: dto.storagePath,
            mimeType: dto.mimeType,
            size: dto.size,
            uploadedById: user.id
          }
        });
      } else {
        await tx.legalDocument.create({
          data: {
            tenantId: kycCase.tenantId,
            kycCaseId: id,
            documentType: dto.documentType,
            fileName: dto.fileName,
            storagePath: dto.storagePath,
            mimeType: dto.mimeType,
            size: dto.size,
            uploadedById: user.id
          }
        });
      }

      if (
        kycCase.status === KycCaseStatus.INQUIRY_RECEIVED ||
        kycCase.status === KycCaseStatus.PROPOSAL_OPTIONAL ||
        kycCase.status === KycCaseStatus.LEGAL_DOCUMENTS_PENDING
      ) {
        await tx.kycCase.update({
          where: { id },
          data: { status: KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED }
        });
        await tx.kycCaseStatusHistory.create({
          data: {
            tenantId: kycCase.tenantId,
            kycCaseId: id,
            fromStatus: kycCase.status,
            toStatus: KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED,
            changedById: user.id,
            note: 'Documents required for KYC preparation uploaded'
          }
        });
      }

      return tx.kycCase.findUniqueOrThrow({
        where: { id },
        include: this.caseInclude()
      });
    });
  }

  async uploadLegalDocumentFile(
    user: RequestUser,
    id: string,
    documentType: string,
    file?: { originalname: string; mimetype?: string; size: number; buffer?: Buffer }
  ) {
    return this.uploadLegalDocumentFiles(user, id, documentType, file ? [file] : []);
  }

  async uploadLegalDocumentFiles(
    user: RequestUser,
    id: string,
    documentType: string,
    files: Array<{ originalname: string; mimetype?: string; size: number; buffer?: Buffer }> = []
  ) {
    if (!documentType?.trim()) {
      throw new BadRequestException('Document type is required');
    }

    if (!files.length) {
      throw new BadRequestException('Upload document files');
    }

    validateUploadFiles(files, ['pdf', 'word', 'excel', 'image'], 'document file');

    const kycCase = await this.requireWritableCase(user, id);
    const uploadableStatuses: KycCaseStatus[] = [
        KycCaseStatus.INQUIRY_RECEIVED,
        KycCaseStatus.PROPOSAL_OPTIONAL,
        KycCaseStatus.LEGAL_DOCUMENTS_PENDING,
        KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED,
        KycCaseStatus.SUPERVISOR_REVIEW_PENDING,
        KycCaseStatus.SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED
    ];
    if (!uploadableStatuses.includes(kycCase.status)) {
      throw new BadRequestException('Document uploads are disabled after submission unless the case is returned for additional information.');
    }

    const uploadRoot = this.legalDocumentUploadRoot();
    const caseDirectory = join(uploadRoot, kycCase.tenantId, kycCase.id);
    mkdirSync(caseDirectory, { recursive: true });

    const documents = files.map((file, index) => {
      const fileName = this.safeFileName(file.originalname);
      const storedFileName = `${Date.now()}-${index}-${fileName}`;
      const absolutePath = join(caseDirectory, storedFileName);
      writeFileSync(absolutePath, file.buffer!);

      return {
        documentType: documentType.trim(),
        fileName,
        storagePath: join(kycCase.tenantId, kycCase.id, storedFileName),
        mimeType: file.mimetype,
        size: file.size
      };
    });

    return this.prisma.$transaction(async (tx) => {
      for (const document of documents) {
        const existingMetadataOnly = await tx.legalDocument.findFirst({
          where: {
            tenantId: kycCase.tenantId,
            kycCaseId: id,
            documentType: document.documentType,
            fileName: document.fileName,
            OR: [{ storagePath: null }, { storagePath: '' }]
          }
        });

        if (existingMetadataOnly) {
          await tx.legalDocument.update({
            where: { id: existingMetadataOnly.id },
            data: {
              storagePath: document.storagePath,
              mimeType: document.mimeType,
              size: document.size,
              uploadedById: user.id
            }
          });
        } else {
          await tx.legalDocument.create({
            data: {
              tenantId: kycCase.tenantId,
              kycCaseId: id,
              documentType: document.documentType,
              fileName: document.fileName,
              storagePath: document.storagePath,
              mimeType: document.mimeType,
              size: document.size,
              uploadedById: user.id
            }
          });
        }
      }

      if (
        kycCase.status === KycCaseStatus.INQUIRY_RECEIVED ||
        kycCase.status === KycCaseStatus.PROPOSAL_OPTIONAL ||
        kycCase.status === KycCaseStatus.LEGAL_DOCUMENTS_PENDING
      ) {
        await tx.kycCase.update({
          where: { id },
          data: { status: KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED }
        });
        await tx.kycCaseStatusHistory.create({
          data: {
            tenantId: kycCase.tenantId,
            kycCaseId: id,
            fromStatus: kycCase.status,
            toStatus: KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED,
            changedById: user.id,
            note: 'Documents required for KYC preparation uploaded'
          }
        });
      }

      return tx.kycCase.findUniqueOrThrow({
        where: { id },
        include: this.caseInclude()
      });
    });
  }

  async getLegalDocumentFile(user: RequestUser, id: string, documentId: string) {
    const kycCase = await this.findOne(user, id);
    const document = kycCase.legalDocuments.find((item) => item.id === documentId);

    if (!document) {
      throw new NotFoundException('Uploaded document not found');
    }

    if (!document.storagePath) {
      throw new NotFoundException('Uploaded file is not available for this document');
    }

    const absolutePath = this.resolveLegalDocumentPath(document.storagePath);

    if (!absolutePath || !existsSync(absolutePath)) {
      throw new NotFoundException('Uploaded file is not available for this document');
    }

    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      content: readFileSync(absolutePath)
    };
  }

  async getLegalDocumentGroupZip(user: RequestUser, id: string, documentType: string) {
    if (!documentType?.trim()) {
      throw new BadRequestException('Document type is required');
    }

    const kycCase = await this.findOne(user, id);
    const documents = kycCase.legalDocuments.filter((item) => item.documentType === documentType && item.storagePath);

    if (!documents.length) {
      throw new NotFoundException('No uploaded files are available for this document group');
    }

    const zip = new PizZip();
    const usedNames = new Set<string>();

    for (const document of documents) {
      const absolutePath = this.resolveLegalDocumentPath(document.storagePath!);
      if (!absolutePath || !existsSync(absolutePath)) continue;

      zip.file(this.uniqueArchiveFileName(document.fileName, usedNames), readFileSync(absolutePath));
    }

    if (!Object.keys(zip.files).length) {
      throw new NotFoundException('Uploaded files are not available for this document group');
    }

    return {
      fileName: `${this.safeFileName(documentType)}.zip`,
      content: zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    };
  }

  async deleteLegalDocument(user: RequestUser, id: string, documentId: string) {
    const kycCase = await this.requireWritableCase(user, id);
    const document = await this.prisma.legalDocument.findFirst({
      where: { id: documentId, kycCaseId: id, tenantId: kycCase.tenantId }
    });

    if (!document) {
      throw new NotFoundException('Uploaded document not found');
    }

    await this.prisma.legalDocument.delete({ where: { id: document.id } });

    if (document.storagePath) {
      const absolutePath = this.resolveLegalDocumentPath(document.storagePath);
      if (absolutePath && existsSync(absolutePath)) {
        unlinkSync(absolutePath);
      }
    }

    return this.prisma.kycCase.findUniqueOrThrow({
      where: { id },
      include: this.caseInclude()
    });
  }

  async submissionReadiness(user: RequestUser, id: string) {
    const kycCase = await this.requireWritableCase(user, id);
    return this.prisma.$transaction(async (tx) => {
      const checks: Array<{ label: string; complete: boolean; message: string }> = [];
      const addCheck = async (label: string, check: () => Promise<void>) => {
        try { await check(); checks.push({ label, complete: true, message: '' }); }
        catch (error) {
          if (!(error instanceof BadRequestException)) throw error;
          checks.push({ label, complete: false, message: error.message });
        }
      };
      await addCheck('Screening', () => this.assertScreeningReady(tx, kycCase));
      await addCheck('CRRF', () => this.assertCrrfReady(tx, kycCase));
      const documents = await tx.legalDocument.count({ where: { tenantId: kycCase.tenantId, kycCaseId: id } });
      checks.push({ label: 'KYC preparation documents', complete: documents > 0, message: documents ? '' : 'Upload at least one document required for KYC preparation.' });
      const review = await tx.kycInternalReview.findFirst({ where: { tenantId: kycCase.tenantId, kycCaseId: id } });
      const comments = hasComment(review?.amlClarificationFindings);
      checks.push({ label: 'AML Supervisor comments', complete: comments, message: comments ? '' : 'Enter AML Supervisor comments below before submitting.' });
      return { ready: checks.every((check) => check.complete), checks, supervisorComments: safeComment(review?.amlClarificationFindings) };
    });
  }

  async submitToAml(user: RequestUser, id: string, dto: Record<string, unknown> = {}) {
    const kycCase = await this.requireWritableCase(user, id);
    const submittableStatuses: KycCaseStatus[] = [
        KycCaseStatus.INQUIRY_RECEIVED,
        KycCaseStatus.PROPOSAL_OPTIONAL,
        KycCaseStatus.LEGAL_DOCUMENTS_PENDING,
        KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED,
        KycCaseStatus.SUPERVISOR_REVIEW_PENDING,
        KycCaseStatus.SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED
    ];
    if (!submittableStatuses.includes(kycCase.status)) {
      throw new BadRequestException('This case has already been submitted. It can be resubmitted only after DMLRO returns it to the AML Supervisor.');
    }

    const documentsCount = await this.prisma.legalDocument.count({
      where: { kycCaseId: id, tenantId: kycCase.tenantId }
    });

    if (!documentsCount) {
      throw new BadRequestException('Upload at least one document required for KYC preparation before submitting to DMLRO');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertReviewPackageReady(tx, kycCase);
      const review = await tx.kycInternalReview.findFirst({ where: { tenantId: kycCase.tenantId, kycCaseId: id } });
      const formalComments = safeComment(dto.formalComments !== undefined ? dto.formalComments : review?.amlClarificationFindings);
      if (!hasComment(formalComments)) throw new BadRequestException('Enter AML Supervisor comments on the submission page before submitting to DMLRO.');
      const submitted = await this.lockReviewSubmission(tx, user, kycCase, ReviewStage.SUPERVISOR, { formalComments, data: { ...(review || {}), amlClarificationFindings: formalComments } });
      await this.audit(tx, user, kycCase.tenantId, 'InternalReviewSubmission', submitted.id, { action: 'REVIEW_SUBMITTED', stage: ReviewStage.SUPERVISOR, routedTo: ReviewStage.DMLRO });
      await tx.internalReviewTask.updateMany({ where: { tenantId: kycCase.tenantId, kycCaseId: id, stage: ReviewStage.SUPERVISOR, status: { in: [ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS, ReviewTaskStatus.PAUSED] } }, data: { status: ReviewTaskStatus.COMPLETED, completedAt: new Date(), updatedBy: user.id } });
      await tx.kycCase.update({
        where: { id },
        data: {
          status: KycCaseStatus.DMLRO_REVIEW_PENDING,
          submittedToAmlAt: new Date()
        }
      });

      await tx.kycCaseStatusHistory.create({
        data: {
          tenantId: kycCase.tenantId,
          kycCaseId: id,
          fromStatus: kycCase.status,
          toStatus: KycCaseStatus.DMLRO_REVIEW_PENDING,
          changedById: user.id,
          note: 'KYC form prepared and submitted to DMLRO'
        }
      });

      await tx.internalReviewTask.upsert({
        where: { kycCaseId_stage_status: { kycCaseId: id, stage: ReviewStage.DMLRO, status: ReviewTaskStatus.PENDING } },
        update: { updatedBy: user.id },
        create: {
          tenantId: kycCase.tenantId,
          kycCaseId: id,
          stage: ReviewStage.DMLRO,
          createdBy: user.id,
          updatedBy: user.id
        }
      });

      await this.createNotification(tx, kycCase, NotificationType.DMLRO_TASK_ASSIGNED, 'DMLRO review task assigned', `${kycCase.title} is ready for DMLRO review.`);

      return tx.kycCase.findUniqueOrThrow({
        where: { id },
        include: this.caseInclude()
      });
    });
  }

  async startAmlReview(user: RequestUser, id: string) {
    const kycCase = await this.findOne(user, id);

    if (!this.isSubmittedToAml(kycCase.status)) {
      throw new BadRequestException('Case must be submitted to AML before review starts');
    }

    await this.ensureReviewTask(user, id, ReviewStage.SUPERVISOR, NotificationType.SUPERVISOR_TASK_ASSIGNED);

    return this.updateStatus(user, id, KycCaseStatus.SUPERVISOR_REVIEW_PENDING, 'Supervisor review task assigned', {
      amlAssigneeId: user.id,
      amlReviewStartedAt: new Date()
    });
  }

  async returnToBusinessDevelopment(user: RequestUser, id: string, reason: string) {
    if (!this.hasAnyRole(user, ['AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
      throw new ForbiddenException('Only AML users can return a KYC case to BD.');
    }

    const note = this.optionalText(reason);
    if (!note) throw new BadRequestException('Provide a reason before returning the KYC case to BD.');

    const kycCase = await this.findOne(user, id);
    if (!kycCase.sourceEnquiryId) {
      throw new BadRequestException('Only KYC cases created from an enquiry can be returned to BD.');
    }
    const returnableStatuses: KycCaseStatus[] = [
      KycCaseStatus.INQUIRY_RECEIVED,
      KycCaseStatus.PROPOSAL_OPTIONAL,
      KycCaseStatus.LEGAL_DOCUMENTS_PENDING,
      KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED,
      KycCaseStatus.SUBMITTED_TO_AML,
      KycCaseStatus.AML_REVIEW_STARTED,
      KycCaseStatus.SUPERVISOR_REVIEW_PENDING,
      KycCaseStatus.SUPERVISOR_REVIEW_IN_PROGRESS,
      KycCaseStatus.SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED
    ];
    if (!returnableStatuses.includes(kycCase.status)) {
      throw new BadRequestException('The KYC case can be returned to BD only while it is with AML Supervisor.');
    }

    return this.prisma.$transaction(async (tx) => {
      const enquiry = await tx.enquiry.findFirst({ where: { id: kycCase.sourceEnquiryId!, tenantId: kycCase.tenantId } });
      if (!enquiry) throw new NotFoundException('Source enquiry not found.');

      await tx.enquiry.update({ where: { id: enquiry.id }, data: { status: EnquiryStatus.RETURNED_TO_BD } });
      await tx.enquiryStatusHistory.create({
        data: { tenantId: enquiry.tenantId, enquiryId: enquiry.id, fromStatus: enquiry.status, toStatus: EnquiryStatus.RETURNED_TO_BD, changedById: user.id, note }
      });
      await tx.kycCase.update({ where: { id }, data: { status: KycCaseStatus.RETURNED_TO_BD } });
      await tx.kycCaseStatusHistory.create({
        data: { tenantId: kycCase.tenantId, kycCaseId: id, fromStatus: kycCase.status, toStatus: KycCaseStatus.RETURNED_TO_BD, changedById: user.id, note: `Returned to BD: ${note}` }
      });
      await tx.internalReviewTask.updateMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id, stage: ReviewStage.SUPERVISOR, status: { in: [ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS, ReviewTaskStatus.PAUSED] } },
        data: { status: ReviewTaskStatus.RETURNED, completedAt: new Date(), updatedBy: user.id }
      });

      const recipients = await tx.user.findMany({ where: { tenantId: enquiry.tenantId, roles: { some: { role: { name: 'OPERATING_TEAM' } } } }, select: { id: true } });
      await tx.notification.createMany({
        data: (recipients.length ? recipients : [{ id: null }]).map((recipient) => ({
          tenantId: enquiry.tenantId,
          enquiryId: enquiry.id,
          kycCaseId: id,
          recipientId: recipient.id,
          type: NotificationType.ADDITIONAL_INFORMATION_REQUESTED,
          title: 'KYC case returned to BD',
          message: `${kycCase.title} requires BD updates: ${note}`
        }))
      });

      return tx.kycCase.findUniqueOrThrow({ where: { id }, include: this.caseInclude() });
    });
  }

  async getInternalReviewWorkspace(user: RequestUser, id: string) {
    const kycCase = await this.findOne(user, id);
    const confidentialWhere = this.confidentialCommentWhere(user);

    return {
      kycCase,
      tasks: await this.prisma.internalReviewTask.findMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id },
        include: { assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'asc' }
      }),
      reviews: await this.prisma.internalReviewSubmission.findMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id },
        include: { submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'asc' }
      }),
      comments: await this.prisma.reviewerComment.findMany({
        where: {
          tenantId: kycCase.tenantId,
          kycCaseId: id,
          OR: [{ type: ReviewCommentType.FORMAL }, confidentialWhere]
        },
        include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      signedDocuments: await this.prisma.signedKycDocument.findMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id },
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: [{ reviewStage: 'asc' }, { documentVersion: 'desc' }]
      }),
      riskReclassifications: await this.prisma.riskReclassification.findMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id },
        orderBy: { createdAt: 'desc' }
      }),
      activationChecklist: await this.recalculateActivationReadiness(user, id)
    };
  }

  async startReviewStage(user: RequestUser, id: string, stage: ReviewStage) {
    this.assertStageRole(user, stage);
    const kycCase = await this.findOne(user, id);
    await this.assertPreviousStageComplete(kycCase.id, stage);
    if (![this.stageStatus(stage, 'pending'), this.stageStatus(stage, 'inProgress')].includes(kycCase.status)) {
      throw new BadRequestException(`${this.stageLabel(stage)} is not the active review stage for this case.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.internalReviewTask.upsert({
        where: { kycCaseId_stage_status: { kycCaseId: id, stage, status: ReviewTaskStatus.PENDING } },
        update: { status: ReviewTaskStatus.IN_PROGRESS, assignedToId: user.id, startedAt: new Date(), updatedBy: user.id },
        create: {
          tenantId: kycCase.tenantId,
          kycCaseId: id,
          stage,
          status: ReviewTaskStatus.IN_PROGRESS,
          assignedToId: user.id,
          startedAt: new Date(),
          createdBy: user.id,
          updatedBy: user.id
        }
      });

      const status = this.stageStatus(stage, 'inProgress');
      await this.recordStatus(tx, kycCase, user, status, `${this.stageLabel(stage)} review started`);
      await this.audit(tx, user, kycCase.tenantId, 'InternalReviewTask', task.id, { action: 'REVIEW_STARTED', stage });
      return task;
    });
  }

  async saveReviewDraft(user: RequestUser, id: string, stage: ReviewStage, dto: Record<string, unknown>) {
    this.assertStageRole(user, stage);
    const kycCase = await this.findOne(user, id);
    await this.assertEditableReview(id, stage);

    return this.prisma.internalReviewSubmission.upsert({
      where: { kycCaseId_stage: { kycCaseId: id, stage } },
      update: {
        data: this.jsonValue(dto.data || dto),
        formalComments: safeComment(dto.formalComments) || null,
        confidentialNotes: this.optionalText(dto.confidentialNotes),
        updatedBy: user.id
      },
      create: {
        tenantId: kycCase.tenantId,
        kycCaseId: id,
        stage,
        data: this.jsonValue(dto.data || dto),
        formalComments: safeComment(dto.formalComments) || null,
        confidentialNotes: this.optionalText(dto.confidentialNotes),
        createdBy: user.id,
        updatedBy: user.id
      }
    });
  }

  async submitSupervisorReview(user: RequestUser, id: string, dto: Record<string, unknown>) {
    this.assertStageRole(user, ReviewStage.SUPERVISOR);
    await this.assertReviewStageActive(id, ReviewStage.SUPERVISOR);
    if (!hasComment(dto.formalComments)) throw new BadRequestException('Add AML Supervisor comments before submitting the review.');
    return this.submitReviewAndRoute(user, id, ReviewStage.SUPERVISOR, dto, ReviewStage.DMLRO);
  }

  async submitDmlroReview(user: RequestUser, id: string, dto: Record<string, unknown>) {
    this.assertStageRole(user, ReviewStage.DMLRO);
    await this.assertReviewStageActive(id, ReviewStage.DMLRO);
    if (!hasComment(dto.formalComments)) throw new BadRequestException('Add DMLRO comments before submitting the review.');
    const decision = this.enumValue(dto.decision || 'APPROVE', ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'DMLRO_FINAL_APPROVE', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_SUPERVISOR'], 'DMLRO decision') as ReviewDecision;
    const reason = this.optionalText(dto.reason);
    const conditions = this.optionalText(dto.conditions);

    const decisionsRequiringReason: ReviewDecision[] = [
      ReviewDecision.APPROVE_WITH_CONDITIONS,
      ReviewDecision.REQUEST_ADDITIONAL_INFORMATION,
      ReviewDecision.RETURN_TO_SUPERVISOR,
      'DMLRO_FINAL_APPROVE' as ReviewDecision
    ];
    if (decisionsRequiringReason.includes(decision) && !reason && !conditions) {
      throw new BadRequestException('Provide DMLRO comments, reason, or conditions for this decision');
    }

    if (decision === ReviewDecision.APPROVE || decision === ReviewDecision.APPROVE_WITH_CONDITIONS) {
      return this.submitReviewAndRoute(user, id, ReviewStage.DMLRO, { ...dto, decision }, ReviewStage.MLRO);
    }

    if ((decision as string) === 'DMLRO_FINAL_APPROVE') {
      const kycCase = await this.findOne(user, id);
      await this.assertEditableReview(id, ReviewStage.DMLRO);
      return this.prisma.$transaction(async (tx) => {
        const saved = await this.lockReviewSubmission(tx, user, kycCase, ReviewStage.DMLRO, dto);
        await this.recordStatus(tx, kycCase, user, KycCaseStatus.MLRO_APPROVED, 'DMLRO final approval recorded during MLRO absence');
        await tx.internalReviewTask.updateMany({
          where: { tenantId: kycCase.tenantId, kycCaseId: id, status: { in: [ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS, ReviewTaskStatus.PAUSED] } },
          data: { status: ReviewTaskStatus.COMPLETED, completedAt: new Date(), updatedBy: user.id }
        });
        await this.audit(tx, user, kycCase.tenantId, 'InternalReviewSubmission', saved.id, { action: 'DMLRO_FINAL_APPROVAL_WITHOUT_MLRO', reason: reason || conditions });
        await this.createNotification(tx, kycCase, NotificationType.MLRO_APPROVAL_COMPLETED, 'DMLRO final approval completed', `${kycCase.title} was approved by DMLRO during MLRO absence.`);
        await this.upsertActivationChecklist(tx, user, kycCase);
        return tx.kycCase.findUniqueOrThrow({ where: { id }, include: this.caseInclude() });
      });
    }

    return this.returnDmlroReviewToSupervisor(user, id, { ...dto, decision });
  }

  async decideMlroReview(user: RequestUser, id: string, dto: Record<string, unknown>) {
    this.assertStageRole(user, ReviewStage.MLRO);
    await this.assertReviewStageActive(id, ReviewStage.MLRO);
    await this.assertPreviousStageComplete(id, ReviewStage.MLRO);
    const decision = this.enumValue(dto.decision, ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_DMLRO', 'SEND_TO_SEF'], 'MLRO decision') as ReviewDecision;
    const kycCase = await this.findOne(user, id);
    const dmlroSubmission = await this.prisma.internalReviewSubmission.findUnique({
      where: { kycCaseId_stage: { kycCaseId: id, stage: ReviewStage.DMLRO } }
    });
    const bypassingDmlro = !dmlroSubmission?.isLocked;

    const decisionsRequiringReason: ReviewDecision[] = [
      ReviewDecision.REJECT,
      ReviewDecision.APPROVE_WITH_CONDITIONS,
      ReviewDecision.REQUEST_ADDITIONAL_INFORMATION,
      ReviewDecision.RETURN_TO_DMLRO,
      ReviewDecision.SEND_TO_SEF
    ];
    if (decisionsRequiringReason.includes(decision) && !this.optionalText(dto.reason) && !this.optionalText(dto.conditions)) {
      throw new BadRequestException('Provide a reason or conditions for this MLRO decision');
    }

    if (bypassingDmlro && !this.optionalText(dto.reason) && !this.optionalText(dto.conditions) && !this.optionalText(dto.riskExplanation)) {
      throw new BadRequestException('Provide the reason for approving or deciding this case before DMLRO review is completed');
    }

    if (dto.finalRiskClassification && dto.finalRiskClassification !== dto.previousRiskClassification && !this.optionalText(dto.riskExplanation)) {
      throw new BadRequestException('Risk classification changes require an explanation');
    }

    const finalRiskClassification = this.optionalText(dto.finalRiskClassification);
    if (
      finalRiskClassification === RiskClassification.HIGH &&
      (decision === ReviewDecision.APPROVE || decision === ReviewDecision.APPROVE_WITH_CONDITIONS)
    ) {
      throw new BadRequestException('High-risk KYC files must be sent to SEF for management decision before final approval.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
      const saved = await this.lockReviewSubmission(tx, user, kycCase, ReviewStage.MLRO, dto);
      const targetStatus = this.mlroDecisionStatus(decision);
      await this.recordStatus(tx, kycCase, user, targetStatus, this.mlroStatusNote(decision));
      const finalReviewForm = await tx.kycForm.findUnique({ where: { kycCaseId: id }, select: { status: true } });
      if (finalReviewForm?.status === 'PRELIMINARY_FINAL_REVIEW' && (decision === ReviewDecision.APPROVE || decision === ReviewDecision.APPROVE_WITH_CONDITIONS)) {
        await tx.kycForm.update({ where: { kycCaseId: id }, data: { status: 'FINAL', isLocked: true, updatedBy: user.id } });
        await this.recordStatus(tx, kycCase, user, KycCaseStatus.KYC_FINAL_APPROVED, 'Final DMLRO and MLRO approval completed for the Preliminary KYC.');
      }
      await this.clearReviewTaskStatus(tx, id, ReviewStage.MLRO, ReviewTaskStatus.COMPLETED);
      await tx.internalReviewTask.updateMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id, stage: ReviewStage.MLRO, status: { in: [ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS, ReviewTaskStatus.PAUSED] } },
        data: { status: ReviewTaskStatus.COMPLETED, completedAt: new Date(), updatedBy: user.id }
      });

      if (dto.finalRiskClassification) {
        await this.saveRiskReclassification(tx, user, kycCase, dto);
      }

      if (decision === ReviewDecision.SEND_TO_SEF) {
        await tx.internalReviewTask.upsert({
          where: { kycCaseId_stage_status: { kycCaseId: id, stage: ReviewStage.SEF, status: ReviewTaskStatus.PENDING } },
          update: { updatedBy: user.id },
          create: {
            tenantId: kycCase.tenantId,
            kycCaseId: id,
            stage: ReviewStage.SEF,
            status: ReviewTaskStatus.PENDING,
            createdBy: user.id,
            updatedBy: user.id
          }
        });

        await this.createNotification(tx, kycCase, NotificationType.SEF_TASK_ASSIGNED, 'SEF decision requested', `${kycCase.title} requires SEF management decision.`);
      }

      if (decision === ReviewDecision.RETURN_TO_DMLRO) {
        await tx.internalReviewSubmission.updateMany({
          where: { tenantId: kycCase.tenantId, kycCaseId: id, stage: ReviewStage.DMLRO },
          data: { status: ReviewSubmissionStatus.REOPENED, isLocked: false, updatedBy: user.id }
        });
        await tx.internalReviewTask.upsert({
          where: { kycCaseId_stage_status: { kycCaseId: id, stage: ReviewStage.DMLRO, status: ReviewTaskStatus.PENDING } },
          update: { updatedBy: user.id },
          create: {
            tenantId: kycCase.tenantId,
            kycCaseId: id,
            stage: ReviewStage.DMLRO,
            status: ReviewTaskStatus.PENDING,
            createdBy: user.id,
            updatedBy: user.id
          }
        });
        await this.createNotification(tx, kycCase, NotificationType.DMLRO_TASK_ASSIGNED, 'Returned to DMLRO', `${kycCase.title} was returned by MLRO for DMLRO action.`);
      }

      await this.audit(tx, user, kycCase.tenantId, 'InternalReviewSubmission', saved.id, { action: 'MLRO_DECISION', decision });
      if (decision !== ReviewDecision.SEND_TO_SEF) {
        await this.createNotification(tx, kycCase, this.mlroNotificationType(decision), this.mlroNotificationTitle(decision), this.mlroNotificationMessage(kycCase.title, decision));
      }
      await this.upsertActivationChecklist(tx, user, kycCase);
      return tx.kycCase.findUniqueOrThrow({ where: { id }, include: this.caseInclude() });
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (decision === ReviewDecision.SEND_TO_SEF) {
        throw new InternalServerErrorException('Unable to send KYC file to SEF. Confirm the latest database migrations are applied and try again.');
      }
      throw error;
    }
  }

  async decideSefReview(user: RequestUser, id: string, dto: Record<string, unknown>) {
    this.assertStageRole(user, ReviewStage.SEF);
    await this.assertReviewStageActive(id, ReviewStage.SEF);
    const decision = this.enumValue(dto.decision, ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'RETURN_TO_MLRO', 'REJECT'], 'SEF decision') as ReviewDecision;
    const kycCase = await this.findOne(user, id);
    await this.assertPreviousStageComplete(id, ReviewStage.SEF);

    const sefDecisionsRequiringReason: ReviewDecision[] = [ReviewDecision.APPROVE_WITH_CONDITIONS, ReviewDecision.RETURN_TO_MLRO, ReviewDecision.REJECT];
    if (sefDecisionsRequiringReason.includes(decision) && !this.optionalText(dto.reason) && !this.optionalText(dto.conditions)) {
      throw new BadRequestException('Provide SEF reason or conditions for this decision');
    }

    return this.prisma.$transaction(async (tx) => {
      const saved = await this.lockReviewSubmission(tx, user, kycCase, ReviewStage.SEF, dto);
      if (decision === ReviewDecision.RETURN_TO_MLRO) {
        await this.recordStatus(tx, kycCase, user, KycCaseStatus.MLRO_REVIEW_PENDING, 'SEF returned the KYC file to MLRO for further review.');
        await tx.internalReviewSubmission.updateMany({ where: { tenantId: kycCase.tenantId, kycCaseId: id, stage: ReviewStage.MLRO }, data: { status: ReviewSubmissionStatus.REOPENED, isLocked: false, updatedBy: user.id } });
        await tx.internalReviewTask.upsert({ where: { kycCaseId_stage_status: { kycCaseId: id, stage: ReviewStage.MLRO, status: ReviewTaskStatus.PENDING } }, update: { updatedBy: user.id }, create: { tenantId: kycCase.tenantId, kycCaseId: id, stage: ReviewStage.MLRO, status: ReviewTaskStatus.PENDING, createdBy: user.id, updatedBy: user.id } });
        await this.clearReviewTaskStatus(tx, id, ReviewStage.SEF, ReviewTaskStatus.COMPLETED);
        await this.createNotification(tx, kycCase, NotificationType.MLRO_TASK_ASSIGNED, 'Returned to MLRO', `${kycCase.title} was returned by SEF for further MLRO review.`);
        await this.audit(tx, user, kycCase.tenantId, 'InternalReviewSubmission', saved.id, { action: 'SEF_RETURN_TO_MLRO' });
        return tx.kycCase.findUniqueOrThrow({ where: { id }, include: this.caseInclude() });
      }
      const targetStatus = decision === ReviewDecision.REJECT ? KycCaseStatus.SEF_REJECTED : KycCaseStatus.SEF_APPROVED;
      await this.recordStatus(tx, kycCase, user, targetStatus, `SEF decision: ${decision}`);
      await this.clearReviewTaskStatus(tx, id, ReviewStage.SEF, ReviewTaskStatus.COMPLETED);
      await tx.internalReviewTask.updateMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id, stage: ReviewStage.SEF, status: { in: [ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS, ReviewTaskStatus.PAUSED] } },
        data: { status: ReviewTaskStatus.COMPLETED, completedAt: new Date(), updatedBy: user.id }
      });
      await this.audit(tx, user, kycCase.tenantId, 'InternalReviewSubmission', saved.id, { action: 'SEF_DECISION', decision });
      await this.createNotification(tx, kycCase, NotificationType.SEF_DECISION_COMPLETED, 'SEF decision completed', `${kycCase.title}: ${decision}`);
      await this.upsertActivationChecklist(tx, user, kycCase);
      return tx.kycCase.findUniqueOrThrow({ where: { id }, include: this.caseInclude() });
    });
  }

  async addReviewerComment(user: RequestUser, id: string, stage: ReviewStage, dto: Record<string, unknown>) {
    const kycCase = await this.findOne(user, id);
    const type = this.enumValue(dto.type || 'FORMAL', ['FORMAL', 'CONFIDENTIAL'], 'Comment type') as ReviewCommentType;
    if (type === ReviewCommentType.CONFIDENTIAL && !this.hasAnyRole(user, ['AML_SUPERVISOR', 'AML_TEAM', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
      throw new ForbiddenException('You cannot create confidential reviewer comments');
    }

    const comment = await this.prisma.reviewerComment.create({
      data: {
        tenantId: kycCase.tenantId,
        kycCaseId: id,
        stage,
        type,
        visibilityScope: type === ReviewCommentType.CONFIDENTIAL ? (this.enumValue(dto.visibilityScope || 'SUPERVISOR_DMLRO_MLRO', ['SUPERVISOR_DMLRO_MLRO', 'DMLRO_MLRO', 'MLRO_ONLY'], 'Visibility scope') as ConfidentialVisibilityScope) : null,
        body: this.requiredText(dto.body, 'Comment'),
        authorId: user.id
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: kycCase.tenantId,
        actorId: user.id,
        action: 'CREATE',
        entityType: type === ReviewCommentType.CONFIDENTIAL ? 'ConfidentialComment' : 'ReviewerComment',
        entityId: comment.id,
        metadata: this.jsonValue({ stage, type })
      }
    });

    return comment;
  }

  async uploadSignedKycDocument(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const kycCase = await this.findOne(user, id);
    const reviewStage = this.enumValue(dto.reviewStage, ['DMLRO_SIGNED_KYC', 'MLRO_SIGNED_KYC', 'FINAL_SIGNED_KYC'], 'Signed KYC document stage') as SignedKycDocumentStage;
    if (reviewStage === SignedKycDocumentStage.DMLRO_SIGNED_KYC && !this.hasAnyRole(user, ['DMLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
      throw new ForbiddenException('Only DMLRO can upload this signed KYC document');
    }
    if (reviewStage === SignedKycDocumentStage.MLRO_SIGNED_KYC && !this.hasAnyRole(user, ['MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
      throw new ForbiddenException('Only MLRO can upload this signed KYC document');
    }

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.signedKycDocument.findFirst({
        where: { tenantId: kycCase.tenantId, kycCaseId: id, reviewStage },
        orderBy: { documentVersion: 'desc' }
      });
      await tx.signedKycDocument.updateMany({ where: { tenantId: kycCase.tenantId, kycCaseId: id, reviewStage }, data: { activeVersion: false } });
      const document = await tx.signedKycDocument.create({
        data: {
          tenantId: kycCase.tenantId,
          kycCaseId: id,
          reviewStage,
          fileName: this.requiredText(dto.fileName, 'File name'),
          fileType: this.optionalText(dto.fileType),
          fileSize: dto.fileSize === undefined || dto.fileSize === '' ? null : Number(dto.fileSize),
          storageKey: this.optionalText(dto.storageKey),
          signatureType: this.optionalText(dto.signatureType),
          comments: this.optionalText(dto.comments),
          documentVersion: (latest?.documentVersion || 0) + 1,
          uploadedById: user.id
        }
      });
      await this.audit(tx, user, kycCase.tenantId, 'SignedKycDocument', document.id, { action: 'SIGNED_KYC_UPLOADED', reviewStage });
      await this.createNotification(tx, kycCase, NotificationType.SIGNED_KYC_UPLOADED, 'Signed KYC uploaded', `${document.fileName} uploaded`);
      return document;
    });
  }

  async uploadSignedKycDocumentFile(
    user: RequestUser,
    id: string,
    reviewStageValue: string,
    file?: { originalname: string; mimetype?: string; size: number; buffer?: Buffer }
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Upload a signed KYC document file');
    }
    validateUploadFile(file, ['pdf', 'word', 'image'], 'signed KYC document');

    const kycCase = await this.findOne(user, id);
    const reviewStage = this.enumValue(reviewStageValue, ['DMLRO_SIGNED_KYC', 'MLRO_SIGNED_KYC', 'FINAL_SIGNED_KYC'], 'Signed KYC document stage') as SignedKycDocumentStage;
    if (reviewStage === SignedKycDocumentStage.DMLRO_SIGNED_KYC && !this.hasAnyRole(user, ['DMLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
      throw new ForbiddenException('Only DMLRO can upload this signed KYC document');
    }
    if (reviewStage === SignedKycDocumentStage.MLRO_SIGNED_KYC && !this.hasAnyRole(user, ['MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
      throw new ForbiddenException('Only MLRO can upload this signed KYC document');
    }

    const uploadRoot = this.signedKycDocumentUploadRoot();
    const caseDirectory = join(uploadRoot, kycCase.tenantId, kycCase.id);
    mkdirSync(caseDirectory, { recursive: true });

    const fileName = this.safeFileName(file.originalname);
    const storedFileName = `${Date.now()}-${fileName}`;
    const absolutePath = join(caseDirectory, storedFileName);
    writeFileSync(absolutePath, file.buffer);

    return this.uploadSignedKycDocument(user, id, {
      reviewStage,
      fileName,
      fileType: file.mimetype,
      fileSize: file.size,
      storageKey: join(kycCase.tenantId, kycCase.id, storedFileName),
      signatureType: 'UPLOADED'
    });
  }

  async recalculateActivationReadiness(user: RequestUser, id: string) {
    const kycCase = await this.prisma.kycCase.findFirst({
      where: { id, ...this.tenantWhere(user) },
      include: {
        legalDocuments: true,
        kycForm: { include: { sections: true, requiredDocuments: true, internalReview: true } },
        internalReviewSubmissions: true,
        signedKycDocuments: true,
        riskReclassifications: true
      }
    });

    if (!kycCase) throw new NotFoundException('KYC case not found');
    const checklist = this.activationChecklistItems(kycCase);
    const isReady = checklist.every((item) => item.completed);
    const blockingIssues = checklist.filter((item) => !item.completed);

    return this.prisma.clientActivationChecklist.upsert({
      where: { kycCaseId: id },
      update: {
        checklist: this.jsonValue(checklist),
        isReady,
        blockingIssues: this.jsonValue(blockingIssues),
        completedAt: isReady ? new Date() : null,
        updatedBy: user.id
      },
      create: {
        tenantId: kycCase.tenantId,
        kycCaseId: id,
        checklist: this.jsonValue(checklist),
        isReady,
        blockingIssues: this.jsonValue(blockingIssues),
        completedAt: isReady ? new Date() : null,
        createdBy: user.id,
        updatedBy: user.id
      }
    });
  }

  async addComment(user: RequestUser, id: string, dto: AddWorkflowCommentDto) {
    const kycCase = await this.findOne(user, id);

    await this.prisma.workflowComment.create({
      data: {
        tenantId: kycCase.tenantId,
        kycCaseId: id,
        authorId: user.id,
        body: dto.body
      }
    });

    return this.findOne(user, id);
  }

  async completeEngagementDecision(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const kycCase = await this.findOne(user, id);
    const approvedStatuses: KycCaseStatus[] = [
      KycCaseStatus.KYC_FINAL_APPROVED,
      KycCaseStatus.CLIENT_ACTIVATION_PENDING
    ];
    if (!approvedStatuses.includes(kycCase.status)) {
      throw new BadRequestException('The KYC file must receive final approval before the engagement decision.');
    }
    if (!kycCase.legalDocuments.some((document) => document.documentType === 'Signed Engagement Letter' && document.storagePath)) {
      throw new BadRequestException('Upload the signed engagement letter before completing the engagement decision.');
    }

    const decision = this.enumValue(dto.decision, ['CONVERT_TO_CLIENT', 'REJECT', 'ON_HOLD'], 'engagement decision');
    const reason = this.optionalText(dto.reason);
    if (decision !== 'CONVERT_TO_CLIENT' && !reason) {
      throw new BadRequestException('Provide a reason for rejecting or placing the engagement on hold.');
    }
    const targetStatus = decision === 'CONVERT_TO_CLIENT'
      ? KycCaseStatus.CLIENT_ACTIVE
      : decision === 'ON_HOLD'
        ? KycCaseStatus.CLIENT_ON_HOLD
        : KycCaseStatus.CLIENT_REJECTED;
    await this.prisma.client.update({
      where: { id: kycCase.clientId },
      data: { status: decision === 'CONVERT_TO_CLIENT' ? 'ACTIVE' : decision === 'ON_HOLD' ? 'ON_HOLD' : 'REJECTED' }
    });
    const note = decision === 'CONVERT_TO_CLIENT'
      ? 'Signed engagement accepted; inquiry converted and client activated'
      : decision === 'ON_HOLD'
        ? `Signed engagement placed on hold: ${reason}`
        : `Signed engagement rejected: ${reason}`;
    return this.updateStatus(user, id, targetStatus, note);
  }

  async completeFinalKycDecision(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const decision = this.enumValue(dto.decision, ['SAME_KYC_FINAL', 'AMENDMENT_REQUIRED'], 'final KYC decision');

    const kycCase = await this.findOne(user, id);
    const isPreliminaryCase = await this.isPreliminaryProposedCompanyCase(kycCase.sourceEnquiryId);
    if (isPreliminaryCase) {
      this.assertFinalApprovalReceived(kycCase.status);
      if (!this.hasAnyRole(user, ['AML_SUPERVISOR', 'AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
        throw new ForbiddenException('Only AML Supervisor can decide whether the approved Preliminary KYC is final.');
      }
      if (decision === 'AMENDMENT_REQUIRED') return this.startPreliminaryFullKyc(user, kycCase, dto);
      return this.routePreliminaryFinalKycForApproval(user, kycCase);
    }

    if (decision === 'AMENDMENT_REQUIRED') {
      return this.startAmendment(user, id, dto);
    }

    this.assertFinalApprovalReceived(kycCase.status);
    const approvalOwnerRoles = kycCase.status === KycCaseStatus.SEF_APPROVED ? ['SEF'] : ['MLRO'];
    if (!this.hasAnyRole(user, [...approvalOwnerRoles, 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
      throw new ForbiddenException('The final KYC decision must be completed by the approving MLRO or SEF role.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.kycForm.updateMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id },
        data: { isLocked: true, status: 'FINAL', updatedBy: user.id }
      });
      await this.recordStatus(tx, kycCase, user, KycCaseStatus.KYC_FINAL_APPROVED, 'Approving review role confirmed the KYC as the final KYC.');
      await this.audit(tx, user, kycCase.tenantId, 'KycCase', id, { action: 'APPROVED_KYC_MARKED_FINAL' });
      await this.createNotification(tx, kycCase, NotificationType.CLIENT_READY_FOR_ACTIVATION, 'Final KYC completed', `${kycCase.title} was marked as the final KYC and is ready for the engagement decision.`);
      return tx.kycCase.findUniqueOrThrow({ where: { id }, include: this.caseInclude() });
    });
  }

  async startAmendment(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const kycCase = await this.findOne(user, id);
    this.assertFinalApprovalReceived(kycCase.status);
    const approvalOwnerRoles = kycCase.status === KycCaseStatus.SEF_APPROVED ? ['SEF'] : ['MLRO'];
    if (!this.hasAnyRole(user, [...approvalOwnerRoles, 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
      throw new ForbiddenException('The final KYC decision must be completed by the approving MLRO or SEF role.');
    }
    const sections = Array.isArray(dto.sections) ? dto.sections.map((value) => this.optionalText(value)).filter(Boolean) as string[] : [];
    const reason = this.optionalText(dto.reason);
    if (!sections.length) throw new BadRequestException('Select at least one KYC section to amend.');
    if (!reason) throw new BadRequestException('Provide the amendment reason.');

    return this.prisma.$transaction(async (tx) => {
      await tx.kycForm.updateMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id },
        data: { isLocked: false, status: 'AMENDMENT_DRAFT', version: { increment: 1 }, updatedBy: user.id }
      });
      await tx.internalReviewSubmission.updateMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id },
        data: { status: ReviewSubmissionStatus.REOPENED, isLocked: false, updatedBy: user.id }
      });
      await tx.internalReviewTask.deleteMany({ where: { tenantId: kycCase.tenantId, kycCaseId: id } });
      await tx.workflowComment.create({
        data: { tenantId: kycCase.tenantId, kycCaseId: id, authorId: user.id, body: `KYC amendment requested for ${sections.join(', ')}. Reason: ${reason}` }
      });
      await this.recordStatus(tx, kycCase, user, KycCaseStatus.AML_REVIEW_STARTED, `KYC amendment started for: ${sections.join(', ')}`);
      await this.audit(tx, user, kycCase.tenantId, 'KycCase', id, { action: 'KYC_AMENDMENT_STARTED', sections, reason });
      return tx.kycCase.findUniqueOrThrow({ where: { id }, include: this.caseInclude() });
    });
  }

  private async routePreliminaryFinalKycForApproval(user: RequestUser, kycCase: Awaited<ReturnType<KycService['findOne']>>) {
    return this.prisma.$transaction(async (tx) => {
      await tx.kycForm.updateMany({ where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id }, data: { status: 'PRELIMINARY_FINAL_REVIEW', isLocked: true, updatedBy: user.id } });
      await tx.internalReviewSubmission.updateMany({ where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id, stage: { in: [ReviewStage.DMLRO, ReviewStage.MLRO] } }, data: { status: ReviewSubmissionStatus.REOPENED, isLocked: false, updatedBy: user.id } });
      await tx.internalReviewTask.deleteMany({ where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id, stage: { in: [ReviewStage.DMLRO, ReviewStage.MLRO] } } });
      await tx.internalReviewTask.createMany({ data: [ReviewStage.DMLRO, ReviewStage.MLRO].map((stage) => ({ tenantId: kycCase.tenantId, kycCaseId: kycCase.id, stage, createdBy: user.id, updatedBy: user.id })) });
      await this.recordStatus(tx, kycCase, user, KycCaseStatus.DMLRO_REVIEW_PENDING, 'AML Supervisor marked the approved Preliminary KYC as final and sent it for final DMLRO and MLRO approval.');
      await this.createNotification(tx, kycCase, NotificationType.DMLRO_TASK_ASSIGNED, 'Final Preliminary KYC approval requested', `${kycCase.title} requires final DMLRO approval.`);
      await this.createNotification(tx, kycCase, NotificationType.MLRO_TASK_ASSIGNED, 'Final Preliminary KYC approval requested', `${kycCase.title} requires final MLRO approval.`);
      return tx.kycCase.findUniqueOrThrow({ where: { id: kycCase.id }, include: this.caseInclude() });
    });
  }

  private async startPreliminaryFullKyc(user: RequestUser, kycCase: Awaited<ReturnType<KycService['findOne']>>, dto: Record<string, unknown>) {
    const reason = this.optionalText(dto.reason) || 'AML Supervisor requested completion of the full KYC form after Preliminary KYC approval.';
    return this.prisma.$transaction(async (tx) => {
      await tx.kycForm.updateMany({ where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id }, data: { status: 'AMENDMENT_DRAFT', isLocked: false, version: { increment: 1 }, updatedBy: user.id } });
      await tx.internalReviewSubmission.updateMany({ where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id }, data: { status: ReviewSubmissionStatus.REOPENED, isLocked: false, updatedBy: user.id } });
      await tx.internalReviewTask.deleteMany({ where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id } });
      await tx.workflowComment.create({ data: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id, authorId: user.id, body: reason } });
      await this.recordStatus(tx, kycCase, user, KycCaseStatus.AML_REVIEW_STARTED, 'AML Supervisor opened the populated full KYC form for completion.');
      return tx.kycCase.findUniqueOrThrow({ where: { id: kycCase.id }, include: this.caseInclude() });
    });
  }

  private async isPreliminaryProposedCompanyCase(sourceEnquiryId?: string | null) {
    if (!sourceEnquiryId) return false;
    const enquiry = await this.prisma.enquiry.findUnique({ where: { id: sourceEnquiryId }, select: { enquiryType: true } });
    return enquiry?.enquiryType === EnquiryType.PROPOSED_COMPANY;
  }

  private assertFinalApprovalReceived(status: KycCaseStatus) {
    const approvedStatuses: KycCaseStatus[] = [
      KycCaseStatus.MLRO_APPROVED,
      KycCaseStatus.MLRO_APPROVED_WITH_CONDITIONS,
      KycCaseStatus.SEF_APPROVED
    ];
    if (!approvedStatuses.includes(status)) {
      throw new BadRequestException('The final KYC decision is available only after all required approvals are completed.');
    }
  }

  async getTimeline(user: RequestUser, id: string) {
    const kycCase = await this.findOne(user, id);

    return this.prisma.kycCaseStatusHistory.findMany({
      where: { tenantId: kycCase.tenantId, kycCaseId: id },
      include: {
        changedBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async createForm(user: RequestUser, id: string) {
    const kycCase = await this.findOne(user, id);

    return this.prisma.kycForm.upsert({
      where: { kycCaseId: id },
      update: { updatedBy: user.id },
      create: {
        tenantId: kycCase.tenantId,
        kycCaseId: id,
        createdBy: user.id,
        updatedBy: user.id
      },
      include: this.formInclude()
    });
  }

  async getForm(user: RequestUser, id: string) {
    await this.findOne(user, id);
    const form = await this.prisma.kycForm.findUnique({
      where: { kycCaseId: id },
      include: this.formInclude()
    });

    if (form) {
      return this.serializeForm(await this.ensureKycNumber(form));
    }

    const created = await this.createForm(user, id);
    return this.serializeForm(await this.ensureKycNumber(created));
  }

  async autoSaveForm(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const payload = dto as KycFormDraftPayload;

    if (payload.sectionA) await this.saveSectionData(user, id, KycFormSectionKey.GENERAL_COMPANY, payload.sectionA);
    if (payload.sectionD) await this.saveSectionData(user, id, KycFormSectionKey.COMPLIANCE_RISK, payload.sectionD);
    if (payload.sectionE) await this.saveSectionData(user, id, KycFormSectionKey.COMMUNICATION_PERSON, payload.sectionE);
    if (payload.sectionG) await this.saveSectionData(user, id, KycFormSectionKey.CLIENT_DECLARATION, payload.sectionG);
    if (payload.sectionB) await this.saveOwnership(user, id, payload.sectionB);
    if (payload.sectionC) await this.saveManagers(user, id, payload.sectionC);
    if (payload.sectionF) await this.saveRequiredDocuments(user, id, payload.sectionF);
    if (payload.sectionH) await this.saveInternalReview(user, id, payload.sectionH);

    return this.getForm(user, id);
  }

  saveSectionA(user: RequestUser, id: string, dto: Record<string, unknown>) {
    this.validateEmail(dto.email);
    return this.saveSectionData(user, id, KycFormSectionKey.GENERAL_COMPANY, dto);
  }

  saveSectionD(user: RequestUser, id: string, dto: Record<string, unknown>) {
    return this.saveSectionData(user, id, KycFormSectionKey.COMPLIANCE_RISK, dto);
  }

  saveSectionE(user: RequestUser, id: string, dto: Record<string, unknown>) {
    this.validateEmail(dto.email);
    return this.saveSectionData(user, id, KycFormSectionKey.COMMUNICATION_PERSON, dto);
  }

  saveSectionG(user: RequestUser, id: string, dto: Record<string, unknown>) {
    return this.saveSectionData(user, id, KycFormSectionKey.CLIENT_DECLARATION, dto);
  }

  async saveOwnership(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const form = await this.requireWritableForm(user, id, ['AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN']);
    const rows = this.asArray<RowPayload>(dto.shareholders).filter((row) => this.hasRowValue(row));
    const ubos = this.asArray<RowPayload>(dto.ubos).filter((row) => this.hasRowValue(row));
    for (const ubo of ubos) {
      if (ubo.parentRowId && !rows.some((party) => party.id === ubo.parentRowId && party.shareholderType === 'Corporate Entity')) {
        throw new BadRequestException('Link each indirect beneficial owner to a corporate shareholder in this form.');
      }
    }
    const shareholderPercentage = (row: RowPayload) => this.numberValue(row.shareholderPercentage ?? row.ownershipPercentage);
    const uboInterestPercentage = (row: RowPayload) => this.numberValue(row.uboInterestPercentage ?? row.ownershipPercentage);
    const total = rows.filter((row) => !this.text(row.parentRowId)).reduce((sum, row) => sum + shareholderPercentage(row), 0);
    const layerTotals = rows.reduce<Record<string, number>>((totals, row) => {
      const parentKey = this.text(row.parentRowId) || 'ROOT';
      totals[parentKey] = (totals[parentKey] || 0) + shareholderPercentage(row);
      return totals;
    }, {});

    if (Object.values(layerTotals).some((layerTotal) => layerTotal > 100)) {
      throw new BadRequestException('Interest percentage cannot exceed 100% within the same control layer');
    }
    const sectionData = {
      totalOwnershipPercentage: total,
      totalUboPercentage: beneficialOwners(rows, ubos).reduce((sum, row) => sum + uboInterestPercentage(row), 0),
      uboDifferentFromShareholders: dto.uboDifferentFromShareholders || 'No',
      uboGroupStructureNotes: dto.uboGroupStructureNotes || '',
      shareholders: rows,
      ubos
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.kycShareholder.deleteMany({ where: { kycFormId: form.id } });
      await tx.kycUbo.deleteMany({ where: { kycFormId: form.id } });
      await tx.kycSectionData.upsert({
        where: { kycFormId_sectionKey: { kycFormId: form.id, sectionKey: KycFormSectionKey.OWNERSHIP } },
        update: {
          data: this.jsonValue(sectionData),
          updatedBy: user.id
        },
        create: {
          tenantId: form.tenantId,
          kycCaseId: id,
          kycFormId: form.id,
          sectionKey: KycFormSectionKey.OWNERSHIP,
          data: this.jsonValue(sectionData),
          createdBy: user.id,
          updatedBy: user.id
        }
      });

      if (rows.length) {
        await tx.kycShareholder.createMany({
          data: rows.map((row, index) => ({
            tenantId: form.tenantId,
            kycCaseId: id,
            kycFormId: form.id,
            fullName: this.requiredText(row.fullName, 'Party full name'),
            nationality: this.optionText(row.nationality, row.nationalityOther),
            dateOfBirth: this.dateValue(row.dateOfBirth),
            identityNumber: this.optionalText(row.identityNumber),
            ownershipPercentage: this.decimalValue(row.shareholderPercentage ?? row.ownershipPercentage),
            residenceAddress: this.optionalText(row.residenceAddress),
            sortOrder: index,
            createdBy: user.id,
            updatedBy: user.id
          }))
        });
      }

      if (ubos.length) {
        await tx.kycUbo.createMany({
          data: ubos.map((row, index) => ({
            tenantId: form.tenantId,
            kycCaseId: id,
            kycFormId: form.id,
            fullName: this.requiredText(row.fullName, 'Beneficial person full name'),
            nationality: this.optionalText(row.nationality),
            dateOfBirth: this.dateValue(row.dateOfBirth),
            identityNumber: this.optionalText(row.identityNumber),
            ownershipPercentage: this.decimalValue(row.uboInterestPercentage ?? row.ownershipPercentage),
            residenceAddress: this.optionalText(row.residenceAddress),
            notes: this.optionalText(row.notes),
            sortOrder: index,
            createdBy: user.id,
            updatedBy: user.id
          }))
        });
      }

      await tx.kycForm.update({ where: { id: form.id }, data: { updatedBy: user.id } });
    });

    return this.getForm(user, id);
  }

  async saveManagers(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const form = await this.requireWritableForm(user, id, ['AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN']);
    const rows = this.asArray<RowPayload>(dto.managers).filter((row) => this.hasRowValue(row));

    await this.prisma.$transaction(async (tx) => {
      await tx.kycManager.deleteMany({ where: { kycFormId: form.id } });
      await tx.kycSectionData.upsert({
        where: { kycFormId_sectionKey: { kycFormId: form.id, sectionKey: KycFormSectionKey.MANAGEMENT } },
        update: { data: this.jsonValue({ savedAt: new Date().toISOString() }), updatedBy: user.id },
        create: {
          tenantId: form.tenantId,
          kycCaseId: id,
          kycFormId: form.id,
          sectionKey: KycFormSectionKey.MANAGEMENT,
          data: this.jsonValue({ savedAt: new Date().toISOString() }),
          createdBy: user.id,
          updatedBy: user.id
        }
      });

      if (rows.length) {
        await tx.kycManager.createMany({
          data: rows.map((row, index) => ({
            tenantId: form.tenantId,
            kycCaseId: id,
            kycFormId: form.id,
            fullName: this.requiredText(row.fullName, 'Manager full name'),
            entityName: this.optionalText(row.entityName),
            nationalityAndAddress: this.optionalText(row.nationalityAndAddress),
            nationality: this.optionalText(row.nationality),
            address: this.optionalText(row.address),
            dateOfBirth: this.dateValue(row.dateOfBirth),
            identityNumber: this.optionalText(row.identityNumber),
            position: this.optionText(row.position, row.positionOther),
            isAuthorizedSignatory: Boolean(row.isAuthorizedSignatory),
            sortOrder: index,
            createdBy: user.id,
            updatedBy: user.id
          }))
        });
      }

      await tx.kycForm.update({ where: { id: form.id }, data: { updatedBy: user.id } });
    });

    return this.getForm(user, id);
  }

  async saveRequiredDocuments(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const form = await this.requireWritableForm(user, id, ['AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN']);
    const rows = this.dedupeRequiredDocumentRows(this.asArray<RowPayload>(dto.documents).filter((row) => this.hasRowValue(row)));
    const additionalRows = this.dedupeAdditionalDocumentRows(this.asArray<RowPayload>(dto.additionalDocuments).filter((row) => this.hasRowValue(row)));
    const sectionData = {
      uploadedFilesNote: dto.uploadedFilesNote || '',
      additionalDocuments: additionalRows.map((row, index) => ({
        id: this.optionalText(row.id) || `${index + 1}`,
        fileName: this.optionalText(row.fileName),
        storagePath: this.optionalText(row.storagePath),
        mimeType: this.optionalText(row.mimeType),
        size: row.size === undefined || row.size === '' ? undefined : Number(row.size)
      }))
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.kycRequiredDocument.deleteMany({ where: { kycFormId: form.id } });

      if (rows.length) {
        await tx.kycRequiredDocument.createMany({
          data: rows.map((row, index) => ({
            tenantId: form.tenantId,
            kycCaseId: id,
            kycFormId: form.id,
            documentType: this.requiredText(row.documentType, 'Document type'),
            isRequired: row.isRequired === undefined ? true : Boolean(row.isRequired),
            isProvided: Boolean(row.isProvided),
            fileName: this.optionalText(row.fileName),
            storagePath: this.optionalText(row.storagePath),
            mimeType: this.optionalText(row.mimeType),
            size: row.size === undefined || row.size === '' ? null : Number(row.size),
            sortOrder: index,
            createdBy: user.id,
            updatedBy: user.id
          }))
        });
      }

      await this.syncRequiredDocumentsToLegalDocuments(tx, form, user, rows, additionalRows);

      await tx.kycSectionData.upsert({
        where: { kycFormId_sectionKey: { kycFormId: form.id, sectionKey: KycFormSectionKey.REQUIRED_DOCUMENTS } },
        update: { data: this.jsonValue(sectionData), updatedBy: user.id },
        create: {
          tenantId: form.tenantId,
          kycCaseId: id,
          kycFormId: form.id,
          sectionKey: KycFormSectionKey.REQUIRED_DOCUMENTS,
          data: this.jsonValue(sectionData),
          createdBy: user.id,
          updatedBy: user.id
        }
      });
      await this.markDocumentsUploadedFromSectionF(tx, form, user, rows, additionalRows);
      await tx.kycForm.update({ where: { id: form.id }, data: { updatedBy: user.id } });
    });

    return this.getForm(user, id);
  }

  private async syncRequiredDocumentsToLegalDocuments(
    tx: Prisma.TransactionClient,
    form: { id: string; tenantId: string; kycCaseId: string },
    user: RequestUser,
    rows: RowPayload[],
    additionalRows: RowPayload[]
  ) {
    const syncRows = [
      ...rows
        .filter((row) => Boolean(row.isProvided) && Boolean(this.optionalText(row.fileName)))
        .flatMap((row) =>
          this.documentFileNames(row.fileName).map((fileName) => ({
            documentType: this.requiredText(row.documentType, 'Document type'),
            fileName,
            storagePath: this.optionalText(row.storagePath),
            mimeType: this.optionalText(row.mimeType),
            size: row.size === undefined || row.size === '' ? null : Number(row.size)
          }))
        ),
      ...additionalRows
        .filter((row) => Boolean(this.optionalText(row.fileName)))
        .flatMap((row, index) =>
          this.documentFileNames(row.fileName).map((fileName) => ({
            documentType: this.optionalText(row.documentType) || `Additional document ${index + 1}`,
            fileName,
            storagePath: this.optionalText(row.storagePath),
            mimeType: this.optionalText(row.mimeType),
            size: row.size === undefined || row.size === '' ? null : Number(row.size)
          }))
        )
    ];

    if (!syncRows.length) return;

    const existing = await tx.legalDocument.findMany({
      where: { tenantId: form.tenantId, kycCaseId: form.kycCaseId },
      select: { id: true, documentType: true, fileName: true }
    });
    const existingKeys = new Set(existing.map((document) => this.legalDocumentSyncKey(document.documentType, document.fileName)));

    for (const row of syncRows) {
      const key = this.legalDocumentSyncKey(row.documentType, row.fileName);
      if (existingKeys.has(key)) continue;

      await tx.legalDocument.create({
        data: {
          tenantId: form.tenantId,
          kycCaseId: form.kycCaseId,
          documentType: row.documentType,
          fileName: row.fileName,
          storagePath: row.storagePath,
          mimeType: row.mimeType,
          size: row.size,
          uploadedById: user.id
        }
      });
      existingKeys.add(key);
    }
  }

  private async markDocumentsUploadedFromSectionF(
    tx: Prisma.TransactionClient,
    form: { tenantId: string; kycCaseId: string },
    user: RequestUser,
    rows: RowPayload[],
    additionalRows: RowPayload[]
  ) {
    const hasProvidedDocument =
      rows.some((row) => Boolean(row.isProvided) && Boolean(this.optionalText(row.fileName))) ||
      additionalRows.some((row) => Boolean(this.optionalText(row.fileName)));

    if (!hasProvidedDocument) return;

    const kycCase = await tx.kycCase.findFirst({
      where: { id: form.kycCaseId, tenantId: form.tenantId },
      select: { id: true, status: true }
    });

    const uploadableStatuses: KycCaseStatus[] = [
      KycCaseStatus.INQUIRY_RECEIVED,
      KycCaseStatus.PROPOSAL_OPTIONAL,
      KycCaseStatus.LEGAL_DOCUMENTS_PENDING
    ];

    if (!kycCase || !uploadableStatuses.includes(kycCase.status)) {
      return;
    }

    await tx.kycCase.update({
      where: { id: form.kycCaseId },
      data: { status: KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED }
    });
    await tx.kycCaseStatusHistory.create({
      data: {
        tenantId: form.tenantId,
        kycCaseId: form.kycCaseId,
        fromStatus: kycCase.status,
        toStatus: KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED,
        changedById: user.id,
        note: 'Documents required for KYC preparation uploaded'
      }
    });
  }

  async saveInternalReview(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const roles = this.internalReviewAllowedRoles(dto);
    const form = await this.requireWritableForm(user, id, roles);
    const data = this.internalReviewData(dto);

    await this.prisma.kycInternalReview.upsert({
      where: { kycFormId: form.id },
      update: { ...data, updatedBy: user.id },
      create: {
        tenantId: form.tenantId,
        kycCaseId: id,
        kycFormId: form.id,
        ...data,
        createdBy: user.id,
        updatedBy: user.id
      }
    });

    await this.prisma.kycForm.update({ where: { id: form.id }, data: { updatedBy: user.id } });
    return this.getForm(user, id);
  }

  async generateDocument(user: RequestUser, id: string, type: KycGeneratedDocumentType) {
    const form = await this.getFormRecord(user, id);
    // The client form has an AML Supervisor "Comments" row; only the formal (non-confidential) comment is exported.
    const supervisorSubmission = await this.prisma.internalReviewSubmission.findFirst({
      where: { kycCaseId: id, tenantId: form.tenantId, stage: ReviewStage.SUPERVISOR },
      select: { formalComments: true }
    });
    const payload = { ...this.serializeForm(form), amlComments: supervisorSubmission?.formalComments || form.internalReview?.amlClarificationFindings || '' };
    const isDocx = type === KycGeneratedDocumentType.DOCX;
    const companyName = this.safeFileName(this.text((payload.sectionA as Record<string, unknown>).legalName) || `KYC Case ${payload.kycCaseId}`).slice(0, 120);
    const mimeType = isDocx ? KYC_DOCX_MIME : KYC_PDF_MIME;
    let generated: KycGeneratedDocument | null = null;

    // Simultaneous requests can pick the same version number; retry against the unique constraint.
    for (let attempt = 0; attempt < 3 && !generated; attempt++) {
      const version = await this.nextGeneratedVersion(form.id, type);
      const content = isDocx ? await exportKycDocx(payload, version) : await exportKycPdf(payload, version, this.pdfRenderer);
      try {
        generated = await this.prisma.$transaction(async (tx) => {
          const created = await tx.kycGeneratedDocument.create({
            data: {
              tenantId: form.tenantId,
              kycCaseId: id,
              kycFormId: form.id,
              documentType: type,
              version,
              fileName: `${companyName} - KYC Document - v${version}.${isDocx ? 'docx' : 'pdf'}`,
              mimeType,
              content: new Uint8Array(content),
              createdBy: user.id,
              updatedBy: user.id
            }
          });
          await this.audit(tx, user, form.tenantId, 'KycGeneratedDocument', created.id, { event: 'KYC_DOCUMENT_GENERATED', kycCaseId: id, documentType: type, version });
          return created;
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') || attempt === 2) throw error;
      }
    }
    if (!generated) throw new InternalServerErrorException('Unable to store the generated KYC document');

    return {
      id: generated.id,
      documentType: generated.documentType,
      version: generated.version,
      fileName: generated.fileName,
      mimeType: generated.mimeType,
      createdAt: generated.createdAt
    };
  }

  async downloadGeneratedDocument(user: RequestUser, id: string, documentId: string) {
    await this.findOne(user, id);
    const document = await this.prisma.kycGeneratedDocument.findFirst({
      where: { id: documentId, kycCaseId: id, ...this.generatedTenantWhere(user) }
    });

    if (!document) {
      throw new NotFoundException('Generated document not found');
    }

    await this.prisma.$transaction((tx) => this.audit(tx, user, document.tenantId, 'KycGeneratedDocument', document.id, {
      event: 'KYC_DOCUMENT_DOWNLOADED',
      kycCaseId: id,
      documentType: document.documentType,
      version: document.version
    }));
    return document;
  }

  getPendingAmlNotifications(user: RequestUser) {
    const where: Prisma.NotificationWhereInput = {
      type: NotificationType.AML_CASE_SUBMITTED,
      isRead: false
    };

    if (!user.roles.includes('SUPER_ADMIN')) {
      where.tenantId = this.getTenantId(user);
    }

    return this.prisma.notification.findMany({
      where,
      include: {
        kycCase: {
          include: {
            client: true,
            service: true,
            legalDocuments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getMyReviewTasks(user: RequestUser) {
    const stages = this.reviewStagesForUser(user);
    const notificationTypes = this.reviewNotificationTypesForUser(user);
    const tenantWhere = user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };

    try {
      const [tasks, notifications] = await Promise.all([
      stages.length
        ? this.prisma.internalReviewTask.findMany({
            where: {
              ...tenantWhere,
              stage: { in: stages },
              status: { in: [ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS, ReviewTaskStatus.PAUSED] }
            },
            include: {
              assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
              kycCase: { include: { client: true, service: true } }
            },
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
          })
        : [],
      notificationTypes.length
        ? this.prisma.notification.findMany({
            where: {
              ...tenantWhere,
              type: { in: notificationTypes },
              isRead: false
            },
            include: {
              kycCase: { include: { client: true, service: true } }
            },
            orderBy: { createdAt: 'desc' }
          })
        : []
      ]);

      const activeTasks = tasks.filter((task) =>
        [this.stageStatus(task.stage, 'pending'), this.stageStatus(task.stage, 'inProgress')].includes(task.kycCase.status)
      );

      return {
        tasks: activeTasks,
        notifications,
        stages
      };
    } catch (error) {
      if (this.hasAnyRole(user, ['SEF'])) {
        throw new InternalServerErrorException('Unable to load SEF review tasks. Confirm the latest database migrations are applied and refresh the page.');
      }
      throw error;
    }
  }

  private async saveSectionData(
    user: RequestUser,
    id: string,
    sectionKey: KycFormSectionKey,
    data: Record<string, unknown>
  ) {
    const form = await this.requireWritableForm(user, id, ['AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN']);

    await this.prisma.kycSectionData.upsert({
      where: { kycFormId_sectionKey: { kycFormId: form.id, sectionKey } },
      update: { data: this.jsonValue(data), updatedBy: user.id },
      create: {
        tenantId: form.tenantId,
        kycCaseId: id,
        kycFormId: form.id,
        sectionKey,
        data: this.jsonValue(data),
        createdBy: user.id,
        updatedBy: user.id
      }
    });

    await this.prisma.kycForm.update({ where: { id: form.id }, data: { updatedBy: user.id } });
    return this.getForm(user, id);
  }

  private async requireWritableForm(user: RequestUser, id: string, allowedRoles: string[]) {
    if (!this.hasAnyRole(user, [...allowedRoles, 'SUPER_ADMIN'])) {
      throw new ForbiddenException('You do not have permission to edit this KYC form section');
    }

    const kycCase = await this.prisma.kycCase.findFirst({
      where: { id, ...this.tenantWhere(user) },
      select: { status: true }
    });
    if (!kycCase) {
      throw new NotFoundException('KYC case not found');
    }
    if (
      this.hasAnyRole(user, ['AML_TEAM', 'AML_SUPERVISOR']) &&
      !this.hasAnyRole(user, ['COMPANY_ADMIN', 'SUPER_ADMIN']) &&
      !this.isPreparationEditableStatus(kycCase.status)
    ) {
      throw new BadRequestException('KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.');
    }

    const form = await this.prisma.kycForm.findFirst({
      where: { kycCaseId: id, ...this.formTenantWhere(user) }
    });

    if (!form) {
      const created = await this.createForm(user, id);
      if (created.isLocked) {
        throw new BadRequestException('KYC form is locked');
      }
      return created;
    }

    if (form.isLocked) {
      throw new BadRequestException('KYC form is locked. Create a new version before editing.');
    }

    return form;
  }

  private async getFormRecord(user: RequestUser, id: string) {
    const form = await this.prisma.kycForm.findFirst({
      where: { kycCaseId: id, ...this.formTenantWhere(user) },
      include: this.formInclude()
    });

    if (!form) {
      const created = await this.createForm(user, id);
      return this.prisma.kycForm.findUniqueOrThrow({ where: { id: created.id }, include: this.formInclude() });
    }

    return form;
  }

  private serializeForm(form: Prisma.KycFormGetPayload<{ include: ReturnType<KycService['formInclude']> }>) {
    const section = (key: KycFormSectionKey) =>
      (form.sections.find((item) => item.sectionKey === key)?.data || {}) as Record<string, unknown>;
    const ownershipSection = section(KycFormSectionKey.OWNERSHIP);
    const sectionA = section(KycFormSectionKey.GENERAL_COMPANY);

    return {
      id: form.id,
      tenantId: form.tenantId,
      kycCaseId: form.kycCaseId,
      status: form.status,
      isLocked: form.isLocked,
      version: form.version,
      sectionA: {
        ...sectionA,
        reference: this.text(sectionA.reference)
      },
      sectionB: {
        ...ownershipSection,
        shareholders: this.sectionRows(ownershipSection.shareholders, form.shareholders),
        ubos: this.sectionRows(ownershipSection.ubos, form.ubos).map((row) => {
          const ubo = row as RowPayload;
          // Proposed-company cases persist this as ownershipPercentage; preserve it for all UBO form and export paths.
          return { ...ubo, uboInterestPercentage: ubo.uboInterestPercentage ?? ubo.ownershipPercentage };
        })
      },
      sectionC: {
        ...section(KycFormSectionKey.MANAGEMENT),
        managers: form.managers
      },
      sectionD: section(KycFormSectionKey.COMPLIANCE_RISK),
      sectionE: section(KycFormSectionKey.COMMUNICATION_PERSON),
      sectionF: this.sectionFWithCaseDocuments(section(KycFormSectionKey.REQUIRED_DOCUMENTS), form.requiredDocuments, form.kycCase.legalDocuments),
      sectionG: section(KycFormSectionKey.CLIENT_DECLARATION),
      sectionH: form.internalReview,
      generatedDocuments: form.generatedDocuments.map((document) => ({
        id: document.id,
        documentType: document.documentType,
        version: document.version,
        fileName: document.fileName,
        mimeType: document.mimeType,
        createdAt: document.createdAt
      })),
      updatedAt: form.updatedAt
    };
  }

  private formInclude() {
    return {
      sections: true,
      shareholders: { orderBy: { sortOrder: 'asc' as const } },
      ubos: { orderBy: { sortOrder: 'asc' as const } },
      managers: { orderBy: { sortOrder: 'asc' as const } },
      requiredDocuments: { orderBy: { sortOrder: 'asc' as const } },
      kycCase: {
        include: {
          legalDocuments: { orderBy: { createdAt: 'desc' as const } }
        }
      },
      internalReview: true,
      generatedDocuments: {
        select: {
          id: true,
          documentType: true,
          version: true,
          fileName: true,
          mimeType: true,
          createdAt: true
        },
        orderBy: [{ documentType: 'asc' as const }, { version: 'desc' as const }]
      }
    };
  }

  private sectionRows(jsonRows: unknown, modelRows: unknown[]) {
    const rows = this.asArray<RowPayload>(jsonRows);
    return rows.length ? rows : modelRows;
  }

  private sectionFWithCaseDocuments(
    sectionData: Record<string, unknown>,
    savedRequiredDocuments: Array<{
      id?: string;
      documentType: string;
      isRequired: boolean;
      isProvided: boolean;
      fileName: string | null;
      storagePath: string | null;
      mimeType: string | null;
      size: number | null;
      sortOrder?: number;
    }>,
    legalDocuments: Array<{
      id: string;
      documentType: string;
      fileName: string;
      storagePath: string | null;
      mimeType: string | null;
      size: number | null;
    }>
  ) {
    const matchedLegalDocumentIds = new Set<string>();
    const baseRequiredDocuments = savedRequiredDocuments.length
      ? this.dedupeRequiredDocumentRows(savedRequiredDocuments)
      : REQUIRED_DOCUMENT_TYPES.map((documentType, index) => ({
          documentType,
          isRequired: true,
          isProvided: false,
          fileName: null,
          storagePath: null,
          mimeType: null,
          size: null,
          sortOrder: index
        }));

    const documents = baseRequiredDocuments.map((row) => {
      const uploaded = legalDocuments.filter((document) => !matchedLegalDocumentIds.has(document.id) && this.isRequiredDocumentMatch(document.documentType, row.documentType));
      uploaded.forEach((document) => matchedLegalDocumentIds.add(document.id));
      const primaryUpload = uploaded[0];

      return {
        ...row,
        isProvided: Boolean(row.isProvided) || Boolean(uploaded.length),
        fileName: uploaded.length ? uploaded.map((document) => document.fileName).join(', ') : row.fileName || null,
        storagePath: row.storagePath || primaryUpload?.storagePath || null,
        mimeType: row.mimeType || primaryUpload?.mimeType || null,
        size: row.size ?? primaryUpload?.size ?? null
      };
    });

    const savedAdditionalDocuments = this.dedupeAdditionalDocumentRows(this.asArray<RowPayload>(sectionData.additionalDocuments));
    const additionalFileKeys = new Set(
      savedAdditionalDocuments.flatMap((row) => this.documentFileNames(row.fileName).map((fileName) => fileName.toLowerCase()))
    );
    const additionalDocuments = [
      ...savedAdditionalDocuments,
      ...legalDocuments
        .filter((document) => !matchedLegalDocumentIds.has(document.id))
        .filter((document) => {
          const key = document.fileName.trim().toLowerCase();
          if (additionalFileKeys.has(key)) return false;
          additionalFileKeys.add(key);
          return true;
        })
        .map((document, index) => ({
          id: document.id,
          documentType: document.documentType || `Additional document ${savedAdditionalDocuments.length + index + 1}`,
          fileName: document.fileName,
          storagePath: document.storagePath,
          mimeType: document.mimeType,
          size: document.size
        }))
    ];

    return {
      ...sectionData,
      documents,
      additionalDocuments
    };
  }

  private dedupeRequiredDocumentRows<T extends RowPayload>(rows: T[]) {
    const merged = new Map<string, T>();

    rows.forEach((row) => {
      const documentType = this.optionalText(row.documentType);
      const key = this.documentMatchText(documentType || '');
      if (!key) return;

      const existing = merged.get(key);
      const fileName = this.documentFileNames([existing?.fileName, row.fileName].filter(Boolean).join(', ')).join(', ');

      merged.set(key, {
        ...(existing || ({} as T)),
        ...row,
        documentType: existing?.documentType || documentType,
        isRequired: row.isRequired === undefined ? existing?.isRequired ?? true : row.isRequired,
        isProvided: Boolean(existing?.isProvided) || Boolean(row.isProvided) || Boolean(fileName),
        fileName,
        storagePath: existing?.storagePath || row.storagePath,
        mimeType: existing?.mimeType || row.mimeType,
        size: existing?.size || row.size
      } as T);
    });

    return REQUIRED_DOCUMENT_TYPES.map((documentType, index) => {
      const row = merged.get(this.documentMatchText(documentType));
      return (
        row ||
        ({
          documentType,
          isRequired: true,
          isProvided: false,
          fileName: null,
          storagePath: null,
          mimeType: null,
          size: null,
          sortOrder: index
        } as unknown as T)
      );
    });
  }

  private dedupeAdditionalDocumentRows<T extends RowPayload>(rows: T[]) {
    const seen = new Set<string>();

    return rows
      .map((row, index) => ({
        ...row,
        id: this.optionalText(row.id) || `${index + 1}`,
        fileName: this.documentFileNames(row.fileName).join(', ')
      }))
      .filter((row) => {
        const fileName = this.optionalText(row.fileName);
        if (!fileName) return false;
        const key = fileName.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }) as T[];
  }

  private documentFileNames(value: unknown) {
    const seen = new Set<string>();

    return this.text(value)
      .split(',')
      .map((fileName) => fileName.trim())
      .filter((fileName) => {
        if (!fileName) return false;
        const key = fileName.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private isRequiredDocumentMatch(documentType: string, requiredDocumentType: string) {
    const document = this.documentMatchText(documentType);
    const required = this.documentMatchText(requiredDocumentType);
    if (!document || !required) return false;
    if (document === required || document.includes(required) || required.includes(document)) return true;

    const aliases: Record<string, string[]> = {
      [this.documentMatchText('Commercial Registration / CR Extract')]: ['commercial registration', 'cr extract', 'trade license', 'trade licence'],
      [this.documentMatchText('Entity Card / Computer Card')]: ['entity card', 'computer card'],
      [this.documentMatchText('Certificate of Incorporation')]: ['certificate of incorporation', 'coi'],
      [this.documentMatchText('Articles of Association')]: ['articles of association', 'aoa'],
      [this.documentMatchText('QID / Passport copies')]: ['qid', 'passport', 'passport copy', 'passport copies'],
      [this.documentMatchText('CR of legal entity parties')]: ['cr of legal entity parties', 'cr of legal entity shareholders', 'shareholder cr', 'shareholders cr'],
      [this.documentMatchText('National address certificates')]: ['national address', 'national address certificate', 'national address certificates'],
      [this.documentMatchText('Latest Audited Financial Statements')]: ['latest audited financial statements', 'audited financial statement', 'financial statements'],
      [this.documentMatchText('Tax Card')]: ['tax card']
    };

    return (aliases[required] || []).some((alias) => document.includes(this.documentMatchText(alias)));
  }

  private documentMatchText(value: string) {
    return (value || '')
      .toLowerCase()
      .replace(/shareholders?/g, 'parties')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async requireWritableCase(user: RequestUser, id: string) {
    const kycCase = await this.prisma.kycCase.findFirst({
      where: { id, ...this.tenantWhere(user) }
    });

    if (!kycCase) {
      throw new NotFoundException('KYC case not found');
    }

    if (!this.isPreparationEditableStatus(kycCase.status)) {
      throw new BadRequestException('KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.');
    }

    return kycCase;
  }

  private isPreparationEditableStatus(status: KycCaseStatus) {
    const editableStatuses: KycCaseStatus[] = [
      KycCaseStatus.INQUIRY_RECEIVED,
      KycCaseStatus.PROPOSAL_OPTIONAL,
      KycCaseStatus.LEGAL_DOCUMENTS_PENDING,
      KycCaseStatus.LEGAL_DOCUMENTS_UPLOADED,
      KycCaseStatus.SUPERVISOR_REVIEW_PENDING,
      KycCaseStatus.SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED
    ];
    return editableStatuses.includes(status);
  }

  private async resolveService(tenantId: string, dto: AssignServiceDto) {
    if (dto.serviceId) {
      const service = await this.prisma.clientService.findFirst({
        where: { id: dto.serviceId, tenantId }
      });

      if (!service) {
        throw new NotFoundException('Client service not found');
      }

      return service;
    }

    if (!dto.serviceName) {
      throw new BadRequestException('Provide serviceId or serviceName');
    }

    return this.prisma.clientService.upsert({
      where: { tenantId_name: { tenantId, name: dto.serviceName } },
      update: { description: dto.description },
      create: {
        tenantId,
        name: dto.serviceName,
        description: dto.description
      }
    });
  }

  private updateStatus(
    user: RequestUser,
    id: string,
    status: KycCaseStatus,
    note: string,
    data: Prisma.KycCaseUncheckedUpdateInput = {}
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.kycCase.findFirst({
        where: { id, ...this.tenantWhere(user) }
      });

      if (!current) {
        throw new NotFoundException('KYC case not found');
      }

      await tx.kycCase.update({
        where: { id },
        data: { ...data, status }
      });

      if (current.status !== status) {
        await tx.kycCaseStatusHistory.create({
          data: {
            tenantId: current.tenantId,
            kycCaseId: id,
            fromStatus: current.status,
            toStatus: status,
            changedById: user.id,
            note
          }
        });
      }

      return tx.kycCase.findUniqueOrThrow({
        where: { id },
        include: this.caseInclude()
      });
    });
  }

  private tenantWhere(user: RequestUser): Prisma.KycCaseWhereInput {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
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

  private formTenantWhere(user: RequestUser): Prisma.KycFormWhereInput {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
  }

  private generatedTenantWhere(user: RequestUser): Prisma.KycGeneratedDocumentWhereInput {
    return user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: this.getTenantId(user) };
  }

  private getTenantId(user: RequestUser) {
    if (!user.tenantId) {
      throw new ForbiddenException('User is not assigned to a tenant');
    }

    return user.tenantId;
  }

  private isSubmittedToAml(status: KycCaseStatus) {
    return status === KycCaseStatus.SUBMITTED_TO_AML || status === KycCaseStatus.AML_REVIEW_STARTED;
  }

  private hasAnyRole(user: RequestUser, roles: string[]) {
    return user.roles.some((role) => roles.includes(role));
  }

  private assertStageRole(user: RequestUser, stage: ReviewStage) {
    const rolesByStage: Record<ReviewStage, string[]> = {
      SUPERVISOR: ['AML_SUPERVISOR', 'AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
      DMLRO: ['DMLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
      MLRO: ['MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
      SEF: ['SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN']
    };

    if (!this.hasAnyRole(user, rolesByStage[stage])) {
      throw new ForbiddenException(`You cannot edit the ${this.stageLabel(stage)} review`);
    }
  }

  private stageLabel(stage: ReviewStage) {
    if (stage === ReviewStage.SUPERVISOR) return 'AML Supervisor';
    if (stage === ReviewStage.SEF) return 'SEF';
    return stage;
  }

  private stageStatus(stage: ReviewStage, state: 'pending' | 'inProgress' | 'additionalInfo' | 'completed') {
    const statuses: Record<ReviewStage, Record<typeof state, KycCaseStatus>> = {
      SUPERVISOR: {
        pending: KycCaseStatus.SUPERVISOR_REVIEW_PENDING,
        inProgress: KycCaseStatus.SUPERVISOR_REVIEW_IN_PROGRESS,
        additionalInfo: KycCaseStatus.SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED,
        completed: KycCaseStatus.SUPERVISOR_REVIEW_COMPLETED
      },
      DMLRO: {
        pending: KycCaseStatus.DMLRO_REVIEW_PENDING,
        inProgress: KycCaseStatus.DMLRO_REVIEW_IN_PROGRESS,
        additionalInfo: KycCaseStatus.DMLRO_ADDITIONAL_INFORMATION_REQUIRED,
        completed: KycCaseStatus.DMLRO_REVIEW_COMPLETED
      },
      MLRO: {
        pending: KycCaseStatus.MLRO_REVIEW_PENDING,
        inProgress: KycCaseStatus.MLRO_REVIEW_IN_PROGRESS,
        additionalInfo: KycCaseStatus.MLRO_ADDITIONAL_INFORMATION_REQUIRED,
        completed: KycCaseStatus.MLRO_APPROVED
      },
      SEF: {
        pending: KycCaseStatus.SEF_DECISION_PENDING,
        inProgress: KycCaseStatus.SEF_DECISION_IN_PROGRESS,
        additionalInfo: KycCaseStatus.SEF_DECISION_PENDING,
        completed: KycCaseStatus.SEF_APPROVED
      }
    };

    return statuses[stage][state];
  }

  private async assertPreviousStageComplete(kycCaseId: string, stage: ReviewStage) {
    if (stage === ReviewStage.SUPERVISOR || stage === ReviewStage.DMLRO) return;
    const previous = stage === ReviewStage.SEF ? ReviewStage.MLRO : ReviewStage.DMLRO;
    const submission = await this.prisma.internalReviewSubmission.findUnique({
      where: { kycCaseId_stage: { kycCaseId, stage: previous } }
    });

    if (!submission?.isLocked) {
      throw new BadRequestException(`${this.stageLabel(previous)} review must be submitted first`);
    }
  }

  private async assertEditableReview(kycCaseId: string, stage: ReviewStage) {
    const existing = await this.prisma.internalReviewSubmission.findUnique({
      where: { kycCaseId_stage: { kycCaseId, stage } }
    });

    if (existing?.isLocked) {
      throw new BadRequestException(`${this.stageLabel(stage)} review is locked after submission`);
    }
  }

  private async assertReviewStageActive(kycCaseId: string, stage: ReviewStage) {
    const task = await this.prisma.internalReviewTask.findFirst({
      where: { kycCaseId, stage, status: { in: [ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS] } }
    });
    if (!task) {
      throw new BadRequestException(`${this.stageLabel(stage)} does not have an active review task for this case.`);
    }
  }

  private async ensureReviewTask(user: RequestUser, id: string, stage: ReviewStage, notificationType: NotificationType) {
    const kycCase = await this.findOne(user, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.internalReviewTask.upsert({
        where: { kycCaseId_stage_status: { kycCaseId: id, stage, status: ReviewTaskStatus.PENDING } },
        update: { updatedBy: user.id },
        create: {
          tenantId: kycCase.tenantId,
          kycCaseId: id,
          stage,
          createdBy: user.id,
          updatedBy: user.id
        }
      });
      await this.createNotification(tx, kycCase, notificationType, `${this.stageLabel(stage)} task assigned`, `${kycCase.title} is ready for ${this.stageLabel(stage)} review.`);
    });
  }

  private clearReviewTaskStatus(tx: Prisma.TransactionClient, kycCaseId: string, stage: ReviewStage, status: ReviewTaskStatus) {
    return tx.internalReviewTask.deleteMany({
      where: { kycCaseId, stage, status }
    });
  }

  private async submitReviewAndRoute(user: RequestUser, id: string, stage: ReviewStage, dto: Record<string, unknown>, nextStage: ReviewStage) {
    const kycCase = await this.findOne(user, id);
    await this.assertPreviousStageComplete(id, stage);
    await this.assertEditableReview(id, stage);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (stage === ReviewStage.SUPERVISOR) await this.assertReviewPackageReady(tx, kycCase);
        const saved = await this.lockReviewSubmission(tx, user, kycCase, stage, dto);
        await this.clearReviewTaskStatus(tx, id, stage, ReviewTaskStatus.COMPLETED);
        await tx.internalReviewTask.updateMany({
          where: { tenantId: kycCase.tenantId, kycCaseId: id, stage, status: { in: [ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS, ReviewTaskStatus.PAUSED] } },
          data: { status: ReviewTaskStatus.COMPLETED, completedAt: new Date(), updatedBy: user.id }
        });
        if (nextStage === ReviewStage.MLRO) {
          await tx.internalReviewSubmission.updateMany({
            where: { tenantId: kycCase.tenantId, kycCaseId: id, stage: ReviewStage.MLRO },
            data: { status: ReviewSubmissionStatus.REOPENED, isLocked: false, updatedBy: user.id }
          });
        }
        await tx.internalReviewTask.upsert({
          where: { kycCaseId_stage_status: { kycCaseId: id, stage: nextStage, status: ReviewTaskStatus.PENDING } },
          update: { updatedBy: user.id },
          create: { tenantId: kycCase.tenantId, kycCaseId: id, stage: nextStage, createdBy: user.id, updatedBy: user.id }
        });
        await this.recordStatus(tx, kycCase, user, this.stageStatus(stage, 'completed'), `${this.stageLabel(stage)} review submitted`);
        await this.recordStatus(tx, { ...kycCase, status: this.stageStatus(stage, 'completed') }, user, this.stageStatus(nextStage, 'pending'), `${this.stageLabel(nextStage)} review task assigned`);
        await this.audit(tx, user, kycCase.tenantId, 'InternalReviewSubmission', saved.id, { action: 'REVIEW_SUBMITTED', stage, routedTo: nextStage });
        await this.createNotification(tx, kycCase, nextStage === ReviewStage.DMLRO ? NotificationType.DMLRO_TASK_ASSIGNED : NotificationType.MLRO_TASK_ASSIGNED, `${this.stageLabel(nextStage)} task assigned`, `${kycCase.title} is ready for ${this.stageLabel(nextStage)} review.`);
        return tx.kycCase.findUniqueOrThrow({ where: { id }, include: this.caseInclude() });
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (stage === ReviewStage.DMLRO && nextStage === ReviewStage.MLRO) throw new InternalServerErrorException('Unable to resubmit this KYC file to MLRO. The review queue was refreshed; please try again.');
      throw error;
    }
  }

  private async assertReviewPackageReady(tx: Prisma.TransactionClient, kycCase: { id: string; tenantId: string; clientId: string; client?: { name: string; registrationNumber: string | null } }) {
    await this.assertScreeningReady(tx, kycCase);
    await this.assertCrrfReady(tx, kycCase);
  }

  private async assertScreeningReady(tx: Prisma.TransactionClient, kycCase: { id: string; tenantId: string; clientId: string; client?: { name: string; registrationNumber: string | null } }) {
          const id = kycCase.id;
          const client = kycCase.client || await tx.client.findFirstOrThrow({ where: { id: kycCase.clientId, tenantId: kycCase.tenantId } });
          const where = { tenantId: kycCase.tenantId, kycCaseId: id };
          const screening = await tx.screeningRecord.findMany({ where, include: { checks: true } });
          const commonChecks = await tx.screeningCaseCheck.findMany({ where });
          const evidence = await tx.screeningCaseDocument.findMany({ where });
          const resultTypes = ['NCTC', 'UN', 'OFAC', 'EU', 'PPO_LIST', 'WORLD_CHECK', 'GOOGLE'];
          const evidenceTypes = ['NCTC', 'UN', 'OFAC', 'EU', 'PPO_LIST'];
          const missingCommonChecks = resultTypes.some((type) => !commonChecks.some((check) => check.checkType === type && check.resultStatus !== 'NOT_CHECKED' && (!['POTENTIAL_MATCH', 'CONFIRMED_MATCH'].includes(check.resultStatus) || hasComment(check.notes))));
          const missingEvidence = evidenceTypes.some((type) => !evidence.some((document) => document.checkType === type && document.storagePath));
          const form = await tx.kycForm.findFirst({ where, include: this.formInclude() });
          const current = form ? this.serializeForm(form) : null;
          const company: Record<string, unknown> = current?.sectionA || {};
          const requiredParties = [
            { fullName: this.text(company.legalName) || client.name, identityNumber: this.text(company.commercialRegistrationNo) || client.registrationNumber },
            ...this.asArray<RowPayload>(current?.sectionB.shareholders),
            ...this.asArray<RowPayload>(current?.sectionB.ubos),
            ...this.asArray<RowPayload>(current?.sectionC.managers)
          ].filter((row) => this.text(row.fullName).trim());
          const missingParty = requiredParties.some((row) => !screening.some((record) =>
            record.status === 'COMPLETED' && (this.text(row.identityNumber).trim()
              ? this.text(record.identifier).trim().toLowerCase() === this.text(row.identityNumber).trim().toLowerCase()
              : record.entityName.trim().toLowerCase() === this.text(row.fullName).trim().toLowerCase())));
          if (!screening.length || missingParty) throw new BadRequestException('Complete Screening for the client and every current shareholder, beneficial owner and manager before submitting to DMLRO.');
          if (missingCommonChecks || missingEvidence) throw new BadRequestException('Complete Screening common-list results and upload the NCTC, UN, OFAC, EU and PPO evidence before submitting to DMLRO.');
          if (screening.some((record) => record.status !== 'COMPLETED' || !record.conclusionStatus || !hasComment(record.remarks) || record.checks.some((check) => check.isSelected && (check.resultStatus === 'NOT_CHECKED' || ['POTENTIAL_MATCH', 'CONFIRMED_MATCH'].includes(check.resultStatus) && !hasComment(check.notes))))) {
            throw new BadRequestException('Complete Screening records with final results, remarks and comments for any matches before submitting to DMLRO.');
          }
  }

  private async assertCrrfReady(tx: Prisma.TransactionClient, kycCase: { id: string; tenantId: string }) {
          const crrf = await tx.crrfRecord.findFirst({ where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id }, include: { documents: true } });
          if (!crrf?.riskRating || !crrf.documents.some((document) => document.storagePath)) {
            throw new BadRequestException('Complete the CRRF risk rating and upload the CRRF document before submitting to DMLRO.');
          }
  }

  private async returnDmlroReviewToSupervisor(user: RequestUser, id: string, dto: Record<string, unknown>) {
    const kycCase = await this.findOne(user, id);
    await this.assertEditableReview(id, ReviewStage.DMLRO);
    const decision = dto.decision as ReviewDecision;
    const nextStatus =
      decision === ReviewDecision.REQUEST_ADDITIONAL_INFORMATION
        ? KycCaseStatus.SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED
        : KycCaseStatus.SUPERVISOR_REVIEW_PENDING;
    const note =
      decision === ReviewDecision.REQUEST_ADDITIONAL_INFORMATION
        ? 'DMLRO requested additional information from AML Supervisor'
        : 'DMLRO returned the case to AML Supervisor';

    return this.prisma.$transaction(async (tx) => {
      const saved = await this.saveReturnedReviewSubmission(tx, user, kycCase, dto);
      await this.clearReviewTaskStatus(tx, id, ReviewStage.DMLRO, ReviewTaskStatus.RETURNED);
      await tx.internalReviewTask.updateMany({
        where: { tenantId: kycCase.tenantId, kycCaseId: id, stage: ReviewStage.DMLRO, status: { in: [ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS, ReviewTaskStatus.PAUSED] } },
        data: { status: ReviewTaskStatus.RETURNED, completedAt: new Date(), updatedBy: user.id }
      });
      await tx.internalReviewTask.upsert({
        where: { kycCaseId_stage_status: { kycCaseId: id, stage: ReviewStage.SUPERVISOR, status: ReviewTaskStatus.PENDING } },
        update: { updatedBy: user.id },
        create: {
          tenantId: kycCase.tenantId,
          kycCaseId: id,
          stage: ReviewStage.SUPERVISOR,
          createdBy: user.id,
          updatedBy: user.id
        }
      });

      await this.recordStatus(tx, kycCase, user, nextStatus, note);
      await this.audit(tx, user, kycCase.tenantId, 'InternalReviewSubmission', saved.id, { action: 'DMLRO_RETURNED_TO_SUPERVISOR', decision });
      await this.createNotification(
        tx,
        kycCase,
        decision === ReviewDecision.REQUEST_ADDITIONAL_INFORMATION ? NotificationType.ADDITIONAL_INFORMATION_REQUESTED : NotificationType.SUPERVISOR_TASK_ASSIGNED,
        decision === ReviewDecision.REQUEST_ADDITIONAL_INFORMATION ? 'Additional information requested' : 'AML Supervisor review requested',
        `${kycCase.title}: ${note}.`
      );

      return tx.kycCase.findUniqueOrThrow({ where: { id }, include: this.caseInclude() });
    });
  }

  private async lockReviewSubmission(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    kycCase: { id: string; tenantId: string },
    stage: ReviewStage,
    dto: Record<string, unknown>
  ) {
    const version =
      (await tx.internalReviewVersion.count({
        where: { kycCaseId: kycCase.id, stage }
      })) + 1;
    const data = this.jsonValue(dto.data || dto);

    const saved = await tx.internalReviewSubmission.upsert({
      where: { kycCaseId_stage: { kycCaseId: kycCase.id, stage } },
      update: {
        version,
        data,
        formalComments: safeComment(dto.formalComments) || null,
        confidentialNotes: this.optionalText(dto.confidentialNotes),
        status: ReviewSubmissionStatus.SUBMITTED,
        submittedById: user.id,
        submittedAt: new Date(),
        isLocked: true,
        updatedBy: user.id
      },
      create: {
        tenantId: kycCase.tenantId,
        kycCaseId: kycCase.id,
        stage,
        data,
        formalComments: safeComment(dto.formalComments) || null,
        confidentialNotes: this.optionalText(dto.confidentialNotes),
        status: ReviewSubmissionStatus.SUBMITTED,
        submittedById: user.id,
        submittedAt: new Date(),
        isLocked: true,
        createdBy: user.id,
        updatedBy: user.id
      }
    });

    await tx.internalReviewVersion.create({
      data: {
        tenantId: kycCase.tenantId,
        kycCaseId: kycCase.id,
        stage,
        version,
        snapshot: data,
        submittedBy: user.id,
        submittedAt: new Date()
      }
    });

    await tx.reviewerComment.updateMany({
      where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id, stage, type: ReviewCommentType.FORMAL },
      data: { isLocked: true }
    });

    const form = await tx.kycForm.findFirst({ where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id }, select: { id: true } });
    if (form && hasComment(dto.formalComments)) {
      const comment = safeComment(dto.formalComments);
      const patch = stage === ReviewStage.SUPERVISOR ? { amlClarificationFindings: comment }
        : stage === ReviewStage.DMLRO ? { dmlroComments: comment }
        : stage === ReviewStage.MLRO ? { mlroComments: comment } : { sefComments: comment };
      await tx.kycInternalReview.upsert({
        where: { kycFormId: form.id }, update: { ...patch, updatedBy: user.id },
        create: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id, kycFormId: form.id, ...patch, createdBy: user.id, updatedBy: user.id }
      });
    }
    return saved;
  }

  private async saveReturnedReviewSubmission(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    kycCase: { id: string; tenantId: string },
    dto: Record<string, unknown>
  ) {
    const existing = await tx.internalReviewSubmission.findUnique({
      where: { kycCaseId_stage: { kycCaseId: kycCase.id, stage: ReviewStage.DMLRO } }
    });
    const version =
      (await tx.internalReviewVersion.count({
        where: { kycCaseId: kycCase.id, stage: ReviewStage.DMLRO }
      })) + 1;
    const data = this.jsonValue(dto.data || dto);

    const saved = await tx.internalReviewSubmission.upsert({
      where: { kycCaseId_stage: { kycCaseId: kycCase.id, stage: ReviewStage.DMLRO } },
      update: {
        data,
        formalComments: safeComment(dto.formalComments) || null,
        confidentialNotes: this.optionalText(dto.confidentialNotes),
        status: ReviewSubmissionStatus.RETURNED,
        submittedById: user.id,
        submittedAt: new Date(),
        isLocked: false,
        updatedBy: user.id
      },
      create: {
        tenantId: kycCase.tenantId,
        kycCaseId: kycCase.id,
        stage: ReviewStage.DMLRO,
        data,
        formalComments: safeComment(dto.formalComments) || null,
        confidentialNotes: this.optionalText(dto.confidentialNotes),
        status: ReviewSubmissionStatus.RETURNED,
        submittedById: user.id,
        submittedAt: new Date(),
        isLocked: false,
        createdBy: user.id,
        updatedBy: user.id
      }
    });

    await tx.internalReviewVersion.create({
      data: {
        tenantId: kycCase.tenantId,
        kycCaseId: kycCase.id,
        stage: ReviewStage.DMLRO,
        version,
        snapshot: data,
        submittedBy: user.id,
        submittedAt: new Date()
      }
    });

    return saved;
  }

  private recordStatus(
    tx: Prisma.TransactionClient,
    kycCase: { id: string; tenantId: string; status: KycCaseStatus },
    user: RequestUser,
    toStatus: KycCaseStatus,
    note: string
  ) {
    return Promise.all([
      tx.kycCase.update({ where: { id: kycCase.id }, data: { status: toStatus } }),
      kycCase.status === toStatus
        ? Promise.resolve()
        : tx.kycCaseStatusHistory.create({
            data: {
              tenantId: kycCase.tenantId,
              kycCaseId: kycCase.id,
              fromStatus: kycCase.status,
              toStatus,
              changedById: user.id,
              note
            }
          })
    ]);
  }

  private audit(tx: Prisma.TransactionClient, user: RequestUser, tenantId: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) {
    return tx.auditLog.create({
      data: {
        tenantId,
        actorId: user.id,
        action: 'UPDATE',
        entityType,
        entityId,
        metadata: this.jsonValue(metadata)
      }
    });
  }

  private createNotification(tx: Prisma.TransactionClient, kycCase: { id: string; tenantId: string }, type: NotificationType, title: string, message: string) {
    return tx.notification.create({
      data: {
        tenantId: kycCase.tenantId,
        kycCaseId: kycCase.id,
        type,
        title,
        message
      }
    });
  }

  private mlroDecisionStatus(decision: ReviewDecision) {
    if (decision === ReviewDecision.APPROVE_WITH_CONDITIONS) return KycCaseStatus.MLRO_APPROVED_WITH_CONDITIONS;
    if (decision === ReviewDecision.REJECT) return KycCaseStatus.MLRO_REJECTED;
    if (decision === ReviewDecision.REQUEST_ADDITIONAL_INFORMATION) return KycCaseStatus.MLRO_ADDITIONAL_INFORMATION_REQUIRED;
    if (decision === ReviewDecision.RETURN_TO_DMLRO) return KycCaseStatus.DMLRO_REVIEW_PENDING;
    if (decision === ReviewDecision.SEND_TO_SEF) return KycCaseStatus.SEF_DECISION_PENDING;
    return KycCaseStatus.MLRO_APPROVED;
  }

  private mlroNotificationType(decision: ReviewDecision) {
    if (decision === ReviewDecision.APPROVE_WITH_CONDITIONS) return NotificationType.MLRO_APPROVAL_WITH_CONDITIONS;
    if (decision === ReviewDecision.REJECT) return NotificationType.MLRO_REJECTION;
    return NotificationType.MLRO_APPROVAL_COMPLETED;
  }

  private mlroStatusNote(decision: ReviewDecision) {
    if (decision === ReviewDecision.RETURN_TO_DMLRO) return 'MLRO sent the KYC file back to DMLRO for action';
    if (decision === ReviewDecision.SEND_TO_SEF) return 'MLRO sent the KYC file to SEF for management decision';
    if (decision === ReviewDecision.REQUEST_ADDITIONAL_INFORMATION) return 'MLRO requested additional information';
    if (decision === ReviewDecision.REJECT) return 'MLRO rejected the KYC file';
    if (decision === ReviewDecision.APPROVE_WITH_CONDITIONS) return 'MLRO approved the KYC file with conditions';
    return 'MLRO approved the KYC file';
  }

  private mlroNotificationTitle(decision: ReviewDecision) {
    if (decision === ReviewDecision.RETURN_TO_DMLRO) return 'Returned to DMLRO';
    if (decision === ReviewDecision.REQUEST_ADDITIONAL_INFORMATION) return 'Additional information requested';
    if (decision === ReviewDecision.REJECT) return 'MLRO rejected KYC file';
    if (decision === ReviewDecision.APPROVE_WITH_CONDITIONS) return 'MLRO approved with conditions';
    return 'MLRO review completed';
  }

  private mlroNotificationMessage(caseTitle: string, decision: ReviewDecision) {
    if (decision === ReviewDecision.RETURN_TO_DMLRO) return `${caseTitle} was sent back to DMLRO for action.`;
    if (decision === ReviewDecision.REQUEST_ADDITIONAL_INFORMATION) return `${caseTitle} requires additional information requested by MLRO.`;
    if (decision === ReviewDecision.REJECT) return `${caseTitle} was rejected by MLRO.`;
    if (decision === ReviewDecision.APPROVE_WITH_CONDITIONS) return `${caseTitle} was approved by MLRO with conditions.`;
    return `${caseTitle} was approved by MLRO.`;
  }

  private reviewStagesForUser(user: RequestUser) {
    const stages: ReviewStage[] = [];
    if (this.hasAnyRole(user, ['SUPER_ADMIN', 'COMPANY_ADMIN'])) {
      return [ReviewStage.DMLRO, ReviewStage.MLRO, ReviewStage.SEF];
    }
    if (this.hasAnyRole(user, ['DMLRO'])) stages.push(ReviewStage.DMLRO);
    if (this.hasAnyRole(user, ['MLRO'])) stages.push(ReviewStage.MLRO);
    if (this.hasAnyRole(user, ['SEF'])) stages.push(ReviewStage.SEF);
    return stages;
  }

  private reviewNotificationTypesForUser(user: RequestUser) {
    const types: NotificationType[] = [];
    if (this.hasAnyRole(user, ['SUPER_ADMIN', 'COMPANY_ADMIN'])) {
      return [
        NotificationType.DMLRO_TASK_ASSIGNED,
        NotificationType.MLRO_TASK_ASSIGNED,
        NotificationType.SEF_TASK_ASSIGNED,
        NotificationType.MLRO_APPROVAL_COMPLETED,
        NotificationType.MLRO_APPROVAL_WITH_CONDITIONS
      ];
    }
    if (this.hasAnyRole(user, ['DMLRO'])) types.push(NotificationType.DMLRO_TASK_ASSIGNED);
    if (this.hasAnyRole(user, ['MLRO'])) types.push(NotificationType.MLRO_TASK_ASSIGNED);
    if (this.hasAnyRole(user, ['SEF'])) {
      types.push(NotificationType.SEF_TASK_ASSIGNED, NotificationType.MLRO_APPROVAL_COMPLETED, NotificationType.MLRO_APPROVAL_WITH_CONDITIONS);
    }
    return types;
  }

  private async saveRiskReclassification(tx: Prisma.TransactionClient, user: RequestUser, kycCase: { id: string; tenantId: string }, dto: Record<string, unknown>) {
    const newRisk = this.enumValue(dto.finalRiskClassification, ['LOW', 'MEDIUM', 'HIGH'], 'Final risk classification') as RiskClassification;
    const reasonCategory = this.enumValue(dto.riskReasonCategory || 'PROFESSIONAL_JUDGEMENT', ['PEP_IDENTIFIED', 'SANCTIONS_FINDING', 'ADVERSE_MEDIA', 'OWNERSHIP_COMPLEXITY', 'COUNTRY_RISK', 'INDUSTRY_RISK', 'SOURCE_OF_FUNDS_CONCERN', 'ENHANCED_MONITORING_REQUIRED', 'PROFESSIONAL_JUDGEMENT', 'OTHER'], 'Risk override reason') as RiskOverrideReason;
    const previousRisk = this.enumValue(dto.previousRiskClassification, ['LOW', 'MEDIUM', 'HIGH'], 'Previous risk classification') as RiskClassification | null;
    const explanation = this.requiredText(dto.riskExplanation, 'Risk classification explanation');

    const record = await tx.riskReclassification.create({
      data: {
        tenantId: kycCase.tenantId,
        kycCaseId: kycCase.id,
        previousRisk,
        newRisk,
        reasonCategory,
        explanation,
        effectiveDate: this.dateValue(dto.riskEffectiveDate) || new Date(),
        changedById: user.id
      }
    });

    await this.audit(tx, user, kycCase.tenantId, 'RiskReclassification', record.id, { action: 'RISK_CLASSIFICATION_CHANGED', previousRisk, newRisk, reasonCategory });
    await this.createNotification(tx, kycCase, NotificationType.RISK_CLASSIFICATION_CHANGED, 'Risk classification changed', `Final risk classification changed to ${newRisk}.`);
  }

  private confidentialCommentWhere(user: RequestUser): Prisma.ReviewerCommentWhereInput {
    if (!this.hasAnyRole(user, ['AML_SUPERVISOR', 'AML_TEAM', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) {
      return { id: '__none__' };
    }
    if (this.hasAnyRole(user, ['COMPANY_ADMIN', 'SUPER_ADMIN', 'MLRO', 'SEF'])) return { type: ReviewCommentType.CONFIDENTIAL };
    if (this.hasAnyRole(user, ['DMLRO'])) {
      return { type: ReviewCommentType.CONFIDENTIAL, visibilityScope: { in: [ConfidentialVisibilityScope.SUPERVISOR_DMLRO_MLRO, ConfidentialVisibilityScope.DMLRO_MLRO] } };
    }
    return { type: ReviewCommentType.CONFIDENTIAL, visibilityScope: ConfidentialVisibilityScope.SUPERVISOR_DMLRO_MLRO };
  }

  private activationChecklistItems(kycCase: {
    proposalStatus: ProposalStatus;
    legalDocuments: unknown[];
    kycForm:
      | ({ status: string; requiredDocuments: Array<{ isRequired: boolean; isProvided: boolean }>; internalReview?: { dmlroSignatureFileName: string | null; dmlroSignatureDataUrl: string | null; mlroSignatureFileName: string | null; mlroSignatureDataUrl: string | null } | null } & Record<string, unknown>)
      | null;
    internalReviewSubmissions: Array<{ stage: ReviewStage; isLocked: boolean; data?: Prisma.JsonValue | null }>;
    signedKycDocuments?: Array<{ reviewStage: SignedKycDocumentStage; activeVersion: boolean }>;
    riskReclassifications: unknown[];
  }) {
    const submittedStages = new Set(kycCase.internalReviewSubmissions.filter((item) => item.isLocked).map((item) => item.stage));
    const requiredDocumentsAccepted = kycCase.kycForm?.requiredDocuments?.filter((item) => item.isRequired).every((item) => item.isProvided) ?? false;
    const internalReview = kycCase.kycForm?.internalReview;
    const dmlroSigned = Boolean(internalReview?.dmlroSignatureDataUrl || internalReview?.dmlroSignatureFileName);
    const mlroSigned = Boolean(internalReview?.mlroSignatureDataUrl || internalReview?.mlroSignatureFileName);
    const mlroSubmission = kycCase.internalReviewSubmissions.find((item) => item.stage === ReviewStage.MLRO && item.isLocked) as { data?: Record<string, unknown> } | undefined;
    const sefRequired = mlroSubmission?.data && typeof mlroSubmission.data === 'object' && (mlroSubmission.data as Record<string, unknown>).decision === ReviewDecision.SEND_TO_SEF;
    return [
      { key: 'proposal', label: 'Proposal submitted or not required', completed: ['NOT_REQUIRED', 'SENT', 'ACCEPTED'].includes(kycCase.proposalStatus) },
      { key: 'kycPart1', label: 'KYC form prepared', completed: Boolean(kycCase.kycForm) },
      { key: 'legalDocuments', label: 'Mandatory documents accepted', completed: kycCase.legalDocuments.length > 0 && requiredDocumentsAccepted },
      { key: 'dmlroReview', label: 'DMLRO review completed', completed: submittedStages.has(ReviewStage.DMLRO) },
      { key: 'mlroApproval', label: 'MLRO final approval completed', completed: submittedStages.has(ReviewStage.MLRO) },
      { key: 'sefDecision', label: 'SEF management decision completed', completed: !sefRequired || submittedStages.has(ReviewStage.SEF) },
      { key: 'finalRisk', label: 'Final risk classification assigned', completed: kycCase.riskReclassifications.length > 0 },
      { key: 'signedKyc', label: 'DMLRO and MLRO Section H signatures completed', completed: dmlroSigned && mlroSigned }
    ];
  }

  private async upsertActivationChecklist(tx: Prisma.TransactionClient, user: RequestUser, kycCase: { id: string; tenantId: string }) {
    const fullCase = await tx.kycCase.findUniqueOrThrow({
      where: { id: kycCase.id },
      include: {
        legalDocuments: true,
        kycForm: { include: { requiredDocuments: true, internalReview: true } },
        internalReviewSubmissions: true,
        signedKycDocuments: true,
        riskReclassifications: true
      }
    });
    const checklist = this.activationChecklistItems(fullCase);
    const isReady = checklist.every((item) => item.completed);
    const blockingIssues = checklist.filter((item) => !item.completed);
    await tx.clientActivationChecklist.upsert({
      where: { kycCaseId: kycCase.id },
      update: { checklist: this.jsonValue(checklist), isReady, blockingIssues: this.jsonValue(blockingIssues), completedAt: isReady ? new Date() : null, updatedBy: user.id },
      create: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id, checklist: this.jsonValue(checklist), isReady, blockingIssues: this.jsonValue(blockingIssues), completedAt: isReady ? new Date() : null, createdBy: user.id, updatedBy: user.id }
    });
    if (isReady) {
      await this.recordStatus(tx, fullCase, user, KycCaseStatus.CLIENT_ACTIVATION_PENDING, 'Client ready for activation');
      await this.createNotification(tx, kycCase, NotificationType.CLIENT_READY_FOR_ACTIVATION, 'Client ready for activation', `${fullCase.title} is ready for activation.`);
    }
  }

  private internalReviewAllowedRoles(dto: Record<string, unknown>) {
    const part = typeof dto.reviewPart === 'string' ? dto.reviewPart : 'AML';
    if (part === 'ALL') return ['COMPANY_ADMIN', 'SUPER_ADMIN'];
    if (part === 'DMLRO') return ['DMLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'];
    if (part === 'MLRO') return ['MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'];
    if (part === 'SEF') return ['SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN'];
    return ['AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN'];
  }

  private internalReviewData(dto: Record<string, unknown>): ReviewPatch {
    const part = typeof dto.reviewPart === 'string' ? dto.reviewPart : 'AML';
    const dmlroDecision = this.enumValue(dto.dmlroDecision, ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'DMLRO_FINAL_APPROVE', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_SUPERVISOR'], 'DMLRO decision');
    const dmlroRiskClassification = this.enumValue(dto.dmlroRiskClassification, ['LOW', 'MEDIUM', 'HIGH'], 'DMLRO risk classification');
    const mlroDecision = this.enumValue(dto.mlroDecision, ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_DMLRO', 'SEND_TO_SEF'], 'MLRO final decision');
    const sefDecision = this.enumValue(dto.sefDecision, ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'RETURN_TO_MLRO', 'REJECT'], 'SEF management decision');
    const mlroFinalRiskClassification = this.enumValue(dto.mlroFinalRiskClassification, ['LOW', 'MEDIUM', 'HIGH'], 'Final risk classification');
    const mlroRiskReasonCategory = this.enumValue(dto.mlroRiskReasonCategory, ['PEP_IDENTIFIED', 'SANCTIONS_FINDING', 'ADVERSE_MEDIA', 'OWNERSHIP_COMPLEXITY', 'COUNTRY_RISK', 'INDUSTRY_RISK', 'SOURCE_OF_FUNDS_CONCERN', 'ENHANCED_MONITORING_REQUIRED', 'PROFESSIONAL_JUDGEMENT', 'OTHER'], 'Risk reason category');

    if (part === 'ALL') {
      const riskClassification = this.enumValue(dto.riskClassification, ['LOW', 'MEDIUM', 'HIGH'], 'Risk classification');
      const dueDiligenceType = this.enumValue(dto.dueDiligenceType, ['SIMPLIFIED', 'REGULAR', 'ENHANCED'], 'Due diligence type');

      return {
        amlAccuracyChecked: Boolean(dto.amlAccuracyChecked),
        amlClarificationFindings: safeComment(dto.amlClarificationFindings) || null,
        riskClassification: riskClassification as RiskClassification | null,
        dueDiligenceType: dueDiligenceType as DueDiligenceType | null,
        amlName: this.optionalText(dto.amlName),
        amlSignatureFileName: this.optionalText(dto.amlSignatureFileName),
        amlSignatureDataUrl: this.optionalText(dto.amlSignatureDataUrl),
        amlDate: this.dateValue(dto.amlDate),
        dmlroName: this.optionalText(dto.dmlroName),
        dmlroSignatureFileName: this.optionalText(dto.dmlroSignatureFileName),
        dmlroSignatureDataUrl: this.optionalText(dto.dmlroSignatureDataUrl),
        dmlroDate: this.dateValue(dto.dmlroDate),
        dmlroRiskClassification: dmlroRiskClassification as RiskClassification | null,
        dmlroDecision: dmlroDecision as ReviewDecision | null,
        dmlroConditions: this.optionalText(dto.dmlroConditions),
        dmlroReason: this.optionalText(dto.dmlroReason),
        dmlroComments: safeComment(dto.dmlroComments) || null,
        mlroName: this.optionalText(dto.mlroName),
        mlroSignatureFileName: this.optionalText(dto.mlroSignatureFileName),
        mlroSignatureDataUrl: this.optionalText(dto.mlroSignatureDataUrl),
        mlroDate: this.dateValue(dto.mlroDate),
        mlroDecision: mlroDecision as ReviewDecision | null,
        mlroFinalRiskClassification: mlroFinalRiskClassification as RiskClassification | null,
        mlroRiskReasonCategory: mlroRiskReasonCategory as RiskOverrideReason | null,
        mlroRiskExplanation: this.optionalText(dto.mlroRiskExplanation),
        mlroConditions: this.optionalText(dto.mlroConditions),
        mlroComments: safeComment(dto.mlroComments) || null,
        sefName: this.optionalText(dto.sefName),
        sefSignatureFileName: this.optionalText(dto.sefSignatureFileName),
        sefSignatureDataUrl: this.optionalText(dto.sefSignatureDataUrl),
        sefDate: this.dateValue(dto.sefDate),
        sefDecision: sefDecision as ReviewDecision | null,
        sefConditions: this.optionalText(dto.sefConditions),
        sefComments: safeComment(dto.sefComments) || null
      };
    }

    if (part === 'DMLRO') {
      return {
        dmlroName: this.optionalText(dto.dmlroName),
        dmlroSignatureFileName: this.optionalText(dto.dmlroSignatureFileName),
        dmlroSignatureDataUrl: this.optionalText(dto.dmlroSignatureDataUrl),
        dmlroDate: this.dateValue(dto.dmlroDate),
        dmlroRiskClassification: dmlroRiskClassification as RiskClassification | null,
        dmlroDecision: dmlroDecision as ReviewDecision | null,
        dmlroConditions: this.optionalText(dto.dmlroConditions),
        dmlroReason: this.optionalText(dto.dmlroReason),
        dmlroComments: safeComment(dto.dmlroComments) || null
      };
    }

    if (part === 'MLRO') {
      return {
        mlroName: this.optionalText(dto.mlroName),
        mlroSignatureFileName: this.optionalText(dto.mlroSignatureFileName),
        mlroSignatureDataUrl: this.optionalText(dto.mlroSignatureDataUrl),
        mlroDate: this.dateValue(dto.mlroDate),
        mlroDecision: mlroDecision as ReviewDecision | null,
        mlroFinalRiskClassification: mlroFinalRiskClassification as RiskClassification | null,
        mlroRiskReasonCategory: mlroRiskReasonCategory as RiskOverrideReason | null,
        mlroRiskExplanation: this.optionalText(dto.mlroRiskExplanation),
        mlroConditions: this.optionalText(dto.mlroConditions),
        mlroComments: safeComment(dto.mlroComments) || null
      };
    }

    if (part === 'SEF') {
      return {
        sefName: this.optionalText(dto.sefName),
        sefSignatureFileName: this.optionalText(dto.sefSignatureFileName),
        sefSignatureDataUrl: this.optionalText(dto.sefSignatureDataUrl),
        sefDate: this.dateValue(dto.sefDate),
        sefDecision: sefDecision as ReviewDecision | null,
        sefConditions: this.optionalText(dto.sefConditions),
        sefComments: safeComment(dto.sefComments) || null
      };
    }

    const riskClassification = this.enumValue(dto.riskClassification, ['LOW', 'MEDIUM', 'HIGH'], 'Risk classification');
    const dueDiligenceType = this.enumValue(dto.dueDiligenceType, ['SIMPLIFIED', 'REGULAR', 'ENHANCED'], 'Due diligence type');

    return {
      amlAccuracyChecked: Boolean(dto.amlAccuracyChecked),
      amlClarificationFindings: this.optionalText(dto.amlClarificationFindings),
      riskClassification: riskClassification as RiskClassification | null,
      dueDiligenceType: dueDiligenceType as DueDiligenceType | null,
      amlName: this.optionalText(dto.amlName),
      amlSignatureFileName: this.optionalText(dto.amlSignatureFileName),
      amlSignatureDataUrl: this.optionalText(dto.amlSignatureDataUrl),
      amlDate: this.dateValue(dto.amlDate)
    };
  }

  private validateEmail(value: unknown) {
    if (!value) return;
    if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new BadRequestException('Provide a valid email address');
    }
  }

  private enumValue(value: unknown, allowed: string[], label: string) {
    if (!value) return null;
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new BadRequestException(`${label} must be one of ${allowed.join(', ')}`);
    }
    return value;
  }

  private asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private hasRowValue(row: RowPayload) {
    return Object.values(row).some((value) => value !== null && value !== undefined && String(value).trim() !== '');
  }

  private requiredText(value: unknown, label: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${label} is required`);
    }
    return value.trim();
  }

  private optionalText(value: unknown) {
    if (Array.isArray(value)) {
      const text = value.map((item) => this.text(item).trim()).filter(Boolean).join(', ');
      return text || null;
    }

    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private dateValue(value: unknown) {
    if (!value || typeof value !== 'string') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date value');
    }
    return date;
  }

  private numberValue(value: unknown) {
    if (value === undefined || value === null || value === '') return 0;
    const number = Number(value);
    if (Number.isNaN(number) || number < 0) {
      throw new BadRequestException('Percentage fields must be numeric');
    }
    return number;
  }

  private decimalValue(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    return new Prisma.Decimal(this.numberValue(value));
  }

  private jsonValue(data: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private async nextGeneratedVersion(kycFormId: string, documentType: KycGeneratedDocumentType) {
    const latest = await this.prisma.kycGeneratedDocument.findFirst({
      where: { kycFormId, documentType },
      orderBy: { version: 'desc' }
    });

    return (latest?.version || 0) + 1;
  }

  private text(value: unknown) {
    if (value === null || value === undefined) return '';
    if (value === 'undefined') return '';
    if (value instanceof Prisma.Decimal) return value.toString();
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
  }

  private optionText(value: unknown, otherValue: unknown): string {
    if (Array.isArray(value)) {
      return value.map((item) => this.optionText(item, otherValue)).filter(Boolean).join(', ');
    }

    if (value === 'Other') {
      return this.text(otherValue) || 'Other';
    }

    return this.text(value);
  }

  private legalDocumentUploadRoot() {
    return normalize(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads', 'legal-documents'));
  }

  private signedKycDocumentUploadRoot() {
    return normalize(process.env.SIGNED_KYC_UPLOAD_DIR || join(process.cwd(), 'uploads', 'signed-kyc-documents'));
  }

  private resolveLegalDocumentPath(storagePath: string) {
    const uploadRoot = this.legalDocumentUploadRoot();
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

  private async ensureKycNumber(form: Prisma.KycFormGetPayload<{ include: ReturnType<KycService['formInclude']> }>) {
    const section = form.sections.find((item) => item.sectionKey === KycFormSectionKey.GENERAL_COMPANY);
    const data = (section?.data || {}) as Record<string, unknown>;
    if (typeof data.reference === 'string' && data.reference.trim()) return form;

    const kycNumber = form.kycCase.kycNumber || (await this.generatedKycNumber(form.kycCase.tenantId, form.kycCase.id, form.kycCase.createdAt));
    const nextData = this.jsonValue({ ...data, reference: kycNumber });

    if (section) {
      await this.prisma.kycSectionData.update({
        where: { id: section.id },
        data: { data: nextData, updatedBy: form.updatedBy }
      });
    } else {
      await this.prisma.kycSectionData.create({
        data: {
          tenantId: form.tenantId,
          kycCaseId: form.kycCaseId,
          kycFormId: form.id,
          sectionKey: KycFormSectionKey.GENERAL_COMPANY,
          data: nextData,
          createdBy: form.createdBy,
          updatedBy: form.updatedBy
        }
      });
    }

    return this.prisma.kycForm.findUniqueOrThrow({ where: { id: form.id }, include: this.formInclude() });
  }

  private async generatedKycNumber(tenantId: string, caseId: string, createdAt: Date) {
    const year = createdAt.getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
    const cases = await this.prisma.kycCase.findMany({
      where: {
        tenantId,
        createdAt: { gte: yearStart, lt: nextYearStart }
      },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    const index = Math.max(0, cases.findIndex((item) => item.id === caseId));
    return `KYC-${year}-${String(index + 1).padStart(4, '0')}`;
  }

  private async withKycNumber<T extends { tenantId: string; id: string; createdAt: Date; kycNumber?: string | null }>(kycCase: T) {
    return {
      ...kycCase,
      kycNumber: kycCase.kycNumber || (await this.generatedKycNumber(kycCase.tenantId, kycCase.id, kycCase.createdAt))
    };
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

  private legalDocumentSyncKey(documentType: string, fileName: string) {
    return `${documentType.trim().toLowerCase()}::${fileName.trim().toLowerCase()}`;
  }

  private caseInclude() {
    return {
      sourceEnquiry: { select: { id: true, enquiryType: true, details: true } },
      kycForm: { select: { status: true } },
      client: { include: { contacts: true } },
      service: true,
      legalDocuments: { orderBy: { createdAt: 'desc' as const } },
      comments: {
        include: {
          author: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' as const }
      },
      statusHistory: { orderBy: { createdAt: 'asc' as const } },
      notifications: { orderBy: { createdAt: 'desc' as const } }
    };
  }
}

type RowPayload = Record<string, unknown>;

type KycFormDraftPayload = {
  sectionA?: Record<string, unknown>;
  sectionB?: Record<string, unknown>;
  sectionC?: Record<string, unknown>;
  sectionD?: Record<string, unknown>;
  sectionE?: Record<string, unknown>;
  sectionF?: Record<string, unknown>;
  sectionG?: Record<string, unknown>;
  sectionH?: Record<string, unknown>;
};

type SerializedKycForm = ReturnType<KycService['serializeForm']>;

type ReviewPatch = {
  amlAccuracyChecked?: boolean;
  amlClarificationFindings?: string | null;
  riskClassification?: RiskClassification | null;
  dueDiligenceType?: DueDiligenceType | null;
  amlName?: string | null;
  amlSignatureFileName?: string | null;
  amlSignatureDataUrl?: string | null;
  amlDate?: Date | null;
  dmlroName?: string | null;
  dmlroSignatureFileName?: string | null;
  dmlroSignatureDataUrl?: string | null;
  dmlroDate?: Date | null;
  dmlroRiskClassification?: RiskClassification | null;
  dmlroDecision?: ReviewDecision | null;
  dmlroConditions?: string | null;
  dmlroReason?: string | null;
  dmlroComments?: string | null;
  mlroName?: string | null;
  mlroSignatureFileName?: string | null;
  mlroSignatureDataUrl?: string | null;
  mlroDate?: Date | null;
  mlroDecision?: ReviewDecision | null;
  mlroFinalRiskClassification?: RiskClassification | null;
  mlroRiskReasonCategory?: RiskOverrideReason | null;
  mlroRiskExplanation?: string | null;
  mlroConditions?: string | null;
  mlroComments?: string | null;
  sefName?: string | null;
  sefSignatureFileName?: string | null;
  sefSignatureDataUrl?: string | null;
  sefDate?: Date | null;
  sefDecision?: ReviewDecision | null;
  sefConditions?: string | null;
  sefComments?: string | null;
};
