import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { AiCredentials, AiSettingsService } from '../ai-settings/ai-settings.service';
import { legalDocumentType } from './legal-document-catalogue';
import { DocumentSuggestion, parseDate, parseDocumentText, SUGGESTED_ROLES } from './document-text-parser';
import { IdDocumentReaderService } from './id-document-reader.service';

// Reads the details of an uploaded company or individual document to pre-fill the legal documents register
// (requirements X2 and A01-A07). With the company's AI service set up (Administration > AI document reading),
// the file is sent to OpenAI, which reads any layout and Arabic. Otherwise it is read on this server: the PDF text
// layer, or OCR (English) for images and scanned PDFs. Nothing is stored here: staff check the values first.

type Worker = { recognize: (image: Buffer) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };
type UploadedFile = { buffer: Buffer; mimetype?: string; originalname?: string };

export type ReadResult = DocumentSuggestion & { method: 'AI' | 'LOCAL' | 'NONE'; message: string; aiConfigured: boolean };

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const AI_TIMEOUT_MS = 90_000;
const LOCAL_TIMEOUT_MS = 90_000;
const MAX_TEXT_PAGES = 4;
const importModule = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

const nullableString = { type: ['string', 'null'] };
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['document', 'company', 'people'],
  properties: {
    document: {
      type: 'object', additionalProperties: false,
      required: ['documentNumber', 'holderName', 'location', 'issueDate', 'expiryDate'],
      properties: { documentNumber: nullableString, holderName: nullableString, location: nullableString, issueDate: nullableString, expiryDate: nullableString }
    },
    company: {
      type: 'object', additionalProperties: false,
      required: ['legalName', 'commercialRegistrationNo', 'dateOfIncorporation', 'crExpiryDate', 'countryOfIncorporation', 'placeOfIncorporation', 'legalForm', 'registeredOfficeAddress', 'shareCapital', 'taxIdentificationNo', 'licenseActivities'],
      properties: {
        legalName: nullableString, commercialRegistrationNo: nullableString, dateOfIncorporation: nullableString, crExpiryDate: nullableString,
        countryOfIncorporation: nullableString, placeOfIncorporation: nullableString, legalForm: nullableString, registeredOfficeAddress: nullableString,
        shareCapital: nullableString, taxIdentificationNo: nullableString, licenseActivities: nullableString
      }
    },
    people: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['fullName', 'nationality', 'roles', 'sharePercentage', 'idNumber'],
        properties: {
          fullName: { type: 'string' }, nationality: nullableString, sharePercentage: nullableString, idNumber: nullableString,
          roles: { type: 'array', items: { type: 'string', enum: [...SUGGESTED_ROLES] } }
        }
      }
    }
  }
};

