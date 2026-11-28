import { ArrowLeft, Eye, Paperclip, Plus, Save } from 'lucide-react';
import { DocumentCard, PeopleDocuments } from '../components/AttachmentsPanel';
import { attachmentPositionOptions, CONTACT_PERSON, placePerson, type PlacementLayout } from '../utils/attachment-people';
import { PreliminaryOwnershipEditor } from '../components/PreliminaryOwnershipEditor';
import { PreliminaryManagementEditor } from '../components/PreliminaryManagementEditor';
import { withSplitIdentity } from '../components/PreliminaryPersonFields';
import { identitySummary } from '../utils/person-identity';
import { mergeBeneficialOwners } from '../utils/ownership';
import { directOwnershipTotal, overOwnedCompanies, ownershipChainOrder, shareholderOfLabel } from '../utils/preliminary-ownership-chain';
import { filledContactRows } from '../utils/contact-preview';
import { ComponentProps, FormEvent, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resolveOtherValue, SearchableMultiSelect, SearchableSelect, splitList } from '../components/SearchableSelect';
import { MultiFileUploadControl } from '../components/MultiFileUploadControl';
import { TypedDateInput } from '../components/TypedDateInput';
import { FillNote } from '../components/DocumentFillBar';
import { kycDocumentTypes } from '../utils/kyc-document-types';
import { STANDARD_DOCUMENT_HINT } from '../utils/upload-security';
import { blankDocumentPerson, mergeDocumentPerson, mergeDocumentPersonInto, restoreDocumentPeople, type DocumentPerson } from '../utils/document-people';
import { automaticIntakeApplication, appendReviewedPerson, applyAutomaticIdentity, newIntakePersonTargets, readIntakeDocument, reviewedPatch, validateIntakeFile, type IntakeApplication, type IntakeReading } from '../utils/document-intake';
import { PeopleLink, PeopleLinkContext, SamePersonPicker } from '../components/SamePersonPicker';
import { PeopleAdapter, PERSON_FIELDS, personChoices, personDetails, personKeys, syncLinkedPeople, toList } from '../utils/linked-people';
import { addPeopleFromDocument, PeopleLayout } from '../utils/people-from-document';
import { withDerivedIdentity } from '../utils/person-identity';
import { FillOutcome, matchOption } from '../utils/document-fill';
import { checkEnquiryDuplicate, createEnquiry, readEnquiryCompanyDocument, readEnquiryIdentityDocument, EnquiryDuplicate, EnquiryPayload, EnquiryType, getEnquiry, getEnquiryAttachmentFile, listClients, updateEnquiry, uploadEnquiryAttachmentFiles, viewEnquiryAttachment, Client } from '../services/kyc-workflow.service';
import { applyCountryDialCode, countryDialOptions, getDialCode } from '../utils/country-phone';
import { newoonServiceOptions } from '../utils/newoon-services';
import { useAuth } from '../hooks/useAuth';
import { canEditEnquiryRecord } from '../utils/enquiry-edit-access';

const enquiryTypes: EnquiryType[] = ['EXISTING_LEGAL_ENTITY', 'PROPOSED_COMPANY', 'CURRENT_CLIENT_NEW_SERVICES'];

const enquiryTypeLabels: Record<EnquiryType, string> = {
  EXISTING_LEGAL_ENTITY: 'Existing Legal Entity',
  PROPOSED_COMPANY: 'Proposed Company - No Legal Status Yet',
  CURRENT_CLIENT_NEW_SERVICES: 'Current Client - New Services Requested'
};

const legalForms = ['', 'QFC Holding', 'QFC SPC', 'QFC LLC', 'QFZ LLC', 'MOCI LLC'];
const jurisdictions = ['', 'QFC', 'MOCI', 'Free Zone', 'Company House', 'Other'];
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
  'UBO',
  'Authorized Signatory',
  'SEF',
  'Secretary',
  'Company Secretary',
  'Compliance Officer',
  'Finance Manager',
  'Principal Representative'
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

// Passport / QID split with expiries, date of birth (incorporation for a company) and PEP Yes / No, as on the KYC form.
type PersonDetails = { passportNumber?: string; passportExpiry?: string; qidNumber?: string; qidExpiry?: string; dateOfBirth?: string; isPep?: string };
type PreliminaryOwner = PersonDetails & { id?: string; shareholderType?: string; parentRowId?: string; sourceShareholderId?: string; uboPercentage?: string; fullName: string; nationality: string; identityNumber: string; address: string; ownershipPercentage: string; isUbo: boolean };
type PreliminaryManagementPerson = PersonDetails & { id?: string; fullName: string; identityNumber: string; nationality: string; position: string; positions?: string[]; positionOther?: string };
const IDENTITY_COPIES_DOCUMENT = 'Passport / QID copies';
// The required document type each person's QID / passport is saved under (KYC required-document matching uses it).
const PEOPLE_DOCUMENT = 'QID / Passport copies';
type PreliminaryDeclaration = {
  fullName: string;
  position: string;
  date: string;
  authorizedSignature: string;
  authorizedSignatureDataUrl?: string;
  companyStamp: string;
  companyStampDataUrl?: string;
};

// Company details of an existing legal entity (Details step). Form key, name in the saved details / KYC Section A, label.
const companyProfileFields = [
  ['companyCrNumber', 'commercialRegistrationNo', 'Commercial Registration No', 'text'],
  ['companyIncorporationDate', 'dateOfIncorporation', 'Date of Incorporation', 'date'],
  ['companyCrExpiry', 'crExpiryDate', 'Commercial Registration Expiry Date', 'date'],
  ['companyCountry', 'countryOfIncorporation', 'Country of Incorporation', 'country'],
  ['companyPlace', 'placeOfIncorporation', 'Place of Incorporation', 'text'],
  ['companyLegalForm', 'legalForm', 'Legal Form', 'legalForm'],
  ['companyAddress', 'registeredOfficeAddress', 'Registered Office Address', 'textarea'],
  ['companyShareCapital', 'shareCapital', 'Share Capital', 'text'],
  ['companyTaxNo', 'taxIdentificationNo', 'Tax Card No (TIN)', 'text'],
  ['companyPoBox', 'poBox', 'PO Box Number', 'text'],
  ['companyTelephone', 'telephone', 'Telephone', 'text'],
  ['companyEmail', 'email', 'Email', 'text'],
  ['companyWebsite', 'website', 'Website', 'text'],
  ['companyNature', 'businessNature', 'Main Purpose / Nature of Business', 'textarea'],
  ['companyIndustry', 'relatedIndustry', 'Related Industry', 'text'],
  ['companyActivities', 'licenseActivities', 'License Activities', 'textarea'],
  ['companyFinancialYearEnd', 'financialYearEnd', 'Financial Year End', 'text'],
  ['companyAuditor', 'approvedAuditor', 'Approved Auditor Name', 'text']
] as const;
type CompanyProfileKey = (typeof companyProfileFields)[number][0];
// How the company details are grouped on the Details step.
const companyProfileGroups: Array<[string, CompanyProfileKey[]]> = [
  ['Registration', ['companyCrNumber', 'companyIncorporationDate', 'companyCrExpiry', 'companyCountry', 'companyPlace', 'companyLegalForm']],
  ['Contact', ['companyAddress', 'companyPoBox', 'companyTelephone', 'companyEmail', 'companyWebsite']],
  ['Business', ['companyNature', 'companyIndustry', 'companyActivities']],
  ['Financial', ['companyShareCapital', 'companyTaxNo', 'companyFinancialYearEnd', 'companyAuditor']]
];
type CompanyProfileForm = Record<CompanyProfileKey, string>;
const blankCompanyProfile = (): CompanyProfileForm => Object.fromEntries(companyProfileFields.map(([key]) => [key, ''])) as CompanyProfileForm;
const companyLegalForms = ['LLC', 'Branch', 'Partnership', 'Government entity', 'Registered in stock exchange', 'Trust/Funds', 'Sole establishment'];
// Positions of the people read from a CR, as chosen in the people list of the Attachments step.
const CR_ROLE_POSITIONS: Record<string, string> = {
  SHAREHOLDER: 'Shareholder', DIRECTOR: 'Director', MANAGER: 'Manager', SECRETARY: 'Secretary', AUTHORISED_SIGNATORY: 'Authorized Signatory',
  CHAIRMAN: 'Chairman', MANAGING_DIRECTOR: 'Managing Director', GENERAL_MANAGER: 'General Manager', CEO: 'CEO'
};

