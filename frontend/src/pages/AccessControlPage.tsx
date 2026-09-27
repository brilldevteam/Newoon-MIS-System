import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccessLevel, AccessMatrix, getAccessMatrix, updateRoleAccess } from '../services/access-control.service';
import { roleLabels } from '../utils/access-control';

const levels: Array<{ value: AccessLevel; label: string }> = [
  { value: 'NONE', label: 'No access' },
  { value: 'VIEW', label: 'View' },
  { value: 'EDIT', label: 'Edit' }
];

export function AccessControlPage() {
  const [matrix, setMatrix] = useState<AccessMatrix | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [draft, setDraft] = useState<Record<string, AccessLevel>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    getAccessMatrix().then((data) => {
      setMatrix(data);
      const firstRole = data.roles.find((role) => role.name !== 'SUPER_ADMIN')?.name || '';
      setSelectedRole(firstRole);
    }).catch(() => setError('Unable to load role access settings.'));
  }, []);

  const role = matrix?.roles.find((item) => item.name === selectedRole);
  const values = Object.keys(draft).length ? draft : role?.levels || {};

  useEffect(() => {
    setDraft({});
    setSuccess('');
  }, [selectedRole]);

  async function save() {
    if (!selectedRole) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updateRoleAccess(selectedRole, values);
      setMatrix(updated);
      setDraft({});
      setSuccess(`${roleLabels[selectedRole] || selectedRole} access saved.`);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to save access settings.');
    } finally {
      setSaving(false);
    }
  }

  if (!matrix) return <p className="text-sm text-slate-500">Loading access controls...</p>;

  return <div className="space-y-6">
    <div>
      <Link to="/users" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800"><ArrowLeft className="h-4 w-4" />Back to users</Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-950">Access Control</h1>
      <p className="mt-1 text-sm text-slate-500">Set what each role can see and change across the application.</p>
    </div>
    {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    {success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{success}</p> : null}
    <section className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Roles</p>
        <div className="space-y-1">
          {matrix.roles.map((item) => <button key={item.name} type="button" onClick={() => setSelectedRole(item.name)} className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium ${selectedRole === item.name ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-50'}`}>
            {roleLabels[item.name] || item.name}
            {item.name === 'SUPER_ADMIN' ? <span className="ml-2 text-xs text-slate-500">Protected</span> : null}
          </button>)}
        </div>
      </aside>
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-base font-semibold text-slate-950">{roleLabels[selectedRole] || selectedRole}</h2><p className="mt-1 text-sm text-slate-500">Choose one access level for each application area.</p></div>
          {selectedRole !== 'SUPER_ADMIN' ? <button type="button" onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save access'}</button> : null}
        </div>
        <div className="divide-y divide-slate-100">
          {matrix.areas.map((area) => <div key={area.key} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(220px,1fr)_minmax(420px,1.2fr)] lg:items-center">
            <div><p className="font-semibold text-slate-900">{area.label}</p><p className="mt-1 text-sm text-slate-500">{area.description}</p></div>
            <div className="grid grid-cols-3 gap-2">
              {levels.map((level) => <label key={level.value} className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${values[area.key] === level.value ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'} ${selectedRole === 'SUPER_ADMIN' ? 'cursor-not-allowed opacity-70' : ''}`}>
                <input type="radio" name={`${selectedRole}-${area.key}`} value={level.value} checked={values[area.key] === level.value} disabled={selectedRole === 'SUPER_ADMIN'} onChange={() => setDraft((current) => ({ ...values, ...current, [area.key]: level.value }))} className="accent-brand-600" />
                {level.label}
              </label>)}
            </div>
          </div>)}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600"><ShieldCheck className="h-4 w-4 text-brand-700" />Super Admin always retains full access and cannot be removed from this screen.</div>
      </section>
    </section>
  </div>;
}
