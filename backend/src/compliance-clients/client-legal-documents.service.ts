import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientLegalDocument, Prisma } from '@prisma/client';
import { COMPLIANCE_REGISTER_WHERE } from '../common/client-compliance';
import { RequestUser } from '../common/types/request-user.type';
import { KycService } from '../kyc/kyc.service';
import { PrismaService } from '../prisma/prisma.service';
import { clientAccessLevel, clientScopeWhere } from './client-access';
import { roleSummary } from './client-records';
import { dateValue, editedMap, isoDate, personInclude, syncRecordExpiries, notifyLegalDocumentChange, toRecordPerson } from './client-records-store';
import { ComplianceDocumentsService, UploadedClientFile } from './compliance-documents.service';
import { DocumentReaderService } from './document-reader.service';
import { CreateLegalDocumentDto, LegalDocumentFieldsDto } from './dto/legal-document.dto';
import { legalDocumentType, LEGAL_DOCUMENT_TYPES } from './legal-document-catalogue';

// Legal documents register of a compliance client (requirements L01-L09, D01-D14). Documents are added, replaced
// (renewal or correction: the old one is kept as REPLACED) and removed (kept as DELETED with the reason) outside the
// KYC. Every change is audited and the AML team is notified. A CR document's expiry becomes the company's CR expiry
// and a National Address certificate's expiry the person's; every current document with an expiry date is listed on
// the Expiry tab. QID and passports stay on the person and are listed here from the people records.

type Client = { id: string; tenantId: string; name: string };

const documentSelect = {
  id: true, typeKey: true, typeLabel: true, nature: true, personId: true, documentNumber: true, holderName: true, location: true,
  issueDate: true, expiryDate: true, notes: true, fileName: true, mimeType: true, size: true, status: true, replacesId: true,
  sourceKycDocumentId: true, readMethod: true, statusReason: true, statusChangedAt: true, createdAt: true, updatedAt: true,
  replacedBy: { select: { id: true } }
} satisfies Prisma.ClientLegalDocumentSelect;

