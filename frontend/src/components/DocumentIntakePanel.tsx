import { Check, ChevronDown, ChevronRight, FileSearch, Loader2, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CompanyTarget } from '../utils/document-fill';
import { getApiErrorMessage } from '../services/api';
import { intakeFields, suggestedDocumentKind, validateIntakeFile, validateReviewedPeople } from '../utils/document-intake';
import type { IntakeApplication, IntakeField, IntakeKind, IntakeReading, IntakeTarget } from '../utils/document-intake';
import type { SuggestedRole } from '../services/legal-documents.service';
import { suggestedPartyType } from '../utils/people-from-document';

type Job = { id: string; file: File; kind: IntakeKind; status: 'queued' | 'reading' | 'review' | 'applied' | 'failed'; result?: IntakeReading; error?: string };
type Props = {
  company: Record<string, unknown>;
  companyTargets: CompanyTarget[];
  targets: IntakeTarget[];
  peopleEnabled?: boolean;
  attachmentTypes?: { COMPANY: string[]; IDENTITY: string[] };
  disabled?: boolean;
  read: (file: File, kind: IntakeKind) => Promise<IntakeReading>;
  apply: (application: IntakeApplication) => Promise<void>;
};
const kinds: Array<[IntakeKind, string]> = [['AUTO', 'Detect type'], ['COMPANY', 'Company / ownership document'], ['PASSPORT', 'Passport'], ['QID', 'QID / residence permit']];
const statusText = { queued: 'Queued', reading: 'Reading', review: 'Needs review', applied: 'Applied to draft', failed: 'Needs attention' };
const roleOptions: Array<[SuggestedRole, string]> = [['SHAREHOLDER', 'Shareholder'], ['DIRECTOR', 'Director'], ['MANAGER', 'Manager'], ['AUTHORISED_SIGNATORY', 'Authorized signatory'], ['SECRETARY', 'Secretary'], ['CEO', 'CEO'], ['CHAIRMAN', 'Chairman'], ['MANAGING_DIRECTOR', 'Managing director'], ['GENERAL_MANAGER', 'General manager'], ['OTHER', 'Other']];

