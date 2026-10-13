import { CalendarDays } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

// Formats typing into DD/MM/YYYY: "20032026" -> "20/03/2026", "1/3/2026" -> "1/3/2026".
// A separator is only added before the next digit, so backspace never gets stuck on a slash.
export function maskDateInput(raw: string) {
  // Leave ISO input (e.g. pasted "2026-03-20") untouched; it is parsed on commit.
  if (/^\s*\d{4}[-/.]/.test(raw)) return raw.trim().slice(0, 10);
  const parts = ['', '', ''];
  const limits = [2, 2, 4];
  let index = 0;
  for (const character of raw) {
    if (/\d/.test(character)) {
      if (parts[index].length >= limits[index]) {
        if (index === 2) break;
        index++;
      }
      parts[index] += character;
    } else if (parts[index] && index < 2) {
      // A typed separator closes a short day or month ("1/" -> day 1).
      index++;
    }
  }
  return parts.slice(0, index + 1).join('/');
}

export function TypedDateInput({ value, onChange, disabled = false, className = '' }: TypedDateInputProps) {
  const [draft, setDraft] = useState(() => formatDate(value));
  const [invalid, setInvalid] = useState(false);
  const calendarInputRef = useRef<HTMLInputElement>(null);

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

  function selectDate(value: string) {
    setInvalid(false);
    onChange(value);
    setDraft(formatDate(value));
  }

  function openCalendar() {
    const input = calendarInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
    input.click();
  }

  return (
    <>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/YYYY"
          value={draft}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(event) => {
            const masked = maskDateInput(event.target.value);
            setDraft(masked);
            setInvalid(false);
            // Save as soon as a complete, valid date is typed so dependent views update immediately.
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(masked)) {
              const parsed = parseDate(masked);
              if (parsed && parsed !== value) onChange(parsed);
            }
          }}
          onBlur={commit}
          className={`${className} pr-11 ${invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`.trim()}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={openCalendar}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          title="Choose date from calendar"
          aria-label="Choose date from calendar"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
        <input
          ref={calendarInputRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={parseDate(draft) || ''}
          onChange={(event) => selectDate(event.target.value)}
          className="sr-only"
        />
      </div>
      {invalid ? <span className="mt-1 block text-xs font-normal text-red-600">Enter a valid date as DD/MM/YYYY.</span> : null}
    </>
  );
}
