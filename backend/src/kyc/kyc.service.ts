import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DueDiligenceType,
  KycCaseStatus,
  KycFormSectionKey,
  KycGeneratedDocumentType,
  NotificationType,
  Prisma,
  ProposalStatus,
  RiskClassification
} from '@prisma/client';
import Docxtemplater from 'docxtemplater';
import PDFDocument = require('pdfkit');
import PizZip from 'pizzip';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { basename, join, normalize } from 'path';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { AddWorkflowCommentDto } from './dto/add-workflow-comment.dto';
import { AssignServiceDto } from './dto/assign-service.dto';
import { CreateKycCaseDto } from './dto/create-kyc-case.dto';
import { UpdateKycCaseDto } from './dto/update-kyc-case.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';
import { UploadLegalDocumentDto } from './dto/upload-legal-document.dto';

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser) {
    const where: Prisma.KycCaseWhereInput = this.tenantWhere(user);

    if (this.isAmlOnly(user)) {
      where.status = { in: [KycCaseStatus.SUBMITTED_TO_AML, KycCaseStatus.AML_REVIEW_STARTED] };
    }

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

    if (!kycCase || (this.isAmlOnly(user) && !this.isSubmittedToAml(kycCase.status))) {
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
            note: 'Legal document metadata uploaded'
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
      throw new NotFoundException('Legal document not found');
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
      throw new NotFoundException('Legal document not found');
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
      throw new BadRequestException('Upload at least one legal document before submitting to AML');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.kycCase.update({
        where: { id },
        data: {
          status: KycCaseStatus.SUBMITTED_TO_AML,
          submittedToAmlAt: new Date()
        }
      });

      await tx.kycCaseStatusHistory.create({
        data: {
          tenantId: kycCase.tenantId,
          kycCaseId: id,
          fromStatus: kycCase.status,
          toStatus: KycCaseStatus.SUBMITTED_TO_AML,
          changedById: user.id,
          note: 'Client file submitted to AML team'
        }
      });

      await tx.notification.create({
        data: {
          tenantId: kycCase.tenantId,
          kycCaseId: id,
          type: NotificationType.AML_CASE_SUBMITTED,
          title: 'New KYC case submitted',
          message: `${kycCase.title} is ready for AML review.`
        }
      });

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

    return this.updateStatus(user, id, KycCaseStatus.AML_REVIEW_STARTED, 'AML team started KYC review', {
      amlAssigneeId: user.id,
      amlReviewStartedAt: new Date()
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
    const form = await this.requireWritableForm(user, id, ['OPERATING_TEAM', 'AML_TEAM', 'COMPANY_ADMIN']);
    const rows = this.asArray<RowPayload>(dto.shareholders).filter((row) => this.hasRowValue(row));
    const ubos = this.asArray<RowPayload>(dto.ubos).filter((row) => this.hasRowValue(row));
    const total = rows.reduce((sum, row) => sum + this.numberValue(row.ownershipPercentage), 0);

    if (total > 100) {
      throw new BadRequestException('Total ownership percentage cannot exceed 100');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.kycShareholder.deleteMany({ where: { kycFormId: form.id } });
      await tx.kycUbo.deleteMany({ where: { kycFormId: form.id } });
      await tx.kycSectionData.upsert({
        where: { kycFormId_sectionKey: { kycFormId: form.id, sectionKey: KycFormSectionKey.OWNERSHIP } },
        update: {
          data: this.jsonValue({
            totalOwnershipPercentage: total,
            uboDifferentFromShareholders: dto.uboDifferentFromShareholders || 'No',
            uboGroupStructureNotes: dto.uboGroupStructureNotes || ''
          }),
          updatedBy: user.id
        },
        create: {
          tenantId: form.tenantId,
          kycCaseId: id,
          kycFormId: form.id,
          sectionKey: KycFormSectionKey.OWNERSHIP,
          data: this.jsonValue({
            totalOwnershipPercentage: total,
            uboDifferentFromShareholders: dto.uboDifferentFromShareholders || 'No',
            uboGroupStructureNotes: dto.uboGroupStructureNotes || ''
          }),
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
            nationality: this.optionalText(row.nationality),
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
    const form = await this.requireWritableForm(user, id, ['OPERATING_TEAM', 'AML_TEAM', 'COMPANY_ADMIN']);
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
            dateOfBirth: this.dateValue(row.dateOfBirth),
            identityNumber: this.optionalText(row.identityNumber),
            position: this.optionalText(row.position),
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
    const form = await this.requireWritableForm(user, id, ['OPERATING_TEAM', 'AML_TEAM', 'COMPANY_ADMIN']);
    const rows = this.asArray<RowPayload>(dto.documents).filter((row) => this.hasRowValue(row));

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

      await tx.kycSectionData.upsert({
        where: { kycFormId_sectionKey: { kycFormId: form.id, sectionKey: KycFormSectionKey.REQUIRED_DOCUMENTS } },
        update: { data: this.jsonValue({ uploadedFilesNote: dto.uploadedFilesNote || '' }), updatedBy: user.id },
        create: {
          tenantId: form.tenantId,
          kycCaseId: id,
          kycFormId: form.id,
          sectionKey: KycFormSectionKey.REQUIRED_DOCUMENTS,
          data: this.jsonValue({ uploadedFilesNote: dto.uploadedFilesNote || '' }),
          createdBy: user.id,
          updatedBy: user.id
        }
      });
      await tx.kycForm.update({ where: { id: form.id }, data: { updatedBy: user.id } });
    });

    return this.getForm(user, id);
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

  private async saveSectionData(
    user: RequestUser,
    id: string,
    sectionKey: KycFormSectionKey,
    data: Record<string, unknown>
  ) {
    const form = await this.requireWritableForm(user, id, ['OPERATING_TEAM', 'AML_TEAM', 'COMPANY_ADMIN']);

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

    return {
      id: form.id,
      tenantId: form.tenantId,
      kycCaseId: form.kycCaseId,
      status: form.status,
      isLocked: form.isLocked,
      version: form.version,
      sectionA: section(KycFormSectionKey.GENERAL_COMPANY),
      sectionB: {
        ...section(KycFormSectionKey.OWNERSHIP),
        shareholders: form.shareholders,
        ubos: form.ubos
      },
      sectionC: {
        ...section(KycFormSectionKey.MANAGEMENT),
        managers: form.managers
      },
      sectionD: section(KycFormSectionKey.COMPLIANCE_RISK),
      sectionE: section(KycFormSectionKey.COMMUNICATION_PERSON),
      sectionF: {
        ...section(KycFormSectionKey.REQUIRED_DOCUMENTS),
        documents: form.requiredDocuments
      },
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

  private async requireWritableCase(user: RequestUser, id: string) {
    const kycCase = await this.prisma.kycCase.findFirst({
      where: { id, ...this.tenantWhere(user) }
    });

    if (!kycCase) {
      throw new NotFoundException('KYC case not found');
    }

    if (this.isAmlOnly(user)) {
      throw new ForbiddenException('AML team cannot modify client intake records');
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

  private isAmlOnly(user: RequestUser) {
    return user.roles.includes('AML_TEAM') && !user.roles.some((role) => ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(role));
  }

  private isSubmittedToAml(status: KycCaseStatus) {
    return status === KycCaseStatus.SUBMITTED_TO_AML || status === KycCaseStatus.AML_REVIEW_STARTED;
  }

  private hasAnyRole(user: RequestUser, roles: string[]) {
    return user.roles.some((role) => roles.includes(role));
  }

  private internalReviewAllowedRoles(dto: Record<string, unknown>) {
    const part = typeof dto.reviewPart === 'string' ? dto.reviewPart : 'AML';
    if (part === 'DMLRO') return ['DMLRO', 'COMPANY_ADMIN'];
    if (part === 'MLRO') return ['MLRO', 'COMPANY_ADMIN'];
    return ['AML_TEAM', 'COMPANY_ADMIN'];
  }

  private internalReviewData(dto: Record<string, unknown>): ReviewPatch {
    const part = typeof dto.reviewPart === 'string' ? dto.reviewPart : 'AML';

    if (part === 'DMLRO') {
      return {
        dmlroName: this.optionalText(dto.dmlroName),
        dmlroSignatureFileName: this.optionalText(dto.dmlroSignatureFileName),
        dmlroDate: this.dateValue(dto.dmlroDate),
        dmlroComments: this.optionalText(dto.dmlroComments)
      };
    }

    if (part === 'MLRO') {
      return {
        mlroName: this.optionalText(dto.mlroName),
        mlroSignatureFileName: this.optionalText(dto.mlroSignatureFileName),
        mlroDate: this.dateValue(dto.mlroDate),
        mlroComments: this.optionalText(dto.mlroComments)
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

  private jsonValue(data: Record<string, unknown>): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonObject;
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
    const doc = new Docxtemplater(new PizZip(template), {
      paragraphLoop: true,
      linebreaks: true
    });

    doc.render(this.templateData(payload));
    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  private loadDocxTemplate() {
    const templatePaths = [
      join(process.cwd(), 'templates', 'kyc-part-1-template.docx'),
      join(process.cwd(), 'backend', 'templates', 'kyc-part-1-template.docx'),
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
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const data = this.templateData(payload);
      doc.fontSize(18).text('NEWOON KYC PART 1', { align: 'center' });
      doc.fontSize(9).text('Newoon Corporate Services | KYC & Engagement Workflow', { align: 'center' });
      doc.moveDown();
      this.pdfSection(doc, 'A. General Company Information', [
        ['Date', data.date],
        ['Reference', data.reference],
        ['Legal Name', data.legalName],
        ['CR No.', data.commercialRegistrationNo],
        ['Tax ID', data.taxIdentificationNo],
        ['Country', data.countryOfIncorporation],
        ['Business Nature', data.businessNature],
        ['Prospective Service', data.prospectiveService]
      ]);
      this.pdfSection(doc, 'B. Ownership / Shareholders', [
        ['Total Ownership', `${data.totalOwnershipPercentage}%`],
        ['UBO Different', data.uboDifferentFromShareholders],
        ['Shareholders', data.shareholdersText],
        ['UBOs', data.ubosText]
      ]);
      this.pdfSection(doc, 'C. Managers / Signatories', [['Persons', data.managersText]]);
      this.pdfSection(doc, 'D. Compliance and Risk', [
        ['PEP', data.pepQuestion],
        ['Sanctions', data.sanctionQuestion],
        ['Dual Citizenship', data.dualCitizenshipQuestion]
      ]);
      this.pdfSection(doc, 'E. Communication Person', [
        ['Name', data.communicationFullName],
        ['Position', data.communicationPosition],
        ['Email', data.communicationEmail],
        ['Mobile', data.communicationMobile]
      ]);
      this.pdfSection(doc, 'F. Required Documents', [['Checklist', data.requiredDocumentsText]]);
      this.pdfSection(doc, 'G. Client Declaration', [
        ['Name', data.declarationFullName],
        ['Position', data.declarationPosition],
        ['Date', data.declarationDate]
      ]);
      this.pdfSection(doc, 'H. Internal Use Only', [
        ['Risk Classification', data.riskClassification],
        ['Due Diligence', data.dueDiligenceType],
        ['AML', data.amlName],
        ['DMLRO', data.dmlroName],
        ['MLRO', data.mlroName]
      ]);
      doc.fontSize(8).text('Footer service line: Newoon KYC & Engagement Workflow', 36, 780, { align: 'center' });
      doc.end();
    });
  }

  private pdfSection(doc: PDFKit.PDFDocument, title: string, rows: Array<[string, unknown]>) {
    doc.moveDown(0.6);
    doc.fontSize(11).fillColor('#123b36').text(title, { underline: true });
    doc.fillColor('#17211f');
    rows.forEach(([label, value]) => {
      doc.fontSize(9).text(`${label}: ${this.text(value)}`);
    });
  }

  private templateData(payload: SerializedKycForm) {
    const sectionA = payload.sectionA as Record<string, unknown>;
    const sectionB = payload.sectionB as Record<string, unknown> & { shareholders?: RowPayload[]; ubos?: RowPayload[] };
    const sectionC = payload.sectionC as Record<string, unknown> & { managers?: RowPayload[] };
    const sectionD = payload.sectionD as Record<string, unknown>;
    const sectionE = payload.sectionE as Record<string, unknown>;
    const sectionF = payload.sectionF as Record<string, unknown> & { documents?: RowPayload[] };
    const sectionG = payload.sectionG as Record<string, unknown>;
    const sectionH = (payload.sectionH || {}) as Record<string, unknown>;
    const shareholders = this.templateRows(sectionB.shareholders, (row, index) => ({
      shareholderNo: String(index + 1),
      shareholderFullName: this.text(row.fullName),
      shareholderNationality: this.text(row.nationality),
      shareholderDateOfBirth: this.text(row.dateOfBirth),
      shareholderIdentityNumber: this.text(row.identityNumber),
      shareholderOwnershipPercentage: this.text(row.ownershipPercentage),
      shareholderResidenceAddress: this.text(row.residenceAddress)
    }));
    const ubos = this.templateRows(sectionB.ubos, (row, index) => ({
      uboNo: String(index + 1),
      uboFullName: this.text(row.fullName),
      uboNationality: this.text(row.nationality),
      uboDateOfBirth: this.text(row.dateOfBirth),
      uboIdentityNumber: this.text(row.identityNumber),
      uboOwnershipPercentage: this.text(row.ownershipPercentage),
      uboResidenceAddress: this.text(row.residenceAddress)
    }));
    const managers = this.templateRows(sectionC.managers, (row, index) => ({
      managerNo: String(index + 1),
      managerFullName: this.text(row.fullName),
      managerEntityName: this.text(row.entityName),
      managerNationalityAndAddress: this.text(row.nationalityAndAddress),
      managerDateOfBirth: this.text(row.dateOfBirth),
      managerIdentityNumber: this.text(row.identityNumber),
      managerPosition: this.text(row.position),
      managerAuthorizedSignatory: row.isAuthorizedSignatory ? 'Yes' : 'No'
    }));
    const totalUboPercentage = (sectionB.ubos || []).reduce((sum, row) => sum + this.numberValue(row.ownershipPercentage), 0);

    return {
      date: this.text(sectionA.date),
      reference: this.text(sectionA.reference),
      legalName: this.text(sectionA.legalName),
      commercialRegistrationNo: this.text(sectionA.commercialRegistrationNo),
      taxIdentificationNo: this.text(sectionA.taxIdentificationNo),
      dateOfIncorporation: this.text(sectionA.dateOfIncorporation),
      countryOfIncorporation: this.text(sectionA.countryOfIncorporation),
      legalForm: this.text(sectionA.legalForm),
      registeredOfficeAddress: this.text(sectionA.registeredOfficeAddress),
      telephone: this.text(sectionA.telephone),
      email: this.text(sectionA.email),
      website: this.text(sectionA.website),
      businessNature: this.text(sectionA.businessNature),
      licenseActivities: this.text(sectionA.licenseActivities),
      relatedIndustry: this.text(sectionA.relatedIndustry),
      prospectiveService: this.text(sectionA.prospectiveService),
      totalOwnershipPercentage: this.text(sectionB.totalOwnershipPercentage),
      uboDifferentFromShareholders: this.text(sectionB.uboDifferentFromShareholders),
      uboDifferentYes: sectionB.uboDifferentFromShareholders === 'Yes' ? '☒' : '☐',
      uboDifferentNo: sectionB.uboDifferentFromShareholders === 'Yes' ? '☐' : '☒',
      uboGroupStructureNotes: this.text(sectionB.uboGroupStructureNotes),
      shareholders,
      ubos,
      managers,
      totalUboPercentage: this.text(totalUboPercentage),
      shareholdersText: this.rowsText(sectionB.shareholders, ['fullName', 'nationality', 'identityNumber', 'ownershipPercentage']),
      ubosText: this.rowsText(sectionB.ubos, ['fullName', 'nationality', 'identityNumber', 'ownershipPercentage']),
      managersText: this.rowsText(sectionC.managers, ['fullName', 'entityName', 'position', 'isAuthorizedSignatory']),
      pepQuestion: this.yesNoMark(sectionD.pepQuestion, 'Yes'),
      pepNo: this.yesNoMark(sectionD.pepQuestion, 'No'),
      pepDetails: this.text(sectionD.pepDetails),
      sanctionQuestion: this.yesNoMark(sectionD.sanctionQuestion, 'Yes'),
      sanctionNo: this.yesNoMark(sectionD.sanctionQuestion, 'No'),
      sanctionDetails: this.text(sectionD.sanctionDetails),
      dualCitizenshipQuestion: this.yesNoMark(sectionD.dualCitizenshipQuestion, 'Yes'),
      dualCitizenshipNo: this.yesNoMark(sectionD.dualCitizenshipQuestion, 'No'),
      dualCitizenshipDetails: this.text(sectionD.dualCitizenshipDetails),
      communicationFullName: this.text(sectionE.fullName),
      communicationPosition: this.text(sectionE.position),
      communicationNationality: this.text(sectionE.nationality),
      communicationIdentityNumber: this.text(sectionE.identityNumber),
      communicationMobile: this.text(sectionE.mobileNumber),
      communicationEmail: this.text(sectionE.email),
      requiredDocumentsText: this.rowsText(sectionF.documents, ['documentType', 'isProvided', 'fileName']),
      docCommercialRegistration: this.documentMark(sectionF.documents, 'Commercial Registration'),
      docEntityCard: this.documentMark(sectionF.documents, 'Entity Card'),
      docCertificateOfIncorporation: this.documentMark(sectionF.documents, 'Certificate of Incorporation'),
      docArticlesOfAssociation: this.documentMark(sectionF.documents, 'Articles of Association'),
      docIdentityCopies: this.documentMark(sectionF.documents, 'QID / Passport copies'),
      docLegalEntityShareholderCr: this.documentMark(sectionF.documents, 'CR of legal entity shareholders'),
      docNationalAddressCertificates: this.documentMark(sectionF.documents, 'National address certificates'),
      docAuditedFinancialStatements: this.documentMark(sectionF.documents, 'Latest Audited Financial Statements'),
      docTaxCard: this.documentMark(sectionF.documents, 'Tax Card'),
      declarationFullName: this.text(sectionG.fullName),
      declarationPosition: this.text(sectionG.position),
      declarationDate: this.text(sectionG.date),
      signatureFileName: this.text(sectionG.signatureFileName),
      stampFileName: this.text(sectionG.stampFileName),
      amlAccuracyChecked: this.text(sectionH.amlAccuracyChecked),
      amlClarificationFindings: this.text(sectionH.amlClarificationFindings),
      riskClassification: this.text(sectionH.riskClassification),
      dueDiligenceType: this.text(sectionH.dueDiligenceType),
      amlName: this.text(sectionH.amlName),
      amlSignatureFileName: this.text(sectionH.amlSignatureFileName),
      amlDate: this.text(sectionH.amlDate),
      dmlroName: this.text(sectionH.dmlroName),
      dmlroSignatureFileName: this.text(sectionH.dmlroSignatureFileName),
      dmlroDate: this.text(sectionH.dmlroDate),
      dmlroComments: this.text(sectionH.dmlroComments),
      mlroName: this.text(sectionH.mlroName),
      mlroSignatureFileName: this.text(sectionH.mlroSignatureFileName),
      mlroDate: this.text(sectionH.mlroDate),
      mlroComments: this.text(sectionH.mlroComments)
    };
  }

  private templateRows<T extends Record<string, string>>(rows: RowPayload[] | undefined, mapper: (row: RowPayload, index: number) => T) {
    return rows?.length ? rows.map(mapper) : [];
  }

  private yesNoMark(value: unknown, expected: 'Yes' | 'No') {
    return this.text(value || 'No') === expected ? '☒' : '☐';
  }

  private documentMark(rows: RowPayload[] | undefined, label: string) {
    const row = rows?.find((item) => this.text(item.documentType).toLowerCase().includes(label.toLowerCase()));
    return row?.isProvided ? '☒' : '☐';
  }

  private rowsText(rows: RowPayload[] | undefined, fields: string[]) {
    if (!rows?.length) return '';
    return rows
      .map((row, index) => `${index + 1}. ${fields.map((field) => this.text(row[field])).filter(Boolean).join(' | ')}`)
      .join('\n');
  }

  private text(value: unknown) {
    if (value === null || value === undefined) return '';
    if (value instanceof Prisma.Decimal) return value.toString();
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
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
${this.docxParagraph('NEWOON KYC PART 1')}
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
${this.docxParagraph('UBOs:\\n{ubosText}')}
${this.docxParagraph('C. Manager / Authorized Signatory / Directors / Secretary')}
${this.docxParagraph('{managersText}')}
${this.docxParagraph('D. Compliance and Risk Information')}
${this.docxParagraph('PEP: {pepQuestion} {pepDetails}')}
${this.docxParagraph('Sanctions: {sanctionQuestion} {sanctionDetails}')}
${this.docxParagraph('Dual Citizenship: {dualCitizenshipQuestion} {dualCitizenshipDetails}')}
${this.docxParagraph('E. Key Communication Person')}
${this.docxParagraph('{communicationFullName} | {communicationPosition} | {communicationNationality} | {communicationIdentityNumber} | {communicationMobile} | {communicationEmail}')}
${this.docxParagraph('F. Required Documents Checklist')}
${this.docxParagraph('{requiredDocumentsText}')}
${this.docxParagraph('G. Client Declaration')}
${this.docxParagraph('{declarationFullName} | {declarationPosition} | {declarationDate} | Signature: {signatureFileName} | Stamp: {stampFileName}')}
${this.docxParagraph('H. Internal Use Only')}
${this.docxParagraph('Accuracy checked: {amlAccuracyChecked} | Findings: {amlClarificationFindings}')}
${this.docxParagraph('Risk: {riskClassification} | Due diligence: {dueDiligenceType} | AML: {amlName}')}
${this.docxParagraph('DMLRO: {dmlroName} | Comments: {dmlroComments}')}
${this.docxParagraph('MLRO: {mlroName} | Comments: {mlroComments}')}
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

  private escapeXml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private legalDocumentUploadRoot() {
    return normalize(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads', 'legal-documents'));
  }

  private resolveLegalDocumentPath(storagePath: string) {
    const uploadRoot = this.legalDocumentUploadRoot();
    const absolutePath = normalize(join(uploadRoot, storagePath));
    const normalizedRoot = normalize(uploadRoot);

    return absolutePath.startsWith(normalizedRoot) ? absolutePath : null;
  }

  private safeFileName(fileName: string) {
    const name = basename(fileName || 'document')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return name || 'document';
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
  amlDate?: Date | null;
  dmlroName?: string | null;
  dmlroSignatureFileName?: string | null;
  dmlroDate?: Date | null;
  dmlroComments?: string | null;
  mlroName?: string | null;
  mlroSignatureFileName?: string | null;
  mlroDate?: Date | null;
  mlroComments?: string | null;
};
