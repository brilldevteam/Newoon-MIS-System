import { KycImage, normalizeImage } from './kyc-export-assets';
import { beneficialOwners } from '../../common/ownership';
import { commentLines } from '../../common/review-comments';
import { decisionText, enumText, optionText, text } from './kyc-export-format';
import { OwnershipDiagram, OwnershipParty, renderOwnershipDiagram } from './ownership-diagram';

// Format-neutral description of the KYC download. It mirrors the in-app "Know Your Customer Form" live preview
// (KycFormEditorPage LiveDocumentPreviewPanel) placed on the Newoon letterhead. DOCX and PDF renderers only
// translate these blocks; change labels and section content here, never in a renderer.

export type Inline = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; highlight?: boolean; muted?: boolean } | { box: boolean };
export type Line = {
  parts: Inline[];
  align?: 'left' | 'center' | 'justify';
  spaceAfter?: number;
  spaceBefore?: number;
  keepNext?: boolean;
};
export type Cell = { lines?: Line[]; image?: KycImage | null; span?: number; align?: 'left' | 'center' };
export type Row = { cells: Cell[]; header?: boolean };
// `fields`: two-column "Label: value" grid. `data`: tabular rows with a shaded header row.
export type TableStyle = 'fields' | 'data';
export type Block =
  | { kind: 'para'; line: Line }
  | { kind: 'title'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'section'; title: string; blocks: Block[] }
  | { kind: 'table'; weights: number[]; rows: Row[]; style: TableStyle }
  | { kind: 'diagram'; title: string; diagram: OwnershipDiagram | null; emptyText: string };

export type KycDocumentModel = {
  companyName: string;
  kycNumber: string;
  documentVersion: number;
  generatedAt: string;
  blocks: Block[];
};

export type KycExportPayload = {
  kycCaseId: string;
  sectionA: unknown;
  sectionB: unknown;
  sectionC: unknown;
  sectionD: unknown;
  sectionE: unknown;
  sectionF: unknown;
  sectionG: unknown;
  sectionH: unknown;
  amlComments?: string | null;
};

type Rec = Record<string, unknown>;
type FieldValue = string | { image: KycImage | null };

// A4 with 15 mm side margins inside the letterhead; the section box adds its own padding.
export const CONTENT_WIDTH_MM = 180;
export const CONTENT_WIDTH_PT = (CONTENT_WIDTH_MM / 25.4) * 72;
export const COLORS = { bar: '792326', border: 'CBD5E1', header: 'F1F5F9', muted: '64748B', ink: '0F172A', groupFill: 'FEECEC', groupEdge: 'B81F23' };

const record = (value: unknown) => (value && typeof value === 'object' ? value : {}) as Rec;
const rows = (value: unknown) => (Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : []) as Rec[];
const t = (value: string, bold = false): Inline => ({ text: value, bold });
const line = (parts: Inline[] | string, extra: Omit<Line, 'parts'> = {}): Line => ({ parts: typeof parts === 'string' ? [t(parts)] : parts, ...extra });
const para = (parts: Inline[] | string, extra: Omit<Line, 'parts'> = {}): Block => ({ kind: 'para', line: line(parts, extra) });
const dash = (value: string) => value || '-';
// The preview shows stored dates as YYYY-MM-DD.
const date = (value: unknown) => text(value).slice(0, 10);
// The letter date is written day-first, as in the client's KYC letter.
function dmy(value: unknown) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(value));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text(value);
}

