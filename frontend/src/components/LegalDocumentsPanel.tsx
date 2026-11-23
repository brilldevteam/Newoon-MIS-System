import { Building2, CheckCircle2, Eye, FileText, History, Info, LoaderCircle, Pencil, Plus, RefreshCw, ScanLine, Sparkles, Trash2, User, X } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../services/api';
import {
  addClientPerson,
  addPersonRole,
  ClientEntity,
  ClientPerson,
  ComplianceClientDetail,
  EntityField,
  linkKycIdentityDocument,
  personKey,
  PersonRoleType,
  readIdentityDocument,
  updateEntityField,
  uploadIdentityDocument,
  viewClientDocument
} from '../services/compliance-clients.service';
import {
  createLegalDocument,
  DocumentReading,
  getLegalDocuments,
  IdentityRegisterRow,
  kycDocumentAsFile,
  LegalDocument,
  LegalDocumentRegister,
  LegalDocumentTypeKey,
  openLegalDocumentFile,
  readLegalDocument,
  removeLegalDocument,
  updateLegalDocument
} from '../services/legal-documents.service';
import { LegalDocument as KycLegalDocument, viewLegalDocument } from '../services/kyc-workflow.service';
import { STANDARD_DOCUMENT_ACCEPT } from '../utils/upload-security';
import { ExpiryBadge } from './IdentityDocumentsBlock';
import { TypedDateInput } from './TypedDateInput';
import { useToast } from './ToastProvider';

// Legal documents register of a compliance client (requirements L01-L09). One table for company documents,
// individual documents and the QID / passports kept on each person. Operations and AML can add, replace and remove
// documents; the AML team is notified of every change. Reading a file fills the form; staff check before saving.

type KycDocument = ComplianceClientDetail['legalDocuments'][number];
type Row =
  | { kind: 'document'; key: string; document: LegalDocument }
  | { kind: 'identity'; key: string; identity: IdentityRegisterRow };

type Preset = { typeKey?: LegalDocumentTypeKey; personId?: string; passportId?: string; replaces?: LegalDocument; kycDocument?: KycDocument };

export type LegalDocumentsContext = {
  clientId: string;
  canEdit: boolean;
  canEditProfile: boolean;
  canOpenKyc: boolean;
  company: ClientEntity;
  people: ClientPerson[];
  kycDocuments: KycDocument[];
  kycNumbers: Record<string, string>;
  register: LegalDocumentRegister | null;
  registerError: string;
  onRegister: (next: LegalDocumentRegister) => void;
  onProfile: (next: ComplianceClientDetail) => void;
  openPerson: (personId: string) => void;
};

