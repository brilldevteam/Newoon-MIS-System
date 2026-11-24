import { ArrowRight, ClipboardCheck, Inbox, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { availableWorkspaceModules } from '../utils/workspace-modules';

const icons = { enquiry: Inbox, kyc: ClipboardCheck, compliance: ShieldCheck };
const accents = { enquiry: 'bg-rose-50 text-red-700', kyc: 'bg-sky-50 text-sky-700', compliance: 'bg-emerald-50 text-emerald-700' };

export function WorkspaceHomePage() {
  const { user, loading } = useAuth();
  const modules = availableWorkspaceModules(user);
  return <section aria-label="Workspaces" className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header className="mb-8 border-b border-slate-200 pb-6">
      <p className="mb-2 text-sm font-semibold text-red-700">Newoon MIS</p>
      <h1 className="text-3xl font-semibold text-slate-950">Your workspace</h1>
    </header>
    {loading ? <p role="status">Loading workspaces...</p> : modules.length ? <div className="grid gap-5 md:grid-cols-3">
      {modules.map((module) => {
        const Icon = icons[module.id];
        return <Link key={module.id} to={module.to} className="group flex min-h-60 min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600">
          <span className={`mb-6 flex h-12 w-12 items-center justify-center rounded-lg ${accents[module.id]}`}><Icon className="h-6 w-6" /></span>
          <h2 className="text-xl font-semibold text-slate-950">{module.label}</h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-slate-500">{module.description}</p>
          <span className="mt-auto flex items-center justify-between text-sm font-semibold text-red-700">Open workspace<ArrowRight className="h-4 w-4" /></span>
        </Link>;
      })}
    </div> : <p className="border-l-2 border-amber-400 p-4 text-sm text-slate-600">No module access has been assigned. Contact your company administrator.</p>}
  </section>;
}
