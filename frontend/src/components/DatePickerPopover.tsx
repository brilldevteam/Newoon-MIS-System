import { ChevronLeft, ChevronRight } from 'lucide-react';
import { KeyboardEvent, RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Branded calendar used by TypedDateInput instead of the browser's native picker (which cannot be styled).
// Values are ISO dates (YYYY-MM-DD). Month and year can be picked from lists, which matters for birth and
// incorporation dates far in the past.
type Props = {
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  // The input and calendar button: clicks there are not "outside" (the button toggles the calendar itself).
  anchorRef: RefObject<HTMLElement | null>;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (value: number) => String(value).padStart(2, '0');
const iso = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

function todayIso() {
  const now = new Date();
  return iso(now.getFullYear(), now.getMonth(), now.getDate());
}

function parts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } : null;
}

export function DatePickerPopover({ value, onSelect, onClose, anchorRef }: Props) {
  const today = todayIso();
  const start = parts(value) || parts(today)!;
  const [view, setView] = useState({ year: start.year, month: start.month });
  const [focused, setFocused] = useState(value || today);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Rendered on <body> and placed next to the field, so scrolling form panels never clip it. Opens below the
  // field, or above when there is no room, and stays inside the window.
  useLayoutEffect(() => {
    function place() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const gap = 8;
      const below = anchor.bottom + gap;
      const top = below + height > window.innerHeight - gap && anchor.top - gap - height > gap ? anchor.top - gap - height : below;
      const left = Math.min(Math.max(gap, anchor.right - width), window.innerWidth - width - gap);
      setPosition({ top, left });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [anchorRef]);

  // Close on outside click and on Escape.
  useEffect(() => {
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onEscape);
    };
  }, [onClose, anchorRef]);

  // Focus the selected (or today's) day when the calendar opens, and follow arrow-key moves; changing the
  // month or year from the lists keeps focus on the list.
  const focusDay = () => window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')?.focus());
  useEffect(() => { focusDay(); }, []);

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const daysInPrevious = new Date(view.year, view.month, 0).getDate();
    const list: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = first - 1; i >= 0; i--) {
      const date = new Date(view.year, view.month - 1, daysInPrevious - i);
      list.push({ iso: iso(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate(), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) list.push({ iso: iso(view.year, view.month, day), day, inMonth: true });
    while (list.length % 7 || list.length < 42) {
      const date = new Date(view.year, view.month + 1, list.length - first - daysInMonth + 1);
      list.push({ iso: iso(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate(), inMonth: false });
    }
    return list;
  }, [view]);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = currentYear + 20; year >= 1900; year--) list.push(year);
    return list;
  }, [currentYear]);

  function shiftMonth(delta: number) {
    setView((current) => {
      const date = new Date(current.year, current.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  function moveFocus(days: number) {
    const current = parts(focused) || parts(today)!;
    const date = new Date(current.year, current.month, current.day + days);
    const next = iso(date.getFullYear(), date.getMonth(), date.getDate());
    setFocused(next);
    if (date.getMonth() !== view.month || date.getFullYear() !== view.year) setView({ year: date.getFullYear(), month: date.getMonth() });
    focusDay();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in moves) { event.preventDefault(); moveFocus(moves[event.key]); }
    else if (event.key === 'PageUp') { event.preventDefault(); shiftMonth(-1); }
    else if (event.key === 'PageDown') { event.preventDefault(); shiftMonth(1); }
    else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  }

  const selectClass = 'rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-900 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Choose date"
      onKeyDown={onKeyDown}
      style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
      className="fixed z-[60] w-[19rem] max-w-[calc(100vw-1rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5">
          <select aria-label="Month" value={view.month} onChange={(event) => setView((current) => ({ ...current, month: Number(event.target.value) }))} className={selectClass}>
            {MONTHS.map((name, index) => <option key={name} value={index}>{name}</option>)}
          </select>
          <select aria-label="Year" value={view.year} onChange={(event) => setView((current) => ({ ...current, year: Number(event.target.value) }))} className={selectClass}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {WEEKDAYS.map((day) => <span key={day} className="py-1">{day}</span>)}
      </div>
      <div role="grid" className="mt-1 grid grid-cols-7 gap-0.5">
        {cells.map((cell) => {
          const selected = cell.iso === value;
          const isToday = cell.iso === today;
          return (
            <button
              key={cell.iso}
              type="button"
              data-focused={cell.iso === focused ? 'true' : undefined}
              tabIndex={cell.iso === focused ? 0 : -1}
              aria-label={cell.iso}
              aria-pressed={selected}
              onClick={() => onSelect(cell.iso)}
              className={[
                'relative h-9 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
                selected ? 'bg-brand-600 font-semibold text-white hover:bg-brand-700'
                  : isToday ? 'font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50'
                  : cell.inMonth ? 'text-slate-800 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-50'
              ].join(' ')}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <button type="button" onClick={() => onSelect('')} className="rounded-md px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">Clear</button>
        <button type="button" onClick={() => onSelect(today)} className="rounded-md bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-100">Today</button>
      </div>
    </div>,
    document.body
  );
}
