import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { PreliminaryOwnershipEditor } from '../components/PreliminaryOwnershipEditor';
import { PreliminaryManagementEditor } from '../components/PreliminaryManagementEditor';
import { mergeBeneficialOwners } from '../utils/ownership';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resolveOtherValue, SearchableMultiSelect, SearchableSelect, splitList } from '../components/SearchableSelect';
import { MultiFileUploadControl } from '../components/MultiFileUploadControl';
import { TypedDateInput } from '../components/TypedDateInput';
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
  'SEF',
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

type PreliminaryOwner = { id?: string; shareholderType?: string; parentRowId?: string; sourceShareholderId?: string; fullName: string; nationality: string; identityNumber: string; address: string; ownershipPercentage: string; isUbo: boolean };
type PreliminaryManagementPerson = { id?: string; fullName: string; identityNumber: string; nationality: string; position: string; positions?: string[] };
type PreliminaryDeclaration = {
  fullName: string;
  position: string;
  date: string;
  authorizedSignature: string;
  authorizedSignatureDataUrl?: string;
  companyStamp: string;
  companyStampDataUrl?: string;
};

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
  keyContactNationality: string[];
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

const blankPreliminaryOwner = (): PreliminaryOwner => ({ id: crypto.randomUUID(), shareholderType: 'Individual', parentRowId: '', fullName: '', nationality: '', identityNumber: '', address: '', ownershipPercentage: '', isUbo: false });
const blankPreliminaryManagement = (): PreliminaryManagementPerson => ({ id: crypto.randomUUID(), fullName: '', identityNumber: '', nationality: '', position: '', positions: [] });

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

// Multi-select nationality: known options stay selected; anything else is shown under "Other".
function splitNationalities(value: unknown, options: string[]) {
  const values = splitList(value);
  const known = values.filter((item) => options.includes(item) && item !== 'Other');
  const other = values.filter((item) => !options.includes(item) || item === 'Other').filter((item) => item !== 'Other');
  return { value: other.length ? [...known, 'Other'] : known, otherValue: other.join(', ') };
}

