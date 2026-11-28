import { useConfirm } from '../components/ConfirmProvider';
import { ArrowLeft, Eye, FileText, Mail, MapPin, Phone, RefreshCw, ShieldCheck } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ClientDocumentFolders } from '../components/ClientDocumentFolders';
import { EditableFields, EditableItem, EditConfig, EditKind } from '../components/EditableFields';
import { PeopleContext, PeopleTab, roleLabel } from '../components/ClientPeople';
import { LegalDocumentsPanel } from '../components/LegalDocumentsPanel';
import { ExpiryPanel, ReviewsPanel, ScreeningPanel } from '../components/ComplianceMonitoringPanels';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../services/api';
import {
  cddLabels,
  CddType,
  ClientJurisdiction,
  ComplianceClientUpdate,
  EntityField,
  PersonRoleType,
  startComplianceRekyc,
  updateEntityField,
  allocateStaff,
  getAllocationCandidates,
  removeStaffAllocation,
  StaffUser,
  ClientDocumentFolders as Folders,
  ComplianceClientDetail,
  complianceStatusLabels,
  getClientDocuments,
  getComplianceClient,
  jurisdictionLabels,
  riskLabels,
  updateComplianceClient
} from '../services/compliance-clients.service';
import { ClientMonitoring, getClientMonitoring } from '../services/compliance-monitoring.service';
import { getLegalDocuments, LegalDocumentRegister, openLegalDocumentFile } from '../services/legal-documents.service';
import { hasAreaAccess, roleLabels, workflowRoles } from '../utils/access-control';
import { kycStatusLabel } from '../utils/kyc-status-labels';

// Keys stay stable for saved links and notifications: 'documents' is the Legal Documents tab and 'cdd' is the EDD tab.
type TabKey = 'overview' | 'company' | 'shareholders' | 'officers' | 'signatories' | 'sef' | 'secretary' | 'documents' | 'engagements' | 'compliance-docs' | 'expiry' | 'ubos' | 'kyc' | 'crrf' | 'screening' | 'cdd' | 'monitoring' | 'reviews';

const riskTone: Record<string, string> = {
  HIGH: 'bg-rose-50 text-rose-700 ring-rose-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
  LOW: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING: 'bg-slate-100 text-slate-600 ring-slate-200'
};
const statusTone: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
  ON_HOLD: 'bg-amber-50 text-amber-700 ring-amber-200'
};
function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}>{children}</span>;
}

function Panel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Fields({ items }: { items: Array<[string, ReactNode]> }) {
  return <EditableFields items={items.map(([label, value]) => ({ label, value }))} />;
}

function EddSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

