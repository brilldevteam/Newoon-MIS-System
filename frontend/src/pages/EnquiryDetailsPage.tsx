import { ArrowLeft, ArrowRight, Building2, CheckCircle2, CircleDashed, ClipboardCheck, Clock, Download, Edit3, Eye, FilePlus2, FileText, MessageSquare, Send, UserRound, Users } from 'lucide-react';
import { ComponentType, FormEvent, ReactNode, useEffect, useState } from 'react';
import { PreliminaryKycDocument } from '../components/PreliminaryKycDocument';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addEnquiryComment,
  convertEnquiryToKyc,
  downloadEnquiryAttachment,
  downloadEnquiryAttachmentGroup,
  downloadPreliminaryKycPdf,
  Enquiry,
  EnquiryAttachment,
  EnquiryStatus,
  getEnquiry,
  updateEnquiryStatus,
  viewEnquiryAttachment
} from '../services/kyc-workflow.service';
import { getApiErrorMessage } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { hasAnyRole, workflowRoles } from '../utils/access-control';
import { canEditEnquiryRecord } from '../utils/enquiry-edit-access';
import { kycStatusLabel, kycStatusOwner } from '../utils/kyc-status-labels';
import { kycDocumentTypes } from '../utils/kyc-document-types';
import { restoreDocumentPeople } from '../utils/document-people';

const enquiryTypeLabels: Record<string, string> = {
  EXISTING_LEGAL_ENTITY: 'Existing Legal Entity',
  PROPOSED_COMPANY: 'Proposed Company - No Legal Status Yet',
  CURRENT_CLIENT_NEW_SERVICES: 'Current Client - New Services Requested'
};

// Shown as a toast after a status change succeeds.
const statusSuccessMessages: Record<string, string> = {
  SUBMITTED_TO_AML_SUPERVISOR: 'Enquiry submitted to the AML Supervisor.',
  RETURNED_TO_BD: 'Enquiry returned to BD with your note.',
  READY_FOR_KYC: 'Enquiry marked ready for KYC.',
  CLOSED: 'Enquiry closed.'
};

const enquiryStatusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED_TO_AML_SUPERVISOR: 'Submitted to AML Supervisor',
  RETURNED_TO_BD: 'Returned to BD',
  READY_FOR_KYC: 'Ready for KYC',
  CONVERTED_TO_KYC: 'Pending with AML Supervisor',
  CLOSED: 'Closed'
};

function actorName(actor?: { firstName: string; lastName: string; email: string } | null) {
  if (!actor) return 'System';
  return `${actor.firstName} ${actor.lastName}`.trim() || actor.email;
}

function groupedAttachments(attachments: EnquiryAttachment[] = []) {
  const groups = new Map<string, EnquiryAttachment[]>();
  attachments.forEach((attachment) => {
    const documentType = attachment.documentType || 'Other attachments';
    groups.set(documentType, [...(groups.get(documentType) || []), attachment]);
  });
  return Array.from(groups.entries()).map(([documentType, items]) => ({ documentType, items }));
}

