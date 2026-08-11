import { Save, Trash2, Upload } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SearchableMultiSelect, SearchableSelect } from '../components/SearchableSelect';
import { createEnquiry, EnquiryType, getEnquiry, listClients, updateEnquiry, Client } from '../services/kyc-workflow.service';
import { countryDialOptions } from '../utils/country-phone';
import { newoonServiceOptions } from '../utils/newoon-services';

const enquiryTypes: EnquiryType[] = ['EXISTING_LEGAL_ENTITY', 'PROPOSED_COMPANY', 'CURRENT_CLIENT_NEW_SERVICES'];

const enquiryTypeLabels: Record<EnquiryType, string> = {
  EXISTING_LEGAL_ENTITY: 'Existing Legal Entity',
  PROPOSED_COMPANY: 'Proposed Company - No Legal Status Yet',
  CURRENT_CLIENT_NEW_SERVICES: 'Current Client - New Services Requested'
};

const legalForms = ['', 'QFC LLC', 'Branch', 'Partnership'];
const jurisdictions = ['', 'QFC', 'MOCI', 'Free Zone'];
const countryOptions = countryDialOptions.map((country) => country.name);

type AttachmentDraft = {
  documentType: string;
  fileName: string;
  mimeType?: string;
  size?: number;
};

type EnquiryStep = 'type' | 'details' | 'contact' | 'exposure' | 'attachments' | 'notes';

const existingLegalEntityAttachments = [
  'Corporate Documents - Company',
  'Identity Proof - UBO',
  'Identity Proof - Director',
  'Identity Proof - SEF',
  'Corporate documents of corporate shareholders in case of multiple layers of UBO',
  'UBO Part 1 and Part 2 submitted to QFC',
  'Identity Proof - Authorized Secretary'
];

const proposedCompanyAttachments = [
  'Identity Proof - Proposed UBO',
  'Identity Proof - Director UBO',
  'Identity Proof - Proposed SEF',
  'Corporate documents of corporate shareholders in case of multiple layers of UBO',
  'UBO Part 1 and Part 2 submitted to QFC',
  'Identity Proof - Authorized Secretary'
];

function attachmentTemplates(enquiryType: EnquiryType): AttachmentDraft[] {
  if (enquiryType === 'CURRENT_CLIENT_NEW_SERVICES') return [];
  const documentTypes = enquiryType === 'PROPOSED_COMPANY' ? proposedCompanyAttachments : existingLegalEntityAttachments;
  return documentTypes.map((documentType) => ({ documentType, fileName: '' }));
}

function getRequestErrorMessage(error: any, fallback: string) {
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  const responseError = error.response?.data?.error;
  return typeof responseError === 'string' ? responseError : fallback;
}

