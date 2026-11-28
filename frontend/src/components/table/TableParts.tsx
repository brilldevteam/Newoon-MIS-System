import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';

// Building blocks of the list tables: toolbar (search, sort, filters), quick tabs, sortable headers, avatar, pills,
// loading and empty states, and the pager. Pages combine these with useServerTable.

export const tableHeadClass = 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500';
export const tableCellClass = 'px-4 py-3 align-middle';

export function TableCard({ children }: { children: ReactNode }) {
  return <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>;
}

type SortOption = { value: string; label: string };

type ToolbarProps = {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  sort: string;
  dir: 'asc' | 'desc';
  sortOptions: SortOption[];
  onSort: (sort: string, dir: 'asc' | 'desc') => void;
  // The filter panel body; leave out when the table has no filters.
  filters?: ReactNode;
  activeFilterCount?: number;
  onClearFilters?: () => void;
  extra?: ReactNode;
};

export function TableToolbar({ query, onQuery, placeholder, sort, dir, sortOptions, onSort, filters, activeFilterCount = 0, onClearFilters, extra }: ToolbarProps) {
  // The box is typed into at once; the list is asked for after a short pause.
  const [text, setText] = useState(query);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setText(query), [query]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function change(value: string) {
    setText(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onQuery(value), 300);
  }
  function clear() {
    window.clearTimeout(timer.current);
    setText('');
    onQuery('');
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
      <label className="relative min-w-0 flex-1 basis-64">
        <span className="sr-only">Search</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={text}
          onChange={(event) => change(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { window.clearTimeout(timer.current); onQuery(text); } }}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {text ? <button type="button" onClick={clear} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button> : null}
      </label>
      <div className="flex items-center gap-1">
        <label className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-600">
          <span className="whitespace-nowrap text-slate-500">Sort:</span>
          <select aria-label="Sort by" value={sort} onChange={(event) => onSort(event.target.value, dir)} className="bg-transparent pr-1 text-sm font-medium text-slate-900 focus:outline-none">
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => onSort(sort, dir === 'asc' ? 'desc' : 'asc')} aria-label={dir === 'asc' ? 'Ascending. Switch to descending' : 'Descending. Switch to ascending'} title={dir === 'asc' ? 'Ascending' : 'Descending'} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
          {dir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        </button>
      </div>
      {filters ? <FilterMenu count={activeFilterCount} onClear={onClearFilters}>{filters}</FilterMenu> : null}
      {extra}
    </div>
  );
}

function FilterMenu({ count, onClear, children }: { count: number; onClear?: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); }
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${count ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
        <Filter aria-hidden="true" className="h-4 w-4" />Filters
        {count ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white">{count}</span> : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Filters" className="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          {children}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <button type="button" disabled={!count} onClick={onClear} className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40">Clear filters</button>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800">Done</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: SortOption[] }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
        <option value="">All</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function QuickTabs({ tabs, active, counts, onChange }: { tabs: SortOption[]; active: string; counts?: Record<string, number>; onChange: (tab: string) => void }) {
  return (
    <div role="tablist" aria-label="Quick filters" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2">
      {tabs.map((tab) => {
        const selected = active === tab.value;
        const count = counts?.[tab.value];
        return (
          <button key={tab.value} type="button" role="tab" aria-selected={selected} onClick={() => onChange(tab.value)} className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium ${selected ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {tab.label}
            {count !== undefined ? <span className={`rounded-full px-1.5 text-[11px] font-semibold ${selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// A column heading that sorts the list when clicked.
export function SortHeader({ label, sortKey, sort, dir, onSort, align = 'left' }: { label: string; sortKey: string; sort: string; dir: 'asc' | 'desc'; onSort: (key: string) => void; align?: 'left' | 'right' }) {
  const active = sort === sortKey;
  return (
    <th scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${tableHeadClass} ${align === 'right' ? 'text-right' : ''}`}>
      <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900 ${active ? 'text-slate-900' : ''}`}>
        {label}
        {active ? (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
      </button>
    </th>
  );
}

export function Avatar({ name }: { name: string }) {
  const letter = (name.trim().match(/[A-Za-z0-9]/)?.[0] || '?').toUpperCase();
  return <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-700">{letter}</span>;
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'blue' | 'amber' | 'red' | 'violet' }) {
  const tones = { slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', violet: 'bg-violet-50 text-violet-700' };
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => <td key={column} className={tableCellClass}><div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${60 + ((row + column) % 3) * 15}%` }} /></td>)}
        </tr>
      ))}
    </>
  );
}

export function EmptyRow({ columns, filtered, emptyText, onReset }: { columns: number; filtered: boolean; emptyText: string; onReset: () => void }) {
  return (
    <tr>
      <td colSpan={columns} className="px-4 py-12 text-center">
        <p className="text-sm font-medium text-slate-700">{filtered ? 'Nothing matches your search or filters.' : emptyText}</p>
        {filtered ? <button type="button" onClick={onReset} className="mt-2 text-sm font-semibold text-brand-700 hover:underline">Clear search and filters</button> : null}
      </td>
    </tr>
  );
}

export function TablePager({ page, pageSize, total, onPage, onPageSize, loading }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void; loading?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const numbers: Array<number | 'gap'> = [];
  for (let value = 1; value <= pages; value++) {
    if (value === 1 || value === pages || Math.abs(value - page) <= 1) numbers.push(value);
    else if (numbers[numbers.length - 1] !== 'gap') numbers.push('gap');
  }
  const button = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-medium disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600" aria-busy={loading}>
      <div className="flex items-center gap-3">
        <p>{total ? <>Showing <span className="font-semibold text-slate-900">{from}</span> to <span className="font-semibold text-slate-900">{to}</span> of <span className="font-semibold text-slate-900">{total}</span> results</> : loading ? 'Loading...' : 'No results'}</p>
        <label className="hidden items-center gap-1.5 sm:flex">
          <span className="text-slate-500">Per page</span>
          <select aria-label="Rows per page" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-sm">
            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={`${button} gap-1 border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}><ChevronLeft className="h-4 w-4" />Previous</button>
        {numbers.map((value, index) => value === 'gap'
          ? <span key={`gap-${index}`} className="px-1 text-slate-400">…</span>
          : <button key={value} type="button" aria-current={value === page ? 'page' : undefined} onClick={() => onPage(value)} className={`${button} ${value === page ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{value}</button>)}
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={`${button} gap-1 border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>Next<ChevronRight className="h-4 w-4" /></button>
      </nav>
    </div>
  );
}

export function IconAction({ label, children, tone = 'default', ...rest }: { label: string; children: ReactNode; tone?: 'default' | 'danger' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" aria-label={label} title={label} {...rest} className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 ${tone === 'danger' ? 'hover:bg-red-50 hover:text-red-600' : 'hover:text-slate-700'}`}>{children}</button>;
}
