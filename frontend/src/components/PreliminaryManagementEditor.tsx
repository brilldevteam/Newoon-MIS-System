import { ChevronDown, Plus, Trash2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SearchableMultiSelect, splitList } from './SearchableSelect';

type Person = { id?: string; fullName: string; identityNumber: string; nationality: string; position: string; positions?: string[] };
type Props = { people: Person[]; nationalities: string[]; positions: string[]; onChange: (people: Person[]) => void };
const inputClass = 'mt-1.5 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';

export function PreliminaryManagementEditor({ people, nationalities, positions, onChange }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState('');
  const personRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!focusId) return;
    const card = personRefs.current.get(focusId);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card.querySelector('input')?.focus({ preventScroll: true });
    setFocusId('');
  }, [focusId, people]);

  const update = (index: number, change: Partial<Person>) => onChange(people.map((row, rowIndex) => rowIndex === index ? { ...row, ...change } : row));
  const addPerson = () => {
    const id = crypto.randomUUID();
    setFocusId(id);
    onChange([...people, { id, fullName: '', identityNumber: '', nationality: '', position: '', positions: [] }]);
  };

  return <section className="min-w-0 space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-950">Management and control persons</h2>
      <button type="button" onClick={addPerson} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><Plus className="h-4 w-4" />Add person</button>
    </header>
    {people.map((row, index) => {
      const key = row.id || String(index);
      const panelId = `management-person-${key}`;
      const expanded = !collapsed.has(key);
      const selectedPositions = row.positions?.length ? row.positions : row.position.split(', ').filter(Boolean);
      return <article key={key} ref={(node) => { if (node) personRefs.current.set(key, node); else personRefs.current.delete(key); }} className="min-w-0 rounded-lg border border-slate-200 bg-white">
        <header className={`flex items-center gap-2 px-3 py-2 ${expanded ? 'border-b border-slate-200' : ''}`}>
          <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setCollapsed((ids) => { const next = new Set(ids); if (next.has(key)) next.delete(key); else next.add(key); return next; })} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded px-1 py-2 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600">
            <UserRound className="h-5 w-5 shrink-0 text-slate-500" />
            <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-slate-950">{row.fullName || `Person ${index + 1}`}</span>{!expanded && <span className="mt-1 block break-words text-xs text-slate-600">{selectedPositions.join(', ') || 'Position not selected'}</span>}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button type="button" title="Remove person" aria-label={`Remove ${row.fullName || `person ${index + 1}`}`} disabled={people.length === 1} onClick={() => onChange(people.filter((_, rowIndex) => rowIndex !== index))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
        </header>
        <div id={panelId} hidden={!expanded} className="p-4">
          <div className="grid min-w-0 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
            <label className="min-w-0 text-sm font-medium text-slate-700">Full name<input className={inputClass} value={row.fullName} onChange={(event) => update(index, { fullName: event.target.value })} /></label>
            <label className="min-w-0 text-sm font-medium text-slate-700">Passport or QID number<input type="text" className={inputClass} value={row.identityNumber} onChange={(event) => update(index, { identityNumber: event.target.value })} /></label>
            <div className="min-w-0"><SearchableMultiSelect label="Nationality" value={splitList(row.nationality)} options={nationalities.filter(Boolean)} onChange={(value) => update(index, { nationality: value.join(', ') })} placeholder="Select nationalities" /></div>
            <div className="min-w-0"><SearchableMultiSelect label="Positions" value={selectedPositions} options={positions.filter(Boolean)} onChange={(value) => update(index, { positions: value, position: value.join(', ') })} placeholder="Select positions" /></div>
          </div>
        </div>
      </article>;
    })}
  </section>;
}
