import { Check, ChevronDown, Download, Eye, FileSpreadsheet, FileText, Plus, Save, Search, SearchCheck, Send, Trash2, Upload, X, LoaderCircle } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RichTextEditor, safeCommentHtml } from '../components/RichTextEditor';
import { PreliminaryKycDocument } from '../components/PreliminaryKycDocument';
import { OwnershipStructureDiagram } from '../components/OwnershipStructureDiagram';
import { DocumentPreviewFrame } from '../components/DocumentPreviewFrame';
import { DocumentIntakePanel } from '../components/DocumentIntakePanel';
import { appendReviewedPerson, applyAutomaticIdentity, newIntakePersonTargets, readIntakeDocument, reviewedPatch, type IntakeApplication } from '../utils/document-intake';
import { mergeBeneficialOwners } from '../utils/ownership';
import { uboCompanyName } from '../utils/ubo-display-name';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { displayList as displaySelectedList, resolveOtherValue, SearchableMultiSelect as MultiSelect, SearchableSelect as Select, splitList } from '../components/SearchableSelect';
import { MultiFileUploadControl } from '../components/MultiFileUploadControl';
import { TypedDateInput } from '../components/TypedDateInput';
import { useAuth } from '../hooks/useAuth';
import {
  autoSaveKycForm,
  CrrfWorkspace,
  downloadGeneratedKycDocument,
  decideMlroReview,
  decideSefReview,
  generateKycDocument,
  getCrrfWorkspace,
  getKycCase,
  getKycForm,
  getScreeningContext,
  KycCase,
  KycFormData,
  matchClientByIdentifier,
  saveKycFormSection,
  ScreeningContext,
  submitDmlroReview,
  uploadLegalDocumentFiles,
  viewCrrfDocument,
  viewMergedScreeningDocument,
  viewScreeningDocument,
  readKycCompanyDocument,
  readKycIdentityDocument
} from '../services/kyc-workflow.service';
import { DocumentFillBar, FillNote } from '../components/DocumentFillBar';
import { SamePersonPicker } from '../components/SamePersonPicker';
import { PeopleAdapter, personChoices, personDetails, PersonSlot, syncLinkedPeople, toList } from '../utils/linked-people';
import { addPeopleFromDocument, PeopleLayout } from '../utils/people-from-document';
import { CompanyTarget, companyFill, companyFillOutcome, FillOutcome, identityFill, IdentityType } from '../utils/document-fill';
import { getApiErrorMessage } from '../services/api';
import { applyCountryDialCode, countryDialOptions } from '../utils/country-phone';
import { newoonServiceOptions as prospectiveServiceOptions } from '../utils/newoon-services';
import { hasAnyRole, workflowRoles } from '../utils/access-control';
import { identitySummary, legacyIdentity, withDerivedIdentity } from '../utils/person-identity';
import { STANDARD_DOCUMENT_ACCEPT, STANDARD_DOCUMENT_HINT } from '../utils/upload-security';

const sections = [
  { id: 'section-a', key: 'sectionA', label: 'A. General Company Information' },
  // Client's KYC format (2026-11): managers are B and shareholders C. The keys and endpoints stay
  // sectionB = ownership / sectionC = managers, so stored data and the API are unchanged.
  { id: 'section-c', key: 'sectionC', label: 'B. Managers / Signatories' },
  { id: 'section-b', key: 'sectionB', label: 'C. Shareholders' },
  { id: 'section-d', key: 'sectionD', label: 'D. Compliance and Risk' },
  { id: 'section-e', key: 'sectionE', label: 'E. Key Communication Person' },
  { id: 'section-f', key: 'sectionF', label: 'F. Required Documents' },
  { id: 'section-g', key: 'sectionG', label: 'G. Client Declaration' },
  { id: 'section-h', key: 'sectionH', label: 'H. Internal Use Only' }
] as const;

const requiredDocuments = [
  'Commercial Registration / CR Extract',
  'Entity Card / Computer Card',
  'Certificate of Incorporation',
  'Articles of Association',
  'QID / Passport copies',
  'CR of legal entity parties',
  'National address certificates',
  'Latest Audited Financial Statements',
  'Tax Card'
];

// Copies read with "Fill from a copy" are also kept in the Section F checklist under these document types.
const CR_DOCUMENT = 'Commercial Registration / CR Extract';
const IDENTITY_COPIES_DOCUMENT = 'QID / Passport copies';
const CORPORATE_PARTY_CR_DOCUMENT = 'CR of legal entity parties';

// The person rows that can be filled from a passport / QID copy (or, for a corporate shareholder, from its CR).
type FillTarget = { list: 'shareholders' | 'ubos' | 'managers' | 'contact'; index: number; row: Row; corporate?: boolean };
type FillBarRenderer = (target: FillTarget) => ReactNode;

// How people read from a CR are written into Sections B (shareholders) and C (officers).
const kycPeopleLayout: PeopleLayout = {
  // Getters: the option lists are declared further down this file.
  get countries() { return countryOptions; },
  get positions() { return positionOptions; },
  newShareholder: createOwnershipRow,
  newOfficer: () => ({ id: crypto.randomUUID() }),
  setPositions: (row, positions) => ({ ...row, position: positions }),
  positionsOf: (row) => toList(row.position)
};

const fillTargetSlot = (target: FillTarget) => (target.list === 'contact' ? 'contact' : `${target.list}:${target.index}`);

// The people of the KYC form (shareholders, beneficial persons, managers, key contact) for "Same person as ..." and for
// keeping one person's details the same on all their rows (linked by QID / passport number).
const kycPeople: PeopleAdapter<any> = {
  read: (form) => [
    ...((form.sectionB?.shareholders || []) as Row[]).map((row, index) => ({ slot: `shareholders:${index}`, role: row.isUbo ? 'Shareholder, beneficial person' : 'Shareholder', row, hidden: (row.shareholderType || 'Individual') === 'Corporate Entity' })),
    ...((form.sectionB?.ubos || []) as Row[]).map((row, index) => ({ slot: `ubos:${index}`, role: 'Beneficial person', row })),
    ...((form.sectionC?.managers || []) as Row[]).map((row, index) => ({ slot: `managers:${index}`, role: toList(row.position).join(', ') || 'Manager', row })),
    { slot: 'contact', role: 'Key contact', row: (form.sectionE || {}) as Row }
  ],
  write: (form, slot, change) => {
    // Person rows list countries ("Jordan"), the key contact nationalities ("Jordanian"): a value that is not in the
    // target's list is left out rather than shown as an unknown choice.
    const fitting = (options: string[]) => {
      if (!('nationality' in change)) return change;
      const { nationality, ...rest } = change;
      const values = toList(nationality).filter((value) => options.includes(value));
      return values.length ? { ...rest, nationality: values } : rest;
    };
    const rowChange = fitting(slot === 'contact' ? nationalityOptions : countryOptions);
    const merge = (row: Row) => withDerivedIdentity({ ...row, ...rowChange });
    if (slot === 'contact') return { ...form, sectionE: merge(form.sectionE || {}) };
    const [list, position] = slot.split(':');
    const index = Number(position);
    const section = list === 'managers' ? 'sectionC' : 'sectionB';
    const data = form[section] || {};
    return { ...form, [section]: { ...data, [list]: ((data[list] || []) as Row[]).map((row, rowIndex) => (rowIndex === index ? merge(row) : row)) } };
  }
};

function createAdditionalDocumentRow(): Row {
  return {
    id: crypto.randomUUID(),
    fileName: '',
    mimeType: '',
    size: undefined
  };
}

function fileNameList(value: unknown) {
  return typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function removeFileName(value: unknown, indexToRemove: number) {
  return fileNameList(value).filter((_, index) => index !== indexToRemove).join(', ');
}

function uniqueFileNameText(value: unknown) {
  const seen = new Set<string>();
  return fileNameList(value)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}

function appendFileNameText(existing: unknown, incoming: unknown) {
  return uniqueFileNameText([...fileNameList(existing), ...fileNameList(incoming)].join(', '));
}

function documentKey(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/shareholders?/g, 'parties')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const countryOptions = [
  '',
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Cote d Ivoire',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe'
];

const nationalityOptions = [
  '',
  'Afghan',
  'Albanian',
  'Algerian',
  'American',
  'Andorran',
  'Angolan',
  'Antiguan or Barbudan',
  'Argentine',
  'Armenian',
  'Australian',
  'Austrian',
  'Azerbaijani',
  'Bahamian',
  'Bahraini',
  'Bangladeshi',
  'Barbadian',
  'Belarusian',
  'Belgian',
  'Belizean',
  'Beninese',
  'Bhutanese',
  'Bolivian',
  'Bosnian or Herzegovinian',
  'Botswanan',
  'Brazilian',
  'British',
  'Bruneian',
  'Bulgarian',
  'Burkinabe',
  'Burundian',
  'Cabo Verdean',
  'Cambodian',
  'Cameroonian',
  'Canadian',
  'Central African',
  'Chadian',
  'Chilean',
  'Chinese',
  'Colombian',
  'Comorian',
  'Congolese',
  'Costa Rican',
  'Croatian',
  'Cuban',
  'Cypriot',
  'Czech',
  'Danish',
  'Djiboutian',
  'Dominican',
  'Dutch',
  'Ecuadorian',
  'Egyptian',
  'Emirati',
  'Equatorial Guinean',
  'Eritrean',
  'Estonian',
  'Eswatini',
  'Ethiopian',
  'Fijian',
  'Filipino',
  'Finnish',
  'French',
  'Gabonese',
  'Gambian',
  'Georgian',
  'German',
  'Ghanaian',
  'Greek',
  'Grenadian',
  'Guatemalan',
  'Guinean',
  'Guyanese',
  'Haitian',
  'Honduran',
  'Hungarian',
  'Icelandic',
  'Indian',
  'Indonesian',
  'Iranian',
  'Iraqi',
  'Irish',
  'Israeli',
  'Italian',
  'Ivorian',
  'Jamaican',
  'Japanese',
  'Jordanian',
  'Kazakh',
  'Kenyan',
  'Kiribati',
  'Kuwaiti',
  'Kyrgyz',
  'Lao',
  'Latvian',
  'Lebanese',
  'Liberian',
  'Libyan',
  'Lithuanian',
  'Luxembourgish',
  'Malagasy',
  'Malawian',
  'Malaysian',
  'Maldivian',
  'Malian',
  'Maltese',
  'Mauritanian',
  'Mauritian',
  'Mexican',
  'Moldovan',
  'Monacan',
  'Mongolian',
  'Montenegrin',
  'Moroccan',
  'Mozambican',
  'Myanmar',
  'Namibian',
  'Nauruan',
  'Nepalese',
  'New Zealander',
  'Nicaraguan',
  'Nigerian',
  'North Korean',
  'Norwegian',
  'Omani',
  'Pakistani',
  'Palauan',
  'Palestinian',
  'Panamanian',
  'Papua New Guinean',
  'Paraguayan',
  'Peruvian',
  'Polish',
  'Portuguese',
  'Qatari',
  'Romanian',
  'Russian',
  'Rwandan',
  'Saudi',
  'Senegalese',
  'Serbian',
  'Seychellois',
  'Sierra Leonean',
  'Singaporean',
  'Slovak',
  'Slovenian',
  'Somali',
  'South African',
  'South Korean',
  'South Sudanese',
  'Spanish',
  'Sri Lankan',
  'Sudanese',
  'Surinamese',
  'Swedish',
  'Swiss',
  'Syrian',
  'Taiwanese',
  'Tajik',
  'Tanzanian',
  'Thai',
  'Togolese',
  'Tongan',
  'Trinidadian or Tobagonian',
  'Tunisian',
  'Turkish',
  'Turkmen',
  'Tuvaluan',
  'Ugandan',
  'Ukrainian',
  'Uruguayan',
  'Uzbek',
  'Vanuatuan',
  'Venezuelan',
  'Vietnamese',
  'Yemeni',
  'Zambian',
  'Zimbabwean'
];

const legalFormOptions = [
  '',
  'LLC',
  'Branch',
  'Partnership',
  'Government entity',
  'Registered in stock exchange',
  'Trust/Funds',
  'Sole establishment'
];

const industryOptions = [
  '',
  'Manufacturing',
  'Finance',
  'IT Services',
  'Construction',
  'Entertainment',
  'Retail',
  'Professional services',
  'Real estate',
  'Healthcare',
  'Education',
  'Hospitality',
  'Trading'
];

const businessNatureOptions = [
  '',
  'Business support services',
  'Trading',
  'Consulting',
  'Manufacturing',
  'Technology services',
  'Construction contracting',
  'Real estate activities',
  'Financial services',
  'Holding company'
];

const positionOptions = [
  '',
  'Director',
  'Managing Director',
  'Chairman',
  'CEO',
  'CFO',
  'COO',
  'Manager',
  'General Manager',
  'Authorized Signatory',
  'Secretary',
  'SEF',
  'Senior Executive Function',
  'Shareholder',
  'UBO',
  'Interest Holder',
  'Beneficial Person',
  'Compliance Officer'
];

// Per-person declarations on every person row (2026-11-23). Title is a plain list; PEP and dual citizenship are Yes / No.
const personTitleOptions = ['', 'Mr', 'Ms', 'Mrs', 'Dr', 'Sheikh', 'Sheikha'];
const personDeclarationFields: DynamicField[] = [
  ['title', 'Title', 'simpleselect', personTitleOptions],
  ['dualCitizenship', 'Dual citizenship', 'yesno'],
  ['otherNationality', 'Other nationality (if dual citizenship)'],
  ['isPep', 'PEP (politically exposed person)', 'yesno'],
  ['pepDetails', 'PEP details']
];

const mlroDecisionOptions = ['', 'APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_DMLRO', 'SEND_TO_SEF'];
const dmlroDecisionOptions = ['', 'APPROVE', 'APPROVE_WITH_CONDITIONS', 'DMLRO_FINAL_APPROVE', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_SUPERVISOR'];
const dmlroDecisionLabels: Record<string, string> = {
  APPROVE: 'Send to MLRO',
  APPROVE_WITH_CONDITIONS: 'Approve with conditions',
  DMLRO_FINAL_APPROVE: 'Final approval during MLRO absence',
  REQUEST_ADDITIONAL_INFORMATION: 'Request additional information from AML Supervisor',
  RETURN_TO_SUPERVISOR: 'Return to AML Supervisor'
};
const mlroDecisionLabels: Record<string, string> = {
  APPROVE: 'Approve',
  APPROVE_WITH_CONDITIONS: 'Approve with conditions',
  REJECT: 'Reject',
  REQUEST_ADDITIONAL_INFORMATION: 'Request additional information',
  RETURN_TO_DMLRO: 'Return to DMLRO',
  SEND_TO_SEF: 'Send to SEF for management decision'
};
const sefDecisionOptions = ['', 'APPROVE', 'APPROVE_WITH_CONDITIONS', 'RETURN_TO_MLRO', 'REJECT'];
const sefDecisionLabels: Record<string, string> = {
  APPROVE: 'Approve',
  APPROVE_WITH_CONDITIONS: 'Approve with conditions',
  RETURN_TO_MLRO: 'Return to MLRO',
  REJECT: 'Reject'
};

// Review decisions move the file to someone else and cannot be undone from this page, so the reviewer confirms first.
// What happens to the file after each decision, worded before it is sent.
const reviewDecisionOutcomes: Record<string, Record<string, string>> = {
  DMLRO: {
    APPROVE: 'The file goes to MLRO for the final decision.',
    APPROVE_WITH_CONDITIONS: 'The file goes to MLRO with your conditions.',
    DMLRO_FINAL_APPROVE: 'The KYC becomes final without MLRO review.',
    REQUEST_ADDITIONAL_INFORMATION: 'The file goes back to the AML Supervisor to provide the information.',
    RETURN_TO_SUPERVISOR: 'The file goes back to the AML Supervisor.'
  },
  MLRO: {
    APPROVE: 'The KYC becomes final.',
    APPROVE_WITH_CONDITIONS: 'The KYC becomes final with your conditions.',
    REJECT: 'The KYC file is rejected.',
    REQUEST_ADDITIONAL_INFORMATION: 'The file goes back to the AML team to provide the information, then through DMLRO again.',
    RETURN_TO_DMLRO: 'The file goes back to DMLRO.',
    SEND_TO_SEF: 'The file goes to SEF for a management decision.'
  },
  SEF: {
    APPROVE: 'The KYC becomes final.',
    APPROVE_WITH_CONDITIONS: 'The KYC becomes final with your conditions.',
    RETURN_TO_MLRO: 'The file goes back to MLRO.',
    REJECT: 'The KYC file is rejected.'
  }
};

// Review decisions move the file to someone else and cannot be undone from this page, so the reviewer confirms first.
function confirmReviewDecision(stage: 'DMLRO' | 'MLRO' | 'SEF', decision: string, decisionLabel: string) {
  const outcome = reviewDecisionOutcomes[stage][decision] || '';
  return window.confirm(`Submit the ${stage} decision "${decisionLabel}"?${outcome ? `

${outcome}` : ''}

This cannot be undone from this page.`);
}

function dmlroDecisionSuccessMessage(decision: string) {
  if (decision === 'REQUEST_ADDITIONAL_INFORMATION') return 'DMLRO requested additional information from AML Supervisor.';
  if (decision === 'RETURN_TO_SUPERVISOR') return 'KYC file returned to AML Supervisor.';
  if (decision === 'APPROVE_WITH_CONDITIONS') return 'DMLRO approval with conditions submitted to MLRO.';
  return 'DMLRO review submitted to MLRO.';
}

function dmlroDecisionErrorMessage(decision: string) {
  if (decision === 'REQUEST_ADDITIONAL_INFORMATION') return 'Unable to request additional information from AML Supervisor.';
  if (decision === 'RETURN_TO_SUPERVISOR') return 'Unable to return KYC file to AML Supervisor.';
  if (decision === 'APPROVE_WITH_CONDITIONS') return 'Unable to submit DMLRO approval with conditions.';
  return 'Unable to submit DMLRO review to MLRO.';
}

function mlroDecisionSuccessMessage(decision: string) {
  if (decision === 'RETURN_TO_DMLRO') return 'KYC file sent back to DMLRO.';
  if (decision === 'SEND_TO_SEF') return 'KYC file sent to SEF for management decision.';
  if (decision === 'REQUEST_ADDITIONAL_INFORMATION') return 'Additional information requested by MLRO.';
  if (decision === 'REJECT') return 'MLRO rejection submitted.';
  if (decision === 'APPROVE_WITH_CONDITIONS') return 'MLRO approval with conditions submitted.';
  return 'MLRO final approval submitted.';
}

function mlroDecisionErrorMessage(decision: string) {
  if (decision === 'RETURN_TO_DMLRO') return 'Unable to send KYC file back to DMLRO.';
  if (decision === 'SEND_TO_SEF') return 'Unable to send KYC file to SEF.';
  if (decision === 'REQUEST_ADDITIONAL_INFORMATION') return 'Unable to request additional information.';
  if (decision === 'REJECT') return 'Unable to submit MLRO rejection.';
  if (decision === 'APPROVE_WITH_CONDITIONS') return 'Unable to submit MLRO approval with conditions.';
  return 'Unable to submit MLRO final approval.';
}

function sefDecisionSuccessMessage(decision: string) {
  if (decision === 'RETURN_TO_MLRO') return 'KYC file returned to MLRO.';
  if (decision === 'REJECT') return 'SEF management rejection submitted.';
  if (decision === 'APPROVE_WITH_CONDITIONS') return 'SEF management approval with conditions submitted.';
  return 'SEF management approval submitted.';
}

function sefDecisionErrorMessage(decision: string) {
  if (decision === 'RETURN_TO_MLRO') return 'Unable to return the KYC file to MLRO.';
  if (decision === 'REJECT') return 'Unable to submit SEF management rejection.';
  if (decision === 'APPROVE_WITH_CONDITIONS') return 'Unable to submit SEF management approval with conditions.';
  return 'Unable to submit SEF management decision.';
}

function ReviewPackageButton({
  active = false,
  onClick,
  icon,
  title,
  description
}: {
  active?: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[76px] items-center gap-3 rounded-lg border p-3 text-left transition ${
        active ? 'border-slate-400 bg-white text-slate-950 shadow-sm ring-2 ring-slate-100' : 'border-slate-200 bg-slate-50/80 text-slate-800 hover:border-slate-300 hover:bg-white'
      }`}
    >
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${active ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-slate-100 bg-white text-slate-600'}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function ScreeningPackageDetails({ context, loading }: { context: ScreeningContext | null; loading: boolean }) {
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!context?.records.length) {
      setExpandedRecordIds(new Set());
      return;
    }

    setExpandedRecordIds((current) => {
      const availableIds = new Set(context.records.map((record) => record.id));
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      if (!next.size && context.records[0]) next.add(context.records[0].id);
      return next;
    });
  }, [context?.records]);

  if (loading) return <p className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading Screening details...</p>;
  if (!context) return <p className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">Select Screening to load the prepared records and evidence.</p>;

  const mergedEvidenceCount = context.mergedDocuments.length;
  const recordEvidenceCount = context.records.reduce(
    (sum, record) => sum + record.documents.length + record.checks.reduce((checkSum, check) => checkSum + check.documents.length, 0),
    0
  );
  const allExpanded = context.records.length > 0 && expandedRecordIds.size === context.records.length;

  function toggleRecord(recordId: string) {
    setExpandedRecordIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function expandAll() {
    setExpandedRecordIds(new Set((context?.records || []).map((record) => record.id)));
  }

  function collapseAll() {
    setExpandedRecordIds(new Set());
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        <ReviewMetric label="Client" value={context.clientInfo.clientName || '-'} />
        <ReviewMetric label="CR number" value={context.clientInfo.crNumber || '-'} />
        <ReviewMetric label="Screening records" value={String(context.records.length)} />
        <ReviewMetric label="PDF evidence" value={String(mergedEvidenceCount + recordEvidenceCount)} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">Screening records and individual evidence</p>
            <p className="text-xs text-slate-500">Review each screened entity, its result, notes, and uploaded supporting files.</p>
          </div>
          {context.records.length ? (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={collapseAll}
                disabled={!expandedRecordIds.size}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Collapse all
              </button>
              <button
                type="button"
                onClick={expandAll}
                disabled={allExpanded}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Expand all
              </button>
            </div>
          ) : null}
        </div>
        <div className="mt-3 space-y-3">
          {context.records.length ? (
            context.records.map((record) => {
              const evidenceCount = record.documents.length + record.checks.reduce((sum, check) => sum + check.documents.length, 0);
              const recordDocuments = record.documents.filter((document) => document.documentType !== 'Other screening document' || !document.checkType);
              const isExpanded = expandedRecordIds.has(record.id);
              return (
                <div key={record.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleRecord(record.id)}
                    className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold text-slate-950">{record.entityName}</span>
                        <span className="mt-1 block truncate text-sm text-slate-500">
                          {record.entityType.replace(/_/g, ' ')} {record.identifier ? `| ${record.identifier}` : ''} {record.country ? `| ${record.country}` : ''}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap gap-2 text-xs font-semibold">
                      <span className={resultBadgeClass(record.conclusionStatus || '')}>{screeningResultLabels[record.conclusionStatus || ''] || 'No result selected'}</span>
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">{evidenceCount} files</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{record.status}</span>
                    </span>
                  </button>
                  {isExpanded ? (
                    <>
                      <div className="mx-4 mb-4 grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 lg:grid-cols-[1fr_1.2fr]">
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500">Observations / internal remarks</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{record.remarks || 'No remarks added.'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500">Other record evidence</p>
                          <PackageDocumentList documents={recordDocuments} caseId={context.clientInfo.caseId} onView={viewScreeningDocument} />
                        </div>
                      </div>
                      <div className="grid gap-3 border-t border-slate-100 bg-white p-4 lg:grid-cols-2">
                        {record.checks.map((check) => (
                          <div key={check.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{screeningCheckLabels[check.checkType] || check.checkType}</p>
                                <span className={`mt-2 inline-flex ${resultBadgeClass(check.resultStatus)}`}>{screeningResultLabels[check.resultStatus] || check.resultStatus}</span>
                              </div>
                              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">{check.documents.length} files</span>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap rounded-md bg-white p-2 text-xs leading-5 text-slate-600">{check.notes || 'No finding notes added.'}</p>
                            <PackageDocumentList documents={check.documents} caseId={context.clientInfo.caseId} onView={viewScreeningDocument} />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="rounded-md border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-500">No individual Screening records added yet.</p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="border-b border-slate-200 pb-3">
          <p className="text-sm font-semibold text-slate-950">Screening PDF files</p>
          <p className="mt-1 text-xs text-slate-500">Common evidence files uploaded before finalizing individual screening records.</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {context.mergedEvidenceChecks.map((checkType) => {
            const check = context.mergedChecks.find((item) => item.checkType === checkType);
            const documents = context.mergedDocuments.filter((document) => document.checkType === checkType);
            return (
              <div key={checkType} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{screeningCheckLabels[checkType] || checkType}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{documents.length}</span>
                </div>
                <span className={`mt-2 inline-flex ${resultBadgeClass(check?.resultStatus || '')}`}>{screeningResultLabels[check?.resultStatus || ''] || 'Not checked'}</span>
                <PackageDocumentList documents={documents} caseId={context.clientInfo.caseId} onView={viewMergedScreeningDocument} emptyText="No PDF evidence uploaded." />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CrrfPackageDetails({ workspace, loading }: { workspace: CrrfWorkspace | null; loading: boolean }) {
  if (loading) return <p className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading CRRF details...</p>;
  if (!workspace) return <p className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">Select CRRF to load the risk rating and uploaded files.</p>;

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        <ReviewMetric label="Client" value={workspace.clientInfo.clientName || '-'} />
        <ReviewMetric label="Client code" value={workspace.clientInfo.clientCode || '-'} />
        <ReviewMetric label="CR number" value={workspace.clientInfo.crNumber || '-'} />
        <ReviewMetric label="Risk rating" value={crrfRiskLabels[workspace.record.riskRating || ''] || 'Not selected'} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="text-sm font-semibold text-slate-950">CRRF files</p>
        {workspace.record.documents.length ? (
          <PackageDocumentList documents={workspace.record.documents} caseId={workspace.clientInfo.caseId} onView={viewCrrfDocument} />
        ) : (
          <p className="mt-2 text-sm text-slate-500">No CRRF files uploaded yet.</p>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="text-sm font-semibold text-slate-950">Internal comments</p>
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
          {workspace.record.internalComment || workspace.record.dmlroComment || workspace.record.mlroComment || 'No internal comments added.'}
        </p>
      </div>
    </div>
  );
}

function PackageDocumentList({
  documents,
  caseId,
  onView,
  emptyText = 'No files attached.'
}: {
  documents: Array<{ id: string; fileName: string; documentType?: string | null; mimeType?: string | null; size?: number | null }>;
  caseId: string;
  onView: (caseId: string, document: any) => void;
  emptyText?: string;
}) {
  if (!documents.length) return <p className="mt-2 text-xs text-slate-500">{emptyText}</p>;

  return (
    <div className="mt-2 grid gap-2">
      {documents.map((document) => (
        <button
          key={document.id}
          type="button"
          onClick={() => onView(caseId, document)}
          className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
          title={`View ${document.fileName}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{document.fileName}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-brand-700">
            <Eye className="h-3.5 w-3.5" />
            View
          </span>
        </button>
      ))}
    </div>
  );
}

