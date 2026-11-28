import { useConfirm } from '../components/ConfirmProvider';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Building2, KeyRound, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserX, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { hasAnyRole, roleLabels } from '../utils/access-control';
import { getApiErrorMessage } from '../services/api';
import { createUser, deleteUser, getUserOptions, listUsersTable, ManagedUser, resetUserPassword, updateUser, UserOptions } from '../services/users.service';
import { EmptyRow, FilterSelect, IconAction, Pill, QuickTabs, SortHeader, TableCard, TablePager, TableSkeleton, TableToolbar, tableCellClass, tableHeadClass } from '../components/table/TableParts';
import { useServerTable } from '../components/table/useServerTable';
import { PasswordInput } from '../components/PasswordInput';
import { passwordPolicyError } from '../utils/password-policy';
import { StatCard } from '../components/StatCard';

const fieldClass = 'mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50';
type Draft = { firstName: string; lastName: string; email: string; tenantId: string; roles: string[]; status: 'ACTIVE' | 'SUSPENDED'; password: string; confirmation: string };
const emptyDraft = (): Draft => ({ firstName: '', lastName: '', email: '', tenantId: '', roles: [], status: 'ACTIVE', password: '', confirmation: '' });

const roleTone: Record<string, 'slate' | 'green' | 'blue' | 'amber' | 'red' | 'violet'> = {
  SUPER_ADMIN: 'slate', COMPANY_ADMIN: 'slate', AML_TEAM: 'blue', AML_SUPERVISOR: 'blue', DMLRO: 'violet', MLRO: 'violet',
  SEF: 'amber', OPERATING_TEAM: 'green', ACCOUNTING_TEAM: 'green', HR_TEAM: 'red', CEO: 'violet'
};
const statusStyle: Record<ManagedUser['status'], { label: string; tone: 'green' | 'red' | 'amber' }> = {
  ACTIVE: { label: 'Active', tone: 'green' },
  SUSPENDED: { label: 'Suspended', tone: 'red' },
  INVITED: { label: 'Invited', tone: 'amber' }
};
const tabs = [{ value: 'all', label: 'All users' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'invited', label: 'Invited' }];
const sortOptions = [{ value: 'created', label: 'Date added' }, { value: 'name', label: 'Name' }, { value: 'email', label: 'Email' }, { value: 'status', label: 'Status' }];
const filterKeys = ['role', 'status'];
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

function AccountDialog({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => { ref.current?.close(); }; }, []);
  return <dialog ref={ref} aria-labelledby="account-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-950 shadow-xl backdrop:bg-black/40">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><h2 id="account-dialog-title" className="text-lg font-semibold">{title}</h2><button type="button" disabled={busy} aria-label="Close dialog" title="Close" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
    {children}
  </dialog>;
}

