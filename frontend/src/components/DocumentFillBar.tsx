import { FileScan, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FillOutcome } from '../utils/document-fill';

type Option = { value: string; label: string };

type Props = {
  label: string;
  // Document kinds to choose from (for example Passport / QID). One option shows no chooser.
  options: Option[];
  onRead: (file: File, kind: string) => Promise<FillOutcome>;
  disabled?: boolean;
  hint?: string;
};

// "Fill from a copy": the user picks a file, the server reads it and the form fills in what was found. The note
// below says what was filled and what to check; nothing is saved until the form is saved.
export function DocumentFillBar({ label, options, onRead, disabled = false, hint }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState(options[0]?.value || '');
  const [reading, setReading] = useState(false);
  const [outcome, setOutcome] = useState<FillOutcome | null>(null);

  async function read(file: File) {
    setReading(true);
    setOutcome(null);
    try {
      setOutcome(await onRead(file, kind));
    } catch {
      setOutcome({ tone: 'warn', text: 'The copy could not be read. Enter the details from the document.' });
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="min-w-0" style={{ gridColumn: '1 / -1' }}>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
        <FileScan className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="text-sm text-slate-700">{label}</span>
        {options.length > 1 ? (
          <select aria-label="Document type to read" className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={kind} onChange={(event) => setKind(event.target.value)} disabled={reading || disabled}>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ) : null}
        <button type="button" disabled={reading || disabled} onClick={() => fileRef.current?.click()} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-60">
          {reading ? <><Loader2 className="h-4 w-4 animate-spin" />Reading...</> : 'Upload and read'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void read(file); }} />
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      {outcome ? <FillNote outcome={outcome} onChange={setOutcome} /> : null}
    </div>
  );
}

// What was filled from a copy, with the optional follow-up (for example "Use the document values").
export function FillNote({ outcome, onChange }: { outcome: FillOutcome; onChange: (outcome: FillOutcome) => void }) {
  return (
    <p role="status" className={`mt-1.5 text-xs ${outcome.tone === 'ok' ? 'text-teal-800' : 'text-amber-800'}`}>
      {outcome.text}
      {outcome.action ? (
        <button type="button" className="ml-2 font-semibold underline" onClick={() => onChange({ tone: 'ok', text: outcome.action!.run() })}>
          {outcome.action.label}
        </button>
      ) : null}
    </p>
  );
}