function resultBadgeClass(value: string) {
  if (value === 'CLEAR' || value === 'NO_SANCTION_FOUND') return 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700';
  if (value === 'POTENTIAL_MATCH') return 'rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700';
  if (value === 'CONFIRMED_MATCH' || value === 'NOT_CLEAR' || value === 'SANCTION_FOUND') return 'rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700';
  return 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600';
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

const riskClassificationOptions = ['', 'LOW', 'MEDIUM', 'HIGH'];
const riskReasonCategoryOptions = [
  '',
  'PROFESSIONAL_JUDGEMENT',
  'PEP_IDENTIFIED',
  'SANCTIONS_FINDING',
  'ADVERSE_MEDIA',
  'OWNERSHIP_COMPLEXITY',
  'COUNTRY_RISK',
  'INDUSTRY_RISK',
  'SOURCE_OF_FUNDS_CONCERN',
  'ENHANCED_MONITORING_REQUIRED',
  'OTHER'
];

const approvedStatuses = ['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS', 'KYC_FINAL_APPROVED', 'CLIENT_ACTIVATION_PENDING', 'CLIENT_ACTIVE'] as const;

const emptyForm: KycFormData = {
  id: '',
  tenantId: '',
  kycCaseId: '',
  status: 'DRAFT',
  isLocked: false,
  version: 1,
  sectionA: {},
  sectionB: { shareholders: [], ubos: [], uboDifferentFromShareholders: 'No', totalOwnershipPercentage: 0 },
  sectionC: { managers: [] },
  sectionD: {},
  sectionE: {},
  sectionF: { documents: requiredDocuments.map((documentType) => ({ documentType, isRequired: true, isProvided: false })), additionalDocuments: [] },
  sectionG: {},
  sectionH: {},
  generatedDocuments: [],
  updatedAt: ''
};

type SectionKey = (typeof sections)[number]['key'];
type SectionDefinition = (typeof sections)[number];
type Row = Record<string, any>;
type SectionHMode = 'AML' | 'DMLRO' | 'MLRO' | 'SEF' | 'ALL';
type ReviewPackageTab = 'kyc' | 'screening' | 'crrf';

const screeningCheckLabels: Record<string, string> = {
  NCTC: 'NCTC',
  UN: 'UN',
  OFAC: 'OFAC',
  EU: 'EU',
  PPO_LIST: 'PPO List',
  WORLD_CHECK: 'World-Check',
  GOOGLE: 'Google',
  OTHER: 'Other'
};

const screeningResultLabels: Record<string, string> = {
  NOT_CHECKED: 'Not checked',
  CLEAR: 'Clear',
  POTENTIAL_MATCH: 'Potential match',
  CONFIRMED_MATCH: 'Confirmed match',
  NOT_CLEAR: 'Not clear',
  NO_SANCTION_FOUND: 'No sanction found',
  SANCTION_FOUND: 'Sanction found'
};

const crrfRiskLabels: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High'
};

// Optional review rows (conditions, reasons, risk reason) are shown only when filled, as in the downloaded KYC.
function filledRows<T>(rows: Array<[string, T]>) {
  return rows.filter(([, value]) => typeof value !== 'string' ? Boolean(value) : value.trim() !== '' && value.trim() !== '-');
}

// A label ending in " *" is a required field: the star is drawn in red, as on the enquiry form.
// True when a plain or rich-text value has visible text; an untouched rich-text editor holds markup like "<p></p>".
function hasTypedText(value: unknown) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;|[\s​-‍﻿]/g, '').length > 0;
}

function labelText(label: string) {
  return label.endsWith(' *') ? <>{label.slice(0, -2)}<span className="text-red-600" aria-hidden="true"> *</span></> : label;
}

// Client's declaration wording shown above the signatory details (same text as the downloaded KYC).
const CLIENT_DECLARATION_TEXT = 'By signing this document, I hereby confirm that all information and documents provided are true, complete, and up to date. I am authorized to represent and sign this document on behalf of the entity set out in section A:';

const DMLRO_STAGE_STATUSES = ['SUPERVISOR_REVIEW_COMPLETED', 'DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS'];

