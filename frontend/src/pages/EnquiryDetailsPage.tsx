import { ClipboardCheck, Download, Edit3, Eye, FilePlus2, MessageSquare, Send } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addEnquiryComment,
  convertEnquiryToKyc,
  downloadEnquiryAttachment,
  downloadEnquiryAttachmentGroup,
  Enquiry,
  EnquiryAttachment,
  EnquiryStatus,
  getEnquiry,
  updateEnquiryStatus,
  viewEnquiryAttachment
} from '../services/kyc-workflow.service';
import { getApiErrorMessage } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { hasAnyRole, workflowRoles } from '../utils/access-control';

const enquiryTypeLabels: Record<string, string> = {
  EXISTING_LEGAL_ENTITY: 'Existing Legal Entity',
  PROPOSED_COMPANY: 'Proposed Company - No Legal Status Yet',
  CURRENT_CLIENT_NEW_SERVICES: 'Current Client - New Services Requested'
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
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
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
      navigate(`/kyc/${kycCase.id}`);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, 'Unable to create KYC case from this enquiry.'));
    } finally {
      setSaving(false);
    }
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
  const enquiryReturnedOrDraft = ['DRAFT', 'RETURNED_TO_BD'].includes(enquiry.status);
  const canEditEnquiry =
    hasAnyRole(user, ['COMPANY_ADMIN', 'SUPER_ADMIN', 'AML_SUPERVISOR', 'AML_TEAM']) ||
    (hasAnyRole(user, ['OPERATING_TEAM']) && enquiryReturnedOrDraft);
  const canSubmitToAmlSupervisor = hasAnyRole(user, workflowRoles.caseCreation) && enquiryReturnedOrDraft;
  const canAmlManageStatus = hasAnyRole(user, ['AML_SUPERVISOR', 'AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN']);
  const generatedKycCase = enquiry.generatedKycCases?.[0];
  const attachmentGroups = groupedAttachments(enquiry.attachments || []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{enquiry.enquiryCode}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{enquiryTypeLabels[enquiry.enquiryType]} | {enquiryStatusLabels[enquiry.status]}</p>
        </div>
        {canEditEnquiry ? (
          <Link to={`/enquiries/${enquiry.id}/edit`} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Edit3 className="h-4 w-4" />
            Edit Enquiry
          </Link>
        ) : null}
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-2 text-sm font-medium text-slate-950">{enquiryStatusLabels[enquiry.status]}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requested Services</p>
          <p className="mt-2 text-sm font-medium text-slate-950">{enquiry.requestedServices?.join(', ') || 'Not selected'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked Client</p>
          <p className="mt-2 text-sm font-medium text-slate-950">{enquiry.client?.name || 'Not linked yet'}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">Core Details</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <Info label="Key contact" value={enquiry.keyContactName} />
          <Info label="Contact email" value={enquiry.keyContactEmail} />
          <Info label="Contact phone" value={enquiry.keyContactPhone} />
          <Info label="Contact position" value={enquiry.keyContactPosition} />
          <Info label="Contact nationality" value={String(details.keyContactNationality || '')} />
          <Info label="Passport number" value={String(details.keyContactPassportNumber || '')} />
          <Info label="Passport expiry date" value={String(details.keyContactPassportExpiryDate || '')} />
          <Info label="QID number" value={String(details.keyContactQidNumber || '')} />
          <Info label="QID expiry date" value={String(details.keyContactQidExpiryDate || '')} />
          <Info label="QID / Passport number" value={!details.keyContactPassportNumber && !details.keyContactQidNumber ? String(details.keyContactIdentityNumber || '') : ''} />
          <Info label="Head office" value={enquiry.headOfficeCountry} />
          <Info label="Branch" value={enquiry.branchCountry} />
          <Info label="Area of operation" value={enquiry.areaOfOperation} wide />
          <Info label="Proposed legal form" value={String(details.proposedLegalForm || '')} />
          <Info label="Jurisdiction of registration" value={String(details.jurisdictionOfRegistration || '')} />
          <Info label="Proposed business activity" value={String(details.proposedBusinessActivity || '')} />
          <Info label="Source of initial capital" value={String(details.sourceOfInitialCapital || '')} />
          <Info label="Proposed registered office address" value={String(details.proposedRegisteredOfficeAddress || '')} wide />
          <Info label="Notes" value={enquiry.notes} wide />
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Attachments</h2>
        </div>
        <div className="space-y-3 p-5">
          {attachmentGroups.length ? (
            attachmentGroups.map((group) => {
              const downloadableCount = group.items.filter((attachment) => attachment.storagePath).length;
              return (
                <div key={group.documentType} className="rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{group.documentType}</p>
                      <p className="text-xs text-slate-500">{group.items.length} file{group.items.length === 1 ? '' : 's'} attached</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveAttachmentGroup(group.documentType, group.items)}
                      disabled={!downloadableCount}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      {downloadableCount > 1 ? 'Download ZIP' : 'Download'}
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200 bg-white">
                    {group.items.map((attachment) => (
                      <div key={attachment.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-slate-950">{attachment.fileName}</p>
                          <p className="text-xs text-slate-500">{attachment.storagePath ? 'Uploaded file available' : 'Metadata only'}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openAttachment(attachment)}
                            disabled={!attachment.storagePath}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={attachment.storagePath ? 'View' : 'File unavailable'}
                            aria-label={`View ${attachment.fileName}`}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => saveAttachment(attachment)}
                            disabled={!attachment.storagePath}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={attachment.storagePath ? 'Download' : 'File unavailable'}
                            aria-label={`Download ${attachment.fileName}`}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">No attachment metadata captured yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">Status Actions</h2>
        <textarea value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder="Optional status note" className="mt-4 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <div className="mt-3 flex flex-wrap gap-2">
          {canSubmitToAmlSupervisor ? (
            <button type="button" disabled={saving} onClick={() => setStatus('SUBMITTED_TO_AML_SUPERVISOR')} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              <Send className="h-4 w-4" />
              Submit to AML Supervisor
            </button>
          ) : null}
          {canAmlManageStatus && enquiry.status === 'SUBMITTED_TO_AML_SUPERVISOR' ? (
            <>
              <button type="button" disabled={saving} onClick={() => setStatus('RETURNED_TO_BD')} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                Return to BD
              </button>
              <button type="button" disabled={saving} onClick={() => setStatus('READY_FOR_KYC')} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                <ClipboardCheck className="h-4 w-4" />
                Mark Ready for KYC
              </button>
            </>
          ) : null}
          {canAmlManageStatus && enquiry.status === 'READY_FOR_KYC' ? (
            <button type="button" disabled={saving} onClick={createKycFromEnquiry} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              <FilePlus2 className="h-4 w-4" />
              Create KYC Case
            </button>
          ) : null}
          {enquiry.status === 'CONVERTED_TO_KYC' && generatedKycCase ? (
            <Link to={`/kyc/${generatedKycCase.id}`} className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
              <ClipboardCheck className="h-4 w-4" />
              Open KYC Case {generatedKycCase.kycNumber}
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Timeline</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {enquiry.statusHistory?.length ? enquiry.statusHistory.map((item) => (
              <div key={item.id} className="px-5 py-4">
                <p className="font-medium text-slate-950">{enquiryStatusLabels[item.toStatus] || item.toStatus}</p>
                <p className="text-sm text-slate-500">{new Date(item.createdAt).toLocaleString()} | {actorName(item.changedBy)}</p>
                {item.note ? <p className="mt-1 text-sm text-slate-600">{item.note}</p> : null}
              </div>
            )) : <p className="px-5 py-6 text-sm text-slate-500">No status history yet.</p>}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Comments</h2>
          </div>
          <form onSubmit={submitComment} className="border-b border-slate-200 p-5">
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add enquiry comment" className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={saving || !comment.trim()} className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <MessageSquare className="h-4 w-4" />
              Add Comment
            </button>
          </form>
          <div className="divide-y divide-slate-100">
            {enquiry.comments?.length ? enquiry.comments.map((item) => (
              <div key={item.id} className="px-5 py-4">
                <p className="text-sm text-slate-600">{item.body}</p>
                <p className="mt-1 text-xs text-slate-500">{actorName(item.author)} | {new Date(item.createdAt).toLocaleString()}</p>
              </div>
            )) : <p className="px-5 py-6 text-sm text-slate-500">No comments yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value, wide = false }: { label: string; value?: string | null; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-950">{value}</dd>
    </div>
  );
}