export function UsersPage() {
  const { confirm } = useConfirm();
  const { user, loading: authLoading } = useAuth();
  const [options, setOptions] = useState<UserOptions>({ roles: [], tenants: [] });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'create' | 'edit' | 'password' | null>(null);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const canManage = hasAnyRole(user, ['SUPER_ADMIN', 'COMPANY_ADMIN']);
  const isSuper = hasAnyRole(user, ['SUPER_ADMIN']);
  const canWrite = canManage && (isSuper || !user?.accessControlConfigured || Boolean(user.permissions?.includes('administration.edit')));

  const table = useServerTable(listUsersTable, { defaultSort: 'created', defaultDir: 'desc', filterKeys, enabled: !authLoading && canManage });
  useEffect(() => {
    if (authLoading || !canManage) return;
    getUserOptions().then(setOptions).catch((requestError) => setError(getApiErrorMessage(requestError, 'Unable to load users.')));
  }, [authLoading, canManage]);

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
    if (mode !== 'edit') {
      const policyError = passwordPolicyError(draft.password);
      if (policyError) { setDialogError(policyError); return; }
      if (draft.password !== draft.confirmation) { setDialogError('Passwords do not match.'); return; }
    }
    if (mode !== 'password' && !draft.roles.length) { setDialogError('Select at least one role.'); return; }
    setBusy(true); setSuccess('');
    try {
      if (mode === 'password' && selected) { await resetUserPassword(selected.id, draft.password); setSuccess('Password updated. Share it through your approved private channel.'); }
      else {
        const profile = { firstName: draft.firstName, lastName: draft.lastName, email: draft.email.trim().toLowerCase(), roles: draft.roles };
        const result = mode === 'edit' && selected ? await updateUser(selected.id, { ...profile, status: draft.status }) : await createUser({ ...profile, password: draft.password, ...(isSuper ? { tenantId: draft.tenantId } : {}) });
        void result; table.reload();
        setSuccess(mode === 'edit' ? 'User updated.' : 'User created. Share the login details through your approved private channel.');
      }
      close();
    } catch (requestError) { setDialogError(getApiErrorMessage(requestError, 'Unable to save this account.')); }
    finally { setBusy(false); }
  }

  // Deleting is for accounts that never did any work (mistaken or test accounts). The server refuses anyone with
  // recorded workflow activity and explains that they should be suspended instead.
  async function remove(item: ManagedUser) {
    if (!canWrite || deletingId) return;
    if (!(await confirm({ title: 'Delete this account?', message: `Delete the account ${item.firstName} ${item.lastName} (${item.email})? This cannot be undone.

If this person has worked on enquiries or KYC files, the account will not be deleted - suspend it instead.`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    setDeletingId(item.id); setError(''); setSuccess('');
    try {
      await deleteUser(item.id);
      table.removeRow((row) => row.id === item.id); table.reload();
      setSuccess(`${item.firstName} ${item.lastName} was deleted.`);
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to delete this account.')); }
    finally { setDeletingId(''); }
  }

  if (authLoading) return <p className="text-sm text-slate-500">Loading users...</p>;
  if (!canManage) return <p role="alert" className="text-sm text-red-700">Only administrators can manage users.</p>;
  const self = selected?.id === user?.id;
  const columns = 6;
  const shownError = error || table.error;

  const actions = (item: ManagedUser) => {
    if (!canWrite) return null;
    const protectedUser = !isSuper && item.roles.some((row) => row.role.name === 'SUPER_ADMIN');
    const lockedTitle = 'Only a Super Admin can change this account';
    return (
      <div className="flex justify-end gap-0.5">
        <IconAction label={protectedUser ? lockedTitle : `Edit ${item.email}`} disabled={protectedUser} onClick={() => open('edit', item)}><Pencil className="h-4 w-4" /></IconAction>
        <IconAction label={protectedUser ? lockedTitle : `Reset password for ${item.email}`} disabled={protectedUser} onClick={() => open('password', item)}><KeyRound className="h-4 w-4" /></IconAction>
        {item.id !== user?.id ? (
          <IconAction tone="danger" label={item.roles.some((row) => row.role.name === 'SUPER_ADMIN') ? 'Platform administrators cannot be deleted' : `Delete ${item.email}`} disabled={protectedUser || item.roles.some((row) => row.role.name === 'SUPER_ADMIN') || deletingId === item.id} onClick={() => void remove(item)}>
            {deletingId === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </IconAction>
        ) : null}
      </div>
    );
  };

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Users</h1>
        <p className="mt-1 text-sm text-slate-500">{isSuper ? 'User accounts and workflow roles across your companies.' : 'Team accounts and workflow roles.'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {isSuper ? <Link to="/access-control" className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><ShieldCheck className="h-4 w-4" />Role permissions</Link> : null}
        {canWrite ? <button type="button" onClick={() => open('create')} disabled={!options.roles.length} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"><Plus className="h-4 w-4" />Add user</button> : null}
      </div>
    </header>

    {success ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">{success}</p> : null}
    {shownError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{shownError}</p> : null}

    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <StatCard label="Total users" value={table.counts.scopeAll ?? 0} detail={isSuper ? 'All companies' : 'In your company'} icon={Users} tone="blue" />
      <StatCard label="Active" value={table.counts.scopeActive ?? 0} detail="Can sign in" icon={UserCheck} tone="green" />
      <StatCard label="Suspended" value={table.counts.scopeSuspended ?? 0} detail="Sign-in blocked" icon={UserX} tone={table.counts.scopeSuspended ? 'rose' : 'slate'} />
      <StatCard label="Administrators" value={table.counts.scopeAdmins ?? 0} detail="Super or company admin" icon={ShieldCheck} tone="amber" />
    </div>

    <TableCard>
      <TableToolbar
        query={table.params.q}
        onQuery={table.setQuery}
        placeholder={isSuper ? 'Search name, email or company' : 'Search name or email'}
        sort={table.params.sort}
        dir={table.params.dir}
        sortOptions={sortOptions}
        onSort={table.setSort}
        activeFilterCount={table.activeFilterCount}
        onClearFilters={table.clearFilters}
        filters={<>
          <FilterSelect label="Role" value={table.params.filters.role || ''} onChange={(value) => table.setFilter('role', value)} options={options.roles.map((role) => ({ value: role.name, label: roleLabels[role.name] || role.name }))} />
          <FilterSelect label="Status" value={table.params.filters.status || ''} onChange={(value) => table.setFilter('status', value)} options={Object.entries(statusStyle).map(([value, style]) => ({ value, label: style.label }))} />
        </>}
      />
      <QuickTabs tabs={tabs} active={table.params.tab} counts={table.counts} onChange={table.setTab} />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr>
              <SortHeader label="User" sortKey="name" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
              {isSuper ? <th scope="col" className={tableHeadClass}>Company</th> : null}
              <th scope="col" className={tableHeadClass}>Roles</th>
              <SortHeader label="Status" sortKey="status" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
              <SortHeader label="Added" sortKey="created" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
              {canWrite ? <th scope="col" className={`${tableHeadClass} text-right`}><span className="sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.loading && !table.rows.length ? (
              <TableSkeleton columns={columns} />
            ) : table.rows.length ? (
              table.rows.map((item) => {
                const status = statusStyle[item.status] || statusStyle.INVITED;
                return (
                  <tr key={item.id} className={`hover:bg-slate-50/70 ${table.loading ? 'opacity-60' : ''}`}>
                    <td className={`${tableCellClass} max-w-xs`}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-semibold ${avatarTone(item.id)}`} aria-hidden="true">{initials(item)}</span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-950">
                            <span className="break-words">{item.firstName} {item.lastName}</span>
                            {item.id === user?.id ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">You</span> : null}
                          </p>
                          <p className="break-all text-xs text-slate-500">{item.email}</p>
                        </div>
                      </div>
                    </td>
                    {isSuper ? (
                      <td className={`${tableCellClass} whitespace-nowrap text-slate-600`}>
                        {item.tenant ? <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-slate-400" />{item.tenant.name}</span> : <span className="text-xs font-medium text-slate-500">Platform account</span>}
                      </td>
                    ) : null}
                    <td className={tableCellClass}>
                      {item.roles.length ? (
                        <div className="flex flex-wrap gap-1.5">{item.roles.map((row) => <Pill key={row.role.id} tone={roleTone[row.role.name] || 'slate'}>{roleLabels[row.role.name] || row.role.name}</Pill>)}</div>
                      ) : <span className="text-xs text-slate-400">No role</span>}
                    </td>
                    <td className={tableCellClass}><Pill tone={status.tone}>{status.label}</Pill></td>
                    <td className={`${tableCellClass} whitespace-nowrap text-slate-600`}>{formatDate(item.createdAt)}</td>
                    {canWrite ? <td className={tableCellClass}>{actions(item)}</td> : null}
                  </tr>
                );
              })
            ) : (
              <EmptyRow columns={columns} filtered={table.isFiltered} emptyText="No users found." onReset={table.reset} />
            )}
          </tbody>
        </table>
      </div>
      <TablePager page={table.params.page} pageSize={table.params.pageSize} total={table.total} onPage={table.setPage} onPageSize={table.setPageSize} loading={table.loading} />
    </TableCard>

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
        {mode !== 'edit' ? <><div><label htmlFor="account-password" className="text-sm font-medium">New password</label><PasswordInput id="account-password" value={draft.password} onChange={(password) => setDraft({ ...draft, password })} disabled={busy} showRules /></div><div><label htmlFor="account-confirmation" className="text-sm font-medium">Confirm password</label><PasswordInput id="account-confirmation" value={draft.confirmation} onChange={(confirmation) => setDraft({ ...draft, confirmation })} disabled={busy} /></div></> : null}
        {dialogError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dialogError}</p> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" disabled={busy} onClick={close} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">Cancel</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{busy ? 'Saving...' : mode === 'password' ? 'Update password' : mode === 'create' ? 'Create user' : 'Save changes'}</button></div>
      </form>
    </AccountDialog> : null}
  </div>;
}
