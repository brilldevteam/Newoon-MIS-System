import { ArrowLeft, Eye, FileText, Mail, MapPin, Phone, RefreshCw, ShieldCheck } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ClientDocumentFolders } from '../components/ClientDocumentFolders';
import { EditableFields, EditableItem, EditConfig, EditKind } from '../components/EditableFields';
import { IdentityDocumentsBlock, IdentityDocumentsContext } from '../components/IdentityDocumentsBlock';
import { ExpiryPanel, ReviewsPanel, ScreeningPanel } from '../components/ComplianceMonitoringPanels';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../services/api';
import {
  cddLabels,
  CddType,
  ClientJurisdiction,
  ComplianceClientUpdate,
  PersonIdentity,
  ProfileRef,
  startComplianceRekyc,
  updateComplianceProfileField,
  personKey,
  ClientDocumentFolders as Folders,
  ComplianceClientDetail,
  complianceStatusLabels,
  getClientDocuments,
  getComplianceClient,
  jurisdictionLabels,
  OfficerRole,
  ProfileOfficer,
  ProfileParty,
  riskLabels,
  updateComplianceClient
} from '../services/compliance-clients.service';
import { ClientMonitoring, getClientMonitoring } from '../services/compliance-monitoring.service';
import { LegalDocument, viewLegalDocument } from '../services/kyc-workflow.service';
import { hasAreaAccess, workflowRoles } from '../utils/access-control';
import { kycStatusLabel } from '../utils/kyc-status-labels';