// Two-column grid of "Label: value" cells, filled left to right like the preview's PreviewGrid.
function fields(items: Array<[string, FieldValue]>): Block {
  const cells = items.map(([label, value]): Cell => {
    if (typeof value === 'string') {
      if (/comment/i.test(label)) return { span: 2, lines: [line([t(`${label}:`, true)], { keepNext: true }), ...commentLines(value || '-').map((parts) => line(parts, { spaceAfter: 4 }))] };
      const [first, ...rest] = dash(value).split('\n');
      return { span: /findings|explanation|conditions|reason/i.test(label) ? 2 : undefined, lines: [line([t(`${label}: `, true), t(first)]), ...rest.map((part) => line(part))] };
    }
    return value.image
      ? { lines: [line([t(`${label}:`, true)])], image: value.image }
      : { lines: [line([t(`${label}: `, true), t('-')])] };
  });
  const tableRows: Row[] = [];
  let pending: Cell | undefined;
  for (const cell of cells) {
    if (cell.span === 2) {
      if (pending) tableRows.push({ cells: [{ ...pending, span: 2 }] });
      tableRows.push({ cells: [cell] });
      pending = undefined;
    } else if (pending) {
      tableRows.push({ cells: [pending, cell] });
      pending = undefined;
    } else pending = cell;
  }
  if (pending) tableRows.push({ cells: [{ ...pending, span: 2 }] });
  return { kind: 'table', weights: [1, 1], rows: tableRows, style: 'fields' };
}

// Data table with a shaded header row; an empty table shows "No rows added", as in the preview.
function data(headers: Array<[string, number]>, body: string[][]): Block {
  const cell = (value: string): Cell => ({ lines: dash(value).split('\n').map((part) => line(part)) });
  return {
    kind: 'table',
    style: 'data',
    weights: headers.map(([, weight]) => weight),
    rows: [
      { header: true, cells: headers.map(([header]) => ({ lines: [line([t(header, true)])] })) },
      ...(body.length
        ? body.map((values) => ({ cells: values.map(cell) }))
        : [{ cells: [{ span: headers.length, align: 'center' as const, lines: [line([{ text: 'No rows added', muted: true }])] }] }])
    ]
  };
}

const section = (title: string, blocks: Block[]): Block => ({ kind: 'section', title, blocks });
const subheading = (title: string): Block => ({ kind: 'subheading', text: title });