export function DocumentIntakePanel(props: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(true);
  const [reviewId, setReviewId] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const latest = useRef(props); latest.current = props;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const pending = jobs.some(job => job.status !== 'applied');
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const follow = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.download || anchor.href.startsWith('blob:') || anchor.href === location.href) return;
      if (!window.confirm('Documents in this inbox have not been applied. Leave this page and discard the inbox?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', follow, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', follow, true); };
  }, [pending]);
  useEffect(() => {
    if (running.current || props.disabled) return;
    const job = jobs.find(item => item.status === 'queued');
    if (!job) return;
    running.current = true;
    setJobs(items => items.map(item => item.id === job.id ? { ...item, status: 'reading', error: '' } : item));
    latest.current.read(job.file, job.kind).then(result => {
      if (mounted.current) setJobs(items => items.map(item => item.id === job.id ? { ...item, status: 'review', result } : item));
    }).catch(error => {
      if (mounted.current) setJobs(items => items.map(item => item.id === job.id ? { ...item, status: 'failed', error: error instanceof Error && !('response' in error) ? error.message : getApiErrorMessage(error, 'The document could not be read. Retry this file or enter the details manually.') } : item));
    }).finally(() => { running.current = false; if (mounted.current) setJobs(items => [...items]); });
  }, [jobs, props.disabled]);

  function addFiles(files: File[]) {
    setNotice('');
    if (props.disabled) return;
    if (jobs.length + files.length > 20) { setNotice('Keep up to 20 files in the inbox. Remove completed files before adding more.'); return; }
    setJobs(items => {
      const next = [...items];
      for (const file of files) {
        if (next.some(job => job.file.name === file.name && job.file.size === file.size && job.file.lastModified === file.lastModified)) continue;
        const error = validateIntakeFile(file);
        next.push({ id: crypto.randomUUID(), file, kind: suggestedDocumentKind(file.name), status: error ? 'failed' : 'queued', error });
      }
      return next;
    });
    setOpen(true);
  }
  const reviewing = jobs.find(job => job.id === reviewId);
  return <section aria-label="Document inbox" className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex items-center gap-2 text-left"><FileSearch className="h-5 w-5 text-brand-600" /><span className="font-semibold text-slate-950">Document inbox</span><span className="text-xs text-slate-500">{jobs.filter(job => job.status === 'review').length} to review</span>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
      <button type="button" disabled={props.disabled} onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Plus className="h-4 w-4" />Add documents</button>
      <input ref={input} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" aria-label="Add documents to inbox" className="sr-only" disabled={props.disabled} onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
    </header>
    {open && <div className="border-t border-slate-200 p-4">
      <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm"><span className="inline-flex items-center gap-2 text-slate-600"><Upload className="h-4 w-4" />Drop documents here</span><span className="text-xs text-slate-500">PDF, PNG, JPEG, WebP · 10 MB each</span></div>
      {notice && <p role="alert" className="mt-3 text-sm text-red-700">{notice}</p>}
      <div aria-live="polite" className="divide-y divide-slate-100">
        {jobs.map(job => <div key={job.id} className="flex min-w-0 flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1 basis-48"><p className="break-words text-sm font-medium text-slate-900">{job.file.name}</p><p className={`mt-1 flex items-center gap-1 text-xs ${job.status === 'failed' ? 'text-red-700' : job.status === 'applied' ? 'text-emerald-700' : 'text-slate-500'}`}>{job.status === 'reading' && <Loader2 className="h-3 w-3 animate-spin" />}{job.status === 'applied' && <Check className="h-3 w-3" />}{statusText[job.status]}</p>{job.error && <p className="mt-1 text-xs text-red-700">{job.error}</p>}</div>
          <select aria-label={`Document type for ${job.file.name}`} disabled={props.disabled || job.status === 'reading' || job.status === 'applied'} value={job.kind} onChange={event => setJobs(items => items.map(item => item.id === job.id ? { ...item, kind: event.target.value as IntakeKind, status: 'failed', result: undefined, error: 'Type changed. Read this file again.' } : item))} className="max-w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs">{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {job.status === 'review' && <button type="button" disabled={props.disabled} onClick={() => setReviewId(job.id)} className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Review</button>}
          {job.status === 'failed' && <button type="button" disabled={props.disabled || Boolean(validateIntakeFile(job.file))} title="Retry document" onClick={() => setJobs(items => items.map(item => item.id === job.id ? { ...item, status: 'queued', error: '' } : item))} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-2 text-xs disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />Read again</button>}
          <button type="button" disabled={props.disabled || job.status === 'reading'} aria-label={`Remove ${job.file.name}`} title="Remove from inbox" className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-40" onClick={() => setJobs(items => items.filter(item => item.id !== job.id))}><Trash2 className="h-4 w-4" /></button>
        </div>)}
      </div>
    </div>}
    {reviewing?.result && <IntakeReview key={reviewing.id} job={reviewing} {...props} onClose={() => setReviewId('')} onApplied={() => { setJobs(items => items.map(item => item.id === reviewing.id ? { ...item, status: 'applied' } : item)); setReviewId(''); }} />}
  </section>;
}