export function EnquiryDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    loadEnquiry(id);
  }, [id]);

  function loadEnquiry(enquiryId: string) {
    setError('');
    getEnquiry(enquiryId)
      .then(setEnquiry)
      .catch((requestError: any) => setError(requestError.response?.data?.message || 'Unable to load enquiry.'));
  }

  async function setStatus(status: EnquiryStatus) {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateEnquiryStatus(id, { status, note: statusNote || undefined });
      setEnquiry(updated);
      setStatusNote('');
      showToast(statusSuccessMessages[status] || 'Enquiry status updated.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to update enquiry status.');
    } finally {
      setSaving(false);
    }
  }

  async function createKycFromEnquiry() {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const kycCase = await convertEnquiryToKyc(id);
      showToast(`KYC case ${kycCase.kycNumber || ''} created from this enquiry.`.replace('  ', ' '), 'success');
      navigate(`/kyc/${kycCase.id}`);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, 'Unable to create KYC case from this enquiry.'));
    } finally {
      setSaving(false);
    }
  }

  async function downloadPreliminaryKyc() {
    if (!id || saving) return;
    setSaving(true);
    setDownloadingPdf(true);
    setError('');
    try { await downloadPreliminaryKycPdf(id); showToast('Preliminary KYC PDF downloaded.', 'success'); }
    catch (failure) { setError(getApiErrorMessage(failure, 'Unable to download Preliminary KYC PDF.')); }
    finally { setSaving(false); setDownloadingPdf(false); }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !comment.trim()) return;
    setSaving(true);
    setError('');
    try {
      const updated = await addEnquiryComment(id, { body: comment.trim() });
      setEnquiry(updated);
      setComment('');
      showToast('Comment added.', 'success');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to add comment.');
    } finally {
      setSaving(false);
    }
  }

  async function openAttachment(attachment: EnquiryAttachment) {
    if (!enquiry) return;
    if (!attachment.storagePath) {
      setError('Uploaded file is not available for this attachment.');
      return;
    }
    setError('');
    try {
      await viewEnquiryAttachment(enquiry.id, attachment);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to open enquiry attachment.');
    }
  }

  async function saveAttachment(attachment: EnquiryAttachment) {
    if (!enquiry) return;
    if (!attachment.storagePath) {
      setError('Uploaded file is not available for this attachment.');
      return;
    }
    setError('');
    try {
      await downloadEnquiryAttachment(enquiry.id, attachment);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to download enquiry attachment.');
    }
  }

  async function saveAttachmentGroup(documentType: string, attachments: EnquiryAttachment[]) {
    if (!enquiry) return;
    const downloadable = attachments.filter((attachment) => attachment.storagePath);
    if (!downloadable.length) {
      setError('No uploaded files are available for this attachment group.');
      return;
    }

    setError('');
    try {
      if (downloadable.length === 1) {
        await downloadEnquiryAttachment(enquiry.id, downloadable[0]);
        return;
      }

      await downloadEnquiryAttachmentGroup(enquiry.id, documentType);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to download all files for this attachment group.');
    }
  }

  if (!enquiry) {
    return (
      <div className="space-y-3">
        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <p className="text-sm text-slate-500">Loading enquiry...</p>
      </div>
    );
  }

  const title = enquiry.companyName || enquiry.proposedCompanyName || enquiry.client?.name || 'Untitled enquiry';
  const details = enquiry.details || {};
  const preliminaryKyc = details.preliminaryKyc && typeof details.preliminaryKyc === 'object' ? details.preliminaryKyc as Record<string, any> : null;
  const enquiryReturnedOrDraft = ['DRAFT', 'RETURNED_TO_BD'].includes(enquiry.status);
  const canEditEnquiry = canEditEnquiryRecord(user, enquiry);
  const canSubmitToAmlSupervisor = hasAnyRole(user, workflowRoles.caseCreation) && enquiryReturnedOrDraft;
  const canAmlManageStatus = hasAnyRole(user, ['AML_SUPERVISOR', 'AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN']);
  const canAddComment = hasAnyRole(user, ['OPERATING_TEAM', 'AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN']);
  const generatedKycCase = enquiry.generatedKycCases?.[0];
  const attachmentGroups = groupedAttachments(enquiry.attachments || []);

  const statusText = generatedKycCase ? kycStatusLabel(generatedKycCase.status) : enquiryStatusLabels[enquiry.status];
  const profile = details.companyProfile && typeof details.companyProfile === 'object' ? details.companyProfile as Record<string, unknown> : {};
  const people = restoreDocumentPeople(details.documentPeople).filter((person) => person.row.fullName);
  // Whose copy a QID / passport file is, from the people added on the Attachments step.
  const personOfFile = (fileName: string) => {
    const person = people.find((item) => item.files.includes(fileName));
    if (!person) return null;
    const kind = person.kinds?.[fileName];
    return { name: person.row.fullName as string, kind: kind === 'QID' ? 'QID' : kind === 'PASSPORT' ? 'Passport' : '' };
  };
  const isCurrentClient = enquiry.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES';
  const requiredTypes = isCurrentClient ? [] : kycDocumentTypes;
  const providedRequired = requiredTypes.filter((type) => attachmentGroups.some((group) => group.documentType === type && group.items.length)).length;
  const companyRows: Array<[string, string | null | undefined, boolean?]> = enquiry.enquiryType === 'PROPOSED_COMPANY'
    ? [
        ['Proposed legal form', String(details.proposedLegalForm || '')], ['Jurisdiction of registration', String(details.jurisdictionOfRegistration || '')],
        ['Source of initial capital', String(details.sourceOfInitialCapital || '')], ['Head office', enquiry.headOfficeCountry], ['Branch', enquiry.branchCountry],
        ['Proposed business activity', String(details.proposedBusinessActivity || ''), true], ['Proposed registered office address', String(details.proposedRegisteredOfficeAddress || ''), true],
        ['Area of operation', enquiry.areaOfOperation, true]
      ]
    : [
        ...companyProfileLabels.map(([key, label, wide]) => [label, String(profile[key] || ''), wide] as [string, string, boolean | undefined]),
        ['Head office', enquiry.headOfficeCountry], ['Branch', enquiry.branchCountry], ['Area of operation', enquiry.areaOfOperation, true]
      ];
  const hasCompany = companyRows.some(([, value]) => value);
  const contactRows: Array<[string, string | null | undefined]> = [
    ['Name', enquiry.keyContactName], ['Position', enquiry.keyContactPosition], ['Email', enquiry.keyContactEmail], ['Phone', enquiry.keyContactPhone],
    ['Nationality', String(details.keyContactNationality || '')], ['Passport number', String(details.keyContactPassportNumber || '')], ['Passport expiry', String(details.keyContactPassportExpiryDate || '')],
    ['QID number', String(details.keyContactQidNumber || '')], ['QID expiry', String(details.keyContactQidExpiryDate || '')],
    ['QID / Passport number', !details.keyContactPassportNumber && !details.keyContactQidNumber ? String(details.keyContactIdentityNumber || '') : '']
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link to="/enquiries" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
            <ArrowLeft className="h-4 w-4" />
            Back to enquiries
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{enquiry.enquiryCode}</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone[enquiry.status] || 'bg-slate-100 text-slate-700'}`}>{statusText}</span>
          </div>
          <h1 className="mt-1.5 break-words text-2xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{enquiryTypeLabels[enquiry.enquiryType]}</p>
        </div>
        {canEditEnquiry ? (
          <Link to={`/enquiries/${enquiry.id}/edit`} className="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Edit3 className="h-4 w-4" />
            Edit Enquiry
          </Link>
        ) : null}
      </header>

      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <EnquiryNextStep
        status={enquiry.status}
        canOperate={canSubmitToAmlSupervisor}
        canAml={canAmlManageStatus}
        canEdit={canEditEnquiry}
        editUrl={`/enquiries/${enquiry.id}/edit`}
        kycCase={generatedKycCase ? { id: generatedKycCase.id, label: kycStatusLabel(generatedKycCase.status), owner: kycStatusOwner(generatedKycCase.status) } : null}
      />

      <section aria-label="Summary" className="grid divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1.5 text-sm font-medium text-slate-950">{statusText}</p>
          {generatedKycCase && kycStatusOwner(generatedKycCase.status) ? <p className="mt-0.5 text-xs text-slate-500">Now with: {kycStatusOwner(generatedKycCase.status)}</p> : null}
        </div>
        <div className="min-w-0 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requested services</p>
          {enquiry.requestedServices?.length ? <ul className="mt-1.5 flex flex-wrap gap-1.5">{enquiry.requestedServices.map((service) => <li key={service} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{service}</li>)}</ul> : <p className="mt-1.5 text-sm text-slate-500">Not selected</p>}
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked client</p>
          <p className="mt-1.5 text-sm font-medium text-slate-950">{enquiry.client?.name || 'Not linked yet'}</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents</p>
          {requiredTypes.length ? (
            <>
              <p className="mt-1.5 text-sm font-medium text-slate-950">{providedRequired} of {requiredTypes.length} required provided</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((providedRequired / requiredTypes.length) * 100)}%` }} /></div>
            </>
          ) : <p className="mt-1.5 text-sm font-medium text-slate-950">{enquiry.attachments?.length || 0} file{enquiry.attachments?.length === 1 ? '' : 's'}</p>}
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="min-w-0 space-y-5">
          {hasCompany || enquiry.notes ? (
            <Card icon={Building2} title="Company details">
              {hasCompany ? (
                <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {companyRows.map(([label, value, wide]) => <Info key={label} label={label} value={value} wide={wide} />)}
                </dl>
              ) : null}
              {enquiry.notes ? <div className={hasCompany ? 'mt-4 border-t border-slate-100 pt-4' : ''}><dl><Info label="Notes" value={enquiry.notes} /></dl></div> : null}
            </Card>
          ) : null}

          {!isCurrentClient && contactRows.some(([, value]) => value) ? (
            <Card icon={UserRound} title="Key contact">
              <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {contactRows.map(([label, value]) => <Info key={label} label={label} value={value} />)}
              </dl>
            </Card>
          ) : null}

          {people.length ? (
            <Card icon={Users} title="People" count={people.length}>
              <ul className="divide-y divide-slate-100">
                {people.map((person) => (
                  <li key={person.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-950">{person.row.fullName}</p>
                      <p className="mt-0.5 break-words text-xs text-slate-500">{[person.row.qidNumber && `QID ${person.row.qidNumber}`, person.row.passportNumber && `Passport ${person.row.passportNumber}`, person.row.nationality, person.row.ownershipPercentage && `${person.row.ownershipPercentage}%`].filter(Boolean).join(' · ') || 'No identity details'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                      {(person.positions || []).length ? person.positions!.map((position) => <span key={position} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">{position}</span>) : <span className="text-xs text-slate-400">No position</span>}
                      <span className={`inline-flex items-center gap-1 text-xs ${person.files.length ? 'text-emerald-700' : 'text-slate-400'}`}><FileText aria-hidden="true" className="h-3.5 w-3.5" />{person.files.length ? `${person.files.length} cop${person.files.length === 1 ? 'y' : 'ies'}` : 'No copy'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {enquiry.enquiryType === 'PROPOSED_COMPANY' && preliminaryKyc ? <PreliminaryKycDocument data={{ ...preliminaryKyc, kycNumber: generatedKycCase?.kycNumber || '', expectedBusiness: preliminaryKyc.expectedBusiness || enquiry.requestedServices }} /> : null}

          <Card icon={FileText} title="Attachments" count={enquiry.attachments?.length || 0}>
            <ul className="divide-y divide-slate-100">
              {[...requiredTypes.map((type) => ({ documentType: type, items: attachmentGroups.find((group) => group.documentType === type)?.items || [] })), ...attachmentGroups.filter((group) => !requiredTypes.includes(group.documentType))].map((group) => {
                const downloadableCount = group.items.filter((attachment) => attachment.storagePath).length;
                return (
                  <li key={group.documentType} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-950">
                        {group.items.length ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" /> : <CircleDashed aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-300" />}
                        <span className="min-w-0 break-words">{group.documentType}</span>
                      </p>
                      {group.items.length ? (
                        <button type="button" onClick={() => saveAttachmentGroup(group.documentType, group.items)} disabled={!downloadableCount} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                          <Download className="h-3.5 w-3.5" />
                          {downloadableCount > 1 ? 'Download ZIP' : 'Download'}
                        </button>
                      ) : <span className="shrink-0 text-xs text-slate-400">Not provided</span>}
                    </div>
                    {group.items.length ? (
                      <ul className="mt-2 space-y-1.5 pl-6">
                        {group.items.map((attachment) => (
                          <li key={attachment.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-1.5">
                            <div className="min-w-0">
                              {(() => {
                                const owner = personOfFile(attachment.fileName);
                                return owner ? (
                                  <>
                                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium text-slate-900">
                                      <span className="inline-flex items-center gap-1.5"><UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />{owner.name}</span>
                                      {owner.kind ? <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">{owner.kind}</span> : null}
                                    </p>
                                    <p className="break-all text-xs text-slate-500">{attachment.fileName}</p>
                                  </>
                                ) : <p className="break-all text-sm text-slate-900">{attachment.fileName}</p>;
                              })()}
                              {attachment.storagePath ? null : <p className="text-xs text-amber-700">Metadata only</p>}
                            </div>
                            <div className="flex shrink-0 gap-1.5">
                              <button type="button" onClick={() => openAttachment(attachment)} disabled={!attachment.storagePath} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" title={attachment.storagePath ? 'View' : 'File unavailable'} aria-label={`View ${attachment.fileName}`}><Eye className="h-4 w-4" /></button>
                              <button type="button" onClick={() => saveAttachment(attachment)} disabled={!attachment.storagePath} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" title={attachment.storagePath ? 'Download' : 'File unavailable'} aria-label={`Download ${attachment.fileName}`}><Download className="h-4 w-4" /></button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
              {!requiredTypes.length && !attachmentGroups.length ? <li className="text-sm text-slate-500">No attachment metadata captured yet.</li> : null}
            </ul>
          </Card>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-20">
          <section id="status-actions" className="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">Status Actions</h2>
            <textarea value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder={canAmlManageStatus && enquiry.status === 'SUBMITTED_TO_AML_SUPERVISOR' ? 'Status note - required when returning to BD: say what Operations must correct' : 'Optional status note'} className="mt-3 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            {canAmlManageStatus && enquiry.status === 'SUBMITTED_TO_AML_SUPERVISOR' && !statusNote.trim() ? <p className="mt-1 text-xs text-slate-500">To return this enquiry to BD, first write the reason above so Operations knows what to fix.</p> : null}
            <div className="mt-3 flex flex-col gap-2">
              {canSubmitToAmlSupervisor ? (
                <button type="button" disabled={saving} onClick={() => setStatus('SUBMITTED_TO_AML_SUPERVISOR')} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  <Send className="h-4 w-4" />
                  Submit to AML Supervisor
                </button>
              ) : null}
              {canAmlManageStatus && enquiry.status === 'READY_FOR_KYC' ? (
                <button type="button" disabled={saving} onClick={createKycFromEnquiry} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  <FilePlus2 className="h-4 w-4" />
                  Create KYC Case
                </button>
              ) : null}
              {canAmlManageStatus && enquiry.status === 'SUBMITTED_TO_AML_SUPERVISOR' ? (
                <>
                  <button type="button" disabled={saving} onClick={() => setStatus('READY_FOR_KYC')} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                    <ClipboardCheck className="h-4 w-4" />
                    Mark Ready for KYC
                  </button>
                  <button type="button" disabled={saving || !statusNote.trim()} title={statusNote.trim() ? undefined : 'Write the reason in the status note first'} onClick={() => setStatus('RETURNED_TO_BD')} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                    Return to BD
                  </button>
                </>
              ) : null}
              {enquiry.status === 'CONVERTED_TO_KYC' && generatedKycCase ? (
                <Link to={`/kyc/${generatedKycCase.id}`} className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                  <ClipboardCheck className="h-4 w-4" />
                  Open KYC Case {generatedKycCase.kycNumber}
                </Link>
              ) : null}
              {enquiry.enquiryType === 'PROPOSED_COMPANY' && preliminaryKyc ? (
                <>
                  <button type="button" onClick={() => document.getElementById('preliminary-kyc-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">
                    View Preliminary KYC
                  </button>
                  <button type="button" disabled={saving} onClick={downloadPreliminaryKyc} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                    <Download className={`h-4 w-4 ${downloadingPdf ? 'animate-pulse' : ''}`} />
                    {downloadingPdf ? 'Preparing PDF…' : 'Download Preliminary KYC PDF'}
                  </button>
                </>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950"><Clock aria-hidden="true" className="h-4 w-4 text-slate-400" />Timeline</h2>
            </div>
            {enquiry.statusHistory?.length ? (
              <ol className="space-y-4 p-5">
                {enquiry.statusHistory.map((item, index) => (
                  <li key={item.id} className="relative pl-5">
                    <span aria-hidden="true" className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-brand-600' : 'bg-slate-300'}`} />
                    {index < enquiry.statusHistory!.length - 1 ? <span aria-hidden="true" className="absolute bottom-[-1rem] left-[4px] top-4 w-px bg-slate-200" /> : null}
                    <p className="text-sm font-medium text-slate-950">{enquiryStatusLabels[item.toStatus] || item.toStatus}</p>
                    <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()} | {actorName(item.changedBy)}</p>
                    {item.note ? <p className="mt-1 text-sm text-slate-600">{item.note}</p> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="px-5 py-6 text-sm text-slate-500">No status history yet.</p>}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950"><MessageSquare aria-hidden="true" className="h-4 w-4 text-slate-400" />Comments</h2>
            </div>
            {canAddComment ? (
              <form onSubmit={submitComment} className="border-b border-slate-200 p-5">
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add enquiry comment" className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <button type="submit" disabled={saving || !comment.trim()} className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  <MessageSquare className="h-4 w-4" />
                  Add Comment
                </button>
              </form>
            ) : null}
            <div className="divide-y divide-slate-100">
              {enquiry.comments?.length ? enquiry.comments.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <p className="text-sm text-slate-600">{item.body}</p>
                  <p className="mt-1 text-xs text-slate-500">{actorName(item.author)} | {new Date(item.createdAt).toLocaleString()}</p>
                </div>
              )) : <p className="px-5 py-6 text-sm text-slate-500">No comments yet.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

const statusTone: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED_TO_AML_SUPERVISOR: 'bg-sky-100 text-sky-800',
  RETURNED_TO_BD: 'bg-amber-100 text-amber-800',
  READY_FOR_KYC: 'bg-emerald-100 text-emerald-800',
  CONVERTED_TO_KYC: 'bg-violet-100 text-violet-800',
  CLOSED: 'bg-slate-200 text-slate-600'
};

// Company details of an existing legal entity, as captured on the enquiry Details step.
const companyProfileLabels: Array<[string, string, boolean?]> = [
  ['commercialRegistrationNo', 'Commercial registration no'], ['dateOfIncorporation', 'Date of incorporation'], ['crExpiryDate', 'CR expiry date'],
  ['countryOfIncorporation', 'Country of incorporation'], ['placeOfIncorporation', 'Place of incorporation'], ['legalForm', 'Legal form'],
  ['registeredOfficeAddress', 'Registered office address', true], ['shareCapital', 'Share capital'], ['taxIdentificationNo', 'Tax card no (TIN)'],
  ['poBox', 'PO box'], ['telephone', 'Telephone'], ['email', 'Email'], ['website', 'Website'],
  ['businessNature', 'Main purpose / nature of business', true], ['relatedIndustry', 'Related industry'], ['licenseActivities', 'License activities', true],
  ['financialYearEnd', 'Financial year end'], ['approvedAuditor', 'Approved auditor']
];

function Card({ icon: Icon, title, count, children }: { icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>; title: string; count?: number; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950"><Icon aria-hidden="true" className="h-4 w-4 text-slate-400" />{title}</h2>
        {count !== undefined ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{count}</span> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Info({ label, value, wide = false }: { label: string; value?: string | null; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-950">{value}</dd>
    </div>
  );
}

// Plain-English "what happens next" for the enquiry, so Operations and AML always know their next click.
function EnquiryNextStep({ status, canOperate, canAml, canEdit, editUrl, kycCase }: {
  status: string;
  canOperate: boolean;
  canAml: boolean;
  canEdit: boolean;
  editUrl: string;
  kycCase: { id: string; label: string; owner: string | null } | null;
}) {
  const jump = () => document.getElementById('status-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  let mine = false;
  let info = false;
  let text = '';
  let action: { label: string; to?: string; onClick?: () => void } | null = null;

  if (status === 'DRAFT' || status === 'RETURNED_TO_BD') {
    const returned = status === 'RETURNED_TO_BD';
    if (canOperate) {
      mine = true;
      text = returned
        ? 'AML returned this enquiry for correction. Read the reason in the Timeline below, fix it with "Edit Enquiry", then press "Submit to AML Supervisor" in Status Actions.'
        : 'Check the details and attachments are complete, then press "Submit to AML Supervisor" in Status Actions.';
      action = returned && canEdit ? { label: 'Edit Enquiry', to: editUrl } : { label: 'Go to Status Actions', onClick: jump };
    } else {
      text = returned ? 'Returned to Operations for correction. Operations will resubmit it to the AML Supervisor.' : 'Operations is still preparing this enquiry. It comes to AML once they submit it.';
    }
  } else if (status === 'SUBMITTED_TO_AML_SUPERVISOR') {
    if (canAml) {
      mine = true;
      text = 'Review the enquiry. If it is complete, press "Mark Ready for KYC" and then "Create KYC Case". If something is missing, write the reason in the status note and press "Return to BD".';
      action = { label: 'Go to Status Actions', onClick: jump };
    } else {
      text = 'Submitted. The AML Supervisor is reviewing it and will either create the KYC case or return it to you with a reason.';
    }
  } else if (status === 'READY_FOR_KYC') {
    if (canAml) {
      mine = true;
      text = 'The enquiry is approved. Press "Create KYC Case" in Status Actions to start the KYC.';
      action = { label: 'Go to Status Actions', onClick: jump };
    } else {
      text = 'Approved by AML. The AML Supervisor will create the KYC case next.';
    }
  } else if (kycCase || status === 'CONVERTED_TO_KYC') {
    info = true;
    text = kycCase ? `This enquiry is now a KYC case: ${kycCase.label}${kycCase.owner ? `, with ${kycCase.owner}` : ''}. The KYC case page shows who acts next and what is left.` : 'This enquiry has been converted to a KYC case.';
    action = kycCase ? { label: 'Open the KYC case', to: `/kyc/${kycCase.id}` } : null;
  } else if (status === 'CLOSED') {
    info = true;
    text = 'This enquiry is closed. Nothing more to do.';
  }
  if (!text) return null;

  const box = mine || info ? 'border-sky-200 bg-sky-50/60' : 'border-slate-200 bg-slate-50';
  return (
    <section aria-label="Next step" className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between ${box}`}>
      <div className="flex min-w-0 items-start gap-2">
        {mine || info ? null : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
        <p className="text-sm text-slate-700"><span className="font-semibold text-slate-950">{mine ? 'Your next step: ' : info ? 'Where it is now: ' : 'Nothing for you to do right now. '}</span>{text}</p>
      </div>
      {action ? (
        action.to ? (
          <Link to={action.to} className="inline-flex shrink-0 items-center gap-2 self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{action.label}<ArrowRight className="h-4 w-4" /></Link>
        ) : (
          <button type="button" onClick={action.onClick} className="inline-flex shrink-0 items-center gap-2 self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{action.label}<ArrowRight className="h-4 w-4" /></button>
        )
      ) : null}
    </section>
  );
}
