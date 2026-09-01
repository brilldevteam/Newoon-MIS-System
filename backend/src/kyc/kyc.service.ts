import { BadRequestException, ForbiddenException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import {
  ConfidentialVisibilityScope,
  DueDiligenceType,
  KycCaseStatus,
  KycFormSectionKey,
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
import { execFile } from 'child_process';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, isAbsolute, join, normalize, relative } from 'path';
import { promisify } from 'util';
import { deflateSync } from 'zlib';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { AddWorkflowCommentDto } from './dto/add-workflow-comment.dto';
import { AssignServiceDto } from './dto/assign-service.dto';
import { CreateKycCaseDto } from './dto/create-kyc-case.dto';
import { UpdateKycCaseDto } from './dto/update-kyc-case.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';
import { UploadLegalDocumentDto } from './dto/upload-legal-document.dto';

const execFileAsync = promisify(execFile);

const TINY_FONT: Record<string, string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '00000', '01100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  "'": ['00100', '00100', '00000', '00000', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '/': ['00001', '00010', '00100', '01000', '10000', '00000', '00000'],
  '%': ['11001', '11010', '00100', '01000', '10110', '00110', '00000'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
  '?': ['11110', '00001', '00010', '00100', '00100', '00000', '00100'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111']
};

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
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser) {
    const where: Prisma.KycCaseWhereInput = this.tenantWhere(user);

    return this.prisma.kycCase.findMany({
      where,
      include: this.caseInclude(),
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(user: RequestUser, id: string) {
    const kycCase = await this.prisma.kycCase.findFirst({
      where: { id, ...this.tenantWhere(user) },
      include: this.caseInclude()
    });

    if (!kycCase) {
      throw new NotFoundException('KYC case not found');
    }

    return kycCase;
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
      const kycCase = await tx.kycCase.create({
        data: {
          tenantId,
          clientId: client.id,
          serviceId: service?.id,
          title,
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
    if (!documentType?.trim()) {
      throw new BadRequestException('Document type is required');
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('Upload a document file');
    }

    const kycCase = await this.requireWritableCase(user, id);
    const uploadRoot = this.legalDocumentUploadRoot();
    const caseDirectory = join(uploadRoot, kycCase.tenantId, kycCase.id);
    mkdirSync(caseDirectory, { recursive: true });

    const fileName = this.safeFileName(file.originalname);
    const storedFileName = `${Date.now()}-${fileName}`;
    const absolutePath = join(caseDirectory, storedFileName);
    writeFileSync(absolutePath, file.buffer);

    const storagePath = join(kycCase.tenantId, kycCase.id, storedFileName);

    return this.uploadLegalDocument(user, id, {
      documentType: documentType.trim(),
      fileName,
      storagePath,
      mimeType: file.mimetype,
      size: file.size
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

  async submitToAml(user: RequestUser, id: string) {
    const kycCase = await this.requireWritableCase(user, id);
    const documentsCount = await this.prisma.legalDocument.count({
      where: { kycCaseId: id, tenantId: kycCase.tenantId }
    });

    if (!documentsCount) {
      throw new BadRequestException('Upload at least one document required for KYC preparation before submitting to DMLRO');
    }

    return this.prisma.$transaction(async (tx) => {
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
        formalComments: this.optionalText(dto.formalComments),
        confidentialNotes: this.optionalText(dto.confidentialNotes),
        updatedBy: user.id
      },
      create: {
        tenantId: kycCase.tenantId,
        kycCaseId: id,
        stage,
        data: this.jsonValue(dto.data || dto),
        formalComments: this.optionalText(dto.formalComments),
        confidentialNotes: this.optionalText(dto.confidentialNotes),
        createdBy: user.id,
        updatedBy: user.id
      }
    });
  }

  async submitSupervisorReview(user: RequestUser, id: string, dto: Record<string, unknown>) {
    this.assertStageRole(user, ReviewStage.SUPERVISOR);
    return this.submitReviewAndRoute(user, id, ReviewStage.SUPERVISOR, dto, ReviewStage.DMLRO);
  }

  async submitDmlroReview(user: RequestUser, id: string, dto: Record<string, unknown>) {
    this.assertStageRole(user, ReviewStage.DMLRO);
    const decision = this.enumValue(dto.decision || 'APPROVE', ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_SUPERVISOR'], 'DMLRO decision') as ReviewDecision;
    const reason = this.optionalText(dto.reason);
    const conditions = this.optionalText(dto.conditions);

    const decisionsRequiringReason: ReviewDecision[] = [
      ReviewDecision.APPROVE_WITH_CONDITIONS,
      ReviewDecision.REQUEST_ADDITIONAL_INFORMATION,
      ReviewDecision.RETURN_TO_SUPERVISOR
    ];
    if (decisionsRequiringReason.includes(decision) && !reason && !conditions) {
      throw new BadRequestException('Provide DMLRO comments, reason, or conditions for this decision');
    }

    if (decision === ReviewDecision.APPROVE || decision === ReviewDecision.APPROVE_WITH_CONDITIONS) {
      return this.submitReviewAndRoute(user, id, ReviewStage.DMLRO, { ...dto, decision }, ReviewStage.MLRO);
    }

    return this.returnDmlroReviewToSupervisor(user, id, { ...dto, decision });
  }

  async decideMlroReview(user: RequestUser, id: string, dto: Record<string, unknown>) {
    this.assertStageRole(user, ReviewStage.MLRO);
    const decision = this.enumValue(dto.decision, ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_DMLRO', 'SEND_TO_SEF'], 'MLRO decision') as ReviewDecision;
    const kycCase = await this.findOne(user, id);
    await this.assertPreviousStageComplete(id, ReviewStage.MLRO);

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

    if (dto.finalRiskClassification && dto.finalRiskClassification !== dto.previousRiskClassification && !this.optionalText(dto.riskExplanation)) {
      throw new BadRequestException('Risk classification changes require an explanation');
    }

    const finalRiskClassification = this.optionalText(dto.finalRiskClassification);
    if (decision === ReviewDecision.SEND_TO_SEF && finalRiskClassification !== RiskClassification.HIGH) {
      throw new BadRequestException('SEF management approval is required only for high-risk KYC files. Select High as the final risk classification before sending to SEF.');
    }
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
    const decision = this.enumValue(dto.decision, ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT'], 'SEF decision') as ReviewDecision;
    const kycCase = await this.findOne(user, id);
    await this.assertPreviousStageComplete(id, ReviewStage.SEF);

    const sefDecisionsRequiringReason: ReviewDecision[] = [ReviewDecision.APPROVE_WITH_CONDITIONS, ReviewDecision.REJECT];
    if (sefDecisionsRequiringReason.includes(decision) && !this.optionalText(dto.reason) && !this.optionalText(dto.conditions)) {
      throw new BadRequestException('Provide SEF reason or conditions for this decision');
    }

    return this.prisma.$transaction(async (tx) => {
      const saved = await this.lockReviewSubmission(tx, user, kycCase, ReviewStage.SEF, dto);
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
      return this.serializeForm(form);
    }

    const created = await this.createForm(user, id);
    return this.serializeForm(created);
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
    const total = rows.filter((row) => !this.text(row.parentRowId)).reduce((sum, row) => sum + this.numberValue(row.ownershipPercentage), 0);
    const layerTotals = rows.reduce<Record<string, number>>((totals, row) => {
      const parentKey = this.text(row.parentRowId) || 'ROOT';
      totals[parentKey] = (totals[parentKey] || 0) + this.numberValue(row.ownershipPercentage);
      return totals;
    }, {});

    if (Object.values(layerTotals).some((layerTotal) => layerTotal > 100)) {
      throw new BadRequestException('Ownership percentage cannot exceed 100% within the same ownership layer');
    }
    const sectionData = {
      totalOwnershipPercentage: total,
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
            fullName: this.requiredText(row.fullName, 'Shareholder full name'),
            nationality: this.optionText(row.nationality, row.nationalityOther),
            dateOfBirth: this.dateValue(row.dateOfBirth),
            identityNumber: this.optionalText(row.identityNumber),
            ownershipPercentage: this.decimalValue(row.ownershipPercentage),
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
            fullName: this.requiredText(row.fullName, 'UBO full name'),
            nationality: this.optionalText(row.nationality),
            dateOfBirth: this.dateValue(row.dateOfBirth),
            identityNumber: this.optionalText(row.identityNumber),
            ownershipPercentage: this.decimalValue(row.ownershipPercentage),
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
    const payload = this.serializeForm(form);
    const version = await this.nextGeneratedVersion(form.id, type);
    const fileBase = `${this.documentCompanyName(payload)} - KYC Document - v${version}`;
    const content =
      type === KycGeneratedDocumentType.DOCX ? this.buildDocx(payload) : await this.buildPdf(payload);
    const fileName = `${fileBase}.${type === KycGeneratedDocumentType.DOCX ? 'docx' : 'pdf'}`;
    const mimeType =
      type === KycGeneratedDocumentType.DOCX
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';

    const generated = await this.prisma.kycGeneratedDocument.create({
      data: {
        tenantId: form.tenantId,
        kycCaseId: id,
        kycFormId: form.id,
        documentType: type,
        version,
        fileName,
        mimeType,
        content: new Uint8Array(content),
        createdBy: user.id,
        updatedBy: user.id
      }
    });

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

      return {
        tasks,
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

    return {
      id: form.id,
      tenantId: form.tenantId,
      kycCaseId: form.kycCaseId,
      status: form.status,
      isLocked: form.isLocked,
      version: form.version,
      sectionA: section(KycFormSectionKey.GENERAL_COMPANY),
      sectionB: {
        ...ownershipSection,
        shareholders: this.sectionRows(ownershipSection.shareholders, form.shareholders),
        ubos: this.sectionRows(ownershipSection.ubos, form.ubos)
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
      [this.documentMatchText('CR of legal entity shareholders')]: ['cr of legal entity shareholders', 'shareholder cr', 'shareholders cr'],
      [this.documentMatchText('National address certificates')]: ['national address', 'national address certificate', 'national address certificates'],
      [this.documentMatchText('Latest Audited Financial Statements')]: ['latest audited financial statements', 'audited financial statement', 'financial statements'],
      [this.documentMatchText('Tax Card')]: ['tax card']
    };

    return (aliases[required] || []).some((alias) => document.includes(this.documentMatchText(alias)));
  }

  private documentMatchText(value: string) {
    return (value || '')
      .toLowerCase()
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

    return kycCase;
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
          create: {
            tenantId: kycCase.tenantId,
            kycCaseId: id,
            stage: nextStage,
            createdBy: user.id,
            updatedBy: user.id
          }
        });

        await this.recordStatus(tx, kycCase, user, this.stageStatus(stage, 'completed'), `${this.stageLabel(stage)} review submitted`);
        await this.recordStatus(tx, { ...kycCase, status: this.stageStatus(stage, 'completed') }, user, this.stageStatus(nextStage, 'pending'), `${this.stageLabel(nextStage)} review task assigned`);
        await this.audit(tx, user, kycCase.tenantId, 'InternalReviewSubmission', saved.id, { action: 'REVIEW_SUBMITTED', stage, routedTo: nextStage });
        await this.createNotification(
          tx,
          kycCase,
          nextStage === ReviewStage.DMLRO ? NotificationType.DMLRO_TASK_ASSIGNED : NotificationType.MLRO_TASK_ASSIGNED,
          `${this.stageLabel(nextStage)} task assigned`,
          `${kycCase.title} is ready for ${this.stageLabel(nextStage)} review.`
        );

        return tx.kycCase.findUniqueOrThrow({ where: { id }, include: this.caseInclude() });
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (stage === ReviewStage.DMLRO && nextStage === ReviewStage.MLRO) {
        throw new InternalServerErrorException('Unable to resubmit this KYC file to MLRO. The review queue was refreshed; please try again.');
      }
      throw error;
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
        formalComments: this.optionalText(dto.formalComments),
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
        formalComments: this.optionalText(dto.formalComments),
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
        formalComments: this.optionalText(dto.formalComments),
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
        formalComments: this.optionalText(dto.formalComments),
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
    const dmlroDecision = this.enumValue(dto.dmlroDecision, ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_SUPERVISOR'], 'DMLRO decision');
    const mlroDecision = this.enumValue(dto.mlroDecision, ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_DMLRO', 'SEND_TO_SEF'], 'MLRO final decision');
    const sefDecision = this.enumValue(dto.sefDecision, ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT'], 'SEF management decision');
    const mlroFinalRiskClassification = this.enumValue(dto.mlroFinalRiskClassification, ['LOW', 'MEDIUM', 'HIGH'], 'Final risk classification');
    const mlroRiskReasonCategory = this.enumValue(dto.mlroRiskReasonCategory, ['PEP_IDENTIFIED', 'SANCTIONS_FINDING', 'ADVERSE_MEDIA', 'OWNERSHIP_COMPLEXITY', 'COUNTRY_RISK', 'INDUSTRY_RISK', 'SOURCE_OF_FUNDS_CONCERN', 'ENHANCED_MONITORING_REQUIRED', 'PROFESSIONAL_JUDGEMENT', 'OTHER'], 'Risk reason category');

    if (part === 'ALL') {
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
        amlDate: this.dateValue(dto.amlDate),
        dmlroName: this.optionalText(dto.dmlroName),
        dmlroSignatureFileName: this.optionalText(dto.dmlroSignatureFileName),
        dmlroSignatureDataUrl: this.optionalText(dto.dmlroSignatureDataUrl),
        dmlroDate: this.dateValue(dto.dmlroDate),
        dmlroDecision: dmlroDecision as ReviewDecision | null,
        dmlroConditions: this.optionalText(dto.dmlroConditions),
        dmlroReason: this.optionalText(dto.dmlroReason),
        dmlroComments: this.optionalText(dto.dmlroComments),
        mlroName: this.optionalText(dto.mlroName),
        mlroSignatureFileName: this.optionalText(dto.mlroSignatureFileName),
        mlroSignatureDataUrl: this.optionalText(dto.mlroSignatureDataUrl),
        mlroDate: this.dateValue(dto.mlroDate),
        mlroDecision: mlroDecision as ReviewDecision | null,
        mlroFinalRiskClassification: mlroFinalRiskClassification as RiskClassification | null,
        mlroRiskReasonCategory: mlroRiskReasonCategory as RiskOverrideReason | null,
        mlroRiskExplanation: this.optionalText(dto.mlroRiskExplanation),
        mlroConditions: this.optionalText(dto.mlroConditions),
        mlroComments: this.optionalText(dto.mlroComments),
        sefName: this.optionalText(dto.sefName),
        sefSignatureFileName: this.optionalText(dto.sefSignatureFileName),
        sefSignatureDataUrl: this.optionalText(dto.sefSignatureDataUrl),
        sefDate: this.dateValue(dto.sefDate),
        sefDecision: sefDecision as ReviewDecision | null,
        sefConditions: this.optionalText(dto.sefConditions),
        sefComments: this.optionalText(dto.sefComments)
      };
    }

    if (part === 'DMLRO') {
      return {
        dmlroName: this.optionalText(dto.dmlroName),
        dmlroSignatureFileName: this.optionalText(dto.dmlroSignatureFileName),
        dmlroSignatureDataUrl: this.optionalText(dto.dmlroSignatureDataUrl),
        dmlroDate: this.dateValue(dto.dmlroDate),
        dmlroDecision: dmlroDecision as ReviewDecision | null,
        dmlroConditions: this.optionalText(dto.dmlroConditions),
        dmlroReason: this.optionalText(dto.dmlroReason),
        dmlroComments: this.optionalText(dto.dmlroComments)
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
        mlroComments: this.optionalText(dto.mlroComments)
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
        sefComments: this.optionalText(dto.sefComments)
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

  private buildDocx(payload: SerializedKycForm) {
    const template = this.loadDocxTemplate();
    const templateData = this.templateData(payload);
    const doc = new Docxtemplater(new PizZip(template), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => ''
    });

    doc.render(templateData);
    const zip = doc.getZip();
    this.applyDocxImages(zip, this.docxImageReplacements(templateData));
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  private loadDocxTemplate() {
    const templatePaths = [
      join(process.cwd(), 'backend', 'templates', 'kyc-part-1-template.docx'),
      join(process.cwd(), 'templates', 'kyc-part-1-template.docx'),
      join(__dirname, '..', '..', 'templates', 'kyc-part-1-template.docx'),
      join(__dirname, '..', '..', '..', 'backend', 'templates', 'kyc-part-1-template.docx')
    ];

    for (const templatePath of templatePaths) {
      if (existsSync(templatePath)) {
        return readFileSync(templatePath);
      }
    }

    return this.createDocxTemplate();
  }

  private async buildPdf(payload: SerializedKycForm) {
    const docx = this.buildDocx(payload);
    return this.convertDocxToPdf(docx);
  }

  private async convertDocxToPdf(docx: Buffer) {
    const workDir = mkdtempSync(join(tmpdir(), 'newoon-kyc-pdf-'));
    const docxPath = join(workDir, 'kyc-part-1.docx');
    const pdfPath = join(workDir, 'kyc-part-1.pdf');

    try {
      writeFileSync(docxPath, docx);
      const command = await this.resolveLibreOfficeCommand();

      await execFileAsync(command, ['--headless', '--convert-to', 'pdf', '--outdir', workDir, docxPath], {
        timeout: 60000,
        windowsHide: true
      });

      if (!existsSync(pdfPath)) {
        throw new BadRequestException('Unable to generate PDF from DOCX template.');
      }

      return readFileSync(pdfPath);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  private async resolveLibreOfficeCommand() {
    const candidates = [
      process.env.LIBREOFFICE_PATH,
      'soffice',
      'libreoffice',
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      try {
        await execFileAsync(candidate, ['--version'], { timeout: 10000, windowsHide: true });
        return candidate;
      } catch {
        // Try the next configured command.
      }
    }

    throw new BadRequestException('PDF conversion requires LibreOffice. Install LibreOffice on the server or set LIBREOFFICE_PATH to the soffice executable.');
  }

  private templateData(payload: SerializedKycForm) {
    const sectionA = payload.sectionA as Record<string, unknown>;
    const sectionB = payload.sectionB as Record<string, unknown> & { shareholders?: RowPayload[]; ubos?: RowPayload[] };
    const sectionC = payload.sectionC as Record<string, unknown> & { managers?: RowPayload[] };
    const sectionD = payload.sectionD as Record<string, unknown>;
    const sectionE = payload.sectionE as Record<string, unknown>;
    const sectionF = payload.sectionF as Record<string, unknown> & { documents?: RowPayload[]; additionalDocuments?: RowPayload[] };
    const sectionG = payload.sectionG as Record<string, unknown>;
    const sectionH = (payload.sectionH || {}) as Record<string, unknown>;
    const ownershipRows = this.asArray<RowPayload>(sectionB.shareholders);
    const effectiveUbos = sectionB.ubos?.length ? sectionB.ubos : ownershipRows.filter((row) => Boolean(row.isUbo));
    const shareholders = this.templateRows(ownershipRows, (row, index) => ({
      shareholderNo: String(index + 1),
      shareholderType: this.text(row.shareholderType || 'Individual'),
      shareholderFullName: this.text(row.fullName),
      shareholderNationality: this.optionText(row.nationality, row.nationalityOther),
      shareholderDateOfBirth: this.text(row.dateOfBirth),
      shareholderIdentityNumber: this.text(row.identityNumber),
      shareholderOwnershipPercentage: this.text(row.ownershipPercentage),
      shareholderResidenceAddress: this.text(row.residenceAddress),
      shareholderLinkedClient: this.text(row.linkedClientName),
      shareholderIsUbo: row.isUbo ? 'Yes' : 'No'
    }));
    const ubos = this.templateRows(effectiveUbos, (row, index) => ({
      uboNo: String(index + 1),
      uboFullName: this.text(row.fullName),
      uboNationality: this.optionText(row.nationality, row.nationalityOther),
      uboDateOfBirth: this.text(row.dateOfBirth),
      uboIdentityNumber: this.text(row.identityNumber),
      uboOwnershipPercentage: this.text(row.ownershipPercentage),
      uboResidenceAddress: this.text(row.residenceAddress)
    }));
    const managers = this.templateRows(sectionC.managers, (row, index) => ({
      managerNo: String(index + 1),
      managerFullName: this.text(row.fullName),
      managerEntityName: this.text(row.entityName),
      managerNationality: this.optionText(row.nationality, row.nationalityOther) || this.managerNationalityFallback(row),
      managerAddress: this.text(row.address) || this.managerAddressFallback(row),
      managerNationalityAndAddress: this.text(row.nationalityAndAddress),
      managerDateOfBirth: this.text(row.dateOfBirth),
      managerIdentityNumber: this.text(row.identityNumber),
      managerPosition: this.optionText(row.position, row.positionOther),
      managerAuthorizedSignatory: row.isAuthorizedSignatory ? 'Yes' : 'No'
    }));
    const totalUboPercentage = effectiveUbos.reduce((sum, row) => sum + this.numberValue(row.ownershipPercentage), 0);

    const ownershipRootName = this.text(sectionA.legalName) || 'Client company';
    const ownershipStructureText = this.ownershipStructureText(ownershipRootName, ownershipRows);

    return {
      date: this.text(sectionA.date),
      reference: this.text(sectionA.reference),
      legalName: this.text(sectionA.legalName),
      commercialRegistrationNo: this.text(sectionA.commercialRegistrationNo),
      taxIdentificationNo: this.text(sectionA.taxIdentificationNo),
      dateOfIncorporation: this.text(sectionA.dateOfIncorporation),
      countryOfIncorporation: this.optionText(sectionA.countryOfIncorporation, sectionA.countryOfIncorporationOther),
      legalForm: this.optionText(sectionA.legalForm, sectionA.legalFormOther),
      registeredOfficeAddress: this.text(sectionA.registeredOfficeAddress),
      telephone: this.text(sectionA.telephone),
      email: this.text(sectionA.email),
      website: this.text(sectionA.website),
      businessNature: this.optionText(sectionA.businessNature, sectionA.businessNatureOther),
      licenseActivities: this.text(sectionA.licenseActivities),
      relatedIndustry: this.optionText(sectionA.relatedIndustry, sectionA.relatedIndustryOther),
      prospectiveService: this.listText(sectionA.prospectiveService, sectionA.prospectiveServiceOther),
      totalOwnershipPercentage: this.text(sectionB.totalOwnershipPercentage),
      uboDifferentFromShareholders: this.text(sectionB.uboDifferentFromShareholders),
      uboDifferentYes: sectionB.uboDifferentFromShareholders === 'Yes' ? '☒' : '☐',
      uboDifferentNo: sectionB.uboDifferentFromShareholders === 'Yes' ? '☐' : '☒',
      uboGroupStructureNotes: this.text(sectionB.uboGroupStructureNotes),
      shareholders,
      ubos,
      managers,
      totalUboPercentage: this.text(totalUboPercentage),
      ownershipStructureText: this.imageToken('ownershipStructure'),
      shareholdersText: this.rowsText(ownershipRows, ['shareholderType', 'fullName', 'nationality', 'identityNumber', 'ownershipPercentage']),
      ubosText: this.rowsText(effectiveUbos, ['fullName', 'nationality', 'identityNumber', 'ownershipPercentage']),
      managersText: this.rowsText(sectionC.managers, ['fullName', 'entityName', 'position', 'isAuthorizedSignatory']),
      pepQuestion: this.checkboxMark(this.text(sectionD.pepQuestion || 'No') === 'Yes'),
      pepNo: this.checkboxMark(this.text(sectionD.pepQuestion || 'No') === 'No'),
      pepDetails: this.text(sectionD.pepDetails),
      pepDocumentFileNames: this.listText(sectionD.pepDocumentFileNames),
      pepSupportingDocuments: this.listText(sectionD.pepDocumentFileNames),
      sanctionQuestion: this.checkboxMark(this.text(sectionD.sanctionQuestion || 'No') === 'Yes'),
      sanctionNo: this.checkboxMark(this.text(sectionD.sanctionQuestion || 'No') === 'No'),
      sanctionDetails: this.text(sectionD.sanctionDetails),
      sanctionDocumentFileNames: this.listText(sectionD.sanctionDocumentFileNames),
      sanctionSupportingDocuments: this.listText(sectionD.sanctionDocumentFileNames),
      dualCitizenshipQuestion: this.checkboxMark(this.text(sectionD.dualCitizenshipQuestion || 'No') === 'Yes'),
      dualCitizenshipNo: this.checkboxMark(this.text(sectionD.dualCitizenshipQuestion || 'No') === 'No'),
      dualCitizenshipDetails: this.text(sectionD.dualCitizenshipDetails),
      dualCitizenshipPassportFileName: this.listText(sectionD.dualCitizenshipPassportFileNames) || this.text(sectionD.dualCitizenshipPassportFileName),
      dualCitizenshipPassportFileNames: this.listText(sectionD.dualCitizenshipPassportFileNames) || this.text(sectionD.dualCitizenshipPassportFileName),
      communicationFullName: this.text(sectionE.fullName),
      communicationPosition: this.optionText(sectionE.position, sectionE.positionOther),
      communicationNationality: this.optionText(sectionE.nationality, sectionE.nationalityOther),
      communicationIdentityNumber: this.text(sectionE.identityNumber),
      communicationMobile: this.text(sectionE.mobileNumber),
      communicationEmail: this.text(sectionE.email),
      requiredDocumentsText: this.rowsText(sectionF.documents, ['documentType', 'isProvided', 'fileName']),
      additionalDocumentsText: this.rowsText(sectionF.additionalDocuments, ['fileName']) || '-',
      uploadedFilesNote: this.text(sectionF.uploadedFilesNote) || '-',
      docCommercialRegistration: this.requiredDocumentMark(sectionF.documents, 'Commercial Registration'),
      docEntityCard: this.requiredDocumentMark(sectionF.documents, 'Entity Card'),
      docCertificateOfIncorporation: this.requiredDocumentMark(sectionF.documents, 'Certificate of Incorporation'),
      docArticlesOfAssociation: this.requiredDocumentMark(sectionF.documents, 'Articles of Association'),
      docIdentityCopies: this.requiredDocumentMark(sectionF.documents, 'QID / Passport copies'),
      docLegalEntityShareholderCr: this.requiredDocumentMark(sectionF.documents, 'CR of legal entity shareholders'),
      docNationalAddressCertificates: this.requiredDocumentMark(sectionF.documents, 'National address certificates'),
      docAuditedFinancialStatements: this.requiredDocumentMark(sectionF.documents, 'Latest Audited Financial Statements'),
      docTaxCard: this.requiredDocumentMark(sectionF.documents, 'Tax Card'),
      declarationFullName: this.text(sectionG.fullName),
      declarationPosition: this.optionText(sectionG.position, sectionG.positionOther),
      declarationDate: this.text(sectionG.date),
      signatureFileName: this.signatureDisplay('declarationSignature', sectionG.signatureFileName, sectionG.signatureDataUrl),
      stampFileName: this.signatureDisplay('companyStamp', sectionG.stampFileName, sectionG.stampDataUrl),
      amlAccuracyChecked: this.text(sectionH.amlAccuracyChecked),
      amlAccuracyYes: sectionH.amlAccuracyChecked ? '☒' : '☐',
      amlAccuracyNo: sectionH.amlAccuracyChecked ? '☐' : '☒',
      amlClarificationFindings: this.text(sectionH.amlClarificationFindings),
      riskClassification: this.text(sectionH.riskClassification),
      riskHigh: sectionH.riskClassification === 'HIGH' ? '☒' : '☐',
      riskMedium: sectionH.riskClassification === 'MEDIUM' ? '☒' : '☐',
      riskLow: sectionH.riskClassification === 'LOW' ? '☒' : '☐',
      dueDiligenceType: this.text(sectionH.dueDiligenceType),
      dueSimplified: sectionH.dueDiligenceType === 'SIMPLIFIED' ? '☒' : '☐',
      dueRegular: sectionH.dueDiligenceType === 'REGULAR' ? '☒' : '☐',
      dueEnhanced: sectionH.dueDiligenceType === 'ENHANCED' ? '☒' : '☐',
      amlName: this.text(sectionH.amlName),
      amlSignatureFileName: this.signatureDisplay('amlSignature', sectionH.amlSignatureFileName, sectionH.amlSignatureDataUrl),
      amlDate: this.text(sectionH.amlDate),
      amlComments: this.reviewConclusionText([
        ['Accuracy checked', sectionH.amlAccuracyChecked ? 'Yes' : 'No'],
        ['Clarification / findings', this.text(sectionH.amlClarificationFindings)],
        ['Risk classification', this.text(sectionH.riskClassification)],
        ['Due diligence type', this.text(sectionH.dueDiligenceType)]
      ]),
      dmlroName: this.text(sectionH.dmlroName),
      dmlroSignatureFileName: this.signatureDisplay('dmlroSignature', sectionH.dmlroSignatureFileName, sectionH.dmlroSignatureDataUrl),
      dmlroDate: this.text(sectionH.dmlroDate),
      dmlroDecision: this.reviewDecisionText(sectionH.dmlroDecision),
      dmlroConditions: this.text(sectionH.dmlroConditions),
      dmlroReason: this.text(sectionH.dmlroReason),
      dmlroComments: this.reviewConclusionText([
        ['Decision', this.reviewDecisionText(sectionH.dmlroDecision)],
        ['Conditions', this.text(sectionH.dmlroConditions)],
        ['Reason / additional information', this.text(sectionH.dmlroReason)],
        ['Comments', this.text(sectionH.dmlroComments)]
      ]),
      mlroName: this.text(sectionH.mlroName),
      mlroSignatureFileName: this.signatureDisplay('mlroSignature', sectionH.mlroSignatureFileName, sectionH.mlroSignatureDataUrl),
      mlroDate: this.text(sectionH.mlroDate),
      mlroDecision: this.reviewDecisionText(sectionH.mlroDecision),
      mlroFinalRiskClassification: this.text(sectionH.mlroFinalRiskClassification || sectionH.riskClassification),
      mlroRiskReasonCategory: this.labelText(sectionH.mlroRiskReasonCategory),
      mlroRiskExplanation: this.text(sectionH.mlroRiskExplanation),
      mlroConditions: this.text(sectionH.mlroConditions),
      mlroComments: this.reviewConclusionText([
        ['Final decision', this.reviewDecisionText(sectionH.mlroDecision)],
        ['Final risk classification', this.text(sectionH.mlroFinalRiskClassification || sectionH.riskClassification)],
        ['Risk reason category', this.labelText(sectionH.mlroRiskReasonCategory)],
        ['Risk explanation', this.text(sectionH.mlroRiskExplanation)],
        ['Conditions', this.text(sectionH.mlroConditions)],
        ['Comments', this.text(sectionH.mlroComments)]
      ]),
      sefName: this.text(sectionH.sefName),
      sefSignatureFileName: this.signatureDisplay('sefSignature', sectionH.sefSignatureFileName, sectionH.sefSignatureDataUrl),
      sefDate: this.text(sectionH.sefDate),
      sefDecision: this.reviewDecisionText(sectionH.sefDecision),
      sefConditions: this.text(sectionH.sefConditions),
      sefComments: this.reviewConclusionText([
        ['Management decision', this.reviewDecisionText(sectionH.sefDecision)],
        ['Conditions / reason', this.text(sectionH.sefConditions)],
        ['Comments', this.text(sectionH.sefComments)]
      ]),
      _docxImages: {
        ownershipStructure: this.ownershipStructureImageDataUrl(ownershipRootName, ownershipRows),
        declarationSignature: this.text(sectionG.signatureDataUrl),
        companyStamp: this.text(sectionG.stampDataUrl),
        amlSignature: this.text(sectionH.amlSignatureDataUrl),
        dmlroSignature: this.text(sectionH.dmlroSignatureDataUrl),
        mlroSignature: this.text(sectionH.mlroSignatureDataUrl),
        sefSignature: this.text(sectionH.sefSignatureDataUrl)
      }
    };
  }

  private templateRows<T extends Record<string, string>>(rows: RowPayload[] | undefined, mapper: (row: RowPayload, index: number) => T) {
    return rows?.length ? rows.map(mapper) : [];
  }

  private signatureDisplay(key: string, fileName: unknown, dataUrl: unknown) {
    return this.parseImageDataUrl(this.text(dataUrl)) ? this.imageToken(key) : this.text(fileName);
  }

  private imageToken(key: string) {
    return `__KYC_IMAGE_${key}__`;
  }

  private docxImageReplacements(templateData: Record<string, unknown>) {
    const images = (templateData._docxImages || {}) as Record<string, unknown>;
    const replacements: Array<{ key: string; token: string; image: { mimeType: string; extension: string; buffer: Buffer }; size?: { cx: number; cy: number } }> = [];

    for (const [key, value] of Object.entries(images)) {
      const image = this.parseImageDataUrl(this.text(value));
      if (image) {
        replacements.push({ key, token: this.imageToken(key), image, size: this.docxImageSize(key) });
      }
    }

    return replacements;
  }

  private applyDocxImages(
    zip: PizZip,
    replacements: Array<{ key: string; token: string; image: { mimeType: string; extension: string; buffer: Buffer }; size?: { cx: number; cy: number } }>
  ) {
    if (!replacements.length) return;

    const documentFile = zip.file('word/document.xml');
    if (!documentFile) return;

    let documentXml = documentFile.asText();
    let relsXml =
      zip.file('word/_rels/document.xml.rels')?.asText() ||
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    let contentTypesXml = zip.file('[Content_Types].xml')?.asText() || '';

    replacements.forEach((replacement, index) => {
      const relId = `rIdKycSignature${Date.now()}${index}`;
      const fileName = `kyc-signature-${replacement.key}.${replacement.image.extension}`;
      zip.file(`word/media/${fileName}`, replacement.image.buffer);

      relsXml = relsXml.replace(
        '</Relationships>',
        `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fileName}"/></Relationships>`
      );

      contentTypesXml = this.ensureContentType(contentTypesXml, replacement.image.extension, replacement.image.mimeType);
      documentXml = documentXml.replace(
        new RegExp(`<w:t[^>]*>${this.escapeRegExp(replacement.token)}</w:t>`, 'g'),
        this.docxImageDrawing(relId, replacement.size)
      );
    });

    zip.file('word/document.xml', documentXml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    zip.file('[Content_Types].xml', contentTypesXml);
  }

  private parseImageDataUrl(value: string) {
    const match = /^data:(image\/(?:png|jpeg|jpg|gif|svg\+xml));base64,(.+)$/i.exec(value);
    if (!match) return null;
    const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/svg+xml' ? 'svg' : mimeType.split('/')[1];
    return {
      mimeType,
      extension,
      buffer: Buffer.from(match[2], 'base64')
    };
  }

  private ensureContentType(contentTypesXml: string, extension: string, mimeType: string) {
    if (contentTypesXml.includes(`Extension="${extension}"`)) return contentTypesXml;
    return contentTypesXml.replace('</Types>', `<Default Extension="${extension}" ContentType="${mimeType}"/></Types>`);
  }

  private docxImageSize(key: string) {
    if (key === 'ownershipStructure') return { cx: 6500000, cy: 3800000 };
    return { cx: 1900000, cy: 650000 };
  }

  private docxImageDrawing(relId: string, size?: { cx: number; cy: number }) {
    const cx = size?.cx || 1900000;
    const cy = size?.cy || 650000;
    return `<w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Signature"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Signature"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private yesNoMark(value: unknown, expected: 'Yes' | 'No') {
    return this.text(value || 'No') === expected ? '☒' : '☐';
  }

  private documentMark(rows: RowPayload[] | undefined, label: string) {
    const row = rows?.find((item) => this.text(item.documentType).toLowerCase().includes(label.toLowerCase()));
    return row?.isProvided ? '☒' : '☐';
  }

  private checkboxMark(isChecked: boolean) {
    return isChecked ? '☒' : '☐';
  }

  private requiredDocumentMark(rows: RowPayload[] | undefined, label: string) {
    const row = rows?.find((item) => this.text(item.documentType).toLowerCase().includes(label.toLowerCase()));
    return this.checkboxMark(Boolean(row?.isProvided));
  }

  private rowsText(rows: RowPayload[] | undefined, fields: string[]) {
    if (!rows?.length) return '';
    return rows
      .map((row, index) => `${index + 1}. ${fields.map((field) => this.optionText(row[field], row[`${field}Other`])).filter(Boolean).join(' | ')}`)
      .join('\n');
  }

  private ownershipStructureText(rootName: string, rows: RowPayload[]) {
    if (!rows.length) return 'No ownership structure generated';

    const childrenByParent = rows.reduce<Record<string, RowPayload[]>>((groups, row, index) => {
      const rowId = this.text(row.id) || `ownership-${index + 1}`;
      const parentKey = this.text(row.parentRowId) || 'ROOT';
      groups[parentKey] = [...(groups[parentKey] || []), { ...row, id: rowId }];
      return groups;
    }, {});

    const lines = [rootName || 'Client company'];
    const render = (parentId: string, depth: number) => {
      for (const row of childrenByParent[parentId] || []) {
        const marker = row.isUbo ? ' [UBO]' : '';
        const linked = this.text(row.linkedClientName) ? ` | Linked client: ${this.text(row.linkedClientName)}` : '';
        lines.push(
          `${'  '.repeat(depth)}- ${this.text(row.fullName) || 'Unnamed owner'} (${this.text(row.shareholderType || 'Individual')}, ${this.text(row.ownershipPercentage) || '0'}%)${marker}${linked}`
        );
        render(this.text(row.id), depth + 1);
      }
    };

    render('ROOT', 1);
    return lines.join('\n');
  }

  private ownershipStructureImageDataUrl(rootName: string, rows: RowPayload[]) {
    const nodes = this.ownershipDiagramNodes(rootName || 'Client company', rows);
    const palette = ['#dbeafe', '#dcfce7', '#fef3c7', '#f3e8ff', '#fee2e2', '#cffafe'];
    const labelPalette = ['#0f172a', '#bfdbfe', '#dcfce7', '#fef3c7', '#f3e8ff', '#fee2e2', '#cffafe'];
    const framePadding = 18;
    const labelWidth = 110;
    const diagramLeft = framePadding + labelWidth + 50;
    const diagramRight = 38;
    const paddingTop = 74;
    const paddingBottom = 36;
    const levelGap = 116;
    const nodeWidth = 220;
    const nodeHeight = 64;
    const width = Math.max(1120, diagramLeft + diagramRight + nodes.leafCount * 245);
    const height = Math.max(360, paddingTop + paddingBottom + (nodes.maxDepth + 1) * levelGap + nodeHeight);
    const contentWidth = width - diagramLeft - diagramRight;
    const centerY = (depth: number) => paddingTop + depth * levelGap;
    const centerX = (x: number) => diagramLeft + x * contentWidth;

    const image = this.createPngCanvas(width, height, '#ffffff');
    this.drawRect(image, 8, 8, width - 16, height - 16, '#ffffff', '#111827');
    this.drawRect(image, 14, 14, width - 28, 1, '#111827', '#111827');
    this.drawText(image, `${rootName || 'CLIENT'} - OWNERSHIP STRUCTURE`, Math.max(22, Math.round(width / 2) - 170), 32, '#0f172a', 2);

    for (let depth = 0; depth <= nodes.maxDepth; depth++) {
      const y = Math.round(centerY(depth) + 10);
      const isRootLayer = depth === 0;
      this.drawRect(image, framePadding + 10, y, labelWidth, 42, labelPalette[depth] || '#e2e8f0', '#64748b');
      this.drawText(image, `LAYER ${depth}`, framePadding + 30, y + 14, isRootLayer ? '#ffffff' : '#0f172a', 1);
    }

    for (const item of nodes.items.filter((item) => item.parentId)) {
      const parent = nodes.items.find((candidate) => candidate.id === item.parentId);
      if (!parent) continue;
      const x1 = Math.round(centerX(parent.x));
      const y1 = Math.round(centerY(parent.depth) + nodeHeight);
      const x2 = Math.round(centerX(item.x));
      const y2 = Math.round(centerY(item.depth));
      const elbowY = Math.round((y1 + y2) / 2);
      this.drawLine(image, x1, y1, x1, elbowY, '#111827');
      this.drawLine(image, x1, elbowY, x2, elbowY, '#111827');
      this.drawLine(image, x2, elbowY, x2, y2, '#111827');
      this.drawLine(image, x2, y2, x2 - 5, y2 - 9, '#111827');
      this.drawLine(image, x2, y2, x2 + 5, y2 - 9, '#111827');
      if (item.ownership) this.drawText(image, `${item.ownership}%`, x2 + 8, Math.max(y2 - 22, elbowY + 4), '#0f172a', 1);
    }

    for (const item of nodes.items) {
      const x = Math.round(centerX(item.x) - nodeWidth / 2);
      const y = Math.round(centerY(item.depth));
      const isRoot = item.id === 'ROOT';
      const fill = isRoot ? '#0f172a' : item.isUbo ? '#e0f2fe' : palette[(item.depth - 1) % palette.length] || '#f8fafc';
      const stroke = isRoot ? '#0f172a' : item.isUbo ? '#0891b2' : '#64748b';
      this.drawRect(image, x + 4, y + 5, nodeWidth, nodeHeight, '#e2e8f0', '#e2e8f0');
      this.drawRect(image, x, y, nodeWidth, nodeHeight, fill, stroke);
      const name = this.textLines(item.name || 'Unnamed owner', 24);
      const primaryText = isRoot ? '#ffffff' : '#0f172a';
      const secondaryText = isRoot ? '#ccfbf1' : '#475569';
      this.drawText(image, name[0], x + 12, y + 11, primaryText, 1);
      if (name[1]) this.drawText(image, name[1], x + 12, y + 23, primaryText, 1);
      this.drawText(image, item.type, x + 12, y + 39, secondaryText, 1);
      if (item.detail) this.drawText(image, this.textLines(item.detail, 24)[0], x + 12, y + 52, secondaryText, 1);
      if (item.isUbo) {
        this.drawRect(image, x + nodeWidth - 52, y + nodeHeight - 18, 42, 13, '#ccfbf1', '#67e8f9');
        this.drawText(image, 'UBO', x + nodeWidth - 46, y + nodeHeight - 16, '#155e75', 1);
      }
    }

    return `data:image/png;base64,${this.encodePng(image).toString('base64')}`;
  }

  private ownershipDiagramNodes(rootName: string, rows: RowPayload[]) {
    type DiagramNode = {
      id: string;
      parentId: string;
      name: string;
      type: string;
      ownership: string;
      detail: string;
      isUbo: boolean;
      depth: number;
      x: number;
    };

    const normalizedRows: RowPayload[] = rows.map((row, index) => ({ ...row, id: this.text(row.id) || `ownership-${index + 1}` }));
    const childrenByParent = normalizedRows.reduce<Record<string, RowPayload[]>>((groups, row) => {
      const parentId = this.text(row.parentRowId) || 'ROOT';
      groups[parentId] = [...(groups[parentId] || []), row];
      return groups;
    }, {});

    const items: DiagramNode[] = [
      { id: 'ROOT', parentId: '', name: rootName, type: 'Client company', ownership: '', detail: '(Layer 0)', isUbo: false, depth: 0, x: 0.5 }
    ];
    let leafIndex = 0;
    let maxDepth = 0;

    const render = (parentId: string, depth: number): number => {
      const children = childrenByParent[parentId] || [];
      if (!children.length) return leafIndex++;
      const childXs = children.map((row) => {
        const rowId = this.text(row.id);
        const childX = render(rowId, depth + 1);
        items.push({
          id: rowId,
          parentId,
          name: this.text(row.fullName) || 'Unnamed owner',
          type: this.text(row.shareholderType || 'Individual'),
          ownership: this.text(row.ownershipPercentage || '0'),
          detail: this.optionText(row.nationality, row.nationalityOther) || this.text(row.residenceAddress),
          isUbo: Boolean(row.isUbo),
          depth,
          x: childX
        });
        maxDepth = Math.max(maxDepth, depth);
        return childX;
      });
      return childXs.reduce((sum, value) => sum + value, 0) / childXs.length;
    };

    const rootX = render('ROOT', 1);
    const leafCount = Math.max(1, leafIndex);
    items.forEach((item) => {
      item.x = item.id === 'ROOT' ? rootX : item.x;
      item.x = (item.x + 0.5) / leafCount;
    });

    return { items, leafCount, maxDepth };
  }

  private textLines(value: string, maxLength: number) {
    const words = value.split(/\s+/).filter(Boolean);
    const lines = ['', ''];
    for (const word of words) {
      const target = lines[0].length + word.length + 1 <= maxLength ? 0 : 1;
      if (lines[target].length + word.length + 1 <= maxLength) {
        lines[target] = `${lines[target]} ${word}`.trim();
      }
    }
    return [lines[0] || value.slice(0, maxLength), lines[1]];
  }

  private createPngCanvas(width: number, height: number, background: string) {
    const data = Buffer.alloc(width * height * 4);
    const color = this.hexColor(background);
    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
      data[offset + 3] = 255;
    }
    return { width, height, data };
  }

  private drawRect(image: { width: number; height: number; data: Buffer }, x: number, y: number, width: number, height: number, fill: string, stroke: string) {
    const fillColor = this.hexColor(fill);
    const strokeColor = this.hexColor(stroke);
    for (let py = y; py < y + height; py++) {
      for (let px = x; px < x + width; px++) {
        const isBorder = py === y || py === y + height - 1 || px === x || px === x + width - 1;
        this.setPixel(image, px, py, isBorder ? strokeColor : fillColor);
      }
    }
  }

  private drawLine(image: { width: number; height: number; data: Buffer }, x1: number, y1: number, x2: number, y2: number, colorValue: string) {
    const color = this.hexColor(colorValue);
    let dx = Math.abs(x2 - x1);
    let dy = -Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let error = dx + dy;
    let x = x1;
    let y = y1;

    while (true) {
      this.setPixel(image, x, y, color);
      this.setPixel(image, x + 1, y, color);
      if (x === x2 && y === y2) break;
      const e2 = 2 * error;
      if (e2 >= dy) {
        error += dy;
        x += sx;
      }
      if (e2 <= dx) {
        error += dx;
        y += sy;
      }
      dx = Math.abs(x2 - x1);
      dy = -Math.abs(y2 - y1);
    }
  }

  private drawText(image: { width: number; height: number; data: Buffer }, value: string, x: number, y: number, colorValue: string, scale: number) {
    const color = this.hexColor(colorValue);
    const text = value.toUpperCase().replace(/[^\x20-\x7E]/g, '');
    let cursorX = x;
    for (const character of text) {
      const glyph = this.glyph(character);
      for (let row = 0; row < glyph.length; row++) {
        for (let column = 0; column < glyph[row].length; column++) {
          if (glyph[row][column] !== '1') continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              this.setPixel(image, cursorX + column * scale + sx, y + row * scale + sy, color);
            }
          }
        }
      }
      cursorX += 6 * scale;
    }
  }

  private glyph(character: string) {
    return TINY_FONT[character] || TINY_FONT['?'];
  }

  private setPixel(image: { width: number; height: number; data: Buffer }, x: number, y: number, color: { r: number; g: number; b: number }) {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
    const offset = (Math.floor(y) * image.width + Math.floor(x)) * 4;
    image.data[offset] = color.r;
    image.data[offset + 1] = color.g;
    image.data[offset + 2] = color.b;
    image.data[offset + 3] = 255;
  }

  private hexColor(value: string) {
    const normalized = value.replace('#', '');
    const number = Number.parseInt(normalized, 16);
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255
    };
  }

  private encodePng(image: { width: number; height: number; data: Buffer }) {
    const raw = Buffer.alloc((image.width * 4 + 1) * image.height);
    for (let y = 0; y < image.height; y++) {
      raw[y * (image.width * 4 + 1)] = 0;
      image.data.copy(raw, y * (image.width * 4 + 1) + 1, y * image.width * 4, (y + 1) * image.width * 4);
    }

    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      this.pngChunk('IHDR', Buffer.concat([this.uint32(image.width), this.uint32(image.height), Buffer.from([8, 6, 0, 0, 0])])),
      this.pngChunk('IDAT', deflateSync(raw)),
      this.pngChunk('IEND', Buffer.alloc(0))
    ]);
  }

  private pngChunk(type: string, data: Buffer) {
    const typeBuffer = Buffer.from(type);
    return Buffer.concat([this.uint32(data.length), typeBuffer, data, this.uint32(this.crc32(Buffer.concat([typeBuffer, data])))]);
  }

  private uint32(value: number) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(value >>> 0, 0);
    return buffer;
  }

  private crc32(buffer: Buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let index = 0; index < 8; index++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
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

  private labelText(value: unknown) {
    return this.text(value)
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private reviewDecisionText(value: unknown) {
    const decision = this.text(value);
    const labels: Record<string, string> = {
      APPROVE: 'Approve',
      APPROVE_WITH_CONDITIONS: 'Approve with conditions',
      REJECT: 'Reject',
      REQUEST_ADDITIONAL_INFORMATION: 'Request additional information',
      RETURN_TO_SUPERVISOR: 'Return to AML Supervisor',
      RETURN_TO_DMLRO: 'Return to DMLRO',
      SEND_TO_SEF: 'Send to SEF'
    };

    return labels[decision] || this.labelText(decision);
  }

  private reviewConclusionText(rows: Array<[string, string]>) {
    const text = rows
      .filter(([, value]) => value && value !== '-')
      .map(([label, value]) => `${label}: ${value}`)
      .join('\n');

    return text || '-';
  }

  private listText(value: unknown, otherValue?: unknown) {
    if (Array.isArray(value)) {
      return value.map((item) => this.optionText(item, otherValue)).filter(Boolean).join(', ');
    }

    return this.optionText(value, otherValue);
  }

  private managerNationalityFallback(row: RowPayload) {
    const combined = this.text(row.nationalityAndAddress);
    if (!combined.includes('|')) return combined;
    return combined.split('|')[0]?.trim() || '';
  }

  private managerAddressFallback(row: RowPayload) {
    const combined = this.text(row.nationalityAndAddress);
    if (!combined.includes('|')) return '';
    return combined.split('|').slice(1).join('|').trim();
  }

  private documentCompanyName(payload: SerializedKycForm) {
    const sectionA = payload.sectionA as Record<string, unknown>;
    const rawName = this.text(sectionA.legalName).trim() || `KYC Case ${payload.kycCaseId}`;
    return rawName
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  private createDocxTemplate() {
    const content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${this.docxParagraph('NEWOON KYC FORM')}
${this.docxParagraph('A. General Company Information')}
${this.docxParagraph('Date: {date} | Reference: {reference}')}
${this.docxParagraph('Legal Name of Company: {legalName}')}
${this.docxParagraph('Commercial Registration No.: {commercialRegistrationNo} | Tax Identification No.: {taxIdentificationNo}')}
${this.docxParagraph('Date/Country of Incorporation: {dateOfIncorporation} / {countryOfIncorporation} | Legal Form: {legalForm}')}
${this.docxParagraph('Registered Office Address: {registeredOfficeAddress}')}
${this.docxParagraph('Telephone: {telephone} | Email: {email} | Website: {website}')}
${this.docxParagraph('Business Nature: {businessNature}')}
${this.docxParagraph('License Activities: {licenseActivities} | Related Industry: {relatedIndustry}')}
${this.docxParagraph('Nature of prospective service from Newoon: {prospectiveService}')}
${this.docxParagraph('B. Ownership / Shareholders')}
${this.docxParagraph('Shareholders:\\n{shareholdersText}')}
${this.docxParagraph('Total Ownership: {totalOwnershipPercentage}% | UBO different: {uboDifferentFromShareholders}')}
${this.docxParagraph('UBO Group Structure Notes: {uboGroupStructureNotes}')}
${this.docxParagraph('Ownership Structure:\\n{ownershipStructureText}')}
${this.docxParagraph('UBOs:\\n{ubosText}')}
${this.docxParagraph('C. Manager / Authorized Signatory / Directors / Secretary')}
${this.docxParagraph('{managersText}')}
${this.docxParagraph('D. Compliance and Risk Information')}
${this.docxParagraph('Any PEP exposure?: {pepQuestion} | Details: {pepDetails} | Supporting documents: {pepDocumentFileNames}')}
${this.docxParagraph('Any sanction exposure?: {sanctionQuestion} | Details: {sanctionDetails} | Supporting documents: {sanctionDocumentFileNames}')}
${this.docxParagraph('Any dual citizenship?: {dualCitizenshipQuestion} | Details: {dualCitizenshipDetails} | Passport copies: {dualCitizenshipPassportFileName}')}
${this.docxParagraph('E. Key Communication Person')}
${this.docxTable([
  ['Full name', '{communicationFullName}', 'Position / Job title', '{communicationPosition}'],
  ['Nationality', '{communicationNationality}', 'QID / Passport Number', '{communicationIdentityNumber}'],
  ['Mobile Number', '{communicationMobile}', 'Email', '{communicationEmail}']
])}
${this.docxParagraph('F. Required Documents Checklist')}
${this.docxParagraph('{requiredDocumentsText}')}
${this.docxParagraph('Additional Documents')}
${this.docxParagraph('{additionalDocumentsText}')}
${this.docxParagraph('Additional notes for KYC preparation documents: {uploadedFilesNote}')}
${this.docxParagraph('G. Client Declaration')}
${this.docxParagraph('{declarationFullName} | {declarationPosition} | {declarationDate} | Signature: {signatureFileName} | Stamp: {stampFileName}')}
${this.docxParagraph('H. Internal Use Only')}
${this.docxParagraph('Accuracy checked: {amlAccuracyChecked} | Findings: {amlClarificationFindings}')}
${this.docxParagraph('Risk: {riskClassification} | Due diligence: {dueDiligenceType} | AML Supervisor Name: {amlName} | AML Supervisor signature: {amlSignatureFileName} | AML Supervisor date: {amlDate}')}
${this.docxParagraph('DMLRO: {dmlroName} | Signature: {dmlroSignatureFileName} | Date: {dmlroDate} | Decision: {dmlroDecision} | Conditions: {dmlroConditions} | Reason: {dmlroReason} | Comments: {dmlroComments}')}
${this.docxParagraph('MLRO: {mlroName} | Signature: {mlroSignatureFileName} | Date: {mlroDate} | Final decision: {mlroDecision} | Final risk: {mlroFinalRiskClassification} | Risk reason: {mlroRiskReasonCategory} | Risk explanation: {mlroRiskExplanation} | Conditions: {mlroConditions} | Comments: {mlroComments}')}
${this.docxParagraph('Newoon Corporate Services - Footer service line')}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
</w:body></w:document>`;

    const zip = new PizZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.folder('_rels')?.file('.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.folder('word')?.file('document.xml', content);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  private docxParagraph(text: string) {
    return `<w:p><w:r><w:t xml:space="preserve">${this.escapeXml(text)}</w:t></w:r></w:p>`;
  }

  private docxTable(rows: string[][]) {
    const widths = [2100, 2500, 2100, 2500];
    const cells = rows
      .map((row) => {
        const rowCells = row
          .map((value, index) => {
            const bold = index % 2 === 0 ? '<w:b/>' : '';
            return `<w:tc><w:tcPr><w:tcW w:w="${widths[index] || 2300}" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr>${bold}</w:rPr><w:t xml:space="preserve">${this.escapeXml(value)}</w:t></w:r></w:p></w:tc>`;
          })
          .join('');
        return `<w:tr>${rowCells}</w:tr>`;
      })
      .join('');

    return `<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${cells}</w:tbl>`;
  }

  private escapeXml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
      .find((candidate) => candidate.startsWith(normalizedRoot) && existsSync(candidate)) || null;
  }

  private safeFileName(fileName: string) {
    const name = basename(fileName || 'document')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return name || 'document';
  }

  private legalDocumentSyncKey(documentType: string, fileName: string) {
    return `${documentType.trim().toLowerCase()}::${fileName.trim().toLowerCase()}`;
  }

  private caseInclude() {
    return {
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