@Injectable()
export class ClientLegalDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: ComplianceDocumentsService,
    private readonly reader: DocumentReaderService,
    private readonly kycService?: KycService
  ) {}

  async list(user: RequestUser, clientId: string) {
    const client = await this.findClient(user, clientId);
    const [documents, people, copies] = await Promise.all([
      this.prisma.clientLegalDocument.findMany({
        where: { clientId: client.id, tenantId: client.tenantId },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        select: documentSelect
      }),
      this.prisma.clientPerson.findMany({ where: { clientId: client.id, tenantId: client.tenantId, archivedAt: null }, include: personInclude, orderBy: [{ sortOrder: 'asc' }] }),
      this.prisma.clientDocument.findMany({
        where: { clientId: client.id, tenantId: client.tenantId, deletedAt: null, personId: { not: null }, identityType: { in: ['QID', 'PASSPORT'] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, personId: true, identityType: true, documentNumber: true, fileName: true, mimeType: true, createdAt: true }
      })
    ]);
    const normal = (value: string | null | undefined) => (value || '').replace(/\s+/g, '').toUpperCase();
    // QID and passports of the people, with their latest copy, in the same shape as the register rows.
    const identity = people.filter((person) => person.partyType === 'INDIVIDUAL').flatMap((person) => {
      const record = toRecordPerson(person);
      const mine = copies.filter((copy) => copy.personId === person.id);
      const rows = [];
      if (person.qidNumber || person.qidExpiry || mine.some((copy) => copy.identityType === 'QID')) {
        rows.push({
          key: `qid:${person.id}`, typeKey: 'QID', typeLabel: 'QID', nature: 'INDIVIDUAL', personId: person.id, personRoles: roleSummary(record),
          documentNumber: person.qidNumber, holderName: person.fullName, location: person.nationality, expiryDate: isoDate(person.qidExpiry),
          copy: mine.find((copy) => copy.identityType === 'QID') || null, passportId: null
        });
      }
      for (const passport of person.passports) {
        rows.push({
          key: `passport:${passport.id}`, typeKey: 'PASSPORT', typeLabel: 'Passport', nature: 'INDIVIDUAL', personId: person.id, personRoles: roleSummary(record),
          documentNumber: passport.passportNumber, holderName: person.fullName, location: passport.issuingCountry || person.nationality,
          expiryDate: isoDate(passport.expiryDate), passportId: passport.id,
          copy: mine.find((copy) => copy.identityType === 'PASSPORT' && normal(copy.documentNumber) === normal(passport.passportNumber))
            || (passport.isPrimary ? mine.find((copy) => copy.identityType === 'PASSPORT' && !person.passports.some((other) => normal(other.passportNumber) === normal(copy.documentNumber))) : null)
            || null
        });
      }
      return rows;
    });
    const seesPassports = clientAccessLevel(user) !== 'ALLOCATED';
    return {
      types: seesPassports ? LEGAL_DOCUMENT_TYPES : LEGAL_DOCUMENT_TYPES.filter((type) => type.key !== 'PASSPORT'),
      documents: documents.map((document) => ({
        ...document,
        issueDate: isoDate(document.issueDate),
        expiryDate: isoDate(document.expiryDate),
        replacedById: document.replacedBy?.id ?? null,
        replacedBy: undefined,
        personRoles: (() => {
          const person = document.personId ? people.find((item) => item.id === document.personId) : null;
          return person ? roleSummary(toRecordPerson(person)) : null;
        })()
      })),
      identity: seesPassports ? identity : identity.filter((row) => row.typeKey !== 'PASSPORT'),
      people: people.map((person) => ({ id: person.id, fullName: person.fullName, partyType: person.partyType, nationality: person.nationality, roles: roleSummary(toRecordPerson(person)) }))
    };
  }

  // Reads the file to pre-fill the add form. Nothing is stored.
  async read(user: RequestUser, clientId: string, typeKey: string, files: UploadedClientFile[]) {
    const client = await this.findClient(user, clientId);
    if (files.length !== 1) throw new BadRequestException('Select one file to read.');
    const type = legalDocumentType(typeKey);
    if (!type) throw new BadRequestException('Choose the document type.');
    return this.reader.read(client.tenantId, type.key, files[0]);
  }

  async create(user: RequestUser, clientId: string, dto: CreateLegalDocumentDto, files: UploadedClientFile[]) {
    const client = await this.findClient(user, clientId);
    const type = legalDocumentType(dto.typeKey);
    if (!type) throw new BadRequestException('Choose the document type.');
    if (type.personIdentity) throw new BadRequestException('QID and passport copies are added on the person (ID documents), so they stay linked to the person.');
    const typeLabel = type.key === 'OTHER' ? this.text(dto.typeLabel, 150) : type.label;
    if (!typeLabel) throw new BadRequestException('Enter the document name.');
    const nature = type.key === 'OTHER' ? (dto.nature === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'COMPANY') : type.nature;

    let file: { fileName: string; storagePath: string; mimeType: string | null; size: number } | null = null;
    let sourceKycDocumentId: string | null = null;
    if (dto.kycDocumentId) {
      if (!this.kycService) throw new BadRequestException('KYC documents are not available.');
      const legal = await this.prisma.legalDocument.findFirst({
        where: { id: dto.kycDocumentId, tenantId: client.tenantId, storagePath: { not: null }, kycCase: { clientId: client.id } },
        select: { id: true, kycCaseId: true }
      });
      if (!legal) throw new NotFoundException('KYC document not found for this client.');
      const content = await this.kycService.getLegalDocumentFile(user, legal.kycCaseId, legal.id);
      file = this.files.writeClientFile(client, { originalname: content.fileName, mimetype: content.mimeType || undefined, size: content.content.length, buffer: content.content });
      sourceKycDocumentId = legal.id;
    } else {
      if (files.length !== 1) throw new BadRequestException('Select one file: the copy of the document.');
      file = this.files.writeClientFile(client, files[0]);
    }

    const replaced = dto.replacesId
      ? await this.prisma.clientLegalDocument.findFirst({ where: { id: dto.replacesId, clientId: client.id, tenantId: client.tenantId, status: 'CURRENT' } })
      : null;
    if (dto.replacesId && !replaced) throw new BadRequestException('The document being replaced is no longer current. Refresh the page.');
    const values = await this.values(client, nature, dto, true);

    const created = await this.prisma.$transaction(async (tx) => {
      if (replaced) {
        await tx.clientLegalDocument.update({
          where: { id: replaced.id },
          data: { status: 'REPLACED', statusReason: 'Replaced by a newer document', statusChangedAt: new Date(), statusChangedById: user.id, updatedById: user.id }
        });
      }
      const document = await tx.clientLegalDocument.create({
        data: {
          tenantId: client.tenantId, clientId: client.id, typeKey: type.key, typeLabel, nature, ...values, holderName: values.holderName || client.name, ...file,
          replacesId: replaced?.id ?? null, sourceKycDocumentId, readMethod: dto.readMethod || 'MANUAL', createdById: user.id, updatedById: user.id
        }
      });
      await this.applyToProfile(tx, user, client, document);
      await syncRecordExpiries(tx, client, user.id);
      await this.audit(tx, user, client, document.id, replaced ? 'CREATE' : 'CREATE', {
        action: replaced ? 'LEGAL_DOCUMENT_REPLACED' : 'LEGAL_DOCUMENT_ADDED', type: typeLabel, number: document.documentNumber, holder: document.holderName,
        expiryDate: isoDate(document.expiryDate), replacesId: replaced?.id ?? null, readMethod: document.readMethod, fromKycDocument: sourceKycDocumentId
      });
      await notifyLegalDocumentChange(tx, client, replaced ? 'Legal document replaced' : 'Legal document added',
        `${this.describe(document)} was ${replaced ? 'replaced with a new copy' : 'added'} by ${this.actor(user)}. Check whether the KYC needs updating.`);
      return document;
    }, { timeout: 30000 });
    return { id: created.id, ...(await this.list(user, clientId)) };
  }

  async update(user: RequestUser, clientId: string, documentId: string, dto: LegalDocumentFieldsDto) {
    const client = await this.findClient(user, clientId);
    const document = await this.current(client, documentId);
    const values = await this.values(client, document.nature, dto, false);
    const changes = Object.fromEntries(Object.entries(values)
      .filter(([key, value]) => this.shown((document as Record<string, unknown>)[key]) !== this.shown(value))
      .map(([key, value]) => [key, { from: this.shown((document as Record<string, unknown>)[key]), to: this.shown(value) }]));
    if (!Object.keys(changes).length) return this.list(user, clientId);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.clientLegalDocument.update({ where: { id: document.id }, data: { ...values, updatedById: user.id } });
      await this.applyToProfile(tx, user, client, updated);
      await syncRecordExpiries(tx, client, user.id);
      await this.audit(tx, user, client, document.id, 'UPDATE', { action: 'LEGAL_DOCUMENT_EDITED', type: document.typeLabel, changes });
      await notifyLegalDocumentChange(tx, client, 'Legal document changed',
        `${this.describe(updated)} was changed by ${this.actor(user)} (${Object.keys(changes).join(', ')}). Check whether the KYC needs updating.`);
    });
    return this.list(user, clientId);
  }

  // Removal keeps the record and file as DELETED with the reason; only the register view hides it.
  async remove(user: RequestUser, clientId: string, documentId: string, reason: string) {
    const client = await this.findClient(user, clientId);
    const document = await this.current(client, documentId);
    const why = this.text(reason, 1000);
    if (!why) throw new BadRequestException('Give the reason for removing the document.');
    await this.prisma.$transaction(async (tx) => {
      await tx.clientLegalDocument.update({
        where: { id: document.id },
        data: { status: 'DELETED', statusReason: why, statusChangedAt: new Date(), statusChangedById: user.id, updatedById: user.id }
      });
      await syncRecordExpiries(tx, client, user.id);
      await this.audit(tx, user, client, document.id, 'DELETE', { action: 'LEGAL_DOCUMENT_REMOVED', type: document.typeLabel, number: document.documentNumber, reason: why });
      await notifyLegalDocumentChange(tx, client, 'Legal document removed', `${this.describe(document)} was removed by ${this.actor(user)}. Reason: ${why}`);
    });
    return this.list(user, clientId);
  }

  async getFile(user: RequestUser, clientId: string, documentId: string) {
    const client = await this.findClient(user, clientId);
    const document = await this.prisma.clientLegalDocument.findFirst({ where: { id: documentId, clientId: client.id, tenantId: client.tenantId } });
    if (!document) throw new NotFoundException('Document not found.');
    const content = this.files.readClientFile(document.storagePath);
    if (!content) throw new NotFoundException('The document file is missing from storage.');
    return { fileName: document.fileName || 'document', mimeType: document.mimeType, content };
  }

  // A CR document's expiry and number become the company's; a National Address certificate's expiry the person's.
  private async applyToProfile(tx: Prisma.TransactionClient, user: RequestUser, client: Client, document: ClientLegalDocument) {
    const type = legalDocumentType(document.typeKey);
    const now = new Date().toISOString();
    if (type?.isRegistration && (document.expiryDate || document.documentNumber)) {
      const entity = await tx.clientEntityProfile.findUnique({ where: { clientId: client.id } });
      if (entity) {
        const data: Prisma.ClientEntityProfileUpdateInput = {};
        const edited = editedMap(entity.fieldEditedAt);
        if (document.expiryDate && entity.crExpiryDate?.getTime() !== document.expiryDate.getTime()) {
          data.crExpiryDate = document.expiryDate;
          edited.crExpiryDate = now;
        }
        if (document.documentNumber && !entity.commercialRegistrationNo) {
          data.commercialRegistrationNo = document.documentNumber;
          edited.commercialRegistrationNo = now;
        }
        if (Object.keys(data).length) await tx.clientEntityProfile.update({ where: { id: entity.id }, data: { ...data, fieldEditedAt: edited, updatedById: user.id } });
      }
    }
    if (document.typeKey === 'NATIONAL_ADDRESS' && document.personId && document.expiryDate) {
      const person = await tx.clientPerson.findUnique({ where: { id: document.personId } });
      if (person && person.nationalAddressExpiry?.getTime() !== document.expiryDate.getTime()) {
        await tx.clientPerson.update({
          where: { id: person.id },
          data: { nationalAddressExpiry: document.expiryDate, fieldEditedAt: { ...editedMap(person.fieldEditedAt), nationalAddressExpiry: now }, updatedById: user.id }
        });
      }
    }
  }

  // Checks the entered values. An individual document belongs to a person of this client; its name defaults to the
  // person's name, a company document's to the company's legal name.
  private async values(client: Client, nature: 'COMPANY' | 'INDIVIDUAL', dto: LegalDocumentFieldsDto, creating: boolean) {
    const data: Record<string, unknown> = {};
    if (dto.personId !== undefined || creating) {
      const personId = this.text(dto.personId, 100);
      if (nature === 'INDIVIDUAL' && !personId) throw new BadRequestException('Choose the person this document belongs to.');
      const person = personId
        ? await this.prisma.clientPerson.findFirst({ where: { id: personId, clientId: client.id, tenantId: client.tenantId, archivedAt: null }, select: { id: true, fullName: true } })
        : null;
      if (personId && !person) throw new BadRequestException('This person is no longer on the client profile. Refresh the page.');
      data.personId = person?.id ?? null;
      if (creating && !this.text(dto.holderName, 300)) {
        const entity = await this.prisma.clientEntityProfile.findUnique({ where: { clientId: client.id }, select: { legalName: true } });
        data.holderName = person?.fullName || entity?.legalName || client.name;
      }
    }
    if (dto.holderName !== undefined && this.text(dto.holderName, 300)) data.holderName = this.text(dto.holderName, 300);
    if (dto.documentNumber !== undefined) data.documentNumber = this.text(dto.documentNumber, 100);
    if (dto.location !== undefined) data.location = this.text(dto.location, 100);
    if (dto.notes !== undefined) data.notes = this.text(dto.notes, 1000);
    if (dto.issueDate !== undefined) data.issueDate = this.date(dto.issueDate, 'issue date');
    if (dto.expiryDate !== undefined) data.expiryDate = this.date(dto.expiryDate, 'expiry date');
    if (data.issueDate && data.expiryDate && (data.issueDate as Date) > (data.expiryDate as Date)) throw new BadRequestException('The expiry date is before the issue date.');
    return data as Partial<Pick<ClientLegalDocument, 'personId' | 'holderName' | 'documentNumber' | 'location' | 'notes' | 'issueDate' | 'expiryDate'>>;
  }

  private date(value: string | null | undefined, label: string) {
    const text = this.text(value, 10);
    if (!text) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(dateValue(text)!.getTime())) throw new BadRequestException(`Enter the ${label} as YYYY-MM-DD.`);
    return dateValue(text);
  }

  private async current(client: Client, documentId: string) {
    const document = await this.prisma.clientLegalDocument.findFirst({ where: { id: documentId, clientId: client.id, tenantId: client.tenantId, status: 'CURRENT' } });
    if (!document) throw new NotFoundException('This document is no longer current. Refresh the page.');
    return document;
  }

  private describe(document: Pick<ClientLegalDocument, 'typeLabel' | 'documentNumber' | 'holderName' | 'expiryDate'>) {
    return [`${document.typeLabel}${document.documentNumber ? ` no. ${document.documentNumber}` : ''}`, `of ${document.holderName}`, document.expiryDate ? `(expires ${isoDate(document.expiryDate)})` : ''].filter(Boolean).join(' ');
  }

  private actor(user: RequestUser) {
    return user.email || 'a user';
  }

  private shown(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    return value instanceof Date ? isoDate(value) : String(value);
  }

  private text(value: unknown, max: number) {
    const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    return text ? text.slice(0, max) : null;
  }

  private audit(tx: Prisma.TransactionClient, user: RequestUser, client: Client, entityId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', metadata: Record<string, unknown>) {
    return tx.auditLog.create({
      data: { tenantId: client.tenantId, actorId: user.id, action, entityType: 'ClientLegalDocument', entityId, metadata: { clientId: client.id, ...metadata } as Prisma.InputJsonValue }
    });
  }

  private async findClient(user: RequestUser, clientId: string): Promise<Client> {
    const scope = user.roles.includes('SUPER_ADMIN') ? {} : user.tenantId ? { tenantId: user.tenantId, ...clientScopeWhere(user) } : null;
    if (!scope) throw new ForbiddenException('User is not assigned to a tenant');
    const client = await this.prisma.client.findFirst({ where: { id: clientId, ...COMPLIANCE_REGISTER_WHERE, ...scope }, select: { id: true, tenantId: true, name: true } });
    if (!client) throw new NotFoundException('Compliance client not found');
    return client;
  }
}
