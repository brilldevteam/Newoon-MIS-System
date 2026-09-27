import { ArrowLeft, ClipboardCheck, Download, Edit3, Eye, FilePlus2, MessageSquare, Printer, Send } from 'lucide-react';
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
import { kycStatusLabel } from '../utils/kyc-status-labels';

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

  function printPreliminaryKyc() {
    const preview = document.querySelector('#preliminary-kyc-form article');
    if (!preview) {
      setError('The Preliminary KYC form is not available to print.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) {
      setError('Unable to open the print preview. Allow pop-ups and try again.');
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('');

    printWindow.document.write(`<!doctype html>
      <html><head><title>Preliminary KYC</title>${styles}
      <style>
        @page { size: A4; margin: 12mm; }
        body { background: #ffffff !important; padding: 0 !important; }
        #preliminary-kyc-form { max-height: none !important; overflow: visible !important; background: #ffffff !important; border: 0 !important; padding: 0 !important; }
      </style>
      </head><body><section id="preliminary-kyc-form">${preview.outerHTML}</section></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
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
  const preliminaryKyc = details.preliminaryKyc && typeof details.preliminaryKyc === 'object' ? details.preliminaryKyc as Record<string, any> : null;
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
          <Link to="/enquiries" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
            <ArrowLeft className="h-4 w-4" />
            Back to enquiries
          </Link>
          <p className="mt-3 text-sm font-medium text-slate-500">{enquiry.enquiryCode}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{enquiryTypeLabels[enquiry.enquiryType]} | {generatedKycCase ? kycStatusLabel(generatedKycCase.status) : enquiryStatusLabels[enquiry.status]}</p>
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
          <p className="mt-2 text-sm font-medium text-slate-950">{generatedKycCase ? kycStatusLabel(generatedKycCase.status) : enquiryStatusLabels[enquiry.status]}</p>
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

      <div className={enquiry.enquiryType === 'PROPOSED_COMPANY' && preliminaryKyc ? 'grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(520px,1.15fr)] xl:items-start' : ''}>
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
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

      {enquiry.enquiryType === 'PROPOSED_COMPANY' && preliminaryKyc ? <PreliminaryKycDocument data={preliminaryKyc} /> : null}
      </div>

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
          {enquiry.enquiryType === 'PROPOSED_COMPANY' && preliminaryKyc ? (
            <>
              <button type="button" onClick={() => document.getElementById('preliminary-kyc-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">
                View Preliminary KYC
              </button>
              <button type="button" onClick={printPreliminaryKyc} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Printer className="h-4 w-4" />
                Print Preliminary KYC
              </button>
            </>
          ) : null}
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

function PreliminaryKycDocument({ data }: { data: Record<string, any> }) {
  const rows = (value: unknown) => Array.isArray(value) ? value as Array<Record<string, any>> : [];
  const value = (item: unknown) => String(item || '-');
  const totalOwnership = (items: Array<Record<string, any>>) => items.reduce((total, item) => total + (Number.parseFloat(String(item.ownershipPercentage || '')) || 0), 0).toFixed(2);
  const contact = data.contact && typeof data.contact === 'object' ? data.contact as Record<string, any> : {};
  const declaration = data.declaration && typeof data.declaration === 'object' ? data.declaration as Record<string, any> : {};
  return <section id="preliminary-kyc-form" className="scroll-mt-6 max-h-[calc(100vh-150px)] min-w-0 overflow-auto rounded-lg border border-slate-200 bg-slate-200 p-4">
    <article className="mx-auto max-w-[794px] bg-white p-6 text-[10px] leading-[1.4] text-black shadow-sm sm:p-8">
      <p>Date: {data.completedAt ? new Date(data.completedAt).toLocaleDateString('en-GB') : '-'}</p>
      <h2 className="mt-3 text-center text-[11px] font-bold underline">Prospective Customer Information &amp; Preliminary Due Diligence form</h2>
      <p className="mt-2">This form is completed prior to the establishment of a business relationship and before incorporation of the proposed entity.</p>
      <PreliminaryTable title="Section A: Basic Client Details" headers={['No.', 'Details']} rows={[
        ['1', `Proposed Company Name: ${value(data.companyName)}`], ['2', `Proposed Legal Form: ${value(data.proposedLegalForm)}`],
        ['3', `Jurisdiction of Registration: ${value(data.jurisdiction)}`], ['4', `Proposed Registered Office Address: ${value(data.registeredOfficeAddress)}`],
        ['5', `Proposed Business Activity: ${value(data.businessActivity)}`], ['6', `Expected Source of Initial Capital: ${value(data.sourceOfFunds)}`]
      ]} />
      <PreliminaryTable title="Section B: Proposed Shareholders" headers={['No.', 'Name', 'Passport/QID/CR', 'Nationality', 'Residence', 'Ownership %']} rows={rows(data.shareholders).map((row, index) => [String(index + 1), value(row.fullName), value(row.identityNumber), value(row.nationality), value(row.address), value(row.ownershipPercentage)])} />
      <PreliminaryTable title="Ultimate Beneficial Owners (Natural Person Only)" headers={['No.', 'Name', 'Passport/QID', 'Nationality', 'Residence', 'Ownership %']} rows={rows(data.ubos).map((row, index) => [String(index + 1), value(row.fullName), value(row.identityNumber), value(row.nationality), value(row.address), value(row.ownershipPercentage)])} />
      <p className="mt-1 font-bold">Total UBO %: {totalOwnership(rows(data.ubos))}%</p>
      <PreliminaryTable title="Section C: Proposed Management & Control Persons" headers={['No.', 'Name', 'Passport / QID', 'Nationality', 'Position']} rows={rows(data.management).map((row, index) => [String(index + 1), value(row.fullName), value(row.identityNumber), value(row.nationality), value(row.positions?.join(', ') || row.position)])} />
      <PreliminaryTable title="Section D: Required Documents" headers={['Document', 'Available']} rows={rows(data.documents).map((row) => [value(row.documentType), row.available ? 'Yes' : 'No'])} />
      <PreliminaryTable title="Section E: Key Contact Person" headers={['No.', 'Field', 'Details']} rows={[
        ['1', 'Full Name', value(contact.fullName)], ['2', 'Position', value(contact.position)], ['3', 'Nationality', value(contact.nationality)],
        ['4', 'Passport Number', value(contact.passportNumber)], ['5', 'Passport Expiry Date', value(contact.passportExpiryDate)],
        ['6', 'QID Number', value(contact.qidNumber)], ['7', 'QID Expiry Date', value(contact.qidExpiryDate)],
        ['8', 'Mobile Number', value(contact.mobileNumber)], ['9', 'Email', value(contact.email)]
      ]} />
      <section className="mt-4"><h3 className="border-b-4 border-[#dce9f7] pb-0.5 text-[10px] font-bold">Section F: Client Declaration</h3><p className="mt-1">By signing this document, I hereby confirm that all information and documents provided are true, complete, and up to date. I am authorised to represent and sign this document on behalf of the proposed entity.</p></section>
      <table className="mt-1 w-full border-collapse text-left"><tbody>
        <tr><th className="w-1/3 border border-black px-1 py-0.5">Full Name</th><td className="border border-black px-1 py-0.5">{value(declaration.fullName)}</td></tr>
        <tr><th className="border border-black px-1 py-0.5">Position</th><td className="border border-black px-1 py-0.5">{value(declaration.position)}</td></tr>
        <tr><th className="border border-black px-1 py-0.5">Date</th><td className="border border-black px-1 py-0.5">{value(declaration.date)}</td></tr>
        <tr><th className="border border-black px-1 py-0.5">Authorised signature</th><td className="border border-black px-1 py-0.5"><PreliminaryUploadPreview fileName={declaration.authorizedSignature} dataUrl={declaration.authorizedSignatureDataUrl} /></td></tr>
        <tr><th className="border border-black px-1 py-0.5">Company Stamp</th><td className="border border-black px-1 py-0.5"><PreliminaryUploadPreview fileName={declaration.companyStamp} dataUrl={declaration.companyStampDataUrl} /></td></tr>
      </tbody></table>
    </article>
  </section>;
}

function PreliminaryTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <section className="mt-4"><h3 className="border-b-4 border-[#dce9f7] pb-0.5 text-[10px] font-bold">{title}</h3><table className="mt-1 w-full border-collapse text-left"><thead><tr>{headers.map((header) => <th key={header} className="border border-black px-1 py-0.5">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((item, cellIndex) => <td key={cellIndex} className="border border-black px-1 py-0.5 align-top">{item}</td>)}</tr>) : <tr><td colSpan={headers.length} className="border border-black px-1 py-1">-</td></tr>}</tbody></table></section>;
}

function PreliminaryUploadPreview({ fileName, dataUrl }: { fileName?: string; dataUrl?: string }) {
  if (!fileName) return <>-</>;
  return <div className="min-h-6"><span>{fileName}</span>{dataUrl?.startsWith('data:image/') ? <img src={dataUrl} alt={fileName} className="mt-1 max-h-20 max-w-40 object-contain" /> : null}</div>;
}
