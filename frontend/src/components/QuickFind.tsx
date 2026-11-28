import { CornerDownLeft, Search } from 'lucide-react';
import { ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type QuickFindItem = { to: string; label: string; section: string; icon: ComponentType<{ className?: string }> };

// Header search that jumps to a page: type a few letters, move with the arrow keys, press Enter. Ctrl+K or "/" from
// anywhere puts the cursor in the box. It lists the pages this login can open.
export function QuickFind({ items }: { items: QuickFindItem[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return items.slice(0, 8);
    return items.filter((item) => `${item.label} ${item.section}`.toLowerCase().includes(text)).slice(0, 8);
  }, [items, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName) || (event.target as HTMLElement)?.isContentEditable;
      if ((event.key === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    }
    function onDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, []);

  function go(item: QuickFindItem) {
    setOpen(false);
    setQuery('');
    input.current?.blur();
    navigate(item.to);
  }

  return (
    <div ref={root} className="relative min-w-0 flex-1 sm:max-w-xl">
      <label className="relative block">
        <span className="sr-only">Quick Find</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="quick-find-list"
          aria-autocomplete="list"
          value={query}
          placeholder="Quick Find"
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(value + 1, matches.length - 1)); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
            else if (event.key === 'Enter' && matches[active]) { event.preventDefault(); go(matches[active]); }
            else if (event.key === 'Escape') { setOpen(false); input.current?.blur(); }
          }}
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-10 pr-14 text-sm text-slate-900 placeholder:text-slate-500 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">Ctrl K</kbd>
      </label>
      {open ? (
        <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pages</p>
          {matches.length ? (
            <ul id="quick-find-list" role="listbox" className="max-h-80 overflow-y-auto py-1">
              {matches.map((item, index) => (
                <li key={item.to} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${index === active ? 'bg-brand-50 text-brand-700' : 'text-slate-700'}`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                    <span className="shrink-0 text-xs text-slate-400">{item.section}</span>
                    {index === active ? <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-slate-500">No page matches "{query}".</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
