import { KeyRound, UserRound } from 'lucide-react';
import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export function AccountSettingsLayout({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mx-auto w-full max-w-4xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
      <div><p className="mb-1 text-xs font-semibold uppercase text-brand-700">Account settings</p><h1 className="text-2xl font-semibold text-slate-950">{title}</h1></div>
      <nav aria-label="Account settings" className="flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
        {[{ to: '/account/profile', label: 'Profile', icon: UserRound }, { to: '/account/password', label: 'Password', icon: KeyRound }].map(({ to, label, icon: Icon }) =>
          <NavLink key={to} to={to} className={({ isActive }) => `inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-4 w-4" />{label}</NavLink>)}
      </nav>
    </header>
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">{children}</div>
  </section>;
}