type TabKey = 'overview' | 'company' | 'officers' | 'shareholders' | 'secretary' | 'sef' | 'ubos' | 'documents' | 'crrf' | 'cdd' | 'monitoring' | 'compliance-docs' | 'screening' | 'reviews' | 'expiry' | 'engagements';

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
const roleLabels: Record<OfficerRole, string> = {
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  SECRETARY: 'Secretary',
  SEF: 'SEF',
  SIGNATORY: 'Signatory',
  OTHER: 'Other'
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

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

type ProfileEditing = {
  canEdit: boolean;
  edited: Set<string>;
  ids: IdentityDocumentsContext;
  save: (ref: ProfileRef, field: string, value: string | null) => Promise<void>;
};

// Builds one editable item for a value taken from the client's KYC profile.
function profileItem(
  editing: ProfileEditing, ref: ProfileRef, label: string, display: ReactNode, field: string, kind: EditKind, initial: string | null | undefined,
  extra: Partial<EditConfig> = {}
): EditableItem {
  return {
    label,
    value: display,
    edited: editing.edited.has(`${ref.section}|${ref.rowId}|${field}`),
    edit: editing.canEdit ? { kind, initial, ...extra, onSave: (value) => editing.save(ref, field, value) } : null
  };
}

// QID / passport numbers and expiry dates are edited in the ID documents box; only an older combined value shows here.
function identityItems(_editing: ProfileEditing, person: PersonIdentity & { ref: ProfileRef }): EditableItem[] {
  return person.legacyIdentity
    ? [{ label: 'QID / Passport (earlier entry)', value: <span>{person.legacyIdentity}<span className="block text-xs text-slate-500">Recorded as one value on an older KYC. Enter it as the QID or passport number in ID documents below.</span></span>, wide: true }]
    : [];
}

// Roles of each person across the tabs, so KYC ID files named for a role reach the right cards.
function rolesByPerson(profile: ComplianceClientDetail['profile']) {
  const roles: Record<string, string[]> = {};
  const add = (name: string | null, role: string) => {
    const key = personKey(name);
    if (!key) return;
    roles[key] = [...new Set([...(roles[key] || []), role])];
  };
  if (!profile) return roles;
  profile.shareholders.forEach((party) => add(party.fullName, party.isUbo ? 'UBO' : 'SHAREHOLDER'));
  profile.ubos.forEach((party) => add(party.fullName, 'UBO'));
  profile.officers.forEach((officer) => officer.roles.forEach((role) => add(officer.fullName, role)));
  add(profile.keyContact.fullName, 'KEY_CONTACT');
  return roles;
}

function PartyCards({ parties, empty, editing, kind }: { parties: ProfileParty[]; empty: string; editing: ProfileEditing; kind: 'shareholder' | 'ubo' }) {
  if (!parties.length) return <Empty>{empty}</Empty>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {parties.map((party, index) => (
        <article key={`${party.ref.section}-${party.ref.rowId}-${index}`} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="break-words font-semibold text-slate-900">{party.fullName}</h3>
              <p className="text-xs text-slate-500">{party.partyType || 'Party'}{party.linkedCompany ? ` · via ${party.linkedCompany}` : ''}</p>
            </div>
            <div className="flex gap-1">
              {party.percentage ? <Badge className="bg-brand-50 text-brand-700 ring-brand-200">{`${party.percentage}%`}</Badge> : null}
              {party.isUbo && party.partyType !== 'Beneficial owner' ? <Badge className="bg-violet-50 text-violet-700 ring-violet-200">UBO</Badge> : null}
            </div>
          </div>
          <div className="mt-4">
            <EditableFields columns={2} items={[
              profileItem(editing, party.ref, party.isCorporate ? 'Company name' : 'Full name', party.fullName, 'fullName', 'text', party.fullName, { required: true }),
              profileItem(editing, party.ref, party.isCorporate ? 'Country' : 'Nationality', party.nationality, 'nationality', 'list', party.nationality,
                { hint: 'Separate several with commas.' }),
              ...(party.isCorporate
                ? [profileItem(editing, party.ref, 'CR number', party.identityNumber, 'identityNumber', 'text', party.identityNumber)]
                : identityItems(editing, party)),
              profileItem(editing, party.ref, party.isCorporate ? 'Date of incorporation' : 'Date of birth', party.dateOfBirth ? formatDate(party.dateOfBirth) : null, 'dateOfBirth', 'date', party.dateOfBirth),
              profileItem(editing, party.ref, kind === 'ubo' ? 'UBO interest %' : 'Shareholding %', party.percentage ? `${party.percentage}%` : null, party.percentageField, 'percent', party.percentage),
              profileItem(editing, party.ref, 'Address', party.address, 'residenceAddress', 'longtext', party.address)
            ]} />
            {!party.isCorporate ? <IdentityDocumentsBlock person={party} context={editing.ids} /> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function OfficerCards({ officers, empty, editing }: { officers: ProfileOfficer[]; empty: string; editing: ProfileEditing }) {
  if (!officers.length) return <Empty>{empty}</Empty>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {officers.map((officer, index) => (
        <article key={`${officer.ref.rowId}-${index}`} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="break-words font-semibold text-slate-900">{officer.fullName}</h3>
              <p className="text-xs text-slate-500">{officer.positions.join(', ') || 'Position not captured'}{officer.entityName ? ` · ${officer.entityName}` : ''}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {officer.roles.filter((role) => role !== 'OTHER').map((role) => (
                <Badge key={role} className="bg-slate-100 text-slate-700 ring-slate-200">{roleLabels[role]}</Badge>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <EditableFields columns={2} items={[
              profileItem(editing, officer.ref, 'Full name', officer.fullName, 'fullName', 'text', officer.fullName, { required: true }),
              profileItem(editing, officer.ref, 'Position', officer.positions.join(', ') || null, 'position', 'list', officer.positions.join(', '),
                { hint: 'Separate several with commas. The position decides the tab (Director, Secretary, SEF).' }),
              profileItem(editing, officer.ref, 'Entity name', officer.entityName, 'entityName', 'text', officer.entityName),
              profileItem(editing, officer.ref, 'Nationality', officer.nationality, 'nationality', 'list', officer.nationality, { hint: 'Separate several with commas.' }),
              ...identityItems(editing, officer),
              profileItem(editing, officer.ref, 'Date of birth', officer.dateOfBirth ? formatDate(officer.dateOfBirth) : null, 'dateOfBirth', 'date', officer.dateOfBirth),
              profileItem(editing, officer.ref, 'Address', officer.address, 'address', 'longtext', officer.address),
              { label: 'Authorized signatory', value: officer.isAuthorizedSignatory ? 'Yes' : 'No' }
            ]} />
            <IdentityDocumentsBlock person={officer} context={editing.ids} />
          </div>
        </article>
      ))}
    </div>
  );
}

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

  const [folders, setFolders] = useState<Folders | null>(null);
  const [foldersError, setFoldersError] = useState('');
  const loadFolders = useCallback(() => {
    setFoldersError('');
    getClientDocuments(id)
      .then(setFolders)
      .catch((requestError) => setFoldersError(getApiErrorMessage(requestError, 'Unable to load client documents.')));
  }, [id]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const [monitoring, setMonitoring] = useState<ClientMonitoring | null>(null);
  const [monitoringError, setMonitoringError] = useState('');
  const loadMonitoring = useCallback(() => {
    setMonitoringError('');
    getClientMonitoring(id)
      .then(setMonitoring)
      .catch((requestError) => setMonitoringError(getApiErrorMessage(requestError, 'Unable to load monitoring records.')));
  }, [id]);

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

  const officers = data?.profile?.officers || [];
  const directors = useMemo(() => officers.filter((officer) => officer.roles.some((role) => ['DIRECTOR', 'MANAGER', 'SIGNATORY', 'OTHER'].includes(role))), [officers]);
  const secretaries = useMemo(() => officers.filter((officer) => officer.roles.includes('SECRETARY')), [officers]);
  const sefs = useMemo(() => officers.filter((officer) => officer.roles.includes('SEF')), [officers]);

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'company', label: 'Company' },
    { key: 'officers', label: 'Directors & Managers', count: directors.length },
    { key: 'shareholders', label: 'Shareholders', count: data?.profile?.shareholders.length ?? 0 },
    { key: 'secretary', label: 'Secretary', count: secretaries.length },
    { key: 'sef', label: 'SEF', count: sefs.length },
    { key: 'ubos', label: 'UBOs', count: data?.profile?.ubos.length ?? 0 },
    { key: 'documents', label: 'KYC & Documents', count: data?.legalDocuments.length ?? 0 },
    { key: 'crrf', label: 'CRRF' },
    { key: 'cdd', label: 'CDD', count: folderCount('CDD') },
    { key: 'monitoring', label: 'Monitoring', count: folderCount('MONITORING') },
    { key: 'compliance-docs', label: 'Compliance Docs', count: folderCount('COMPLIANCE') },
    { key: 'screening', label: 'Screening', count: monitoring?.screenings.length ?? 0 },
    { key: 'reviews', label: 'Reviews & Risk', count: monitoring ? monitoring.reviews.length + monitoring.riskChanges.length : 0 },
    { key: 'expiry', label: 'Expiry', count: monitoring?.expiryItems.filter((item) => item.isActive).length ?? 0 },
    { key: 'engagements', label: 'Engagements', count: data?.engagements.length ?? 0 }
  ];
  const requestedTab = searchParams.get('tab') as TabKey | null;
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
  const sourceNote = profileCase
    ? `From current KYC ${profileCase.kycNumber}${profile ? ` (form version ${profile.formVersion}, updated ${formatDate(profile.formUpdatedAt)})` : ''}.${canEdit ? ' Edits here are audited and do not change the approved KYC.' : ''}${openRekyc && canEdit ? ` Re-KYC ${openRekyc.kycNumber} is in progress: edits made here are kept when it is approved, but its reviewers do not see them, so also enter them in the re-KYC form.` : ''}`
    : 'No KYC case with a form is linked to this client.';
  const editing: ProfileEditing = {
    canEdit: canEdit && Boolean(profile),
    edited: new Set(data.editedFields),
    ids: {
      clientId: client.id,
      canEdit: canEdit && Boolean(profile),
      canOpenKyc,
      documents: data.identityDocuments || [],
      kycDocuments: data.legalDocuments,
      kycNumbers: Object.fromEntries(data.kycCases.map((kycCase) => [kycCase.id, kycCase.kycNumber])),
      rolesByPerson: rolesByPerson(profile),
      saveField: async (ref, field, value) => {
        const next = await updateComplianceProfileField(client.id, { section: ref.section, rowId: ref.rowId || undefined, field, value });
        setData(next);
        showToast('Saved.', 'success');
        loadMonitoring();
      },
      isEdited: (ref, field) => data.editedFields.includes(`${ref.section}|${ref.rowId}|${field}`),
      onUploaded: (next) => {
        setData(next);
        loadMonitoring();
        loadFolders();
      },
      openKycDocuments: () => setSearchParams({ tab: 'documents' }, { replace: true })
    },
    save: async (ref, field, value) => {
      const next = await updateComplianceProfileField(client.id, { section: ref.section, rowId: ref.rowId || undefined, field, value });
      setData(next);
      showToast('Saved.', 'success');
      // QID / passport dates feed the Expiry tab.
      loadMonitoring();
    }
  };
  const companyRef: ProfileRef = { section: 'COMPANY', rowId: '', rowLabel: null };
  const activeEngagements = data.engagements.filter((engagement) => engagement.status === 'IN_PROGRESS' || engagement.status === 'PENDING').length;

  async function openDocument(document: ComplianceClientDetail['legalDocuments'][number]) {
    try {
      await viewLegalDocument(document.kycCaseId, { ...document, status: 'UPLOADED' } as LegalDocument);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to open this document.'), 'error');
    }
  }

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
              <Badge className={riskTone[client.riskLevel || 'PENDING']}>{client.riskLevel ? `${riskLabels[client.riskLevel]} risk` : 'Risk pending'}</Badge>
              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{client.cddType ? cddLabels[client.cddType] : 'CDD not set'}</Badge>
              {client.pendingRiskChange ? (
                <button type="button" onClick={() => setSearchParams({ tab: 'reviews' }, { replace: true })}>
                  <Badge className="bg-amber-50 text-amber-700 ring-amber-200">{`Risk change to ${riskLabels[client.pendingRiskChange.proposedRisk]} awaiting approval`}</Badge>
                </button>
              ) : null}
              {client.reviewInProgress ? (
                <button type="button" onClick={() => setSearchParams({ tab: 'reviews' }, { replace: true })}>
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
            <HeaderStat label="Last review" value={formatDate(client.lastReviewDate)} />
            <HeaderStat
              label="Next review"
              value={formatDate(client.nextReviewDate)}
              tone={client.reviewState === 'OVERDUE' ? 'text-rose-700' : client.reviewState === 'DUE_SOON' ? 'text-amber-700' : undefined}
            />
            <HeaderStat label="Engagements" value={`${activeEngagements} active / ${data.engagements.length}`} />
          </dl>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4 text-slate-400" />{client.email || 'No email'}</span>
          <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4 text-slate-400" />{client.phone || 'No phone'}</span>
          <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-slate-400" /><span className="break-words">{client.address || profile?.company.registeredOfficeAddress || 'No address'}</span></span>
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
            <RegisterDetails data={data} canEdit={canEdit} onSaved={load} onRiskChange={() => setSearchParams({ tab: 'reviews' }, { replace: true })} />
            <Panel title="Risk history" description="Risk reclassifications recorded on this client's KYC cases.">
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
            </Panel>
          </div>
          <div className="space-y-6">
            <Panel title="Current KYC assessment" description={sourceNote}>
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
            </Panel>
            <Panel title="Key communication person">
              {profile ? (
                <>
                <EditableFields columns={2} items={[
                  profileItem(editing, profile.keyContact.ref, 'Name', profile.keyContact.fullName, 'fullName', 'text', profile.keyContact.fullName),
                  profileItem(editing, profile.keyContact.ref, 'Position', profile.keyContact.position, 'position', 'list', profile.keyContact.position),
                  profileItem(editing, profile.keyContact.ref, 'Mobile', profile.keyContact.mobileNumber, 'mobileNumber', 'text', profile.keyContact.mobileNumber),
                  profileItem(editing, profile.keyContact.ref, 'Email', profile.keyContact.email, 'email', 'email', profile.keyContact.email),
                  profileItem(editing, profile.keyContact.ref, 'Nationality', profile.keyContact.nationality, 'nationality', 'list', profile.keyContact.nationality),
                  ...identityItems(editing, profile.keyContact as PersonIdentity & { ref: ProfileRef })
                ]} />
                {profile.keyContact.fullName ? <IdentityDocumentsBlock person={profile.keyContact} context={editing.ids} /> : null}
                </>
              ) : data.contacts.length ? (
                <ul className="space-y-3 text-sm">
                  {data.contacts.map((contact) => (
                    <li key={contact.id}>
                      <p className="font-medium text-slate-900">{contact.name}{contact.isPrimary ? <span className="ml-2 text-xs text-slate-500">Primary</span> : null}</p>
                      <p className="text-slate-500">{[contact.position, contact.email, contact.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No contact recorded.</Empty>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      {activeTab === 'company' ? (
        <Panel title="Company details" description={sourceNote}>
          {profile ? (
            <EditableFields items={[
              profileItem(editing, companyRef, 'Legal name', profile.company.legalName, 'legalName', 'text', profile.company.legalName),
              profileItem(editing, companyRef, 'Legal form', profile.company.legalForm, 'legalForm', 'list', profile.company.legalForm),
              profileItem(editing, companyRef, 'CR / QFC number', profile.company.commercialRegistrationNo || client.registrationNumber, 'commercialRegistrationNo', 'text', profile.company.commercialRegistrationNo),
              profileItem(editing, companyRef, 'Country of incorporation', profile.company.countryOfIncorporation, 'countryOfIncorporation', 'list', profile.company.countryOfIncorporation),
              profileItem(editing, companyRef, 'Date of incorporation', profile.company.dateOfIncorporation ? formatDate(profile.company.dateOfIncorporation) : null, 'dateOfIncorporation', 'date', profile.company.dateOfIncorporation),
              profileItem(editing, companyRef, 'Tax identification no.', profile.company.taxIdentificationNo, 'taxIdentificationNo', 'text', profile.company.taxIdentificationNo),
              profileItem(editing, companyRef, 'Registered office address', profile.company.registeredOfficeAddress, 'registeredOfficeAddress', 'longtext', profile.company.registeredOfficeAddress),
              profileItem(editing, companyRef, 'Telephone', profile.company.telephone, 'telephone', 'text', profile.company.telephone),
              profileItem(editing, companyRef, 'Email', profile.company.email, 'email', 'email', profile.company.email),
              profileItem(editing, companyRef, 'Website', profile.company.website, 'website', 'text', profile.company.website),
              profileItem(editing, companyRef, 'Nature of business', profile.company.businessNature, 'businessNature', 'list', profile.company.businessNature, { hint: 'Separate several with commas.' }),
              profileItem(editing, companyRef, 'Related industry', profile.company.relatedIndustry, 'relatedIndustry', 'list', profile.company.relatedIndustry, { hint: 'Separate several with commas.' }),
              profileItem(editing, companyRef, 'Licensed activities', profile.company.licenseActivities, 'licenseActivities', 'longtext', profile.company.licenseActivities),
              profileItem(editing, companyRef, 'Services requested', profile.company.prospectiveServices, 'prospectiveService', 'list', profile.company.prospectiveServices, { hint: 'Separate several with commas.' })
            ]} />
          ) : (
            <Empty>No KYC form data is available for this client yet.</Empty>
          )}
        </Panel>
      ) : null}

      {activeTab === 'officers' ? (
        <Panel title="Directors & managers" description={`Board members, managers and authorized signatories. ${sourceNote}`}>
          <OfficerCards officers={directors} editing={editing} empty="No directors or managers recorded in the KYC form." />
        </Panel>
      ) : null}

      {activeTab === 'shareholders' ? (
        <Panel title="Shareholders" description={`Ownership structure. ${sourceNote}`}>
          <PartyCards parties={profile?.shareholders || []} editing={editing} kind="shareholder" empty="No shareholders recorded in the KYC form." />
        </Panel>
      ) : null}

      {activeTab === 'secretary' ? (
        <Panel title="Company secretary" description={`Officers whose position includes Secretary. ${sourceNote}`}>
          <OfficerCards officers={secretaries} editing={editing} empty="No company secretary recorded in the KYC form." />
        </Panel>
      ) : null}

      {activeTab === 'sef' ? (
        <Panel title="Senior Executive Functions" description={`Officers whose position is SEF / Senior Executive Function. ${sourceNote}`}>
          <OfficerCards officers={sefs} editing={editing} empty="No SEF recorded in the KYC form." />
        </Panel>
      ) : null}

      {activeTab === 'ubos' ? (
        <Panel title="Ultimate beneficial owners" description={`Same beneficial-owner list as the KYC form and exports. ${sourceNote}`}>
          <PartyCards parties={profile?.ubos || []} editing={editing} kind="ubo" empty="No beneficial owners recorded in the KYC form." />
        </Panel>
      ) : null}

      {activeTab === 'documents' ? (
        <div className="space-y-6">
          <KycHistory data={data} canEdit={canEdit} canOpenKyc={canOpenKyc} onStarted={load} />
          <Panel title="Legal & KYC documents" description="Files uploaded on this client's KYC cases. Client-level files are in the CDD, Monitoring and Compliance Docs tabs.">
            {data.legalDocuments.length ? (
              <ul className="divide-y divide-slate-100">
                {data.legalDocuments.map((document) => {
                  const kycNumber = data.kycCases.find((kycCase) => kycCase.id === document.kycCaseId)?.kycNumber;
                  return (
                    <li key={document.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{document.documentType}</p>
                          <p className="break-all text-xs text-slate-500">{document.fileName} · {formatDate(document.createdAt)}{kycNumber ? ` · ${kycNumber}` : ''}</p>
                        </div>
                      </div>
                      {canOpenKyc ? (
                        <button type="button" onClick={() => openDocument(document)} className="self-start rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:self-auto">
                          View
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>No documents uploaded on this client's KYC cases.</Empty>
            )}
          </Panel>
        </div>
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

      {(['cdd', 'monitoring', 'compliance-docs'] as TabKey[]).includes(activeTab) ? (
        foldersError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{foldersError}</p>
        ) : !folders ? (
          <p className="text-sm text-slate-500">Loading documents...</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              {activeTab === 'cdd'
                ? 'Customer due diligence evidence kept on this client record.'
                : activeTab === 'monitoring'
                  ? 'Ongoing monitoring evidence, reviews and correspondence.'
                  : "Compliance documentation folders. Folders are shared by all clients; the files are this client's."}
            </p>
            <ClientDocumentFolders
              key={activeTab}
              clientId={client.id}
              sections={folderSections(activeTab === 'cdd' ? 'CDD' : activeTab === 'monitoring' ? 'MONITORING' : 'COMPLIANCE')}
              canEdit={canEdit}
              allowCustomFolders={activeTab === 'compliance-docs'}
              collapsible={activeTab === 'compliance-docs'}
              onChange={(next) => (next ? setFolders(next) : loadFolders())}
            />
          </div>
        )
      ) : null}

      {(['screening', 'reviews', 'expiry'] as TabKey[]).includes(activeTab) ? (
        monitoringError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{monitoringError}</p>
        ) : !monitoring ? (
          <p className="text-sm text-slate-500">Loading monitoring records...</p>
        ) : activeTab === 'screening' ? (
          <ScreeningPanel clientId={client.id} data={monitoring} canEdit={canEdit} onChange={onMonitoringChange} />
        ) : activeTab === 'reviews' ? (
          <ReviewsPanel clientId={client.id} data={monitoring} canEdit={canEdit} onChange={onMonitoringChange} clientStatus={client.status} currentUserId={user?.id} />
        ) : (
          <ExpiryPanel
            clientId={client.id}
            data={monitoring}
            canEdit={canEdit}
            onChange={onMonitoringChange}
            holderSuggestions={[
              { name: client.name, role: 'Company' },
              ...(profile?.officers || []).map((officer) => ({ name: officer.fullName, role: officer.positions.join(', ') || 'Officer' })),
              ...(profile?.shareholders || []).map((holder) => ({ name: holder.fullName, role: 'Shareholder' })),
              ...(profile?.ubos || []).map((ubo) => ({ name: ubo.fullName, role: 'UBO' }))
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
      <EditableFields items={[
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
      ]} />
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
