import { Building2, Plus, Trash2, UserRound, Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SearchableMultiSelect, splitList } from './SearchableSelect';
import { mergeBeneficialOwners } from '../utils/ownership';
import { CORPORATE_ENTITY, chainParentId, directOwnershipTotal, indirectUboPercentage, overOwnedCompanies, ownersAndSelfIds, ownershipChainOrder } from '../utils/preliminary-ownership-chain';

type Owner = { id?: string; shareholderType?: string; parentRowId?: string; sourceShareholderId?: string; uboPercentage?: string; fullName: string; nationality: string; identityNumber: string; address: string; ownershipPercentage: string; isUbo: boolean };
type Props = { shareholders: Owner[]; ubos: Owner[]; countries: string[]; nationalities: string[]; onChange: (shareholders: Owner[], ubos: Owner[]) => void };
const blank = (parentRowId = ''): Owner => ({ id: crypto.randomUUID(), shareholderType: 'Individual', parentRowId, fullName: '', nationality: '', identityNumber: '', address: '', ownershipPercentage: '', isUbo: false });
const populated = (row: Owner) => Boolean(row.fullName || row.identityNumber || row.nationality || row.address || row.ownershipPercentage || row.parentRowId);
const inputClass = 'mt-1.5 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';
const companyName = (row: Owner | undefined) => row?.fullName.trim() || 'Unnamed company';