// Staff allocated to the client: Accounting and HR see only their allocated clients (Company Admin, AML Supervisor,
// DMLRO and MLRO allocate them).
function AllocationPanel({ data, onChange }: { data: ComplianceClientDetail; onChange: (next: ComplianceClientDetail) => void }) {
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<StaffUser[] | null>(null);
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const manage = data.access.canManageAllocation;

  async function openAdd() {
    try {
      setCandidates(await getAllocationCandidates(data.client.id));
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to load staff.'), 'error');
    }
  }

  async function add() {
    if (!userId) return;
    setBusy(true);
    try {
      onChange(await allocateStaff(data.client.id, userId));
      setCandidates(null);
      setUserId('');
      showToast('Staff member allocated.', 'success');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to allocate.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(allocationId: string, name: string) {
    if (!(await confirm({ title: 'Remove their access?', message: `Remove ${name} from this client? They will no longer see it.`, confirmLabel: 'Remove', tone: 'danger' }))) return;
    setBusy(true);
    try {
      onChange(await removeStaffAllocation(data.client.id, allocationId));
      showToast('Allocation removed.', 'success');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to remove the allocation.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Allocated staff"
      description="Accounting and HR staff see only the clients allocated to them (company, people, engagements and legal documents without passports)."
      action={manage && !candidates ? <button type="button" onClick={openAdd} className="text-xs font-medium text-brand-700 hover:text-brand-800">Allocate</button> : undefined}
    >
      {candidates ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select aria-label="Staff member" value={userId} onChange={(event) => setUserId(event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">{candidates.length ? 'Choose a staff member…' : 'No Accounting or HR users left to allocate'}</option>
            {candidates.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} ({item.roles.map((role) => roleLabels[role] || role).join(', ')})</option>)}
          </select>
          <button type="button" disabled={!userId || busy} onClick={add} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">Add</button>
          <button type="button" onClick={() => setCandidates(null)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      ) : null}
      {data.allocations.length ? (
        <ul className="space-y-2 text-sm">
          {data.allocations.map((allocation) => (
            <li key={allocation.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="font-medium text-slate-900">{allocation.user.firstName} {allocation.user.lastName}</span>
                <span className="block text-xs text-slate-500">{allocation.user.roles.map((role) => roleLabels[role] || role).join(', ')}</span>
              </span>
              {manage ? <button type="button" disabled={busy} onClick={() => remove(allocation.id, `${allocation.user.firstName} ${allocation.user.lastName}`)} className="shrink-0 text-xs font-medium text-rose-700 hover:text-rose-800 disabled:opacity-60">Remove</button> : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No staff allocated.</Empty>
      )}
    </Panel>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

// Roles listed on each people tab. One person can hold several roles and then appears on each matching tab.
const OFFICER_TAB_ROLES: PersonRoleType[] = ['DIRECTOR', 'MANAGER', 'CEO', 'CFO', 'COO', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER', 'CHAIRMAN', 'OTHER'];

export function ComplianceClientDetailsPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<ComplianceClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canEdit = hasAreaAccess(user, 'compliance', true, workflowRoles.complianceEdit);
  const canOpenKyc = hasAreaAccess(user, 'kyc', false, [...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks]);
  const canOpenCrrf = hasAreaAccess(user, 'crrf', false, workflowRoles.crrf);
  // Legal and ID documents can also be added or replaced by Operations (clients Edit); the AML team is notified.
  const canEditDocuments = canEdit || hasAreaAccess(user, 'clients', true, workflowRoles.clientIntake);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getComplianceClient(id)
      .then(setData)
      .catch((requestError) => setError(getApiErrorMessage(requestError, 'Unable to load this compliance client.')))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const [register, setRegister] = useState<LegalDocumentRegister | null>(null);
  const [registerError, setRegisterError] = useState('');
  const loadRegister = useCallback(() => {
    setRegisterError('');
    getLegalDocuments(id)
      .then(setRegister)
      .catch((requestError) => setRegisterError(getApiErrorMessage(requestError, 'Unable to load the legal documents.')));
  }, [id]);

  useEffect(() => {
    loadRegister();
  }, [loadRegister]);

  // Tabs this user may see (backend client-access.ts); folders and monitoring are only loaded when they are shown.
  const allowedTabs = data?.access.tabs || [];
  const canFolders = allowedTabs.includes('compliance-docs');
  const canMonitoring = allowedTabs.includes('expiry');

  const [folders, setFolders] = useState<Folders | null>(null);
  const [foldersError, setFoldersError] = useState('');
  const loadFolders = useCallback(() => {
    if (!canFolders) return;
    setFoldersError('');
    getClientDocuments(id)
      .then(setFolders)
      .catch((requestError) => setFoldersError(getApiErrorMessage(requestError, 'Unable to load client documents.')));
  }, [id, canFolders]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const [monitoring, setMonitoring] = useState<ClientMonitoring | null>(null);
  const [monitoringError, setMonitoringError] = useState('');
  const loadMonitoring = useCallback(() => {
    if (!canMonitoring) return;
    setMonitoringError('');
    getClientMonitoring(id)
      .then(setMonitoring)
      .catch((requestError) => setMonitoringError(getApiErrorMessage(requestError, 'Unable to load monitoring records.')));
  }, [id, canMonitoring]);

  useEffect(() => {
    loadMonitoring();
  }, [loadMonitoring]);

  // Monitoring actions change register fields (risk, review dates), so refresh the client header as well.
  const onMonitoringChange = (next: ClientMonitoring) => {
    setMonitoring(next);
    load();
  };

  const folderSections = (category: 'CDD' | 'MONITORING' | 'COMPLIANCE') => folders?.sections.filter((section) => section.category === category) || [];
  const folderCount = (category: 'CDD' | 'MONITORING' | 'COMPLIANCE') => folderSections(category).reduce((sum, section) => sum + section.documents.length, 0);

  const people = data?.profile.people || [];
  const holding = (roles: PersonRoleType[]) => people.filter((person) => person.roles.some((role) => roles.includes(role.role))).length;

  // Order agreed with the business on 2026-11-22; Monitoring and Reviews & Risk are sections of EDD. Each user sees the
  // tabs of their access level only.
  const allTabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'company', label: 'Company' },
    { key: 'shareholders', label: 'Shareholders', count: holding(['SHAREHOLDER']) },
    { key: 'officers', label: 'Directors & Managers', count: holding(OFFICER_TAB_ROLES) },
    { key: 'signatories', label: 'Authorised Signatory', count: holding(['AUTHORISED_SIGNATORY']) },
    { key: 'sef', label: 'SEF', count: holding(['SEF']) },
    { key: 'secretary', label: 'Secretary', count: holding(['SECRETARY']) },
    { key: 'documents', label: 'Legal Documents', count: register ? register.documents.filter((document) => document.status === 'CURRENT').length + register.identity.length : undefined },
    { key: 'engagements', label: 'Engagements', count: data?.engagements.length ?? 0 },
    { key: 'compliance-docs', label: 'Compliance Documents', count: folderCount('COMPLIANCE') },
    { key: 'expiry', label: 'Expiry', count: monitoring?.expiryItems.filter((item) => item.isActive).length ?? 0 },
    { key: 'ubos', label: 'UBO', count: holding(['UBO']) },
    { key: 'kyc', label: 'KYC', count: data?.kycCases.length ?? 0 },
    { key: 'crrf', label: 'CRRF' },
    { key: 'screening', label: 'Screening', count: monitoring?.screenings.length ?? 0 },
    { key: 'cdd', label: 'EDD', count: folderCount('CDD') + folderCount('MONITORING') + (monitoring ? monitoring.reviews.length + monitoring.riskChanges.length : 0) }
  ];
  const tabs = allTabs.filter((tab) => allowedTabs.includes(tab.key));
  // Older links (notifications, bookmarks) to Monitoring and Reviews & Risk open EDD.
  const linkedTab = searchParams.get('tab');
  const requestedTab = (linkedTab === 'monitoring' || linkedTab === 'reviews' ? 'cdd' : linkedTab) as TabKey | null;
  const activeTab: TabKey = tabs.some((tab) => tab.key === requestedTab) ? (requestedTab as TabKey) : 'overview';
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  // Keep the selected tab visible when the tab bar scrolls horizontally (narrow screens, deep links).
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab, data]);

  if (loading && !data) return <p className="text-sm text-slate-500">Loading compliance client...</p>;
  if (error && !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const { client, profile, profileCase } = data;
  const openRekyc = data.kycCases.find((kycCase) => kycCase.purpose === 'REKYC' && !CLOSED_REKYC_STATUSES.includes(kycCase.status));
  const sourceNote = `${profile.source ? `Client record, first taken from KYC ${profile.source.kycNumber}.` : 'Client record.'}${canEdit ? ' Changes here are audited, do not change the approved KYC, and prefill the next re-KYC.' : ''}${openRekyc && canEdit ? ` Re-KYC ${openRekyc.kycNumber} is in progress: changes made here are kept when it is approved, but its reviewers do not see them, so also enter them in the re-KYC form.` : ''}`;
  // Any change returns the refreshed page; expiry dates feed the Expiry tab and ID copies the Identity Documents folder.
  const onChange = (next: ComplianceClientDetail) => {
    setData(next);
    loadMonitoring();
    loadFolders();
    loadRegister();
  };
  const peopleContext: PeopleContext = {
    clientId: client.id,
    canEdit,
    people: profile.people,
    onChange,
    ids: {
      clientId: client.id,
      canEdit,
      canUpload: canEditDocuments,
      showPassports: data.access.seesPassports,
      canOpenKyc,
      documents: data.identityDocuments || [],
      kycDocuments: data.legalDocuments,
      kycNumbers: Object.fromEntries(data.kycCases.map((kycCase) => [kycCase.id, kycCase.kycNumber])),
      onChange,
      openKycDocuments: () => setSearchParams({ tab: 'documents' }, { replace: true })
    }
  };
  const company = profile.company;
  const showRisk = data.access.level !== 'ALLOCATED';
  const overviewDocuments = (register?.documents || []).filter((document) => document.status === 'CURRENT' && ['COMPANY_PROFILE', 'ORG_CHART'].includes(document.typeKey));
  // The tab where a person is listed, for the "Person" link of an ID document.
  const personTab = (personId: string): TabKey => {
    const roles = profile.people.find((person) => person.id === personId)?.roles.map((role) => role.role) || [];
    if (roles.includes('SHAREHOLDER')) return 'shareholders';
    if (roles.some((role) => OFFICER_TAB_ROLES.includes(role))) return 'officers';
    if (roles.includes('AUTHORISED_SIGNATORY')) return 'signatories';
    if (roles.includes('SECRETARY')) return 'secretary';
    if (roles.includes('SEF')) return 'sef';
    if (roles.includes('UBO')) return 'ubos';
    return 'overview';
  };
  const companyItem = (label: string, display: ReactNode, field: EntityField, kind: EditKind, extra: Partial<EditConfig> = {}): EditableItem => ({
    label,
    value: display,
    edited: company.edited.includes(field),
    edit: canEdit ? {
      kind, initial: company[field] ?? null, ...extra,
      onSave: async (value) => {
        onChange(await updateEntityField(client.id, field, value));
        showToast('Saved.', 'success');
      }
    } : null
  });
  const activeEngagements = data.engagements.filter((engagement) => engagement.status === 'IN_PROGRESS' || engagement.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-500">{client.clientCode || 'No client code'}</p>
            <h1 className="mt-1 break-words text-2xl font-semibold text-slate-950">{client.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {[client.registrationNumber ? `CR / QFC ${client.registrationNumber}` : null, client.jurisdiction ? jurisdictionLabels[client.jurisdiction] : null, client.industry]
                .filter(Boolean)
                .join(' · ') || 'Registration details not captured'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className={statusTone[client.status] || statusTone.INACTIVE}>{complianceStatusLabels[client.status] || client.status}</Badge>
              {showRisk ? <Badge className={riskTone[client.riskLevel || 'PENDING']}>{client.riskLevel ? `${riskLabels[client.riskLevel]} risk` : 'Risk pending'}</Badge> : null}
              {showRisk ? <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{client.cddType ? cddLabels[client.cddType] : 'CDD not set'}</Badge> : null}
              {client.pendingRiskChange ? (
                <button type="button" onClick={() => setSearchParams({ tab: 'cdd' }, { replace: true })}>
                  <Badge className="bg-amber-50 text-amber-700 ring-amber-200">{`Risk change to ${riskLabels[client.pendingRiskChange.proposedRisk]} awaiting approval`}</Badge>
                </button>
              ) : null}
              {client.reviewInProgress ? (
                <button type="button" onClick={() => setSearchParams({ tab: 'cdd' }, { replace: true })}>
                  <Badge className="bg-brand-50 text-brand-700 ring-brand-200">Review in progress</Badge>
                </button>
              ) : null}
              {client.latestScreening && (client.latestScreening.result === 'ALERT' || client.latestScreening.result === 'REVIEW') ? (
                <button type="button" onClick={() => setSearchParams({ tab: 'screening' }, { replace: true })}>
                  <Badge className="bg-rose-50 text-rose-700 ring-rose-200">{`Screening ${client.latestScreening.result === 'ALERT' ? 'alert' : 'needs review'}`}</Badge>
                </button>
              ) : null}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4 lg:min-w-[30rem]">
            <HeaderStat label="Activated" value={formatDate(client.activatedAt)} />
            {showRisk ? <HeaderStat label="Last review" value={formatDate(client.lastReviewDate)} /> : null}
            {showRisk ? (
              <HeaderStat
                label="Next review"
                value={formatDate(client.nextReviewDate)}
                tone={client.reviewState === 'OVERDUE' ? 'text-rose-700' : client.reviewState === 'DUE_SOON' ? 'text-amber-700' : undefined}
              />
            ) : null}
            <HeaderStat label="Engagements" value={`${activeEngagements} active / ${data.engagements.length}`} />
          </dl>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4 text-slate-400" />{client.email || 'No email'}</span>
          <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4 text-slate-400" />{client.phone || 'No phone'}</span>
          <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-slate-400" /><span className="break-words">{client.address || company.registeredOfficeAddress || 'No address'}</span></span>
        </div>
      </header>

      <nav className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-1.5 lg:mx-0 lg:px-0" aria-label="Client sections">
        <div className="flex min-w-max gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              ref={activeTab === tab.key ? activeTabRef : undefined}
              type="button"
              onClick={() => setSearchParams(tab.key === 'overview' ? {} : { tab: tab.key }, { replace: true })}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${activeTab === tab.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span className={`rounded-full px-1.5 text-xs ${activeTab === tab.key ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === 'overview' ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <RegisterDetails data={data} canEdit={canEdit} onSaved={load} onRiskChange={() => setSearchParams({ tab: 'cdd' }, { replace: true })} />
            {showRisk ? <Panel title="Risk history" description="Risk reclassifications recorded on this client's KYC cases.">
              {data.riskHistory.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.riskHistory.map((entry) => (
                    <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-slate-900">{formatDate(entry.effectiveDate)}</span>
                        <span className="text-slate-500">{entry.previousRisk ? riskLabels[entry.previousRisk] : 'Not set'} →</span>
                        <Badge className={riskTone[entry.newRisk]}>{riskLabels[entry.newRisk]}</Badge>
                        <span className="text-xs text-slate-500">{entry.reasonCategory.split('_').join(' ').toLowerCase()}</span>
                      </div>
                      <p className="mt-1 break-words text-sm text-slate-600">{entry.explanation}</p>
                      {entry.changedBy ? <p className="mt-1 text-xs text-slate-400">By {entry.changedBy.firstName} {entry.changedBy.lastName}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No risk reclassifications recorded.</Empty>
              )}
            </Panel> : null}
          </div>
          <div className="space-y-6">
            {showRisk ? <Panel title="Current KYC assessment" description={sourceNote}>
              <Fields items={[
                ['Risk at review', data.internalReview?.riskClassification ? riskLabels[data.internalReview.riskClassification] : null],
                ['CDD at review', data.internalReview?.dueDiligenceType ? cddLabels[data.internalReview.dueDiligenceType] : null],
                ['KYC status', profileCase ? kycStatusLabel(profileCase.status) : null]
              ]} />
              {canOpenKyc && profileCase ? (
                <Link to={`/kyc/${profileCase.id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
                  <Eye className="h-4 w-4" />
                  Open KYC case
                </Link>
              ) : null}
            </Panel> : null}
            <Panel
              title="Company profile & organisation chart"
              action={<button type="button" onClick={() => setSearchParams({ tab: 'documents' }, { replace: true })} className="text-xs font-medium text-brand-700 hover:text-brand-800">Legal documents</button>}
            >
              {overviewDocuments.length ? (
                <ul className="space-y-2 text-sm">
                  {overviewDocuments.map((document) => (
                    <li key={document.id} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{document.typeLabel}</span></span>
                      <button type="button" onClick={() => openLegalDocumentFile(client.id, document).catch((requestError) => showToast(getApiErrorMessage(requestError, 'Unable to open this document.'), 'error'))} className="shrink-0 text-xs font-medium text-brand-700 hover:text-brand-800">View</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No company profile or organisation chart yet. Add them in Legal Documents.</Empty>
              )}
            </Panel>
            {data.access.level === 'FULL' ? <AllocationPanel data={data} onChange={setData} /> : null}
            <Panel title="Key communication person">
              <PeopleTab context={peopleContext} roles={['KEY_CONTACT']} compact empty={data.contacts.length
                ? `No key communication person on the client record. Enquiry contact: ${data.contacts.map((contact) => [contact.name, contact.email, contact.phone].filter(Boolean).join(' · ')).join('; ')}.`
                : 'No key communication person recorded.'} />
            </Panel>
          </div>
        </div>
      ) : null}

      {activeTab === 'company' ? (
        <Panel title="Company details" description={sourceNote}>
          <EditableFields items={[
            companyItem('Legal name', company.legalName, 'legalName', 'text', { required: true }),
            companyItem('Legal form', company.legalForm, 'legalForm', 'text'),
            companyItem('CR / QFC number', company.commercialRegistrationNo || client.registrationNumber, 'commercialRegistrationNo', 'text'),
            companyItem('CR expiry date', formatDate(company.crExpiryDate), 'crExpiryDate', 'date', { hint: 'Listed on the Expiry tab with 90 / 60 / 30-day alerts.' }),
            companyItem('Date of incorporation', company.dateOfIncorporation ? formatDate(company.dateOfIncorporation) : null, 'dateOfIncorporation', 'date'),
            companyItem('Country of incorporation', company.countryOfIncorporation, 'countryOfIncorporation', 'text'),
            companyItem('Place of incorporation', company.placeOfIncorporation, 'placeOfIncorporation', 'text'),
            companyItem('Registered office address', company.registeredOfficeAddress, 'registeredOfficeAddress', 'longtext'),
            companyItem('Share capital', company.shareCapital, 'shareCapital', 'text'),
            companyItem('Tax card no. (TIN)', company.taxIdentificationNo, 'taxIdentificationNo', 'text'),
            companyItem('PO Box', company.poBox, 'poBox', 'text'),
            companyItem('Telephone', company.telephone, 'telephone', 'text'),
            companyItem('Email', company.email, 'email', 'email'),
            companyItem('Website', company.website, 'website', 'text'),
            companyItem('Main purpose / nature of business', company.businessNature, 'businessNature', 'text', { hint: 'Separate several with commas.' }),
            companyItem('Related industry', company.relatedIndustry, 'relatedIndustry', 'text', { hint: 'Separate several with commas.' }),
            companyItem('Licensed activities', company.licenseActivities, 'licenseActivities', 'longtext'),
            companyItem('Financial year end', company.financialYearEnd, 'financialYearEnd', 'text', { hint: 'For example 31 December.' }),
            companyItem('Approved auditor', company.auditorName, 'auditorName', 'text'),
            companyItem('Services requested', company.prospectiveServices, 'prospectiveServices', 'text', { hint: 'Separate several with commas.' })
          ]} />
        </Panel>
      ) : null}

      {activeTab === 'officers' ? (
        <Panel title="Directors & managers" description={`Board members, managers and executives. ${sourceNote}`}>
          <PeopleTab context={peopleContext} roles={OFFICER_TAB_ROLES} addRoles={OFFICER_TAB_ROLES} empty="No directors or managers on the client record." />
        </Panel>
      ) : null}

      {activeTab === 'signatories' ? (
        <Panel title="Authorised signatories" description={`People authorised to sign for the company. ${sourceNote}`}>
          <PeopleTab context={peopleContext} roles={['AUTHORISED_SIGNATORY']} empty="No authorised signatory on the client record." />
        </Panel>
      ) : null}

      {activeTab === 'shareholders' ? (
        <Panel title="Shareholders" description={`Ownership structure: individuals and companies. ${sourceNote}`}>
          <PeopleTab context={peopleContext} roles={['SHAREHOLDER']} allowCorporate empty="No shareholders on the client record." />
        </Panel>
      ) : null}

      {activeTab === 'secretary' ? (
        <Panel title="Company secretary" description={sourceNote}>
          <PeopleTab context={peopleContext} roles={['SECRETARY']} allowCorporate empty="No company secretary on the client record." />
        </Panel>
      ) : null}

      {activeTab === 'sef' ? (
        <Panel title="Senior Executive Functions" description={sourceNote}>
          <PeopleTab context={peopleContext} roles={['SEF']} empty="No SEF on the client record." />
        </Panel>
      ) : null}

      {activeTab === 'ubos' ? (
        <Panel title="Ultimate beneficial owners" description={`Individuals who ultimately own or control the company, directly or through a corporate shareholder. ${sourceNote}`}>
          <PeopleTab context={peopleContext} roles={['UBO']} empty="No beneficial owners on the client record." />
        </Panel>
      ) : null}

      {activeTab === 'kyc' ? <KycHistory data={data} canEdit={canEdit} canOpenKyc={canOpenKyc} onStarted={load} /> : null}

      {activeTab === 'documents' ? (
        <LegalDocumentsPanel context={{
          clientId: client.id,
          canEdit: canEditDocuments,
          canEditProfile: canEdit,
          canOpenKyc,
          company,
          people: profile.people,
          kycDocuments: data.legalDocuments,
          kycNumbers: Object.fromEntries(data.kycCases.map((kycCase) => [kycCase.id, kycCase.kycNumber])),
          register,
          registerError,
          onRegister: (next) => {
            setRegister(next);
            loadMonitoring();
            load();
          },
          onProfile: onChange,
          openPerson: (personId) => setSearchParams({ tab: personTab(personId) }, { replace: true })
        }} />
      ) : null}

      {activeTab === 'crrf' ? (
        <Panel
          title="Client Risk Rating Form (CRRF)"
          description="Formerly the BRA sheet in the old system."
          action={canOpenCrrf && profileCase ? (
            <Link to={`/kyc/${profileCase.id}/crrf`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
              <ShieldCheck className="h-4 w-4" />
              Open CRRF workspace
            </Link>
          ) : undefined}
        >
          {data.crrfRestricted ? (
            <Empty>Your role does not have CRRF access.</Empty>
          ) : data.crrf ? (
            <div className="space-y-4">
              <Fields items={[
                ['CRRF risk rating', data.crrf.riskRating ? <Badge className={riskTone[data.crrf.riskRating]}>{riskLabels[data.crrf.riskRating]}</Badge> : null],
                ['Last updated', formatDate(data.crrf.updatedAt)],
                ['Register risk level', client.riskLevel ? riskLabels[client.riskLevel] : null]
              ]} />
              {data.crrf.documents.length ? (
                <ul className="space-y-2 text-sm">
                  {data.crrf.documents.map((document) => (
                    <li key={document.id} className="flex items-center gap-2 text-slate-700">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="break-all">{document.fileName}</span>
                      <span className="text-xs text-slate-400">{formatDate(document.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No CRRF documents uploaded.</Empty>
              )}
            </div>
          ) : (
            <Empty>No CRRF record on the profile KYC case.</Empty>
          )}
        </Panel>
      ) : null}

      {activeTab === 'cdd' ? (
        <div className="space-y-8">
          <EddSection title="EDD documents" description="Enhanced due diligence evidence kept on this client: source of funds and wealth, adverse media, additional checks and the ID copies of the people.">
            {foldersError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{foldersError}</p> : !folders ? <p className="text-sm text-slate-500">Loading documents...</p> : (
              <ClientDocumentFolders key="cdd" clientId={client.id} sections={folderSections('CDD')} canEdit={canEdit} allowCustomFolders={false} collapsible={false} onChange={(next) => (next ? setFolders(next) : loadFolders())} />
            )}
          </EddSection>
          <EddSection title="Ongoing monitoring" description="Evidence that the client is being watched after onboarding: correspondence, transaction or activity notes and anything that may change the risk.">
            {foldersError ? null : !folders ? <p className="text-sm text-slate-500">Loading documents...</p> : (
              <ClientDocumentFolders key="monitoring" clientId={client.id} sections={folderSections('MONITORING')} canEdit={canEdit} allowCustomFolders={false} collapsible={false} onChange={(next) => (next ? setFolders(next) : loadFolders())} />
            )}
          </EddSection>
          <EddSection title="Periodic reviews and risk" description="The scheduled review of the client (High risk every year, Medium every 2 years, Low every 3 years) and any change of risk level, which DMLRO or MLRO must approve.">
            {monitoringError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{monitoringError}</p> : !monitoring ? <p className="text-sm text-slate-500">Loading reviews...</p> : (
              <ReviewsPanel clientId={client.id} data={monitoring} canEdit={canEdit} onChange={onMonitoringChange} clientStatus={client.status} currentUserId={user?.id} />
            )}
          </EddSection>
        </div>
      ) : null}

      {activeTab === 'compliance-docs' ? (
        foldersError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{foldersError}</p>
        ) : !folders ? (
          <p className="text-sm text-slate-500">Loading documents...</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Compliance documentation folders. Folders are shared by all clients; the files are this client's.</p>
            <ClientDocumentFolders
              key="compliance-docs"
              clientId={client.id}
              sections={folderSections('COMPLIANCE')}
              canEdit={canEdit}
              allowCustomFolders
              collapsible
              onChange={(next) => (next ? setFolders(next) : loadFolders())}
            />
          </div>
        )
      ) : null}

      {(['screening', 'expiry'] as TabKey[]).includes(activeTab) ? (
        monitoringError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{monitoringError}</p>
        ) : !monitoring ? (
          <p className="text-sm text-slate-500">Loading monitoring records...</p>
        ) : activeTab === 'screening' ? (
          <ScreeningPanel clientId={client.id} data={monitoring} canEdit={canEdit} onChange={onMonitoringChange} />
        ) : (
          <ExpiryPanel
            clientId={client.id}
            data={monitoring}
            canEdit={canEdit}
            onChange={onMonitoringChange}
            holderSuggestions={[
              { name: client.name, role: 'Company' },
              ...profile.people.map((person) => ({ name: person.fullName, role: person.roles.map(roleLabel).join(', ') || 'Person' }))
            ]}
          />
        )
      ) : null}

      {activeTab === 'engagements' ? (
        <Panel title="Engagements" description="Service engagements for this client (the old system's jobs).">
          {data.engagements.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Number</th>
                    <th className="py-2 pr-4">Service</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Start</th>
                    <th className="py-2 pr-4">End</th>
                    <th className="py-2">KYC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.engagements.map((engagement) => {
                    const kycCase = data.kycCases.find((item) => item.id === engagement.kycCaseId);
                    return (
                      <tr key={engagement.id}>
                        <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs">{engagement.engagementNumber}</td>
                        <td className="py-2 pr-4">
                          <p className="text-slate-900">{engagement.serviceName}</p>
                          {engagement.description ? <p className="text-xs text-slate-500">{engagement.description}</p> : null}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{engagement.status.split('_').join(' ').toLowerCase()}</td>
                        <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{formatDate(engagement.startDate)}</td>
                        <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{formatDate(engagement.endDate)}</td>
                        <td className="whitespace-nowrap py-2">
                          {kycCase ? (canOpenKyc ? <Link className="font-mono text-xs text-brand-700 hover:text-brand-800" to={`/kyc/${kycCase.id}`}>{kycCase.kycNumber}</Link> : <span className="font-mono text-xs">{kycCase.kycNumber}</span>) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No engagements recorded.</Empty>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/compliance/clients" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" />
      Compliance Clients
    </Link>
  );
}

function HeaderStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 font-medium ${tone || 'text-slate-900'}`}>{value}</dd>
    </div>
  );
}

function RegisterDetails({ data, canEdit, onSaved, onRiskChange }: { data: ComplianceClientDetail; canEdit: boolean; onSaved: () => void; onRiskChange: () => void }) {
  const { client } = data;
  const { showToast } = useToast();

  // Each register value saves on its own through the audited PATCH /compliance/clients/:id.
  const item = (label: string, value: ReactNode, field: keyof ComplianceClientUpdate, kind: EditKind, initial: string | null | undefined, extra: Partial<EditConfig> = {}): EditableItem => ({
    label,
    value,
    edit: canEdit
      ? {
          kind,
          initial,
          ...extra,
          onSave: async (next) => {
            const payload = (field === 'jurisdiction' || field === 'cddType' ? next || 'NONE' : next ?? '') as never;
            await updateComplianceClient(client.id, { [field]: payload } as ComplianceClientUpdate);
            showToast(`${label} saved.`, 'success');
            onSaved();
          }
        }
      : null
  });

  return (
    <Panel title="Register details" description="Compliance register fields for this client. Use the pencil to change a value. Risk changes go through the review workflow.">
      <EditableFields items={([
        item('Client code', client.clientCode, 'clientCode', 'text', client.clientCode, { required: true, maxLength: 40, hint: 'Must be unique, for example CL-2026-0001.' }),
        item('Client name', client.name, 'name', 'text', client.name, { required: true, maxLength: 200 }),
        item('CR / QFC number', client.registrationNumber, 'registrationNumber', 'text', client.registrationNumber, { maxLength: 100 }),
        item('Jurisdiction', client.jurisdiction ? jurisdictionLabels[client.jurisdiction] : null, 'jurisdiction', 'select', client.jurisdiction || '', {
          options: [{ value: '', label: 'Not set' }, ...(Object.keys(jurisdictionLabels) as ClientJurisdiction[]).map((key) => ({ value: key, label: jurisdictionLabels[key] }))]
        }),
        item('CDD type', client.cddType ? cddLabels[client.cddType] : null, 'cddType', 'select', client.cddType || '', {
          options: [{ value: '', label: 'Not set' }, ...(Object.keys(cddLabels) as CddType[]).map((key) => ({ value: key, label: cddLabels[key] }))]
        }),
        {
          label: 'Risk level',
          value: (
            <span className="inline-flex flex-wrap items-center gap-2">
              {client.riskLevel ? riskLabels[client.riskLevel] : 'Pending'}
              {canEdit ? (
                <button type="button" onClick={onRiskChange} className="text-xs font-medium text-brand-700 hover:text-brand-800">
                  Request change
                </button>
              ) : null}
            </span>
          )
        },
        item('Email', client.email, 'email', 'email', client.email, { maxLength: 254 }),
        item('Phone', client.phone, 'phone', 'text', client.phone, { maxLength: 40 }),
        item('Address', client.address, 'address', 'longtext', client.address, { maxLength: 500 }),
        item('Country', client.country, 'country', 'text', client.country, { maxLength: 100 }),
        item('Industry', client.industry, 'industry', 'text', client.industry, { maxLength: 200 }),
        item('Status reason', client.statusReason, 'statusReason', 'longtext', client.statusReason, { maxLength: 1000 }),
        { label: 'Latest service', value: client.latestEngagement?.serviceName || null }
      ]).filter((entry) => data.access.level !== 'ALLOCATED' || !(['CDD type', 'Risk level'].includes(entry.label)))} />
    </Panel>
  );
}

const CLOSED_REKYC_STATUSES = ['CLIENT_ACTIVE', 'CLIENT_REJECTED', 'MLRO_REJECTED', 'SEF_REJECTED'];

function KycHistory({ data, canEdit, canOpenKyc, onStarted }: { data: ComplianceClientDetail; canEdit: boolean; canOpenKyc: boolean; onStarted: () => void }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const { client, profileCase } = data;
  const openRekyc = data.kycCases.find((kycCase) => kycCase.purpose === 'REKYC' && !CLOSED_REKYC_STATUSES.includes(kycCase.status));
  const canStart = canEdit && client.status === 'ACTIVE' && Boolean(profileCase) && !openRekyc;

  async function start() {
    setStarting(true);
    try {
      const created = await startComplianceRekyc(client.id);
      showToast(`Re-KYC ${created.kycNumber} started, prefilled from the current KYC.`, 'success');
      setConfirming(false);
      if (canOpenKyc) navigate(`/kyc/${created.id}`);
      else onStarted();
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to start the re-KYC.'), 'error');
    } finally {
      setStarting(false);
    }
  }

  const caseNumber = (id: string | null) => data.kycCases.find((kycCase) => kycCase.id === id)?.kycNumber;

  return (
    <Panel
      title="KYC history"
      description="Every KYC for this client, newest first. The current KYC feeds this page; earlier KYCs are kept unchanged."
      action={canStart && !confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
          <RefreshCw className="h-3.5 w-3.5" />
          Start re-KYC
        </button>
      ) : undefined}
    >
      {confirming ? (
        <div className="mb-4 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-slate-700">
          <p>
            A new KYC case is created for {client.name}, prefilled with the current details from {profileCase?.kycNumber}, including edits made on this page.
            Upload the new documents and send it through the normal AML review. When it is approved it becomes the current KYC; {profileCase?.kycNumber} stays here as history.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={starting} onClick={start} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {starting ? 'Starting...' : 'Start re-KYC'}
            </button>
            <button type="button" disabled={starting} onClick={() => setConfirming(false)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {openRekyc ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Re-KYC {openRekyc.kycNumber} is in progress ({kycStatusLabel(openRekyc.status)}). It becomes the current KYC when it is approved.
          {canOpenKyc ? <Link to={`/kyc/${openRekyc.id}`} className="ml-2 font-medium underline">Open</Link> : null}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-4">KYC no.</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Service</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Opened</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.kycCases.map((kycCase) => (
              <tr key={kycCase.id}>
                <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs">
                  {kycCase.kycNumber}
                  {profileCase?.id === kycCase.id ? <Badge className="ml-2 bg-emerald-50 font-sans text-emerald-700 ring-emerald-200">Current</Badge> : null}
                </td>
                <td className="py-2 pr-4 text-slate-600">
                  {kycCase.purpose === 'REKYC' ? 'Re-KYC' : 'Onboarding'}
                  {kycCase.previousKycCaseId && caseNumber(kycCase.previousKycCaseId) ? <span className="block text-xs text-slate-400">from {caseNumber(kycCase.previousKycCaseId)}</span> : null}
                </td>
                <td className="py-2 pr-4 text-slate-600">{kycCase.serviceName || kycCase.title}</td>
                <td className="py-2 pr-4 text-slate-600">{kycStatusLabel(kycCase.status)}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{formatDate(kycCase.createdAt)}</td>
                <td className="py-2 text-right">
                  {canOpenKyc ? <Link className="text-sm font-medium text-brand-700 hover:text-brand-800" to={`/kyc/${kycCase.id}`}>Open</Link> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
