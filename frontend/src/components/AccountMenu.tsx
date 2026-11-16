import { ChevronDown, KeyRound, LogOut, UserCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getSelfProfile, SelfProfile } from '../services/profile.service';

export function AccountMenu({ name, role, logout }: { name: string; role: string; logout: () => void }) {
  const [open, setOpen] = useState(false); const [profile, setProfile] = useState<SelfProfile | null>(null);
  const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null); const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    let active = true;
    const refresh = () => { getSelfProfile().then((data) => { if (active) setProfile(data); }).catch(() => {}); };
    refresh(); window.addEventListener('profile-updated', refresh);
    return () => { active = false; window.removeEventListener('profile-updated', refresh); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : name;
  return <div ref={root} className="relative min-w-0">
    <button ref={trigger} type="button" aria-label="Account options" aria-expanded={open} aria-controls="account-options" onClick={() => setOpen(!open)} className="flex max-w-[240px] items-center gap-2 rounded-md p-1.5 text-left hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-600">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-brand-700">{profile?.profile?.avatarDataUrl ? <img src={profile.profile.avatarDataUrl} alt="" className="h-full w-full object-cover" /> : <UserCircle className="h-5 w-5" />}</span>
      <span className="hidden min-w-0 sm:block"><span className="block truncate text-sm font-semibold">{displayName}</span><span className="block truncate text-xs text-slate-500">{role}</span></span><ChevronDown className="h-4 w-4 shrink-0" />
    </button>
    {open && <div id="account-options" className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
      <div className="border-b border-slate-100 px-4 py-3"><p className="break-words text-sm font-semibold">{displayName}</p><p className="break-words text-xs text-slate-500">{profile?.email}</p>{profile?.profile?.bio && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-600">{profile.profile.bio}</p>}</div>
      <Link to="/account/profile" className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-50"><UserCircle className="h-4 w-4" />My Profile</Link>
      <Link to="/account/password" className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-50"><KeyRound className="h-4 w-4" />Change Password</Link>
      <button onClick={logout} type="button" className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm text-brand-700 hover:bg-slate-50"><LogOut className="h-4 w-4" />Log Out</button>
    </div>}
  </div>;
}