export function PreliminaryOwnershipEditor({ shareholders, ubos, countries, nationalities, onChange }: Props) {
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const ownerRefs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    if (!focusId) return;
    const card = ownerRefs.current.get(focusId);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card.querySelector('input')?.focus({ preventScroll: true });
    setFocusId('');
  }, [focusId, ubos, shareholders]);
  const chain = ownershipChainOrder(shareholders);
  // Every company in the chain, in chain order, so beneficial owners can be linked through any level.
  const corporate = chain.filter(({ row }) => row.shareholderType === CORPORATE_ENTITY);
  const automatic = shareholders.filter((row) => row.isUbo && row.shareholderType !== CORPORATE_ENTITY && row.fullName.trim());
  const manual = ubos.filter((row) => !shareholders.some((party) => row.id && row.id === party.id || row.sourceShareholderId && row.sourceShareholderId === party.id));
  const visibleManual = manual.filter((row) => populated(row) || editingIds.has(row.id || ''));
  const total = directOwnershipTotal(shareholders);
  const overOwned = overOwnedCompanies(shareholders, ubos);
  const addOwner = (parentId = '') => {
    const row = { ...blank(parentId), ...(parentId ? { uboPercentage: '' } : {}) };
    setEditingIds((ids) => new Set([...ids, row.id!]));
    setFocusId(row.id!);
    onChange(shareholders, [...visibleManual, row]);
  };
  const addParentCompany = (company: Owner) => {
    const row = { ...blank(company.id), shareholderType: CORPORATE_ENTITY };
    setFocusId(row.id!);
    onChange([...shareholders, row], ubos);
  };
  // Parent companies of a row that is removed, or that stops being a company, move up to that row's own parent.
  const reattachChildren = (rows: Owner[], row: Owner) => {
    const parentId = chainParentId(row, shareholders);
    return rows.map((item) => row.id && item.parentRowId === row.id ? { ...item, parentRowId: parentId } : item);
  };
  const patch = (row: Owner, isShareholder: boolean, change: Partial<Owner>) => {
    const source = isShareholder ? shareholders : ubos;
    const becomesPerson = isShareholder && change.shareholderType && change.shareholderType !== CORPORATE_ENTITY;
    let next = source.map((item) => item === row ? { ...item, ...change, ...(change.shareholderType === CORPORATE_ENTITY ? { isUbo: false } : {}), ...(becomesPerson ? { parentRowId: '' } : {}) } : item);
    if (becomesPerson) next = reattachChildren(next, row);
    onChange(isShareholder ? next : shareholders, isShareholder ? ubos : next);
  };
  const remove = (row: Owner, isShareholder: boolean) => {
    if (!isShareholder) return onChange(shareholders, ubos.filter((item) => item !== row));
    onChange(reattachChildren(shareholders.filter((item) => item !== row), row), ubos.filter((item) => !row.id || item.id !== row.id && item.sourceShareholderId !== row.id).map((item) => row.id && item.parentRowId === row.id ? { ...item, parentRowId: '' } : item));
  };
  const renderOwner = (row: Owner, index: number, isShareholder: boolean, depth = 0, parent?: Owner) => {
    const isCompany = isShareholder && row.shareholderType === CORPORATE_ENTITY;
    const isParentCompany = isShareholder && Boolean(parent);
    const Icon = isCompany ? Building2 : UserRound;
    const cardId = `ownership-${isShareholder ? 'shareholder' : 'ubo'}-${row.id || index}`;
    const expanded = !collapsed.has(cardId);
    const linkedCompany = !isShareholder && row.parentRowId ? shareholders.find((item) => item.id === row.parentRowId) : undefined;
    const calculatedUbo = !isShareholder && row.parentRowId ? indirectUboPercentage(row.ownershipPercentage, row.parentRowId, shareholders) : '';
    const ownedCompanyOptions = isCompany ? corporate.filter(({ row: company }) => !ownersAndSelfIds(row.id || '', shareholders).has(company.id || '')) : [];
    const subtitle = isParentCompany ? `Owns ${row.ownershipPercentage || '0'}% of ${companyName(parent)}` : '';
    return <article key={row.id || index} ref={(node) => { if (row.id) { if (node) ownerRefs.current.set(row.id, node); else ownerRefs.current.delete(row.id); } }} className="rounded-lg border border-slate-200 bg-white" style={depth ? { marginLeft: `${Math.min(depth, 4) * 0.75}rem`, borderLeft: '3px solid #99d5cf' } : undefined}>
      <header className={`flex items-center gap-2 px-3 py-2 ${expanded ? 'border-b border-slate-200' : ''}`}>
        <button type="button" aria-expanded={expanded} aria-controls={cardId} onClick={() => setCollapsed((ids) => { const next = new Set(ids); if (next.has(cardId)) next.delete(cardId); else next.add(cardId); return next; })} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded px-1 py-2 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600">
          <Icon className={`h-5 w-5 shrink-0 ${isCompany ? 'text-teal-700' : 'text-slate-500'}`} />
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-slate-950">{row.fullName || `${isCompany ? (isParentCompany ? 'Parent company' : 'Company') : 'Person'} ${index + 1}`}</span>{subtitle && <span className="mt-1 block break-words text-xs text-teal-800">{subtitle}</span>}{!expanded && !subtitle && <span className="mt-1 block text-xs text-slate-600">{isCompany ? 'Company' : 'Person'} · {!isShareholder && row.parentRowId ? (row.uboPercentage || 'Not entered') : (row.ownershipPercentage || '0')}% {!isShareholder && row.parentRowId ? 'UBO' : 'ownership'}{row.isUbo ? ' · UBO' : ''}</span>}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <button type="button" title="Remove" aria-label={`Remove ${row.fullName || 'owner'}`} onClick={() => remove(row, isShareholder)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
      </header>
      <div id={cardId} hidden={!expanded} className="space-y-4 p-4">
        {isShareholder && !isParentCompany && <div role="group" aria-label="Shareholder type" className="inline-flex gap-1 rounded-md bg-slate-100 p-1">{[['Individual', 'Person', UserRound], [CORPORATE_ENTITY, 'Company', Building2]].map(([value, label, ButtonIcon]) => { const TypeIcon = ButtonIcon as typeof UserRound; return <button key={String(value)} type="button" aria-pressed={(row.shareholderType || 'Individual') === value} onClick={() => patch(row, true, { shareholderType: String(value) })} className={`inline-flex min-h-9 items-center gap-2 rounded px-3 text-sm font-medium ${(row.shareholderType || 'Individual') === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}><TypeIcon className="h-4 w-4" />{String(label)}</button>; })}</div>}
        <div className="grid min-w-0 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
          <label className="min-w-0 text-sm font-medium text-slate-700">{isCompany ? 'Company name' : 'Full name'}<input className={inputClass} value={row.fullName} onChange={(event) => patch(row, isShareholder, { fullName: event.target.value })} /></label>
          <label className="min-w-0 text-sm font-medium text-slate-700">{isCompany ? 'Registration number (CR)' : 'Passport or QID number'}<input type="text" className={inputClass} value={row.identityNumber} onChange={(event) => patch(row, isShareholder, { identityNumber: event.target.value })} /></label>
          <div className="min-w-0">{isCompany ? <label className="text-sm font-medium text-slate-700">Country of registration<select className={inputClass} value={row.nationality} onChange={(event) => patch(row, true, { nationality: event.target.value })}><option value="">Select country</option>{countries.filter(Boolean).map((country) => <option key={country}>{country}</option>)}</select></label> : <SearchableMultiSelect label="Nationality" value={splitList(row.nationality)} options={nationalities.filter(Boolean)} onChange={(value) => patch(row, isShareholder, { nationality: value.join(', ') })} placeholder="Select nationality" />}</div>
          <label className="min-w-0 text-sm font-medium text-slate-700">Country of residence<select className={inputClass} value={row.address} onChange={(event) => patch(row, isShareholder, { address: event.target.value })}><option value="">Select country</option>{countries.filter(Boolean).map((country) => <option key={country}>{country}</option>)}</select></label>
          {isCompany && <label className="min-w-0 text-sm font-medium text-slate-700">Shareholder of<select className={inputClass} value={chainParentId(row, shareholders)} onChange={(event) => patch(row, true, { parentRowId: event.target.value })}><option value="">Client company (direct)</option>{ownedCompanyOptions.map(({ row: company, depth: level }) => <option key={company.id} value={company.id}>{`${' '.repeat(level)}${companyName(company)}`}</option>)}</select></label>}
          <label className="min-w-0 text-sm font-medium text-slate-700">{isParentCompany ? `Ownership % in ${companyName(parent)}` : !isShareholder && row.parentRowId ? 'Ownership % in corporate shareholder' : 'Ownership percentage'}<div className="relative"><input type="number" min="0" max="100" step="0.01" className={`${inputClass} pr-9`} value={row.ownershipPercentage} onChange={(event) => patch(row, isShareholder, { ownershipPercentage: event.target.value })} /><span className="pointer-events-none absolute right-3 top-4 text-sm text-slate-500">%</span></div></label>
          {!isShareholder && <label className="min-w-0 text-sm font-medium text-slate-700">Owns shares through<select className={inputClass} value={row.parentRowId || ''} onChange={(event) => patch(row, false, { parentRowId: event.target.value, ...(event.target.value ? { uboPercentage: row.uboPercentage ?? '' } : {}) })}><option value="">Direct ownership</option>{corporate.map(({ row: company, depth: level }) => <option key={company.id} value={company.id}>{`${' '.repeat(level)}${companyName(company)}`}</option>)}</select></label>}
          {!isShareholder && row.parentRowId && <div className="min-w-0"><label className="text-sm font-medium text-slate-700">UBO % (indirect interest in client company)<input type="number" min="0" max="100" step="0.01" className={inputClass} value={row.uboPercentage ?? ''} onChange={(event) => patch(row, false, { uboPercentage: event.target.value })} /></label>{calculatedUbo && linkedCompany && <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-600"><span>Calculated through the ownership chain: {calculatedUbo}%</span>{calculatedUbo !== String(row.uboPercentage ?? '') && <button type="button" onClick={() => patch(row, false, { uboPercentage: calculatedUbo })} className="font-semibold text-red-700 underline-offset-2 hover:underline">Use {calculatedUbo}%</button>}</p>}</div>}
        </div>
        {isShareholder && !isCompany && <label className="flex min-h-10 cursor-pointer items-center gap-3 border-t border-slate-100 pt-3 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 accent-red-600" checked={row.isUbo} onChange={(event) => patch(row, true, { isUbo: event.target.checked })} />Beneficial owner (UBO)</label>}
        {isCompany && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><span className="text-sm text-slate-600">Beneficial owners: {manual.filter((owner) => owner.parentRowId === row.id && owner.fullName.trim()).length}</span><span className="flex flex-wrap gap-x-4 gap-y-1"><button type="button" onClick={() => addParentCompany(row)} title={`Add a company that owns shares in ${companyName(row)}`} className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-teal-800"><Plus className="h-4 w-4" />Add parent company</button><button type="button" onClick={() => addOwner(row.id)} className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-red-700"><Plus className="h-4 w-4" />Add beneficial owner</button></span></div>}
      </div>
    </article>;
  };
  return <div className="min-w-0 space-y-7">
    <section className="space-y-4"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-950">Shareholders</h2><button type="button" onClick={() => { const row = blank(); setFocusId(row.id!); onChange([...shareholders, row], ubos); }} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><Plus className="h-4 w-4" />Add shareholder</button></header>
      {corporate.length > 0 && <p className="text-sm text-slate-600">If a company shareholder is itself owned by another company, open it and use <strong>Add parent company</strong>. Only direct shareholders of the client company count towards the 100% total.</p>}
      {chain.map(({ row, depth, parent }, index) => renderOwner(row, index, true, depth, parent))}
      <div className={`flex flex-wrap justify-between gap-2 border-t pt-3 text-sm ${total > 100.005 ? 'border-red-300 text-red-700' : 'border-slate-200 text-slate-700'}`}><span>Total direct shareholder ownership</span><strong>{total.toFixed(2)}%</strong></div></section>
    {Math.abs(total - 100) > 0.005 && <p role="alert" className="border-l-2 border-red-500 pl-3 text-sm text-red-700">Direct shareholder ownership must total 100%. Current total: {total.toFixed(2)}%.</p>}
    {overOwned.map((company) => <p key={company.name} role="alert" className="border-l-2 border-red-500 pl-3 text-sm text-red-700">Owners of {company.name} add up to {company.total.toFixed(2)}%, which is more than 100%.</p>)}
    <section className="space-y-4 border-t border-slate-200 pt-5"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-950">Beneficial owners</h2><button type="button" onClick={() => addOwner()} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><Plus className="h-4 w-4" />Add person</button></header>
      {automatic.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 text-sm"><div className="flex min-w-0 items-center gap-3"><Check className="h-4 w-4 shrink-0 text-teal-700" /><span className="break-words font-medium text-slate-800">{row.fullName}</span></div><span className="shrink-0 text-slate-600">{row.ownershipPercentage || '0'}%</span></div>)}
      {visibleManual.map((row, index) => renderOwner(row, index, false))}
      {!automatic.length && !visibleManual.length && <div className="py-4 text-sm text-slate-500">No beneficial owners added.</div>}
      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 text-sm text-slate-700"><span>Total beneficial ownership</span><strong>{mergeBeneficialOwners(shareholders, ubos).reduce((sum, row) => sum + (Number(row.ownershipPercentage) || 0), 0).toFixed(2)}%</strong></div>
    </section>
  </div>;
}