export function KycFormEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [form, setForm] = useState<KycFormData>(emptyForm);
  const formRef = useRef<KycFormData>(emptyForm);
  const [activeSection, setActiveSection] = useState<SectionKey>('sectionA');
  const [saving, setSaving] = useState(false);
  const [generatingType, setGeneratingType] = useState<'docx' | 'pdf' | ''>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeReviewPackage, setActiveReviewPackage] = useState<ReviewPackageTab>('kyc');
  const [screeningContext, setScreeningContext] = useState<ScreeningContext | null>(null);
  const [crrfWorkspace, setCrrfWorkspace] = useState<CrrfWorkspace | null>(null);
  const [reviewPackageError, setReviewPackageError] = useState('');
  const [loadingReviewPackage, setLoadingReviewPackage] = useState<ReviewPackageTab | ''>('');

  useEffect(() => {
    if (!id) return;
    setError('');
    Promise.all([getKycCase(id), getKycForm(id)])
      .then(([caseData, formData]) => {
        const normalized = normalizeForm(formData, caseData);
        setKycCase(caseData);
        formRef.current = normalized;
        setForm(normalized);
      })
      .catch((requestError: any) => {
        setError(getApiErrorMessage(requestError, 'Unable to load KYC form builder.'));
      });
  }, [id]);

  const totalOwnership = useMemo(
    () => directOwnershipTotal(form.sectionB.shareholders || []),
    [form.sectionB.shareholders]
  );
  const canEditAllSections = hasAnyRole(user, ['SUPER_ADMIN', 'COMPANY_ADMIN']);
  const preparationEditable = ['INQUIRY_RECEIVED', 'PROPOSAL_OPTIONAL', 'LEGAL_DOCUMENTS_PENDING', 'LEGAL_DOCUMENTS_UPLOADED', 'SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED', 'DMLRO_ADDITIONAL_INFORMATION_REQUIRED', 'MLRO_ADDITIONAL_INFORMATION_REQUIRED'].includes(kycCase?.status || '') ||
    (kycCase?.status === 'AML_REVIEW_STARTED' && form.fullKycStarted === true && form.status === 'AMENDMENT_DRAFT' && !form.isLocked);
  const canPrepareKyc = hasAnyRole(user, workflowRoles.kycPreparation) && preparationEditable;
  const sectionHMode: SectionHMode = canEditAllSections ? 'ALL' : hasAnyRole(user, ['DMLRO']) ? 'DMLRO' : hasAnyRole(user, ['MLRO']) ? 'MLRO' : hasAnyRole(user, ['SEF']) ? 'SEF' : 'AML';
  const reviewerEditable = sectionHMode === 'DMLRO'
    ? ['DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS'].includes(kycCase?.status || '')
    : sectionHMode === 'MLRO'
      // The MLRO may also decide while the case still waits for an unavailable DMLRO.
      ? ['MLRO_REVIEW_PENDING', 'MLRO_REVIEW_IN_PROGRESS', ...DMLRO_STAGE_STATUSES].includes(kycCase?.status || '')
      : sectionHMode === 'SEF'
        ? ['SEF_DECISION_PENDING', 'SEF_DECISION_IN_PROGRESS'].includes(kycCase?.status || '')
        : false;
  const canEditVisibleForm = !form.isLocked && (canEditAllSections || canPrepareKyc || reviewerEditable);
  const intakeContext = useRef({ id, allowed: false });
  intakeContext.current = { id, allowed: canEditVisibleForm && (canEditAllSections || canPrepareKyc) && !saving };
  const isPreliminaryProposedCompanyForm = form.sectionA.formVariant === 'PRELIMINARY_PROPOSED_COMPANY' && !form.fullKycStarted;
  const visibleSections = useMemo(
    () => sections.filter((section) => (!isPreliminaryProposedCompanyForm || section.key !== 'sectionD') && (canEditAllSections || canPrepareKyc || section.key === 'sectionH')),
    [canEditAllSections, canPrepareKyc, isPreliminaryProposedCompanyForm]
  );

  useEffect(() => {
    if (!visibleSections.some((section) => section.key === activeSection)) {
      setActiveSection(visibleSections[0]?.key || 'sectionH');
    }
  }, [activeSection, visibleSections]);

  // A link such as /kyc/:id/form?section=sectionH (from the case checklist) opens that section directly.
  const requestedSection = searchParams.get('section');
  useEffect(() => {
    const requested = sections.find((section) => section.key === requestedSection)?.key;
    if (requested && visibleSections.some((section) => section.key === requested)) {
      setActiveSection(requested);
    } else if (canEditAllSections || canPrepareKyc) {
      setActiveSection('sectionA');
    }
  }, [id, canEditAllSections, canPrepareKyc, requestedSection, visibleSections]);

  // A change to a person's details is copied to their other rows (same QID / passport number).
  function setSection(section: SectionKey, value: Record<string, any>) {
    setForm((current) => {
      const next = syncLinkedPeople(current, { ...current, [section]: value }, kycPeople);
      formRef.current = next;
      return next;
    });
  }

  // Uploads a copy that was read into the Section F checklist row of that document type (added when missing), so
  // it does not have to be uploaded twice. Returns false when the upload failed; the values are filled either way.
  async function attachToChecklist(documentType: string, file: File) {
    if (!id) return false;
    try {
      const updatedCase = await uploadLegalDocumentFiles(id, { documentType, files: [file] });
      if (updatedCase) setKycCase(updatedCase);
      const uploaded = updatedCase?.legalDocuments.find((document) => document.documentType === documentType && document.fileName === file.name);
      const fileName = uploaded?.fileName || file.name;
      setForm((current) => {
        const sectionF = current.sectionF || {};
        const documents: Row[] = sectionF.documents || [];
        const patchRow = (row: Row) => ({
          ...row,
          isProvided: true,
          fileName: appendFileNameText(row.fileName, fileName),
          storagePath: row.storagePath || uploaded?.storagePath,
          ...(row.fileName ? {} : { mimeType: uploaded?.mimeType || file.type || undefined, size: uploaded?.size || file.size })
        });
        const nextDocuments = documents.some((row) => row.documentType === documentType)
          ? documents.map((row) => (row.documentType === documentType ? patchRow(row) : row))
          : [...documents, patchRow({ documentType, fileName: '' })];
        const next = { ...current, sectionF: { ...sectionF, documents: nextDocuments } };
        formRef.current = next;
        return next;
      });
      return true;
    } catch {
      return false;
    }
  }

  function patchSectionA(change: Record<string, any>) {
    setForm((current) => {
      const next = { ...current, sectionA: { ...current.sectionA, ...change } };
      formRef.current = next;
      return next;
    });
  }

  async function applyIntake(application: IntakeApplication) {
    if (!id || !canEditVisibleForm || !(canEditAllSections || canPrepareKyc) || saving) throw new Error('The KYC form is not available for preparation.');
    const makeNext = () => {
      if (intakeContext.current.id !== id || !intakeContext.current.allowed) throw new Error('The case or its editing access changed. Reopen the case before applying details.');
      const current = formRef.current;
      if (current.isLocked) throw new Error('This form is locked. Refresh the case before continuing.');
      if (application.kind === 'COMPANY') {
        const change = reviewedPatch(current.sectionA || {}, application.fields);
        if (!application.people.length) return { ...current, sectionA: { ...current.sectionA, ...change } };
        const found = addPeopleFromDocument(application.people, current.sectionB.shareholders || [], current.sectionC.managers || [], { ...kycPeopleLayout, preservePartialRows: true });
        return { ...current, sectionA: { ...current.sectionA, ...change }, sectionB: { ...current.sectionB, shareholders: found.shareholders.map(withDerivedIdentity) }, sectionC: { ...current.sectionC, managers: found.officers.map(withDerivedIdentity) } };
      }
      if (application.target.startsWith('new:')) {
        if (!newIntakePersonTargets.some(target => target.value === application.target)) throw new Error('Choose a person on this form.');
        const patch = reviewedPatch({}, application.fields);
        const identityPatch = { ...patch, ...('nationality' in patch ? { nationality: [patch.nationality] } : {}) };
        if (application.target === 'new:shareholder' || application.target === 'new:ubo') {
          const row = withDerivedIdentity({ ...createOwnershipRow(), ...identityPatch, isUbo: application.target === 'new:ubo' });
          const list = application.target === 'new:ubo' ? 'ubos' : 'shareholders';
          return { ...current, sectionB: { ...current.sectionB, [list]: appendReviewedPerson(current.sectionB[list] || [], row) } };
        }
        const row = withDerivedIdentity({ id: crypto.randomUUID(), ...identityPatch, position: [application.target === 'new:director' ? 'Director' : 'Manager'] });
        return { ...current, sectionC: { ...current.sectionC, managers: appendReviewedPerson(current.sectionC.managers || [], row) } };
      }
      const target = kycPeople.read(current).find(person => person.slot === application.target);
      if (!target || JSON.stringify(target.row) !== JSON.stringify(application.expectedPerson)) throw new Error('This person changed while the document was processing. Try this file again.');
      return applyAutomaticIdentity(current, kycPeople, application.target, application.fields) as KycFormData;
    };
    makeNext();
    const allowedTypes = application.kind === 'COMPANY' ? ['Other supporting document', ...requiredDocuments.filter(type => type !== IDENTITY_COPIES_DOCUMENT)] : [IDENTITY_COPIES_DOCUMENT];
    const documentType = application.documentType || allowedTypes[0];
    if (!allowedTypes.includes(documentType)) throw new Error('Choose a valid document category.');
    const attached = await attachToChecklist(documentType, application.file);
    if (!attached) throw new Error('The document could not be attached. No extracted details were applied. Try again.');
    const next = makeNext();
    formRef.current = next;
    setForm(current => {
      if (intakeContext.current.id !== id) return current;
      const combined = { ...next, sectionF: current.sectionF };
      formRef.current = combined;
      return combined;
    });
    setMessage('Document details filled automatically. Save Draft to keep the form changes.');
  }

  // Reads the company's CR into Section A: empty fields are filled, typed values that differ are listed with the
  // option to replace them. `attach` also keeps the copy in Section F (not needed when it was uploaded there).
  // `source` is a new file, or the id of a file already uploaded to the case (read without uploading it again).
  async function readCompanyCr(source: File | string, attachFile: boolean): Promise<FillOutcome> {
    if (!id) return { tone: 'warn', text: 'Save the KYC case first.' };
    const attach = attachFile && source instanceof File;
    // The CR is kept first, so it is saved even when nothing can be read from it.
    const attached = attach && source instanceof File ? await attachToChecklist(CR_DOCUMENT, source) : false;
    let reading;
    try {
      reading = await readKycCompanyDocument(id, typeof source === 'string' ? { legalDocumentId: source } : source);
    } catch {
      return { tone: 'warn', text: `${attach ? (attached ? 'The CR was uploaded, but ' : 'The CR could not be uploaded, and ') : ''}the details could not be read from it. Type them in below.` };
    }
    const result = companyFill(formRef.current.sectionA || {}, reading, crTargets);
    if (Object.keys(result.filled).length) patchSectionA(result.filled);
    const outcome = companyFillOutcome(reading, result, () => patchSectionA(result.replace), attach ? '' : ' in Section A');
    // The shareholders, directors and signatories on the CR go into Sections B and C (rows already there are kept).
    const people = reading.people.length
      ? addPeopleFromDocument(reading.people, formRef.current.sectionB?.shareholders || [], formRef.current.sectionC?.managers || [], kycPeopleLayout)
      : null;
    if (people && (people.added.length || people.updated.length)) {
      setForm((current) => {
        const next = {
          ...current,
          sectionB: { ...(current.sectionB || {}), shareholders: people.shareholders.map(withDerivedIdentity) },
          sectionC: { ...(current.sectionC || {}), managers: people.officers.map(withDerivedIdentity) }
        };
        formRef.current = next;
        return next;
      });
    }
    const extra = [
      people?.added.length ? `Added to Sections B and C: ${people.added.join('; ')}.` : '',
      people?.updated.length ? `Completed in Sections B and C: ${people.updated.join('; ')}.` : '',
      people && (people.added.length || people.updated.length) ? 'Check them there and add their passport / QID copies for the expiry dates.' : '',
      attach && !attached ? 'The CR could not be uploaded; try again or upload it in Section F.' : '',
      'Anything not filled can be typed in below.'
    ].filter(Boolean).join(' ');
    return { ...outcome, text: [outcome.text, extra].filter(Boolean).join(' ') };
  }

  function patchPerson(target: FillTarget, change: Row) {
    setForm((current) => {
      const merge = (row: Row) => (target.corporate ? { ...row, ...change } : withDerivedIdentity({ ...row, ...change }));
      let next = current;
      if (target.list === 'contact') {
        next = { ...current, sectionE: merge(current.sectionE || {}) };
      } else {
        const section = target.list === 'managers' ? 'sectionC' : 'sectionB';
        const data = current[section] || {};
        const rows: Row[] = data[target.list] || [];
        next = { ...current, [section]: { ...data, [target.list]: rows.map((row, index) => (index === target.index ? merge(row) : row)) } };
      }
      next = syncLinkedPeople(current, next, kycPeople);
      formRef.current = next;
      return next;
    });
  }

  // "Same person as ...": copies the chosen person's details onto this row (not a change to copy to other rows).
  function pickSamePerson(slot: string, sourceSlot: string) {
    setForm((current) => {
      const source = kycPeople.read(current).find((person) => person.slot === sourceSlot);
      if (!source) return current;
      const next = kycPeople.write(current, slot, personDetails(source.row));
      formRef.current = next;
      return next;
    });
  }

  async function readPersonCopy(target: FillTarget, source: File | string, kind: string): Promise<FillOutcome> {
    if (!id) return { tone: 'warn', text: 'Save the KYC case first.' };
    const stored = typeof source === 'string' ? { legalDocumentId: source } : source;
    const keptNote = (attached: boolean, documentType: string, what: string) => (typeof source === 'string'
      ? `Read from the file already uploaded.`
      : attached ? `The ${what} was added to Section F (${documentType}).` : `The ${what} could not be added to Section F; upload it there.`);
    if (target.corporate) {
      const reading = await readKycCompanyDocument(id, stored);
      const attached = source instanceof File ? await attachToChecklist(CORPORATE_PARTY_CR_DOCUMENT, source) : false;
      const result = companyFill(target.row, reading, [
        { field: 'legalName', key: 'fullName', label: 'company name' },
        { field: 'commercialRegistrationNo', key: 'identityNumber', label: 'CR number' },
        { field: 'dateOfIncorporation', key: 'dateOfBirth', label: 'date of incorporation' },
        { field: 'registeredOfficeAddress', key: 'residenceAddress', label: 'registered address' }
      ]);
      if (Object.keys(result.filled).length) patchPerson(target, result.filled);
      const outcome = companyFillOutcome(reading, result, () => patchPerson(target, result.replace));
      return { ...outcome, text: `${outcome.text} ${keptNote(attached, CORPORATE_PARTY_CR_DOCUMENT, 'CR')}` };
    }
    const readType = kind as IdentityType;
    const result = await readKycIdentityDocument(id, readType, stored);
    const attached = source instanceof File ? await attachToChecklist(IDENTITY_COPIES_DOCUMENT, source) : false;
    const { change, outcome } = identityFill(target.row, result, readType);
    if (Object.keys(change).length) patchPerson(target, change);
    return { ...outcome, text: `${outcome.text} ${keptNote(attached, IDENTITY_COPIES_DOCUMENT, 'copy')}` };
  }

  // Files already uploaded to the case (KYC documents page, case page, enquiry attachments) that can be read here.
  function uploadedFiles(kind: 'company' | 'party' | 'identity') {
    const pattern = kind === 'company'
      ? /commercial\s*registration|cr\s*extract|corporate\s*documents\s*-\s*company/i
      : kind === 'party'
        ? /legal\s*entity\s*parties|corporate\s*(?:shareholder\s*)?documents|corporate\s*shareholder/i
        : /qid|passport|identity/i;
    return (kycCase?.legalDocuments || [])
      .filter((document) => document.storagePath && /\.(pdf|png|jpe?g|gif|webp)$/i.test(document.fileName) && pattern.test(document.documentType))
      .map((document) => ({ value: document.id, label: `${document.fileName} (${document.documentType})` }));
  }

  // Expiry dates are kept with the person (and feed the client record and its reminders) but are not form fields.
  const renderFillBar: FillBarRenderer = (target) => {
    const expiries = target.corporate ? '' : [target.row.qidExpiry ? `QID expiry ${target.row.qidExpiry}` : '', target.row.passportExpiry ? `passport expiry ${target.row.passportExpiry}` : ''].filter(Boolean).join(' · ');
    return (
      <div key={`fill-${target.list}-${target.index}`} className="min-w-0 space-y-2 md:col-span-2" style={{ gridColumn: '1 / -1' }}>
        {target.corporate ? null : <SamePersonPicker people={kycPeople.read(form)} slot={fillTargetSlot(target)} onPick={(source) => pickSamePerson(fillTargetSlot(target), source)} disabled={!canEditVisibleForm} />}
        <DocumentFillBar
          label={target.corporate ? "Fill from the company's CR:" : 'Fill from a copy:'}
          options={target.corporate ? [{ value: 'COMPANY', label: 'CR' }] : [{ value: 'PASSPORT', label: 'Passport' }, { value: 'QID', label: 'QID (back side)' }]}
          onRead={(file, kind) => readPersonCopy(target, file, kind)}
          existing={uploadedFiles(target.corporate ? 'party' : 'identity')}
          onReadExisting={(documentId, kind) => readPersonCopy(target, documentId, kind)}
          disabled={!canEditVisibleForm}
        />
        {expiries ? <p className="mt-1 text-xs text-slate-600">On file: {expiries}</p> : null}
      </div>
    );
  };

  async function save(section: SectionKey) {
    if (!id) return;
    if (!canEditVisibleForm || saving) return null;
    setSaving(true);
    setMessage('');
    setError('');
    const endpoint = sections.find((item) => item.key === section)?.id;
    if (!endpoint) return;

    const currentForm = formRef.current;
    const payload =
      section === 'sectionB'
        ? { ...currentForm.sectionB, totalOwnershipPercentage: totalOwnership }
        : section === 'sectionH'
          ? { ...(currentForm.sectionH || {}), reviewPart: sectionHMode }
          : (currentForm[section] as Record<string, any>);
    try {
      const updated = await saveKycFormSection(id, endpoint, { ...payload, expectedVersion: currentForm.version });
      const normalized = normalizeForm(updated);
      formRef.current = normalized;
      setForm(normalized);
      setMessage('Draft saved');
      return normalizeForm(updated);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, 'Unable to save this KYC section.'));
      return null;
    } finally {
      setSaving(false);
    }
  }

  function fullDraftPayload(currentForm: KycFormData): Partial<KycFormData> {
    if (canEditAllSections || canPrepareKyc) {
      return {
        version: currentForm.version,
        sectionA: currentForm.sectionA,
        sectionB: { ...currentForm.sectionB, totalOwnershipPercentage: totalOwnership },
        sectionC: currentForm.sectionC,
        sectionD: currentForm.sectionD,
        sectionE: currentForm.sectionE,
        sectionF: currentForm.sectionF,
        sectionG: currentForm.sectionG,
        sectionH: { ...(currentForm.sectionH || {}), reviewPart: sectionHMode }
      };
    }

    return {
      version: currentForm.version,
      sectionH: { ...(currentForm.sectionH || {}), reviewPart: sectionHMode }
    };
  }

  async function saveDraft() {
    if (!id) return null;
    if (!canEditVisibleForm) return null;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const updated = await autoSaveKycForm(id, fullDraftPayload(formRef.current));
      const normalized = normalizeForm(updated);
      formRef.current = normalized;
      setForm(normalized);
      setMessage('Draft saved');
      return normalized;
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, 'Unable to save this KYC draft.'));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function generate(type: 'docx' | 'pdf') {
    if (!id || generatingType) return;
    setGeneratingType(type);
    setSaving(true);
    setMessage('');
    setError('');
    try {
      if (canEditVisibleForm) {
        const saved = await saveDraft();
        if (!saved) return;
      }
      const document = await generateKycDocument(id, type);
      const updated = await getKycForm(id);
      const normalized = normalizeForm(updated);
      formRef.current = normalized;
      setForm(normalized);
      await downloadGeneratedKycDocument(id, document.id, document.fileName);
      setMessage(`${type.toUpperCase()} generated and downloaded`);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, `Unable to generate ${type.toUpperCase()} document.`));
    } finally {
      setSaving(false);
      setGeneratingType('');
    }
  }

  async function openReviewPackage(tab: ReviewPackageTab) {
    if (!id) return;
    setActiveReviewPackage(tab);
    setReviewPackageError('');
    if (tab === 'kyc') return;

    if (tab === 'screening' && screeningContext) return;
    if (tab === 'crrf' && crrfWorkspace) return;

    setLoadingReviewPackage(tab);
    try {
      if (tab === 'screening') {
        setScreeningContext(await getScreeningContext(id));
      } else {
        setCrrfWorkspace(await getCrrfWorkspace(id));
      }
    } catch (requestError: any) {
      setReviewPackageError(getApiErrorMessage(requestError, `Unable to load ${tab === 'screening' ? 'Screening' : 'CRRF'} details.`));
    } finally {
      setLoadingReviewPackage('');
    }
  }

  async function submitDmlroFromKycForm() {
    if (!id) return;
    const sectionH = form.sectionH || {};
    const decision = sectionH.dmlroDecision || 'APPROVE';
    const reason = [sectionH.dmlroReason, sectionH.dmlroComments].find(hasTypedText) || '';
    const conditions = sectionH.dmlroConditions || '';
    // Returning the file only needs a typed reason; name, date and signature are required for approvals.
    const isReturn = ['REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_SUPERVISOR'].includes(decision);
    if (isReturn && !reason) {
      setError('Type the reason for returning the file to AML Supervisor before submitting.');
      return;
    }
    if (!isReturn && (!sectionH.dmlroName || !sectionH.dmlroDate || (!sectionH.dmlroSignatureDataUrl && !sectionH.dmlroSignatureFileName))) {
      setError('Complete the DMLRO name, date, and signature before submitting the DMLRO decision.');
      return;
    }
    if (['APPROVE_WITH_CONDITIONS', 'DMLRO_FINAL_APPROVE'].includes(decision) && !reason && !conditions) {
      setError('Add DMLRO reason, conditions, or comments before submitting this decision.');
      return;
    }
    if (!confirmReviewDecision('DMLRO', decision, dmlroDecisionLabels[decision] || decision)) return;

    setSaving(true);
    setMessage('');
    setError('');
    try {
      const saved = await save('sectionH');
      if (!saved) return;
      const latestSectionH = saved.sectionH || sectionH;
      await submitDmlroReview(id, {
        decision,
        reason,
        conditions,
        data: {
          reviewerName: latestSectionH.dmlroName || '',
          reviewDate: latestSectionH.dmlroDate || '',
          comments: latestSectionH.dmlroComments || '',
          decision,
          reason,
          conditions
        },
        // The backend requires DMLRO comments; for a return the typed reason serves as the comment.
        formalComments: hasTypedText(latestSectionH.dmlroComments) || !isReturn ? latestSectionH.dmlroComments || '' : reason
      });
      const [caseData, formData] = await Promise.all([getKycCase(id), getKycForm(id)]);
      const normalized = normalizeForm(formData, caseData);
      setKycCase(caseData);
      formRef.current = normalized;
      setForm(normalized);
      // Back to the case page, where the new status and the next step are shown, so the decision is not sent twice.
      navigate(`/kyc/${id}`, { state: { reviewNotice: dmlroDecisionSuccessMessage(decision) } });
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, dmlroDecisionErrorMessage(decision)));
    } finally {
      setSaving(false);
    }
  }

  async function submitMlroFromKycForm() {
    if (!id) return;
    const sectionH = form.sectionH || {};
    const decision = sectionH.mlroDecision || 'APPROVE';
    const finalRiskClassification = sectionH.mlroFinalRiskClassification || sectionH.riskClassification || '';
    const riskExplanation = sectionH.mlroRiskExplanation || sectionH.mlroComments || '';
    // Returning the file only needs a typed reason; name, date, signature and risk fields are required for other decisions.
    const isReturn = ['RETURN_TO_DMLRO', 'REQUEST_ADDITIONAL_INFORMATION'].includes(decision);
    const returnReason = hasTypedText(sectionH.mlroComments);

    if (!decision) {
      setError('Select the MLRO final decision before submitting.');
      return;
    }
    if (isReturn && !returnReason) {
      setError(decision === 'RETURN_TO_DMLRO' ? 'Type the reason for returning the file to DMLRO before submitting.' : 'Type the additional information requested before submitting.');
      return;
    }
    if (!isReturn && (!sectionH.mlroName || !sectionH.mlroDate || (!sectionH.mlroSignatureDataUrl && !sectionH.mlroSignatureFileName))) {
      setError('Complete the MLRO name, date, and signature before submitting the final decision.');
      return;
    }
    if (!isReturn && (!finalRiskClassification || !riskExplanation)) {
      setError('Select the final risk classification and add a risk explanation before submitting the final decision.');
      return;
    }
    if (finalRiskClassification === 'HIGH' && ['APPROVE', 'APPROVE_WITH_CONDITIONS'].includes(decision)) {
      setError('High-risk KYC files must be sent to SEF for management decision before final approval.');
      return;
    }
    if (!confirmReviewDecision('MLRO', decision, mlroDecisionLabels[decision] || decision)) return;

    setSaving(true);
    setMessage('');
    setError('');
    try {
      const saved = await save('sectionH');
      if (!saved) return;
      const latestSectionH = saved.sectionH || sectionH;
      await decideMlroReview(id, {
        decision,
        reason: latestSectionH.mlroComments || latestSectionH.mlroRiskExplanation || latestSectionH.mlroConditions || '',
        conditions: latestSectionH.mlroConditions || '',
        // A return does not reclassify risk unless the MLRO explained a new classification.
        finalRiskClassification: isReturn && !sectionH.mlroRiskExplanation ? '' : finalRiskClassification,
        previousRiskClassification: latestSectionH.riskClassification || '',
        riskReasonCategory: latestSectionH.mlroRiskReasonCategory || 'PROFESSIONAL_JUDGEMENT',
        riskExplanation,
        data: {
          reviewerName: latestSectionH.mlroName || '',
          reviewDate: latestSectionH.mlroDate || '',
          comments: latestSectionH.mlroComments || '',
          conditions: latestSectionH.mlroConditions || '',
          decision,
          finalRiskClassification,
          riskReasonCategory: latestSectionH.mlroRiskReasonCategory || 'PROFESSIONAL_JUDGEMENT',
          riskExplanation
        },
        formalComments: latestSectionH.mlroComments || ''
      });
      const [caseData, formData] = await Promise.all([getKycCase(id), getKycForm(id)]);
      const normalized = normalizeForm(formData, caseData);
      setKycCase(caseData);
      formRef.current = normalized;
      setForm(normalized);
      navigate(`/kyc/${id}`, { state: { reviewNotice: mlroDecisionSuccessMessage(decision) } });
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, mlroDecisionErrorMessage(decision)));
    } finally {
      setSaving(false);
    }
  }

  async function submitSefFromKycForm() {
    if (!id) return;
    const sectionH = form.sectionH || {};
    const decision = sectionH.sefDecision || 'APPROVE';
    // Returning to MLRO only needs a typed reason; name, date and signature are required for other decisions.
    const isReturn = decision === 'RETURN_TO_MLRO';

    if (isReturn && !hasTypedText(sectionH.sefConditions) && !hasTypedText(sectionH.sefComments)) {
      setError('Type the reason for returning the file to MLRO before submitting.');
      return;
    }
    if (!isReturn && (!sectionH.sefName || !sectionH.sefDate || (!sectionH.sefSignatureDataUrl && !sectionH.sefSignatureFileName))) {
      setError('Complete the SEF name, date, and signature before submitting the management decision.');
      return;
    }
    if (['APPROVE_WITH_CONDITIONS', 'RETURN_TO_MLRO', 'REJECT'].includes(decision) && !sectionH.sefConditions && !sectionH.sefComments) {
      setError('Add SEF conditions or comments before submitting this decision.');
      return;
    }
    if (!confirmReviewDecision('SEF', decision, sefDecisionLabels[decision] || decision)) return;

    setSaving(true);
    setMessage('');
    setError('');
    try {
      const saved = await save('sectionH');
      if (!saved) return;
      const latestSectionH = saved.sectionH || sectionH;
      await decideSefReview(id, {
        decision,
        reason: [latestSectionH.sefComments, latestSectionH.sefConditions].find(hasTypedText) || '',
        conditions: latestSectionH.sefConditions || '',
        data: {
          reviewerName: latestSectionH.sefName || '',
          reviewDate: latestSectionH.sefDate || '',
          comments: latestSectionH.sefComments || '',
          conditions: latestSectionH.sefConditions || '',
          decision
        },
        formalComments: latestSectionH.sefComments || ''
      });
      const [caseData, formData] = await Promise.all([getKycCase(id), getKycForm(id)]);
      const normalized = normalizeForm(formData, caseData);
      setKycCase(caseData);
      formRef.current = normalized;
      setForm(normalized);
      navigate(`/kyc/${id}`, { state: { reviewNotice: sefDecisionSuccessMessage(decision) } });
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, sefDecisionErrorMessage(decision)));
    } finally {
      setSaving(false);
    }
  }

  if (!kycCase) {
    return (
      <div className="space-y-3">
        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <p className="text-sm text-slate-500">Loading KYC form builder...</p>
      </div>
    );
  }

  const isApproved = approvedStatuses.includes(kycCase.status as (typeof approvedStatuses)[number]);
  const canOpenScreening = hasAnyRole(user, workflowRoles.screening);
  const canOpenCrrf = hasAnyRole(user, workflowRoles.crrf);
  const showReviewPackage = sectionHMode !== 'AML' || hasAnyRole(user, ['COMPANY_ADMIN', 'SUPER_ADMIN']);
  const dmlroDecision = form.sectionH?.dmlroDecision || 'APPROVE';
  const dmlroSubmitLabel =
    dmlroDecision === 'RETURN_TO_SUPERVISOR'
      ? 'Return to AML Supervisor'
      : dmlroDecision === 'REQUEST_ADDITIONAL_INFORMATION'
        ? 'Request Additional Information'
        : dmlroDecision === 'DMLRO_FINAL_APPROVE'
          ? 'Submit Final Approval'
          : 'Submit to MLRO';
  const mlroDecision = form.sectionH?.mlroDecision || 'APPROVE';
  const mlroSubmitLabel =
    mlroDecision === 'RETURN_TO_DMLRO'
      ? 'Return to DMLRO'
      : mlroDecision === 'SEND_TO_SEF'
        ? 'Send to SEF'
        : mlroDecision === 'REQUEST_ADDITIONAL_INFORMATION'
          ? 'Request Additional Information'
          : mlroDecision === 'REJECT'
            ? 'Submit Rejection'
            : 'Submit Final Decision';
  const sefDecision = form.sectionH?.sefDecision || 'APPROVE';
  const sefSubmitLabel =
    sefDecision === 'RETURN_TO_MLRO'
      ? 'Return to MLRO'
      : sefDecision === 'REJECT'
        ? 'Submit Rejection'
        : sefDecision === 'APPROVE_WITH_CONDITIONS'
          ? 'Approve with Conditions'
          : 'Approve KYC';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div>
          <Link to={`/kyc/${kycCase.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-900">
            Back to case
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">KYC Form Builder</h1>
          <p className="text-sm text-slate-500">
            {kycCase.client.name} | {kycCase.service?.name || 'Service not selected'} | Version {form.version}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap gap-2">
          {canEditVisibleForm ? <button onClick={saveDraft} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button> : null}
          {sectionHMode === 'DMLRO' && canEditVisibleForm ? (
            <button onClick={submitDmlroFromKycForm} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Send className="h-4 w-4" />
              {dmlroSubmitLabel}
            </button>
          ) : null}
          {sectionHMode === 'MLRO' && canEditVisibleForm ? (
            <button onClick={submitMlroFromKycForm} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Send className="h-4 w-4" />
              {mlroSubmitLabel}
            </button>
          ) : null}
          {sectionHMode === 'SEF' && canEditVisibleForm ? (
            <button onClick={submitSefFromKycForm} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Send className="h-4 w-4" />
              {sefSubmitLabel}
            </button>
          ) : null}
          <button onClick={() => generate('docx')} disabled={Boolean(generatingType)} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60">
            {generatingType === 'docx' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generatingType === 'docx' ? 'Preparing…' : 'DOCX'}
          </button>
          <button onClick={() => generate('pdf')} disabled={Boolean(generatingType)} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
            {generatingType === 'pdf' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {generatingType === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
        </div>
      </div>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {!canEditVisibleForm ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">KYC preparation is locked while this case is under review. Only the assigned review role can record its decision.</p> : null}
      {sectionHMode === 'MLRO' && canEditVisibleForm && DMLRO_STAGE_STATUSES.includes(kycCase.status) ? (
        <p role="status" className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          <span className="font-semibold">DMLRO has not reviewed this case yet.</span> As MLRO you can decide it now, for example while DMLRO is away. Complete your part of Section H and submit; your MLRO comments are recorded as the reason, and the open DMLRO task is closed.
        </p>
      ) : null}

      {showReviewPackage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Review Package</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Use these sections together before submitting the next review decision. Select Screening or CRRF to review their details without leaving this screen.</p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto">
              <ReviewPackageButton
                active={activeReviewPackage === 'kyc'}
                onClick={() => openReviewPackage('kyc')}
                icon={<FileText className="h-5 w-5" />}
                title="KYC Form"
                description="Current review screen"
              />
              {canOpenScreening ? (
                <ReviewPackageButton
                  active={activeReviewPackage === 'screening'}
                  onClick={() => openReviewPackage('screening')}
                  icon={<SearchCheck className="h-5 w-5" />}
                  title="Screening"
                  description="Results and evidence"
                />
              ) : null}
              {canOpenCrrf ? (
                <ReviewPackageButton
                  active={activeReviewPackage === 'crrf'}
                  onClick={() => openReviewPackage('crrf')}
                  icon={<FileSpreadsheet className="h-5 w-5" />}
                  title="CRRF"
                  description="Risk rating and files"
                />
              ) : null}
            </div>
          </div>
          {reviewPackageError ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{reviewPackageError}</p> : null}
          {activeReviewPackage === 'screening' ? (
            <ScreeningPackageDetails context={screeningContext} loading={loadingReviewPackage === 'screening'} />
          ) : null}
          {activeReviewPackage === 'crrf' ? (
            <CrrfPackageDetails workspace={crrfWorkspace} loading={loadingReviewPackage === 'crrf'} />
          ) : null}
        </section>
      ) : null}

      {activeReviewPackage === 'kyc' && isApproved ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-base font-semibold text-emerald-900">KYC approval completed</p>
              <p className="mt-1 text-sm text-emerald-700">
                The client profile, KYC form sections, uploaded preparation documents, approval details, and generated downloads are stored against this KYC case.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => generate('docx')} disabled={Boolean(generatingType)} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60">
                {generatingType === 'docx' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {generatingType === 'docx' ? 'Preparing DOCX…' : 'Download DOCX'}
              </button>
              <button onClick={() => generate('pdf')} disabled={Boolean(generatingType)} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
                {generatingType === 'pdf' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {generatingType === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
              </button>
              <Link to={`/kyc/${kycCase.id}`} className="inline-flex items-center gap-2 rounded-md border border-brand-200 bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                View Case Summary
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <div hidden={activeReviewPackage !== 'kyc'}>
        {canEditVisibleForm && (canEditAllSections || canPrepareKyc) && <DocumentIntakePanel key={id} company={form.sectionA} companyTargets={crTargets} attachmentTypes={{ COMPANY: ['Other supporting document', ...requiredDocuments.filter(type => type !== IDENTITY_COPIES_DOCUMENT)], IDENTITY: [IDENTITY_COPIES_DOCUMENT] }} targets={[...kycPeople.read(form).filter(person => !person.hidden).map(person => ({ value: person.slot, label: `${person.row.fullName || 'Unnamed person'} (${person.role})`, row: person.row, nationalityOptions: person.slot === 'contact' ? nationalityOptions : countryOptions })), ...newIntakePersonTargets.map(target => ({ ...target, nationalityOptions: countryOptions }))]} disabled={saving || Boolean(generatingType)} read={(file, kind) => {
          if (!id) throw new Error('Save the KYC case first.');
          return readIntakeDocument(file, kind, value => readKycCompanyDocument(id, value), (type, value) => readKycIdentityDocument(id, type, value));
        }} apply={applyIntake} />}
      </div>

      {activeReviewPackage === 'kyc' ? (
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[190px_minmax(0,1fr)_minmax(0,1.05fr)]">
          <KycFormSectionSidebar sections={visibleSections} active={activeSection} onChange={setActiveSection} />
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500">{isPreliminaryProposedCompanyForm ? 'Preliminary KYC' : 'KYC form'}</p><span className="text-xs tabular-nums text-slate-400">{visibleSections.findIndex((item) => item.key === activeSection) + 1} / {visibleSections.length}</span></div>
              <h2 className="text-base font-semibold text-slate-950">{sections.find((item) => item.key === activeSection)?.label}</h2>
            </div>
            <fieldset disabled={!canEditVisibleForm} className="min-w-0 overflow-x-auto p-5 disabled:opacity-75 xl:max-h-[calc(100dvh-250px)] xl:overflow-y-auto">
              {activeSection === 'sectionA' ? <SectionAForm data={form.sectionA} onChange={(value) => setSection('sectionA', value)} onReadCr={(file) => readCompanyCr(file, true)} uploadedCrs={uploadedFiles('company')} onReadUploadedCr={(documentId) => readCompanyCr(documentId, false)} crFileNames={fileNameList((form.sectionF?.documents || []).find((row: Row) => row.documentType === CR_DOCUMENT)?.fileName)} /> : null}
              {activeSection === 'sectionB' ? (
                <SectionBForm
                  data={form.sectionB}
                  total={totalOwnership}
                  rootName={form.sectionA.legalName || kycCase.client.name}
                  currentClientId={kycCase.client.id}
                  onChange={(value) => setSection('sectionB', value)}
                  fillBar={renderFillBar}
                />
              ) : null}
              {activeSection === 'sectionC' ? <SectionCForm data={form.sectionC} onChange={(value) => setSection('sectionC', value)} fillBar={renderFillBar} /> : null}
              {activeSection === 'sectionD' ? <SectionDComplianceForm data={form.sectionD} onChange={(value) => setSection('sectionD', value)} personFlags={personFlags(form)} /> : null}
              {activeSection === 'sectionE' ? <SectionEContactForm data={form.sectionE} onChange={(value) => setSection('sectionE', value)} fillBar={renderFillBar} /> : null}
              {activeSection === 'sectionF' ? <SectionFRequiredDocumentsChecklist caseId={id || ''} data={form.sectionF} onChange={(value) => setSection('sectionF', value)} onCompanyDocumentUploaded={(file) => readCompanyCr(file, false)} /> : null}
              {activeSection === 'sectionG' ? <SectionGDeclarationForm data={form.sectionG} onChange={(value) => setSection('sectionG', value)} people={kycPeople.read(form)} /> : null}
              {activeSection === 'sectionH' ? <SectionHInternalReviewForm mode={sectionHMode} data={form.sectionH || {}} onChange={(value) => setSection('sectionH', value)} /> : null}
            </fieldset>
          </section>
          <LiveDocumentPreviewPanel form={{ ...form, sectionB: { ...form.sectionB, totalOwnershipPercentage: totalOwnership } }} />
        </div>
      ) : null}
    </div>
  );
}

function KycFormSectionSidebar({ sections, active, onChange }: { sections: SectionDefinition[]; active: SectionKey; onChange: (key: SectionKey) => void }) {
  return (
    <aside aria-label="KYC form sections" className="min-w-0 rounded-lg border border-slate-200 bg-white p-2 xl:col-span-2 2xl:sticky 2xl:top-20 2xl:col-span-1 2xl:h-fit"><div className="flex gap-1 overflow-x-auto 2xl:flex-col">
      {sections.map((section, index) => (
        <button
          key={section.key}
          type="button"
          onClick={() => onChange(section.key)}
          aria-current={active === section.key ? 'step' : undefined}
          className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium 2xl:w-full ${active === section.key ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${active === section.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span><span>{section.label.replace(/^[A-H]\.\s*/, '')}</span>
        </button>
      ))}
    </div></aside>
  );
}

// Where each value read from a company's CR goes in Section A.
const crTargets: CompanyTarget[] = [
  { field: 'legalName', key: 'legalName', label: 'legal name' },
  { field: 'commercialRegistrationNo', key: 'commercialRegistrationNo', label: 'CR number' },
  { field: 'taxIdentificationNo', key: 'taxIdentificationNo', label: 'tax number' },
  { field: 'dateOfIncorporation', key: 'dateOfIncorporation', label: 'date of incorporation' },
  { field: 'crExpiryDate', key: 'crExpiryDate', label: 'CR expiry date' },
  { field: 'countryOfIncorporation', key: 'countryOfIncorporation', label: 'country of incorporation', options: countryOptions, otherKey: 'countryOfIncorporationOther' },
  { field: 'legalForm', key: 'legalForm', label: 'legal form', options: legalFormOptions, otherKey: 'legalFormOther' },
  { field: 'registeredOfficeAddress', key: 'registeredOfficeAddress', label: 'registered office address' },
  { field: 'licenseActivities', key: 'licenseActivities', label: 'license activities' }
];

function SectionAForm({ data, onChange, onReadCr, crFileNames = [], uploadedCrs = [], onReadUploadedCr }: FormProps & { onReadCr?: (file: File) => Promise<FillOutcome>; crFileNames?: string[]; uploadedCrs?: Array<{ value: string; label: string }>; onReadUploadedCr?: (documentId: string) => Promise<FillOutcome> }) {
  function setCountryOfIncorporation(country: string) {
    onChange({
      ...data,
      countryOfIncorporation: country,
      ...(country === 'Other' ? {} : { countryOfIncorporationOther: '' }),
      telephone: applyCountryDialCode(data.telephone || '', country)
    });
  }

  function setTelephone(telephone: string) {
    onChange({
      ...data,
      telephone: applyCountryDialCode(telephone, data.countryOfIncorporation || '')
    });
  }

  return (
    <FormGrid>
      {onReadCr ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" style={{ gridColumn: '1 / -1' }}>
          <p className="text-sm font-semibold text-slate-950">Commercial Registration (CR) copy</p>
          <p className="mt-1 text-xs text-slate-500">Upload the company's CR and the company details below are filled in automatically. Anything that is not read can be typed in by hand. Fields you have already typed are not changed.</p>
          <p className="mt-2 text-xs text-slate-700">{crFileNames.length ? `Uploaded: ${crFileNames.join(', ')}` : 'No CR uploaded yet.'}</p>
          <div className="mt-2">
            <DocumentFillBar label="CR (PDF or image):" buttonLabel={crFileNames.length ? 'Upload another CR' : 'Upload CR'} options={[{ value: 'COMPANY', label: 'CR' }]} onRead={(file) => onReadCr(file)} existing={uploadedCrs} onReadExisting={onReadUploadedCr ? (documentId) => onReadUploadedCr(documentId) : undefined} />
          </div>
        </div>
      ) : null}
      <Field label="Date" type="date" value={data.date} onChange={(value) => update(data, onChange, 'date', value)} />
      <Field label="KYC Number" value={data.reference} onChange={(value) => update(data, onChange, 'reference', value)} />
      <Field label="Legal Name of Company *" value={data.legalName} onChange={(value) => update(data, onChange, 'legalName', value)} wide />
      <Field label="Commercial Registration No. *" value={data.commercialRegistrationNo} onChange={(value) => update(data, onChange, 'commercialRegistrationNo', value)} />
      <Field label="Tax Identification No." value={data.taxIdentificationNo} onChange={(value) => update(data, onChange, 'taxIdentificationNo', value)} />
      <Field label="Date of Incorporation *" type="date" value={data.dateOfIncorporation} onChange={(value) => update(data, onChange, 'dateOfIncorporation', value)} />
      <Field label="CR Expiry Date" type="date" value={data.crExpiryDate} onChange={(value) => update(data, onChange, 'crExpiryDate', value)} />
      <Select label="Country of Incorporation *" value={data.countryOfIncorporation} otherValue={data.countryOfIncorporationOther} options={countryOptions} onChange={setCountryOfIncorporation} onOtherChange={(value) => update(data, onChange, 'countryOfIncorporationOther', value)} allowOther />
      <Select label="Legal Form *" value={data.legalForm} otherValue={data.legalFormOther} options={legalFormOptions} onChange={(value) => updateSelect(data, onChange, 'legalForm', value)} onOtherChange={(value) => update(data, onChange, 'legalFormOther', value)} allowOther />
      <Field label="Telephone *" value={applyCountryDialCode(data.telephone || '', data.countryOfIncorporation || '')} onChange={setTelephone} />
      <Field label="Email *" type="email" value={data.email} onChange={(value) => update(data, onChange, 'email', value)} />
      <Field label="Website" value={data.website} onChange={(value) => update(data, onChange, 'website', value)} />
      <Field label="Registered Office Address *" value={data.registeredOfficeAddress} onChange={(value) => update(data, onChange, 'registeredOfficeAddress', value)} wide textarea />
      <Select label="Main purpose / nature of business *" value={data.businessNature} otherValue={data.businessNatureOther} options={businessNatureOptions} onChange={(value) => updateSelect(data, onChange, 'businessNature', value)} onOtherChange={(value) => update(data, onChange, 'businessNatureOther', value)} wide allowOther />
      <Field label="License activities" value={data.licenseActivities} onChange={(value) => update(data, onChange, 'licenseActivities', value)} wide textarea />
      <Select label="Related Industry *" value={data.relatedIndustry} otherValue={data.relatedIndustryOther} options={industryOptions} onChange={(value) => updateSelect(data, onChange, 'relatedIndustry', value)} onOtherChange={(value) => update(data, onChange, 'relatedIndustryOther', value)} wide allowOther />
      <MultiSelect label="Nature of prospective service from Newoon *" value={listValue(data.prospectiveService).filter((service) => service !== 'Other')} options={prospectiveServiceOptions} onChange={(value) => onChange({ ...data, prospectiveService: value, prospectiveServiceOther: '' })} wide />
    </FormGrid>
  );
}

function createOwnershipRow(): Row {
  return {
    id: crypto.randomUUID(),
    shareholderType: 'Individual',
    parentRowId: '',
    isUbo: false
  };
}

function directOwnershipTotal(rows: Row[]) {
  return rows.filter((row) => !row.parentRowId).reduce((sum, row) => sum + Number(row.shareholderPercentage ?? row.ownershipPercentage ?? 0), 0);
}

function ownershipLayerTotals(rows: Row[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const parentKey = row.parentRowId || 'ROOT';
    totals.set(parentKey, (totals.get(parentKey) || 0) + Number(row.shareholderPercentage ?? row.ownershipPercentage ?? 0));
  });
  return totals;
}

function effectiveUboRows(sectionB: Record<string, any>) {
  return mergeBeneficialOwners<Row>(sectionB.shareholders || [], sectionB.ubos || []);
}

function uboInterestTotal(sectionB: Record<string, any>) {
  return effectiveUboRows(sectionB).reduce((sum: number, row: Row) => sum + Number(row.uboInterestPercentage ?? row.ownershipPercentage ?? 0), 0);
}

function SectionBForm({ data, total, rootName, currentClientId, onChange, fillBar }: FormProps & { total: number; rootName: string; currentClientId: string; fillBar?: FillBarRenderer }) {
  const shareholders = data.shareholders || [];
  const totals = ownershipLayerTotals(shareholders);
  const invalidLayerTotals = Array.from(totals.entries()).filter(([, layerTotal]) => layerTotal > 100);
  const hasUbo = shareholders.some((row: Row) => row.isUbo) || Boolean(data.ubos?.length);
  const totalUboPercentage = uboInterestTotal(data);

  return (
    <div className="space-y-5">
      <OwnershipRows rootName={rootName} currentClientId={currentClientId} rows={shareholders} onChange={(rows) => onChange({ ...data, shareholders: rows })} fillBar={fillBar} />
      <div className={`rounded-md border p-3 text-sm font-semibold ${invalidLayerTotals.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        Total shareholder %: {total.toFixed(2)}% | Total UBO %: {totalUboPercentage.toFixed(2)}%
        {invalidLayerTotals.length ? <span className="ml-2 font-medium">One or more control layers exceed 100%.</span> : null}
      </div>
      {!hasUbo ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
          No beneficial person is marked yet. You can save the draft, but mark the beneficial person before finalizing the KYC file.
        </div>
      ) : null}
      <OwnershipStructureDiagram rootName={rootName} rows={shareholders} ubos={data.ubos || []} />
      {(data.ubos || []).map((ubo: Row, index: number) => <label key={ubo.id || index} className="block text-sm font-medium text-slate-700">Corporate shareholder for {ubo.fullName || `beneficial owner ${index + 1}`}<select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={ubo.parentRowId || ''} onChange={(event) => onChange({ ...data, ubos: data.ubos.map((row: Row, rowIndex: number) => rowIndex === index ? { ...row, parentRowId: event.target.value } : row) })}><option value="">Direct beneficial owner</option>{shareholders.filter((party: Row) => party.shareholderType === 'Corporate Entity').map((party: Row) => <option key={party.id} value={party.id}>{party.fullName || 'Unnamed corporate shareholder'}</option>)}</select></label>)}
      <Choice label="Beneficial person different from listed parties" value={data.uboDifferentFromShareholders || 'No'} onChange={(value) => onChange({ ...data, uboDifferentFromShareholders: value })} />
      <Field label="Beneficial structure notes" value={data.uboGroupStructureNotes} onChange={(value) => update(data, onChange, 'uboGroupStructureNotes', value)} textarea wide />
      <DynamicRows title="Beneficial person rows" rows={data.ubos || []} onChange={(rows) => onChange({ ...data, ubos: rows.map(withDerivedIdentity) })} rowExtra={fillBar ? (row, index) => fillBar({ list: 'ubos', index, row }) : undefined} fields={[
        ['fullName', 'Full name'], ['nationality', 'Nationality', 'multiselect', countryOptions], ['dateOfBirth', 'Date of birth', 'date'], ['qidNumber', 'QID number'], ['passportNumber', 'Passport number'], ['identityNumber', '', 'legacyIdentity'], ...personDeclarationFields, ['uboInterestPercentage', 'UBO Interest %', 'number'], ['residenceAddress', 'Residence address']
      ]} />
    </div>
  );
}