const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${className}`}>{children}</span>;
}

function NatureBadge({ nature }: { nature: 'COMPANY' | 'INDIVIDUAL' }) {
  return nature === 'COMPANY'
    ? <Badge className="bg-teal-50 text-teal-700 ring-teal-200"><Building2 className="h-3 w-3" />Company</Badge>
    : <Badge className="bg-slate-100 text-slate-700 ring-slate-200"><User className="h-3 w-3" />Individual</Badge>;
}

export function LegalDocumentsPanel({ context }: { context: LegalDocumentsContext }) {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<'ALL' | 'COMPANY' | 'INDIVIDUAL'>('ALL');
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState<Preset | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const register = context.register;

  const rows: Row[] = useMemo(() => {
    if (!register) return [];
    const documents: Row[] = register.documents.filter((document) => document.status === 'CURRENT').map((document) => ({ kind: 'document', key: document.id, document }));
    const identity: Row[] = register.identity.map((item) => ({ kind: 'identity', key: item.key, identity: item }));
    const nature = (row: Row) => (row.kind === 'document' ? row.document.nature : 'INDIVIDUAL');
    const holder = (row: Row) => (row.kind === 'document' ? row.document.holderName : row.identity.holderName);
    return [...documents, ...identity]
      .filter((row) => filter === 'ALL' || nature(row) === filter)
      .sort((a, b) => (nature(a) === nature(b) ? holder(a).localeCompare(holder(b)) : nature(a) === 'COMPANY' ? -1 : 1));
  }, [register, filter]);
  const history = register?.documents.filter((document) => document.status !== 'CURRENT') || [];
  const inRegister = new Set(register?.documents.filter((document) => document.status === 'CURRENT').map((document) => document.sourceKycDocumentId).filter(Boolean));

  async function remove(document: LegalDocument) {
    const reason = window.prompt(`Remove ${document.typeLabel}${document.documentNumber ? ` no. ${document.documentNumber}` : ''} from the register? Give the reason (the AML team is notified; the record is kept in the history).`);
    if (reason === null) return;
    if (!reason.trim()) {
      showToast('A reason is required to remove a document.', 'error');
      return;
    }
    setBusy(document.id);
    try {
      context.onRegister(await removeLegalDocument(context.clientId, document.id, reason.trim()));
      showToast('Document removed. The AML team has been notified.', 'success');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to remove the document.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function view(row: Row) {
    try {
      if (row.kind === 'document') await openLegalDocumentFile(context.clientId, { id: row.document.id, mimeType: row.document.mimeType, fileName: row.document.fileName });
      else if (row.identity.copy) await viewClientDocument(context.clientId, row.identity.copy);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to open this document.'), 'error');
    }
  }

  if (context.registerError) return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{context.registerError}</p>;
  if (!register) return <p className="text-sm text-slate-500">Loading legal documents...</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Legal documents</h2>
            <p className="text-xs text-slate-500">Company and individual documents with their number, name, nationality / location and expiry. Expiry dates appear on the Expiry tab. Every change is sent to the AML team.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Show" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="ALL">All documents</option>
              <option value="COMPANY">Company</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={showHistory} onChange={(event) => setShowHistory(event.target.checked)} />History ({history.length})
            </label>
            {context.canEdit ? (
              <button type="button" onClick={() => setForm({})} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
                <Plus className="h-4 w-4" />Add document
              </button>
            ) : null}
          </div>
        </div>
        {form ? (
          <div className="border-b border-slate-200 p-4">
            <DocumentForm context={context} preset={form} onDone={() => setForm(null)} />
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Document type</th>
                <th className="px-3 py-2">Nature</th>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Nationality / location</th>
                <th className="px-3 py-2">Expiry date</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? rows.map((row) => {
                const item = row.kind === 'document' ? row.document : row.identity;
                const hasFile = row.kind === 'document' ? Boolean(row.document.fileName) : Boolean(row.identity.copy);
                return [
                  <tr key={row.key} className="align-top">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{item.typeLabel}</p>
                      {row.kind === 'document' && row.document.readMethod === 'AI' ? <p className="text-[11px] text-violet-600">Filled by AI reading</p> : null}
                      {!hasFile ? <p className="text-[11px] text-amber-700">No copy uploaded</p> : null}
                    </td>
                    <td className="px-3 py-2.5"><NatureBadge nature={item.nature} /></td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-800">{item.documentNumber || '--'}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-slate-900">{item.holderName}</p>
                      {(row.kind === 'identity' ? row.identity.personRoles : row.document.personRoles) ? <p className="text-xs text-slate-500">{row.kind === 'identity' ? row.identity.personRoles : row.document.personRoles}</p> : null}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{item.location || '--'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {item.expiryDate ? <div className="space-y-1"><p className="text-slate-800">{formatDate(item.expiryDate)}</p><ExpiryBadge expiry={item.expiryDate} /></div> : <span className="text-slate-400">--</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {hasFile ? (
                          <button type="button" onClick={() => view(row)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" />View</button>
                        ) : null}
                        {row.kind === 'document' && context.canEdit ? (
                          <>
                            <button type="button" onClick={() => setEditing(editing === row.key ? null : row.key)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Edit</button>
                            <button type="button" onClick={() => setForm({ typeKey: row.document.typeKey, personId: row.document.personId || undefined, replaces: row.document })} className="inline-flex items-center gap-1 rounded-md border border-brand-200 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"><RefreshCw className="h-3.5 w-3.5" />Replace</button>
                            <button type="button" disabled={busy === row.key} onClick={() => remove(row.document)} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" />Remove</button>
                          </>
                        ) : null}
                        {row.kind === 'identity' ? (
                          <>
                            {context.canEdit ? (
                              <button type="button" onClick={() => setForm({ typeKey: row.identity.typeKey, personId: row.identity.personId, passportId: row.identity.passportId || undefined })} className="inline-flex items-center gap-1 rounded-md border border-brand-200 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"><RefreshCw className="h-3.5 w-3.5" />Replace copy</button>
                            ) : null}
                            <button type="button" onClick={() => context.openPerson(row.identity.personId)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"><User className="h-3.5 w-3.5" />Person</button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>,
                  row.kind === 'document' && editing === row.key ? (
                    <tr key={`${row.key}-edit`}><td colSpan={7} className="bg-slate-50 px-4 py-3"><EditDocumentForm context={context} document={row.document} onDone={() => setEditing(null)} /></td></tr>
                  ) : null
                ];
              }) : (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No legal documents yet. Add them here, or from the KYC uploads below.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {showHistory ? (
          <div className="border-t border-slate-200 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><History className="h-3.5 w-3.5" />Replaced and removed documents</p>
            {history.length ? (
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {history.map((document) => (
                  <li key={document.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="font-medium text-slate-800">{document.typeLabel}</span>
                      <span className="text-slate-500"> · {document.documentNumber || 'no number'} · {document.holderName}{document.expiryDate ? ` · expired/expires ${formatDate(document.expiryDate)}` : ''}</span>
                      <span className="block text-xs text-slate-500">{document.status === 'REPLACED' ? 'Replaced' : 'Removed'} {formatDate(document.statusChangedAt)}{document.statusReason ? ` · ${document.statusReason}` : ''}</span>
                    </span>
                    {document.fileName ? (
                      <button type="button" onClick={() => view({ kind: 'document', key: document.id, document })} className="self-start text-xs font-medium text-brand-700 hover:text-brand-800 sm:self-auto">View</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-slate-500">No earlier documents.</p>}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Files uploaded with the KYC</h2>
          <p className="text-xs text-slate-500">Add them to the register to record their number, name and expiry. The KYC file itself is not changed.</p>
        </div>
        <div className="p-4">
          {context.kycDocuments.length ? (
            <ul className="divide-y divide-slate-100">
              {context.kycDocuments.map((document) => (
                <li key={document.id} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{document.documentType}</p>
                      <p className="break-all text-xs text-slate-500">{document.fileName} · {formatDate(document.createdAt)} · {context.kycNumbers[document.kycCaseId] || 'KYC'}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5 self-start sm:self-auto">
                    {inRegister.has(document.id) ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200"><CheckCircle2 className="h-3 w-3" />In register</Badge> : null}
                    {context.canOpenKyc ? (
                      <button type="button" onClick={() => viewLegalDocument(document.kycCaseId, { ...document, status: 'UPLOADED' } as KycLegalDocument).catch((error) => showToast(getApiErrorMessage(error, 'Unable to open this document.'), 'error'))} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">View</button>
                    ) : null}
                    {context.canEdit && context.canOpenKyc ? (
                      <button type="button" onClick={() => setForm({ kycDocument: document, typeKey: guessType(document.documentType) })} className="inline-flex items-center gap-1 rounded-md border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"><Plus className="h-3.5 w-3.5" />Add to register</button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">No files were uploaded with this client's KYC.</p>}
        </div>
      </section>
    </div>
  );
}

// A KYC document type name to the register type it most likely is.
function guessType(name: string): LegalDocumentTypeKey | undefined {
  const value = name.toLowerCase();
  if (value.includes('passport')) return 'PASSPORT';
  if (/\bqid\b|identity proof/.test(value)) return 'QID';
  if (value.includes('national address')) return 'NATIONAL_ADDRESS';
  if (value.includes('computer card') || value.includes('entity card')) return 'COMPUTER_CARD';
  if (value.includes('tax')) return 'TAX_CARD';
  if (value.includes('articles')) return 'ARTICLES';
  if (value.includes('incorporation')) return 'CERT_INCORPORATION';
  if (value.includes('audited')) return 'AUDITED_FS';
  if (value.includes('licen')) return 'COMMERCIAL_LICENSE';
  if (value.includes('commercial registration') || /\bcr\b/.test(value)) return 'CR_EXTRACT_EN';
  if (value.includes('power of attorney')) return 'POWER_OF_ATTORNEY';
  return undefined;
}

const COMPANY_FIELD_LABELS: Record<string, string> = {
  legalName: 'Legal name', commercialRegistrationNo: 'CR / QFC number', dateOfIncorporation: 'Date of incorporation', crExpiryDate: 'CR expiry date',
  countryOfIncorporation: 'Country of incorporation', placeOfIncorporation: 'Place of incorporation', legalForm: 'Legal form',
  registeredOfficeAddress: 'Registered office address', shareCapital: 'Share capital', taxIdentificationNo: 'Tax card no. (TIN)', licenseActivities: 'Licensed activities'
};

type PersonChoice = { include: boolean; fullName: string; nationality: string | null; roles: PersonRoleType[]; percentage: string | null; existingId: string | null };

function DocumentForm({ context, preset, onDone }: { context: LegalDocumentsContext; preset: Preset; onDone: () => void }) {
  const { showToast } = useToast();
  const types = context.register?.types || [];
  const [typeKey, setTypeKey] = useState<LegalDocumentTypeKey | ''>(preset.typeKey || '');
  const type = types.find((item) => item.key === typeKey) || null;
  const [typeLabel, setTypeLabel] = useState('');
  const [nature, setNature] = useState<'COMPANY' | 'INDIVIDUAL'>('COMPANY');
  const [personId, setPersonId] = useState(preset.personId || '');
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState({
    documentNumber: preset.replaces?.documentNumber || '', holderName: preset.replaces?.holderName || '', location: preset.replaces?.location || '',
    issueDate: '', expiryDate: '', notes: ''
  });
  const [filled, setFilled] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [readResult, setReadResult] = useState<DocumentReading | null>(null);
  const [companyChecks, setCompanyChecks] = useState<Record<string, boolean>>({});
  const [peopleChoices, setPeopleChoices] = useState<PersonChoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const identity = type?.personIdentity;
  const effectiveNature = type ? (type.key === 'OTHER' ? nature : type.nature) : 'COMPANY';
  const individuals = context.people.filter((person) => person.partyType === 'INDIVIDUAL');
  const person = context.people.find((item) => item.id === personId) || null;
  const passport = preset.passportId ? person?.passports.find((item) => item.id === preset.passportId) : null;

  // A KYC upload chosen with "Add to register": read it straight away.
  useEffect(() => {
    if (!preset.kycDocument || !typeKey) return;
    let cancelled = false;
    kycDocumentAsFile(preset.kycDocument.kycCaseId, preset.kycDocument)
      .then((kycFile) => { if (!cancelled) read(kycFile, typeKey); })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setFilled((current) => { const next = new Set(current); next.delete(key); return next; });
  }

  async function read(target: File, key: LegalDocumentTypeKey | '') {
    if (!key) return;
    setReading(true);
    setReadResult(null);
    try {
      const selected = types.find((item) => item.key === key);
      if (selected?.personIdentity) {
        const result = await readIdentityDocument(context.clientId, key as 'QID' | 'PASSPORT', target);
        if (result.found && result.typeMatches) {
          const next = new Set<string>();
          if (result.documentNumber) { setFields((current) => ({ ...current, documentNumber: result.documentNumber! })); next.add('documentNumber'); }
          if (result.expiryDate) { setFields((current) => ({ ...current, expiryDate: result.expiryDate! })); next.add('expiryDate'); }
          setFilled(next);
          setReadResult({ method: 'LOCAL', aiConfigured: false, message: 'Number and expiry read from the machine-readable lines. Check them against the document.', document: { documentNumber: result.documentNumber, holderName: result.nameOnDocument, location: result.nationality, issueDate: null, expiryDate: result.expiryDate }, company: {}, people: [] });
        } else {
          setReadResult({ method: 'NONE', aiConfigured: false, message: result.found ? 'This file does not look like the chosen document type.' : result.message, document: { documentNumber: null, holderName: null, location: null, issueDate: null, expiryDate: null }, company: {}, people: [] });
        }
        return;
      }
      const result = await readLegalDocument(context.clientId, key, target);
      setReadResult(result);
      const next = new Set<string>();
      setFields((current) => {
        const updated = { ...current };
        for (const field of ['documentNumber', 'holderName', 'location', 'issueDate', 'expiryDate'] as const) {
          const value = result.document[field];
          if (value) { updated[field] = value; next.add(field); }
        }
        return updated;
      });
      setFilled(next);
      // Company details that differ from the profile; empty profile values are ticked, changes are left for staff to tick.
      const checks: Record<string, boolean> = {};
      for (const [field, value] of Object.entries(result.company)) {
        const current = context.company[field as EntityField] || '';
        if (value && current.trim().toLowerCase() !== value.trim().toLowerCase()) checks[field] = !current;
      }
      setCompanyChecks(checks);
      // People listed on the document: link to someone already on the client where the name matches.
      setPeopleChoices(result.people.map((suggested) => {
        const existing = context.people.find((item) => personKey(item.fullName) === personKey(suggested.fullName)) || null;
        const roles = suggested.roles.filter((role) => !existing?.roles.some((held) => held.role === role)) as PersonRoleType[];
        return { include: roles.length > 0, fullName: suggested.fullName, nationality: suggested.nationality, roles, percentage: suggested.sharePercentage, existingId: existing?.id || null };
      }).filter((choice) => choice.roles.length));
    } catch (requestError) {
      setReadResult({ method: 'NONE', aiConfigured: false, message: getApiErrorMessage(requestError, 'The file could not be read. Enter the details from the document.'), document: { documentNumber: null, holderName: null, location: null, issueDate: null, expiryDate: null }, company: {}, people: [] });
    } finally {
      setReading(false);
    }
  }

  function chooseFile(next: File | null) {
    setFile(next);
    if (next) read(next, typeKey);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!type) return setError('Choose the document type.');
    if (type.key === 'OTHER' && !typeLabel.trim()) return setError('Enter the document name.');
    if ((identity || effectiveNature === 'INDIVIDUAL') && !personId) return setError('Choose the person this document belongs to.');
    if (!file && !preset.kycDocument) return setError('Choose the file: the copy of the document.');
    setSaving(true);
    setError('');
    try {
      let profile: ComplianceClientDetail | null = null;
      if (identity) {
        const idType = type.key as 'QID' | 'PASSPORT';
        profile = preset.kycDocument
          ? await linkKycIdentityDocument(context.clientId, { legalDocumentId: preset.kycDocument.id, personId, identityType: idType, passportId: preset.passportId })
          : await uploadIdentityDocument(context.clientId, { personId, identityType: idType, passportId: preset.passportId, documentNumber: fields.documentNumber, expiryDate: fields.expiryDate, file: file! });
        context.onRegister(await getLegalDocuments(context.clientId));
      } else {
        const next = await createLegalDocument(context.clientId, {
          typeKey: type.key, typeLabel: type.key === 'OTHER' ? typeLabel.trim() : undefined, nature: type.key === 'OTHER' ? nature : undefined,
          personId: personId || undefined, ...fields, replacesId: preset.replaces?.id, kycDocumentId: preset.kycDocument?.id,
          readMethod: readResult && readResult.method !== 'NONE' && filled.size ? readResult.method : 'MANUAL'
        }, preset.kycDocument ? null : file);
        context.onRegister(next);
      }
      // Ticked suggestions go through the normal audited profile edits.
      const applied: string[] = [];
      if (context.canEditProfile) {
        for (const [field, checked] of Object.entries(companyChecks)) {
          if (!checked || !readResult?.company[field as keyof DocumentReading['company']]) continue;
          profile = await updateEntityField(context.clientId, field as EntityField, readResult.company[field as keyof DocumentReading['company']]!);
          applied.push(COMPANY_FIELD_LABELS[field] || field);
        }
        for (const choice of peopleChoices.filter((item) => item.include && item.roles.length)) {
          let targetId = choice.existingId;
          let start = 0;
          if (!targetId) {
            profile = await addClientPerson(context.clientId, { partyType: 'INDIVIDUAL', fullName: choice.fullName, role: choice.roles[0], percentage: choice.roles[0] === 'SHAREHOLDER' ? choice.percentage || undefined : undefined });
            targetId = profile.profile.people.find((item) => personKey(item.fullName) === personKey(choice.fullName))?.id || null;
            start = 1;
          }
          for (const role of choice.roles.slice(start)) {
            if (targetId) profile = await addPersonRole(context.clientId, targetId, { role, percentage: role === 'SHAREHOLDER' ? choice.percentage || undefined : undefined });
          }
          applied.push(choice.fullName);
        }
      }
      if (profile) context.onProfile(profile);
      showToast(`${preset.replaces ? 'Document replaced' : 'Document added'}${applied.length ? `; profile updated: ${applied.join(', ')}` : ''}. The AML team has been notified.`, 'success');
      onDone();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to save the document.'));
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = (key: string) => `${inputClass} mt-1 ${filled.has(key) ? 'border-emerald-300 bg-emerald-50' : ''}`;
  const title = preset.replaces ? `Replace ${preset.replaces.typeLabel}` : preset.kycDocument ? `Add "${preset.kycDocument.fileName}" to the register` : identity && person ? `${type?.label} copy of ${person.fullName}` : 'Add a legal document';
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{preset.replaces ? 'The current document is kept in the history as replaced.' : 'Choose the type and the file; the details are read from the file where possible.'}</p>
        </div>
        <button type="button" onClick={onDone} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block text-xs font-medium text-slate-700">
          Document type *
          <select value={typeKey} disabled={saving || Boolean(preset.replaces) || Boolean(preset.passportId)} onChange={(event) => { setTypeKey(event.target.value as LegalDocumentTypeKey); if (file) read(file, event.target.value as LegalDocumentTypeKey); }} className={`${inputClass} mt-1`}>
            <option value="">Choose…</option>
            {types.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        {type?.key === 'OTHER' ? (
          <>
            <label className="block text-xs font-medium text-slate-700">Document name *<input value={typeLabel} maxLength={150} onChange={(event) => setTypeLabel(event.target.value)} className={`${inputClass} mt-1`} /></label>
            <label className="block text-xs font-medium text-slate-700">
              Nature
              <select value={nature} onChange={(event) => setNature(event.target.value as 'COMPANY' | 'INDIVIDUAL')} className={`${inputClass} mt-1`}>
                <option value="COMPANY">Company</option><option value="INDIVIDUAL">Individual</option>
              </select>
            </label>
          </>
        ) : null}
        {identity || effectiveNature === 'INDIVIDUAL' ? (
          <label className="block text-xs font-medium text-slate-700">
            Person *
            <select value={personId} disabled={saving || Boolean(preset.passportId)} onChange={(event) => setPersonId(event.target.value)} className={`${inputClass} mt-1`}>
              <option value="">Choose…</option>
              {individuals.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </select>
          </label>
        ) : null}
        {!preset.kycDocument ? (
          <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
            File *
            <input type="file" accept={STANDARD_DOCUMENT_ACCEPT} disabled={saving || reading || !typeKey} onChange={(event) => chooseFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs" />
            <span className="mt-0.5 block font-normal text-slate-500">{typeKey ? 'PDF or image files are read to fill the form.' : 'Choose the document type first.'}</span>
          </label>
        ) : null}
      </div>

      {reading ? <p className="flex items-center gap-1.5 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Reading the document…</p> : null}
      {readResult ? (
        <p className={`flex items-start gap-1.5 rounded-md px-3 py-2 text-xs ${readResult.method === 'AI' ? 'border border-violet-200 bg-violet-50 text-violet-800' : readResult.method === 'LOCAL' ? 'border border-emerald-200 bg-emerald-50 text-emerald-800' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>
          {readResult.method === 'AI' ? <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : readResult.method === 'LOCAL' ? <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>{readResult.message}{!readResult.aiConfigured && readResult.method !== 'AI' && !identity ? ' For scans, Arabic documents and the people listed on a CR, an administrator can set up AI document reading.' : ''}</span>
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="block text-xs font-medium text-slate-700">Number<input value={fields.documentNumber} maxLength={100} onChange={(event) => setField('documentNumber', event.target.value)} className={fieldClass('documentNumber')} /></label>
        {!identity ? (
          <>
            <label className="block text-xs font-medium text-slate-700">Name<input value={fields.holderName} maxLength={300} placeholder={effectiveNature === 'INDIVIDUAL' ? person?.fullName || '' : context.company.legalName || ''} onChange={(event) => setField('holderName', event.target.value)} className={fieldClass('holderName')} /></label>
            <label className="block text-xs font-medium text-slate-700">Nationality / location<input value={fields.location} maxLength={100} onChange={(event) => setField('location', event.target.value)} className={fieldClass('location')} /></label>
            <label className="block text-xs font-medium text-slate-700">Issue date<TypedDateInput value={fields.issueDate} onChange={(value) => setField('issueDate', value)} className={fieldClass('issueDate')} /></label>
          </>
        ) : null}
        <label className="block text-xs font-medium text-slate-700">Expiry date{type?.hasExpiry === false ? ' (none for this type)' : ''}<TypedDateInput value={fields.expiryDate} onChange={(value) => setField('expiryDate', value)} className={fieldClass('expiryDate')} /></label>
        {!identity ? <label className="block text-xs font-medium text-slate-700 sm:col-span-2 xl:col-span-1">Notes<input value={fields.notes} maxLength={1000} onChange={(event) => setField('notes', event.target.value)} className={`${inputClass} mt-1`} /></label> : null}
      </div>
      {identity && passport ? <p className="text-xs text-slate-500">This copy is for passport {passport.passportNumber}; a new number or expiry date updates that passport.</p> : null}

      {Object.keys(companyChecks).length && context.canEditProfile ? (
        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-700">Company details read from the document. Tick the ones to copy to the company profile:</p>
          <ul className="mt-2 space-y-1.5">
            {Object.entries(companyChecks).map(([field, checked]) => (
              <li key={field}>
                <label className="flex items-start gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={checked} onChange={(event) => setCompanyChecks((current) => ({ ...current, [field]: event.target.checked }))} className="mt-0.5" />
                  <span><span className="font-medium">{COMPANY_FIELD_LABELS[field] || field}:</span> {readResult?.company[field as keyof DocumentReading['company']]}
                    <span className="text-slate-400"> (now: {context.company[field as EntityField] || 'not captured'})</span></span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {peopleChoices.length && context.canEditProfile ? (
        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-700">People listed on the document. Tick the ones to add to the client (linked to the same person if already listed):</p>
          <ul className="mt-2 space-y-1.5">
            {peopleChoices.map((choice, index) => (
              <li key={`${choice.fullName}-${index}`}>
                <label className="flex items-start gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={choice.include} onChange={(event) => setPeopleChoices((current) => current.map((item, position) => (position === index ? { ...item, include: event.target.checked } : item)))} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{choice.fullName}</span>{choice.nationality ? ` (${choice.nationality})` : ''}: {choice.existingId ? 'add role' : 'new person as'} {choice.roles.map((role) => role.toLowerCase().replace(/_/g, ' ')).join(', ')}
                    {choice.percentage ? `, ${choice.percentage}%` : ''}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || reading} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{preset.replaces ? 'Replace' : 'Save'}
        </button>
        <button type="button" disabled={saving} onClick={onDone} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
      </div>
    </form>
  );
}

function EditDocumentForm({ context, document, onDone }: { context: LegalDocumentsContext; document: LegalDocument; onDone: () => void }) {
  const { showToast } = useToast();
  const [fields, setFields] = useState({
    documentNumber: document.documentNumber || '', holderName: document.holderName, location: document.location || '',
    issueDate: document.issueDate || '', expiryDate: document.expiryDate || '', notes: document.notes || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof fields, value: string) => setFields((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      context.onRegister(await updateLegalDocument(context.clientId, document.id, {
        documentNumber: fields.documentNumber || null, holderName: fields.holderName, location: fields.location || null,
        issueDate: fields.issueDate || null, expiryDate: fields.expiryDate || null, notes: fields.notes || null
      }));
      showToast('Document updated. The AML team has been notified.', 'success');
      onDone();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to update the document.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <label className="block text-xs font-medium text-slate-700">Number<input value={fields.documentNumber} maxLength={100} onChange={(event) => set('documentNumber', event.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="block text-xs font-medium text-slate-700">Name<input value={fields.holderName} maxLength={300} onChange={(event) => set('holderName', event.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="block text-xs font-medium text-slate-700">Nationality / location<input value={fields.location} maxLength={100} onChange={(event) => set('location', event.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="block text-xs font-medium text-slate-700">Issue date<TypedDateInput value={fields.issueDate} onChange={(value) => set('issueDate', value)} className={`${inputClass} mt-1`} /></label>
        <label className="block text-xs font-medium text-slate-700">Expiry date<TypedDateInput value={fields.expiryDate} onChange={(value) => set('expiryDate', value)} className={`${inputClass} mt-1`} /></label>
        <label className="block text-xs font-medium text-slate-700">Notes<input value={fields.notes} maxLength={1000} onChange={(event) => set('notes', event.target.value)} className={`${inputClass} mt-1`} /></label>
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Save
        </button>
        <button type="button" disabled={saving} onClick={onDone} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
      </div>
    </form>
  );
}
