import { Building2, Link2, LoaderCircle, Plus, User, X } from 'lucide-react';
import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../services/api';
import {
  addClientPerson,
  addPersonRole,
  ClientPerson,
  ClientPersonRole,
  ComplianceClientDetail,
  corporateRoles,
  percentRoles,
  personRoleLabels,
  PersonRoleType,
  personTitles,
  removePersonRole,
  updatePersonField,
  updatePersonRole
} from '../services/compliance-clients.service';
import { EditableFields, EditableItem, EditConfig, EditKind } from './EditableFields';
import { IdentityDocumentsBlock, IdentityDocumentsContext } from './IdentityDocumentsBlock';
import { useToast } from './ToastProvider';

// People of a compliance client (2026-11-22). Each person is one record holding any number of roles; every tab of the
// client page lists the people holding its roles, so the same person (and every edit to them) appears on each tab.

export type PeopleContext = {
  clientId: string;
  canEdit: boolean;
  people: ClientPerson[];
  ids: IdentityDocumentsContext;
  onChange: (next: ComplianceClientDetail) => void;
};

const ALL_ROLES = Object.keys(personRoleLabels) as PersonRoleType[];

const roleTone: Partial<Record<PersonRoleType, string>> = {
  SHAREHOLDER: 'bg-brand-50 text-brand-700 ring-brand-200',
  UBO: 'bg-violet-50 text-violet-700 ring-violet-200',
  AUTHORISED_SIGNATORY: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  KEY_CONTACT: 'bg-sky-50 text-sky-700 ring-sky-200'
};

