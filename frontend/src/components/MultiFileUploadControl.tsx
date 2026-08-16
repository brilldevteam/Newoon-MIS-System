import { FileText, Upload } from 'lucide-react';
import { useRef } from 'react';

type MultiFileUploadControlProps = {
  names?: string[];
  disabled?: boolean;
  multiple?: boolean;
  accept?: string;
  buttonLabel?: string;
  placeholder?: string;
  onSelect: (files: File[]) => void;
};

export function MultiFileUploadControl({
  names = [],
  disabled = false,
  multiple = true,
  accept,
  buttonLabel = 'Upload',
  placeholder = 'No file selected',
  onSelect
}: MultiFileUploadControlProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const visibleNames = names.filter(Boolean);
  const summary =
    visibleNames.length === 0
      ? placeholder
      : visibleNames.length === 1
        ? visibleNames[0]
        : `${visibleNames.length} files selected`;

  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(140px,220px)_minmax(0,1fr)]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        {buttonLabel}
      </button>
      <div
        className={`flex h-10 min-w-0 items-center rounded-md border px-3 text-sm ${
          visibleNames.length ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-slate-300 bg-slate-50 text-slate-500'
        }`}
        title={visibleNames.join(', ')}
      >
        <span className="truncate">{summary}</span>
      </div>
      {visibleNames.length > 1 ? (
        <div className="sm:col-start-2">
          <div className="max-h-24 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
            <div className="flex flex-wrap gap-1.5">
              {visibleNames.map((name, index) => (
                <span
                  key={`${name}-${index}`}
                  title={name}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="max-w-56 truncate">{name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          if (files.length) onSelect(files);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}
