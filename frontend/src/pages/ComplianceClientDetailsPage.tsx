import { ArrowLeft, Eye, FileText, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ClientDocumentFolders } from '../components/ClientDocumentFolders';
import { ExpiryPanel, ReviewsPanel, ScreeningPanel } from '../components/ComplianceMonitoringPanels';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../services/api';
import {
  cddLabels,
  ClientJurisdiction,
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
const inputClass = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

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
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm text-slate-900">{value === null || value === undefined || value === '' ? <span className="text-slate-400">Not captured</span> : value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

function PartyCards({ parties, empty }: { parties: ProfileParty[]; empty: string }) {
  if (!parties.length) return <Empty>{empty}</Empty>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {parties.map((party, index) => (
        <article key={party.id || `${party.fullName}-${index}`} className="rounded-lg border border-slate-200 p-4">
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
            <Fields items={[
              ['Nationality', party.nationality],
              ['QID / Passport No.', party.identityNumber],
              ['Date of birth', party.dateOfBirth ? formatDate(party.dateOfBirth) : null],
              ['Address', party.address]
            ]} />
          </div>
        </article>
      ))}
    </div>
  );
}

function OfficerCards({ officers, empty }: { officers: ProfileOfficer[]; empty: string }) {
  if (!officers.length) return <Empty>{empty}</Empty>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {officers.map((officer, index) => (
        <article key={officer.id || `${officer.fullName}-${index}`} className="rounded-lg border border-slate-200 p-4">
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
            <Fields items={[
              ['Nationality', officer.nationality],
              ['QID / Passport No.', officer.identityNumber],
              ['Date of birth', officer.dateOfBirth ? formatDate(officer.dateOfBirth) : null],
              ['Address', officer.address],
              ['Authorized signatory', officer.isAuthorizedSignatory ? 'Yes' : 'No']
            ]} />
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
  const sourceNote = profileCase
    ? `From KYC ${profileCase.kycNumber}${profile ? ` (form version ${profile.formVersion}, updated ${formatDate(profile.formUpdatedAt)})` : ''}`
    : 'No KYC case with a form is linked to this client.';
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
            <RegisterDetails data={data} canEdit={canEdit} onSaved={load} />
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
            <Panel title="Onboarding assessment" description={sourceNote}>
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
              {profile?.keyContact ? (
                <Fields items={[
                  ['Name', profile.keyContact.fullName],
                  ['Position', profile.keyContact.position],
                  ['Mobile', profile.keyContact.mobileNumber],
                  ['Email', profile.keyContact.email]
                ]} />
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
            <Fields items={[
              ['Legal name', profile.company.legalName],
              ['Legal form', profile.company.legalForm],
              ['CR / QFC number', profile.company.commercialRegistrationNo || client.registrationNumber],
              ['Country of incorporation', profile.company.countryOfIncorporation],
              ['Date of incorporation', profile.company.dateOfIncorporation ? formatDate(profile.company.dateOfIncorporation) : null],
              ['Tax identification no.', profile.company.taxIdentificationNo],
              ['Registered office address', profile.company.registeredOfficeAddress],
              ['Telephone', profile.company.telephone],
              ['Email', profile.company.email],
              ['Website', profile.company.website],
              ['Nature of business', profile.company.businessNature],
              ['Related industry', profile.company.relatedIndustry],
              ['Licensed activities', profile.company.licenseActivities],
              ['Services requested', profile.company.prospectiveServices]
            ]} />
          ) : (
            <Empty>No KYC form data is available for this client yet.</Empty>
          )}
        </Panel>
      ) : null}

      {activeTab === 'officers' ? (
        <Panel title="Directors & managers" description={`Board members, managers and authorized signatories. ${sourceNote}`}>
          <OfficerCards officers={directors} empty="No directors or managers recorded in the KYC form." />
        </Panel>
      ) : null}

      {activeTab === 'shareholders' ? (
        <Panel title="Shareholders" description={`Ownership structure. ${sourceNote}`}>
          <PartyCards parties={profile?.shareholders || []} empty="No shareholders recorded in the KYC form." />
        </Panel>
      ) : null}

      {activeTab === 'secretary' ? (
        <Panel title="Company secretary" description={`Officers whose position includes Secretary. ${sourceNote}`}>
          <OfficerCards officers={secretaries} empty="No company secretary recorded in the KYC form." />
        </Panel>
      ) : null}

      {activeTab === 'sef' ? (
        <Panel title="Senior Executive Functions" description={`Officers whose position is SEF / Senior Executive Function. ${sourceNote}`}>
          <OfficerCards officers={sefs} empty="No SEF recorded in the KYC form." />
        </Panel>
      ) : null}

      {activeTab === 'ubos' ? (
        <Panel title="Ultimate beneficial owners" description={`Same beneficial-owner list as the KYC form and exports. ${sourceNote}`}>
          <PartyCards parties={profile?.ubos || []} empty="No beneficial owners recorded in the KYC form." />
        </Panel>
      ) : null}

      {activeTab === 'documents' ? (
        <div className="space-y-6">
          <Panel title="KYC cases" description="All KYC cases for this client, newest first.">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">KYC no.</th>
                    <th className="py-2 pr-4">Service</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Opened</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.kycCases.map((kycCase) => (
                    <tr key={kycCase.id}>
                      <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs">{kycCase.kycNumber}{profileCase?.id === kycCase.id ? <span className="ml-2 font-sans text-xs text-brand-700">Profile source</span> : null}</td>
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

function RegisterDetails({ data, canEdit, onSaved }: { data: ComplianceClientDetail; canEdit: boolean; onSaved: () => void }) {
  const { client } = data;
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ jurisdiction: client.jurisdiction || '', email: client.email || '', phone: client.phone || '', address: client.address || '' });

  useEffect(() => {
    setForm({ jurisdiction: client.jurisdiction || '', email: client.email || '', phone: client.phone || '', address: client.address || '' });
  }, [client.jurisdiction, client.email, client.phone, client.address]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateComplianceClient(client.id, {
        jurisdiction: (form.jurisdiction || 'NONE') as ClientJurisdiction | 'NONE',
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim()
      });
      showToast('Register details saved.', 'success');
      setEditing(false);
      onSaved();
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to save register details.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Register details"
      description="Compliance register fields for this client. Risk changes go through the review workflow."
      action={canEdit && !editing ? (
        <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          Edit
        </button>
      ) : undefined}
    >
      {editing ? (
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Jurisdiction
            <select value={form.jurisdiction} onChange={(event) => setForm({ ...form, jurisdiction: event.target.value })} className={`${inputClass} mt-1`}>
              <option value="">Not set</option>
              {(Object.keys(jurisdictionLabels) as ClientJurisdiction[]).map((key) => <option key={key} value={key}>{jurisdictionLabels[key]}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email
            <input type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Phone
            <input maxLength={40} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Address
            <textarea maxLength={500} rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <Fields items={[
          ['Client code', client.clientCode],
          ['Jurisdiction', client.jurisdiction ? jurisdictionLabels[client.jurisdiction] : null],
          ['CDD type', client.cddType ? cddLabels[client.cddType] : null],
          ['Email', client.email],
          ['Phone', client.phone],
          ['Address', client.address],
          ['Status reason', client.statusReason],
          ['Latest service', client.latestEngagement?.serviceName || null],
          ['Country', client.country]
        ]} />
      )}
    </Panel>
  );
}

