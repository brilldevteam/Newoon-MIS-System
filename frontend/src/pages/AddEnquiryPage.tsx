import { Save, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveOtherValue, SearchableMultiSelect, SearchableSelect } from '../components/SearchableSelect';
import { MultiFileUploadControl } from '../components/MultiFileUploadControl';
import { createEnquiry, EnquiryPayload, EnquiryType, getEnquiry, listClients, updateEnquiry, uploadEnquiryAttachmentFiles, Client } from '../services/kyc-workflow.service';
import { applyCountryDialCode, countryDialOptions, getDialCode } from '../utils/country-phone';
import { newoonServiceOptions } from '../utils/newoon-services';

const enquiryTypes: EnquiryType[] = ['EXISTING_LEGAL_ENTITY', 'PROPOSED_COMPANY', 'CURRENT_CLIENT_NEW_SERVICES'];

const enquiryTypeLabels: Record<EnquiryType, string> = {
  EXISTING_LEGAL_ENTITY: 'Existing Legal Entity',
  PROPOSED_COMPANY: 'Proposed Company - No Legal Status Yet',
  CURRENT_CLIENT_NEW_SERVICES: 'Current Client - New Services Requested'
};

const legalForms = ['', 'QFC Holding', 'QFC SPC', 'QFC LLC', 'QFZ LLC', 'MOCI LLC'];
const jurisdictions = ['', 'QFC', 'MOCI', 'Free Zone'];
const countryOptions = countryDialOptions.map((country) => country.name);
const nationalityOptions = countryOptions;
const identityTypeOptions = ['Passport', 'QID'];
const countryDialLabels = Object.fromEntries(countryDialOptions.map((country) => [country.name, country.name ? `${country.name} (${country.dialCode})` : 'Select code']));
const positionOptions = [
  '',
  'CEO',
  'CFO',
  'COO',
  'Director',
  'Managing Director',
  'General Manager',
  'Manager',
  'Partner',
  'Shareholder',
  'Authorized Signatory',
  'Company Secretary',
  'Compliance Officer',
  'Finance Manager'
];

type AttachmentDraft = {
  id?: string;
  documentType: string;
  fileName: string;
  storagePath?: string | null;
  mimeType?: string;
  size?: number;
  storedFiles?: Array<{
    id?: string;
    fileName: string;
    storagePath?: string | null;
    mimeType?: string;
    size?: number;
  }>;
  files?: File[];
};

type StoredAttachmentFile = NonNullable<AttachmentDraft['storedFiles']>[number];

type EnquiryStep = 'type' | 'details' | 'ownership' | 'management' | 'contact' | 'declaration' | 'exposure' | 'attachments' | 'notes';

type PreliminaryOwner = { fullName: string; nationality: string; identityNumber: string; address: string; ownershipPercentage: string; isUbo: boolean };
type PreliminaryManagementPerson = { fullName: string; identityNumber: string; nationality: string; position: string; positions?: string[] };
type PreliminaryDeclaration = { fullName: string; position: string; date: string; authorizedSignature: string; companyStamp: string };

type EnquiryValidationForm = {
  enquiryType: EnquiryType;
  clientId: string;
  companyName: string;
  proposedCompanyName: string;
  requestedServices: string[];
  requestedServicesOther: string;
  keyContactName: string;
  keyContactEmail: string;
  keyContactPhone: string;
  keyContactPhoneCountry: string;
  keyContactPosition: string;
  keyContactPositionOther: string;
  keyContactNationality: string;
  keyContactNationalityOther: string;
  keyContactIdentityNumber: string;
  keyContactIdentityTypes: string[];
  keyContactPassportNumber: string;
  keyContactPassportExpiryDate: string;
  keyContactQidNumber: string;
  keyContactQidExpiryDate: string;
  headOfficeCountry: string;
  branchCountry: string;
  areaOfOperation: string;
  proposedLegalForm: string;
  proposedLegalFormOther: string;
  jurisdictionOfRegistration: string;
  proposedBusinessActivity: string;
  sourceOfInitialCapital: string;
  proposedRegisteredOfficeAddress: string;
  preliminaryShareholders: PreliminaryOwner[];
  preliminaryUbos: PreliminaryOwner[];
  preliminaryManagement: PreliminaryManagementPerson[];
  preliminaryDeclaration: PreliminaryDeclaration;
  notes: string;
};

const blankPreliminaryOwner = (): PreliminaryOwner => ({ fullName: '', nationality: '', identityNumber: '', address: '', ownershipPercentage: '', isUbo: false });
const blankPreliminaryManagement = (): PreliminaryManagementPerson => ({ fullName: '', identityNumber: '', nationality: '', position: '', positions: [] });

const existingLegalEntityAttachments = [
  'Key Contact QID / Passport attachment',
  'Corporate Documents - Company',
  'Identity Proof - UBO',
  'Identity Proof - Director',
  'Identity Proof - SEF',
  'Corporate documents of corporate shareholders in case of multiple layers of UBO',
  'UBO Part 1 and Part 2 submitted to QFC',
  'Identity Proof - Authorized Secretary'
];

const proposedCompanyAttachments = [
  'Key Contact QID / Passport attachment',
  'Identity Proof - Proposed UBO',
  'Identity Proof - Proposed Director',
  'Identity Proof - Proposed SEF',
  'Corporate documents of corporate shareholders in case of multiple layers of UBO',
  'UBO Part 1 and Part 2 submitted to QFC',
  'Identity Proof - Authorized Secretary'
];

const qfzMociProposedCompanyAttachments = [
  'Key Contact QID / Passport attachment',
  'Identity Proof - Manager',
  'Identity Proof - Authorized Signatory',
  'Identity Proof - Partners',
  'Identity Proof - UBO',
  'Corporate shareholder documents'
];

function attachmentTemplates(enquiryType: EnquiryType, proposedLegalForm = ''): AttachmentDraft[] {
  if (enquiryType === 'CURRENT_CLIENT_NEW_SERVICES') {
    return [{ documentType: 'Additional document upload 1', fileName: '' }];
  }
  const documentTypes =
    enquiryType === 'PROPOSED_COMPANY'
      ? isQfzOrMociLegalForm(proposedLegalForm)
        ? qfzMociProposedCompanyAttachments
        : proposedCompanyAttachments
      : existingLegalEntityAttachments;
  return documentTypes.map((documentType) => ({ documentType, fileName: '' }));
}

function getRequestErrorMessage(error: any, fallback: string) {
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  const responseError = error.response?.data?.error;
  const nestedMessage = responseError?.message;
  if (Array.isArray(nestedMessage)) return nestedMessage.join(' ');
  if (typeof nestedMessage === 'string') return nestedMessage;
  return typeof responseError === 'string' ? responseError : fallback;
}

function splitOtherValue(value: string | null | undefined, options: string[]) {
  if (!value) return { value: '', otherValue: '' };
  return options.includes(value) ? { value, otherValue: '' } : { value: 'Other', otherValue: value };
}

function splitRequestedServices(services: string[]) {
  const knownServices = services.filter((service) => newoonServiceOptions.includes(service));
  const otherServices = services.filter((service) => service && !newoonServiceOptions.includes(service));
  return {
    values: otherServices.length ? [...knownServices, 'Other'] : knownServices,
    otherValue: otherServices.join(', ')
  };
}

function resolvedRequestedServices(form: Pick<EnquiryValidationForm, 'requestedServices' | 'requestedServicesOther'>) {
  return form.requestedServices
    .filter(Boolean)
    .map((service) => (service === 'Other' ? form.requestedServicesOther.trim() : service))
    .filter(Boolean);
}

