import { Check, ChevronDown, ChevronRight, FileSearch, Loader2, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CompanyTarget } from '../utils/document-fill';
import { getApiErrorMessage } from '../services/api';
import { automaticIntakeApplication, suggestedDocumentKind, validateIntakeFile } from '../utils/document-intake';
import type { IntakeApplication, IntakeKind, IntakeReading, IntakeTarget } from '../utils/document-intake';

type Job = {
  id: string; file: File; kind: IntakeKind;
  status: 'queued' | 'reading' | 'ready' | 'applying' | 'person' | 'applied' | 'failed';
  result?: IntakeReading; target?: string; error?: string; note?: string;
};
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
const statusText = { queued: 'Queued', reading: 'Reading', ready: 'Waiting to fill', applying: 'Filling form', person: 'Choose a person', applied: 'Filled in draft', failed: 'Needs attention' };

export function DocumentIntakePanel(props: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(true);
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
      if (!window.confirm('Some documents have not finished filling the form. Leave this page and discard the inbox?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', follow, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', follow, true); };
  }, [pending]);

  useEffect(() => {
    if (running.current || props.disabled) return;
    const job = jobs.find(item => item.status === 'ready') || jobs.find(item => item.status === 'queued');
    if (!job) return;
    running.current = true;
    const update = (change: Partial<Job>) => {
      if (mounted.current) setJobs(items => items.map(item => item.id === job.id ? { ...item, ...change } : item));
    };
    const process = async () => {
      if (!job.result) {
        update({ status: 'reading', error: '' });
        const result = await latest.current.read(job.file, job.kind);
        update({ status: 'ready', result });
        return;
      }
      const outcome = automaticIntakeApplication(job.result, { ...latest.current, file: job.file, target: job.target });
      if (!outcome.application) { update({ status: 'person', note: outcome.note }); return; }
      update({ status: 'applying', error: '' });
      await latest.current.apply(outcome.application);
      update({ status: 'applied', note: outcome.note });
    };
    process().catch(error => update({ status: 'failed', error: error instanceof Error && !('response' in error) ? error.message : getApiErrorMessage(error, 'The document could not be processed. Retry this file or enter missing details manually.') }))
      .finally(() => { running.current = false; if (mounted.current) setJobs(items => [...items]); });
  }, [jobs, props.disabled]);

  // A later company document may add the person needed by an earlier identity document.
  useEffect(() => {
    if (props.disabled || !jobs.some(job => job.status === 'person' && job.result)) return;
    const resolved = jobs.filter(job => job.status === 'person' && job.result && automaticIntakeApplication(job.result, { ...props, file: job.file }).application).map(job => job.id);
    if (resolved.length) setJobs(items => items.map(item => resolved.includes(item.id) && item.status === 'person' ? { ...item, status: 'ready' } : item));
  }, [props.targets, props.disabled, jobs]);

  function addFiles(files: File[]) {
    setNotice('');
    if (props.disabled) return;
    if (jobs.length + files.length > 20) { setNotice('Keep up to 20 files in the inbox. Remove completed files before adding more.'); return; }
    setJobs(items => {
      const next = [...items];
      for (const file of files) {
        if (next.length >= 20) break;
        if (next.some(job => job.file.name === file.name && job.file.size === file.size && job.file.lastModified === file.lastModified)) continue;
        const error = validateIntakeFile(file);
        next.push({ id: crypto.randomUUID(), file, kind: suggestedDocumentKind(file.name), status: error ? 'failed' : 'queued', error });
      }
      return next;
    });
    setOpen(true);
  }

  return <section aria-label="Document inbox" className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex items-center gap-2 text-left"><FileSearch className="h-5 w-5 text-brand-600" /><span className="font-semibold text-slate-950">Document inbox</span><span className="text-xs text-slate-500">{jobs.filter(job => job.status === 'applied').length} / {jobs.length} processed</span>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
      <button type="button" disabled={props.disabled} onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Plus className="h-4 w-4" />Add documents</button>
      <input ref={input} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" aria-label="Add documents to inbox" className="sr-only" disabled={props.disabled} onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
    </header>
    {open && <div className="border-t border-slate-200 p-4">
      <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm"><span className="inline-flex items-center gap-2 text-slate-600"><Upload className="h-4 w-4" />Drop documents here</span><span className="text-xs text-slate-500">PDF, PNG, JPEG, WebP | 10 MB each</span></div>
      {notice && <p role="alert" className="mt-3 text-sm text-red-700">{notice}</p>}
      <div aria-live="polite" className="divide-y divide-slate-100">
        {jobs.map(job => {
          const busy = job.status === 'reading' || job.status === 'applying';
          return <div key={job.id} className="flex min-w-0 flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1 basis-48"><p className="break-words text-sm font-medium text-slate-900">{job.file.name}</p><p className={`mt-1 flex items-center gap-1 text-xs ${job.status === 'failed' ? 'text-red-700' : job.status === 'applied' ? 'text-emerald-700' : 'text-slate-500'}`}>{busy && <Loader2 className="h-3 w-3 animate-spin" />}{job.status === 'applied' && <Check className="h-3 w-3" />}{statusText[job.status]}</p>{job.note && <p className="mt-1 break-words text-xs text-slate-500">{job.note}</p>}{job.error && <p className="mt-1 break-words text-xs text-red-700">{job.error}</p>}</div>
            <select aria-label={`Document type for ${job.file.name}`} disabled={props.disabled || busy || job.status === 'applied'} value={job.kind} onChange={event => setJobs(items => items.map(item => item.id === job.id ? { ...item, kind: event.target.value as IntakeKind, status: 'queued', result: undefined, target: '', error: '', note: '' } : item))} className="max-w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs">{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            {job.status === 'person' && <select aria-label={`Person for ${job.file.name}`} value="" disabled={props.disabled} onChange={event => setJobs(items => items.map(item => item.id === job.id ? { ...item, target: event.target.value, status: 'ready' } : item))} className="max-w-full rounded-md border border-amber-300 bg-white px-2 py-2 text-xs"><option value="">Assign to person</option>{props.targets.map(target => <option key={target.value} value={target.value}>{target.label}</option>)}</select>}
            {job.status === 'failed' && <button type="button" disabled={props.disabled || Boolean(validateIntakeFile(job.file))} title="Retry document" onClick={() => setJobs(items => items.map(item => item.id === job.id ? { ...item, status: item.result ? 'ready' : 'queued', error: '' } : item))} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-2 text-xs disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />Try again</button>}
            <button type="button" disabled={props.disabled || busy} aria-label={`Remove ${job.file.name}`} title="Remove from inbox" className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-40" onClick={() => setJobs(items => items.filter(item => item.id !== job.id))}><Trash2 className="h-4 w-4" /></button>
          </div>;
        })}
      </div>
    </div>}
  </section>;
}
