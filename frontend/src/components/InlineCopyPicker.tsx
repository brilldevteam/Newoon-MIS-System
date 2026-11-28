import { CheckCircle2, Eye, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { FillNote } from './DocumentFillBar';
import type { FillOutcome } from '../utils/document-fill';

type Option = { value: string; label: string };

type Props = {
  // "QID" or "passport": named on the buttons.
  label: string;
  onRead: (file: File) => Promise<FillOutcome>;
  // The copies of this person's document that came with the enquiry; View opens one in a new tab.
  attached?: Option[];
  onView?: (id: string) => Promise<void>;
  disabled?: boolean;
};

// Sits directly under the QID / passport number field: upload a copy, or pick one that is already attached. The
// document is read into the person's fields; nothing is saved until the form is saved.
export function InlineCopyPicker({ label, onRead, attached = [], onView, disabled = false }: Props) {
  const [viewing, setViewing] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [outcome, setOutcome] = useState<FillOutcome | null>(null);

  async function run(name: string, task: () => Promise<FillOutcome>) {
    setBusy(true);
    setOutcome(null);
    try {
      setOutcome(await task());
    } catch {
      setOutcome({ tone: 'warn', text: 'The copy could not be read. Enter the details above.' });
    } finally {
      setDone(name);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="min-w-0" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || disabled} onClick={() => inputRef.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {busy ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Upload aria-hidden="true" className="h-3.5 w-3.5" />}
          {busy ? 'Reading...' : done ? `Replace ${label} copy` : `Upload ${label} copy`}
        </button>
        {onView ? attached.map((option) => (
          <button key={option.value} type="button" disabled={viewing === option.value} onClick={async () => { setViewing(option.value); try { await onView(option.value); } finally { setViewing(''); } }} title={option.label} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {viewing === option.value ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5" />}
            {attached.length > 1 ? `View ${option.label}` : `View ${label} copy`}
          </button>
        )) : null}
        {done && !busy ? <span className="inline-flex max-w-full items-center gap-1 text-xs font-medium text-emerald-800"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{done}</span></span> : null}
      </div>
      {outcome ? <FillNote outcome={outcome} onChange={setOutcome} /> : null}
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(file.name, () => onRead(file)); }} />
    </div>
  );
}