@Injectable()
export class DocumentReaderService implements OnApplicationShutdown {
  private readonly logger = new Logger(DocumentReaderService.name);
  private worker: Promise<Worker> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly aiSettings: AiSettingsService, private readonly idReader: IdDocumentReaderService) {}

  async onApplicationShutdown() {
    if (this.worker) await (await this.worker).terminate().catch(() => undefined);
  }

  async read(tenantId: string, typeKey: string, file: UploadedFile): Promise<ReadResult> {
    const kind = fileKind(file);
    const label = legalDocumentType(typeKey)?.label || 'document';
    const credentials = await this.aiSettings.credentialsFor(tenantId).catch(() => null);
    if (credentials && kind) {
      try {
        const read = await this.readWithAi(credentials, label, file, kind);
        return { ...read, method: 'AI', aiConfigured: true, message: 'Read by your AI service. Check every value against the document before saving.' };
      } catch (error) {
        // The AI reading is a convenience: fall back to the local reader.
        this.logger.warn(`AI document reading failed: ${(error as Error).message}`);
        const local = await this.readLocally(typeKey, file, kind);
        return { ...local, aiConfigured: true, message: `The AI service could not read this file (${(error as Error).message}). ${local.message}` };
      }
    }
    const local = await this.readLocally(typeKey, file, kind);
    return { ...local, aiConfigured: Boolean(credentials) };
  }

  private async readLocally(typeKey: string, file: UploadedFile, kind: 'pdf' | 'image' | null): Promise<ReadResult> {
    const empty = parseDocumentText(typeKey, '');
    if (!kind) return { ...empty, method: 'NONE', aiConfigured: false, message: 'Only PDF files and images can be read. Enter the details from the document.' };
    try {
      const text = await this.withTimeout(this.extractText(file, kind), LOCAL_TIMEOUT_MS);
      if (!text.trim()) return { ...empty, method: 'NONE', aiConfigured: false, message: 'No text could be read from this file. Enter the details from the document.' };
      const read = parseDocumentText(typeKey, text);
      const found = Object.values(read.document).filter(Boolean).length + Object.keys(read.company).length;
      return {
        ...read, method: found ? 'LOCAL' : 'NONE', aiConfigured: false,
        message: found
          ? 'Read on the server from the document text (English only). Check every value against the document before saving.'
          : 'The document text was read, but no details were recognised. Enter them from the document.'
      };
    } catch (error) {
      this.logger.warn(`Local document reading failed: ${(error as Error).message}`);
      return { ...empty, method: 'NONE', aiConfigured: false, message: 'The file could not be read. Enter the details from the document.' };
    }
  }

  // PDF text layer first; scanned pages and images go through OCR.
  private async extractText(file: UploadedFile, kind: 'pdf' | 'image') {
    if (kind === 'pdf') {
      const text = await this.pdfText(file.buffer);
      if (text.replace(/\s+/g, '').length >= 40) return text;
      const pages = await this.idReader.pdfPages(file.buffer, MAX_TEXT_PAGES);
      return (await Promise.all(pages.map((page) => this.ocr(page)))).join('\n');
    }
    return this.ocr(file.buffer);
  }

  private async pdfText(buffer: Buffer) {
    const pdfjs = await importModule('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false });
    const document = await task.promise;
    const lines: string[] = [];
    try {
      for (let number = 1; number <= Math.min(document.numPages, MAX_TEXT_PAGES); number += 1) {
        const page = await document.getPage(number);
        const content = await page.getTextContent();
        // Items on the same baseline form one line.
        const rows = new Map<number, Array<{ x: number; text: string }>>();
        for (const item of content.items as Array<{ str: string; transform: number[] }>) {
          if (!item.str?.trim()) continue;
          const y = Math.round(item.transform[5]);
          const key = [...rows.keys()].find((existing) => Math.abs(existing - y) <= 2) ?? y;
          rows.set(key, [...(rows.get(key) || []), { x: item.transform[4], text: item.str }]);
        }
        [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => lines.push(items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ')));
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
    return lines.join('\n');
  }

  private ocr(image: Buffer) {
    const job = this.queue.then(async () => (await (await this.getWorker()).recognize(image)).data.text);
    this.queue = job.catch(() => undefined);
    return job;
  }

  private getWorker() {
    if (!this.worker) {
      this.worker = (async () => {
        const { createWorker, OEM } = await import('tesseract.js');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const language = require('@tesseract.js-data/eng') as { langPath: string; gzip: boolean };
        return (await createWorker('eng', OEM.LSTM_ONLY, { langPath: language.langPath, gzip: language.gzip, cacheMethod: 'none' })) as unknown as Worker;
      })().catch((error) => {
        this.worker = null;
        throw error;
      });
    }
    return this.worker;
  }

  private async readWithAi(credentials: AiCredentials, label: string, file: UploadedFile, kind: 'pdf' | 'image'): Promise<DocumentSuggestion> {
    const base64 = file.buffer.toString('base64');
    const mime = kind === 'pdf' ? 'application/pdf' : file.mimetype || 'image/png';
    const attachment = kind === 'pdf'
      ? { type: 'input_file', filename: (file.originalname || 'document.pdf').slice(-100), file_data: `data:${mime};base64,${base64}` }
      : { type: 'input_image', image_url: `data:${mime};base64,${base64}` };
    const instructions = [
      `You read company and identity documents from Qatar (English or Arabic) for a KYC register. This document should be: ${label}.`,
      'Return only what is printed on the document; use null when a value is not shown. Do not guess.',
      'Dates as YYYY-MM-DD. Names and addresses in English as printed (transliterate Arabic only when no English is printed).',
      'documentNumber: the main number of this document (CR number, QFC number, establishment ID, tax number, certificate number).',
      'holderName: the company or person the document belongs to. location: the country or nationality shown.',
      'company: details of the company if the document shows them (for a commercial registration: name, CR number, dates, legal form, address, capital, activities).',
      'people: partners, shareholders, managers, directors and authorised signatories listed on the document, with their roles and share percentage.'
    ].join('\n');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials.apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: credentials.model,
          input: [{ role: 'user', content: [{ type: 'input_text', text: instructions }, attachment] }],
          text: { format: { type: 'json_schema', name: 'document_details', strict: true, schema: SCHEMA } }
        })
      });
    } catch (error) {
      throw new Error((error as Error).name === 'AbortError' ? 'no answer within 90 seconds' : 'the service could not be reached');
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      // Never log the body: it may echo document content.
      throw new Error(response.status === 401 ? 'the API key was refused' : response.status === 429 ? 'quota or rate limit reached' : `status ${response.status}`);
    }
    const body = await response.json() as { output?: Array<{ content?: Array<{ type: string; text?: string }> }> };
    const text = body.output?.flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text;
    if (!text) throw new Error('no answer was returned');
    return normalizeAiResult(JSON.parse(text));
  }

  private withTimeout<T>(promise: Promise<T>, ms: number) {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Reading the document took too long.')), ms);
      promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
    });
  }
}