function keyContactIdentityNumber(form: Pick<EnquiryValidationForm, 'keyContactPassportNumber' | 'keyContactQidNumber'>) {
  return [
    form.keyContactPassportNumber.trim() ? `Passport: ${form.keyContactPassportNumber.trim()}` : '',
    form.keyContactQidNumber.trim() ? `QID: ${form.keyContactQidNumber.trim()}` : ''
  ].filter(Boolean).join(', ');
}

function identityTypesFromDetails(details: Record<string, unknown>) {
  const values = Array.isArray(details.keyContactIdentityTypes)
    ? details.keyContactIdentityTypes.map(String).filter((value) => identityTypeOptions.includes(value))
    : [];
  if (values.length) return values;
  if (String(details.keyContactQidNumber || '').trim()) values.push('QID');
  if (String(details.keyContactPassportNumber || '').trim()) values.push('Passport');
  if (values.length) return values;
  return String(details.keyContactIdentityNumber || '').trim() ? ['Passport'] : [];
}

function RequiredMark() {
  return <span className="text-red-600"> *</span>;
}

function normalizeOption(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

function isQfzOrMociLegalForm(value: string) {
  const legalForm = normalizeOption(value);
  return legalForm === 'QFZ LLC' || legalForm === 'MOCI LLC' || legalForm.includes('QFZ') || legalForm.includes('MOCI');
}

function inferPhoneCountry(phone: string) {
  const normalizedPhone = phone.trim();
  if (!normalizedPhone) return '';

  const match = countryDialOptions
    .filter((country) => country.dialCode && normalizedPhone.startsWith(country.dialCode))
    .sort((first, second) => second.dialCode.length - first.dialCode.length)[0];

  return match?.name || '';
}

function validateEnquiryStep(form: EnquiryValidationForm, step: EnquiryStep): string | null {
  if (step === 'type' && !form.enquiryType) {
    return 'Select the enquiry type before continuing.';
  }

  if (step === 'details') {
    if (form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' && !form.clientId) {
      return 'Select the current client before continuing.';
    }

    if (form.enquiryType === 'EXISTING_LEGAL_ENTITY' && !form.companyName.trim()) {
      return 'Company name is required for an existing legal entity enquiry.';
    }

    if (form.enquiryType === 'PROPOSED_COMPANY') {
      if (!form.proposedCompanyName.trim()) return 'Proposed company name is required.';
      if (!resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther)) return 'Proposed legal form is required.';
      if (!form.jurisdictionOfRegistration) return 'Jurisdiction of registration is required.';
      if (!form.proposedBusinessActivity.trim()) return 'Proposed business activity is required.';
      if (!form.sourceOfInitialCapital.trim()) return 'Source of initial capital is required.';
      if (!isProposedAddressOptional(form) && !form.proposedRegisteredOfficeAddress.trim()) return 'Proposed registered office address is required.';
    }

    if (!form.requestedServices.length) {
      return 'Select at least one requested service.';
    }

    if (form.requestedServices.includes('Other') && !form.requestedServicesOther.trim()) {
      return 'Enter details for the other requested service.';
    }
  }

  if (step === 'contact' && form.enquiryType !== 'CURRENT_CLIENT_NEW_SERVICES') {
    if (!form.keyContactName.trim()) return 'Key contact full name is required.';
    if (!form.keyContactEmail.trim()) return 'Key contact email is required.';
    if (!form.keyContactPhoneCountry) return 'Key contact country code is required.';
    if (!form.keyContactPhone.trim()) return 'Key contact phone number is required.';
    if (!resolveOtherValue(form.keyContactPosition, form.keyContactPositionOther)) {
      return 'Key contact position is required.';
    }
    if (!resolveOtherValue(form.keyContactNationality, form.keyContactNationalityOther)) {
      return 'Key contact nationality is required.';
    }
    if (!form.keyContactPassportNumber.trim() && !form.keyContactQidNumber.trim()) {
      return 'Enter either a key contact passport number or QID number.';
    }
  }

  if (step === 'ownership' && form.enquiryType === 'PROPOSED_COMPANY') {
    if (!form.preliminaryShareholders.length || form.preliminaryShareholders.some((row) => !row.fullName.trim() || !row.ownershipPercentage.trim())) {
      return 'Add at least one proposed shareholder with name and ownership percentage.';
    }
  }

  if (step === 'management' && form.enquiryType === 'PROPOSED_COMPANY') {
    if (!form.preliminaryManagement.length || form.preliminaryManagement.some((row) => !row.fullName.trim() || !(row.positions?.length || row.position.trim()))) {
      return 'Add at least one proposed management or control person with name and position.';
    }
  }

  if (step === 'exposure' && form.enquiryType === 'EXISTING_LEGAL_ENTITY') {
    if (!form.headOfficeCountry) return 'Head office country is required.';
    if (!form.areaOfOperation.trim()) return 'Area of operation is required.';
  }

  return null;
}

function isProposedAddressOptional(form: Pick<EnquiryValidationForm, 'proposedLegalForm' | 'proposedLegalFormOther'>) {
  const legalForm = normalizeOption(resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther));
  return isQfzOrMociLegalForm(legalForm);
}

