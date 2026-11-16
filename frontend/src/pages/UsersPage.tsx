import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserCheck, UserX, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { hasAnyRole, roleLabels } from '../utils/access-control';
import { getApiErrorMessage } from '../services/api';
import { createUser, getUserOptions, listUsers, ManagedUser, resetUserPassword, updateUser, UserOptions } from '../services/users.service';
import { PasswordInput } from '../components/PasswordInput';
import { StatCard } from '../components/StatCard';

const fieldClass = 'mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50';
const controlClass = 'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
type Draft = { firstName: string; lastName: string; email: string; tenantId: string; roles: string[]; status: 'ACTIVE' | 'SUSPENDED'; password: string; confirmation: string };
const emptyDraft = (): Draft => ({ firstName: '', lastName: '', email: '', tenantId: '', roles: [], status: 'ACTIVE', password: '', confirmation: '' });

// Colour families for role chips: administrators, compliance review chain, and operational teams.
const roleTone: Record<string, string> = {
  SUPER_ADMIN: 'bg-slate-900 text-white ring-slate-900',
  COMPANY_ADMIN: 'bg-slate-100 text-slate-800 ring-slate-300',
  AML_TEAM: 'bg-sky-50 text-sky-700 ring-sky-200',
  AML_SUPERVISOR: 'bg-sky-50 text-sky-800 ring-sky-300',
  DMLRO: 'bg-violet-50 text-violet-700 ring-violet-200',
  MLRO: 'bg-violet-50 text-violet-800 ring-violet-300',
  SEF: 'bg-amber-50 text-amber-800 ring-amber-200',
  OPERATING_TEAM: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ACCOUNTING_TEAM: 'bg-teal-50 text-teal-700 ring-teal-200',
  HR_TEAM: 'bg-rose-50 text-rose-700 ring-rose-200'
};
const statusStyle: Record<ManagedUser['status'], { label: string; dot: string; text: string }> = {
  ACTIVE: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  SUSPENDED: { label: 'Suspended', dot: 'bg-rose-500', text: 'text-rose-700' },
  INVITED: { label: 'Invited', dot: 'bg-amber-500', text: 'text-amber-700' }
};
const avatarTones = ['bg-brand-100 text-brand-800', 'bg-sky-100 text-sky-800', 'bg-violet-100 text-violet-800', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800', 'bg-teal-100 text-teal-800'];

function initials(item: ManagedUser) {
  return `${item.firstName.trim()[0] || ''}${item.lastName.trim()[0] || ''}`.toUpperCase() || item.email[0].toUpperCase();
}

function avatarTone(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return avatarTones[hash % avatarTones.length];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

// Renders either the table or the card list, so each user has a single set of controls in the page.
function useWideLayout() {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof window === 'undefined' || window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

function RoleChips({ item }: { item: ManagedUser }) {
  if (!item.roles.length) return <span className="text-xs text-slate-400">No role</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {item.roles.map((row) => (
        <span key={row.role.id} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${roleTone[row.role.name] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
          {roleLabels[row.role.name] || row.role.name}
        </span>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ManagedUser['status'] }) {
  const style = statusStyle[status] || statusStyle.INVITED;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${style.text}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}

function AccountDialog({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => { ref.current?.close(); }; }, []);
  return <dialog ref={ref} aria-labelledby="account-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-950 shadow-xl backdrop:bg-black/40">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><h2 id="account-dialog-title" className="text-lg font-semibold">{title}</h2><button type="button" disabled={busy} aria-label="Close dialog" title="Close" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
    {children}
  </dialog>;
}

export function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [options, setOptions] = useState<UserOptions>({ roles: [], tenants: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'create' | 'edit' | 'password' | null>(null);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const canManage = hasAnyRole(user, ['SUPER_ADMIN', 'COMPANY_ADMIN']);
  const isSuper = hasAnyRole(user, ['SUPER_ADMIN']);
  const wide = useWideLayout();
  const canWrite = canManage && (isSuper || !user?.accessControlConfigured || Boolean(user.permissions?.includes('administration.edit')));

  async function load() {
    setLoading(true); setError('');
    try { const [items, choices] = await Promise.all([listUsers(), getUserOptions()]); setRows(items); setOptions(choices); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to load users.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (!authLoading && canManage) void load(); }, [authLoading, canManage]);
  const filtered = useMemo(() => rows.filter((item) => {
    const text = `${item.firstName} ${item.lastName} ${item.email} ${item.tenant?.name || ''}`.toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (!roleFilter || item.roles.some((row) => row.role.name === roleFilter)) && (!statusFilter || item.status === statusFilter);
  }), [rows, search, roleFilter, statusFilter]);
  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((item) => item.status === 'ACTIVE').length,
    suspended: rows.filter((item) => item.status === 'SUSPENDED').length,
    admins: rows.filter((item) => item.roles.some((row) => ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(row.role.name))).length
  }), [rows]);

  function open(nextMode: 'create' | 'edit' | 'password', item?: ManagedUser) {
    if (!canWrite) return;
    setSelected(item || null); setDialogError('');
    setDraft(item ? { ...emptyDraft(), firstName: item.firstName, lastName: item.lastName, email: item.email, tenantId: item.tenantId || '', roles: item.roles.map((row) => row.role.name), status: item.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE' } : { ...emptyDraft(), tenantId: user?.tenantId || options.tenants[0]?.id || '' });
    setMode(nextMode);
  }
  function close() { setMode(null); setSelected(null); setDraft(emptyDraft()); setDialogError(''); }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !canWrite) return;
    setDialogError('');
    if (mode !== 'edit' && (draft.password.length < 16 || new TextEncoder().encode(draft.password).length > 72 || draft.password !== draft.confirmation)) { setDialogError('Passwords must match, contain at least 16 characters and fit within 72 UTF-8 bytes.'); return; }
    if (mode !== 'password' && !draft.roles.length) { setDialogError('Select at least one role.'); return; }
    setBusy(true); setSuccess('');
    try {
      if (mode === 'password' && selected) { await resetUserPassword(selected.id, draft.password); setSuccess('Password updated. Share it through your approved private channel.'); }
      else {
        const profile = { firstName: draft.firstName, lastName: draft.lastName, email: draft.email.trim().toLowerCase(), roles: draft.roles };
        const result = mode === 'edit' && selected ? await updateUser(selected.id, { ...profile, status: draft.status }) : await createUser({ ...profile, password: draft.password, ...(isSuper ? { tenantId: draft.tenantId } : {}) });
        setRows((current) => mode === 'edit' ? current.map((item) => item.id === result.id ? result : item) : [result, ...current]);
        setSuccess(mode === 'edit' ? 'User updated.' : 'User created. Share the login details through your approved private channel.');
      }
      close();
    } catch (requestError) { setDialogError(getApiErrorMessage(requestError, 'Unable to save this account.')); }
    finally { setBusy(false); }
  }

  if (authLoading) return <p className="text-sm text-slate-500">Loading users...</p>;
  if (!canManage) return <p role="alert" className="text-sm text-red-700">Only administrators can manage users.</p>;
  const self = selected?.id === user?.id;
  const filtersActive = Boolean(search || roleFilter || statusFilter);

  const actions = (item: ManagedUser) => {
    if (!canWrite) return null;
    const protectedUser = !isSuper && item.roles.some((row) => row.role.name === 'SUPER_ADMIN');
    return (
      <div className="flex justify-end gap-1.5">
        <button type="button" disabled={protectedUser} aria-label={`Edit ${item.email}`} title={protectedUser ? 'Only a Super Admin can change this account' : 'Edit user'} onClick={() => open('edit', item)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          <Pencil className="h-3.5 w-3.5" />Edit
        </button>
        <button type="button" disabled={protectedUser} aria-label={`Reset password for ${item.email}`} title={protectedUser ? 'Only a Super Admin can change this account' : 'Reset password'} onClick={() => open('password', item)} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          <KeyRound className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const identity = (item: ManagedUser) => (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${avatarTone(item.id)}`} aria-hidden="true">{initials(item)}</span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-950">
          <span className="break-words">{item.firstName} {item.lastName}</span>
          {item.id === user?.id ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">You</span> : null}
        </p>
        <p className="break-all text-sm text-slate-500">{item.email}</p>
      </div>
    </div>
  );

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Users</h1>
        <p className="mt-1 text-sm text-slate-500">{isSuper ? 'User accounts and workflow roles across your companies.' : 'Team accounts and workflow roles.'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {isSuper ? <Link to="/access-control" className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><ShieldCheck className="h-4 w-4" />Role permissions</Link> : null}
        {canWrite ? <button type="button" onClick={() => open('create')} disabled={loading || !options.roles.length} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"><Plus className="h-4 w-4" />Add user</button> : null}
      </div>
    </header>

    {success ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">{success}</p> : null}
    {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p> : null}

    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <StatCard label="Total users" value={stats.total} detail={isSuper ? 'All companies' : 'In your company'} icon={Users} tone="blue" />
      <StatCard label="Active" value={stats.active} detail="Can sign in" icon={UserCheck} tone="green" />
      <StatCard label="Suspended" value={stats.suspended} detail="Sign-in blocked" icon={UserX} tone={stats.suspended ? 'rose' : 'slate'} />
      <StatCard label="Administrators" value={stats.admins} detail="Super or company admin" icon={ShieldCheck} tone="amber" />
    </div>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input aria-label="Search users" placeholder={isSuper ? 'Search name, email or company' : 'Search name or email'} value={search} onChange={(event) => setSearch(event.target.value)} className={`${controlClass} w-full py-2 pl-9`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={controlClass}><option value="">All roles</option>{options.roles.map((role) => <option key={role.name} value={role.name}>{roleLabels[role.name] || role.name}</option>)}</select>
          <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={controlClass}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="INVITED">Invited</option></select>
          {filtersActive ? <button type="button" onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }} className="px-2 text-sm font-medium text-slate-500 hover:text-slate-800">Clear</button> : null}
          <button type="button" title="Refresh users" aria-label="Refresh users" disabled={loading} onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {wide ? (
      <div className="scrollbar-thin overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              {isSuper ? <th className="px-4 py-3">Company</th> : null}
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Added</th>
              {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !rows.length ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-slate-400" />Loading users...</td></tr>
            ) : !filtered.length ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">{filtersActive ? 'No matching users.' : 'No users found.'}</td></tr>
            ) : filtered.map((item) => (
              <tr key={item.id} className={`hover:bg-slate-50/70 ${item.status === 'SUSPENDED' ? 'bg-slate-50/60' : ''}`}>
                <td className="max-w-xs px-4 py-3">{identity(item)}</td>
                {isSuper ? (
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {item.tenant ? <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-slate-400" />{item.tenant.name}</span> : <span className="text-xs font-medium text-slate-500">Platform account</span>}
                  </td>
                ) : null}
                <td className="px-4 py-3"><RoleChips item={item} /></td>
                <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={item.status} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
                {canWrite ? <td className="px-4 py-3">{actions(item)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      ) : (
      <ul className="divide-y divide-slate-100">
        {loading && !rows.length ? <li className="px-4 py-10 text-center text-sm text-slate-500">Loading users...</li> : null}
        {!loading && !filtered.length ? <li className="px-4 py-10 text-center text-sm text-slate-500">{filtersActive ? 'No matching users.' : 'No users found.'}</li> : null}
        {filtered.map((item) => (
          <li key={item.id} className="space-y-3 px-4 py-4">
            {identity(item)}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <StatusBadge status={item.status} />
              {isSuper ? <span className="text-xs text-slate-500">{item.tenant?.name || 'Platform account'}</span> : null}
            </div>
            <RoleChips item={item} />
            {actions(item)}
          </li>
        ))}
      </ul>
      )}

      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        {loading ? 'Loading...' : `Showing ${filtered.length} of ${rows.length} ${rows.length === 1 ? 'user' : 'users'}`}
      </div>
    </section>

    {mode ? <AccountDialog title={mode === 'create' ? 'Add user' : mode === 'password' ? 'Reset password' : 'Edit user'} busy={busy} onClose={close}>
      <form onSubmit={submit} className="max-h-[calc(90dvh_-_70px)] space-y-5 overflow-y-auto p-5" aria-busy={busy}>
        {selected ? (
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${avatarTone(selected.id)}`} aria-hidden="true">{initials(selected)}</span>
            <div className="min-w-0"><p className="text-sm font-medium text-slate-900">{selected.firstName} {selected.lastName}</p><p className="break-all text-xs text-slate-500">{selected.email}</p></div>
          </div>
        ) : null}
        {mode !== 'password' ? <>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">First name<input name="firstName" value={draft.firstName} required maxLength={100} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} className={fieldClass} /></label><label className="text-sm font-medium">Last name<input name="lastName" value={draft.lastName} required maxLength={100} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} className={fieldClass} /></label></div>
          <label className="block text-sm font-medium">Email address<input type="email" name="email" autoComplete="off" required value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className={fieldClass} /></label>
          {mode === 'create' && isSuper ? <label className="block text-sm font-medium">Company<select required value={draft.tenantId} onChange={(event) => setDraft({ ...draft, tenantId: event.target.value })} className={fieldClass}><option value="">Select company</option>{options.tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}</select></label> : null}
          <fieldset disabled={self} className="space-y-3">
            <legend className="mb-1 text-sm font-medium">Workflow roles</legend>
            {self ? <p className="text-xs text-slate-500">You cannot change your own roles.</p> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {options.roles.map((role) => {
                const checked = draft.roles.includes(role.name);
                return (
                  <label key={role.name} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${checked ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-700 hover:border-slate-300'} ${self ? 'cursor-not-allowed opacity-60' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={(event) => setDraft({ ...draft, roles: event.target.checked ? [...draft.roles, role.name] : draft.roles.filter((name) => name !== role.name) })} className="h-4 w-4 accent-brand-700" />
                    {roleLabels[role.name] || role.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {mode === 'edit' ? <label className="block text-sm font-medium">Account status<select disabled={self} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as 'ACTIVE' | 'SUSPENDED' })} className={fieldClass}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label> : null}
        </> : null}
        {mode !== 'edit' ? <><div><label htmlFor="account-password" className="text-sm font-medium">New password</label><PasswordInput id="account-password" value={draft.password} onChange={(password) => setDraft({ ...draft, password })} disabled={busy} /><p className="mt-2 text-xs text-slate-500">At least 16 characters; maximum 72 UTF-8 bytes.</p></div><div><label htmlFor="account-confirmation" className="text-sm font-medium">Confirm password</label><PasswordInput id="account-confirmation" value={draft.confirmation} onChange={(confirmation) => setDraft({ ...draft, confirmation })} disabled={busy} /></div></> : null}
        {dialogError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dialogError}</p> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" disabled={busy} onClick={close} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">Cancel</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{busy ? 'Saving...' : mode === 'password' ? 'Update password' : mode === 'create' ? 'Create user' : 'Save changes'}</button></div>
      </form>
    </AccountDialog> : null}
  </div>;
}