function OwnershipRows({ rootName, currentClientId, rows, onChange, fillBar }: { rootName: string; currentClientId: string; rows: Row[]; onChange: (rows: Row[]) => void; fillBar?: FillBarRenderer }) {
  const [lookupMessages, setLookupMessages] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const corporateParents = rows.filter((row) => (row.shareholderType || 'Individual') === 'Corporate Entity');
  const parentLabels = new Map<string, string>(corporateParents.map((row, index) => [row.id || String(index), row.fullName || `Corporate party ${index + 1}`]));

  function rowId(row: Row, index: number) {
    return row.id || String(index);
  }

  function patchRow(index: number, patch: Row) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? withDerivedIdentity({ ...row, ...patch }) : row)));
  }

  function addOwner() {
    const owner = createOwnershipRow();
    setExpandedRows((current) => ({ ...current, [owner.id || String(rows.length)]: true }));
    onChange([...rows, owner]);
  }

  function toggleRow(rowKey: string) {
    setExpandedRows((current) => ({ ...current, [rowKey]: !current[rowKey] }));
  }

  function setAllExpanded(isExpanded: boolean) {
    setExpandedRows(Object.fromEntries(rows.map((row, index) => [rowId(row, index), isExpanded])));
  }

  async function lookup(index: number) {
    const row = rows[index];
    const rowKey = rowId(row, index);
    const corporate = (row.shareholderType || 'Individual') === 'Corporate Entity';
    const identifier = String((corporate ? row.identityNumber : row.qidNumber || row.passportNumber || row.identityNumber) || '').trim();
    if (!identifier) {
      setLookupMessages((current) => ({ ...current, [rowKey]: 'Enter a CR, QID, or passport number first.' }));
      return;
    }

    setLookupMessages((current) => ({ ...current, [rowKey]: 'Checking existing clients...' }));
    try {
      const response = await matchClientByIdentifier((row.shareholderType || 'Individual') === 'Corporate Entity' ? 'corporate' : 'individual', identifier, currentClientId);
      if (response.match && response.match.id !== currentClientId) {
        patchRow(index, { linkedClientId: response.match.id, linkedClientName: response.match.name });
        setLookupMessages((current) => ({ ...current, [rowKey]: 'Linked to existing client.' }));
      } else {
        patchRow(index, { linkedClientId: '', linkedClientName: '' });
        setLookupMessages((current) => ({ ...current, [rowKey]: 'No existing client match found.' }));
      }
    } catch {
      setLookupMessages((current) => ({ ...current, [rowKey]: 'Unable to check existing clients right now.' }));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">Control / interest rows</p>
          <p className="text-xs text-slate-500">Add each direct or layered party. Corporate rows can be selected as a parent for the next layer.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {rows.length ? (
            <button type="button" onClick={() => setAllExpanded(false)} className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" title="Collapse all ownership rows">
              Collapse
            </button>
          ) : null}
          {rows.length ? (
            <button type="button" onClick={() => setAllExpanded(true)} className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" title="Expand all ownership rows">
              Expand
            </button>
          ) : null}
          <button type="button" onClick={addOwner} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" />
            Party
          </button>
        </div>
      </div>
      {rows.map((row, index) => {
        const rowKey = rowId(row, index);
        const isExpanded = expandedRows[rowKey] ?? rows.length <= 2;
        const parentText = row.parentRowId ? `Linked under ${parentLabels.get(row.parentRowId) || 'corporate party'}` : `Direct party of ${rootName || 'client company'}`;
        const nationalityText = Array.isArray(row.nationality) ? row.nationality.join(', ') : row.nationality || '';
        return (
          <div key={rowKey} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <button type="button" onClick={() => toggleRow(rowKey)} className="inline-flex min-w-0 flex-1 items-center gap-3 text-left">
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{row.fullName || `Party ${index + 1}`}</p>
                  <p className="truncate text-xs text-slate-500">{parentText}</p>
                </div>
              </button>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700">{row.shareholderType || 'Individual'}</span>
                {row.shareholderPercentage ?? row.ownershipPercentage ? <span className="rounded-full bg-brand-50 px-2 py-1 font-semibold text-brand-700">{row.shareholderPercentage ?? row.ownershipPercentage}% shareholder</span> : null}
                {nationalityText ? <span className="max-w-[180px] truncate rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">{nationalityText}</span> : null}
                {row.isUbo ? <span className="rounded-full bg-cyan-50 px-2 py-1 font-semibold text-cyan-700">Beneficial</span> : null}
                {row.linkedClientId ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">Linked client</span> : null}
              </div>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                title="Remove party"
                aria-label={`Remove ${row.fullName || `party ${index + 1}`}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {isExpanded ? (
              <div className="p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Select label="Party type" value={row.shareholderType || 'Individual'} options={['Individual', 'Corporate Entity']} onChange={(value) => patchRow(index, { shareholderType: value, linkedClientId: '', linkedClientName: '' })} />
                  <label className="text-sm font-medium text-slate-700">
                    Parent / linked entity
                    <select
                      value={row.parentRowId || ''}
                      onChange={(event) => patchRow(index, { parentRowId: event.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="">Direct party of {rootName || 'client company'}</option>
                      {corporateParents
                        .filter((parent, parentIndex) => (parent.id || String(parentIndex)) !== rowKey)
                        .map((parent, parentIndex) => {
                          const parentId = parent.id || String(parentIndex);
                          return (
                            <option key={parentId} value={parentId}>
                              {parent.fullName || `Corporate party ${parentIndex + 1}`}
                            </option>
                          );
                        })}
                    </select>
                  </label>
                  <Field label="Full name *" value={row.fullName} onChange={(value) => patchRow(index, { fullName: value })} />
                  <MultiSelect label="Nationality / country *" value={row.nationality} options={countryOptions.filter(Boolean)} onChange={(value) => patchRow(index, { nationality: value })} placeholder="Select countries" />
                  {(row.shareholderType || 'Individual') !== 'Corporate Entity' ? (
                    <>
                      <label className="block text-sm font-medium text-slate-700">
                        Title
                        <select value={row.title || ''} onChange={(event) => patchRow(index, { title: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                          {personTitleOptions.map((option) => <option key={option} value={option}>{option || 'Not selected'}</option>)}
                        </select>
                      </label>
                      <Choice label="Dual citizenship" value={row.dualCitizenship || ''} onChange={(value) => patchRow(index, { dualCitizenship: value })} />
                      <Field label="Other nationality (if dual citizenship)" value={row.otherNationality} onChange={(value) => patchRow(index, { otherNationality: value })} />
                      <Choice label="PEP (politically exposed person)" value={row.isPep || ''} onChange={(value) => patchRow(index, { isPep: value })} />
                      <Field label="PEP details" value={row.pepDetails} onChange={(value) => patchRow(index, { pepDetails: value })} />
                    </>
                  ) : null}
                  {fillBar ? fillBar({ list: 'shareholders', index, row, corporate: (row.shareholderType || 'Individual') === 'Corporate Entity' }) : null}
                  <Field label={(row.shareholderType || 'Individual') === 'Corporate Entity' ? 'Date of incorporation' : 'Date of birth'} type="date" value={row.dateOfBirth} onChange={(value) => patchRow(index, { dateOfBirth: value })} />
                  <div className="text-sm font-medium text-slate-700">
                    <span>{labelText((row.shareholderType || 'Individual') === 'Corporate Entity' ? 'CR number *' : 'QID number (or passport) *')}</span>
                    <div className="mt-1 flex gap-2">
                      {(row.shareholderType || 'Individual') === 'Corporate Entity' ? (
                        <input value={row.identityNumber || ''} onChange={(event) => patchRow(index, { identityNumber: event.target.value, linkedClientId: '', linkedClientName: '' })} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      ) : (
                        <input value={row.qidNumber || ''} onChange={(event) => patchRow(index, { qidNumber: event.target.value, linkedClientId: '', linkedClientName: '' })} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      )}
                      <button type="button" onClick={() => lookup(index)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Lookup
                      </button>
                    </div>
                    {row.linkedClientId ? (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
                        Linked to existing client: {row.linkedClientName}
                        <button type="button" onClick={() => patchRow(index, { linkedClientId: '', linkedClientName: '' })} className="text-brand-900">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : lookupMessages[rowKey] ? (
                      <p className="mt-2 text-xs text-slate-500">{lookupMessages[rowKey]}</p>
                    ) : null}
                  </div>
                  {(row.shareholderType || 'Individual') !== 'Corporate Entity' ? (
                    <>
                      <Field label="Passport number (or QID) *" value={row.passportNumber} onChange={(value) => patchRow(index, { passportNumber: value, linkedClientId: '', linkedClientName: '' })} />
                      {legacyIdentity(row) ? <LegacyIdentityNote value={legacyIdentity(row)} /> : null}
                    </>
                  ) : null}
                  <Field label="Shareholder % *" type="number" value={row.shareholderPercentage ?? row.ownershipPercentage} onChange={(value) => patchRow(index, { shareholderPercentage: value, ownershipPercentage: value })} />
                  <Field label="Residence / registered address" value={row.residenceAddress} onChange={(value) => patchRow(index, { residenceAddress: value })} />
                  <label className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={Boolean(row.isUbo)} onChange={(event) => patchRow(index, { isUbo: event.target.checked, uboInterestPercentage: event.target.checked && !row.uboInterestPercentage ? (row.shareholderPercentage ?? row.ownershipPercentage) : row.uboInterestPercentage })} />
                    Mark as beneficial person
                  </label>
                  {row.isUbo ? <Field label="UBO Interest %" type="number" value={row.uboInterestPercentage ?? row.ownershipPercentage} onChange={(value) => patchRow(index, { uboInterestPercentage: value })} /> : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {!rows.length ? <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">No control / interest rows added yet.</div> : null}
    </div>
  );
}


function SectionCForm({ data, onChange, fillBar }: FormProps & { fillBar?: FillBarRenderer }) {
  return <DynamicRows title="Managers, Directors, Secretary and Signatories" rows={data.managers || []} onChange={(rows) => onChange({ ...data, managers: rows.map(withDerivedIdentity) })} rowExtra={fillBar ? (row, index) => fillBar({ list: 'managers', index, row }) : undefined} fields={[
    ['fullName', 'Full name *'], ['entityName', 'Entity name'], ['nationality', 'Nationality *', 'multiselect', countryOptions], ['address', 'Address'], ['dateOfBirth', 'Date of birth', 'date'], ['qidNumber', 'QID number (or passport) *'], ['passportNumber', 'Passport number (or QID) *'], ['identityNumber', '', 'legacyIdentity'], ...personDeclarationFields, ['position', 'Position *', 'multiselect', positionOptions], ['isAuthorizedSignatory', 'Authorized signatory', 'checkbox']
  ]} />;
}

// People who answered Yes to the per-person PEP / dual citizenship questions on any person row.
function personFlags(form: any) {
  const rows: Row[] = [...(form.sectionB?.shareholders || []), ...(form.sectionB?.ubos || []), ...(form.sectionC?.managers || []), form.sectionE || {}];
  const named = (key: string) => [...new Set(rows.filter((row) => String(row[key] || '') === 'Yes').map((row) => [row.title, row.fullName].filter(Boolean).join(' ')).filter(Boolean))] as string[];
  return { pep: named('isPep'), dual: named('dualCitizenship') };
}

function PersonFlagNote({ names, answer, what }: { names: string[]; answer: string; what: string }) {
  if (!names.length) return null;
  return (
    <p className={`rounded-md border px-3 py-2 text-sm ${answer === 'Yes' ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
      {answer === 'Yes' ? `Marked on the person rows: ${names.join(', ')}.` : `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} marked ${what} on the person rows, but this answer is not Yes. Check it.`}
    </p>
  );
}

function SectionDComplianceForm({ data, onChange, personFlags: flags }: FormProps & { personFlags?: { pep: string[]; dual: string[] } }) {
  const hasPepExposure = (data.pepQuestion || 'No') === 'Yes';
  const hasSanctionExposure = (data.sanctionQuestion || 'No') === 'Yes';
  const hasDualCitizenship = (data.dualCitizenshipQuestion || 'No') === 'Yes';

  function setPepQuestion(value: string) {
    onChange({
      ...data,
      pepQuestion: value,
      ...(value === 'No'
        ? {
            pepDocumentFileNames: []
          }
        : {})
    });
  }

  function setSanctionQuestion(value: string) {
    onChange({
      ...data,
      sanctionQuestion: value,
      ...(value === 'No'
        ? {
            sanctionDocumentFileNames: []
          }
        : {})
    });
  }

  function setDualCitizenshipQuestion(value: string) {
    onChange({
      ...data,
      dualCitizenshipQuestion: value,
      ...(value === 'No'
        ? {
            dualCitizenshipDetails: '',
            dualCitizenshipPassportFileName: '',
            dualCitizenshipPassportFileNames: []
          }
        : {})
    });
  }

  return (
    <div className="space-y-5">
      <Choice label="Any PEP exposure? *" value={data.pepQuestion || ''} onChange={setPepQuestion} />
      <PersonFlagNote names={flags?.pep || []} answer={data.pepQuestion || ''} what="as PEP" />
      <Field label="PEP details" value={data.pepDetails} onChange={(value) => update(data, onChange, 'pepDetails', value)} textarea wide />
      {hasPepExposure ? (
        <SectionDSupportingDocuments label="PEP supporting documents" data={data} fieldKey="pepDocumentFileNames" onChange={onChange} />
      ) : null}
      <Choice label="Any sanction exposure? *" value={data.sanctionQuestion || ''} onChange={setSanctionQuestion} />
      <Field label="Sanction details" value={data.sanctionDetails} onChange={(value) => update(data, onChange, 'sanctionDetails', value)} textarea wide />
      {hasSanctionExposure ? (
        <SectionDSupportingDocuments label="Sanction supporting documents" data={data} fieldKey="sanctionDocumentFileNames" onChange={onChange} />
      ) : null}
      <Choice label="Any dual citizenship? *" value={data.dualCitizenshipQuestion || ''} onChange={setDualCitizenshipQuestion} />
      <PersonFlagNote names={flags?.dual || []} answer={data.dualCitizenshipQuestion || ''} what="as dual citizens" />
      {hasDualCitizenship ? (
        <FormGrid>
          <Field label="Dual citizenship details" value={data.dualCitizenshipDetails} onChange={(value) => update(data, onChange, 'dualCitizenshipDetails', value)} textarea wide />
          <SectionDSupportingDocuments label="Passport copies" data={data} fieldKey="dualCitizenshipPassportFileNames" legacyFieldKey="dualCitizenshipPassportFileName" onChange={onChange} wide />
        </FormGrid>
      ) : null}
    </div>
  );
}

function SectionDSupportingDocuments({
  label,
  data,
  fieldKey,
  legacyFieldKey,
  onChange,
  wide = false
}: {
  label: string;
  data: Record<string, any>;
  fieldKey: string;
  legacyFieldKey?: string;
  onChange: (value: Record<string, any>) => void;
  wide?: boolean;
}) {
  const names = sectionDFileNames(data, fieldKey, legacyFieldKey);

  function setNames(nextNames: string[]) {
    onChange({
      ...data,
      [fieldKey]: nextNames,
      ...(legacyFieldKey ? { [legacyFieldKey]: nextNames[0] || '' } : {})
    });
  }

  return (
    <div className={`${wide ? 'md:col-span-2' : ''} text-sm font-medium text-slate-700`}>
      <span>{labelText(label)}</span>
      <div className="mt-1">
        <MultiFileUploadControl
          names={names}
          onSelect={(files) => setNames([...names, ...files.map((file) => file.name)])}
          onRemoveName={(index) => setNames(names.filter((_, itemIndex) => itemIndex !== index))}
          placeholder="No file selected"
        />
      </div>
    </div>
  );
}

function SectionEContactForm({ data, onChange, fillBar }: FormProps & { fillBar?: FillBarRenderer }) {
  // Nationality is multi-select; the mobile dial code follows the first selected nationality.
  function setNationality(nationality: string[]) {
    onChange({
      ...data,
      nationality,
      ...(nationality.includes('Other') ? {} : { nationalityOther: '' }),
      mobileNumber: applyCountryDialCode(data.mobileNumber || '', countryFromNationality(splitList(nationality)[0] || ''))
    });
  }

  function setMobileNumber(mobileNumber: string) {
    onChange({
      ...data,
      mobileNumber: applyCountryDialCode(mobileNumber, countryFromNationality(splitList(data.nationality)[0] || ''))
    });
  }

  return <FormGrid>
    <Field label="Full name *" value={data.fullName} onChange={(value) => update(data, onChange, 'fullName', value)} />
    <MultiSelect label="Position / Job title *" value={data.position} otherValue={data.positionOther} options={positionOptions.filter(Boolean)} onChange={(value) => onChange({ ...data, position: value, ...(value.includes('Other') ? {} : { positionOther: '' }) })} onOtherChange={(value) => update(data, onChange, 'positionOther', value)} allowOther placeholder="Select positions" />
    <MultiSelect label="Nationality" value={splitList(data.nationality)} otherValue={data.nationalityOther} options={nationalityOptions.filter(Boolean)} onChange={setNationality} onOtherChange={(value) => update(data, onChange, 'nationalityOther', value)} allowOther placeholder="Select nationalities" />
    {fillBar ? fillBar({ list: 'contact', index: 0, row: data }) : null}
    <Field label="QID number" value={data.qidNumber} onChange={(value) => onChange(withDerivedIdentity({ ...data, qidNumber: value }))} />
    <Field label="Passport number" value={data.passportNumber} onChange={(value) => onChange(withDerivedIdentity({ ...data, passportNumber: value }))} />
    <label className="block text-sm font-medium text-slate-700">
      Title
      <select value={data.title || ''} onChange={(event) => onChange({ ...data, title: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
        {personTitleOptions.map((option) => <option key={option} value={option}>{option || 'Not selected'}</option>)}
      </select>
    </label>
    <Choice label="Dual citizenship" value={data.dualCitizenship || ''} onChange={(value) => onChange({ ...data, dualCitizenship: value })} />
    <Field label="Other nationality (if dual citizenship)" value={data.otherNationality} onChange={(value) => onChange({ ...data, otherNationality: value })} />
    <Choice label="PEP (politically exposed person)" value={data.isPep || ''} onChange={(value) => onChange({ ...data, isPep: value })} />
    <Field label="PEP details" value={data.pepDetails} onChange={(value) => onChange({ ...data, pepDetails: value })} />
    {legacyIdentity(data) ? <LegacyIdentityNote value={legacyIdentity(data)} /> : null}
    <Field label="Mobile Number *" value={applyCountryDialCode(data.mobileNumber || '', countryFromNationality(splitList(data.nationality)[0] || ''))} onChange={setMobileNumber} />
    <Field label="Email *" type="email" value={data.email} onChange={(value) => update(data, onChange, 'email', value)} />
  </FormGrid>;
}

function SectionFRequiredDocumentsChecklist({ caseId, data, onChange, onCompanyDocumentUploaded }: FormProps & { caseId: string; onCompanyDocumentUploaded?: (file: File) => Promise<FillOutcome> }) {
  const documents = data.documents || [];
  const additionalDocuments = data.additionalDocuments || [];
  const [uploadingKey, setUploadingKey] = useState('');
  const [uploadError, setUploadError] = useState('');
  // Uploading the company's CR here also reads it into Section A; the note says what was filled.
  const [crNote, setCrNote] = useState<{ index: number; outcome: FillOutcome } | null>(null);

  async function uploadDocument(index: number, files: File[]) {
    if (!files.length || !caseId) return;
    const row = documents[index];
    const documentType = row?.documentType || `Document ${index + 1}`;
    setUploadingKey(`required-${index}`);
    setUploadError('');
    try {
      const updatedCase = await uploadLegalDocumentFiles(caseId, { documentType, files });
      const uploaded = updatedCase?.legalDocuments.filter((document) => document.documentType === documentType && files.some((file) => file.name === document.fileName)) || [];
      onChange({
        ...data,
        documents: documents.map((documentRow: Row, rowIndex: number) =>
          rowIndex === index
            ? {
                ...documentRow,
                isProvided: true,
                fileName: appendFileNameText(documentRow.fileName, uploaded.length ? uploaded.map((document) => document.fileName).join(', ') : files.map((file) => file.name).join(', ')),
                storagePath: uploaded[0]?.storagePath,
                mimeType: files.length === 1 ? uploaded[0]?.mimeType || files[0].type || undefined : undefined,
                size: files.length === 1 ? uploaded[0]?.size || files[0].size : undefined
              }
            : documentRow
        )
      });
      if (documentType === CR_DOCUMENT && onCompanyDocumentUploaded) {
        setUploadingKey(`reading-${index}`);
        const outcome = await onCompanyDocumentUploaded(files[0]).catch((): FillOutcome => ({ tone: 'warn', text: 'The CR was uploaded but could not be read. Enter the details in Section A.' }));
        setCrNote({ index, outcome });
      }
    } catch (requestError: any) {
      setUploadError(getApiErrorMessage(requestError, 'Unable to upload this document.'));
    } finally {
      setUploadingKey('');
    }
  }

  function updateAdditionalDocument(index: number, patch: Row) {
    onChange({
      ...data,
      additionalDocuments: additionalDocuments.map((row: Row, rowIndex: number) => (rowIndex === index ? { ...row, ...patch } : row))
    });
  }

  async function uploadAdditionalDocument(index: number, files: File[]) {
    if (!files.length || !caseId) return;
    const documentType = `Additional document ${index + 1}`;
    setUploadingKey(`additional-${index}`);
    setUploadError('');
    try {
      const updatedCase = await uploadLegalDocumentFiles(caseId, { documentType, files });
      const uploaded = updatedCase?.legalDocuments.filter((document) => document.documentType === documentType && files.some((file) => file.name === document.fileName)) || [];
      updateAdditionalDocument(index, {
        fileName: appendFileNameText(additionalDocuments[index]?.fileName, uploaded.length ? uploaded.map((document) => document.fileName).join(', ') : files.map((file) => file.name).join(', ')),
        storagePath: uploaded[0]?.storagePath,
        mimeType: files.length === 1 ? uploaded[0]?.mimeType || files[0].type || undefined : undefined,
        size: files.length === 1 ? uploaded[0]?.size || files[0].size : undefined
      });
    } catch (requestError: any) {
      setUploadError(getApiErrorMessage(requestError, 'Unable to upload this document.'));
    } finally {
      setUploadingKey('');
    }
  }

  return (
    <div className="space-y-5">
      {uploadError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</p> : null}
      <div className="space-y-3">
        {documents.map((document: Row, index: number) => {
          const names = fileNameList(document.fileName);
          return (
            <div key={`${document.documentType}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[minmax(180px,1fr)_auto_minmax(280px,1.2fr)] lg:items-center">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{document.documentType}</p>
                  <p className="mt-1 text-xs text-slate-500">{names.length ? `${names.length} file${names.length === 1 ? '' : 's'} uploaded` : 'No files uploaded yet'}</p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={Boolean(document.isProvided)} onChange={(event) => updateRow(documents, index, 'isProvided', event.target.checked, (rows) => onChange({ ...data, documents: rows }))} />
                  Received
                </label>
                <MultiFileUploadControl
                  names={names}
                  disabled={uploadingKey === `required-${index}` || uploadingKey === `reading-${index}`}
                  buttonLabel={uploadingKey === `required-${index}` ? 'Uploading...' : uploadingKey === `reading-${index}` ? 'Reading the CR...' : 'Upload files'}
                  placeholder="Select one or more files"
                  showFileList={false}
                  onSelect={(files) => uploadDocument(index, files)}
                  onRemoveName={(fileIndex) => updateRow(documents, index, 'fileName', removeFileName(document.fileName, fileIndex), (rows) => onChange({ ...data, documents: rows }))}
                />
              </div>
              <UploadedFilePills
                names={names}
                emptyText="Upload supporting files for this document type."
                onRemove={(fileIndex) => updateRow(documents, index, 'fileName', removeFileName(document.fileName, fileIndex), (rows) => onChange({ ...data, documents: rows }))}
              />
              {document.documentType === CR_DOCUMENT && onCompanyDocumentUploaded && crNote?.index !== index ? <p className="mt-2 text-xs text-slate-500">Uploading the CR here also fills the company details in Section A.</p> : null}
              {crNote?.index === index ? <FillNote outcome={crNote.outcome} onChange={(outcome) => setCrNote({ index, outcome })} /> : null}
            </div>
          );
        })}
      </div>
      <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Additional Documents</h3>
            <p className="mt-1 text-xs text-slate-500">Upload supplementary supporting documents. ZIP and executable files are not allowed.</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...data, additionalDocuments: [...additionalDocuments, createAdditionalDocumentRow()] })}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Add Document
          </button>
        </div>
        {additionalDocuments.length ? (
          additionalDocuments.map((document: Row, index: number) => (
            <div key={document.id || index} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="grid items-center gap-3 md:grid-cols-[1fr_auto]">
                <MultiFileUploadControl
                  names={fileNameList(document.fileName)}
                  disabled={uploadingKey === `additional-${index}`}
                  buttonLabel={uploadingKey === `additional-${index}` ? 'Uploading...' : 'Upload files'}
                  placeholder="Select one or more files"
                  showFileList={false}
                  accept={STANDARD_DOCUMENT_ACCEPT}
                  helperText={STANDARD_DOCUMENT_HINT}
                  onSelect={(files) => uploadAdditionalDocument(index, files)}
                  onRemoveName={(fileIndex) => updateRow(additionalDocuments, index, 'fileName', removeFileName(document.fileName, fileIndex), (rows) => onChange({ ...data, additionalDocuments: rows }))}
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...data, additionalDocuments: additionalDocuments.filter((_: Row, rowIndex: number) => rowIndex !== index) })}
                  title="Remove additional document"
                  aria-label={`Remove additional document ${index + 1}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <UploadedFilePills
                names={fileNameList(document.fileName)}
                emptyText="No additional files uploaded yet."
                onRemove={(fileIndex) => updateRow(additionalDocuments, index, 'fileName', removeFileName(document.fileName, fileIndex), (rows) => onChange({ ...data, additionalDocuments: rows }))}
              />
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">No additional documents added.</p>
        )}
      </div>
      <Field label="Additional notes for KYC preparation documents" value={data.uploadedFilesNote} onChange={(value) => update(data, onChange, 'uploadedFilesNote', value)} textarea wide />
    </div>
  );
}

function UploadedFilePills({ names, emptyText, onRemove }: { names: string[]; emptyText: string; onRemove: (index: number) => void }) {
  if (!names.length) {
    return <p className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded files</p>
      <div className="flex flex-wrap gap-2">
        {names.map((name, index) => (
          <span key={`${name}-${index}`} title={name} className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="max-w-64 truncate">{name}</span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600"
              aria-label={`Remove ${name}`}
              title={`Remove ${name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// The person signing the declaration is usually a director or signatory already entered: pick them to fill the name
// and the position.
function SectionGDeclarationForm({ data, onChange, people = [] }: FormProps & { people?: PersonSlot[] }) {
  const choices = personChoices(people, 'declaration');
  function pickSigner(slot: string) {
    const person = people.find((item) => item.slot === slot);
    if (!person) return;
    const position = toList(person.row.position).find((item) => positionOptions.includes(item) && item !== 'Other') || '';
    onChange({ ...data, fullName: person.row.fullName || data.fullName, ...(position ? { position, positionOther: '' } : {}) });
  }
  return <FormGrid>
    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">{CLIENT_DECLARATION_TEXT}</p>
    {choices.length ? (
      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 md:col-span-2">
        Signed by
        <select aria-label="Signed by" className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value="" onChange={(event) => { if (event.target.value) pickSigner(event.target.value); }}>
          <option value="">Select a person already entered</option>
          {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </select>
        <span className="text-xs text-slate-500">Fills the name and position; you can still change them.</span>
      </label>
    ) : null}
    <Field label="Full name *" value={data.fullName} onChange={(value) => update(data, onChange, 'fullName', value)} />
    <Select label="Position *" value={data.position} otherValue={data.positionOther} options={positionOptions} onChange={(value) => updateSelect(data, onChange, 'position', value)} onOtherChange={(value) => update(data, onChange, 'positionOther', value)} allowOther />
    <Field label="Date *" type="date" value={data.date} onChange={(value) => update(data, onChange, 'date', value)} />
    <UploadField label="Authorized signature" fileName={data.signatureFileName} imageDataUrl={data.signatureDataUrl} onChange={(file, dataUrl) => onChange({ ...data, signatureFileName: file.name, signatureDataUrl: dataUrl })} />
    <UploadField label="Company stamp" fileName={data.stampFileName} imageDataUrl={data.stampDataUrl} onChange={(file, dataUrl) => onChange({ ...data, stampFileName: file.name, stampDataUrl: dataUrl })} />
  </FormGrid>;
}

function SectionHInternalReviewForm({ data, onChange, mode }: FormProps & { mode: SectionHMode }) {
  const showAml = mode === 'AML' || mode === 'ALL';
  const showDmlro = mode === 'DMLRO' || mode === 'ALL';
  const showMlro = mode === 'MLRO' || mode === 'ALL';
  const showSef = mode === 'SEF' || mode === 'ALL';
  const mlroFinalRisk = data.mlroFinalRiskClassification || data.riskClassification || '';
  const dmlroRiskClassification = data.dmlroRiskClassification || '';
  const mlroDecisionValues = mlroDecisionOptions;
  const mlroDecisionValue = mlroDecisionValues.includes(data.mlroDecision || '') ? data.mlroDecision || '' : '';

  function updateMlroFinalRisk(value: string) {
    onChange({
      ...data,
      reviewPart: mode,
      mlroFinalRiskClassification: value,
      mlroDecision: data.mlroDecision || ''
    });
  }

  return <FormGrid>
    {showAml ? (
      <>
        <Select label="Risk classification *" value={data.riskClassification} otherValue={data.riskClassificationOther} options={['', 'LOW', 'MEDIUM', 'HIGH']} onChange={(value) => updateSelect({ ...data, reviewPart: mode }, onChange, 'riskClassification', value)} onOtherChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'riskClassificationOther', value)} allowOther />
        <Select label="Due diligence type *" value={data.dueDiligenceType} otherValue={data.dueDiligenceTypeOther} options={['', 'SIMPLIFIED', 'REGULAR', 'ENHANCED']} onChange={(value) => updateSelect({ ...data, reviewPart: mode }, onChange, 'dueDiligenceType', value)} onOtherChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dueDiligenceTypeOther', value)} allowOther />
        <Field label="AML Supervisor date" type="date" value={data.amlDate} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'amlDate', value)} />
        <Field label="AML Supervisor comments" value={data.amlClarificationFindings} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'amlClarificationFindings', value)} textarea wide />
      </>
    ) : null}
    {showDmlro ? (
      <>
        <Field label="DMLRO name" value={data.dmlroName} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroName', value)} />
        <UploadField label="DMLRO signature" fileName={data.dmlroSignatureFileName} imageDataUrl={data.dmlroSignatureDataUrl} onChange={(file, dataUrl) => onChange({ ...data, reviewPart: mode, dmlroSignatureFileName: file.name, dmlroSignatureDataUrl: dataUrl })} />
        <Field label="DMLRO date" type="date" value={data.dmlroDate} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroDate', value)} />
        <Select label="DMLRO risk classification" value={dmlroRiskClassification} options={riskClassificationOptions} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroRiskClassification', value)} />
        <Select label="DMLRO decision" value={data.dmlroDecision || 'APPROVE'} options={dmlroDecisionOptions} optionLabels={dmlroDecisionLabels} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroDecision', value)} wide />
        {data.dmlroDecision === 'APPROVE_WITH_CONDITIONS' ? (
          <Field label="DMLRO approval conditions" value={data.dmlroConditions} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroConditions', value)} textarea wide />
        ) : null}
        {data.dmlroDecision === 'REQUEST_ADDITIONAL_INFORMATION' ? (
          <Field label="Additional information requested from AML Supervisor *" value={data.dmlroReason} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroReason', value)} textarea wide />
        ) : null}
        {data.dmlroDecision === 'RETURN_TO_SUPERVISOR' ? (
          <Field label="Reason for returning to AML Supervisor *" value={data.dmlroReason} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroReason', value)} textarea wide />
        ) : null}
        <Field label="DMLRO comments" value={data.dmlroComments} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroComments', value)} textarea wide />
      </>
    ) : null}
    {showMlro ? (
      <>
        <Field label="MLRO name" value={data.mlroName} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'mlroName', value)} />
        <UploadField label="MLRO signature" fileName={data.mlroSignatureFileName} imageDataUrl={data.mlroSignatureDataUrl} onChange={(file, dataUrl) => onChange({ ...data, reviewPart: mode, mlroSignatureFileName: file.name, mlroSignatureDataUrl: dataUrl })} />
        <Field label="MLRO date" type="date" value={data.mlroDate} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'mlroDate', value)} />
        <Select label="Final risk classification" value={mlroFinalRisk} options={riskClassificationOptions} onChange={updateMlroFinalRisk} />
        <Select label="MLRO final decision" value={mlroDecisionValue} options={mlroDecisionValues} optionLabels={mlroDecisionLabels} placeholder={mlroFinalRisk ? 'Select decision' : 'Select final risk first'} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'mlroDecision', value)} />
        <Select label="Risk reason category" value={data.mlroRiskReasonCategory || 'PROFESSIONAL_JUDGEMENT'} options={riskReasonCategoryOptions} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'mlroRiskReasonCategory', value)} />
        <Field label="Risk explanation" value={data.mlroRiskExplanation} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'mlroRiskExplanation', value)} textarea wide />
        <Field label="Conditions" value={data.mlroConditions} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'mlroConditions', value)} textarea wide />
        <Field label={data.mlroDecision === 'RETURN_TO_DMLRO' ? 'MLRO comments - reason for returning to DMLRO *' : data.mlroDecision === 'REQUEST_ADDITIONAL_INFORMATION' ? 'MLRO comments - additional information requested *' : 'MLRO comments'} value={data.mlroComments} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'mlroComments', value)} textarea wide />
      </>
    ) : null}
    {showSef ? (
      <>
        <Field label="SEF name" value={data.sefName} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'sefName', value)} />
        <UploadField label="SEF signature" fileName={data.sefSignatureFileName} imageDataUrl={data.sefSignatureDataUrl} onChange={(file, dataUrl) => onChange({ ...data, reviewPart: mode, sefSignatureFileName: file.name, sefSignatureDataUrl: dataUrl })} />
        <Field label="SEF date" type="date" value={data.sefDate} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'sefDate', value)} />
        <Select label="SEF management decision" value={data.sefDecision || 'APPROVE'} options={sefDecisionOptions} optionLabels={sefDecisionLabels} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'sefDecision', value)} />
        {data.sefDecision === 'APPROVE_WITH_CONDITIONS' ? (
          <Field label="SEF approval conditions" value={data.sefConditions} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'sefConditions', value)} textarea wide />
        ) : null}
        {data.sefDecision === 'REJECT' || data.sefDecision === 'RETURN_TO_MLRO' ? (
          <Field label={data.sefDecision === 'RETURN_TO_MLRO' ? 'Return reason for MLRO *' : 'SEF rejection reason'} value={data.sefConditions} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'sefConditions', value)} textarea wide />
        ) : null}
        <Field label="SEF comments" value={data.sefComments} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'sefComments', value)} textarea wide />
      </>
    ) : null}
  </FormGrid>;
}

export function LiveDocumentPreviewPanel({ form }: { form: KycFormData }) {
  return (
    <DocumentPreviewFrame structure={<OwnershipStructureDiagram rootName={form.sectionA.legalName || 'Client company'} rows={form.sectionB.shareholders || []} ubos={form.sectionB.ubos || []} />}>
      {form.preliminaryDocument ? <PreliminaryKycDocument data={form.preliminaryDocument} ownership={{ rootName: form.sectionA.legalName || 'Client company', shareholders: form.sectionB.shareholders || [], ubos: form.sectionB.ubos || [] }} embedded /> : null}
      <div className={`mx-auto w-full max-w-[794px] bg-white p-8 text-[11px] leading-5 text-slate-900 shadow-sm ${form.preliminaryDocument ? 'mt-4' : 'min-h-[1120px]'}`}>
        {!form.preliminaryDocument ? <>
        <div className="flex items-start justify-between border-b-4 border-brand-600 pb-4">
          <div>
            <p className="text-2xl font-bold tracking-normal text-brand-900">NEWOON</p>
            <p className="text-xs font-semibold uppercase text-slate-500">KYC & Engagement Workflow</p>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <p>Newoon Corporate Services</p>
            <p>Doha, Qatar</p>
            <p>contact@newoon.com</p>
          </div>
        </div>
        <h2 className="mt-5 text-center text-base font-bold uppercase text-slate-950">Know Your Customer Form</h2>
        <PreviewSection title="A. General Company Information">
          <PreviewGrid rows={[
            ['Date', form.sectionA.date], ['KYC Number', form.sectionA.reference], ['Legal Name of Company', form.sectionA.legalName], ['Commercial Registration No.', form.sectionA.commercialRegistrationNo], ['Tax Identification No.', form.sectionA.taxIdentificationNo], ['Date of Incorporation', form.sectionA.dateOfIncorporation], ['Country of Incorporation', resolveOtherValue(form.sectionA.countryOfIncorporation, form.sectionA.countryOfIncorporationOther)], ['Legal Form', resolveOtherValue(form.sectionA.legalForm, form.sectionA.legalFormOther)], ['Registered Office Address', form.sectionA.registeredOfficeAddress], ['Telephone', form.sectionA.telephone], ['Email', form.sectionA.email], ['Website', form.sectionA.website], ['Main purpose / nature of business', resolveOtherValue(form.sectionA.businessNature, form.sectionA.businessNatureOther)], ['License activities', form.sectionA.licenseActivities], ['Related Industry', resolveOtherValue(form.sectionA.relatedIndustry, form.sectionA.relatedIndustryOther)], ['Nature of prospective service from Newoon', displaySelectedList(form.sectionA.prospectiveService, form.sectionA.prospectiveServiceOther)]
          ]} />
        </PreviewSection>
        <PreviewSection title="B. Manager / Authorized Signatory / Directors / Secretary">
          <PreviewTable headers={['Full name', 'Position', 'Entity', 'Nationality', 'Address', 'DOB', 'ID No.', 'Signatory']} rows={(form.sectionC.managers || []).map((row) => [row.fullName, displaySelectedList(row.position, row.positionOther), row.entityName, displaySelectedList(row.nationality) || row.nationalityAndAddress, row.address, displayDate(row.dateOfBirth), identitySummary(row), row.isAuthorizedSignatory ? 'Yes' : 'No'])} />
        </PreviewSection>
        <PreviewSection title="C. Shareholders">
          <PreviewTable headers={['Type', 'Full name', 'Nationality / country', 'DOB / Incorporation', 'QID / Passport / CR', 'Shareholder %', 'Address', 'Linked client', 'Beneficial person']} rows={(form.sectionB.shareholders || []).map((row) => [row.shareholderType || 'Individual', row.fullName, displaySelectedList(row.nationality, row.nationalityOther), displayDate(row.dateOfBirth), row.identityNumber, row.shareholderPercentage ?? row.ownershipPercentage, row.residenceAddress, row.linkedClientName || '-', row.isUbo ? 'Yes' : 'No'])} />
          <p className="mt-2 font-semibold">Total shareholder %: {form.sectionB.totalOwnershipPercentage || 0}% | Total UBO %: {form.sectionB.totalUboPercentage || 0}%</p>
          <p>Beneficial person different from listed parties: {form.sectionB.uboDifferentFromShareholders || 'No'}</p>
          <p>Beneficial structure notes: {form.sectionB.uboGroupStructureNotes || '-'}</p>
          <PreviewGroup title="UBO List">
            <PreviewTable headers={['Beneficial person', 'Company', 'Nationality', 'DOB', 'Identity No.', 'UBO %', 'Address']} widths={[17, 22, 10, 10, 14, 8, 19]} rows={effectiveUboRows(form.sectionB).map((row: Row) => [row.fullName, uboCompanyName(row, form.sectionB.shareholders || []), displaySelectedList(row.nationality, row.nationalityOther), displayDate(row.dateOfBirth), row.identityNumber, row.uboInterestPercentage ?? row.ownershipPercentage, row.residenceAddress])} />
          </PreviewGroup>
          <OwnershipStructureDiagram rootName={form.sectionA.legalName || 'Client company'} rows={form.sectionB.shareholders || []} ubos={form.sectionB.ubos || []} fit />
        </PreviewSection>
        <PreviewSection title="D. Compliance and Risk Information">
          <PreviewGrid rows={[
            ['Any PEP exposure?', form.sectionD.pepQuestion],
            ['PEP details', form.sectionD.pepDetails],
            ['PEP supporting documents', displayList(form.sectionD.pepDocumentFileNames)],
            ['Any sanction exposure?', form.sectionD.sanctionQuestion],
            ['Sanction details', form.sectionD.sanctionDetails],
            ['Sanction supporting documents', displayList(form.sectionD.sanctionDocumentFileNames)],
            ['Any dual citizenship?', form.sectionD.dualCitizenshipQuestion],
            ['Dual citizenship details', form.sectionD.dualCitizenshipDetails],
            ['Dual citizenship passport copies', displayList(sectionDFileNames(form.sectionD, 'dualCitizenshipPassportFileNames', 'dualCitizenshipPassportFileName'))]
          ]} />
        </PreviewSection>
        <PreviewSection title="E. Key Communication Person">
          <PreviewGrid rows={[['Full name', form.sectionE.fullName], ['Position / Job title', displaySelectedList(form.sectionE.position, form.sectionE.positionOther)], ['Nationality', displaySelectedList(splitList(form.sectionE.nationality), form.sectionE.nationalityOther)], ['QID / Passport Number', identitySummary(form.sectionE)], ['Mobile Number', form.sectionE.mobileNumber], ['Email', form.sectionE.email]]} />
        </PreviewSection>
        <PreviewSection title="F. Required Documents Checklist">
          <PreviewTable headers={['Document', 'Received', 'Uploaded file']} rows={(form.sectionF.documents || []).map((row) => [row.documentType, row.isProvided ? '☑' : '☐', row.fileName])} />
          <PreviewTable headers={['Additional uploaded file']} rows={(form.sectionF.additionalDocuments || []).map((row: Row) => [row.fileName])} />
          <PreviewGrid rows={[['Additional notes for KYC preparation documents', form.sectionF.uploadedFilesNote || '-']]} />
        </PreviewSection>
        <PreviewSection title="G. Client Declaration">
          <p className="mb-2 text-justify">{CLIENT_DECLARATION_TEXT}</p>
          <PreviewGrid rows={[['Full name', form.sectionG.fullName], ['Position', resolveOtherValue(form.sectionG.position, form.sectionG.positionOther)], ['Date', form.sectionG.date], ['Authorized signature', previewImage(form.sectionG.signatureDataUrl, form.sectionG.signatureFileName)], ['Company stamp', previewImage(form.sectionG.stampDataUrl, form.sectionG.stampFileName)]]} />
        </PreviewSection>
        </> : null}
        <PreviewSection title="H. Internal Use Only">
          <PreviewGrid rows={[['Risk classification', form.sectionH?.riskClassification], ['Due diligence type', form.sectionH?.dueDiligenceType]]} />
          <PreviewGroup title="AML Supervisor">
            <PreviewGrid rows={[['Date', form.sectionH?.amlDate], ['Comments', form.sectionH?.amlClarificationFindings]]} />
          </PreviewGroup>
          <PreviewGroup title="DMLRO">
            <PreviewGrid rows={[['Name', form.sectionH?.dmlroName], ['Date', form.sectionH?.dmlroDate], ['Signature', previewImage(form.sectionH?.dmlroSignatureDataUrl, form.sectionH?.dmlroSignatureFileName)], ['Risk classification', form.sectionH?.dmlroRiskClassification], ['Decision', dmlroDecisionLabels[form.sectionH?.dmlroDecision || ''] || form.sectionH?.dmlroDecision], ...filledRows([['Conditions', form.sectionH?.dmlroConditions], ['Reason', form.sectionH?.dmlroReason]]), ['Comments', form.sectionH?.dmlroComments]]} />
          </PreviewGroup>
          <PreviewGroup title="MLRO">
            <PreviewGrid rows={[['Name', form.sectionH?.mlroName], ['Date', form.sectionH?.mlroDate], ['Signature', previewImage(form.sectionH?.mlroSignatureDataUrl, form.sectionH?.mlroSignatureFileName)], ['Final decision', mlroDecisionLabels[form.sectionH?.mlroDecision || ''] || form.sectionH?.mlroDecision], ['Final risk classification', form.sectionH?.mlroFinalRiskClassification || form.sectionH?.riskClassification], ...filledRows([['Risk reason category', displayCodeLabel(form.sectionH?.mlroRiskReasonCategory)], ['Risk explanation', form.sectionH?.mlroRiskExplanation], ['Conditions', form.sectionH?.mlroConditions]]), ['Comments', form.sectionH?.mlroComments]]} />
          </PreviewGroup>
          {form.sectionH?.mlroDecision === 'SEND_TO_SEF' || [form.sectionH?.sefName, form.sectionH?.sefDate, form.sectionH?.sefDecision, form.sectionH?.sefComments, form.sectionH?.sefConditions].some((value) => String(value || '').trim()) ? (
            <PreviewGroup title="SEF">
              <PreviewGrid rows={[['Name', form.sectionH?.sefName], ['Date', form.sectionH?.sefDate], ['Signature', previewImage(form.sectionH?.sefSignatureDataUrl, form.sectionH?.sefSignatureFileName)], ['Management decision', sefDecisionLabels[form.sectionH?.sefDecision || ''] || form.sectionH?.sefDecision], ...filledRows([['Conditions', form.sectionH?.sefConditions]]), ['Comments', form.sectionH?.sefComments]]} />
            </PreviewGroup>
          ) : null}
        </PreviewSection>
        <div className="mt-8 border-t border-slate-300 pt-2 text-center text-[10px] font-medium text-slate-500">Newoon Corporate Services | KYC onboarding, engagement workflow and AML review support</div>
      </div>
    </DocumentPreviewFrame>
  );
}

type FormProps = { data: Record<string, any>; onChange: (value: Record<string, any>) => void };

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">{children}</div>;
}

function Field({ label, value, onChange, type = 'text', textarea = false, wide = false }: { label: string; value: any; onChange: (value: string) => void; type?: string; textarea?: boolean; wide?: boolean }) {
  const className = `${wide ? 'md:col-span-2' : ''} min-w-0 text-sm font-medium text-slate-700`;
  return (
    <label className={className}>
      {labelText(label)}
      {textarea && /comment/i.test(label) ? <RichTextEditor label={label} value={value || ''} onChange={onChange} /> : textarea ? (
        <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      ) : type === 'date' ? (
        <TypedDateInput value={value} onChange={onChange} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      ) : (
        <input value={value || ''} type={type} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      )}
    </label>
  );
}

function OldSelect({
  label,
  value,
  options,
  onChange,
  wide = false
}: {
  label: string;
  value: any;
  options: string[];
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0, maxHeight: 256 });
  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? options.filter((option) => option.toLowerCase().includes(search)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportPadding = 12;
      const searchAndPaddingHeight = 58;
      const preferredMenuHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const shouldOpenUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(140, (shouldOpenUp ? spaceAbove : spaceBelow) - searchAndPaddingHeight);
      setMenuStyle({
        top: shouldOpenUp ? Math.max(viewportPadding, rect.top - Math.min(preferredMenuHeight, spaceAbove)) : rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(256, availableHeight)
      });
    }

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (triggerRef.current?.contains(target) || target.closest('[data-kyc-select-menu="true"]')) return;
      setOpen(false);
      setQuery('');
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [open]);

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className={`${wide ? 'md:col-span-2' : ''} text-sm font-medium text-slate-700`}>
      <span>{labelText(label)}</span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setQuery('');
        }}
        className="mt-1 flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900"
      >
        <span className={value ? '' : 'text-slate-400'}>{value || 'Select'}</span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>
      {open
        ? createPortal(
            <div
              data-kyc-select-menu="true"
              className="fixed z-[10000] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
            >
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search..."
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-normal text-slate-900 outline-none"
                />
              </div>
              <div className="overflow-y-auto p-2" style={{ maxHeight: menuStyle.maxHeight }}>
                {filteredOptions.length ? (
                  filteredOptions.map((option) => {
                    const selected = (value || '') === option;
                    return (
                      <button
                        key={option || 'empty'}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(option)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                          selected ? 'bg-brand-50 text-brand-900' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{option || 'Select'}</span>
                        {selected ? <Check className="h-4 w-4 text-brand-700" /> : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-sm font-normal text-slate-500">No options found</p>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function OldMultiSelect({
  label,
  value,
  options,
  onChange,
  wide = false
}: {
  label: string;
  value: any;
  options: string[];
  onChange: (value: string[]) => void;
  wide?: boolean;
}) {
  const selectedValues = listValue(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0, maxHeight: 256 });
  const selectableOptions = options.filter(Boolean);
  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? selectableOptions.filter((option) => option.toLowerCase().includes(search)) : selectableOptions;
  }, [selectableOptions, query]);

  useEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportPadding = 12;
      const searchAndPaddingHeight = 58;
      const preferredMenuHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const shouldOpenUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(140, (shouldOpenUp ? spaceAbove : spaceBelow) - searchAndPaddingHeight);
      setMenuStyle({
        top: shouldOpenUp ? Math.max(viewportPadding, rect.top - Math.min(preferredMenuHeight, spaceAbove)) : rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(256, availableHeight)
      });
    }

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (triggerRef.current?.contains(target) || target.closest('[data-kyc-multi-select-menu="true"]')) return;
      setOpen(false);
      setQuery('');
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [open]);

  function toggle(option: string) {
    const nextValues = selectedValues.includes(option)
      ? selectedValues.filter((item) => item !== option)
      : [...selectedValues, option];
    onChange(nextValues);
  }

  function remove(option: string) {
    onChange(selectedValues.filter((item) => item !== option));
  }

  return (
    <div className={`${wide ? 'md:col-span-2' : ''} text-sm font-medium text-slate-700`}>
      <span>{labelText(label)}</span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setQuery('');
        }}
        className="mt-1 flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900"
      >
        <span className={selectedValues.length ? 'flex min-w-0 flex-1 flex-wrap gap-2' : 'text-slate-400'}>
          {selectedValues.length
            ? selectedValues.map((service) => (
                <span key={service} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800">
                  <span className="truncate">{service}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      remove(service);
                    }}
                    className="inline-flex rounded-full p-0.5 hover:bg-brand-100"
                    aria-label={`Remove ${service}`}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))
            : 'Select services'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
      {open
        ? createPortal(
            <div
              data-kyc-multi-select-menu="true"
              className="fixed z-[10000] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
            >
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search services..."
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-normal text-slate-900 outline-none"
                />
              </div>
              <div className="overflow-y-auto p-2" style={{ maxHeight: menuStyle.maxHeight }}>
                {filteredOptions.length ? (
                  filteredOptions.map((option) => {
                    const selected = selectedValues.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => toggle(option)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                          selected ? 'bg-brand-50 text-brand-900' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{option}</span>
                        {selected ? <Check className="h-4 w-4 text-brand-700" /> : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-sm font-normal text-slate-500">No services found</p>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function Choice({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><p className="text-sm font-medium text-slate-700">{labelText(label)}</p><div className="mt-2 inline-flex overflow-hidden rounded-md border border-slate-300">{['Yes', 'No'].map((option) => <button key={option} type="button" onClick={() => onChange(option)} className={`px-4 py-2 text-sm font-semibold ${value === option ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{option}</button>)}</div></div>;
}

function UploadField({ label, fileName, imageDataUrl, onChange }: { label: string; fileName?: string; imageDataUrl?: string; onChange: (file: File, dataUrl?: string) => void }) {
  async function handleFile(file: File) {
    if (file.type.startsWith('image/')) {
      onChange(file, await readSignatureImageDataUrl(file));
      return;
    }

    onChange(file);
  }

  return (
    <div className="text-sm font-medium text-slate-700">
      {labelText(label)}
      <div className="mt-1 grid items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          <Upload className="h-4 w-4" />
          Upload
          <input
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <div className="flex min-h-10 min-w-0 items-center rounded-md border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-normal text-slate-600">
          {imageDataUrl ? (
            <img src={imageDataUrl} alt={`${label} preview`} className="max-h-12 max-w-full object-contain" />
          ) : (
            <span className="truncate">{fileName || 'No file selected'}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function readFileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readSignatureImageDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 420;
      const maxHeight = 160;
      const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        URL.revokeObjectURL(image.src);
        reject(new Error('Unable to process signature image'));
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(image.src);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(image.src);
      reject(new Error('Unable to read signature image'));
    };
    image.src = URL.createObjectURL(file);
  });
}

type DynamicField = [key: string, label: string, type?: string, options?: string[]];

function LegacyIdentityNote({ value }: { value: string }) {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 md:col-span-2">
      Earlier entry (QID / Passport combined): <span className="font-semibold">{value}</span>. Enter it as the QID or passport number above; it is kept until you do.
    </p>
  );
}

function DynamicRows({ title, rows, fields, onChange, rowExtra }: { title: string; rows: Row[]; fields: DynamicField[]; onChange: (rows: Row[]) => void; rowExtra?: (row: Row, index: number) => ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <button type="button" onClick={() => onChange([...rows, {}])} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" /> Add row</button>
      </div>
      {rows.map((row, index) => (
        <div key={index} className="rounded-md border border-slate-200 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            {rowExtra ? rowExtra(row, index) : null}
            {fields.map(([key, label, type, options]) => {
              if (type === 'legacyIdentity') {
                const legacy = legacyIdentity(row);
                return legacy ? <LegacyIdentityNote key={key} value={legacy} /> : null;
              }

              if (type === 'checkbox') {
                return <label key={key} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={Boolean(row[key])} onChange={(event) => updateRow(rows, index, key, event.target.checked, onChange)} /> {labelText(label)}</label>;
              }

              if (type === 'yesno') {
                return <Choice key={key} label={label} value={row[key] || ''} onChange={(value) => updateRow(rows, index, key, value, onChange)} />;
              }

              if (type === 'simpleselect') {
                return (
                  <label key={key} className="block text-sm font-medium text-slate-700">
                    {labelText(label)}
                    <select value={row[key] || ''} onChange={(event) => updateRow(rows, index, key, event.target.value, onChange)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                      {(options || ['']).map((option) => <option key={option} value={option}>{option || 'Not selected'}</option>)}
                    </select>
                  </label>
                );
              }

              if (type === 'select') {
                return (
                  <Select
                    key={key}
                    label={label}
                    value={row[key]}
                    otherValue={row[`${key}Other`]}
                    options={options || ['']}
                    onChange={(value) => updateRow(rows, index, key, value, (nextRows) => {
                      const normalizedRows = value === 'Other' ? nextRows : nextRows.map((nextRow, nextIndex) => nextIndex === index ? { ...nextRow, [`${key}Other`]: '' } : nextRow);
                      onChange(normalizedRows);
                    })}
                    onOtherChange={(value) => updateRow(rows, index, `${key}Other`, value, onChange)}
                    allowOther
                  />
                );
              }

              if (type === 'multiselect') {
                return (
                  <MultiSelect
                    key={key}
                    label={label}
                    value={row[key]}
                    options={(options || ['']).filter(Boolean)}
                    onChange={(value) => updateRow(rows, index, key, value, onChange)}
                    placeholder={key === 'nationality' ? 'Select nationalities' : `Select ${label.toLowerCase()}`}
                  />
                );
              }

              return <Field key={key} label={label} type={type || 'text'} value={row[key]} onChange={(value) => updateRow(rows, index, key, value, onChange)} />;
            })}
          </div>
          <button type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-red-600"><Trash2 className="h-4 w-4" /> Remove</button>
        </div>
      ))}
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-4"><div className="bg-brand-900 px-2 py-1 text-[11px] font-bold uppercase text-white">{title}</div><div className="border border-t-0 border-slate-300 p-2">{children}</div></section>;
}

// Review-group heading inside Section H (AML Supervisor, DMLRO, MLRO, SEF); the KYC download uses the same grouping.
function PreviewGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-3"><div className="mb-1 border-l-4 border-brand-700 bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-900">{title}</div>{children}</div>;
}

function PreviewGrid({ rows }: { rows: Array<[string, any]> }) {
  return <div className="grid grid-cols-2 border-l border-t border-slate-300">{rows.map(([label, value]) => <div key={label} className={`min-h-8 min-w-0 break-words whitespace-pre-wrap border-b border-r border-slate-300 p-1 ${/comment|findings|explanation|conditions|reason/i.test(label) ? 'col-span-2' : ''}`}><span className="font-semibold">{label}: </span>{renderPreviewValue(label, value)}</div>)}</div>;
}

function previewImage(imageDataUrl?: string, fileName?: string) {
  return { imageDataUrl, fileName };
}

function renderPreviewValue(label: string, value: any) {
  if (/comment/i.test(label) && typeof value === 'string') return <div className="review-rich-text" dangerouslySetInnerHTML={{ __html: safeCommentHtml(value || '-') }} />;
  if (value?.imageDataUrl) {
    return <img src={value.imageDataUrl} alt={`${label} preview`} className="mt-1 max-h-12 max-w-full object-contain" />;
  }

  if (value?.fileName) return value.fileName;
  if (value && typeof value === 'object') return '-';
  return value || '-';
}

function PreviewTable({ headers, rows, widths }: { headers: string[]; rows: any[][]; widths?: number[] }) {
  return <table className={`mt-2 w-full border-collapse text-[10px] ${widths ? 'table-fixed [overflow-wrap:anywhere]' : ''}`}>{widths && <colgroup>{widths.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>}<thead><tr>{headers.map((header) => <th key={header} className="border border-slate-300 bg-slate-100 p-1 text-left">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{headers.map((header, cellIndex) => <td key={cellIndex} className="border border-slate-300 p-1">{renderPreviewValue(header, row[cellIndex])}</td>)}</tr>) : <tr><td colSpan={headers.length} className="border border-slate-300 p-2 text-center text-slate-500">No rows added</td></tr>}</tbody></table>;
}

function update(data: Record<string, any>, onChange: (value: Record<string, any>) => void, key: string, value: any) {
  onChange({ ...data, [key]: value });
}

function updateSelect(data: Record<string, any>, onChange: (value: Record<string, any>) => void, key: string, value: string) {
  onChange({
    ...data,
    [key]: value,
    ...(value === 'Other' ? {} : { [`${key}Other`]: '' })
  });
}

function updateRow(rows: Row[], index: number, key: string, value: any, onChange: (rows: Row[]) => void) {
  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
}

function listValue(value: any) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  return value ? [String(value)] : [];
}

function displayList(value: any) {
  return listValue(value).join(', ');
}

function sectionDFileNames(data: Record<string, any>, fieldKey: string, legacyFieldKey?: string) {
  const names = listValue(data[fieldKey]);
  const legacyName = legacyFieldKey ? String(data[legacyFieldKey] || '').trim() : '';
  return legacyName && !names.includes(legacyName) ? [legacyName, ...names] : names;
}

function displayCodeLabel(value: any) {
  return value ? String(value).replace(/_/g, ' ') : '';
}

function countryFromNationality(nationality: string) {
  const nationalityCountryMap: Record<string, string> = {
    Qatari: 'Qatar',
    Saudi: 'Saudi Arabia',
    Emirati: 'United Arab Emirates',
    Bahraini: 'Bahrain',
    Kuwaiti: 'Kuwait',
    Omani: 'Oman',
    Indian: 'India',
    Pakistani: 'Pakistan',
    Bangladeshi: 'Bangladesh',
    'Sri Lankan': 'Sri Lanka',
    British: 'United Kingdom',
    American: 'United States'
  };

  return nationalityCountryMap[nationality] || '';
}

function normalizeSectionBNationality(value: any) {
  const values = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

  return values.map((item) => countryFromNationality(item) || item).filter(Boolean);
}

function normalizeSectionBRows(rows: Row[] | undefined) {
  return (rows || []).map((row, index) => ({
    ...row,
    id: row.id || `ownership-${index + 1}`,
    shareholderType: row.shareholderType || 'Individual',
    parentRowId: row.parentRowId || '',
    linkedClientId: row.linkedClientId || '',
    linkedClientName: row.linkedClientName || '',
    isUbo: Boolean(row.isUbo),
    nationality: normalizeSectionBNationality(row.nationality)
  }));
}

function normalizeSectionCRows(rows: Row[] | undefined) {
  return (rows || []).map((row) => ({
    ...row,
    nationality: normalizeSectionBNationality(row.nationality),
    position: listValue(row.position)
  }));
}

function normalizeSectionD(sectionD: Record<string, any> | undefined) {
  const data = {
    ...emptyForm.sectionD,
    ...(sectionD || {})
  };

  return {
    ...data,
    pepDocumentFileNames: listValue(data.pepDocumentFileNames),
    sanctionDocumentFileNames: listValue(data.sanctionDocumentFileNames),
    dualCitizenshipPassportFileNames: sectionDFileNames(data, 'dualCitizenshipPassportFileNames', 'dualCitizenshipPassportFileName')
  };
}

function normalizeRequiredDocumentRows(rows: Row[] | undefined): Row[] {
  const merged = new Map<string, Row>();

  (rows || []).forEach((row) => {
    const documentType = String(row.documentType || '').trim();
    const key = documentKey(documentType);
    if (!key) return;

    const existing = merged.get(key);
    const fileName = uniqueFileNameText([existing?.fileName, row.fileName].filter(Boolean).join(', '));

    merged.set(key, {
      ...(existing || {}),
      ...row,
      documentType: existing?.documentType || documentType,
      isRequired: row.isRequired === undefined ? existing?.isRequired ?? true : row.isRequired,
      isProvided: Boolean(existing?.isProvided) || Boolean(row.isProvided) || Boolean(fileName),
      fileName,
      storagePath: existing?.storagePath || row.storagePath,
      mimeType: existing?.mimeType || row.mimeType,
      size: existing?.size || row.size
    });
  });

  return requiredDocuments.map((documentType) => {
    const row = merged.get(documentKey(documentType));
    return row || { documentType, isRequired: true, isProvided: false, fileName: '' };
  });
}

function normalizeAdditionalDocumentRows(rows: Row[] | undefined): Row[] {
  const seen = new Set<string>();

  return (rows || [])
    .map((row, index) => ({
      ...row,
      id: row.id || `${index + 1}`,
      fileName: uniqueFileNameText(row.fileName)
    }))
    .filter((row) => {
      const fileName = String(row.fileName || '').trim();
      if (!fileName) return false;
      const key = fileName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeForm(form: KycFormData, kycCase?: KycCase | null): KycFormData {
  const sectionA = {
    ...emptyForm.sectionA,
    ...(form.sectionA || {})
  };
  if (!sectionA.reference && kycCase?.kycNumber) {
    sectionA.reference = kycCase.kycNumber;
  }
  sectionA.telephone = applyCountryDialCode(sectionA.telephone || '', sectionA.countryOfIncorporation || '');
  const sectionE = {
    ...emptyForm.sectionE,
    ...(form.sectionE || {})
  };
  sectionE.position = listValue(sectionE.position);
  // Older records and enquiry conversions store a single or comma-separated nationality string.
  sectionE.nationality = splitList(sectionE.nationality);
  sectionE.mobileNumber = applyCountryDialCode(sectionE.mobileNumber || '', countryFromNationality(sectionE.nationality[0] || ''));

  return {
    ...emptyForm,
    ...form,
    sectionA,
    sectionB: {
      ...emptyForm.sectionB,
      ...(form.sectionB || {}),
      shareholders: normalizeSectionBRows(form.sectionB?.shareholders),
      ubos: normalizeSectionBRows(form.sectionB?.ubos)
    },
    sectionC: { ...emptyForm.sectionC, ...(form.sectionC || {}), managers: normalizeSectionCRows(form.sectionC?.managers) },
    sectionD: normalizeSectionD(form.sectionD),
    sectionE,
    sectionF: {
      ...emptyForm.sectionF,
      ...(form.sectionF || {}),
      documents: normalizeRequiredDocumentRows(form.sectionF?.documents?.length ? form.sectionF.documents : emptyForm.sectionF.documents),
      additionalDocuments: normalizeAdditionalDocumentRows(form.sectionF?.additionalDocuments)
    },
    sectionH: form.sectionH || {}
  };
}

function displayDate(value: any) {
  return value ? String(value).slice(0, 10) : '';
}
