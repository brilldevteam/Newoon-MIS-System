import { FormEvent, useState } from 'react';
import { KeyRound, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PasswordInput } from '../components/PasswordInput';
import { api, getApiErrorMessage } from '../services/api';

export function ChangePasswordPage() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    if (new TextEncoder().encode(newPassword).length > 72) { setError('Password must not exceed 72 UTF-8 bytes.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword, confirmPassword });
      localStorage.removeItem('newoon_token');
      setCurrent(''); setNew(''); setConfirmation(''); setComplete(true);
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to change password. Please try again.')); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto w-full max-w-lg space-y-6">
    <h1 className="text-2xl font-semibold text-slate-950">Change password</h1>
    {complete ? <div role="status" className="space-y-4"><p className="text-sm text-emerald-700">Password changed. Sign in again with your new password.</p><Link to="/login" className="inline-flex rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Sign in again</Link></div> :
      <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
        <div><label htmlFor="current-password" className="text-sm font-medium">Current password</label><PasswordInput id="current-password" autoComplete="current-password" minLength={1} value={currentPassword} onChange={setCurrent} disabled={busy} /></div>
        <div><label htmlFor="new-password" className="text-sm font-medium">New password (at least 16 characters)</label><PasswordInput id="new-password" value={newPassword} onChange={setNew} disabled={busy} /></div>
        <div><label htmlFor="confirm-password" className="text-sm font-medium">Confirm new password</label><PasswordInput id="confirm-password" value={confirmPassword} onChange={setConfirmation} disabled={busy} /></div>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} type="submit" className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Change password</button>
      </form>}
  </section>;
}