// Saved as one comma-separated string so existing records, KYC conversion and screening keep working.
function nationalityText(values: string[], otherValue: string) {
  return values.map((item) => (item === 'Other' ? otherValue.trim() : item)).filter(Boolean).join(', ');
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
    if (!nationalityText(form.keyContactNationality, form.keyContactNationalityOther)) {
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
    const percentages = form.preliminaryShareholders.map((row) => Number(row.ownershipPercentage));
    if (percentages.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      return 'Each shareholder ownership percentage must be a number between 0 and 100.';
    }
    const total = percentages.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) > 0.005) {
      return `Direct shareholder ownership must total 100%. Current total: ${total.toFixed(2)}%.`;
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
  const [success, setSuccess] = useState('');
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
    keyContactNationality: [],
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
    preliminaryDeclaration: { fullName: '', position: '', date: '', authorizedSignature: '', authorizedSignatureDataUrl: '', companyStamp: '', companyStampDataUrl: '' },
    notes: ''
  });
  const [declarationFiles, setDeclarationFiles] = useState<{ authorizedSignature?: File; companyStamp?: File }>({});

  useEffect(() => {
    Promise.all([listClients(), id ? getEnquiry(id) : Promise.resolve(null)])
      .then(([clientItems, enquiry]) => {
        setClients(clientItems);
        if (!enquiry) return;
        const details = enquiry.details || {};
        const keyContactPosition = splitOtherValue(enquiry.keyContactPosition, positionOptions);
        const keyContactNationality = splitNationalities(details.keyContactNationality, nationalityOptions);
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
          preliminaryShareholders: Array.isArray(preliminary.shareholders) && preliminary.shareholders.length ? (preliminary.shareholders as PreliminaryOwner[]).map((row) => ({ ...row, id: row.id || crypto.randomUUID() })) : [blankPreliminaryOwner()],
          preliminaryUbos: Array.isArray(preliminary.ubos) && preliminary.ubos.length ? (preliminary.ubos as PreliminaryOwner[]).map((row) => ({ ...row, id: row.id || crypto.randomUUID() })) : [blankPreliminaryOwner()],
          preliminaryManagement: Array.isArray(preliminary.management) && preliminary.management.length ? (preliminary.management as PreliminaryManagementPerson[]).map((row) => ({ ...row, id: row.id || crypto.randomUUID() })) : [blankPreliminaryManagement()],
          preliminaryDeclaration: preliminary.declaration && typeof preliminary.declaration === 'object'
            ? {
                fullName: String(preliminary.declaration.fullName || ''),
                position: String(preliminary.declaration.position || ''),
                date: String(preliminary.declaration.date || ''),
                authorizedSignature: String(preliminary.declaration.authorizedSignature || ''),
                authorizedSignatureDataUrl: String(preliminary.declaration.authorizedSignatureDataUrl || ''),
                companyStamp: String(preliminary.declaration.companyStamp || ''),
                companyStampDataUrl: String(preliminary.declaration.companyStampDataUrl || '')
              }
            : { fullName: '', position: '', date: '', authorizedSignature: '', authorizedSignatureDataUrl: '', companyStamp: '', companyStampDataUrl: '' },
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
            keyContactNationality: nationalityText(form.keyContactNationality, form.keyContactNationalityOther),
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
              expectedBusiness: resolvedRequestedServices(form),
              shareholders: form.preliminaryShareholders,
              ubos: mergeBeneficialOwners(form.preliminaryShareholders, form.preliminaryUbos),
              management: form.preliminaryManagement.map((row) => ({ ...row, position: row.positions?.join(', ') || row.position })),
              contact: {
                fullName: form.keyContactName,
                position: resolveOtherValue(form.keyContactPosition, form.keyContactPositionOther),
                nationality: nationalityText(form.keyContactNationality, form.keyContactNationalityOther),
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

  async function selectDeclarationFile(key: 'authorizedSignature' | 'companyStamp', file?: File) {
    const dataUrl = file ? await readFileAsDataUrl(file) : '';
    setDeclarationFiles((current) => ({ ...current, [key]: file }));
    setForm((current) => ({
      ...current,
      preliminaryDeclaration: {
        ...current.preliminaryDeclaration,
        [key]: file?.name || '',
        [`${key}DataUrl`]: dataUrl
      }
    }));
  }

  async function uploadDeclarationFiles(enquiryId: string) {
    if (declarationFiles.authorizedSignature) {
      await uploadEnquiryAttachmentFiles(enquiryId, {
        documentType: 'Preliminary KYC - Authorised Signature',
        files: [declarationFiles.authorizedSignature]
      });
    }
    if (declarationFiles.companyStamp) {
      await uploadEnquiryAttachmentFiles(enquiryId, {
        documentType: 'Preliminary KYC - Company Stamp',
        files: [declarationFiles.companyStamp]
      });
    }
  }

  async function refreshUploadedAttachments(enquiryId: string) {
    const saved = await getEnquiry(enquiryId);
    const proposedLegalForm = resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther);
    setAttachments(
      mergeAttachmentTemplates(
        saved.enquiryType,
        proposedLegalForm,
        attachmentDraftsFromSaved(saved.attachments || [])
      )
    );
    setDeclarationFiles({});
  }

  async function saveDraft() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const enquiry = id ? await updateEnquiry(id, buildPayload(false)) : await createEnquiry(buildPayload(false));
      for (const [index, attachment] of attachments.entries()) {
        if (!attachment.files?.length) continue;
        await uploadEnquiryAttachmentFiles(enquiry.id, { documentType: attachmentDocumentType(form.enquiryType, attachment, index), files: attachment.files });
      }
      await uploadDeclarationFiles(enquiry.id);
      if (id) {
        await refreshUploadedAttachments(enquiry.id);
        setSuccess('Enquiry updated successfully.');
      } else {
        navigate(`/enquiries/${enquiry.id}/edit`, { replace: true });
      }
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
    setSuccess('');

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
      await uploadDeclarationFiles(enquiry.id);
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
        <Link to={id ? `/enquiries/${id}` : '/enquiries'} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
          <ArrowLeft className="h-4 w-4" />
          {isEditMode ? 'Back to enquiry' : 'Back to enquiries'}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">{isEditMode ? 'Edit Enquiry' : 'New Enquiry'}</h1>
        <p className="mt-1 text-sm text-slate-500">Capture the BD enquiry before AML prepares the KYC file.</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800" role="status">{success}</p> : null}

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
              <SearchableMultiSelect
                label="Nationality *"
                value={form.keyContactNationality}
                otherValue={form.keyContactNationalityOther}
                options={nationalityOptions}
                onChange={(value) => setForm({ ...form, keyContactNationality: value, ...(value.includes('Other') ? {} : { keyContactNationalityOther: '' }) })}
                onOtherChange={(value) => setForm({ ...form, keyContactNationalityOther: value })}
                allowOther
                placeholder="Select nationalities"
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
                    <TypedDateInput value={form.keyContactPassportExpiryDate} onChange={(value) => setForm({ ...form, keyContactPassportExpiryDate: value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
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
                    <TypedDateInput value={form.keyContactQidExpiryDate} onChange={(value) => setForm({ ...form, keyContactQidExpiryDate: value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
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
                <label className="text-sm font-medium text-slate-700">Date<TypedDateInput value={form.preliminaryDeclaration.date} onChange={(value) => setForm({ ...form, preliminaryDeclaration: { ...form.preliminaryDeclaration, date: value } })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
                <div className="text-sm font-medium text-slate-700">
                  <span>Authorised signature</span>
                  <div className="mt-1">
                    <MultiFileUploadControl
                      multiple={false}
                      names={form.preliminaryDeclaration.authorizedSignature ? [form.preliminaryDeclaration.authorizedSignature] : []}
                      buttonLabel="Upload signature"
                      placeholder="No signature selected"
                      helperText="Upload the authorised signature file. Images will appear in the Preliminary KYC preview and printout."
                      onSelect={(files) => void selectDeclarationFile('authorizedSignature', files[0])}
                      onRemoveName={() => void selectDeclarationFile('authorizedSignature')}
                    />
                  </div>
                </div>
                <div className="text-sm font-medium text-slate-700 md:col-span-2">
                  <span>Company stamp</span>
                  <div className="mt-1">
                    <MultiFileUploadControl
                      multiple={false}
                      names={form.preliminaryDeclaration.companyStamp ? [form.preliminaryDeclaration.companyStamp] : []}
                      buttonLabel="Upload stamp"
                      placeholder="No company stamp selected"
                      helperText="Upload the company stamp file. Images will appear in the Preliminary KYC preview and printout."
                      onSelect={(files) => void selectDeclarationFile('companyStamp', files[0])}
                      onRemoveName={() => void selectDeclarationFile('companyStamp')}
                    />
                  </div>
                </div>
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
              {!isEditMode || activeStepIndex < steps.length - 1 ? (
              <button type="button" onClick={saveDraft} disabled={saving} className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${isEditMode ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : isEditMode ? 'Update Enquiry' : 'Save Draft'}
              </button>
              ) : null}
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
  return <aside className="min-w-0 max-h-[calc(100vh-160px)] overflow-auto bg-slate-200 p-4 min-[1500px]:sticky min-[1500px]:top-4 min-[1500px]:self-start">
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
        <PdfTable headers={['No.', 'Name', 'Passport/QID', 'Nationality', 'Country of Residence', 'Ownership %']} rows={mergeBeneficialOwners(form.preliminaryShareholders, form.preliminaryUbos).map((row, index) => [String(index + 1), value(row.fullName), value(row.identityNumber), value(row.nationality), value(row.address), value(row.ownershipPercentage)])} />
        <p className="mt-1 font-bold">Total UBO %: {totalOwnership(mergeBeneficialOwners(form.preliminaryShareholders, form.preliminaryUbos))}%</p>
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
            ['1', 'Full Name', value(form.keyContactName)], ['2', 'Nationality', value(nationalityText(form.keyContactNationality, form.keyContactNationalityOther))],
            ['3', 'Passport Number', value(form.keyContactPassportNumber)], ['4', 'Passport Expiry Date', value(form.keyContactPassportExpiryDate)],
            ['5', 'QID Number', value(form.keyContactQidNumber)], ['6', 'QID Expiry Date', value(form.keyContactQidExpiryDate)],
            ['7', 'Mobile Number', value(form.keyContactPhone)], ['8', 'Email', value(form.keyContactEmail)]
          ]} />
        </PdfSection>
      </div>
      <PdfSection title="Section F: Client Declaration">
        <p>By signing this document, I hereby confirm that all information and documents provided are true, complete, and up to date. I am authorised to represent and sign this document on behalf of the proposed entity.</p>
        <table className="mt-1 w-full border-collapse text-left"><tbody>
          <tr><th className="w-1/3 border border-black px-1 py-0.5">Full Name</th><td className="border border-black px-1 py-0.5">{value(form.preliminaryDeclaration.fullName)}</td></tr>
          <tr><th className="border border-black px-1 py-0.5">Position</th><td className="border border-black px-1 py-0.5">{value(form.preliminaryDeclaration.position)}</td></tr>
          <tr><th className="border border-black px-1 py-0.5">Date</th><td className="border border-black px-1 py-0.5">{value(form.preliminaryDeclaration.date)}</td></tr>
          <tr><th className="border border-black px-1 py-0.5">Authorised signature</th><td className="border border-black px-1 py-0.5"><PreliminaryUploadPreview fileName={form.preliminaryDeclaration.authorizedSignature} dataUrl={form.preliminaryDeclaration.authorizedSignatureDataUrl} /></td></tr>
          <tr><th className="border border-black px-1 py-0.5">Company Stamp</th><td className="border border-black px-1 py-0.5"><PreliminaryUploadPreview fileName={form.preliminaryDeclaration.companyStamp} dataUrl={form.preliminaryDeclaration.companyStampDataUrl} /></td></tr>
        </tbody></table>
      </PdfSection>
    </article>
  </aside>;
}

function PdfSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-3"><h3 className="border-b-4 border-[#dce9f7] pb-0.5 text-[10px] font-bold">{title}</h3><div className="mt-1">{children}</div></section>; }
function PdfTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <table className="w-full border-collapse text-left"><thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`} className="border border-black px-1 py-0.5 font-bold">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((item, cellIndex) => <td key={cellIndex} className="border border-black px-1 py-0.5 align-top">{item}</td>)}</tr>)}</tbody></table>; }
function PreliminaryUploadPreview({ fileName, dataUrl }: { fileName?: string; dataUrl?: string }) {
  if (!fileName) return <>-</>;
  return <div className="min-h-6"><span>{fileName}</span>{dataUrl?.startsWith('data:image/') ? <img src={dataUrl} alt={fileName} className="mt-1 max-h-20 max-w-40 object-contain" /> : null}</div>;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function totalOwnership(rows: PreliminaryOwner[]) {
  return rows.reduce((total, row) => total + (Number.parseFloat(row.ownershipPercentage) || 0), 0).toFixed(2);
}

function PreliminaryOwnershipForm({ form, onChange }: { form: EnquiryValidationForm; onChange: (form: EnquiryValidationForm) => void }) {
  return <PreliminaryOwnershipEditor shareholders={form.preliminaryShareholders} ubos={form.preliminaryUbos} countries={countryOptions} nationalities={nationalityOptions} onChange={(shareholders, ubos) => onChange({ ...form, preliminaryShareholders: shareholders, preliminaryUbos: ubos })} />;
}

function PreliminaryManagementForm({ form, onChange }: { form: EnquiryValidationForm; onChange: (form: EnquiryValidationForm) => void }) {
  return <PreliminaryManagementEditor people={form.preliminaryManagement} nationalities={nationalityOptions} positions={positionOptions} onChange={(people) => onChange({ ...form, preliminaryManagement: people })} />;
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