export function roleLabel(role: Pick<ClientPersonRole, 'role' | 'title'>) {
  return role.role === 'OTHER' && role.title ? role.title : role.role === 'KEY_CONTACT' && role.title ? `${personRoleLabels.KEY_CONTACT} (${role.title})` : personRoleLabels[role.role];
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const yesNo = (value: boolean | null) => (value === null ? null : value ? 'Yes' : 'No');
const yesNoOptions = [{ value: '', label: 'Not captured' }, { value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }];
const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}>{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

// One tab: the people holding any of `roles`, and a form to add a role to someone already on the client or a new person.
export function PeopleTab({ context, roles, addRoles, allowCorporate, empty, compact }: {
  context: PeopleContext;
  roles: PersonRoleType[];
  // Roles offered by "Add" on this tab (defaults to `roles`).
  addRoles?: PersonRoleType[];
  allowCorporate?: boolean;
  empty: string;
  compact?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const listed = context.people.filter((person) => person.roles.some((role) => roles.includes(role.role)));
  return (
    <div className="space-y-4">
      {context.canEdit ? (
        adding ? (
          <AddPersonForm context={context} roles={addRoles || roles} allowCorporate={Boolean(allowCorporate)} onDone={() => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
            <Plus className="h-4 w-4" />Add {(addRoles || roles).length === 1 ? personRoleLabels[(addRoles || roles)[0]].toLowerCase() : 'person'}
          </button>
        )
      ) : null}
      {listed.length ? (
        <div className={`grid gap-4 ${compact ? '' : 'lg:grid-cols-2'}`}>
          {listed.map((person) => <PersonCard key={person.id} person={person} context={context} highlight={roles} />)}
        </div>
      ) : (
        <Empty>{empty}</Empty>
      )}
    </div>
  );
}

function AddPersonForm({ context, roles, allowCorporate, onDone }: { context: PeopleContext; roles: PersonRoleType[]; allowCorporate: boolean; onDone: () => void }) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [personId, setPersonId] = useState('');
  const [fullName, setFullName] = useState('');
  const [partyType, setPartyType] = useState<'INDIVIDUAL' | 'CORPORATE'>('INDIVIDUAL');
  const [role, setRole] = useState<PersonRoleType>(roles[0]);
  const [title, setTitle] = useState('');
  const [percentage, setPercentage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const existing = context.people.find((person) => person.id === personId) || null;
  const type = mode === 'existing' ? existing?.partyType || 'INDIVIDUAL' : partyType;
  const allowed = roles.filter((item) => type === 'INDIVIDUAL' || corporateRoles.includes(item));
  const effectiveRole = allowed.includes(role) ? role : allowed[0];
  // People already on the client who do not yet hold the chosen role: linking them keeps one record per person.
  const candidates = context.people.filter((person) => !person.roles.some((item) => item.role === effectiveRole && effectiveRole !== 'OTHER') &&
    (person.partyType === 'INDIVIDUAL' || corporateRoles.includes(effectiveRole || roles[0])));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!effectiveRole) {
      setError('A company cannot hold this role.');
      return;
    }
    const roleInput = { role: effectiveRole, title: effectiveRole === 'OTHER' ? title.trim() : undefined, percentage: percentRoles.includes(effectiveRole) ? percentage.trim() || undefined : undefined };
    if (effectiveRole === 'OTHER' && !title.trim()) {
      setError('Enter the position.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (mode === 'existing') {
        if (!existing) throw new Error('Choose the person.');
        context.onChange(await addPersonRole(context.clientId, existing.id, roleInput));
        showToast(`${existing.fullName} is now also ${roleLabel({ role: effectiveRole, title }).toLowerCase()}.`, 'success');
      } else {
        if (!fullName.trim()) throw new Error('Enter the name.');
        context.onChange(await addClientPerson(context.clientId, { partyType: type, fullName: fullName.trim(), ...roleInput }));
        showToast(`${fullName.trim()} added.`, 'success');
      }
      onDone();
    } catch (requestError) {
      setError(requestError instanceof Error && !('response' in requestError) ? requestError.message : getApiErrorMessage(requestError, 'Unable to add.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-4">
      <div className="flex flex-wrap gap-2 text-sm">
        {(['existing', 'new'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${mode === item ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            {item === 'existing' ? <Link2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {item === 'existing' ? 'Someone already on this client' : 'New person or company'}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mode === 'existing' ? (
          <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
            Person *
            <select value={personId} onChange={(event) => setPersonId(event.target.value)} disabled={saving} className={`${inputClass} mt-1`}>
              <option value="">Choose…</option>
              {candidates.map((person) => (
                <option key={person.id} value={person.id}>{person.fullName} — {person.roles.map(roleLabel).join(', ')}</option>
              ))}
            </select>
            <span className="mt-0.5 block font-normal text-slate-500">The same person stays one record: their details, ID documents and other roles are shared.</span>
          </label>
        ) : (
          <>
            <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
              {type === 'CORPORATE' ? 'Company name *' : 'Full name *'}
              <input value={fullName} maxLength={300} onChange={(event) => setFullName(event.target.value)} disabled={saving} className={`${inputClass} mt-1`} />
            </label>
            {allowCorporate ? (
              <label className="block text-xs font-medium text-slate-700">
                Type
                <select value={partyType} onChange={(event) => setPartyType(event.target.value as 'INDIVIDUAL' | 'CORPORATE')} disabled={saving} className={`${inputClass} mt-1`}>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="CORPORATE">Company</option>
                </select>
              </label>
            ) : null}
          </>
        )}
        {allowed.length > 1 ? (
          <label className="block text-xs font-medium text-slate-700">
            Role *
            <select value={effectiveRole} onChange={(event) => setRole(event.target.value as PersonRoleType)} disabled={saving} className={`${inputClass} mt-1`}>
              {allowed.map((item) => <option key={item} value={item}>{personRoleLabels[item]}</option>)}
            </select>
          </label>
        ) : null}
        {effectiveRole === 'OTHER' ? (
          <label className="block text-xs font-medium text-slate-700">
            Position *
            <input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} disabled={saving} className={`${inputClass} mt-1`} />
          </label>
        ) : null}
        {effectiveRole && percentRoles.includes(effectiveRole) ? (
          <label className="block text-xs font-medium text-slate-700">
            {effectiveRole === 'UBO' ? 'UBO %' : 'Shareholding %'}
            <input value={percentage} inputMode="decimal" maxLength={10} onChange={(event) => setPercentage(event.target.value)} disabled={saving} className={`${inputClass} mt-1`} />
          </label>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add
        </button>
        <button type="button" disabled={saving} onClick={onDone} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <X className="h-4 w-4" />Cancel
        </button>
      </div>
    </form>
  );
}

export function PersonCard({ person, context, highlight = [] }: { person: ClientPerson; context: PeopleContext; highlight?: PersonRoleType[] }) {
  const { showToast } = useToast();
  const corporate = person.partyType === 'CORPORATE';
  const shareholding = person.roles.find((role) => role.role === 'SHAREHOLDER');
  const ubo = person.roles.find((role) => role.role === 'UBO');
  const via = ubo?.viaPersonId ? context.people.find((other) => other.id === ubo.viaPersonId) : null;

  const item = (label: string, display: ReactNode, field: string, kind: EditKind, initial: string | null | undefined, extra: Partial<EditConfig> = {}): EditableItem => ({
    label,
    value: display,
    edited: person.edited.includes(field),
    edit: context.canEdit ? {
      kind, initial, ...extra,
      onSave: async (value) => {
        context.onChange(await updatePersonField(context.clientId, person.id, field, value));
        showToast('Saved.', 'success');
      }
    } : null
  });

  const fields: EditableItem[] = corporate
    ? [
      item('Company name', person.fullName, 'fullName', 'text', person.fullName, { required: true }),
      item('Country', person.nationality, 'nationality', 'text', person.nationality),
      item('CR / registration no.', person.registrationNumber, 'registrationNumber', 'text', person.registrationNumber),
      item('Date of incorporation', formatDate(person.dateOfBirth), 'dateOfBirth', 'date', person.dateOfBirth),
      item('Address', person.address, 'address', 'longtext', person.address),
      item('Telephone', person.telephone, 'telephone', 'text', person.telephone),
      item('Email', person.email, 'email', 'email', person.email),
      ...(person.linkedClientName ? [{ label: 'Linked client', value: person.linkedClientName }] : [])
    ]
    : [
      item('Title', person.title, 'title', 'select', person.title || '', { options: [{ value: '', label: 'Not captured' }, ...personTitles.map((title) => ({ value: title, label: title }))] }),
      item('Full name', person.fullName, 'fullName', 'text', person.fullName, { required: true, hint: 'As on the QID, corrected to match the passport.' }),
      item('Nationality', person.nationality, 'nationality', 'text', person.nationality),
      item('Dual citizenship', yesNo(person.dualCitizenship), 'dualCitizenship', 'select', yesNo(person.dualCitizenship) || '', { options: yesNoOptions }),
      ...(person.dualCitizenship ? [item('Other nationality', person.otherNationality, 'otherNationality', 'text', person.otherNationality)] : []),
      item('Date of birth', formatDate(person.dateOfBirth), 'dateOfBirth', 'date', person.dateOfBirth),
      item('PEP', yesNo(person.isPep), 'isPep', 'select', yesNo(person.isPep) || '', { options: yesNoOptions }),
      ...(person.isPep ? [item('PEP details', person.pepDetails, 'pepDetails', 'longtext', person.pepDetails)] : []),
      item('Entity represented', person.representedEntity, 'representedEntity', 'text', person.representedEntity),
      item('Address', person.address, 'address', 'longtext', person.address),
      item('National address expiry', formatDate(person.nationalAddressExpiry), 'nationalAddressExpiry', 'date', person.nationalAddressExpiry,
        { hint: 'Listed on the Expiry tab with 60 / 30-day alerts.' }),
      item('Telephone', person.telephone, 'telephone', 'text', person.telephone),
      item('Email', person.email, 'email', 'email', person.email)
    ];

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {corporate ? <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" /> : <User className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />}
          <div className="min-w-0">
            <h3 className="break-words font-semibold text-slate-900">{[person.title, person.fullName].filter(Boolean).join(' ')}</h3>
            <p className="text-xs text-slate-500">
              {corporate ? 'Company' : 'Individual'}
              {shareholding?.percentage ? ` · ${shareholding.percentage}% shares` : ''}
              {ubo?.percentage ? ` · ${ubo.percentage}% UBO` : ''}
              {via ? ` · via ${via.fullName}` : ''}
            </p>
          </div>
        </div>
      </div>
      <RolesEditor person={person} context={context} highlight={highlight} />
      <div className="mt-4">
        <EditableFields columns={2} items={fields} />
        {!corporate ? <IdentityDocumentsBlock person={person} context={context.ids} /> : null}
      </div>
    </article>
  );
}

// All of the person's roles, linked: removing a role here removes it from every tab; the last role removes the person.
function RolesEditor({ person, context, highlight }: { person: ClientPerson; context: PeopleContext; highlight: PersonRoleType[] }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const corporates = useMemo(() => context.people.filter((other) => other.partyType === 'CORPORATE' && other.id !== person.id), [context.people, person.id]);

  async function run(key: string, action: () => Promise<ComplianceClientDetail>, message: string) {
    setBusy(key);
    try {
      context.onChange(await action());
      showToast(message, 'success');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to save.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  function remove(role: ClientPersonRole) {
    const last = person.roles.length === 1;
    const question = last
      ? `Remove ${person.fullName} from this client? This is their only role; their details and documents are kept in the history.`
      : `Remove the ${roleLabel(role)} role from ${person.fullName}? Their other roles stay.`;
    if (!window.confirm(question)) return;
    run(role.id, () => removePersonRole(context.clientId, person.id, role.id), last ? `${person.fullName} removed.` : 'Role removed.');
  }

  async function savePercentage(role: ClientPersonRole, value: string | null) {
    context.onChange(await updatePersonRole(context.clientId, person.id, role.id, { percentage: value }));
    showToast('Saved.', 'success');
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {person.roles.map((role) => (
          <Badge key={role.id} className={`${roleTone[role.role] || 'bg-slate-100 text-slate-700 ring-slate-200'} ${highlight.includes(role.role) ? '' : 'opacity-80'}`}>
            {roleLabel(role)}
            {role.percentage ? <span className="font-normal">{role.percentage}%</span> : null}
            {context.canEdit ? (
              <button type="button" disabled={Boolean(busy)} onClick={() => remove(role)} aria-label={`Remove ${roleLabel(role)}`} title="Remove this role" className="-mr-1 rounded-full p-0.5 hover:bg-black/10 disabled:opacity-50">
                {busy === role.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
              </button>
            ) : null}
          </Badge>
        ))}
        {context.canEdit && !adding ? (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700">
            <Plus className="h-3 w-3" />Role
          </button>
        ) : null}
      </div>
      {adding ? <AddRoleForm person={person} context={context} corporates={corporates} onDone={() => setAdding(false)} /> : null}
      {person.roles.some((role) => percentRoles.includes(role.role)) ? (
        <EditableFields columns={2} items={person.roles.filter((role) => percentRoles.includes(role.role)).flatMap((role): EditableItem[] => [
          {
            label: role.role === 'UBO' ? 'UBO %' : 'Shareholding %',
            value: role.percentage ? `${role.percentage}%` : null,
            edit: context.canEdit ? { kind: 'percent', initial: role.percentage, onSave: (value) => savePercentage(role, value) } : null
          },
          ...(role.role === 'UBO' && person.partyType === 'INDIVIDUAL' ? [{
            label: 'Held through',
            value: role.viaPersonId ? context.people.find((other) => other.id === role.viaPersonId)?.fullName || null : 'Direct',
            edit: context.canEdit && corporates.length ? {
              kind: 'select' as const,
              initial: role.viaPersonId || '',
              options: [{ value: '', label: 'Direct' }, ...corporates.map((other) => ({ value: other.id, label: other.fullName }))],
              onSave: async (value: string | null) => {
                context.onChange(await updatePersonRole(context.clientId, person.id, role.id, { viaPersonId: value || null }));
                showToast('Saved.', 'success');
              }
            } : null
          }] : [])
        ])} />
      ) : null}
    </div>
  );
}

function AddRoleForm({ person, context, corporates, onDone }: { person: ClientPerson; context: PeopleContext; corporates: ClientPerson[]; onDone: () => void }) {
  const { showToast } = useToast();
  const options = ALL_ROLES.filter((role) => (person.partyType === 'INDIVIDUAL' || corporateRoles.includes(role)) && (role === 'OTHER' || !person.roles.some((item) => item.role === role)));
  const [role, setRole] = useState<PersonRoleType>(options[0]);
  const [title, setTitle] = useState('');
  const [percentage, setPercentage] = useState('');
  const [viaPersonId, setViaPersonId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (role === 'OTHER' && !title.trim()) {
      setError('Enter the position.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      context.onChange(await addPersonRole(context.clientId, person.id, {
        role,
        title: role === 'OTHER' ? title.trim() : undefined,
        percentage: percentRoles.includes(role) ? percentage.trim() || undefined : undefined,
        viaPersonId: role === 'UBO' && viaPersonId ? viaPersonId : undefined
      }));
      showToast(`${roleLabel({ role, title })} added to ${person.fullName}.`, 'success');
      onDone();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to add the role.'));
    } finally {
      setSaving(false);
    }
  }

  if (!options.length) return <p className="text-xs text-slate-500">No other roles apply.</p>;
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-md border border-brand-100 bg-brand-50/40 p-2.5">
      <label className="block text-xs font-medium text-slate-700">
        Role
        <select value={role} onChange={(event) => setRole(event.target.value as PersonRoleType)} disabled={saving} className={`${inputClass} mt-1`}>
          {options.map((item) => <option key={item} value={item}>{personRoleLabels[item]}</option>)}
        </select>
      </label>
      {role === 'OTHER' ? (
        <label className="block text-xs font-medium text-slate-700">
          Position
          <input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} disabled={saving} className={`${inputClass} mt-1`} />
        </label>
      ) : null}
      {percentRoles.includes(role) ? (
        <label className="block w-24 text-xs font-medium text-slate-700">
          %
          <input value={percentage} inputMode="decimal" maxLength={10} onChange={(event) => setPercentage(event.target.value)} disabled={saving} className={`${inputClass} mt-1`} />
        </label>
      ) : null}
      {role === 'UBO' && corporates.length ? (
        <label className="block text-xs font-medium text-slate-700">
          Held through
          <select value={viaPersonId} onChange={(event) => setViaPersonId(event.target.value)} disabled={saving} className={`${inputClass} mt-1`}>
            <option value="">Direct</option>
            {corporates.map((other) => <option key={other.id} value={other.id}>{other.fullName}</option>)}
          </select>
        </label>
      ) : null}
      <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Add
      </button>
      <button type="button" disabled={saving} onClick={onDone} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
        <X className="h-3.5 w-3.5" />Cancel
      </button>
      {error ? <p className="w-full text-xs text-red-700">{error}</p> : null}
    </form>
  );
}