type EnquiryValidationForm = CompanyProfileForm & {
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
  jurisdictionOfRegistrationOther: string;
  countryOfIncorporation: string;
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

// How people read from a document are written into the enquiry's Ownership and Management steps.
const enquiryPeopleLayout: PeopleLayout = {
  get countries() { return countryOptions; },
  get positions() { return positionOptions; },
  nationalityAsText: true,
  newShareholder: () => blankPreliminaryOwner(),
  newOfficer: () => blankPreliminaryManagement(),
  setPositions: (row, positions) => ({ ...row, positions, position: positions.join(', ') }),
  positionsOf: (row) => (Array.isArray(row.positions) && row.positions.length ? row.positions : splitList(row.position))
};
const KEY_CONTACT_ID_DOCUMENT = 'Key Contact QID / Passport attachment';

const blankPreliminaryManagement = (): PreliminaryManagementPerson => ({ id: crypto.randomUUID(), fullName: '', identityNumber: '', nationality: '', position: '', positions: [] });

// The people of the enquiry (shareholders, beneficial owners, management, key contact) for "Same person as ..." and
// for keeping one person's details the same on all their rows. Enquiry rows keep nationality as "A, B"; the key
// contact has its own field names and a nationality list.
const enquiryPeople: PeopleAdapter<EnquiryValidationForm> = {
  read: (form) => {
    const shareholderIds = new Set(form.preliminaryShareholders.map((row) => row.id).filter(Boolean));
    const contact = {
      fullName: form.keyContactName, nationality: form.keyContactNationality, nationalityOther: form.keyContactNationalityOther,
      qidNumber: form.keyContactQidNumber, qidExpiry: form.keyContactQidExpiryDate, passportNumber: form.keyContactPassportNumber, passportExpiry: form.keyContactPassportExpiryDate
    };
    const proposed = form.enquiryType === 'PROPOSED_COMPANY';
    return [
      ...(proposed ? form.preliminaryShareholders.map((row, index) => ({ slot: `shareholders:${index}`, role: row.isUbo ? 'Shareholder, UBO' : 'Shareholder', row, source: row, hidden: row.shareholderType === 'Corporate Entity' })) : []),
      ...(proposed ? form.preliminaryUbos.map((row, index) => ({ slot: `ubos:${index}`, role: 'Beneficial owner', row, source: row, hidden: Boolean((row.id && shareholderIds.has(row.id)) || (row.sourceShareholderId && shareholderIds.has(row.sourceShareholderId))) })) : []),
      ...(proposed ? form.preliminaryManagement.map((row, index) => ({ slot: `management:${index}`, role: row.position || 'Management', row, source: row })) : []),
      { slot: 'contact', role: 'Key contact', row: contact, source: contact }
    ];
  },
  write: (form, slot, change) => {
    const [list, position] = slot.split(':');
    const index = Number(position);
    const rowChange = { ...change, ...('nationality' in change ? { nationality: toList(change.nationality).join(', ') } : {}) };
    if (list === 'shareholders') return { ...form, preliminaryShareholders: form.preliminaryShareholders.map((row, rowIndex) => (rowIndex === index ? withDerivedIdentity({ ...row, ...rowChange }) : row)) };
    if (list === 'ubos') return { ...form, preliminaryUbos: form.preliminaryUbos.map((row, rowIndex) => (rowIndex === index ? withDerivedIdentity({ ...row, ...rowChange }) : row)) };
    if (list === 'management') return { ...form, preliminaryManagement: form.preliminaryManagement.map((row, rowIndex) => (rowIndex === index ? withDerivedIdentity({ ...row, ...rowChange }) : row)) };
    if (list !== 'contact') return form;
    const next = { ...form };
    if ('fullName' in change) next.keyContactName = String(change.fullName ?? '');
    if ('nationality' in change) next.keyContactNationality = toList(change.nationality);
    if ('nationalityOther' in change) next.keyContactNationalityOther = String(change.nationalityOther ?? '');
    if ('qidNumber' in change) next.keyContactQidNumber = String(change.qidNumber ?? '');
    if ('qidExpiry' in change) next.keyContactQidExpiryDate = String(change.qidExpiry ?? '');
    if ('passportNumber' in change) next.keyContactPassportNumber = String(change.passportNumber ?? '');
    if ('passportExpiry' in change) next.keyContactPassportExpiryDate = String(change.passportExpiry ?? '');
    // Show the ID fields that now hold a number.
    const types = new Set(next.keyContactIdentityTypes);
    if (next.keyContactQidNumber.trim()) types.add('QID');
    if (next.keyContactPassportNumber.trim()) types.add('Passport');
    next.keyContactIdentityTypes = identityTypeOptions.filter((option) => types.has(option));
    return next;
  }
};


function attachmentTemplates(enquiryType: EnquiryType, proposedLegalForm = ''): AttachmentDraft[] {
  if (enquiryType === 'CURRENT_CLIENT_NEW_SERVICES') {
    return [{ documentType: 'Additional document upload 1', fileName: '' }];
  }
  const documentTypes = kycDocumentTypes;
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

// The key contact's position field from a person's positions: listed positions are selected, others go under "Other".
// "Contact Person" is the role itself, not a position.
function contactPositionPatch(positions: string[]) {
  const wanted = positions.filter((item) => item && item !== CONTACT_PERSON);
  const known = wanted.filter((item) => positionOptions.includes(item) && item !== 'Other');
  const other = wanted.filter((item) => !known.includes(item));
  return { keyContactPosition: [...known, ...(other.length ? ['Other'] : [])].join(', '), keyContactPositionOther: other.join(', ') };
}

function contactPositions(form: Pick<EnquiryValidationForm, 'keyContactPosition' | 'keyContactPositionOther'>) {
  return nationalityText(splitList(form.keyContactPosition), form.keyContactPositionOther);
}

function contactEmailError(value: string) {
  const email = value.trim();
  return email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ? 'Enter a valid email address, for example name@example.com.' : null;
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
      if (!form.jurisdictionOfRegistration || (form.jurisdictionOfRegistration === 'Other' && !form.jurisdictionOfRegistrationOther.trim())) return 'Jurisdiction of registration is required.';
      if (!form.countryOfIncorporation) return 'Country of incorporation is required.';
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
    const dialCode = countryDialOptions.find((country) => country.name === form.keyContactPhoneCountry)?.dialCode || '';
    const mobileNumber = form.keyContactPhone.trim();
    if (!/\d/.test(dialCode && mobileNumber.startsWith(dialCode) ? mobileNumber.slice(dialCode.length) : mobileNumber)) {
      return 'Key contact mobile number is required.';
    }
    if (!contactPositions(form)) {
      return 'Key contact position is required.';
    }
    if (splitList(form.keyContactPosition).includes('Other') && !form.keyContactPositionOther.trim()) return 'Specify the other contact position.';
    const emailError = contactEmailError(form.keyContactEmail);
    if (emailError) return emailError;
  }

  if (step === 'ownership' && form.enquiryType === 'PROPOSED_COMPANY') {
    if (!form.preliminaryShareholders.length || form.preliminaryShareholders.some((row) => !row.fullName.trim() || !row.ownershipPercentage.trim())) {
      return 'Add at least one proposed shareholder with name and ownership percentage.';
    }
    const percentages = form.preliminaryShareholders.map((row) => Number(row.ownershipPercentage));
    if (percentages.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      return 'Each shareholder ownership percentage must be a number between 0 and 100.';
    }
    // Parent companies hold a share of the company above them, so only direct shareholders count towards 100%.
    const total = directOwnershipTotal(form.preliminaryShareholders);
    if (Math.abs(total - 100) > 0.005) {
      return `Direct shareholder ownership must total 100%. Current total: ${total.toFixed(2)}%.`;
    }
    const overOwned = overOwnedCompanies(form.preliminaryShareholders, form.preliminaryUbos)[0];
    if (overOwned) {
      return `Owners of ${overOwned.name} add up to ${overOwned.total.toFixed(2)}%. The owners of one company cannot exceed 100%.`;
    }
    if (form.preliminaryUbos.some((row) => row.parentRowId && (!row.uboPercentage?.trim() || !Number.isFinite(Number(row.uboPercentage)) || Number(row.uboPercentage) < 0 || Number(row.uboPercentage) > 100))) {
      return 'Enter a UBO percentage between 0 and 100 for each beneficial owner linked to a corporate shareholder.';
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  // Guards against a double click and remembers an enquiry already created by this page, so a retry after a
  // failed upload updates that enquiry instead of creating a second one.
  const busyRef = useRef(false);
  const extractionQueue = useRef<Promise<unknown>>(Promise.resolve());
  const extractionPending = useRef(0);
  const documentReadings = useRef(new WeakMap<File, IntakeReading>());
  const savedExtractionFiles = useRef(new Map<string, File>());
  const previousEnquiryType = useRef<EnquiryType | null>(null);
  const [documentPeople, setDocumentPeople] = useState<DocumentPerson[]>([]);
  const createdIdRef = useRef<string | null>(null);
  const [duplicate, setDuplicate] = useState<EnquiryDuplicate | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeStep, setActiveStep] = useState<EnquiryStep>('type');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>(attachmentTemplates('EXISTING_LEGAL_ENTITY'));
  const [form, setFormState] = useState<EnquiryValidationForm>({
    ...blankCompanyProfile(),
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
    jurisdictionOfRegistrationOther: '',
    // QFC, MOCI and the free zones are all in Qatar, so new proposed companies start with Qatar (editable).
    countryOfIncorporation: 'Qatar',
    proposedBusinessActivity: '',
    sourceOfInitialCapital: '',
    proposedRegisteredOfficeAddress: '',
    preliminaryShareholders: [blankPreliminaryOwner()],
    preliminaryUbos: [blankPreliminaryOwner()],
    preliminaryManagement: [blankPreliminaryManagement()],
    preliminaryDeclaration: { fullName: '', position: '', date: '', authorizedSignature: '', authorizedSignatureDataUrl: '', companyStamp: '', companyStampDataUrl: '' },
    notes: ''
  });
  // Every form change goes through here so a person's details stay the same on all their rows (linked by QID / passport).
  const setForm = useCallback((value: SetStateAction<EnquiryValidationForm>) => {
    setFormState((current) => syncLinkedPeople(current, typeof value === 'function' ? value(current) : value, enquiryPeople));
  }, []);
  const people = useMemo(() => enquiryPeople.read(form), [form]);
  const availableDocumentPeople = useMemo(() => {
    const names = new Set(attachments.flatMap(attachmentDisplayNames));
    return documentPeople.filter(person => !person.files.length || person.files.some(file => names.has(file)));
  }, [documentPeople, attachments]);
  // Every person added on the Attachments step can be picked, whether or not a QID / passport copy is uploaded yet.
  const documentSlot = (person: DocumentPerson) => ({
    slot: `document:${person.id}`,
    role: person.files.length ? `Uploaded document: ${person.row.qidNumber || person.row.passportNumber || person.files[0] || ''}` : (person.positions || []).join(', ') || 'Added on Attachments',
    row: person.row
  });
  const selectablePeople = useMemo(() => [...availableDocumentPeople.filter(person => (person.row.fullName || '').trim()).map(documentSlot), ...people], [people, availableDocumentPeople]);
  // The Contact step offers the people marked "Contact Person" on the Attachments step (everyone when nobody is marked yet),
  // plus the key contact already on the form so the current choice stays shown.
  const contactChoices = useMemo(() => {
    const named = availableDocumentPeople.filter(person => (person.row.fullName || '').trim());
    const marked = named.filter(person => person.positions?.includes(CONTACT_PERSON));
    return [...(marked.length ? marked : named).map(documentSlot), ...people.filter(person => person.slot === 'contact')];
  }, [people, availableDocumentPeople]);
  // The people shown on the Attachments step: the people added there, with their QID and passport copies.
  const attachmentPeople = useMemo(() => {
    const names = new Set(attachments.filter((attachment) => attachment.documentType === PEOPLE_DOCUMENT).flatMap(attachmentDisplayNames));
    return documentPeople.filter((person) => !person.files.length || person.files.some((file) => names.has(file))).map((person) => {
      const files = person.files.filter((file) => names.has(file));
      return {
        id: person.id,
        fullName: person.row.fullName || '',
        qidNumber: person.row.qidNumber || '',
        passportNumber: person.row.passportNumber || '',
        dateOfBirth: person.row.dateOfBirth || '',
        nationality: person.row.nationality || '',
        ownershipPercentage: person.row.ownershipPercentage || '',
        positions: person.positions || [],
        qidFiles: files.filter((file) => person.kinds?.[file] === 'QID'),
        passportFiles: files.filter((file) => person.kinds?.[file] === 'PASSPORT'),
        otherFiles: files.filter((file) => !person.kinds?.[file])
      };
    });
  }, [documentPeople, attachments]);
  // A Contact Person is copied to the Contact step only while it is empty; say when another contact is already there.
  const contactPersonNote = useMemo(() => {
    const chosen = documentPeople.filter((person) => person.positions?.includes(CONTACT_PERSON) && attachmentPeople.some((item) => item.id === person.id));
    const contactKeys = personKeys({ qidNumber: form.keyContactQidNumber, passportNumber: form.keyContactPassportNumber });
    const clash = chosen.find((person) => form.keyContactName.trim() && form.keyContactName.trim().toLowerCase() !== (person.row.fullName || '').trim().toLowerCase() && !personKeys(person.row).some((key) => contactKeys.includes(key)));
    return clash ? `The key contact on the Contact step is ${form.keyContactName.trim()}. ${clash.row.fullName || 'This person'} was not copied there.` : '';
  }, [documentPeople, attachmentPeople, form.keyContactName, form.keyContactQidNumber, form.keyContactPassportNumber]);
  // The key contact's identity copies, grouped by what they are (QID, passport, or unknown for older uploads).
  const contactCopies = useMemo(() => {
    const keys = personKeys({ qidNumber: form.keyContactQidNumber, passportNumber: form.keyContactPassportNumber });
    const attached = new Set(attachments.flatMap(attachmentDisplayNames));
    const matched = availableDocumentPeople.filter(person => personKeys(person.row).some(key => keys.includes(key)));
    const kindOf = (name: string) => matched.map(person => person.kinds?.[name]).find(Boolean);
    const names = [...new Set(matched.flatMap(person => person.files))].filter(name => attached.has(name));
    return {
      all: names,
      qid: names.filter(name => kindOf(name) === 'QID'),
      passport: names.filter(name => kindOf(name) === 'PASSPORT'),
      other: names.filter(name => !kindOf(name))
    };
  }, [availableDocumentPeople, attachments, form.keyContactQidNumber, form.keyContactPassportNumber]);
  // The latest form for reads that finish after the user kept typing.
  const formRef = useRef(form);
  formRef.current = form;
  const peopleLink = useMemo<PeopleLink>(() => ({
    people: selectablePeople,
    pickerLabel: 'Select person',
    slotOf: (row) => people.find((person) => person.source === row)?.slot,
    // Picking copies the chosen person's details onto the row; it is not a change to sync to other rows.
    pick: (slot, sourceSlot) => setFormState((current) => {
      if (!sourceSlot) {
        const next = enquiryPeople.write(current, slot, { ...Object.fromEntries(PERSON_FIELDS.map(field => [field, ''])), identityNumber: '', address: '' });
        return slot === 'contact' ? { ...next, keyContactEmail: '', keyContactPhone: '', keyContactIdentityNumber: '', keyContactIdentityTypes: [], ...contactPositionPatch([]) } : next;
      }
      const source = [...enquiryPeople.read(current), ...selectablePeople.filter(person => person.slot.startsWith('document:'))].find((person) => person.slot === sourceSlot);
      if (!source || sourceSlot === slot) return current;
      // Every person switch replaces identity fields, regardless of whether the source was uploaded or entered.
      const change = { ...Object.fromEntries(PERSON_FIELDS.map(field => [field, ''])), identityNumber: String(('identityNumber' in source.row ? source.row.identityNumber : '') || ''), ...personDetails(source.row) };
      const next = enquiryPeople.write(current, slot, change);
      if (slot === 'contact') {
        next.keyContactIdentityTypes = identityTypeOptions.filter(type => type === 'QID' ? Boolean(next.keyContactQidNumber) : Boolean(next.keyContactPassportNumber));
        // The person's positions (chosen on the Attachments step, or on their ownership / management row) fill the position.
        const chosen = sourceSlot.startsWith('document:')
          ? documentPeopleRef.current.find(person => `document:${person.id}` === sourceSlot)?.positions || []
          : splitList((source.row as Record<string, unknown>).positions ?? (source.row as Record<string, unknown>).position ?? (source.row as Record<string, unknown>).role ?? '');
        Object.assign(next, contactPositionPatch(chosen.map(item => item === 'Beneficial owner' ? 'UBO' : item)));
      }
      return next;
    })
  }), [people, selectablePeople]);

  const [declarationFiles, setDeclarationFiles] = useState<{ authorizedSignature?: File; companyStamp?: File }>({});

  useEffect(() => {
    if (authLoading) return;
    // The client list only feeds the "Current client" picker. Roles without Clients access in the role matrix
    // (for example AML Team / AML Supervisor) get 403 from /clients; that must not block loading the enquiry itself.
    Promise.all([listClients().catch(() => null), id ? getEnquiry(id) : Promise.resolve(null)])
      .then(([clientItems, enquiry]) => {
        const linkedClient = enquiry?.client ? [enquiry.client] : [];
        setClients(clientItems ?? linkedClient);
        if (!enquiry) return;
        if (!canEditEnquiryRecord(user, enquiry)) {
          navigate(`/enquiries/${id}`, { replace: true });
          return;
        }
        const details = enquiry.details || {};
        setDocumentPeople(restoreDocumentPeople(details.documentPeople));
        const keyContactPosition = splitNationalities(enquiry.keyContactPosition, positionOptions);
        const keyContactNationality = splitNationalities(details.keyContactNationality, nationalityOptions);
        const proposedLegalForm = splitOtherValue(String(details.proposedLegalForm || ''), legalForms);
        const requestedServices = splitRequestedServices(enquiry.requestedServices || []);
        const preliminary = details.preliminaryKyc && typeof details.preliminaryKyc === 'object' ? details.preliminaryKyc as Record<string, any> : {};
        const savedProfile = details.companyProfile && typeof details.companyProfile === 'object' ? details.companyProfile as Record<string, unknown> : {};
        setForm({
          ...blankCompanyProfile(),
          ...Object.fromEntries(companyProfileFields.map(([key, detail]) => [key, String(savedProfile[detail] ?? '')])) as CompanyProfileForm,
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
          keyContactPosition: keyContactPosition.value.join(', '),
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
          jurisdictionOfRegistration: splitOtherValue(String(details.jurisdictionOfRegistration || ''), jurisdictions).value,
          jurisdictionOfRegistrationOther: splitOtherValue(String(details.jurisdictionOfRegistration || ''), jurisdictions).otherValue,
          // Enquiries saved before this field existed show Qatar when a (Qatari) jurisdiction is already chosen.
          countryOfIncorporation: String(details.countryOfIncorporation || (details.preliminaryKyc as Record<string, unknown> | undefined)?.countryOfIncorporation || (details.jurisdictionOfRegistration ? 'Qatar' : '')),
          proposedBusinessActivity: String(details.proposedBusinessActivity || ''),
          sourceOfInitialCapital: String(details.sourceOfInitialCapital || ''),
          proposedRegisteredOfficeAddress: String(details.proposedRegisteredOfficeAddress || ''),
          preliminaryShareholders: Array.isArray(preliminary.shareholders) && preliminary.shareholders.length ? (preliminary.shareholders as PreliminaryOwner[]).map((row) => withSplitIdentity({ ...row, id: row.id || crypto.randomUUID() })) : [blankPreliminaryOwner()],
          preliminaryUbos: Array.isArray(preliminary.ubos) && preliminary.ubos.length ? (preliminary.ubos as PreliminaryOwner[]).map((row) => withSplitIdentity({ ...row, id: row.id || crypto.randomUUID() })) : [blankPreliminaryOwner()],
          preliminaryManagement: Array.isArray(preliminary.management) && preliminary.management.length ? (preliminary.management as PreliminaryManagementPerson[]).map((row) => withSplitIdentity({ ...row, id: row.id || crypto.randomUUID() })) : [blankPreliminaryManagement()],
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
  }, [id, authLoading]);

  // Warn while typing if another open enquiry already exists for this company (or client), before anything is saved.
  const duplicateName = form.enquiryType === 'PROPOSED_COMPANY' ? form.proposedCompanyName : form.companyName;
  useEffect(() => {
    let active = true;
    const name = duplicateName.trim();
    const byClient = form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES';
    if (byClient ? !form.clientId : name.length < 2) { setDuplicate(null); return; }
    const timer = window.setTimeout(() => {
      checkEnquiryDuplicate({ enquiryType: form.enquiryType, name: byClient ? undefined : name, clientId: byClient ? form.clientId : undefined, excludeId: id || createdIdRef.current || undefined })
        .then((found) => { if (active) setDuplicate(found); })
        .catch(() => { if (active) setDuplicate(null); });
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [form.enquiryType, duplicateName, form.clientId, id]);

  function buildPayload(completed: boolean): EnquiryPayload {
    const keyContactDetails =
      form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES'
        ? {}
        : {
            documentPeople: availableDocumentPeople,
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
            jurisdictionOfRegistration: resolveOtherValue(form.jurisdictionOfRegistration, form.jurisdictionOfRegistrationOther),
            countryOfIncorporation: form.countryOfIncorporation,
            proposedBusinessActivity: form.proposedBusinessActivity,
            sourceOfInitialCapital: form.sourceOfInitialCapital,
            proposedRegisteredOfficeAddress: form.proposedRegisteredOfficeAddress,
            preliminaryKyc: {
              companyName: form.proposedCompanyName,
              proposedLegalForm: resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther),
              jurisdiction: resolveOtherValue(form.jurisdictionOfRegistration, form.jurisdictionOfRegistrationOther),
              countryOfIncorporation: form.countryOfIncorporation,
              businessActivity: form.proposedBusinessActivity,
              registeredOfficeAddress: form.proposedRegisteredOfficeAddress,
              sourceOfFunds: form.sourceOfInitialCapital,
              expectedBusiness: resolvedRequestedServices(form),
              shareholders: form.preliminaryShareholders,
              ubos: form.preliminaryUbos,
              management: form.preliminaryManagement.map((row) => ({ ...row, position: row.positions?.length ? row.positions.map((item) => (item === 'Other' ? row.positionOther?.trim() || '' : item)).filter(Boolean).join(', ') : row.position })),
              contact: {
                fullName: form.keyContactName,
                position: contactPositions(form),
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
        : form.enquiryType === 'EXISTING_LEGAL_ENTITY'
          ? { ...keyContactDetails, companyProfile: Object.fromEntries(companyProfileFields.map(([key, detail]) => [detail, form[key].trim()]).filter(([, value]) => value)) }
          : keyContactDetails;
    return {
      enquiryType: form.enquiryType,
      clientId: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? form.clientId || undefined : undefined,
      companyName: form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? form.companyName : undefined,
      proposedCompanyName: form.enquiryType === 'PROPOSED_COMPANY' ? form.proposedCompanyName : undefined,
      requestedServices: resolvedRequestedServices(form),
      keyContactName: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : form.keyContactName || undefined,
      keyContactEmail: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : form.keyContactEmail.trim() || undefined,
      keyContactPhone: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : form.keyContactPhone || undefined,
      keyContactPosition: form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : contactPositions(form) || undefined,
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
    const emailError = form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? null : contactEmailError(form.keyContactEmail);
    if (emailError) { setError(emailError); setActiveStep('contact'); return; }
    if (extractionPending.current) { setError('Wait for the attachments to finish processing before saving.'); return; }
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setError('');
    setSuccess('');
    let savedCode = '';
    try {
      const targetId = id || createdIdRef.current;
      const enquiry = targetId ? await updateEnquiry(targetId, buildPayload(false)) : await createEnquiry(buildPayload(false));
      createdIdRef.current = enquiry.id;
      savedCode = enquiry.enquiryCode;
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
      setError(savedError(savedCode, getRequestErrorMessage(requestError, 'Unable to save enquiry draft.')));
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (extractionPending.current) { setError('Wait for the attachments to finish processing before submitting.'); return; }
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setError('');
    setSuccess('');

    const validationError = validateEnquiryForm(form);
    if (validationError) {
      setError(validationError.message);
      setActiveStep(validationError.step);
      busyRef.current = false;
      setSaving(false);
      return;
    }

    const payload = buildPayload(true);
    let savedCode = '';

    try {
      const targetId = id || createdIdRef.current;
      const enquiry = targetId ? await updateEnquiry(targetId, payload) : await createEnquiry(payload);
      createdIdRef.current = enquiry.id;
      savedCode = enquiry.enquiryCode;
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
      setError(savedError(savedCode, getRequestErrorMessage(requestError, `Unable to ${isEditMode ? 'update' : 'create'} enquiry.`)));
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  // The enquiry itself was saved but a later step (an attachment upload) failed: say so, so nobody creates it again.
  function savedError(code: string, message: string) {
    if (!code || id) return message;
    return `Enquiry ${code} was saved, but this step failed: ${message} Press the button again to retry - it updates ${code} and does not create a new enquiry.`;
  }

  useEffect(() => {
    if (loading) return;
    const previous = previousEnquiryType.current;
    previousEnquiryType.current = form.enquiryType;
    if (!previous || previous === form.enquiryType || form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES') return;
    let cancelled = false;
    extractionPending.current += 1;
    setSuccess('Applying attached documents to the selected enquiry type...');
    const replay = async () => {
      const warnings: string[] = [];
      for (const attachment of attachments) {
        if (cancelled) break;
        if (/signature|stamp|screening|crrf/i.test(attachment.documentType)) continue;
        const files = [...(attachment.files || [])];
        for (const stored of attachment.storedFiles || fallbackStoredFiles(attachment)) {
          if (!stored.id || !id || files.some(file => file.name === stored.fileName)) continue;
          if (!/\.(pdf|png|jpe?g|webp)$/i.test(stored.fileName)) continue;
          if (stored.size && stored.size > 10 * 1024 * 1024) { warnings.push(`${stored.fileName}: too large to extract; enter details manually.`); continue; }
          try {
            let file = savedExtractionFiles.current.get(stored.id);
            if (!file) {
              file = await getEnquiryAttachmentFile(id, { id: stored.id, fileName: stored.fileName, mimeType: stored.mimeType });
              savedExtractionFiles.current.set(stored.id, file);
            }
            files.push(file);
          } catch { warnings.push(`${stored.fileName}: unable to read the saved copy.`); }
        }
        if (cancelled || !files.length) continue;
        const result = await readAttachment(attachment.documentType, files);
        if (result?.tone === 'warn') warnings.push(result.text);
      }
      if (!cancelled) {
        setSuccess('Attached document details applied to the selected enquiry type. Existing entries were kept.');
        if (warnings.length) setError(warnings.join(' '));
      }
    };
    void replay().catch(() => { if (!cancelled) setError('Some attached documents could not be applied. Enter the missing details manually.'); })
      .finally(() => { extractionPending.current -= 1; });
    return () => { cancelled = true; };
  }, [form.enquiryType, loading]);

  const placementLayout: PlacementLayout = useMemo(() => ({
    newShareholder: () => blankPreliminaryOwner(),
    newOfficer: () => blankPreliminaryManagement(),
    setPositions: enquiryPeopleLayout.setPositions,
    positionsOf: enquiryPeopleLayout.positionsOf,
    nationality: (value) => matchOption(value, countryOptions) || value
  }), []);

  const documentPeopleRef = useRef<DocumentPerson[]>([]);
  useEffect(() => { documentPeopleRef.current = documentPeople; }, [documentPeople]);
  const [peopleNote, setPeopleNote] = useState<FillOutcome | undefined>();
  const [peopleReadingId, setPeopleReadingId] = useState('');

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

  // Existing-company CR files added on the Attachments step still reuse the company reader.
  async function applyIntake(application: IntakeApplication) {
    if (busyRef.current) throw new Error('Wait for the current save to finish.');
    const current = formRef.current;
    let next = current;
    if (application.kind === 'COMPANY') {
      const change = reviewedPatch(current as unknown as Record<string, unknown>, application.fields);
      next = { ...current, ...change };
      if (application.people.length && current.enquiryType === 'PROPOSED_COMPANY') {
        const found = addPeopleFromDocument(application.people, current.preliminaryShareholders, current.preliminaryManagement, { ...enquiryPeopleLayout, preservePartialRows: true });
        next = { ...next, preliminaryShareholders: found.shareholders.map(withDerivedIdentity) as PreliminaryOwner[], preliminaryManagement: found.officers.map(withDerivedIdentity) as PreliminaryManagementPerson[] };
      }
    } else {
      if (application.target.startsWith('new:')) {
        if (current.enquiryType !== 'PROPOSED_COMPANY' || !newIntakePersonTargets.some(target => target.value === application.target)) throw new Error('Choose a person on this enquiry.');
        const patch = reviewedPatch({}, application.fields);
        if (application.target === 'new:shareholder' || application.target === 'new:ubo') {
          const row = withDerivedIdentity({ ...blankPreliminaryOwner(), ...patch, isUbo: application.target === 'new:ubo' });
          next = application.target === 'new:ubo' ? { ...current, preliminaryUbos: appendReviewedPerson(current.preliminaryUbos, row) } : { ...current, preliminaryShareholders: appendReviewedPerson(current.preliminaryShareholders, row) };
        } else {
          const position = application.target === 'new:director' ? 'Director' : 'Manager';
          const row = withDerivedIdentity({ ...blankPreliminaryManagement(), ...patch, position, positions: [position] });
          next = { ...current, preliminaryManagement: appendReviewedPerson(current.preliminaryManagement, row) };
        }
      } else {
      const target = enquiryPeople.read(current).find(person => person.slot === application.target);
      if (!target || JSON.stringify(target.row) !== JSON.stringify(application.expectedPerson)) throw new Error('This person changed while the document was processing. Try this file again.');
      next = applyAutomaticIdentity(current, enquiryPeople, application.target, application.fields);
      }
    }
    formRef.current = next;
    setFormState(next);
    setSuccess('Document details filled automatically. Save the enquiry to keep the details and attachments.');
  }

  async function viewContactCopy(name: string) {
    const pending = attachments.flatMap(attachment => attachment.files || []).find(file => file.name === name);
    if (pending) {
      const url = URL.createObjectURL(pending);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    const saved = attachments.flatMap(attachment => attachment.storedFiles || fallbackStoredFiles(attachment)).find(file => file.fileName === name && file.id);
    if (!saved?.id || !id) { setError('This copy is not available. Check the Attachments step.'); return; }
    try { await viewEnquiryAttachment(id, { id: saved.id, fileName: saved.fileName, mimeType: saved.mimeType }); }
    catch (error) { setError(getRequestErrorMessage(error, 'Unable to open this identity copy.')); }
  }

  // Serialize batches so later files use the latest form and cannot overwrite earlier extraction.
  async function readAttachment(documentType: string, files: File[]): Promise<FillOutcome | null> {
    if (formRef.current.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES') return null;
    if (/signature|stamp|screening|crrf/i.test(documentType)) return null;
    extractionPending.current += 1;
    const task = extractionQueue.current.then(async (): Promise<FillOutcome> => {
      const notes: string[] = [];
      let warning = false;
      for (const file of files) {
        if (validateIntakeFile(file)) { warning = true; notes.push(`${file.name}: added; enter its details manually.`); continue; }
        try {
          const companyDocument = /Commercial Registration|Corporate Documents - Company|Entity Card|Certificate of Incorporation|Articles of Association|Tax Card|CR of legal entity parties/i.test(documentType);
          let reading = documentReadings.current.get(file);
          if (!reading) {
            reading = await readIntakeDocument(file, companyDocument ? 'COMPANY' : 'AUTO', readEnquiryCompanyDocument, readEnquiryIdentityDocument);
            documentReadings.current.set(file, reading);
          }
          if (reading.kind === 'IDENTITY') {
            setDocumentPeople(current => mergeDocumentPerson(current, reading.data, file.name));
            notes.push(`${file.name}: person available to select in the form.`);
            continue;
          }
          const current = formRef.current;
          const outcome = automaticIntakeApplication(reading, {
            file, company: current as unknown as Record<string, unknown>,
            companyTargets: current.enquiryType === 'PROPOSED_COMPANY' ? [
              { field: 'legalName', key: 'proposedCompanyName', label: 'Proposed company name' },
              { field: 'legalForm', key: 'proposedLegalForm', label: 'Legal form', options: legalForms, otherKey: 'proposedLegalFormOther' },
              { field: 'countryOfIncorporation', key: 'countryOfIncorporation', label: 'Country of incorporation', options: countryOptions },
              { field: 'licenseActivities', key: 'proposedBusinessActivity', label: 'Business activity' },
              { field: 'registeredOfficeAddress', key: 'proposedRegisteredOfficeAddress', label: 'Registered office address' }
            ] : [
              { field: 'legalName', key: 'companyName', label: 'Company name' },
              { field: 'commercialRegistrationNo', key: 'companyCrNumber', label: 'Commercial registration no' },
              { field: 'dateOfIncorporation', key: 'companyIncorporationDate', label: 'Date of incorporation' },
              { field: 'crExpiryDate', key: 'companyCrExpiry', label: 'CR expiry date' },
              { field: 'countryOfIncorporation', key: 'companyCountry', label: 'Country of incorporation', options: countryOptions },
              { field: 'placeOfIncorporation', key: 'companyPlace', label: 'Place of incorporation' },
              { field: 'legalForm', key: 'companyLegalForm', label: 'Legal form' },
              { field: 'registeredOfficeAddress', key: 'companyAddress', label: 'Registered office address' },
              { field: 'shareCapital', key: 'companyShareCapital', label: 'Share capital' },
              { field: 'taxIdentificationNo', key: 'companyTaxNo', label: 'Tax card no' },
              { field: 'licenseActivities', key: 'companyActivities', label: 'License activities' },
              { field: 'countryOfIncorporation', key: 'headOfficeCountry', label: 'Head office country', options: countryOptions }
            ],
            peopleEnabled: current.enquiryType === 'PROPOSED_COMPANY',
            targets: [...enquiryPeople.read(current).filter(person => !person.hidden).map(person => ({ value: person.slot, label: person.row.fullName || person.role, row: person.row, omitFields: person.slot === 'contact' ? ['dateOfBirth'] : [], nationalityOptions: countryOptions })), ...(current.enquiryType === 'PROPOSED_COMPANY' ? newIntakePersonTargets.map(target => ({ ...target, nationalityOptions: countryOptions })) : [])]
          });
          // An existing company has no Ownership / Management steps: the owners and managers on its CR become people
          // cards on the Attachments step, where their QID / passport is added and the positions are kept.
          if (reading.kind === 'COMPANY' && current.enquiryType !== 'PROPOSED_COMPANY' && documentType !== 'CR of legal entity parties') {
            const added = reading.data.people.filter(person => person.fullName.trim() && person.roles.some(role => CR_ROLE_POSITIONS[role]));
            if (added.length) {
              updateDocumentPeople(currentPeople => {
                let next = currentPeople;
                for (const person of added) {
                  const number = (person.idNumber || '').replace(/\s+/g, '');
                  const identity = number ? (/^\d{11}$/.test(number) ? { qidNumber: number } : { passportNumber: number }) : {};
                  const positions = [...new Set(person.roles.map(role => CR_ROLE_POSITIONS[role]).filter(Boolean))];
                  const same = next.find(item => (number && (item.row.qidNumber === number || item.row.passportNumber === number)) || (item.row.fullName || '').trim().toLowerCase() === person.fullName.trim().toLowerCase());
                  const row = { fullName: person.fullName.trim(), ...(person.nationality ? { nationality: matchOption(person.nationality, countryOptions) || person.nationality } : {}), ...identity, ...(person.sharePercentage ? { ownershipPercentage: person.sharePercentage } : {}) };
                  next = same
                    ? next.map(item => item === same ? { ...item, positions: [...new Set([...(item.positions || []), ...positions])], row: { ...row, ...Object.fromEntries(Object.entries(item.row).filter(([, value]) => Boolean(value))) } } : item)
                    : [...next, { id: crypto.randomUUID(), files: [], row, positions }];
                }
                return next;
              });
              notes.push(`${added.length} owner / manager${added.length === 1 ? '' : 's'} from the CR added under People on this step.`);
            }
          }
          if (outcome.application) {
            // Corporate shareholder copies must not populate the applicant company's own details.
            if (documentType === 'CR of legal entity parties' && outcome.application.kind === 'COMPANY') outcome.application.fields = [];
            await applyIntake(outcome.application);
          } else warning = true;
          notes.push(`${file.name}: ${outcome.note}`);
        } catch { warning = true; notes.push(`${file.name}: added, but details could not be read. Enter them manually.`); }
      }
      return { tone: warning ? 'warn' : 'ok', text: notes.join(' ') };
    });
    extractionQueue.current = task.catch(() => undefined);
    try { return await task; } finally { extractionPending.current -= 1; }
  }

  // ---- People on the Attachments step: each person's QID / passport and their positions ----
  // Writes a person's positions to the form: ownership and management rows (proposed company) and the key contact.
  function placeDocumentPerson(person: DocumentPerson, positions: string[], before?: DocumentPerson) {
    setForm((current) => {
      let next = current;
      if (current.enquiryType === 'PROPOSED_COMPANY') {
        const placed = placePerson({ shareholders: current.preliminaryShareholders, ubos: current.preliminaryUbos, management: current.preliminaryManagement }, person, positions, placementLayout, before);
        next = {
          ...next,
          preliminaryShareholders: (placed.shareholders.length ? placed.shareholders : [blankPreliminaryOwner()]).map(withDerivedIdentity) as PreliminaryOwner[],
          preliminaryUbos: placed.ubos.map(withDerivedIdentity) as PreliminaryOwner[],
          preliminaryManagement: (placed.management.length ? placed.management : [blankPreliminaryManagement()]).map(withDerivedIdentity) as PreliminaryManagementPerson[]
        };
      }
      if (positions.includes(CONTACT_PERSON)) {
        // The key contact is filled only when it is empty or already this person; another contact is never overwritten.
        const name = person.row.fullName || '';
        const sameName = (next.keyContactName || '').trim().toLowerCase() === name.trim().toLowerCase();
        const keys = personKeys({ qidNumber: next.keyContactQidNumber, passportNumber: next.keyContactPassportNumber });
        const sameKey = personKeys(person.row).some((key) => keys.includes(key));
        if (!next.keyContactName.trim() || sameName || sameKey) {
          const patch: Record<string, unknown> = {};
          const set = (key: string, value: string | undefined, existing: string) => { if (value && !existing.trim()) patch[key] = value; };
          set('fullName', person.row.fullName, next.keyContactName);
          set('qidNumber', person.row.qidNumber, next.keyContactQidNumber);
          set('qidExpiry', person.row.qidExpiry, next.keyContactQidExpiryDate);
          set('passportNumber', person.row.passportNumber, next.keyContactPassportNumber);
          set('passportExpiry', person.row.passportExpiry, next.keyContactPassportExpiryDate);
          if (!next.keyContactPosition.trim() && !next.keyContactPositionOther.trim()) next = { ...next, ...contactPositionPatch(positions) };
          if (person.row.nationality && !next.keyContactNationality.length) patch.nationality = [matchOption(person.row.nationality, countryOptions) || person.row.nationality];
          if (Object.keys(patch).length) next = enquiryPeople.write(next, 'contact', patch);
        }
      }
      return next;
    });
  }

  function updateDocumentPeople(change: (current: DocumentPerson[]) => DocumentPerson[]) {
    const next = change(documentPeopleRef.current);
    documentPeopleRef.current = next;
    setDocumentPeople(next);
    return next;
  }

  // A new, empty person card: the name, copies and positions are filled on it.
  function addPerson() {
    updateDocumentPeople((current) => [...current, blankDocumentPerson()]);
  }

  // Removing a person also removes their copies and the rows written for them (rows with entered data stay).
  function removePerson(personId: string) {
    const person = documentPeopleRef.current.find((item) => item.id === personId);
    if (!person) return;
    setAttachments((current) => current.map((attachment) => {
      if (attachment.documentType !== PEOPLE_DOCUMENT) return attachment;
      return person.files.reduce((result, fileName) => {
        const index = attachmentDisplayNames(result).indexOf(fileName);
        return index >= 0 ? removeAttachmentFile(result, index) : result;
      }, attachment);
    }));
    updateDocumentPeople((current) => current.filter((item) => item.id !== personId));
    if (person.positions?.length) placeDocumentPerson(person, []);
  }

  // A copy uploaded to a person's QID or passport slot is read into that person.
  async function addPersonFiles(personId: string, kind: 'QID' | 'PASSPORT', files: File[]) {
    const fresh = files.filter((file) => !documentPeopleRef.current.some((person) => person.files.includes(file.name)));
    if (!fresh.length) { setPeopleNote({ tone: 'warn', text: 'These files are already added to a person.' }); return; }
    setAttachments((current) => setAttachmentFilesByType(current, PEOPLE_DOCUMENT, fresh));
    setPeopleReadingId(`${personId}:${kind}`);
    extractionPending.current += 1;
    const task = extractionQueue.current.then(async () => {
      const notes: string[] = [];
      let warning = false;
      for (const file of fresh) {
        let reading: IntakeReading | null = null;
        if (validateIntakeFile(file)) warning = true;
        else {
          try {
            reading = documentReadings.current.get(file) || null;
            if (!reading) { reading = await readIntakeDocument(file, kind, readEnquiryCompanyDocument, readEnquiryIdentityDocument); documentReadings.current.set(file, reading); }
          } catch { reading = null; }
        }
        const identity = reading?.kind === 'IDENTITY' ? reading.data : null;
        updateDocumentPeople((current) => {
          const merged = identity ? mergeDocumentPersonInto(current, personId, identity, file.name) : current.map((person) => person.id === personId ? { ...person, files: [...new Set([...person.files, file.name])] } : person);
          return merged.map((person) => person.id === personId ? { ...person, kinds: { ...(person.kinds || {}), [file.name]: kind } } : person);
        });
        if (!identity) warning = true;
        notes.push(identity ? `${file.name}: details read.` : `${file.name}: added; type the name and check the details.`);
      }
      // A person who already has positions gets the newly read details on their rows.
      const person = documentPeopleRef.current.find((item) => item.id === personId);
      if (person?.positions?.length) placeDocumentPerson(person, person.positions);
      return { tone: warning ? 'warn' : 'ok', text: notes.join(' ') } as FillOutcome;
    });
    extractionQueue.current = task.catch(() => undefined);
    try { setPeopleNote(await task); } catch { setPeopleNote({ tone: 'warn', text: 'The files were added, but their details could not be read. Type the name in.' }); }
    finally { extractionPending.current -= 1; setPeopleReadingId(''); }
  }

  function setPersonPositions(personId: string, positions: string[]) {
    const before = documentPeopleRef.current.find((person) => person.id === personId);
    if (!before) return;
    const next = updateDocumentPeople((current) => current.map((person) => person.id === personId ? { ...person, positions } : person)).find((person) => person.id === personId);
    if (next) placeDocumentPerson(next, positions, before);
  }

  function setPersonName(personId: string, fullName: string) {
    const before = documentPeopleRef.current.find((person) => person.id === personId);
    if (!before) return;
    const next = updateDocumentPeople((current) => current.map((person) => person.id === personId ? { ...person, row: { ...person.row, fullName } } : person)).find((person) => person.id === personId);
    if (next?.positions?.length) placeDocumentPerson(next, next.positions, before);
  }

  // Removing one copy keeps the person.
  function removePersonFile(personId: string, fileName: string) {
    setAttachments((current) => current.map((attachment) => {
      if (attachment.documentType !== PEOPLE_DOCUMENT) return attachment;
      const index = attachmentDisplayNames(attachment).indexOf(fileName);
      return index >= 0 ? removeAttachmentFile(attachment, index) : attachment;
    }));
    updateDocumentPeople((current) => current.map((item) => item.id === personId ? { ...item, files: item.files.filter((name) => name !== fileName) } : item));
  }

  // The declaration is usually signed by someone already entered (director, signatory).
  function pickDeclarationSigner(slot: string) {
    const person = people.find((item) => item.slot === slot);
    if (!person) return;
    const position = String(person.row.position || '').trim() || person.role;
    setForm((current) => ({ ...current, preliminaryDeclaration: { ...current.preliminaryDeclaration, fullName: person.row.fullName || current.preliminaryDeclaration.fullName, position } }));
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
    <PeopleLinkContext.Provider value={peopleLink}>
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
      {duplicate ? (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-semibold">Possible duplicate.</span> {duplicate.message}</p>
          <Link to={`/enquiries/${duplicate.id}`} className="shrink-0 self-start rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">Open {duplicate.enquiryCode}</Link>
        </div>
      ) : null}
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
                  if (extractionPending.current) { setError('Wait for the attachments to finish processing before changing enquiry type.'); return; }
                  const enquiryType = value as EnquiryType;
                  setForm({ ...form, enquiryType });
                  setAttachments(mergeAttachmentTemplates(enquiryType, resolveOtherValue(form.proposedLegalForm, form.proposedLegalFormOther), attachments));
                  setActiveStep('attachments');
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

              {form.enquiryType === 'EXISTING_LEGAL_ENTITY' ? (
                <section aria-labelledby="company-details" className="space-y-3 md:col-span-2">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 id="company-details" className="text-sm font-semibold text-slate-900">Company details</h3>
                      <p className="mt-0.5 text-xs text-slate-500">Filled from the Commercial Registration on the Attachments step. Check them and complete what is missing; they carry into the KYC.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{companyProfileFields.filter(([key]) => form[key].trim()).length} of {companyProfileFields.length} filled</span>
                  </div>
                  {companyProfileGroups.map(([title, keys]) => (
                    <fieldset key={title} className="rounded-lg border border-slate-200 bg-white p-3">
                      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
                      <div className="grid gap-x-3 gap-y-2.5 md:grid-cols-2 lg:grid-cols-3">
                        {companyProfileFields.filter(([key]) => keys.includes(key)).map(([key, , label, kind]) => (
                          <label key={key} className={`block min-w-0 text-xs font-medium text-slate-600 ${kind === 'textarea' ? 'md:col-span-2 lg:col-span-3' : ''}`}>
                            {label}
                            {kind === 'date' ? (
                              <TypedDateInput value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} className="mt-1 min-h-9 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-normal" />
                            ) : kind === 'country' ? (
                              <SearchableSelect label="" value={form[key]} options={countryOptions} onChange={(value) => setForm({ ...form, [key]: value })} />
                            ) : kind === 'textarea' ? (
                              <textarea rows={2} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-normal" />
                            ) : (
                              <input value={form[key]} list={kind === 'legalForm' ? 'company-legal-forms' : undefined} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 min-h-9 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-normal" />
                            )}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <datalist id="company-legal-forms">{companyLegalForms.map((option) => <option key={option} value={option} />)}</datalist>
                </section>
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
              <SamePersonPicker people={contactChoices} slot="contact" onPick={(source) => peopleLink.pick('contact', source)} label="Select person" />
              <label className="text-sm font-medium text-slate-700">
                Full name <RequiredMark />
                <input required value={form.keyContactName} onChange={(event) => setForm({ ...form, keyContactName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <SearchableMultiSelect
                label="Position *"
                value={splitList(form.keyContactPosition)}
                otherValue={form.keyContactPositionOther}
                options={positionOptions}
                onChange={(value) => setForm({ ...form, keyContactPosition: value.join(', '), ...(value.includes('Other') ? {} : { keyContactPositionOther: '' }) })}
                onOtherChange={(value) => setForm({ ...form, keyContactPositionOther: value })}
                allowOther
              />
              <label className="text-sm font-medium text-slate-700">
                Email
                <input type="email" value={form.keyContactEmail} onChange={(event) => setForm({ ...form, keyContactEmail: event.target.value })} aria-invalid={Boolean(contactEmailError(form.keyContactEmail))} aria-describedby={contactEmailError(form.keyContactEmail) ? 'contact-email-error' : undefined} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                {contactEmailError(form.keyContactEmail) ? <span id="contact-email-error" role="alert" className="mt-1 block text-xs text-red-700">{contactEmailError(form.keyContactEmail)}</span> : null}
              </label>
              <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                <SearchableSelect
                  label="Code"
                  value={form.keyContactPhoneCountry}
                  options={countryOptions}
                  optionLabels={countryDialLabels}
                  onChange={setPhoneCountry}
                />
                <label className="text-sm font-medium text-slate-700">
                  Mobile number <RequiredMark />
                  <input required type="tel" value={form.keyContactPhone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <SearchableMultiSelect
                label="Nationality"
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
              <div data-contact-copies className="grid gap-3 md:col-span-2 md:grid-cols-2">
                {([
                  ['Passport', form.keyContactIdentityTypes.includes('Passport') || !form.keyContactIdentityTypes.length, 'keyContactPassportNumber', 'keyContactPassportExpiryDate', contactCopies.passport],
                  ['QID', form.keyContactIdentityTypes.includes('QID'), 'keyContactQidNumber', 'keyContactQidExpiryDate', contactCopies.qid]
                ] as const).filter(([, shown]) => shown).map(([label, , numberKey, expiryKey, copies]) => (
                  <fieldset key={label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                    <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><Paperclip aria-hidden="true" className="h-3.5 w-3.5" />{label}</legend>
                    <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
                      <label className="block min-w-0 text-xs font-medium text-slate-600">
                        {label} number
                        <input value={form[numberKey]} onChange={(event) => setForm({ ...form, [numberKey]: event.target.value })} className="mt-1 min-h-9 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-normal" />
                      </label>
                      <label className="block min-w-0 text-xs font-medium text-slate-600">
                        {label} expiry date
                        <TypedDateInput value={form[expiryKey]} onChange={(value) => setForm({ ...form, [expiryKey]: value })} className="mt-1 min-h-9 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-normal" />
                      </label>
                      <div className="min-w-0 sm:col-span-2">
                        <p className="text-xs font-medium text-slate-600">{label} copy</p>
                        {copies.length ? (
                          <ul className="mt-1 flex flex-wrap gap-1.5">{copies.map(name => (
                            <li key={name} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 py-1 pl-2 pr-1 text-xs font-medium text-emerald-800">
                              <span className="max-w-56 truncate" title={name}>{name}</span>
                              <button type="button" onClick={() => void viewContactCopy(name)} aria-label={`View ${name}`} className="inline-flex h-6 items-center gap-1 rounded bg-white px-1.5 text-emerald-800 hover:bg-emerald-100"><Eye aria-hidden="true" className="h-3.5 w-3.5" />View</button>
                            </li>
                          ))}</ul>
                        ) : (
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">No {label} copy linked. <button type="button" onClick={() => goToStep('attachments')} className="font-semibold text-brand-700 hover:underline">Add on Attachments</button></p>
                        )}
                      </div>
                    </div>
                  </fieldset>
                ))}
                {contactCopies.other.length ? (
                  <div className="min-w-0 rounded-lg border border-slate-200 p-3 md:col-span-2">
                    <p className="text-xs font-medium text-slate-600">Other identity copies</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">{contactCopies.other.map(name => (
                      <li key={name} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 py-1 pl-2 pr-1 text-xs font-medium text-slate-700">
                        <span className="max-w-56 truncate" title={name}>{name}</span>
                        <button type="button" onClick={() => void viewContactCopy(name)} aria-label={`View ${name}`} className="inline-flex h-6 items-center gap-1 rounded bg-white px-1.5 hover:bg-slate-100"><Eye aria-hidden="true" className="h-3.5 w-3.5" />View</button>
                      </li>
                    ))}</ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {currentStep.id === 'declaration' && form.enquiryType === 'PROPOSED_COMPANY' ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-950">Client Declaration</h2>
              <p className="mt-2 text-sm text-slate-600">By signing this document, I confirm that the information and documents provided are true, complete, and up to date, and that I am authorised to represent the proposed entity.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {personChoices(people, 'declaration').length ? (
                  <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 md:col-span-2">
                    Signed by
                    <select aria-label="Signed by" className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value="" onChange={(event) => { if (event.target.value) pickDeclarationSigner(event.target.value); }}>
                      <option value="">Select a person already entered</option>
                      {personChoices(people, 'declaration').map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                    </select>
                    <span className="text-xs text-slate-500">Fills the name and position; you can still change them.</span>
                  </label>
                ) : null}
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
            <PreliminaryOwnershipForm form={form} onChange={setForm} onIdentityFile={(file) => setAttachments((current) => withIdentityCopy(current, file))} onCompanyFile={(file) => setAttachments((current) => withCorporateShareholderCopy(current, file))} />
          ) : null}

          {currentStep.id === 'management' && form.enquiryType === 'PROPOSED_COMPANY' ? (
            <PreliminaryManagementForm form={form} onChange={setForm} onIdentityFile={(file) => setAttachments((current) => withIdentityCopy(current, file))} />
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
              onFilesAdded={readAttachment}
              people={form.enquiryType === 'CURRENT_CLIENT_NEW_SERVICES' ? undefined : {
                people: attachmentPeople,
                positionOptions: attachmentPositionOptions,
                readingId: peopleReadingId,
                note: peopleNote,
                onNote: setPeopleNote,
                onAddPerson: addPerson,
                onRemovePerson: removePerson,
                onAddFiles: (personId, kind, files) => void addPersonFiles(personId, kind, files),
                onRemoveFile: removePersonFile,
                onName: setPersonName,
                onPositions: setPersonPositions,
                contactNote: contactPersonNote
              }}
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
              <button type="button" onClick={saveDraft} disabled={saving || Boolean(duplicate)} title={duplicate ? 'An enquiry for this company already exists' : undefined} className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${isEditMode ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : isEditMode ? 'Update Enquiry' : 'Save Draft'}
              </button>
              ) : null}
              {activeStepIndex === steps.length - 1 ? (
                <button type="submit" disabled={saving || Boolean(duplicate)} title={duplicate ? 'An enquiry for this company already exists' : undefined} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
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
    </PeopleLinkContext.Provider>
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
        <SearchableSelect label="Jurisdiction of registration *" value={form.jurisdictionOfRegistration} otherValue={form.jurisdictionOfRegistrationOther} options={jurisdictions.filter((item) => item !== 'Other')} onChange={(value) => onFormChange({ ...form, jurisdictionOfRegistration: value, ...(value === 'Other' ? {} : { jurisdictionOfRegistrationOther: '' }) })} onOtherChange={(value) => onFormChange({ ...form, jurisdictionOfRegistrationOther: value })} allowOther />
        <SearchableSelect label="Country of incorporation *" value={form.countryOfIncorporation} options={countryOptions} onChange={(value) => onFormChange({ ...form, countryOfIncorporation: value })} />
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
          ['3', `Jurisdiction of Registration: ${value(resolveOtherValue(form.jurisdictionOfRegistration, form.jurisdictionOfRegistrationOther))}`],
          ['4', `Country of incorporation: ${value(form.countryOfIncorporation)}`],
          ['5', `Proposed Registered Office Address: ${value(form.proposedRegisteredOfficeAddress)}`],
          ['6', `Proposed Business Activity: ${value(form.proposedBusinessActivity)}`],
          ['7', `Expected Source of Initial Capital: ${value(form.sourceOfInitialCapital)}`],
          ['8', `Expected Business from Newoon: ${value(resolvedRequestedServices(form).join(', '))}`]
        ]} />
      </PdfSection>
      <PdfSection title="Section B: Shareholders & Beneficial Owners (Proposed)">
        <p className="font-bold">Proposed Shareholders</p>
        <PdfTable headers={['No.', 'Name', 'Passport/QID/C.R. No', 'DOB / Incorporation', 'Nationality', 'Country of Residence', 'Shareholder of', 'Ownership %', 'PEP']} rows={ownershipChainOrder(form.preliminaryShareholders).map(({ row, number }) => [number, value(row.fullName), value(previewIdentity(row)), value(row.dateOfBirth), value(row.nationality), value(row.address), shareholderOfLabel(row, form.preliminaryShareholders), value(row.ownershipPercentage), row.shareholderType === 'Corporate Entity' ? 'N/A' : value(row.isPep)])} />
        <p className="mt-1 font-bold">Total direct ownership %: {directOwnershipTotal(form.preliminaryShareholders).toFixed(2)}%</p>
        <p className="mt-2 font-bold">Ultimate Beneficial owners (Natural Person Only)</p>
        <PdfTable headers={['No.', 'Name', 'Passport/QID', 'Date of Birth', 'Nationality', 'Country of Residence', 'UBO %', 'PEP']} rows={mergeBeneficialOwners(form.preliminaryShareholders, form.preliminaryUbos).map((row, index) => [String(index + 1), value(row.fullName), value(previewIdentity(row)), value(row.dateOfBirth), value(row.nationality), value(row.address), value(row.ownershipPercentage), value(row.isPep)])} />
        <p className="mt-1 font-bold">Total UBO %: {totalOwnership(mergeBeneficialOwners(form.preliminaryShareholders, form.preliminaryUbos))}%</p>
        <p className="mt-2">If a shareholder is a corporate entity, please provide its Commercial Registration (or equivalent incorporation document) and ownership structure until the ultimate beneficial owner(s) (natural person(s)) are identified.</p>
      </PdfSection>
      <PdfSection title="Section C: Proposed Management & Control Persons (Directors, Secretary, SEF, Authorized Signatory)">
        <PdfTable headers={['No.', 'Name', 'Passport / QID', 'Date of Birth', 'Nationality', 'Position', 'PEP']} rows={form.preliminaryManagement.map((row, index) => [String(index + 1), value(row.fullName), value(previewIdentity(row)), value(row.dateOfBirth), value(row.nationality), value(row.position || row.positions?.join(', ')), value(row.isPep)])} />
      </PdfSection>
      <PdfSection title="Section D: Required Documents">
        <PdfTable headers={['No.', 'Documents', 'Description', 'Yes/No']} rows={[
          ['1', 'Qatar ID / Passport copies', 'For all natural persons: Shareholder, UBO, Director, SEF, Secretary, and authorized signatory.', attachments.some(attachment => /QID|Passport|Identity Proof/i.test(attachment.documentType) && attachmentDisplayNames(attachment).length) ? 'Yes' : 'No'],
          ['2', 'National address certificates', 'Natural persons resident in Qatar.', attachments.some((attachment) => attachment.documentType.toLowerCase().includes('address') && attachmentDisplayNames(attachment).length) ? 'Yes' : 'No'],
          ['3', 'CR of legal entities', 'If shareholders are corporate entities, provide CR of each entity until natural persons are identified.', attachments.some((attachment) => /corporate|CR of legal entity parties/i.test(attachment.documentType) && attachmentDisplayNames(attachment).length) ? 'Yes' : 'No']
        ]} />
      </PdfSection>
      <div className="mt-16 border-t-4 border-black pt-10">
        <PdfSection title="Section E: Key Contact person">
          <p className="mb-1 font-bold">Provide the contact information of the key contact person:</p>
          <PdfTable headers={['No.', 'Field', 'Details']} rows={filledContactRows([
            ['1', 'Full Name', value(form.keyContactName)], ['2', 'Nationality', value(nationalityText(form.keyContactNationality, form.keyContactNationalityOther))],
            ['3', 'Passport Number', value(form.keyContactPassportNumber)], ['4', 'Passport Expiry Date', value(form.keyContactPassportExpiryDate)],
            ['5', 'QID Number', value(form.keyContactQidNumber)], ['6', 'QID Expiry Date', value(form.keyContactQidExpiryDate)],
            ['7', 'Mobile Number', value(form.keyContactPhone)], ['8', 'Email', value(form.keyContactEmail)]
          ])} />
        </PdfSection>
      </div>
      <PdfSection title="Section F: Client Declaration">
        <p>By signing this document, I hereby confirm that all information and documents provided are true, complete, and up to date. I am authorised to represent and sign this document on behalf of the proposed entity.</p>
        <table className="mt-1 w-full border-collapse text-left"><tbody>
          <tr><th className="w-1/3 border border-black px-1 py-0.5">Full Name</th><td className="border border-black px-1 py-0.5">{value(form.preliminaryDeclaration.fullName)}</td></tr>
          <tr><th className="border border-black px-1 py-0.5">Position</th><td className="border border-black px-1 py-0.5">{value(form.preliminaryDeclaration.position)}</td></tr>
          <tr><th className="border border-black px-1 py-0.5">Date</th><td className="border border-black px-1 py-0.5">{value(form.preliminaryDeclaration.date)}</td></tr>
          <tr><th className="border border-black px-1 py-0.5">Authorised signature</th><td className="border border-black px-1 py-0.5"><PreliminaryUploadPreview label="Authorised signature" dataUrl={form.preliminaryDeclaration.authorizedSignatureDataUrl} /></td></tr>
          <tr><th className="border border-black px-1 py-0.5">Company Stamp</th><td className="border border-black px-1 py-0.5"><PreliminaryUploadPreview label="Company stamp" dataUrl={form.preliminaryDeclaration.companyStampDataUrl} /></td></tr>
        </tbody></table>
      </PdfSection>
    </article>
  </aside>;
}

function PdfSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-3"><h3 className="border-b-4 border-[#dce9f7] pb-0.5 text-[10px] font-bold">{title}</h3><div className="mt-1">{children}</div></section>; }
function PdfTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <table className="w-full border-collapse text-left"><thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`} className="border border-black px-1 py-0.5 font-bold">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((item, cellIndex) => <td key={cellIndex} className="border border-black px-1 py-0.5 align-top">{item}</td>)}</tr>)}</tbody></table>; }
function PreliminaryUploadPreview({ dataUrl, label }: { dataUrl?: string; label: string }) {
  if (!dataUrl?.startsWith('data:image/')) return <>-</>;
  return <div className="max-w-full py-2" style={{ breakInside: 'avoid' }}><img src={dataUrl} alt={label} style={{ display: 'block', width: '260px', maxWidth: '100%', height: '112px', objectFit: 'contain', objectPosition: 'left center' }} /></div>;
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

type IdentityFileHandler = (file: File, type: 'PASSPORT' | 'QID', personName: string) => void;

function PreliminaryOwnershipForm({ form, onChange, onIdentityFile, onCompanyFile }: { form: EnquiryValidationForm; onChange: (form: EnquiryValidationForm) => void; onIdentityFile: IdentityFileHandler; onCompanyFile: (file: File) => void }) {
  return <PreliminaryOwnershipEditor shareholders={form.preliminaryShareholders} ubos={form.preliminaryUbos} countries={countryOptions} nationalities={nationalityOptions} onChange={(shareholders, ubos) => onChange({ ...form, preliminaryShareholders: shareholders, preliminaryUbos: ubos })} onIdentityFile={onIdentityFile} onCompanyFile={onCompanyFile} />;
}

function PreliminaryManagementForm({ form, onChange, onIdentityFile }: { form: EnquiryValidationForm; onChange: (form: EnquiryValidationForm) => void; onIdentityFile: IdentityFileHandler }) {
  return <PreliminaryManagementEditor people={form.preliminaryManagement} nationalities={nationalityOptions} positions={positionOptions} onChange={(people) => onChange({ ...form, preliminaryManagement: people })} onIdentityFile={onIdentityFile} />;
}

// Printed identity in the preview: QID / passport with expiry dates; a company keeps its CR number.
function previewIdentity(row: PersonDetails & { shareholderType?: string; identityNumber?: string }) {
  if (row.shareholderType === 'Corporate Entity') return row.identityNumber || '';
  const part = (label: string, number?: string, expiry?: string) => number?.trim() ? `${label}: ${number.trim()}${expiry ? ` (exp. ${expiry})` : ''}` : '';
  return [part('QID', row.qidNumber, row.qidExpiry), part('Passport', row.passportNumber, row.passportExpiry)].filter(Boolean).join(' / ') || identitySummary(row);
}

// A passport / QID copy read on the Ownership or Management step is attached to the enquiry under one document type.
function withIdentityCopy(attachments: AttachmentDraft[], file: File): AttachmentDraft[] {
  return withAttachmentCopy(attachments, IDENTITY_COPIES_DOCUMENT, file);
}

// A CR read on the Ownership step goes with the corporate shareholder documents; the client company's own CR (Details
// step) with "Corporate Documents - Company".
const CORPORATE_SHAREHOLDER_DOCUMENTS = ['Corporate documents of corporate shareholders in case of multiple layers of UBO', 'Corporate shareholder documents'];
function withCorporateShareholderCopy(attachments: AttachmentDraft[], file: File): AttachmentDraft[] {
  const documentType = attachments.find((attachment) => CORPORATE_SHAREHOLDER_DOCUMENTS.includes(attachment.documentType))?.documentType || CORPORATE_SHAREHOLDER_DOCUMENTS[1];
  return withAttachmentCopy(attachments, documentType, file);
}

function withAttachmentCopy(attachments: AttachmentDraft[], documentType: string, file: File): AttachmentDraft[] {
  const existing = attachments.find((attachment) => attachment.documentType === documentType);
  if (existing?.files?.some((item) => item.name === file.name && item.size === file.size)) return attachments;
  if (!existing) return [...attachments, { documentType, fileName: file.name, files: [file] }];
  return attachments.map((attachment) => attachment === existing ? { ...attachment, files: [...(attachment.files || []), file], fileName: [attachment.fileName, file.name].filter(Boolean).join(', ') } : attachment);
}

function enquirySteps(enquiryType: EnquiryType): Array<{ id: EnquiryStep; label: string; description: string }> {
  const steps: Array<{ id: EnquiryStep; label: string; description: string }> = [
    { id: 'type', label: 'Type', description: 'Select the enquiry category so the correct fields are shown.' },
    { id: 'attachments', label: 'Attachments', description: 'Upload supporting documents.' },
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
  onChange,
  onFilesAdded,
  people
}: {
  enquiryType: EnquiryType;
  proposedLegalForm: string;
  attachments: AttachmentDraft[];
  onChange: (attachments: AttachmentDraft[]) => void;
  // Reads a file added to a type that can fill the form (company CR, key contact ID); null when it does not apply.
  onFilesAdded?: (documentType: string, files: File[]) => Promise<FillOutcome | null>;
  // The QID / passport of each person with their positions; not shown for a current client's additional uploads.
  people?: ComponentProps<typeof PeopleDocuments>;
}) {
  const [readNotes, setReadNotes] = useState<Record<string, FillOutcome>>({});
  const [readingType, setReadingType] = useState('');

  async function readAdded(documentType: string, files: File[]) {
    if (!onFilesAdded) return;
    setReadingType(documentType);
    try {
      const outcome = await onFilesAdded(documentType, files);
      if (outcome) setReadNotes((current) => ({ ...current, [documentType]: outcome }));
    } catch {
      setReadNotes((current) => ({ ...current, [documentType]: { tone: 'warn', text: 'The file was added, but its details could not be read. Type them in.' } }));
    } finally {
      setReadingType('');
    }
  }

  function setFiles(index: number, files: File[]) {
    void readAdded(attachments[index]?.documentType || '', files);
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
  const entries = attachments.map((attachment, index) => ({ attachment, index }));
  // Each person's QID / passport is uploaded in the people section below, not as one shared document.
  const companyEntries = entries.filter(({ attachment }) => kycDocumentTypes.includes(attachment.documentType) && attachment.documentType !== PEOPLE_DOCUMENT);
  // Files added from other steps (identity copies of the Ownership step, signatures ...) keep their own type.
  const otherEntries = entries.filter(({ attachment }) => !isAdditionalAttachment(attachment) && !kycDocumentTypes.includes(attachment.documentType) && hasAttachmentContent(attachment));
  const additionalEntries = entries.filter(({ attachment }) => isAdditionalAttachment(attachment));
  const uploaded = companyEntries.filter(({ attachment }) => hasAttachmentContent(attachment)).length;
  const percent = companyEntries.length ? Math.round((uploaded / companyEntries.length) * 100) : 0;

  const renderCard = ({ attachment, index }: { attachment: AttachmentDraft; index: number }, removable: boolean) => (
    <DocumentCard
      key={`${attachment.documentType}-${index}`}
      title={attachment.documentType}
      names={attachmentDisplayNames(attachment)}
      reading={readingType === attachment.documentType}
      note={readNotes[attachment.documentType]}
      onNote={(outcome) => setReadNotes((current) => ({ ...current, [attachment.documentType]: outcome }))}
      removable={removable}
      onSelect={(files) => setFiles(index, files)}
      onRemoveName={(fileIndex) => removeFile(index, fileIndex)}
      onRemove={() => removeAttachment(index)}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">{isAdditionalUploadOnly ? 'Additional Document Upload' : 'Required Attachments'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isAdditionalUploadOnly
              ? 'Add one or more supporting documents for the new service request.'
              : enquiryType === 'PROPOSED_COMPANY'
                ? 'Capture the preliminary incorporation support files required for review.'
                : 'Upload the company documents, then add the QID / passport of each person with their positions.'}
          </p>
        </div>
        <button type="button" onClick={addAdditionalUpload} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add Document
        </button>
      </div>

      {!isAdditionalUploadOnly ? (
        <>
          <div role="status" aria-label="Upload progress" className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-800">Company documents</span>
              <span className="text-slate-500">{uploaded} of {companyEntries.length} uploaded</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} /></div>
            <p className="mt-2 text-[11px] text-slate-400">{STANDARD_DOCUMENT_HINT}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">{companyEntries.map((entry) => renderCard(entry, false))}</div>
          {people ? <PeopleDocuments {...people} /> : null}
          {otherEntries.length ? (
            <section aria-label="Other documents">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Documents added from other steps</h3>
              <div className="grid gap-3 md:grid-cols-2">{otherEntries.map((entry) => renderCard(entry, false))}</div>
            </section>
          ) : null}
        </>
      ) : null}

      {additionalEntries.length ? (
        <section aria-label="Additional documents">
          {!isAdditionalUploadOnly ? <h3 className="mb-2 text-sm font-semibold text-slate-900">Additional documents</h3> : null}
          <div className="grid gap-3 md:grid-cols-2">{additionalEntries.map((entry) => renderCard(entry, true))}</div>
        </section>
      ) : null}
    </div>
  );
}
