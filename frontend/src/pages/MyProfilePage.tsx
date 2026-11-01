import { FormEvent, useEffect, useState } from 'react';
import { Camera, Save, Trash2, UserCircle } from 'lucide-react';
import { getSelfProfile, saveSelfProfile, SelfProfile } from '../services/profile.service';
import { getApiErrorMessage } from '../services/api';
import { Link } from 'react-router-dom';

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
  if (loading) return <p role="status">Loading profile...</p>;
  return <section className="mx-auto w-full max-w-2xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">My Profile</h1><Link to="/account/password" className="text-sm font-semibold text-brand-700">Change Password</Link></header>
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {account && <form onSubmit={submit} className="space-y-6" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-4"><span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">{avatarDataUrl ? <img src={avatarDataUrl} alt="Profile picture" className="h-full w-full object-cover" /> : <UserCircle className="h-14 w-14" />}</span>
        <div className="space-y-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><Camera className="h-4 w-4" />Change picture<input aria-label="Profile picture" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only" onChange={(event) => { void picture(event.target.files?.[0]); event.target.value = ''; }} /></label>
        {avatarDataUrl && <button title="Remove picture" aria-label="Remove picture" type="button" disabled={busy} onClick={() => { setAvatar(null); setSaved(false); }} className="ml-2 rounded-md p-2 text-slate-500 hover:bg-slate-100"><Trash2 className="h-4 w-4" /></button>}<p className="text-xs text-slate-500">PNG, JPEG or WebP. Maximum 2 MB.</p></div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{[['First name', 'profile-first', firstName, setFirst], ['Last name', 'profile-last', lastName, setLast]].map(([label, id, value, setter]) => <div key={id as string}><label htmlFor={id as string} className="text-sm font-medium">{label as string}</label><input id={id as string} value={value as string} onChange={(event) => { (setter as (value: string) => void)(event.target.value); setSaved(false); }} required maxLength={80} disabled={busy} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" /></div>)}</div>
      <dl className="grid gap-4 border-y border-slate-200 py-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Email</dt><dd className="mt-1 break-all">{account.email}</dd></div><div><dt className="text-slate-500">Role</dt><dd className="mt-1 break-words">{account.roles.map((row) => row.role.name.replace(/_/g, ' ')).join(', ')}</dd></div></dl>
      <div><label htmlFor="profile-bio" className="text-sm font-medium">Bio</label><textarea id="profile-bio" rows={5} maxLength={500} value={bio} disabled={busy} onChange={(event) => { setBio(event.target.value); setSaved(false); }} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" /><p className="text-right text-xs text-slate-500">{bio.length}/500</p></div>
      {saved && <p role="status" className="text-sm text-emerald-700">Profile saved.</p>}
      <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{busy ? 'Saving...' : 'Save profile'}</button>
    </form>}
  </section>;
}
