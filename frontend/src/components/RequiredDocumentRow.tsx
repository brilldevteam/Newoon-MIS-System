import { CheckCircle2, Circle, FileText, Loader2, Trash2, Upload, X } from 'lucide-react';
import { ReactNode, useRef, useState } from 'react';
import { STANDARD_DOCUMENT_ACCEPT, validateStandardDocuments } from '../utils/upload-security';

type Props = {
  title: string;
  names: string[];
  // Ticked when the document was received (a paper copy, or uploaded files).
  received?: boolean;
  // Leave out for rows that have no "received" tick (additional documents).
  onReceived?: (value: boolean) => void;
  busy?: boolean;
  busyLabel?: string;
  onUpload: (files: File[]) => void;
  onRemoveName: (index: number) => void;
  // Removes the whole row (additional documents).
  onDelete?: () => void;
  onError: (message: string) => void;
  // Extra lines under the files: who the copies belong to, what reading the document filled in.
  children?: ReactNode;
};

// One document of the checklist: status, name, the files uploaded so far and an Upload button. Files can also be
// dropped anywhere on the row. The formats are shown once above the list, not on every row.
export function RequiredDocumentRow({ title, names, received = false, onReceived, busy = false, busyLabel, onUpload, onRemoveName, onDelete, onError, children }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const done = received || names.length > 0;

  function choose(files: File[]) {
    if (!files.length) return;
    const problem = validateStandardDocuments(files);
    onError(problem);
    if (!problem) onUpload(files);
  }

  return (
    <li
      onDragOver={(event) => { if (!busy) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) choose(Array.from(event.dataTransfer.files)); }}
      className={`min-w-0 rounded-lg border bg-white px-4 py-3 transition-colors ${dragging ? 'border-brand-400 bg-brand-50/50 ring-2 ring-brand-200' : done ? 'border-emerald-200' : 'border-slate-200'}`}
      aria-busy={busy}
    >
      <div className="flex flex-wrap items-center gap-3">
        {done ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-600" /> : <Circle aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-300" />}
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="text-xs text-slate-500">
            {names.length ? `${names.length} file${names.length === 1 ? '' : 's'} uploaded` : received ? 'Marked as received' : dragging ? 'Drop to upload' : 'Not provided yet'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onReceived ? (
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <input type="checkbox" checked={received} onChange={(event) => onReceived(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Received
            </label>
          ) : null}
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70">
            {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Upload aria-hidden="true" className="h-4 w-4" />}
            {busy ? busyLabel || 'Uploading...' : names.length ? 'Add files' : 'Upload'}
          </button>
          {onDelete ? (
            <button type="button" onClick={onDelete} aria-label={`Remove ${title}`} title={`Remove ${title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          ) : null}
        </div>
      </div>
      {names.length ? (
        <ul className="mt-2.5 flex flex-wrap gap-2 pl-8">
          {names.map((name, index) => (
            <li key={`${name}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-2.5 pr-1.5 text-xs font-medium text-slate-700">
              <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="max-w-64 truncate" title={name}>{name}</span>
              <button type="button" onClick={() => onRemoveName(index)} aria-label={`Remove ${name}`} title={`Remove ${name}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      ) : null}
      {children ? <div className="mt-2 pl-8">{children}</div> : null}
      <input ref={inputRef} type="file" multiple accept={STANDARD_DOCUMENT_ACCEPT} className="hidden" onChange={(event) => { const files = Array.from(event.target.files || []); event.currentTarget.value = ''; choose(files); }} />
    </li>
  );
}