export function AddEnquiryPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState<EnquiryStep>('type');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>(attachmentTemplates('EXISTING_LEGAL_ENTITY'));
  const [form, setForm] = useState({
    enquiryType: 'EXISTING_LEGAL_ENTITY' as EnquiryType,
    clientId: '',
    companyName: '',
    proposedCompanyName: '',
    requestedServices: [] as string[],
    keyContactName: '',
    keyContactEmail: '',
    keyContactPhone: '',
    keyContactPosition: '',
    headOfficeCountry: '',
    branchCountry: '',
    areaOfOperation: '',
    proposedLegalForm: '',
    jurisdictionOfRegistration: '',
    proposedBusinessActivity: '',
    sourceOfInitialCapital: '',
    proposedRegisteredOfficeAddress: '',
    notes: ''
  });

  useEffect(() => {
    Promise.all([listClients(), id ? getEnquiry(id) : Promise.resolve(null)])
      .then(([clientItems, enquiry]) => {
        setClients(clientItems);
        if (!enquiry) return;
        const details = enquiry.details || {};
        setForm({
          enquiryType: enquiry.enquiryType,
          clientId: enquiry.clientId || enquiry.client?.id || '',
          companyName: enquiry.companyName || '',
          proposedCompanyName: enquiry.proposedCompanyName || '',
          requestedServices: enquiry.requestedServices || [],
          keyContactName: enquiry.keyContactName || '',
          keyContactEmail: enquiry.keyContactEmail || '',
          keyContactPhone: enquiry.keyContactPhone || '',
          keyContactPosition: enquiry.keyContactPosition || '',
          headOfficeCountry: enquiry.headOfficeCountry || '',
          branchCountry: enquiry.branchCountry || '',
          areaOfOperation: enquiry.areaOfOperation || '',
          proposedLegalForm: String(details.proposedLegalForm || ''),
          jurisdictionOfRegistration: String(details.jurisdictionOfRegistration || ''),
          proposedBusinessActivity: String(details.proposedBusinessActivity || ''),
          sourceOfInitialCapital: String(details.sourceOfInitialCapital || ''),
          proposedRegisteredOfficeAddress: String(details.proposedRegisteredOfficeAddress || ''),
          notes: enquiry.notes || ''
        });
        setAttachments(
          mergeAttachmentTemplates(
            enquiry.enquiryType,
            (enquiry.attachments || []).map((attachment) => ({
              documentType: attachment.documentType,
              fileName: attachment.fileName,
              mimeType: attachment.mimeType || undefined,
              size: attachment.size || undefined
            }))
          )
        );
      })
      .catch((requestError: any) => setError(getRequestErrorMessage(requestError, 'Unable to load enquiry details.')))
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const details =
      form.enquiryType === 'PROPOSED_COMPANY'
        ? {
            proposedLegalForm: form.proposedLegalForm,
            jurisdictionOfRegistration: form.jurisdictionOfRegistration,
            proposedBusinessActivity: form.proposedBusinessActivity,
            sourceOfInitialCapital: form.sourceOfInitialCapital,
            proposedRegisteredOfficeAddress: form.proposedRegisteredOfficeAddress
          }
        : {};

    const payload = {
      enquiryType: form.enquiryType,
      clientId: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? form.clientId || undefined : undefined,
      companyName: form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? form.companyName : undefined,
      proposedCompanyName: form.enquiryType === 'PROPOSED_COMPANY' ? form.proposedCompanyName : undefined,
      requestedServices: form.requestedServices,
      keyContactName: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : form.keyContactName || undefined,
      keyContactEmail: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : form.keyContactEmail || undefined,
      keyContactPhone: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : form.keyContactPhone || undefined,
      keyContactPosition: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : form.keyContactPosition || undefined,
      headOfficeCountry: form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? form.headOfficeCountry || undefined : undefined,
      branchCountry: form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? form.branchCountry || undefined : undefined,
      areaOfOperation: form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? form.areaOfOperation || undefined : undefined,
      details,
      notes: form.notes || undefined,
      attachments: attachments.filter((attachment) => attachment.fileName.trim())
    };

    try {
      const enquiry = id ? await updateEnquiry(id, payload) : await createEnquiry(payload);
      navigate(`/enquiries/${enquiry.id}`);
    } catch (requestError: any) {
      setError(getRequestErrorMessage(requestError, `Unable to ${isEditMode ? 'update' : 'create'} enquiry.`));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading enquiry details...</p>;

  const steps = enquirySteps(form.enquiryType);
  const activeStepIndex = Math.max(0, steps.findIndex((step) => step.id === activeStep));
  const currentStep = steps[activeStepIndex] || steps[0];

  function goToStep(step: EnquiryStep) {
    setActiveStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goNext() {
    const next = steps[activeStepIndex + 1];
    if (next) goToStep(next.id);
  }

  function goBack() {
    const previous = steps[activeStepIndex - 1];
    if (previous) goToStep(previous.id);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">{isEditMode ? 'Edit Enquiry' : 'New Enquiry'}</h1>
        <p className="mt-1 text-sm text-slate-500">Capture the BD enquiry before AML prepares the KYC file.</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => goToStep(step.id)}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                  currentStep.id === step.id
                    ? 'border-brand-200 bg-brand-50 text-brand-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs">{index + 1}</span>
                {step.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-500">{currentStep.description}</p>
        </div>

        <div className="p-5">
          {currentStep.id === 'type' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <SearchableSelect
                label="Enquiry type"
                value={form.enquiryType}
                options={enquiryTypes}
                optionLabels={enquiryTypeLabels}
                onChange={(value) => {
                  const enquiryType = value as EnquiryType;
                  setForm({ ...form, enquiryType });
                  setAttachments(mergeAttachmentTemplates(enquiryType, attachments));
                  setActiveStep('details');
                }}
                wide
              />
            </div>
          ) : null}

          {currentStep.id === 'details' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? (
                <label className="text-sm font-medium text-slate-700">
                  Current client
                  <select required value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? (
                <label className="text-sm font-medium text-slate-700">
                  Company name
                  <input required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
              ) : null}

              {form.enquiryType === 'PROPOSED_COMPANY' ? (
                <>
                  <label className="text-sm font-medium text-slate-700">
                    Proposed company name
                    <input required value={form.proposedCompanyName} onChange={(event) => setForm({ ...form, proposedCompanyName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <SearchableSelect label="Proposed legal form" value={form.proposedLegalForm} options={legalForms} onChange={(value) => setForm({ ...form, proposedLegalForm: value })} />
                  <SearchableSelect label="Jurisdiction of registration" value={form.jurisdictionOfRegistration} options={jurisdictions} onChange={(value) => setForm({ ...form, jurisdictionOfRegistration: value })} />
                  <label className="text-sm font-medium text-slate-700">
                    Proposed business activity
                    <input value={form.proposedBusinessActivity} onChange={(event) => setForm({ ...form, proposedBusinessActivity: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Source of initial capital
                    <input value={form.sourceOfInitialCapital} onChange={(event) => setForm({ ...form, sourceOfInitialCapital: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="text-sm font-medium text-slate-700 md:col-span-2">
                    Proposed registered office address
                    <textarea value={form.proposedRegisteredOfficeAddress} onChange={(event) => setForm({ ...form, proposedRegisteredOfficeAddress: event.target.value })} className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                </>
              ) : null}

              <SearchableMultiSelect label="Requested services" value={form.requestedServices} options={newoonServiceOptions} onChange={(services) => setForm({ ...form, requestedServices: services })} wide />
            </div>
          ) : null}

          {currentStep.id === 'contact' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Full name
                <input value={form.keyContactName} onChange={(event) => setForm({ ...form, keyContactName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Position
                <input value={form.keyContactPosition} onChange={(event) => setForm({ ...form, keyContactPosition: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Email
                <input type="email" value={form.keyContactEmail} onChange={(event) => setForm({ ...form, keyContactEmail: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phone
                <input value={form.keyContactPhone} onChange={(event) => setForm({ ...form, keyContactPhone: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </div>
          ) : null}

          {currentStep.id === 'exposure' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <SearchableSelect label="Head office" value={form.headOfficeCountry} options={countryOptions} onChange={(value) => setForm({ ...form, headOfficeCountry: value })} />
              <SearchableSelect label="Branch" value={form.branchCountry} options={countryOptions} onChange={(value) => setForm({ ...form, branchCountry: value })} />
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Area of operation
                <textarea value={form.areaOfOperation} onChange={(event) => setForm({ ...form, areaOfOperation: event.target.value })} className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </div>
          ) : null}

          {currentStep.id === 'attachments' ? (
            <AttachmentRows enquiryType={form.enquiryType} attachments={attachments} onChange={setAttachments} />
          ) : null}

          {currentStep.id === 'notes' ? (
            <label className="block text-sm font-medium text-slate-700">
              Notes
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <button type="button" onClick={goBack} disabled={activeStepIndex === 0} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Back
              </button>
              {activeStepIndex < steps.length - 1 ? (
                <button type="button" onClick={goNext} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  Next
                </button>
              ) : null}
            </div>
            {activeStepIndex === steps.length - 1 ? (
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : isEditMode ? 'Update Enquiry' : 'Create Enquiry'}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </form>
  );
}

function enquirySteps(enquiryType: EnquiryType): Array<{ id: EnquiryStep; label: string; description: string }> {
  const steps: Array<{ id: EnquiryStep; label: string; description: string }> = [
    { id: 'type', label: 'Type', description: 'Select the enquiry category so the correct fields are shown.' },
    { id: 'details', label: 'Details', description: 'Capture the company/client details and requested Newoon services.' }
  ];

  if (enquiryType !== 'CURRENT_CLIENT_NEW_SERVICES') {
    steps.push({ id: 'contact', label: 'Contact', description: 'Add the key communication person for this enquiry.' });
  }

  if (enquiryType === 'EXISTING_LEGAL_ENTITY') {
    steps.push({ id: 'exposure', label: 'Exposure', description: 'Record the countries and operating areas connected to this entity.' });
  }

  if (enquiryType !== 'CURRENT_CLIENT_NEW_SERVICES') {
    steps.push({ id: 'attachments', label: 'Attachments', description: 'Capture the relevant document names for AML review.' });
  }

  steps.push({ id: 'notes', label: 'Notes', description: 'Add any supporting context before saving the enquiry.' });
  return steps;
}

function mergeAttachmentTemplates(enquiryType: EnquiryType, currentAttachments: AttachmentDraft[]) {
  const templates = attachmentTemplates(enquiryType);
  const currentByType = new Map(currentAttachments.map((attachment) => [attachment.documentType, attachment]));
  return templates.map((template) => currentByType.get(template.documentType) || template);
}

function AttachmentRows({
  enquiryType,
  attachments,
  onChange
}: {
  enquiryType: EnquiryType;
  attachments: AttachmentDraft[];
  onChange: (attachments: AttachmentDraft[]) => void;
}) {
  function setFile(index: number, file: File | null) {
    onChange(
      attachments.map((attachment, itemIndex) =>
        itemIndex === index
          ? {
              ...attachment,
              fileName: file?.name || '',
              mimeType: file?.type || undefined,
              size: file?.size
            }
          : attachment
      )
    );
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-950">Required Attachment Options</h2>
      <p className="mt-1 text-sm text-slate-500">
        {enquiryType === 'PROPOSED_COMPANY'
          ? 'Capture the preliminary incorporation support files required for review.'
          : 'Capture company, ownership, and identity documents required for review.'}
      </p>
      <div className="mt-4 divide-y divide-slate-100 rounded-md border border-slate-200">
        {attachments.map((attachment, index) => (
          <div key={attachment.documentType} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_220px_minmax(0,1.2fr)_44px] md:items-center">
            <p className="text-sm font-medium text-slate-950">{attachment.documentType}</p>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Upload className="h-4 w-4" />
              Upload
              <input type="file" className="hidden" onChange={(event) => setFile(index, event.target.files?.[0] || null)} />
            </label>
            <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {attachment.fileName || 'No file selected'}
            </div>
            <button
              type="button"
              onClick={() => setFile(index, null)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
              aria-label={`Clear ${attachment.documentType}`}
              title="Clear"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