function validateEnquiryForm(form: EnquiryValidationForm): { step: EnquiryStep; message: string } | null {
  for (const step of enquirySteps(form.enquiryType)) {
    const message = validateEnquiryStep(form, step.id);
    if (message) return { step: step.id, message };
  }
  return null;
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
  const [form, setForm] = useState<EnquiryValidationForm>({
    enquiryType: 'EXISTING_LEGAL_ENTITY' as EnquiryType,
    clientId: '',
    companyName: '',
    proposedCompanyName: '',
    requestedServices: [] as string[],
    requestedServicesOther: '',
    keyContactName: '',
    keyContactEmail: '',
    keyContactPhone: '',
    keyContactPhoneCountry: '',
    keyContactPosition: '',
    keyContactPositionOther: '',
    keyContactNationality: '',
    keyContactNationalityOther: '',
    keyContactIdentityNumber: '',
    keyContactIdentityTypes: [],
    keyContactPassportNumber: '',
    keyContactPassportExpiryDate: '',
    keyContactQidNumber: '',
    keyContactQidExpiryDate: '',
    headOfficeCountry: '',
    branchCountry: '',
    areaOfOperation: '',
    proposedLegalForm: '',
    proposedLegalFormOther: '',
    jurisdictionOfRegistration: '',
    proposedBusinessActivity: '',
    sourceOfInitialCapital: '',
    proposedRegisteredOfficeAddress: '',
    preliminaryShareholders: [blankPreliminaryOwner()],
    preliminaryUbos: [blankPreliminaryOwner()],
    preliminaryManagement: [blankPreliminaryManagement()],
    preliminaryDeclaration: { fullName: '', position: '', date: '', authorizedSignature: '', companyStamp: '' },
    notes: ''
  });

  useEffect(() => {
    Promise.all([listClients(), id ? getEnquiry(id) : Promise.resolve(null)])
      .then(([clientItems, enquiry]) => {
        setClients(clientItems);
        if (!enquiry) return;
        const details = enquiry.details || {};
        const keyContactPosition = splitOtherValue(enquiry.keyContactPosition, positionOptions);
        const keyContactNationality = splitOtherValue(String(details.keyContactNationality || ''), nationalityOptions);
        const proposedLegalForm = splitOtherValue(String(details.proposedLegalForm || ''), legalForms);
        const requestedServices = splitRequestedServices(enquiry.requestedServices || []);
        const preliminary = details.preliminaryKyc && typeof details.preliminaryKyc === 'object' ? details.preliminaryKyc as Record<string, any> : {};
        setForm({
          enquiryType: enquiry.enquiryType,
          clientId: enquiry.clientId || enquiry.client?.id || '',
          companyName: enquiry.companyName || '',
          proposedCompanyName: enquiry.proposedCompanyName || '',
          requestedServices: requestedServices.values,
          requestedServicesOther: requestedServices.otherValue,
          keyContactName: enquiry.keyContactName || '',
          keyContactEmail: enquiry.keyContactEmail || '',
          keyContactPhone: enquiry.keyContactPhone || '',
          keyContactPhoneCountry: inferPhoneCountry(enquiry.keyContactPhone || ''),
          keyContactPosition: keyContactPosition.value,
          keyContactPositionOther: keyContactPosition.otherValue,
          keyContactNationality: keyContactNationality.value,
          keyContactNationalityOther: keyContactNationality.otherValue,
          keyContactIdentityNumber: String(details.keyContactIdentityNumber || ''),
          keyContactIdentityTypes: identityTypesFromDetails(details),
          keyContactPassportNumber: String(details.keyContactPassportNumber || details.keyContactIdentityNumber || ''),
          keyContactPassportExpiryDate: String(details.keyContactPassportExpiryDate || ''),
          keyContactQidNumber: String(details.keyContactQidNumber || ''),
          keyContactQidExpiryDate: String(details.keyContactQidExpiryDate || ''),
          headOfficeCountry: enquiry.headOfficeCountry || '',
          branchCountry: enquiry.branchCountry || '',
          areaOfOperation: enquiry.areaOfOperation || '',
          proposedLegalForm: proposedLegalForm.value,
          proposedLegalFormOther: proposedLegalForm.otherValue,
          jurisdictionOfRegistration: String(details.jurisdictionOfRegistration || ''),
          proposedBusinessActivity: String(details.proposedBusinessActivity || ''),
          sourceOfInitialCapital: String(details.sourceOfInitialCapital || ''),
          proposedRegisteredOfficeAddress: String(details.proposedRegisteredOfficeAddress || ''),
          preliminaryShareholders: Array.isArray(preliminary.shareholders) && preliminary.shareholders.length ? preliminary.shareholders as PreliminaryOwner[] : [blankPreliminaryOwner()],
          preliminaryUbos: Array.isArray(preliminary.ubos) && preliminary.ubos.length ? preliminary.ubos as PreliminaryOwner[] : [blankPreliminaryOwner()],
          preliminaryManagement: Array.isArray(preliminary.management) && preliminary.management.length ? preliminary.management as PreliminaryManagementPerson[] : [blankPreliminaryManagement()],
          preliminaryDeclaration: preliminary.declaration && typeof preliminary.declaration === 'object'
            ? { fullName: String(preliminary.declaration.fullName || ''), position: String(preliminary.declaration.position || ''), date: String(preliminary.declaration.date || ''), authorizedSignature: String(preliminary.declaration.authorizedSignature || ''), companyStamp: String(preliminary.declaration.companyStamp || '') }
            : { fullName: '', position: '', date: '', authorizedSignature: '', companyStamp: '' },
          notes: enquiry.notes || ''
        });
        setAttachments(
          mergeAttachmentTemplates(
            enquiry.enquiryType,
            proposedLegalForm.value === 'Other' ? proposedLegalForm.otherValue : proposedLegalForm.value,
            attachmentDraftsFromSaved(enquiry.attachments || [])
          )
        );
      })
      .catch((requestError: any) => setError(getRequestErrorMessage(requestError, 'Unable to load enquiry details.')))
      .finally(() => setLoading(false));
  }, [id]);

  function buildPayload(completed: boolean): EnquiryPayload {
    const keyContactDetails =
      form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES'
        ? {}
        : {
            keyContactNationality: resolveOtherValue(form.keyContactNationality, form.keyContactNationalityOther),
            keyContactIdentityNumber: keyContactIdentityNumber(form),
            keyContactIdentityTypes: form.keyContactIdentityTypes,
            keyContactPassportNumber: form.keyContactPassportNumber,
            keyContactPassportExpiryDate: form.keyContactPassportExpiryDate,
            keyContactQidNumber: form.keyContactQidNumber,
            keyContactQidExpiryDate: form.keyContactQidExpiryDate
          };
    const details =
      form.enquiryType === 'PROPOSED_COMPANY'
        ? {
            ...keyContactDetails,
            proposedLegalForm: resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther),
            jurisdictionOfRegistration: form.jurisdictionOfRegistration,
            proposedBusinessActivity: form.proposedBusinessActivity,
            sourceOfInitialCapital: form.sourceOfInitialCapital,
            proposedRegisteredOfficeAddress: form.proposedRegisteredOfficeAddress,
            preliminaryKyc: {
              companyName: form.proposedCompanyName,
              proposedLegalForm: resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther),
              jurisdiction: form.jurisdictionOfRegistration,
              businessActivity: form.proposedBusinessActivity,
              registeredOfficeAddress: form.proposedRegisteredOfficeAddress,
              sourceOfFunds: form.sourceOfInitialCapital,
              shareholders: form.preliminaryShareholders,
              ubos: form.preliminaryUbos,
              management: form.preliminaryManagement.map((row) => ({ ...row, position: row.positions?.join(', ') || row.position })),
              contact: {
                fullName: form.keyContactName,
                position: resolveOtherValue(form.keyContactPosition, form.keyContactPositionOther),
                nationality: resolveOtherValue(form.keyContactNationality, form.keyContactNationalityOther),
                passportNumber: form.keyContactPassportNumber,
                passportExpiryDate: form.keyContactPassportExpiryDate,
                qidNumber: form.keyContactQidNumber,
                qidExpiryDate: form.keyContactQidExpiryDate,
                mobileNumber: form.keyContactPhone,
                email: form.keyContactEmail
              },
              declaration: form.preliminaryDeclaration,
              documents: attachments.map((attachment) => ({ documentType: attachment.documentType, description: '', available: Boolean(attachmentDisplayNames(attachment).length) })),
              ...(completed ? { completedAt: new Date().toISOString() } : {})
            }
          }
        : keyContactDetails;
    return {
      enquiryType: form.enquiryType,
      clientId: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? form.clientId || undefined : undefined,
      companyName: form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? form.companyName : undefined,
      proposedCompanyName: form.enquiryType === 'PROPOSED_COMPANY' ? form.proposedCompanyName : undefined,
      requestedServices: resolvedRequestedServices(form),
      keyContactName: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : form.keyContactName || undefined,
      keyContactEmail: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : form.keyContactEmail || undefined,
      keyContactPhone: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : form.keyContactPhone || undefined,
      keyContactPosition: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : resolveOtherValue(form.keyContactPosition, form.keyContactPositionOther) || undefined,
      headOfficeCountry: form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? form.headOfficeCountry || undefined : undefined,
      branchCountry: form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? form.branchCountry || undefined : undefined,
      areaOfOperation: form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? form.areaOfOperation || undefined : undefined,
      details,
      notes: form.notes || undefined,
      attachments: flattenAttachmentMetadata(form.enquiryType, attachments)
    };
  }

  async function saveDraft() {
    setSaving(true);
    setError('');
    try {
      const enquiry = id ? await updateEnquiry(id, buildPayload(false)) : await createEnquiry(buildPayload(false));
      for (const [index, attachment] of attachments.entries()) {
        if (!attachment.files?.length) continue;
        await uploadEnquiryAttachmentFiles(enquiry.id, { documentType: attachmentDocumentType(form.enquiryType, attachment, index), files: attachment.files });
      }
      navigate(`/enquiries/${enquiry.id}/edit`, { replace: true });
    } catch (requestError: any) {
      setError(getRequestErrorMessage(requestError, 'Unable to save enquiry draft.'));
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const validationError = validateEnquiryForm(form);
    if (validationError) {
      setError(validationError.message);
      setActiveStep(validationError.step);
      setSaving(false);
      return;
    }

    const payload = buildPayload(true);

    try {
      const enquiry = id ? await updateEnquiry(id, payload) : await createEnquiry(payload);
      for (const [index, attachment] of attachments.entries()) {
        if (!attachment.files?.length) continue;
        await uploadEnquiryAttachmentFiles(enquiry.id, {
          documentType: attachmentDocumentType(form.enquiryType, attachment, index),
          files: attachment.files
        });
      }
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
  const currentStepError = validateEnquiryStep(form, currentStep.id);
  const proposedAddressRequired = form.enquiryType === 'PROPOSED_COMPANY' && !isProposedAddressOptional(form);

  function getStepAccessError(targetStep: EnquiryStep): { step: EnquiryStep; message: string } | null {
    const targetIndex = steps.findIndex((step) => step.id === targetStep);
    if (targetIndex <= activeStepIndex) return null;

    for (let index = 0; index < targetIndex; index += 1) {
      const step = steps[index];
      const message = validateEnquiryStep(form, step.id);
      if (message) return { step: step.id, message };
    }

    return null;
  }

  function goToStep(step: EnquiryStep) {
    const accessError = getStepAccessError(step);
    if (accessError) {
      setError(accessError.message);
      setActiveStep(accessError.step);
      return;
    }

    setError('');
    setActiveStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goNext() {
    if (currentStepError) {
      setError(currentStepError);
      return;
    }

    const next = steps[activeStepIndex + 1];
    if (next) goToStep(next.id);
  }

  function goBack() {
    const previous = steps[activeStepIndex - 1];
    if (previous) goToStep(previous.id);
  }

  function setHeadOfficeCountry(country: string) {
    setForm((current) => ({
      ...current,
      headOfficeCountry: country,
      keyContactPhoneCountry: current.keyContactPhoneCountry || country,
      keyContactPhone: applyCountryDialCode(current.keyContactPhone, current.keyContactPhoneCountry || country)
    }));
  }

  function setPhoneCountry(country: string) {
    setForm((current) => ({
      ...current,
      keyContactPhoneCountry: country,
      keyContactPhone: applyCountryDialCode(current.keyContactPhone, country)
    }));
  }

  function setPhone(phone: string) {
    setForm((current) => ({
      ...current,
      keyContactPhone: applyCountryDialCode(phone, current.keyContactPhoneCountry || current.headOfficeCountry || current.branchCountry || '')
    }));
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">{isEditMode ? 'Edit Enquiry' : 'New Enquiry'}</h1>
        <p className="mt-1 text-sm text-slate-500">Capture the BD enquiry before AML prepares the KYC file.</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className={`rounded-lg border border-slate-200 bg-white ${form.enquiryType === 'PROPOSED_COMPANY' ? 'min-[1500px]:grid min-[1500px]:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]' : ''}`}>
        <div className={`border-b border-slate-200 px-5 py-4 ${form.enquiryType === 'PROPOSED_COMPANY' ? 'min-[1500px]:col-span-2' : ''}`}>
          <div className="flex flex-wrap gap-2">
            {steps.map((step, index) => {
              const accessError = getStepAccessError(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  disabled={Boolean(accessError)}
                  title={accessError?.message || step.label}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                    currentStep.id === step.id
                      ? 'border-brand-200 bg-brand-50 text-brand-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 disabled:hover:bg-white'
                  }`}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs">{index + 1}</span>
                  {step.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-slate-500">{currentStep.description}</p>
        </div>

        <div className="min-w-0 p-5">
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
                  setAttachments(mergeAttachmentTemplates(enquiryType, resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther), attachments));
                  setActiveStep('details');
                }}
                wide
              />
            </div>
          ) : null}

          {currentStep.id === 'details' && form.enquiryType === 'PROPOSED_COMPANY' ? (
            <ProposedCompanyDetails
              form={form}
              attachments={attachments}
              proposedAddressRequired={proposedAddressRequired}
              onFormChange={setForm}
              onAttachmentsChange={setAttachments}
            />
          ) : null}

          {currentStep.id === 'details' && form.enquiryType !== 'PROPOSED_COMPANY' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? (
                <label className="text-sm font-medium text-slate-700">
                  Current client <RequiredMark />
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
                  Company name <RequiredMark />
                  <input required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
              ) : null}

              <SearchableMultiSelect
                label="Requested services *"
                value={form.requestedServices}
                options={newoonServiceOptions}
                onChange={(services) => setForm({ ...form, requestedServices: services, ...(services.includes('Other') ? {} : { requestedServicesOther: '' }) })}
                otherValue={form.requestedServicesOther}
                onOtherChange={(value) => setForm({ ...form, requestedServicesOther: value })}
                allowOther
                wide
              />
            </div>
          ) : null}

          {currentStep.id === 'contact' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Full name <RequiredMark />
                <input required value={form.keyContactName} onChange={(event) => setForm({ ...form, keyContactName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <SearchableSelect
                label="Position *"
                value={form.keyContactPosition}
                otherValue={form.keyContactPositionOther}
                options={positionOptions}
                onChange={(value) => setForm({ ...form, keyContactPosition: value, ...(value === 'Other' ? {} : { keyContactPositionOther: '' }) })}
                onOtherChange={(value) => setForm({ ...form, keyContactPositionOther: value })}
                allowOther
              />
              <label className="text-sm font-medium text-slate-700">
                Email <RequiredMark />
                <input required type="email" value={form.keyContactEmail} onChange={(event) => setForm({ ...form, keyContactEmail: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                <SearchableSelect
                  label="Code *"
                  value={form.keyContactPhoneCountry}
                  options={countryOptions}
                  optionLabels={countryDialLabels}
                  onChange={setPhoneCountry}
                />
                <label className="text-sm font-medium text-slate-700">
                  Phone <RequiredMark />
                  <input required value={form.keyContactPhone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <SearchableSelect
                label="Nationality *"
                value={form.keyContactNationality}
                otherValue={form.keyContactNationalityOther}
                options={nationalityOptions}
                onChange={(value) => setForm({ ...form, keyContactNationality: value, ...(value === 'Other' ? {} : { keyContactNationalityOther: '' }) })}
                onOtherChange={(value) => setForm({ ...form, keyContactNationalityOther: value })}
                allowOther
              />
              <SearchableMultiSelect
                label="Identity document type"
                value={form.keyContactIdentityTypes}
                options={identityTypeOptions}
                onChange={(value) => setForm({ ...form, keyContactIdentityTypes: value })}
                placeholder="Select Passport and/or QID"
                wide
              />
              {(form.keyContactIdentityTypes.includes('Passport') || !form.keyContactIdentityTypes.length) ? (
                <>
                  <label className="text-sm font-medium text-slate-700">
                    Passport number
                    <input value={form.keyContactPassportNumber} onChange={(event) => setForm({ ...form, keyContactPassportNumber: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Passport expiry date
                    <input type="date" value={form.keyContactPassportExpiryDate} onChange={(event) => setForm({ ...form, keyContactPassportExpiryDate: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                </>
              ) : null}
              {form.keyContactIdentityTypes.includes('QID') ? (
                <>
                  <label className="text-sm font-medium text-slate-700">
                    QID number
                    <input value={form.keyContactQidNumber} onChange={(event) => setForm({ ...form, keyContactQidNumber: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    QID expiry date
                    <input type="date" value={form.keyContactQidExpiryDate} onChange={(event) => setForm({ ...form, keyContactQidExpiryDate: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}

          {currentStep.id === 'declaration' && form.enquiryType === 'PROPOSED_COMPANY' ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-950">Client Declaration</h2>
              <p className="mt-2 text-sm text-slate-600">By signing this document, I confirm that the information and documents provided are true, complete, and up to date, and that I am authorised to represent the proposed entity.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Full name<input value={form.preliminaryDeclaration.fullName} onChange={(event) => setForm({ ...form, preliminaryDeclaration: { ...form.preliminaryDeclaration, fullName: event.target.value } })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Position<input value={form.preliminaryDeclaration.position} onChange={(event) => setForm({ ...form, preliminaryDeclaration: { ...form.preliminaryDeclaration, position: event.target.value } })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Date<input type="date" value={form.preliminaryDeclaration.date} onChange={(event) => setForm({ ...form, preliminaryDeclaration: { ...form.preliminaryDeclaration, date: event.target.value } })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Authorised signature reference<input value={form.preliminaryDeclaration.authorizedSignature} onChange={(event) => setForm({ ...form, preliminaryDeclaration: { ...form.preliminaryDeclaration, authorizedSignature: event.target.value } })} placeholder="Name or attachment reference" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">Company stamp reference<input value={form.preliminaryDeclaration.companyStamp} onChange={(event) => setForm({ ...form, preliminaryDeclaration: { ...form.preliminaryDeclaration, companyStamp: event.target.value } })} placeholder="Attachment reference, if available" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
              </div>
            </section>
          ) : null}

          {currentStep.id === 'ownership' && form.enquiryType === 'PROPOSED_COMPANY' ? (
            <PreliminaryOwnershipForm form={form} onChange={setForm} />
          ) : null}

          {currentStep.id === 'management' && form.enquiryType === 'PROPOSED_COMPANY' ? (
            <PreliminaryManagementForm form={form} onChange={setForm} />
          ) : null}

          {currentStep.id === 'exposure' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <SearchableSelect label="Head office *" value={form.headOfficeCountry} options={countryOptions} onChange={setHeadOfficeCountry} />
              <SearchableSelect label="Branch" value={form.branchCountry} options={countryOptions} onChange={(value) => setForm({ ...form, branchCountry: value })} />
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Area of operation <RequiredMark />
                <textarea value={form.areaOfOperation} onChange={(event) => setForm({ ...form, areaOfOperation: event.target.value })} className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </div>
          ) : null}

          {currentStep.id === 'attachments' ? (
            <AttachmentRows
              enquiryType={form.enquiryType}
              proposedLegalForm={resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther)}
              attachments={attachments}
              onChange={setAttachments}
            />
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
                <button
                  type="button"
                  onClick={goNext}
                  disabled={Boolean(currentStepError)}
                  title={currentStepError || 'Next'}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600"
                >
                  Next
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveDraft} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              {activeStepIndex === steps.length - 1 ? (
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : isEditMode ? 'Update Enquiry' : 'Create Enquiry'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {form.enquiryType === 'PROPOSED_COMPANY' ? <ProposedCompanyPreview form={form} attachments={attachments} /> : null}
      </section>
    </form>
  );
}

function ProposedCompanyDetails({
  form,
  attachments,
  proposedAddressRequired,
  onFormChange,
  onAttachmentsChange
}: {
  form: EnquiryValidationForm;
  attachments: AttachmentDraft[];
  proposedAddressRequired: boolean;
  onFormChange: (form: EnquiryValidationForm) => void;
  onAttachmentsChange: (attachments: AttachmentDraft[]) => void;
}) {
  const legalForm = resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther);
  return <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Proposed company name <RequiredMark />
          <input required value={form.proposedCompanyName} onChange={(event) => onFormChange({ ...form, proposedCompanyName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <SearchableSelect
          label="Proposed legal form *"
          value={form.proposedLegalForm}
          otherValue={form.proposedLegalFormOther}
          options={legalForms}
          onChange={(value) => {
            onFormChange({ ...form, proposedLegalForm: value, ...(value === 'Other' ? {} : { proposedLegalFormOther: '' }) });
            onAttachmentsChange(mergeAttachmentTemplates('PROPOSED_COMPANY', value, attachments));
          }}
          onOtherChange={(value) => {
            onFormChange({ ...form, proposedLegalFormOther: value });
            if (form.proposedLegalForm === 'Other') onAttachmentsChange(mergeAttachmentTemplates('PROPOSED_COMPANY', value, attachments));
          }}
          allowOther
        />
        <SearchableSelect label="Jurisdiction of registration *" value={form.jurisdictionOfRegistration} options={jurisdictions} onChange={(value) => onFormChange({ ...form, jurisdictionOfRegistration: value })} />
        <label className="text-sm font-medium text-slate-700">
          Proposed business activity <RequiredMark />
          <input value={form.proposedBusinessActivity} onChange={(event) => onFormChange({ ...form, proposedBusinessActivity: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Source of initial capital <RequiredMark />
          <input value={form.sourceOfInitialCapital} onChange={(event) => onFormChange({ ...form, sourceOfInitialCapital: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Proposed registered office address {proposedAddressRequired ? <RequiredMark /> : null}
          <textarea value={form.proposedRegisteredOfficeAddress} onChange={(event) => onFormChange({ ...form, proposedRegisteredOfficeAddress: event.target.value })} className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <SearchableMultiSelect
          label="Requested services *"
          value={form.requestedServices}
          options={newoonServiceOptions}
          onChange={(services) => onFormChange({ ...form, requestedServices: services, ...(services.includes('Other') ? {} : { requestedServicesOther: '' }) })}
          otherValue={form.requestedServicesOther}
          onOtherChange={(value) => onFormChange({ ...form, requestedServicesOther: value })}
          allowOther
          wide
        />
      </div>;
}

function ProposedCompanyPreview({ form, attachments }: { form: EnquiryValidationForm; attachments: AttachmentDraft[] }) {
  const legalForm = resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther);
  const value = (item?: string) => item || '-';
  return <aside className="min-w-0 max-h-[calc(100vh-160px)] overflow-auto bg-slate-200 p-4">
    <article className="mx-auto min-h-[1120px] w-full max-w-[794px] bg-white p-6 text-[10px] leading-[1.4] text-black shadow-sm sm:p-8">
      <p>Date: <span className="inline-block min-w-24 border-b border-black">{new Date().toLocaleDateString('en-GB')}</span></p>
      <h2 className="mt-3 text-center text-[9px] font-bold underline">Prospective Customer Information &amp; Preliminary Due Diligence form</h2>
      <p className="mt-2">This form is completed prior to the establishment of a business relationship and before incorporation of the proposed entity. The information is collected to enable Newoon LLC to conduct preliminary AML/CFT screening, customer due diligence, conflict checks, and risk assessment before deciding whether to proceed with the requested engagement.</p>
      <PdfSection title="Section A: Basic Client Details">
        <PdfTable headers={['No.', ''] } rows={[
          ['1', `Proposed Company Name (if available): ${value(form.proposedCompanyName)}`],
          ['2', `Proposed Legal Form (LLC, Branch, Partnership, etc.): ${value(legalForm)}`],
          ['3', `Jurisdiction of Registration (QFC/MOCI): ${value(form.jurisdictionOfRegistration)}`],
          ['4', 'Country of incorporation: -'],
          ['5', `Proposed Registered Office Address: ${value(form.proposedRegisteredOfficeAddress)}`],
          ['6', `Proposed Business Activity: ${value(form.proposedBusinessActivity)}`],
          ['7', `Expected Source of Initial Capital: ${value(form.sourceOfInitialCapital)}`],
          ['8', `Expected Business from Newoon: ${value(resolvedRequestedServices(form).join(', '))}`]
        ]} />
      </PdfSection>
      <PdfSection title="Section B: Shareholders & Beneficial Owners (Proposed)">
        <p className="font-bold">Proposed Shareholders</p>
        <PdfTable headers={['No.', 'Name', 'Passport/QID/C.R. No', 'Nationality', 'Country of Residence', 'Ownership %']} rows={form.preliminaryShareholders.map((row, index) => [String(index + 1), value(row.fullName), value(row.identityNumber), value(row.nationality), value(row.address), value(row.ownershipPercentage)])} />
        <p className="mt-2 font-bold">Ultimate Beneficial owners (Natural Person Only)</p>
        <PdfTable headers={['No.', 'Name', 'Passport/QID', 'Nationality', 'Country of Residence', 'Ownership %']} rows={form.preliminaryUbos.map((row, index) => [String(index + 1), value(row.fullName), value(row.identityNumber), value(row.nationality), value(row.address), value(row.ownershipPercentage)])} />
        <p className="mt-1 font-bold">Total UBO %: {totalOwnership(form.preliminaryUbos)}%</p>
        <p className="mt-2">If a shareholder is a corporate entity, please provide its Commercial Registration (or equivalent incorporation document) and ownership structure until the ultimate beneficial owner(s) (natural person(s)) are identified.</p>
      </PdfSection>
      <PdfSection title="Section C: Proposed Management & Control Persons (Directors, Secretary, SEF, Authorized Signatory)">
        <PdfTable headers={['No.', 'Name', 'Passport / QID', 'Nationality', 'Position']} rows={form.preliminaryManagement.map((row, index) => [String(index + 1), value(row.fullName), value(row.identityNumber), value(row.nationality), value(row.positions?.join(', ') || row.position)])} />
      </PdfSection>
      <PdfSection title="Section D: Required Documents">
        <PdfTable headers={['No.', 'Documents', 'Description', 'Yes/No']} rows={[
          ['1', 'Qatar ID / Passport copies', 'For all natural persons: Shareholder, UBO, Director, SEF, Secretary, and authorized signatory.', attachmentDisplayNames(attachments[0] || { documentType: '', fileName: '' }).length ? 'Yes' : 'No'],
          ['2', 'National address certificates', 'Natural persons resident in Qatar.', attachments.some((attachment) => attachment.documentType.toLowerCase().includes('address')) ? 'Yes' : 'No'],
          ['3', 'CR of legal entities', 'If shareholders are corporate entities, provide CR of each entity until natural persons are identified.', attachments.some((attachment) => attachment.documentType.toLowerCase().includes('corporate')) ? 'Yes' : 'No']
        ]} />
      </PdfSection>
      <div className="mt-16 border-t-4 border-black pt-10">
        <PdfSection title="Section E: Key Contact person">
          <p className="mb-1 font-bold">Provide the contact information of the key contact person:</p>
          <PdfTable headers={['No.', 'Field', 'Details']} rows={[
            ['1', 'Full Name', value(form.keyContactName)], ['2', 'Nationality', value(resolveOtherValue(form.keyContactNationality, form.keyContactNationalityOther))],
            ['3', 'Passport Number', value(form.keyContactPassportNumber)], ['4', 'Passport Expiry Date', value(form.keyContactPassportExpiryDate)],
            ['5', 'QID Number', value(form.keyContactQidNumber)], ['6', 'QID Expiry Date', value(form.keyContactQidExpiryDate)],
            ['7', 'Mobile Number', value(form.keyContactPhone)], ['8', 'Email', value(form.keyContactEmail)]
          ]} />
        </PdfSection>
      </div>
      <PdfSection title="Section F: Client Declaration">
        <p>By signing this document, I hereby confirm that all information and documents provided are true, complete, and up to date. I am authorised to represent and sign this document on behalf of the proposed entity.</p>
        <PdfTable headers={['Field', 'Details']} rows={[
          ['Full Name', value(form.preliminaryDeclaration.fullName)], ['Position', value(form.preliminaryDeclaration.position)], ['Date', value(form.preliminaryDeclaration.date)],
          ['Authorised signature', value(form.preliminaryDeclaration.authorizedSignature)], ['Company Stamp', value(form.preliminaryDeclaration.companyStamp)]
        ]} />
      </PdfSection>
    </article>
  </aside>;
}

function PdfSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-3"><h3 className="border-b-4 border-[#dce9f7] pb-0.5 text-[10px] font-bold">{title}</h3><div className="mt-1">{children}</div></section>; }
function PdfTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <table className="w-full border-collapse text-left"><thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`} className="border border-black px-1 py-0.5 font-bold">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((item, cellIndex) => <td key={cellIndex} className="border border-black px-1 py-0.5 align-top">{item}</td>)}</tr>)}</tbody></table>; }

function totalOwnership(rows: PreliminaryOwner[]) {
  return rows.reduce((total, row) => total + (Number.parseFloat(row.ownershipPercentage) || 0), 0).toFixed(2);
}

function PreliminaryOwnershipForm({ form, onChange }: { form: EnquiryValidationForm; onChange: (form: EnquiryValidationForm) => void }) {
  const update = (key: 'preliminaryShareholders' | 'preliminaryUbos', index: number, field: keyof PreliminaryOwner, value: string | boolean) => {
    const rows = form[key].map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row);
    if (key !== 'preliminaryShareholders') return onChange({ ...form, [key]: rows });

    const shareholder = rows[index];
    const ubos = shareholder.isUbo
      ? [...form.preliminaryUbos.filter((_, uboIndex) => uboIndex !== index), ...Array.from({ length: Math.max(0, index + 1 - form.preliminaryUbos.length) }, blankPreliminaryOwner)].map((row, uboIndex) => uboIndex === index ? { ...shareholder, isUbo: true } : row)
      : form.preliminaryUbos.filter((_, uboIndex) => uboIndex !== index);
    onChange({ ...form, preliminaryShareholders: rows, preliminaryUbos: ubos.length ? ubos : [blankPreliminaryOwner()] });
  };
  const remove = (key: 'preliminaryShareholders' | 'preliminaryUbos', index: number) => {
    const rows = form[key].filter((_, rowIndex) => rowIndex !== index);
    if (key === 'preliminaryShareholders') {
      const ubos = form.preliminaryUbos.filter((_, uboIndex) => uboIndex !== index);
      onChange({ ...form, preliminaryShareholders: rows.length ? rows : [blankPreliminaryOwner()], preliminaryUbos: ubos.length ? ubos : [blankPreliminaryOwner()] });
      return;
    }
    onChange({ ...form, preliminaryUbos: rows.length ? rows : [blankPreliminaryOwner()] });
  };
  const renderField = (key: 'preliminaryShareholders' | 'preliminaryUbos', index: number, row: PreliminaryOwner, field: keyof PreliminaryOwner) => {
    if (field === 'nationality' || field === 'address') return <select value={String(row[field])} onChange={(event) => update(key, index, field, event.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-1.5"><option value="">Select</option>{countryOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
    return <input value={String(row[field])} onChange={(event) => update(key, index, field, event.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5" />;
  };
  const renderRows = (key: 'preliminaryShareholders' | 'preliminaryUbos', title: string, showUbo = false) => <section className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">Enter the proposed natural-person or corporate ownership details.</p></div><button type="button" onClick={() => onChange({ ...form, [key]: [...form[key], blankPreliminaryOwner()] })} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Add row</button></div><div className="mt-4 overflow-x-auto"><table className="min-w-[880px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Full name', 'Passport / QID / CR', 'Nationality', 'Country of residence', 'Ownership %', ...(showUbo ? ['UBO'] : []), ''].map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead><tbody>{form[key].map((row, index) => <tr key={index} className="border-t border-slate-200">{(['fullName', 'identityNumber', 'nationality', 'address', 'ownershipPercentage'] as const).map((field) => <td key={field} className="p-2">{renderField(key, index, row, field)}</td>)}{showUbo ? <td className="p-2 text-center"><input type="checkbox" checked={row.isUbo} onChange={(event) => update(key, index, 'isUbo', event.target.checked)} aria-label={`Mark ${row.fullName || `shareholder ${index + 1}`} as UBO`} /></td> : null}<td className="p-2"><button type="button" onClick={() => remove(key, index)} disabled={form[key].length === 1} className="text-sm font-semibold text-red-600 disabled:opacity-40">Remove</button></td></tr>)}</tbody></table></div><p className="mt-3 text-sm font-semibold text-slate-700">Total {showUbo ? 'shareholder' : 'UBO'} %: {totalOwnership(form[key])}%</p></section>;
  return <div className="space-y-5">{renderRows('preliminaryShareholders', 'Proposed Shareholders', true)}{renderRows('preliminaryUbos', 'Ultimate Beneficial Owners')}</div>;
}

function PreliminaryManagementForm({ form, onChange }: { form: EnquiryValidationForm; onChange: (form: EnquiryValidationForm) => void }) {
  const update = (index: number, field: keyof PreliminaryManagementPerson, value: string | string[]) => onChange({ ...form, preliminaryManagement: form.preliminaryManagement.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value, ...(field === 'positions' ? { position: (value as string[]).join(', ') } : {}) } : row) });
  return <section className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Proposed Management and Control Persons</h2><p className="mt-1 text-sm text-slate-500">Include directors, secretary, SEF, and authorised signatories.</p></div><button type="button" onClick={() => onChange({ ...form, preliminaryManagement: [...form.preliminaryManagement, blankPreliminaryManagement()] })} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Add person</button></div><div className="mt-4 overflow-x-auto"><table className="min-w-[860px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Full name', 'Passport / QID', 'Nationality', 'Positions', ''].map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead><tbody>{form.preliminaryManagement.map((row, index) => <tr key={index} className="border-t border-slate-200"><td className="p-2"><input value={row.fullName} onChange={(event) => update(index, 'fullName', event.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5" /></td><td className="p-2"><input value={row.identityNumber} onChange={(event) => update(index, 'identityNumber', event.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5" /></td><td className="p-2"><select value={row.nationality} onChange={(event) => update(index, 'nationality', event.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-1.5"><option value="">Select</option>{nationalityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></td><td className="min-w-[260px] p-2"><SearchableMultiSelect label="" value={row.positions?.length ? row.positions : row.position ? row.position.split(', ').filter(Boolean) : []} options={positionOptions.filter(Boolean)} onChange={(value) => update(index, 'positions', value)} placeholder="Select one or more positions" /></td><td className="p-2"><button type="button" onClick={() => onChange({ ...form, preliminaryManagement: form.preliminaryManagement.filter((_, rowIndex) => rowIndex !== index) })} disabled={form.preliminaryManagement.length === 1} className="text-sm font-semibold text-red-600 disabled:opacity-40">Remove</button></td></tr>)}</tbody></table></div></section>;
}

function enquirySteps(enquiryType: EnquiryType): Array<{ id: EnquiryStep; label: string; description: string }> {
  const steps: Array<{ id: EnquiryStep; label: string; description: string }> = [
    { id: 'type', label: 'Type', description: 'Select the enquiry category so the correct fields are shown.' },
    { id: 'details', label: 'Details', description: 'Capture the company/client details and requested Newoon services.' }
  ];

  if (enquiryType !== 'CURRENT_CLIENT_NEW_SERVICES') {
    if (enquiryType === 'PROPOSED_COMPANY') {
      steps.push(
        { id: 'ownership', label: 'Ownership', description: 'Add proposed shareholders and ultimate beneficial owners.' },
        { id: 'management', label: 'Management', description: 'Add proposed directors, SEF, secretary, and authorised signatories.' }
      );
    }
    steps.push({ id: 'contact', label: 'Contact', description: 'Add the key communication person for this enquiry.' });
    if (enquiryType === 'PROPOSED_COMPANY') steps.push({ id: 'declaration', label: 'Declaration', description: 'Record the proposed entity client declaration.' });
  }

  if (enquiryType === 'EXISTING_LEGAL_ENTITY') {
    steps.push({ id: 'exposure', label: 'Exposure', description: 'Record the countries and operating areas connected to this entity.' });
  }

  steps.push({
    id: 'attachments',
    label: 'Attachments',
    description:
      enquiryType === 'CURRENT_CLIENT_NEW_SERVICES'
        ? 'Upload additional documents for the requested new services.'
        : 'Capture the relevant document names for AML review.'
  });

  steps.push({ id: 'notes', label: 'Notes', description: 'Add any supporting context before saving the enquiry.' });
  return steps;
}

function mergeAttachmentTemplates(enquiryType: EnquiryType, proposedLegalForm: string, currentAttachments: AttachmentDraft[]) {
  const templates = attachmentTemplates(enquiryType, proposedLegalForm);
  const additionalUploads = currentAttachments.filter(isAdditionalAttachment);
  if (enquiryType === 'CURRENT_CLIENT_NEW_SERVICES') return additionalUploads.length ? additionalUploads : templates;
  const currentByType = new Map(currentAttachments.map((attachment) => [attachment.documentType, attachment]));
  const templateTypes = new Set(templates.map((template) => template.documentType));
  const mappedTemplates = templates.map((template) => currentByType.get(template.documentType) || template);
  const preservedUploads = currentAttachments.filter(
    (attachment) => !templateTypes.has(attachment.documentType) && !isAdditionalAttachment(attachment) && hasAttachmentContent(attachment)
  );
  return [...mappedTemplates, ...preservedUploads, ...additionalUploads];
}

function attachmentDraftsFromSaved(attachments: Array<{ id?: string; documentType: string; fileName: string; storagePath?: string | null; mimeType?: string | null; size?: number | null }>) {
  const grouped = new Map<string, AttachmentDraft>();

  attachments.forEach((attachment) => {
    const documentType = attachment.documentType;
    const storedFile = {
      id: attachment.id,
      fileName: attachment.fileName,
      storagePath: attachment.storagePath,
      mimeType: attachment.mimeType || undefined,
      size: attachment.size || undefined
    };
    const existing = grouped.get(documentType) || { documentType, fileName: '', storedFiles: [] };
    const storedFiles = [...(existing.storedFiles || []), storedFile];
    grouped.set(documentType, {
      ...existing,
      id: existing.id || attachment.id,
      fileName: storedFiles.map((file) => file.fileName).join(', '),
      storagePath: storedFiles.length === 1 ? storedFiles[0].storagePath : undefined,
      mimeType: storedFiles.length === 1 ? storedFiles[0].mimeType : undefined,
      size: storedFiles.length === 1 ? storedFiles[0].size : undefined,
      storedFiles
    });
  });

  return Array.from(grouped.values());
}

function isAdditionalAttachment(attachment: AttachmentDraft) {
  return attachment.documentType.toLowerCase().startsWith('additional document upload');
}

function hasAttachmentContent(attachment: AttachmentDraft) {
  return Boolean(attachment.fileName.trim() || attachment.storagePath || attachment.files?.length);
}

function attachmentDocumentType(enquiryType: EnquiryType, attachment: AttachmentDraft, index: number) {
  if (enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' && !attachment.documentType) {
    return `Additional document upload ${index + 1}`;
  }
  return attachment.documentType;
}

function attachmentDisplayNames(attachment: AttachmentDraft) {
  return uniqueNames([
    ...(attachment.storedFiles?.map((file) => file.fileName) || attachmentFileNameList(attachment.fileName)),
    ...(attachment.files || []).map((file) => file.name)
  ]);
}

function findAttachmentByType(attachments: AttachmentDraft[], documentType: string) {
  return attachments.find((attachment) => attachment.documentType === documentType) || { documentType, fileName: '' };
}

function attachmentFileNameList(value: string | undefined) {
  return (value || '').split(',').map((name) => name.trim()).filter(Boolean);
}

function fallbackStoredFiles(attachment: AttachmentDraft): StoredAttachmentFile[] {
  return attachmentFileNameList(attachment.fileName).map((fileName) => ({
    fileName,
    storagePath: attachment.storagePath,
    mimeType: attachment.mimeType,
    size: attachment.size
  }));
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeFiles(existingFiles: File[] | undefined, selectedFiles: File[]) {
  const existing = existingFiles || [];
  const seen = new Set(existing.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
  return [
    ...existing,
    ...selectedFiles.filter((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  ];
}

function setAttachmentFilesByType(attachments: AttachmentDraft[], documentType: string, files: File[]) {
  const existingAttachment = findAttachmentByType(attachments, documentType);
  const nextFiles = mergeFiles(existingAttachment.files, files);
  const nextNames = uniqueNames([...attachmentDisplayNames(existingAttachment), ...files.map((file) => file.name)]);
  const storedFiles = existingAttachment.storedFiles || fallbackStoredFiles(existingAttachment);
  const nextAttachment: AttachmentDraft = {
    ...existingAttachment,
    documentType,
    fileName: nextNames.join(', '),
    storagePath: storedFiles.length === 1 && !nextFiles.length ? storedFiles[0].storagePath : undefined,
    mimeType: nextFiles.length === 1 ? nextFiles[0].type || undefined : undefined,
    size: nextFiles.length === 1 ? nextFiles[0].size : undefined,
    storedFiles: storedFiles.length ? storedFiles : undefined,
    files: nextFiles.length ? nextFiles : undefined
  };

  const found = attachments.some((attachment) => attachment.documentType === documentType);
  return found ? attachments.map((attachment) => (attachment.documentType === documentType ? nextAttachment : attachment)) : [nextAttachment, ...attachments];
}

function removeAttachmentFileByType(attachments: AttachmentDraft[], documentType: string, fileIndex: number) {
  return attachments.map((attachment) => (attachment.documentType === documentType ? removeAttachmentFile(attachment, fileIndex) : attachment));
}

function removeAttachmentFile(attachment: AttachmentDraft, fileIndex: number): AttachmentDraft {
  const removeName = attachmentDisplayNames(attachment)[fileIndex];
  const nextFiles = (attachment.files || []).filter((file) => file.name !== removeName);
  const nextStoredFiles = (attachment.storedFiles || fallbackStoredFiles(attachment)).filter((file) => file.fileName !== removeName);
  const nextNames = uniqueNames([...nextStoredFiles.map((file) => file.fileName), ...nextFiles.map((file) => file.name)]);
  return {
    ...attachment,
    fileName: nextNames.join(', '),
    storagePath: nextStoredFiles.length === 1 && !nextFiles.length ? nextStoredFiles[0].storagePath : null,
    mimeType: nextFiles.length === 1 ? nextFiles[0].type || undefined : nextStoredFiles.length === 1 ? nextStoredFiles[0].mimeType : undefined,
    size: nextFiles.length === 1 ? nextFiles[0].size : nextStoredFiles.length === 1 ? nextStoredFiles[0].size : undefined,
    storedFiles: nextStoredFiles.length ? nextStoredFiles : undefined,
    files: nextFiles.length ? nextFiles : undefined
  };
}

function flattenAttachmentMetadata(enquiryType: EnquiryType, attachments: AttachmentDraft[]): NonNullable<EnquiryPayload['attachments']> {
  const items: NonNullable<EnquiryPayload['attachments']> = [];

  attachments.forEach((attachment, index) => {
    const documentType = attachmentDocumentType(enquiryType, attachment, index);
    const pendingNames = new Set((attachment.files || []).map((file) => file.name.toLowerCase()));
    const storedFiles =
      attachment.storedFiles ||
      fallbackStoredFiles(attachment);

    storedFiles
      .filter((file) => !pendingNames.has(file.fileName.toLowerCase()))
      .forEach((file) => items.push({
        documentType,
        fileName: file.fileName,
        storagePath: file.storagePath || undefined,
        mimeType: file.mimeType,
        size: file.size
      }));
  });

  return items;
}

function AttachmentRows({
  enquiryType,
  proposedLegalForm,
  attachments,
  onChange
}: {
  enquiryType: EnquiryType;
  proposedLegalForm: string;
  attachments: AttachmentDraft[];
  onChange: (attachments: AttachmentDraft[]) => void;
}) {
  function setFiles(index: number, files: File[]) {
    onChange(
      attachments.map((attachment, itemIndex) =>
        itemIndex === index
          ? (() => {
              const nextFiles = mergeFiles(attachment.files, files);
              const nextNames = uniqueNames([...attachmentDisplayNames(attachment), ...files.map((file) => file.name)]);
              const storedFiles = attachment.storedFiles || fallbackStoredFiles(attachment);
              return {
                ...attachment,
                fileName: nextNames.join(', '),
                storagePath: storedFiles.length === 1 && !nextFiles.length ? storedFiles[0].storagePath : undefined,
                mimeType: nextFiles.length === 1 ? nextFiles[0].type || undefined : undefined,
                size: nextFiles.length === 1 ? nextFiles[0].size : undefined,
                storedFiles: storedFiles.length ? storedFiles : undefined,
                files: nextFiles.length ? nextFiles : undefined
              };
            })()
          : attachment
      )
    );
  }

  function removeFile(index: number, fileIndex: number) {
    onChange(attachments.map((attachment, itemIndex) => (itemIndex === index ? removeAttachmentFile(attachment, fileIndex) : attachment)));
  }

  function clearFiles(index: number) {
    onChange(
      attachments.map((attachment, itemIndex) =>
        itemIndex === index
          ? {
              ...attachment,
              fileName: '',
              storagePath: null,
              mimeType: undefined,
              size: undefined,
              storedFiles: undefined,
              files: undefined
            }
          : attachment
      )
    );
  }

  function addAdditionalUpload() {
    const additionalCount = attachments.filter(isAdditionalAttachment).length;
    onChange([
      ...attachments,
      {
        documentType: `Additional document upload ${additionalCount + 1}`,
        fileName: ''
      }
    ]);
  }

  function removeAttachment(index: number) {
    const nextAttachments = attachments.filter((_, itemIndex) => itemIndex !== index);
    onChange(nextAttachments.length ? nextAttachments : attachmentTemplates(enquiryType, proposedLegalForm));
  }

  const isAdditionalUploadOnly = enquiryType === 'CURRENT_CLIENT_NEW_SERVICES';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            {isAdditionalUploadOnly ? 'Additional Document Upload' : 'Required Attachment Options'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isAdditionalUploadOnly
              ? 'Add one or more supporting documents for the new service request.'
              : enquiryType === 'PROPOSED_COMPANY'
                ? 'Capture the preliminary incorporation support files required for review.'
                : 'Capture company, ownership, and identity documents required for review.'}
          </p>
        </div>
        <button
          type="button"
          onClick={addAdditionalUpload}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Add Document
        </button>
      </div>
      <div className="mt-4 divide-y divide-slate-100 rounded-md border border-slate-200">
        {attachments.map((attachment, index) => {
          const additional = isAdditionalAttachment(attachment);
          return (
          <div key={`${attachment.documentType}-${index}`} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(360px,1.7fr)_44px] md:items-center">
            <p className="text-sm font-medium text-slate-950">
              {attachment.documentType}
            </p>
            <MultiFileUploadControl names={attachmentDisplayNames(attachment)} onSelect={(files) => setFiles(index, files)} onRemoveName={(fileIndex) => removeFile(index, fileIndex)} />
            <button
              type="button"
              onClick={() => (additional ? removeAttachment(index) : clearFiles(index))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
              aria-label={`${additional ? 'Remove' : 'Clear'} ${attachment.documentType}`}
              title={additional ? 'Remove' : 'Clear'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          );
        })}
      </div>
    </div>
  );
}
