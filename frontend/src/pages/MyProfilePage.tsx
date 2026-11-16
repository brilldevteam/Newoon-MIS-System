import { FormEvent, useEffect, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle, Save, Trash2, UserCircle } from 'lucide-react';
import { getSelfProfile, saveSelfProfile, SelfProfile } from '../services/profile.service';
import { getApiErrorMessage } from '../services/api';
import { AccountSettingsLayout } from '../components/AccountSettingsLayout';

export function MyProfilePage() {
  const [account, setAccount] = useState<SelfProfile | null>(null);
  const [firstName, setFirst] = useState(''); const [lastName, setLast] = useState('');
  const [bio, setBio] = useState(''); const [avatarDataUrl, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getSelfProfile().then((data) => { if (!active) return; setAccount(data); setFirst(data.firstName); setLast(data.lastName); setBio(data.profile?.bio || ''); setAvatar(data.profile?.avatarDataUrl || null); })
      .catch((err) => { if (active) setError(getApiErrorMessage(err, 'Unable to load profile.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function picture(file?: File) {
    if (!file) return;
    setError(''); setSaved(false);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Choose a PNG, JPEG or WebP picture up to 2 MB.'); return; }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width > 8192 || bitmap.height > 8192) throw new Error('Image too large');
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const context = canvas.getContext('2d'); if (!context) throw new Error('Image unavailable');
        const size = Math.min(bitmap.width, bitmap.height);
        context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
        const result = canvas.toDataURL('image/png');
        if (result.length > 180000) throw new Error('Image too complex');
        setAvatar(result);
      } finally { bitmap.close(); }
    } catch { setError('Unable to use this picture. Try a smaller image.'); } finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setSaved(false);
    try {
      await saveSelfProfile({ firstName: firstName.trim(), lastName: lastName.trim(), bio, avatarDataUrl });
      window.dispatchEvent(new Event('profile-updated')); setSaved(true);
    } catch (err) { setError(getApiErrorMessage(err, 'Unable to save profile.')); } finally { setBusy(false); }
  }
  return <AccountSettingsLayout title="My Profile">
    {loading ? <p role="status" className="flex items-center gap-2 p-6 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading profile...</p> : <>
      {error && <p role="alert" className="m-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {account && <form onSubmit={submit} aria-busy={busy}>
        <div className="flex flex-wrap items-center gap-5 border-b border-slate-200 bg-slate-50/70 p-5 sm:px-7 sm:py-6">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-brand-600 ring-4 ring-white shadow-sm">{avatarDataUrl ? <img src={avatarDataUrl} alt="Profile picture" className="h-full w-full object-cover" /> : <UserCircle className="h-12 w-12" />}</span>
          <div className="min-w-0 space-y-2"><h2 className="text-sm font-semibold text-slate-900">Profile picture</h2><div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-within:ring-2 focus-within:ring-brand-600"><Camera className="h-4 w-4" />Change picture<input aria-label="Profile picture" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only" onChange={(event) => { void picture(event.target.files?.[0]); event.target.value = ''; }} /></label>
            {avatarDataUrl && <button title="Remove picture" aria-label="Remove picture" type="button" disabled={busy} onClick={() => { setAvatar(null); setSaved(false); }} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
          </div><p className="text-xs text-slate-500">PNG, JPEG or WebP. Maximum 2 MB.</p></div>
        </div>
        <div className="space-y-6 p-5 sm:p-7">
          <h2 className="text-sm font-semibold text-slate-950">Personal details</h2>
          <div className="grid gap-5 sm:grid-cols-2">{[{ label: 'First name', id: 'profile-first', value: firstName, set: setFirst }, { label: 'Last name', id: 'profile-last', value: lastName, set: setLast }].map((field) => <div key={field.id}><label htmlFor={field.id} className="text-sm font-medium text-slate-700">{field.label}</label><input id={field.id} value={field.value} onChange={(event) => { field.set(event.target.value); setSaved(false); }} required maxLength={80} disabled={busy} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50" /></div>)}</div>
          <dl className="grid gap-5 border-y border-slate-100 py-5 text-sm sm:grid-cols-2"><div><dt className="text-xs font-medium text-slate-500">Email address</dt><dd className="mt-2 break-all text-slate-800">{account.email}</dd></div><div><dt className="text-xs font-medium text-slate-500">Role</dt><dd className="mt-2 break-words font-medium text-slate-800">{account.roles.map((row) => row.role.name.replace(/_/g, ' ')).join(', ')}</dd></div></dl>
          <div><div className="flex items-center justify-between gap-3"><label htmlFor="profile-bio" className="text-sm font-medium text-slate-700">Bio</label><span className="text-xs text-slate-400">Optional</span></div><textarea id="profile-bio" rows={4} maxLength={500} value={bio} disabled={busy} onChange={(event) => { setBio(event.target.value); setSaved(false); }} className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /><p className="mt-1 text-right text-xs tabular-nums text-slate-400">{bio.length}/500</p></div>
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-4 border-t border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-7">
          {saved && <p role="status" className="mr-auto flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Profile saved.</p>}
          <button type="submit" disabled={busy} className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-md bg-brand-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saving...' : 'Save profile'}</button>
        </footer>
      </form>}
    </>}
  </AccountSettingsLayout>;
}
