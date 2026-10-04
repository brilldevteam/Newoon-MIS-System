import { useEffect, useState } from 'react';

type TypedDateInputProps = {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function formatDate(value?: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '';
}

function parseDate(value: string) {
  const normalized = value.trim();
  if (!normalized) return '';
  const match = /^(?:(\d{4})[-/](\d{1,2})[-/](\d{1,2})|(\d{1,2})[-/](\d{1,2})[-/](\d{4}))$/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1] || match[6]);
  const month = Number(match[2] || match[5]);
  const day = Number(match[3] || match[4]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function TypedDateInput({ value, onChange, disabled = false, className = '' }: TypedDateInputProps) {
  const [draft, setDraft] = useState(() => formatDate(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(formatDate(value));
    setInvalid(false);
  }, [value]);

  function commit() {
    const parsed = parseDate(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(parsed);
    setDraft(formatDate(parsed));
  }

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        value={draft}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        className={`${className} ${invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`.trim()}
      />
      {invalid ? <span className="mt-1 block text-xs font-normal text-red-600">Enter a valid date as DD/MM/YYYY.</span> : null}
    </>
  );
}
