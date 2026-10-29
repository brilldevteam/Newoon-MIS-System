import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, Search, ShieldCheck, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { hasAnyRole, roleLabels } from '../utils/access-control';
import { getApiErrorMessage } from '../services/api';
import { createUser, getUserOptions, listUsers, ManagedUser, resetUserPassword, updateUser, UserOptions } from '../services/users.service';
import { PasswordInput } from '../components/PasswordInput';

const fieldClass = 'mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50';
type Draft = { firstName: string; lastName: string; email: string; tenantId: string; roles: string[]; status: 'ACTIVE' | 'SUSPENDED'; password: string; confirmation: string };
const emptyDraft = (): Draft => ({ firstName: '', lastName: '', email: '', tenantId: '', roles: [], status: 'ACTIVE', password: '', confirmation: '' });

function AccountDialog({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => { ref.current?.close(); }; }, []);
  return <dialog ref={ref} aria-labelledby="account-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white p-0 text-slate-950 shadow-xl backdrop:bg-black/40">
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
  return <div className="min-w-0 space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950"><Users className="h-6 w-6 text-brand-700" />Users</h1><p className="mt-1 text-sm text-slate-500">{isSuper ? 'User accounts across your companies.' : 'Team accounts and workflow roles.'}</p></div><div className="flex flex-wrap gap-2">{isSuper ? <Link to="/access-control" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium"><ShieldCheck className="h-4 w-4" />Role permissions</Link> : null}{canWrite ? <button type="button" onClick={() => open('create')} disabled={loading || !options.roles.length} className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"><Plus className="h-4 w-4" />Add user</button> : null}</div></header>
    {success ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">{success}</p> : null}
    {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p> : null}
    <div className="flex flex-wrap items-center gap-3 border-y border-slate-200 py-4">
      <div className="relative min-w-0 flex-1 basis-56"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Search users" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm" /></div>
      <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="max-w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All roles</option>{options.roles.map((role) => <option key={role.name} value={role.name}>{roleLabels[role.name] || role.name}</option>)}</select>
      <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="INVITED">Invited</option></select>
      <button type="button" title="Refresh users" aria-label="Refresh users" disabled={loading} onClick={() => void load()} className="grid h-10 w-10 place-items-center rounded-md border border-slate-300 bg-white"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
    </div>
    <p className="text-xs text-slate-500">{loading ? 'Loading...' : `${filtered.length} ${filtered.length === 1 ? 'user' : 'users'}`}</p>
    <div className="divide-y divide-slate-200 border-y border-slate-200">
      {!loading && !filtered.length ? <p className="py-10 text-center text-sm text-slate-500">{search || roleFilter || statusFilter ? 'No matching users.' : 'No users found.'}</p> : null}
      {filtered.map((item) => {
        const protectedUser = !isSuper && item.roles.some((row) => row.role.name === 'SUPER_ADMIN');
        return <div key={item.id} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-950">{item.firstName} {item.lastName}{item.id === user?.id ? <span className="ml-2 font-normal text-slate-500">(you)</span> : null}</p><p className="mt-1 break-all text-sm text-slate-500">{item.email}</p>{isSuper ? <p className="mt-1 text-xs text-slate-500">{item.tenant?.name || 'Platform account'}</p> : null}</div>
          <div className="min-w-0"><p className="break-words text-sm text-slate-700">{item.roles.map((row) => roleLabels[row.role.name] || row.role.name).join(', ')}</p><p className={`mt-1 text-xs font-medium ${item.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-500'}`}>{item.status === 'ACTIVE' ? 'Active' : item.status === 'SUSPENDED' ? 'Suspended' : 'Invited'}</p></div>
          <div className="flex gap-2">{canWrite ? <><button type="button" disabled={protectedUser} aria-label={`Edit ${item.email}`} title="Edit user" onClick={() => open('edit', item)} className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"><Pencil className="h-4 w-4" /></button><button type="button" disabled={protectedUser} aria-label={`Reset password for ${item.email}`} title="Reset password" onClick={() => open('password', item)} className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"><KeyRound className="h-4 w-4" /></button></> : null}</div>
        </div>;
      })}
    </div>
    {mode ? <AccountDialog title={mode === 'create' ? 'Add user' : mode === 'password' ? 'Reset password' : 'Edit user'} busy={busy} onClose={close}>
      <form onSubmit={submit} className="max-h-[calc(90dvh_-_70px)] space-y-5 overflow-y-auto p-5" aria-busy={busy}>
        {selected ? <p className="break-all text-sm text-slate-500">{selected.email}</p> : null}
        {mode !== 'password' ? <>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">First name<input name="firstName" value={draft.firstName} required maxLength={100} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} className={fieldClass} /></label><label className="text-sm font-medium">Last name<input name="lastName" value={draft.lastName} required maxLength={100} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} className={fieldClass} /></label></div>
          <label className="block text-sm font-medium">Email address<input type="email" name="email" autoComplete="off" required value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className={fieldClass} /></label>
          {mode === 'create' && isSuper ? <label className="block text-sm font-medium">Company<select required value={draft.tenantId} onChange={(event) => setDraft({ ...draft, tenantId: event.target.value })} className={fieldClass}><option value="">Select company</option>{options.tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}</select></label> : null}
          <fieldset disabled={self} className="space-y-3"><legend className="mb-3 text-sm font-medium">Workflow roles</legend><div className="grid gap-3 sm:grid-cols-2">{options.roles.map((role) => <label className="flex items-center gap-2 text-sm" key={role.name}><input type="checkbox" checked={draft.roles.includes(role.name)} onChange={(event) => setDraft({ ...draft, roles: event.target.checked ? [...draft.roles, role.name] : draft.roles.filter((name) => name !== role.name) })} className="h-4 w-4 accent-brand-700" />{roleLabels[role.name] || role.name}</label>)}</div></fieldset>
          {mode === 'edit' ? <label className="block text-sm font-medium">Account status<select disabled={self} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as 'ACTIVE' | 'SUSPENDED' })} className={fieldClass}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label> : null}
        </> : null}
        {mode !== 'edit' ? <><div><label htmlFor="account-password" className="text-sm font-medium">New password</label><PasswordInput id="account-password" value={draft.password} onChange={(password) => setDraft({ ...draft, password })} disabled={busy} /><p className="mt-2 text-xs text-slate-500">At least 16 characters; maximum 72 UTF-8 bytes.</p></div><div><label htmlFor="account-confirmation" className="text-sm font-medium">Confirm password</label><PasswordInput id="account-confirmation" value={draft.confirmation} onChange={(confirmation) => setDraft({ ...draft, confirmation })} disabled={busy} /></div></> : null}
        {dialogError ? <p role="alert" className="text-sm text-red-700">{dialogError}</p> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" disabled={busy} onClick={close} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">Cancel</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{busy ? 'Saving...' : mode === 'password' ? 'Update password' : mode === 'create' ? 'Create user' : 'Save changes'}</button></div>
      </form>
    </AccountDialog> : null}
  </div>;
}
