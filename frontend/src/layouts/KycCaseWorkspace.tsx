import { ArrowLeft, ClipboardList, Clock, FileSpreadsheet, FileText, History, LayoutDashboard, SearchCheck, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getKycCase, getKycFormRevisions, KycCase } from '../services/kyc-workflow.service';
import { hasAnyRole, hasAreaAccess, workflowRoles } from '../utils/access-control';
import { canOpenKycFormForActiveStage } from '../utils/kyc-case-access';
import { kycStatusLabel, kycStatusOwner, kycStatusToneClass } from '../utils/kyc-status-labels';

// One workspace for a KYC case: a bar that stays at the top with the case and its tabs (Overview, KYC Form, Screening,
// CRRF ...), so moving between them does not feel like leaving the case. Each tab is still its own page below.
export function KycCaseWorkspace() {
  const { id } = useParams();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const base = `/kyc/${id}`;
  const canSeeHistory = hasAnyRole(user, workflowRoles.kycFormBuilder);

  // Reloaded on every tab change, so the status in the bar is current after an action on any page.
  useEffect(() => {
    let active = true;
    if (!id) return;
    getKycCase(id).then((item) => { if (active) setKycCase(item); }).catch(() => { if (active) setKycCase(null); });
    return () => { active = false; };
  }, [id, pathname]);

  // "Form history" is offered only when the form has earlier versions to compare.
  useEffect(() => {
    let active = true;
    setHasHistory(false);
    if (!id || !canSeeHistory) return;
    getKycFormRevisions(id).then((revisions) => { if (active) setHasHistory(revisions.length > 0); }).catch(() => { if (active) setHasHistory(false); });
    return () => { active = false; };
  }, [id, canSeeHistory, kycCase?.kycForm?.status]);

  const isPreliminary = kycCase?.sourceEnquiry?.enquiryType === 'PROPOSED_COMPANY';
  const showForm = Boolean(kycCase) && hasAnyRole(user, workflowRoles.kycFormBuilder) && canOpenKycFormForActiveStage(user, kycCase!) && (!isPreliminary || kycCase?.kycForm?.status === 'AMENDMENT_DRAFT');
  const tabs: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
    { to: base, label: 'Overview', icon: LayoutDashboard, end: true },
    ...(showForm ? [{ to: `${base}/form`, label: kycCase?.kycForm?.status === 'AMENDMENT_DRAFT' ? 'Amendment' : 'KYC Form', icon: FileText }] : []),
    ...(hasAreaAccess(user, 'screening', false, workflowRoles.screening) ? [{ to: `${base}/screening`, label: 'Screening', icon: SearchCheck }] : []),
    ...(hasAreaAccess(user, 'crrf', false, workflowRoles.crrf) ? [{ to: `${base}/crrf`, label: 'CRRF', icon: FileSpreadsheet }] : []),
    ...(canSeeHistory && hasHistory ? [{ to: `${base}/revisions`, label: 'Form history', icon: History }] : []),
    ...(hasAnyRole(user, workflowRoles.userAdmin) ? [{ to: `${base}/internal-review`, label: 'Internal review', icon: ClipboardList }] : [])
  ];

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 -mt-5 mb-5 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:-mx-8 lg:px-8 sm:-mt-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-2.5">
          <Link to="/kyc-workflow" aria-label="Back to KYC workflow" title="Back to KYC workflow" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /></Link>
          {kycCase ? (
            <>
              {kycCase.kycNumber ? <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{kycCase.kycNumber}</span> : null}
              <span className="min-w-0 truncate text-sm font-semibold text-slate-950" title={kycCase.client.name}>{kycCase.client.name}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${kycStatusToneClass(kycCase.status)}`}>{kycStatusLabel(kycCase.status)}</span>
              {kycStatusOwner(kycCase.status) ? <span className="hidden items-center gap-1 text-xs font-medium text-slate-500 sm:inline-flex"><Clock aria-hidden="true" className="h-3.5 w-3.5" />Now with {kycStatusOwner(kycCase.status)}</span> : null}
            </>
          ) : <span className="text-sm text-slate-400">Loading case…</span>}
        </div>
        <nav aria-label="Case sections" className="flex gap-2 overflow-x-auto py-2.5">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${isActive ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700'}`}
            >
              <tab.icon aria-hidden="true" className="h-4 w-4" />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