function fileKind(file: UploadedFile): 'pdf' | 'image' | null {
  const name = (file.originalname || '').toLowerCase();
  if (file.mimetype === 'application/pdf' || name.endsWith('.pdf') || file.buffer.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  if ((file.mimetype || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(name)) return 'image';
  return null;
}

// Trims the AI answer to the shapes and limits the register accepts; dates that are not real dates are dropped.
export function normalizeAiResult(raw: unknown): DocumentSuggestion {
  const record = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
  const text = (value: unknown, max = 300) => (typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim().slice(0, max) : null);
  const date = (value: unknown) => parseDate(text(value, 40));
  const data = record(raw);
  const document = record(data.document);
  const company = record(data.company);
  const people = Array.isArray(data.people) ? data.people : [];
  const companyOut: DocumentSuggestion['company'] = {};
  for (const [key, value] of Object.entries(company)) {
    const out = ['dateOfIncorporation', 'crExpiryDate'].includes(key) ? date(value) : text(value, key === 'licenseActivities' ? 1000 : 300);
    if (out) (companyOut as Record<string, string>)[key] = out;
  }
  return {
    document: {
      documentNumber: text(document.documentNumber, 100), holderName: text(document.holderName, 200), location: text(document.location, 100),
      issueDate: date(document.issueDate), expiryDate: date(document.expiryDate)
    },
    company: companyOut,
    people: people.map(record).filter((person) => text(person.fullName)).slice(0, 50).map((person) => ({
      fullName: text(person.fullName, 200)!,
      nationality: text(person.nationality, 100),
      roles: (Array.isArray(person.roles) ? person.roles : []).filter((role): role is (typeof SUGGESTED_ROLES)[number] => SUGGESTED_ROLES.includes(role as never)),
      sharePercentage: (() => { const value = text(person.sharePercentage, 10)?.replace(/%$/, ''); return value && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100 ? String(Number(value)) : null; })(),
      idNumber: text(person.idNumber, 60)
    }))
  };
}
