import { FormEvent, useState } from 'react';
import { CheckCircle2, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PasswordInput } from '../components/PasswordInput';
import { api, getApiErrorMessage } from '../services/api';
import { AccountSettingsLayout } from '../components/AccountSettingsLayout';
import { passwordPolicyError } from '../utils/password-policy';

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
    const policyError = passwordPolicyError(newPassword);
    if (policyError) { setError(policyError); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword, confirmPassword });
      localStorage.removeItem('newoon_token');
      setCurrent(''); setNew(''); setConfirmation(''); setComplete(true);
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to change password. Please try again.')); }
    finally { setBusy(false); }
  }

  return <AccountSettingsLayout title="Change password">
    <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-5 sm:px-7"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-brand-100 bg-white text-brand-700"><ShieldCheck className="h-5 w-5" /></span><h2 className="text-sm font-semibold text-slate-900">Account security</h2></div>
    {complete ? <div role="status" className="space-y-5 p-5 sm:p-7"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><p className="text-sm text-emerald-700">Password changed. Sign in again with your new password.</p><Link to="/login" className="inline-flex rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white">Sign in again</Link></div> :
      <form onSubmit={submit} aria-busy={busy}>
        <div className="max-w-xl space-y-5 p-5 sm:p-7">
        <div><label htmlFor="current-password" className="text-sm font-medium">Current password</label><PasswordInput id="current-password" autoComplete="current-password" minLength={1} value={currentPassword} onChange={setCurrent} disabled={busy} /></div>
        <div><label htmlFor="new-password" className="text-sm font-medium">New password</label><PasswordInput id="new-password" value={newPassword} onChange={setNew} disabled={busy} showRules /></div>
        <div><label htmlFor="confirm-password" className="text-sm font-medium">Confirm new password</label><PasswordInput id="confirm-password" value={confirmPassword} onChange={setConfirmation} disabled={busy} /></div>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
        <footer className="flex justify-end border-t border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-7"><button disabled={busy} type="submit" className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-md bg-brand-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Change password</button></footer>
      </form>}
  </AccountSettingsLayout>;
}