function IntakeReview({ job, company, companyTargets, targets, disabled, peopleEnabled = true, attachmentTypes, apply, onClose, onApplied }: Props & { job: Job; onClose: () => void; onApplied: () => void }) {
  const result = job.result!;
  const [target, setTarget] = useState('');
  const [expectedPerson, setExpectedPerson] = useState<Record<string, unknown>>();
  const [fields, setFields] = useState<IntakeField[]>(() => intakeFields(result, result.kind === 'COMPANY' ? company : {}, companyTargets));
  const [people, setPeople] = useState(() => result.kind === 'COMPANY' && peopleEnabled ? result.data.people.map(person => ({ ...person, roles: [...person.roles], selected: false, partyType: suggestedPartyType(person.fullName) })) : []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [documentType, setDocumentType] = useState(attachmentTypes?.[result.kind][0] || '');
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const url = URL.createObjectURL(job.file); setSourceUrl(url);
    close.current?.focus();
    const bodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { URL.revokeObjectURL(url); document.body.style.overflow = bodyOverflow; previous?.focus(); };
  }, [job.file]);
  function pickTarget(value: string) {
    setTarget(value); setChecked(false);
    const row = targets.find(item => item.value === value)?.row || {};
    setExpectedPerson({ ...row }); setFields(intakeFields(result, row, companyTargets).filter(field => !targets.find(item => item.value === value)?.omitFields?.includes(field.key)));
  }
  async function accept() {
    setBusy(true); setError('');
    try {
      validateReviewedPeople(people.filter(person => person.selected));
      await apply({ file: job.file, kind: result.kind, fields, people: people.filter(person => person.selected).map(({ selected: _selected, ...person }) => person), target, expectedPerson, documentType });
      onApplied();
    } catch (failure) { setError(failure instanceof Error && !('response' in failure) ? failure.message : getApiErrorMessage(failure, 'Unable to apply these details. No review was completed.')); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-2 sm:p-5" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose(); }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault();
    if (event.key === 'Tab') {
      const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),iframe');
      if (!nodes?.length) return;
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="document-review-title" className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4"><div className="min-w-0"><h2 id="document-review-title" className="text-lg font-semibold text-slate-950">Review document details</h2><p className="break-words text-xs text-slate-500">{job.file.name}</p></div><button ref={close} type="button" disabled={busy} onClick={onClose} aria-label="Close document review" className="p-2"><X className="h-5 w-5" /></button></header>
      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 border-b border-slate-200 bg-slate-100 p-3 lg:border-b-0 lg:border-r"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><a href={sourceUrl || undefined} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand-700">Open source document</a><button type="button" onClick={() => setSourceOpen(value => !value)} aria-expanded={sourceOpen} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 lg:hidden">{sourceOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}Source preview</button></div><div className={`${sourceOpen ? 'block' : 'hidden'} lg:block`}><SourceDocument file={job.file} url={sourceUrl} /></div></div>
        <div className="min-w-0 space-y-4 p-4">
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{result.kind === 'COMPANY' ? result.data.message : result.data.readFromText ? 'Read from printed labels; check every value against the source.' : 'Check the identity details against the source document.'}</p>
          {result.kind === 'COMPANY' && <p className="break-words text-xs font-medium text-slate-600">Company record: {String(company.legalName || company.companyName || company.proposedCompanyName || 'New client company')}</p>}
          {attachmentTypes && <label className="block text-sm font-medium text-slate-700">Save document under<select value={documentType} disabled={busy || disabled} onChange={event => { setDocumentType(event.target.value); setChecked(false); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2">{attachmentTypes[result.kind].map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
          {result.kind === 'IDENTITY' && <label className="block text-sm font-medium text-slate-700">Apply identity details to<select value={target} disabled={busy || disabled} onChange={event => pickTarget(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2"><option value="">Choose a person</option>{targets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
          <fieldset disabled={busy || disabled || (result.kind === 'IDENTITY' && !target)} className="space-y-3 disabled:opacity-50"><legend className="mb-2 text-sm font-semibold text-slate-900">{result.kind === 'COMPANY' ? 'Company details' : 'Identity details'}</legend>
            {fields.length === 0 && <p className="text-sm text-slate-500">No supported fields found. You can enter the details in the form.</p>}
            {fields.map((field, index) => <ReviewField key={field.key} field={field} onChange={change => { setChecked(false); setFields(items => items.map((item, i) => i === index ? { ...item, ...change } : item)); }} />)}
          </fieldset>
          {people.length > 0 && <div className="space-y-2 text-xs text-slate-600">{people.map((person, index) => {
            const matches = targets.filter(item => String(item.row.fullName || '').trim().toLowerCase() === person.fullName.trim().toLowerCase() || (person.idNumber && [item.row.qidNumber, item.row.passportNumber, item.row.identityNumber].some(number => number && String(number).replace(/\s+/g, '') === person.idNumber!.replace(/\s+/g, ''))));
            return <div key={index} className="space-y-2 rounded-md bg-slate-50 p-3"><p className="break-words">{person.fullName}. {matches.length ? `Possible existing person: ${matches.map(item => `${item.label}, ID ${item.row.identityNumber || item.row.qidNumber || item.row.passportNumber || 'not recorded'}, ownership ${item.row.shareholderPercentage ?? item.row.ownershipPercentage ?? 'not recorded'}`).join('; ')}. Matching rows keep existing values; only empty fields and confirmed roles are added.` : 'No matching person on this form.'}</p><div className="grid gap-2 sm:grid-cols-2"><label>Party type for {person.fullName}<select disabled={busy || disabled} value={person.partyType} onChange={event => { setChecked(false); setPeople(items => items.map((item, i) => i === index ? { ...item, partyType: event.target.value as 'INDIVIDUAL' | 'CORPORATE' } : item)); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2"><option value="INDIVIDUAL">Person</option><option value="CORPORATE">Company</option></select></label><label>Nationality / country for {person.fullName}<input disabled={busy || disabled} value={person.nationality || ''} onChange={event => { setChecked(false); setPeople(items => items.map((item, i) => i === index ? { ...item, nationality: event.target.value } : item)); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2" /></label></div></div>;
          })}</div>}
          {people.length > 0 && <fieldset disabled={busy || disabled} className="space-y-3"><legend className="mb-2 text-sm font-semibold">People found ({people.length})</legend>{people.map((person, index) => <div key={index} className="rounded-md border border-slate-200 p-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={person.selected} onChange={event => { setChecked(false); setPeople(items => items.map((item, i) => i === index ? { ...item, selected: event.target.checked } : item)); }} />Include person</label><input aria-label={`Person ${index + 1} name`} value={person.fullName} onChange={event => { setChecked(false); setPeople(items => items.map((item, i) => i === index ? { ...item, fullName: event.target.value } : item)); }} className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm" /><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-600">ID / CR number<input value={person.idNumber || ''} onChange={event => { setChecked(false); setPeople(items => items.map((item, i) => i === index ? { ...item, idNumber: event.target.value } : item)); }} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" /></label><label className="text-xs text-slate-600">Shareholder %<input type="number" min="0" max="100" step="any" value={person.sharePercentage || ''} onChange={event => { setChecked(false); setPeople(items => items.map((item, i) => i === index ? { ...item, sharePercentage: event.target.value } : item)); }} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" /></label></div><div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">{roleOptions.map(([role, label]) => <label key={role} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={person.roles.includes(role)} onChange={event => { setChecked(false); setPeople(items => items.map((item, i) => i === index ? { ...item, roles: event.target.checked ? [...item.roles, role] : item.roles.filter(value => value !== role) } : item)); }} />{label}</label>)}</div></div>)}</fieldset>}
          {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      </div>
      <footer className="space-y-3 border-t border-slate-200 bg-white p-4"><label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={checked} disabled={busy || disabled} onChange={event => setChecked(event.target.checked)} />I checked the selected details, roles and any matching people against this document.</label><div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Later</button><button type="button" disabled={busy || disabled || !checked || (result.kind === 'IDENTITY' && !target) || (!fields.some(field => field.selected && field.value.trim()) && !people.some(person => person.selected))} onClick={accept} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{busy ? 'Applying...' : 'Apply selected details'}</button></div></footer>
    </div>
  </div>;
}

function ReviewField({ field, onChange }: { field: IntakeField; onChange: (change: Partial<IntakeField>) => void }) {
  const changeValue = (value: string) => onChange({ value, patch: { [field.key]: value } });
  return <div className={`rounded-md border p-3 ${field.conflict || field.uncertain ? 'border-amber-300' : 'border-slate-200'}`}>
    <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" checked={field.selected} onChange={event => onChange({ selected: event.target.checked })} className="mt-1 accent-red-600" />{field.label}</label>
    {field.options ? <select aria-label={`Suggested ${field.label}`} value={field.value} onChange={event => changeValue(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm">{field.options.map(option => <option key={option} value={option}>{option || 'Select'}</option>)}</select> : <input aria-label={`Suggested ${field.label}`} value={field.value} onChange={event => changeValue(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" />}
    {field.conflict && <p className="mt-1 break-words text-xs text-amber-800">Existing: {Object.values(field.expected).filter(Boolean).join(' / ')}. Select this field only to replace it.</p>}
    {field.uncertain && <p className="mt-1 text-xs text-amber-800">Source checks need review. Compare this value with the document before selecting it.</p>}
  </div>;
}

function SourceDocument({ file, url }: { file: File; url: string }) {
  if (!url) return null;
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)
    ? <img src={url} alt="Uploaded source document" className="max-h-48 w-full object-contain lg:max-h-[60dvh]" />
    : <iframe src={url} title="Uploaded source document" className="h-64 w-full lg:h-[60dvh]" />;
}
