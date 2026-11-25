import { ArrowRight, ClipboardCheck, Inbox, Layers3, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { availableWorkspaceModules } from '../utils/workspace-modules';

const icons = { enquiry: Inbox, kyc: ClipboardCheck, compliance: ShieldCheck };
const presentation = {
  enquiry: { icon: 'bg-red-700 text-white', surface: 'bg-rose-50/60', border: 'group-hover:border-red-300', button: 'bg-red-700 group-hover:bg-red-800', eyebrow: 'Client intake', number: '01', tags: ['Enquiries', 'Preliminary information'] },
  kyc: { icon: 'bg-sky-700 text-white', surface: 'bg-sky-50/70', border: 'group-hover:border-sky-300', button: 'bg-sky-700 group-hover:bg-sky-800', eyebrow: 'Due diligence', number: '02', tags: ['KYC preparation', 'Reviews'] },
  compliance: { icon: 'bg-emerald-700 text-white', surface: 'bg-emerald-50/60', border: 'group-hover:border-emerald-300', button: 'bg-emerald-700 group-hover:bg-emerald-800', eyebrow: 'Client management', number: '03', tags: ['Client records', 'Ongoing compliance'] }
};

export function WorkspaceHomePage() {
  const { user, loading } = useAuth();
  const modules = availableWorkspaceModules(user);
  return <section aria-label="Workspaces" className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-16">
    <header className="mb-9 flex flex-col items-start gap-5 sm:mb-12 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><Layers3 aria-hidden="true" className="h-4 w-4 text-red-700" />Newoon MIS</p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-950">Your workspace</h1>
        <p className="mt-3 text-sm text-slate-600">Welcome back{user?.firstName ? `, ${user.firstName}` : ''}.</p>
      </div>
      {!loading && modules.length > 0 ? <span className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{modules.length} {modules.length === 1 ? 'workspace' : 'workspaces'} available</span> : null}
    </header>
    {loading ? <p role="status">Loading workspaces...</p> : modules.length ? <div className="grid gap-5 md:grid-cols-3">
      {modules.map((module) => {
        const Icon = icons[module.id];
        const style = presentation[module.id];
        return <Link key={module.id} to={module.to} className="group flex min-w-0 flex-col rounded-lg bg-white shadow-[0_2px_4px_rgba(15,23,42,0.03),0_10px_28px_rgba(15,23,42,0.05)] transition-shadow duration-200 hover:shadow-[0_4px_8px_rgba(15,23,42,0.04),0_16px_36px_rgba(15,23,42,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600">
          <div className={`flex flex-1 flex-col rounded-t-lg border border-b-0 border-slate-200 p-6 transition-colors ${style.surface} ${style.border}`}>
            <div className="mb-8 flex items-center justify-between">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg shadow-sm ${style.icon}`}><Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} /></span>
              <span aria-hidden="true" className="font-mono text-xs text-slate-400">{style.number}</span>
            </div>
            <p className="mb-2 text-xs font-medium text-slate-600">{style.eyebrow}</p>
            <h2 className="text-xl font-semibold leading-7 text-slate-950">{module.label}</h2>
            <p className="mb-6 mt-3 text-sm leading-6 text-slate-600">{module.description}</p>
            <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200/80 pt-4">{style.tags.map(tag => <span key={tag} className="text-xs font-medium text-slate-600">{tag}</span>)}</div>
          </div>
          <div className={`rounded-b-lg border border-t-0 border-slate-200 p-4 transition-colors ${style.border}`}><span className={`flex min-h-11 items-center justify-between gap-3 rounded-md px-4 py-3 text-sm font-semibold text-white transition-colors ${style.button}`}>Open workspace<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></span></div>
        </Link>;
      })}
    </div> : <p className="border-l-2 border-amber-400 p-4 text-sm text-slate-600">No module access has been assigned. Contact your company administrator.</p>}
  </section>;
}