export async function buildKycDocumentModel(payload: KycExportPayload, documentVersion: number, generatedAt = new Date()): Promise<KycDocumentModel> {
  const a = record(payload.sectionA);
  const b = record(payload.sectionB);
  const c = record(payload.sectionC);
  const d = record(payload.sectionD);
  const e = record(payload.sectionE);
  const f = record(payload.sectionF);
  const g = record(payload.sectionG);
  const h = record(payload.sectionH);

  const companyName = text(a.legalName);
  const parties = rows(b.shareholders).map<Rec>((row, index) => ({ ...row, id: text(row.id) || `party-${index + 1}` }));
  const beneficial = beneficialOwners(parties, rows(b.ubos));
  const diagramParties: Rec[] = [...parties, ...beneficial.filter((row) => row.parentRowId && !parties.some((party) => party.id === row.id || party.fullName === row.fullName && party.identityNumber === row.identityNumber)).map<Rec>((row, index) => ({ ...row, id: text(row.id) || `ubo-${index + 1}`, shareholderType: 'Individual', isUbo: true }))];
  const managers = rows(c.managers);

  const [declarationSignature, companyStamp, dmlroSignature, mlroSignature, sefSignature] = await Promise.all(
    [g.signatureDataUrl, g.stampDataUrl, h.dmlroSignatureDataUrl, h.mlroSignatureDataUrl, h.sefSignatureDataUrl].map(normalizeImage)
  );
  // Uploaded file names are not printed in downloads; a missing image shows a dash.
  const signature = (value: KycImage | null) => ({ image: value });

  const diagram = renderOwnershipDiagram(
    companyName || 'Client company',
    diagramParties.map<OwnershipParty>((row) => ({
      id: text(row.id),
      parentId: text(row.parentRowId),
      name: text(row.fullName),
      type: text(row.shareholderType) || 'Individual',
      percentage: text(row.ownershipPercentage ?? row.shareholderPercentage),
      detail: optionText(row.nationality, row.nationalityOther) || text(row.residenceAddress),
      isBeneficial: Boolean(row.isUbo)
    })),
    CONTENT_WIDTH_PT - 30,
    520
  );

  const blocks: Block[] = [
    // Opening block of the client's KYC letter: date, reference, title and introduction.
    para(`Date: ${dmy(a.date)}`, { spaceAfter: 6 }),
    para(`Reference: ${text(a.reference)}`, { spaceAfter: 2 }),
    { kind: 'title', text: 'Know Your Client (KYC)' },
    para('Newoon LLC, as a registered business support services provider in the Qatar Financial Centre (“QFC”), is required to obtain, maintain, and keep up to date “Know Your Client” (“KYC”) information for all clients in line with applicable regulatory and compliance requirements. Accordingly, we would be grateful if you could provide the information and supporting documentation requested below, to enable us to complete and/or update our records.', { align: 'justify', spaceAfter: 2 }),

    section('A. General Company Information', [fields([
      ['Date', date(a.date)],
      ['KYC Number', text(a.reference)],
      ['Legal Name of Company', companyName],
      ['Commercial Registration No.', text(a.commercialRegistrationNo)],
      ['Tax Identification No.', text(a.taxIdentificationNo)],
      ['Date of Incorporation', date(a.dateOfIncorporation)],
      ['Country of Incorporation', optionText(a.countryOfIncorporation, a.countryOfIncorporationOther)],
      ['Legal Form', optionText(a.legalForm, a.legalFormOther)],
      ['Registered Office Address', text(a.registeredOfficeAddress)],
      ['Telephone', text(a.telephone)],
      ['Email', text(a.email)],
      ['Website', text(a.website)],
      ['Main purpose / nature of business', optionText(a.businessNature, a.businessNatureOther)],
      ['License activities', text(a.licenseActivities)],
      ['Related Industry', optionText(a.relatedIndustry, a.relatedIndustryOther)],
      ['Nature of prospective service from Newoon', optionText(a.prospectiveService, a.prospectiveServiceOther)]
    ])]),

    section('B. Control / Interest Details', [
      data(
        [['Type', 9], ['Full name', 13], ['Nationality / country', 11], ['DOB / Incorporation', 12], ['QID / Passport / CR', 12], ['Shareholder %', 11], ['Address', 13], ['Linked client', 9], ['Beneficial person', 10]],
        parties.map((row) => [
          text(row.shareholderType) || 'Individual', text(row.fullName), optionText(row.nationality, row.nationalityOther), date(row.dateOfBirth),
          text(row.identityNumber), text(row.shareholderPercentage ?? row.ownershipPercentage), text(row.residenceAddress), text(row.linkedClientName), row.isUbo ? 'Yes' : 'No'
        ])
      ),
      para([t(`Total shareholder %: ${text(b.totalOwnershipPercentage) || '0'}% | Total UBO %: ${text(b.totalUboPercentage) || '0'}%`, true)], { spaceBefore: 4, spaceAfter: 1 }),
      para(`Beneficial person different from listed parties: ${text(b.uboDifferentFromShareholders) || 'No'}`, { spaceAfter: 1 }),
      para(`Beneficial structure notes: ${dash(text(b.uboGroupStructureNotes))}`, { spaceAfter: 4 }),
      { kind: 'diagram', title: 'Control Structure', diagram, emptyText: 'No control structure generated.' },
      data(
        [['Beneficial person', 20], ['Nationality', 14], ['DOB', 12], ['Identity No.', 16], ['UBO %', 9], ['Address', 29]],
        beneficial.map((row) => [text(row.fullName), optionText(row.nationality, row.nationalityOther), date(row.dateOfBirth), text(row.identityNumber), text(row.uboInterestPercentage ?? row.ownershipPercentage), text(row.residenceAddress)])
      )
    ]),

    section('C. Manager / Authorized Signatory / Directors / Secretary', [data(
      [['Full name', 15], ['Position', 13], ['Entity', 14], ['Nationality', 11], ['Address', 15], ['DOB', 10], ['ID No.', 12], ['Signatory', 10]],
      managers.map((row) => [
        text(row.fullName), optionText(row.position, row.positionOther), text(row.entityName), optionText(row.nationality) || text(row.nationalityAndAddress),
        text(row.address), date(row.dateOfBirth), text(row.identityNumber), row.isAuthorizedSignatory ? 'Yes' : 'No'
      ])
    )]),

    section('D. Compliance and Risk Information', [fields([
      ['Any PEP exposure?', text(d.pepQuestion)],
      ['PEP details', text(d.pepDetails)],
      ['Any sanction exposure?', text(d.sanctionQuestion)],
      ['Sanction details', text(d.sanctionDetails)],
      ['Any dual citizenship?', text(d.dualCitizenshipQuestion)],
      ['Dual citizenship details', text(d.dualCitizenshipDetails)]
    ])]),

    section('E. Key Communication Person', [fields([
      ['Full name', text(e.fullName)],
      ['Position / Job title', optionText(e.position, e.positionOther)],
      ['Nationality', optionText(e.nationality, e.nationalityOther)],
      ['QID / Passport Number', text(e.identityNumber)],
      ['Mobile Number', text(e.mobileNumber)],
      ['Email', text(e.email)]
    ])]),

    section('F. Required Documents Checklist', [
      // Uploaded file names and additional documents are intentionally not part of the downloaded form.
      data([['Document', 80], ['Received', 20]], rows(f.documents).map((row) => [text(row.documentType), row.isProvided ? '☑' : '☐'])),
      fields([['Additional notes for KYC preparation documents', text(f.uploadedFilesNote)]])
    ]),

    section('G. Client Declaration', [fields([
      ['Full name', text(g.fullName)],
      ['Position', optionText(g.position, g.positionOther)],
      ['Date', date(g.date)],
      ['Authorized signature', signature(declarationSignature)],
      ['Company stamp', signature(companyStamp)]
    ])]),

    section('H. Internal Use Only', [
      fields([
        ['Risk classification', enumText(h.riskClassification)],
        ['Due diligence type', enumText(h.dueDiligenceType)]
      ]),
      subheading('AML Supervisor'),
      // The AML Supervisor name and signature are no longer captured in the KYC form.
      fields([
        ['Date', date(h.amlDate)],
      ['Comments', text(payload.amlComments || h.amlClarificationFindings)]
      ]),
      subheading('DMLRO'),
      fields([
        ['Name', text(h.dmlroName)],
        ['Date', date(h.dmlroDate)],
        ['Signature', signature(dmlroSignature)],
        ['Risk classification', enumText(h.dmlroRiskClassification)],
        ['Decision', decisionText(h.dmlroDecision)],
        ['Conditions', text(h.dmlroConditions)],
        ['Reason', text(h.dmlroReason)],
        ['Comments', text(h.dmlroComments)]
      ]),
      subheading('MLRO'),
      fields([
        ['Name', text(h.mlroName)],
        ['Date', date(h.mlroDate)],
        ['Signature', signature(mlroSignature)],
        ['Final decision', decisionText(h.mlroDecision)],
        ['Final risk classification', enumText(h.mlroFinalRiskClassification || h.riskClassification)],
        ['Risk reason category', enumText(h.mlroRiskReasonCategory)],
        ['Risk explanation', text(h.mlroRiskExplanation)],
        ['Conditions', text(h.mlroConditions)],
        ['Comments', text(h.mlroComments)]
      ]),
      subheading('SEF'),
      fields([
        ['Name', text(h.sefName)],
        ['Date', date(h.sefDate)],
        ['Signature', signature(sefSignature)],
        ['Management decision', decisionText(h.sefDecision)],
        ['Conditions', text(h.sefConditions)],
        ['Comments', text(h.sefComments)]
      ])
    ])
  ];

  return {
    companyName,
    kycNumber: text(a.reference),
    documentVersion,
    generatedAt: generatedAt.toISOString(),
    blocks
  };
}
