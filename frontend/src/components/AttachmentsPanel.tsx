import { CheckCircle2, FileText, Loader2, Plus, Trash2, Upload, UserRound, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { FillNote } from './DocumentFillBar';
import { SearchableMultiSelect } from './SearchableSelect';
import { FillOutcome } from '../utils/document-fill';
import { STANDARD_DOCUMENT_ACCEPT, STANDARD_DOCUMENT_HINT, validateStandardDocuments } from '../utils/upload-security';

// Presentation of the enquiry Attachments step: one card per document with a drop zone and a clear status, and a
// people section where each person's QID / passport is uploaded and given their positions in the company.

type FileDropProps = {
  names: string[];
  label?: string;
  hint?: string;
  compact?: boolean;
  disabled?: boolean;
  // True while the file is uploading / being read: the zone shows a spinner and cannot take more files.
  busy?: boolean;
  onSelect: (files: File[]) => void;
  onRemoveName: (index: number) => void;
};

export function FileDrop({ names, label = 'Upload', hint = STANDARD_DOCUMENT_HINT, compact = false, disabled = false, busy = false, onSelect, onRemoveName }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);

  function accept(files: File[]) {
    if (!files.length || busy) return;
    const problem = validateStandardDocuments(files);
    setError(problem);
    if (!problem) onSelect(files);
  }

  return (
    <div className="min-w-0">
      <div
        aria-busy={busy}
        onDragOver={(event) => { if (disabled || busy) return; event.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => { event.preventDefault(); setOver(false); if (!disabled && !busy) accept(Array.from(event.dataTransfer.files || [])); }}
        className={`flex items-center gap-3 rounded-lg border border-dashed px-3 ${compact ? 'py-2' : 'py-3'} transition-colors ${busy ? 'border-sky-300 bg-sky-50' : over ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-slate-50/70'}`}
      >
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-sky-600" /> : <Upload aria-hidden="true" className="h-4 w-4" />}
          {busy ? 'Reading...' : names.length ? 'Add more' : label}
        </button>
        <span role="status" className={`min-w-0 text-xs leading-5 ${busy ? 'font-medium text-sky-700' : 'text-slate-500'}`}>{busy ? 'Uploading and reading the document. Please wait.' : names.length ? 'or drop more files here' : 'or drop files here'}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={STANDARD_DOCUMENT_ACCEPT}
          disabled={disabled}
          className="hidden"
          onChange={(event) => { accept(Array.from(event.target.files || [])); event.currentTarget.value = ''; }}
        />
      </div>
      {error ? <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
      {names.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {names.map((name, index) => (
            <li key={`${name}-${index}`} title={name} className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
              <FileText aria-hidden="true" className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="max-w-56 truncate">{name}</span>
              <button type="button" disabled={disabled} onClick={() => onRemoveName(index)} aria-label={`Remove ${name}`} title={`Remove ${name}`} className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hint ? <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function StatusBadge({ count }: { count: number }) {
  return count ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />{count === 1 ? 'Uploaded' : `${count} files`}</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Pending</span>
  );
}

type DocumentCardProps = {
  title: string;
  names: string[];
  reading?: boolean;
  note?: FillOutcome;
  onNote?: (outcome: FillOutcome) => void;
  removable?: boolean;
  onSelect: (files: File[]) => void;
  onRemoveName: (index: number) => void;
  onRemove: () => void;
};

export function DocumentCard({ title, names, reading = false, note, onNote, removable = false, onSelect, onRemoveName, onRemove }: DocumentCardProps) {
  return (
    <article className={`rounded-lg border bg-white p-3 shadow-sm ${names.length ? 'border-emerald-200' : 'border-slate-200'}`}>
      <header className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-semibold text-slate-900">{title}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge count={names.length} />
          {removable ? (
            <button type="button" onClick={onRemove} aria-label={`Remove ${title}`} title="Remove" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </header>
      <div className="mt-2.5">
        <FileDrop names={names} compact hint="" busy={reading} onSelect={onSelect} onRemoveName={onRemoveName} />
        {note && onNote ? <FillNote outcome={note} onChange={onNote} /> : null}
      </div>
    </article>
  );
}

export type AttachmentPerson = {
  id: string; fullName: string; qidNumber: string; passportNumber: string; dateOfBirth: string; nationality: string; ownershipPercentage: string; positions: string[];
  qidFiles: string[]; passportFiles: string[]; otherFiles: string[];
};

type PeopleProps = {
  people: AttachmentPerson[];
  positionOptions: string[];
  // "personId:KIND" of the copy being read.
  readingId: string;
  note?: FillOutcome;
  onNote: (outcome: FillOutcome | undefined) => void;
  onAddPerson: () => void;
  onRemovePerson: (personId: string) => void;
  onAddFiles: (personId: string, kind: 'QID' | 'PASSPORT', files: File[]) => void;
  onRemoveFile: (personId: string, fileName: string) => void;
  onName: (personId: string, name: string) => void;
  onPositions: (personId: string, positions: string[]) => void;
  contactNote?: string;
};

const plural = (position: string) => (position.endsWith('y') ? `${position.slice(0, -1)}ies` : `${position}s`);

// One compact upload slot of a person's row: an Upload button, or the file as a chip once added.
function FileSlot({ label, names, busy, onSelect, onRemoveName }: { label: string; names: string[]; busy: boolean; onSelect: (files: File[]) => void; onRemoveName: (index: number) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState('');
  return (
    <div className="min-w-0" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-1.5">
        {names.map((name, index) => (
          <span key={`${name}-${index}`} title={name} className="inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-32 truncate">{name}</span>
            <button type="button" onClick={() => onRemoveName(index)} aria-label={`Remove ${name}`} title={`Remove ${name}`} className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-emerald-700 hover:bg-white hover:text-red-600"><X aria-hidden="true" className="h-3 w-3" /></button>
          </span>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-label={`${names.length ? 'Add another' : 'Upload'} ${label} copy`}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold disabled:cursor-wait ${busy ? 'border-sky-300 bg-sky-50 text-sky-700' : names.length ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-dashed border-slate-300 text-slate-700 hover:bg-slate-50'}`}
        >
          {busy ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : names.length ? <Plus aria-hidden="true" className="h-3.5 w-3.5" /> : <Upload aria-hidden="true" className="h-3.5 w-3.5" />}
          {busy ? 'Reading...' : names.length ? '' : `Upload ${label}`}
        </button>
      </div>
      {error ? <p role="alert" className="mt-1 text-[11px] font-medium text-red-600">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={STANDARD_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          event.currentTarget.value = '';
          if (!files.length) return;
          const problem = validateStandardDocuments(files);
          setError(problem);
          if (!problem) onSelect(files);
        }}
      />
    </div>
  );
}

const ROW = 'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_2rem]';

export function PeopleDocuments({ people, positionOptions, readingId, note, onNote, onAddPerson, onRemovePerson, onAddFiles, onRemoveFile, onName, onPositions, contactNote }: PeopleProps) {
  const missingPositions = people.filter((person) => !person.positions.length).length;
  // "3 Shareholders · 2 UBOs": a quick check that everyone has been entered.
  const counts = positionOptions.map((position) => ({ position, count: people.filter((person) => person.positions.includes(position)).length })).filter((item) => item.count);
  const details = (person: AttachmentPerson) => [person.qidNumber && `QID ${person.qidNumber}`, person.passportNumber && `Passport ${person.passportNumber}`, person.nationality, person.ownershipPercentage && `${person.ownershipPercentage}%`, person.dateOfBirth && `DOB ${person.dateOfBirth}`].filter(Boolean).join(' · ');
  return (
    <section aria-labelledby="attachment-people" className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h3 id="attachment-people" className="text-sm font-semibold text-slate-900">People: QID / Passport copies</h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">One row per shareholder, UBO, director, manager or contact person. Upload their QID and passport and choose their positions; they are added to the KYC automatically.</p>
        </div>
        <button type="button" onClick={onAddPerson} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
          <Plus aria-hidden="true" className="h-4 w-4" />Add person
        </button>
      </header>
      {counts.length ? (
        <p aria-label="People by position" className="flex flex-wrap gap-1.5 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs">
          {counts.map((item) => <span key={item.position} className="rounded-full bg-white px-2.5 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200">{item.count} {item.count === 1 ? item.position : plural(item.position)}</span>)}
        </p>
      ) : null}
      {people.length ? (
        <div role="table" aria-label="People">
          <div role="row" className={`hidden gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid ${ROW}`}>
            <span role="columnheader">Person</span><span role="columnheader">QID copy</span><span role="columnheader">Passport copy</span><span role="columnheader">Position(s)</span><span role="columnheader" className="sr-only">Remove</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {people.map((person, index) => (
              <li key={person.id} role="row" className={`grid gap-x-3 gap-y-2 px-4 py-3 md:items-start ${ROW} ${person.positions.length ? '' : 'bg-amber-50/40'}`}>
                <div className="min-w-0" role="cell">
                  <input
                    key={`${person.id}-${person.fullName}`}
                    defaultValue={person.fullName}
                    onBlur={(event) => { if (event.target.value.trim() !== person.fullName) onName(person.id, event.target.value.trim()); }}
                    placeholder="Full name (from the document or type it)"
                    aria-label={`Full name of person ${index + 1}`}
                    className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-950 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  {details(person) ? <p className="mt-1 break-words text-[11px] leading-4 text-teal-800">{details(person)}</p> : null}
                  {person.otherFiles.length ? <p className="mt-1 break-words text-[11px] text-slate-500">Other copies: {person.otherFiles.join(', ')}</p> : null}
                </div>
                <div role="cell"><span className="mb-1 block text-[11px] font-semibold text-slate-500 md:hidden">QID copy</span>
                  <FileSlot label="QID" names={person.qidFiles} busy={readingId === `${person.id}:QID`} onSelect={(files) => onAddFiles(person.id, 'QID', files)} onRemoveName={(fileIndex) => onRemoveFile(person.id, person.qidFiles[fileIndex])} />
                </div>
                <div role="cell"><span className="mb-1 block text-[11px] font-semibold text-slate-500 md:hidden">Passport copy</span>
                  <FileSlot label="passport" names={person.passportFiles} busy={readingId === `${person.id}:PASSPORT`} onSelect={(files) => onAddFiles(person.id, 'PASSPORT', files)} onRemoveName={(fileIndex) => onRemoveFile(person.id, person.passportFiles[fileIndex])} />
                </div>
                <div role="cell" className="min-w-0"><span className="mb-1 block text-[11px] font-semibold text-slate-500 md:hidden">Position(s)</span>
                  <SearchableMultiSelect label="" value={person.positions} options={positionOptions} onChange={(value) => onPositions(person.id, value)} placeholder="Select positions" />
                </div>
                <div role="cell" className="flex justify-end md:justify-center">
                  <button type="button" onClick={() => onRemovePerson(person.id)} aria-label={`Remove person ${index + 1}`} title="Remove person" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"><Trash2 aria-hidden="true" className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button type="button" onClick={onAddPerson} className="m-4 flex w-[calc(100%-2rem)] flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-center hover:bg-slate-50">
          <UserRound aria-hidden="true" className="h-6 w-6 text-slate-400" />
          <span className="text-sm font-semibold text-slate-800">Add the first person</span>
          <span className="text-xs text-slate-500">Shareholders, UBOs, directors, managers and the contact person</span>
        </button>
      )}
      <div className="space-y-1 px-4 pb-3">
        {note ? <FillNote outcome={note} onChange={(outcome) => onNote(outcome)} /> : null}
        {missingPositions ? <p role="status" className="text-xs font-medium text-amber-700">{missingPositions === 1 ? 'One person has' : `${missingPositions} people have`} no position yet. Choose a position so they appear in the KYC.</p> : null}
        {contactNote ? <p role="status" className="text-xs font-medium text-amber-700">{contactNote}</p> : null}
      </div>
    </section>
  );
}
