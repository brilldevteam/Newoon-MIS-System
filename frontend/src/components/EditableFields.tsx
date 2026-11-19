import { Check, LoaderCircle, Pencil, X } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../services/api';
import { TypedDateInput } from './TypedDateInput';

export type EditKind = 'text' | 'longtext' | 'date' | 'email' | 'percent' | 'list' | 'select';

export type EditConfig = {
  kind: EditKind;
  // Current value as the editor should show it (YYYY-MM-DD for dates, comma-separated for lists).
  initial: string | null | undefined;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  maxLength?: number;
  hint?: string;
  onSave: (value: string | null) => Promise<void>;
};

export type EditableItem = {
  label: string;
  value: ReactNode;
  edit?: EditConfig | null;
  // Shows a small marker when the value was changed on the client page rather than taken from the KYC.
  edited?: boolean;
  wide?: boolean;
};

const inputClass = 'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

// Read-only grid of labelled values. Items with `edit` get a pencil icon that switches the value to an inline editor.
export function EditableFields({ items, columns = 3 }: { items: EditableItem[]; columns?: 2 | 3 }) {
  return (
    <dl className={`grid gap-x-6 gap-y-4 sm:grid-cols-2 ${columns === 3 ? 'xl:grid-cols-3' : ''}`}>
      {items.map((item) => <EditableFieldItem key={item.label} item={item} />)}
    </dl>
  );
}

function EditableFieldItem({ item }: { item: EditableItem }) {
  const [editing, setEditing] = useState(false);
  const empty = item.value === null || item.value === undefined || item.value === '';
  return (
    <div className={`group min-w-0 ${item.wide ? 'sm:col-span-2' : ''}`}>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        <span>{item.label}</span>
        {item.edited ? <span title="Changed on this page; the approved KYC keeps its original value" className="rounded bg-sky-50 px-1 text-[10px] font-semibold normal-case tracking-normal text-sky-700">edited</span> : null}
        {item.edit && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${item.label}`}
            title={`Edit ${item.label}`}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700 focus:text-brand-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </dt>
      <dd className="mt-1 break-words text-sm text-slate-900">
        {editing && item.edit ? (
          <InlineEditor label={item.label} config={item.edit} onDone={() => setEditing(false)} />
        ) : empty ? (
          <span className="text-slate-400">Not captured</span>
        ) : (
          item.value
        )}
      </dd>
    </div>
  );
}

function InlineEditor({ label, config, onDone }: { label: string; config: EditConfig; onDone: () => void }) {
  const [value, setValue] = useState(config.initial ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstInput = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);

  useEffect(() => {
    firstInput.current?.focus();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (config.required && !trimmed) {
      setError(`${label} cannot be empty.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await config.onSave(trimmed || null);
      onDone();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `Unable to save ${label.toLowerCase()}.`));
    } finally {
      setSaving(false);
    }
  }

  const common = { 'aria-label': label, disabled: saving };
  return (
    <form onSubmit={submit} onKeyDown={(event) => { if (event.key === 'Escape') onDone(); }} className="space-y-1.5">
      {config.kind === 'longtext' ? (
        <textarea {...common} ref={firstInput} rows={3} maxLength={config.maxLength ?? 2000} value={value} onChange={(event) => setValue(event.target.value)} className={inputClass} />
      ) : config.kind === 'select' ? (
        <select {...common} ref={firstInput} value={value} onChange={(event) => setValue(event.target.value)} className={inputClass}>
          {(config.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : config.kind === 'date' ? (
        <TypedDateInput value={value} onChange={setValue} disabled={saving} className={inputClass} />
      ) : (
        <input
          {...common}
          ref={firstInput}
          type={config.kind === 'email' ? 'email' : 'text'}
          inputMode={config.kind === 'percent' ? 'decimal' : undefined}
          maxLength={config.maxLength ?? 500}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={inputClass}
        />
      )}
      {config.hint ? <p className="text-xs text-slate-500">{config.hint}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex gap-1.5">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save
        </button>
        <button type="button" disabled={saving} onClick={onDone} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </form>
  );
}
