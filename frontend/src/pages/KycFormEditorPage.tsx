import { Check, ChevronDown, Download, Eye, FileSpreadsheet, FileText, Plus, Save, Search, SearchCheck, Send, Trash2, Upload, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { displayList as displaySelectedList, resolveOtherValue, SearchableMultiSelect as MultiSelect, SearchableSelect as Select } from '../components/SearchableSelect';
import { MultiFileUploadControl } from '../components/MultiFileUploadControl';
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
  viewScreeningDocument
} from '../services/kyc-workflow.service';
import { getApiErrorMessage } from '../services/api';
import { applyCountryDialCode, countryDialOptions } from '../utils/country-phone';
import { newoonServiceOptions as prospectiveServiceOptions } from '../utils/newoon-services';
import { hasAnyRole, workflowRoles } from '../utils/access-control';
import { STANDARD_DOCUMENT_ACCEPT, STANDARD_DOCUMENT_HINT } from '../utils/upload-security';

const sections = [
  { id: 'section-a', key: 'sectionA', label: 'A. General Company Information' },
  { id: 'section-b', key: 'sectionB', label: 'B. Ownership / Shareholders' },
  { id: 'section-c', key: 'sectionC', label: 'C. Managers / Signatories' },
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
  'CR of legal entity shareholders',
  'National address certificates',
  'Latest Audited Financial Statements',
  'Tax Card'
];

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
  'Manager',
  'General Manager',
  'Authorized Signatory',
  'Secretary',
  'Senior Executive Function',
  'Shareholder',
  'UBO',
  'Compliance Officer'
];

const mlroDecisionOptions = ['', 'APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_DMLRO', 'SEND_TO_SEF'];
const standardMlroDecisionOptions = ['', 'APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_DMLRO'];
const highRiskMlroDecisionOptions = ['', 'SEND_TO_SEF', 'REJECT', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_DMLRO'];
const dmlroDecisionOptions = ['', 'APPROVE', 'APPROVE_WITH_CONDITIONS', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_SUPERVISOR'];
const dmlroDecisionLabels: Record<string, string> = {
  APPROVE: 'Send to MLRO',
  APPROVE_WITH_CONDITIONS: 'Approve with conditions',
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
const sefDecisionOptions = ['', 'APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT'];
const sefDecisionLabels: Record<string, string> = {
  APPROVE: 'Approve',
  APPROVE_WITH_CONDITIONS: 'Approve with conditions',
  REJECT: 'Reject'
};

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
  if (decision === 'REJECT') return 'SEF management rejection submitted.';
  if (decision === 'APPROVE_WITH_CONDITIONS') return 'SEF management approval with conditions submitted.';
  return 'SEF management approval submitted.';
}

function sefDecisionErrorMessage(decision: string) {
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

export function KycFormEditorPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [form, setForm] = useState<KycFormData>(emptyForm);
  const formRef = useRef<KycFormData>(emptyForm);
  const [activeSection, setActiveSection] = useState<SectionKey>('sectionA');
  const [saving, setSaving] = useState(false);
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
        const normalized = normalizeForm(formData);
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
  const canPrepareKyc = hasAnyRole(user, workflowRoles.kycPreparation);
  const sectionHMode: SectionHMode = canEditAllSections ? 'ALL' : hasAnyRole(user, ['DMLRO']) ? 'DMLRO' : hasAnyRole(user, ['MLRO']) ? 'MLRO' : hasAnyRole(user, ['SEF']) ? 'SEF' : 'AML';
  const visibleSections = useMemo(
    () => sections.filter((section) => canEditAllSections || canPrepareKyc || section.key === 'sectionH'),
    [canEditAllSections, canPrepareKyc]
  );

  useEffect(() => {
    if (!visibleSections.some((section) => section.key === activeSection)) {
      setActiveSection(visibleSections[0]?.key || 'sectionH');
    }
  }, [activeSection, visibleSections]);

  useEffect(() => {
    if (canEditAllSections || canPrepareKyc) {
      setActiveSection('sectionA');
    }
  }, [id, canEditAllSections, canPrepareKyc]);

  function setSection(section: SectionKey, value: Record<string, any>) {
    setForm((current) => {
      const next = { ...current, [section]: value };
      formRef.current = next;
      return next;
    });
  }

  async function save(section: SectionKey) {
    if (!id) return;
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
      const updated = await saveKycFormSection(id, endpoint, payload);
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
      sectionH: { ...(currentForm.sectionH || {}), reviewPart: sectionHMode }
    };
  }

  async function saveDraft() {
    if (!id) return null;
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
    if (!id) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const saved = await saveDraft();
      if (!saved) return;
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
    const reason = sectionH.dmlroReason || sectionH.dmlroComments || '';
    const conditions = sectionH.dmlroConditions || '';
    if (!sectionH.dmlroName || !sectionH.dmlroDate || (!sectionH.dmlroSignatureDataUrl && !sectionH.dmlroSignatureFileName)) {
      setError('Complete the DMLRO name, date, and signature before submitting the DMLRO decision.');
      return;
    }
    if (['APPROVE_WITH_CONDITIONS', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_SUPERVISOR'].includes(decision) && !reason && !conditions) {
      setError('Add DMLRO reason, conditions, or comments before submitting this decision.');
      return;
    }

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
        formalComments: latestSectionH.dmlroComments || reason || conditions
      });
      const [caseData, formData] = await Promise.all([getKycCase(id), getKycForm(id)]);
      const normalized = normalizeForm(formData);
      setKycCase(caseData);
      formRef.current = normalized;
      setForm(normalized);
      setMessage(dmlroDecisionSuccessMessage(decision));
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

    if (!sectionH.mlroName || !sectionH.mlroDate || (!sectionH.mlroSignatureDataUrl && !sectionH.mlroSignatureFileName)) {
      setError('Complete the MLRO name, date, and signature before submitting the final decision.');
      return;
    }
    if (!decision) {
      setError('Select the MLRO final decision before submitting.');
      return;
    }
    if (!finalRiskClassification || !riskExplanation) {
      setError('Select the final risk classification and add a risk explanation before submitting the final decision.');
      return;
    }
    if (decision === 'SEND_TO_SEF' && finalRiskClassification !== 'HIGH') {
      setError('SEF management approval is only available for high-risk KYC files. Select High as the final risk classification first.');
      return;
    }
    if (finalRiskClassification === 'HIGH' && ['APPROVE', 'APPROVE_WITH_CONDITIONS'].includes(decision)) {
      setError('High-risk KYC files must be sent to SEF for management decision before final approval.');
      return;
    }

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
        finalRiskClassification,
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
      const normalized = normalizeForm(formData);
      setKycCase(caseData);
      formRef.current = normalized;
      setForm(normalized);
      setMessage(mlroDecisionSuccessMessage(decision));
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

    if (!sectionH.sefName || !sectionH.sefDate || (!sectionH.sefSignatureDataUrl && !sectionH.sefSignatureFileName)) {
      setError('Complete the SEF name, date, and signature before submitting the management decision.');
      return;
    }
    if (['APPROVE_WITH_CONDITIONS', 'REJECT'].includes(decision) && !sectionH.sefConditions && !sectionH.sefComments) {
      setError('Add SEF conditions or comments before submitting this decision.');
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');
    try {
      const saved = await save('sectionH');
      if (!saved) return;
      const latestSectionH = saved.sectionH || sectionH;
      await decideSefReview(id, {
        decision,
        reason: latestSectionH.sefComments || latestSectionH.sefConditions || '',
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
      const normalized = normalizeForm(formData);
      setKycCase(caseData);
      formRef.current = normalized;
      setForm(normalized);
      setMessage(sefDecisionSuccessMessage(decision));
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
  const dmlroSubmitLabel = dmlroDecision === 'APPROVE' || dmlroDecision === 'APPROVE_WITH_CONDITIONS' ? 'Submit to MLRO' : 'Send to AML Supervisor';
  const mlroDecision = form.sectionH?.mlroDecision || 'APPROVE';
  const mlroSubmitLabel =
    mlroDecision === 'RETURN_TO_DMLRO'
      ? 'Send to DMLRO'
      : mlroDecision === 'SEND_TO_SEF'
        ? 'Send to SEF'
        : mlroDecision === 'REQUEST_ADDITIONAL_INFORMATION'
          ? 'Request Additional Information'
          : mlroDecision === 'REJECT'
            ? 'Submit Rejection'
            : 'Submit Final Decision';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Link to={`/kyc/${kycCase.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-900">
            Back to case
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">KYC Form Builder</h1>
          <p className="text-sm text-slate-500">
            {kycCase.client.name} | {kycCase.service?.name || 'Service not selected'} | Version {form.version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={saveDraft} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          {sectionHMode === 'DMLRO' ? (
            <button onClick={submitDmlroFromKycForm} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Send className="h-4 w-4" />
              {dmlroSubmitLabel}
            </button>
          ) : null}
          {sectionHMode === 'MLRO' ? (
            <button onClick={submitMlroFromKycForm} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Send className="h-4 w-4" />
              {mlroSubmitLabel}
            </button>
          ) : null}
          {sectionHMode === 'SEF' ? (
            <button onClick={submitSefFromKycForm} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Send className="h-4 w-4" />
              Submit SEF Decision
            </button>
          ) : null}
          <button onClick={() => generate('docx')} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Download className="h-4 w-4" />
            DOCX
          </button>
          <button onClick={() => generate('pdf')} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <FileText className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {showReviewPackage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Review Package</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Use these sections together before submitting the next review decision. Select Screening or CRRF to review their details without leaving this screen.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[680px]">
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
              <button onClick={() => generate('docx')} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                <Download className="h-4 w-4" />
                Download DOCX
              </button>
              <button onClick={() => generate('pdf')} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                <FileText className="h-4 w-4" />
                Download PDF
              </button>
              <Link to={`/kyc/${kycCase.id}`} className="inline-flex items-center gap-2 rounded-md border border-brand-200 bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                View Case Summary
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {activeReviewPackage === 'kyc' ? (
        <div className="grid gap-5 2xl:grid-cols-[220px_minmax(430px,0.85fr)_minmax(520px,1.15fr)]">
          <KycFormSectionSidebar sections={visibleSections} active={activeSection} onChange={setActiveSection} />
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-sm font-semibold text-slate-950">{sections.find((item) => item.key === activeSection)?.label}</p>
              <p className="text-xs text-slate-500">Changes update the preview immediately. Save each section when ready.</p>
            </div>
            <div className="max-h-[calc(100vh-230px)] overflow-auto p-5">
              {activeSection === 'sectionA' ? <SectionAForm data={form.sectionA} onChange={(value) => setSection('sectionA', value)} /> : null}
              {activeSection === 'sectionB' ? (
                <SectionBForm
                  data={form.sectionB}
                  total={totalOwnership}
                  rootName={form.sectionA.legalName || kycCase.client.name}
                  currentClientId={kycCase.client.id}
                  onChange={(value) => setSection('sectionB', value)}
                />
              ) : null}
              {activeSection === 'sectionC' ? <SectionCForm data={form.sectionC} onChange={(value) => setSection('sectionC', value)} /> : null}
              {activeSection === 'sectionD' ? <SectionDComplianceForm data={form.sectionD} onChange={(value) => setSection('sectionD', value)} /> : null}
              {activeSection === 'sectionE' ? <SectionEContactForm data={form.sectionE} onChange={(value) => setSection('sectionE', value)} /> : null}
              {activeSection === 'sectionF' ? <SectionFRequiredDocumentsChecklist caseId={id || ''} data={form.sectionF} onChange={(value) => setSection('sectionF', value)} /> : null}
              {activeSection === 'sectionG' ? <SectionGDeclarationForm data={form.sectionG} onChange={(value) => setSection('sectionG', value)} /> : null}
              {activeSection === 'sectionH' ? <SectionHInternalReviewForm mode={sectionHMode} data={form.sectionH || {}} onChange={(value) => setSection('sectionH', value)} /> : null}
            </div>
          </section>
          <LiveDocumentPreviewPanel form={{ ...form, sectionB: { ...form.sectionB, totalOwnershipPercentage: totalOwnership } }} />
        </div>
      ) : null}
    </div>
  );
}

function KycFormSectionSidebar({ sections, active, onChange }: { sections: SectionDefinition[]; active: SectionKey; onChange: (key: SectionKey) => void }) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-2 2xl:sticky 2xl:top-20 2xl:h-fit">
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          onClick={() => onChange(section.key)}
          className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium ${active === section.key ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          {section.label}
        </button>
      ))}
    </aside>
  );
}

function SectionAForm({ data, onChange }: FormProps) {
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
      <Field label="Date" type="date" value={data.date} onChange={(value) => update(data, onChange, 'date', value)} />
      <Field label="Reference" value={data.reference} onChange={(value) => update(data, onChange, 'reference', value)} />
      <Field label="Legal Name of Company" value={data.legalName} onChange={(value) => update(data, onChange, 'legalName', value)} wide />
      <Field label="Commercial Registration No." value={data.commercialRegistrationNo} onChange={(value) => update(data, onChange, 'commercialRegistrationNo', value)} />
      <Field label="Tax Identification No." value={data.taxIdentificationNo} onChange={(value) => update(data, onChange, 'taxIdentificationNo', value)} />
      <Field label="Date of Incorporation" type="date" value={data.dateOfIncorporation} onChange={(value) => update(data, onChange, 'dateOfIncorporation', value)} />
      <Select label="Country of Incorporation" value={data.countryOfIncorporation} otherValue={data.countryOfIncorporationOther} options={countryOptions} onChange={setCountryOfIncorporation} onOtherChange={(value) => update(data, onChange, 'countryOfIncorporationOther', value)} allowOther />
      <Select label="Legal Form" value={data.legalForm} otherValue={data.legalFormOther} options={legalFormOptions} onChange={(value) => updateSelect(data, onChange, 'legalForm', value)} onOtherChange={(value) => update(data, onChange, 'legalFormOther', value)} allowOther />
      <Field label="Telephone" value={applyCountryDialCode(data.telephone || '', data.countryOfIncorporation || '')} onChange={setTelephone} />
      <Field label="Email" type="email" value={data.email} onChange={(value) => update(data, onChange, 'email', value)} />
      <Field label="Website" value={data.website} onChange={(value) => update(data, onChange, 'website', value)} />
      <Field label="Registered Office Address" value={data.registeredOfficeAddress} onChange={(value) => update(data, onChange, 'registeredOfficeAddress', value)} wide textarea />
      <Select label="Main purpose / nature of business" value={data.businessNature} otherValue={data.businessNatureOther} options={businessNatureOptions} onChange={(value) => updateSelect(data, onChange, 'businessNature', value)} onOtherChange={(value) => update(data, onChange, 'businessNatureOther', value)} wide allowOther />
      <Field label="License activities" value={data.licenseActivities} onChange={(value) => update(data, onChange, 'licenseActivities', value)} wide textarea />
      <Select label="Related Industry" value={data.relatedIndustry} otherValue={data.relatedIndustryOther} options={industryOptions} onChange={(value) => updateSelect(data, onChange, 'relatedIndustry', value)} onOtherChange={(value) => update(data, onChange, 'relatedIndustryOther', value)} wide allowOther />
      <MultiSelect label="Nature of prospective service from Newoon" value={listValue(data.prospectiveService).filter((service) => service !== 'Other')} options={prospectiveServiceOptions} onChange={(value) => onChange({ ...data, prospectiveService: value, prospectiveServiceOther: '' })} wide />
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
  return rows.filter((row) => !row.parentRowId).reduce((sum, row) => sum + Number(row.ownershipPercentage || 0), 0);
}

function ownershipLayerTotals(rows: Row[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const parentKey = row.parentRowId || 'ROOT';
    totals.set(parentKey, (totals.get(parentKey) || 0) + Number(row.ownershipPercentage || 0));
  });
  return totals;
}

function effectiveUboRows(sectionB: Record<string, any>) {
  const manualRows = sectionB.ubos || [];
  if (manualRows.length) return manualRows;
  return (sectionB.shareholders || []).filter((row: Row) => row.isUbo);
}

function SectionBForm({ data, total, rootName, currentClientId, onChange }: FormProps & { total: number; rootName: string; currentClientId: string }) {
  const shareholders = data.shareholders || [];
  const totals = ownershipLayerTotals(shareholders);
  const invalidLayerTotals = Array.from(totals.entries()).filter(([, layerTotal]) => layerTotal > 100);
  const hasUbo = shareholders.some((row: Row) => row.isUbo) || Boolean(data.ubos?.length);

  return (
    <div className="space-y-5">
      <OwnershipRows rootName={rootName} currentClientId={currentClientId} rows={shareholders} onChange={(rows) => onChange({ ...data, shareholders: rows })} />
      <div className={`rounded-md border p-3 text-sm font-semibold ${invalidLayerTotals.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        Direct ownership percentage: {total.toFixed(2)}%
        {invalidLayerTotals.length ? <span className="ml-2 font-medium">One or more ownership layers exceed 100%.</span> : null}
      </div>
      {!hasUbo ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
          No UBO is marked yet. You can save the draft, but mark the UBO before finalizing the KYC file.
        </div>
      ) : null}
      <OwnershipStructureDiagram rootName={rootName} rows={shareholders} ubos={data.ubos || []} />
      <Choice label="UBO different from shareholders" value={data.uboDifferentFromShareholders || 'No'} onChange={(value) => onChange({ ...data, uboDifferentFromShareholders: value })} />
      <Field label="UBO group structure notes" value={data.uboGroupStructureNotes} onChange={(value) => update(data, onChange, 'uboGroupStructureNotes', value)} textarea wide />
      <DynamicRows title="UBO rows" rows={data.ubos || []} onChange={(rows) => onChange({ ...data, ubos: rows })} fields={[
        ['fullName', 'Full name'], ['nationality', 'Nationality', 'multiselect', countryOptions], ['dateOfBirth', 'Date of birth', 'date'], ['identityNumber', 'QID / Passport / CR No.'], ['ownershipPercentage', 'Ownership %', 'number'], ['residenceAddress', 'Residence address']
      ]} />
    </div>
  );
}

function OwnershipRows({ rootName, currentClientId, rows, onChange }: { rootName: string; currentClientId: string; rows: Row[]; onChange: (rows: Row[]) => void }) {
  const [lookupMessages, setLookupMessages] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const corporateParents = rows.filter((row) => (row.shareholderType || 'Individual') === 'Corporate Entity');
  const parentLabels = new Map<string, string>(corporateParents.map((row, index) => [row.id || String(index), row.fullName || `Corporate shareholder ${index + 1}`]));

  function rowId(row: Row, index: number) {
    return row.id || String(index);
  }

  function patchRow(index: number, patch: Row) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
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
    const identifier = String(row.identityNumber || '').trim();
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
          <p className="text-sm font-semibold text-slate-950">Ownership rows</p>
          <p className="text-xs text-slate-500">Add each direct or layered owner. Corporate rows can be selected as a parent for the next layer.</p>
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
            Owner
          </button>
        </div>
      </div>
      {rows.map((row, index) => {
        const rowKey = rowId(row, index);
        const isExpanded = expandedRows[rowKey] ?? rows.length <= 2;
        const parentText = row.parentRowId ? `Owned by ${parentLabels.get(row.parentRowId) || 'corporate shareholder'}` : `Direct shareholder of ${rootName || 'client company'}`;
        const nationalityText = Array.isArray(row.nationality) ? row.nationality.join(', ') : row.nationality || '';
        return (
          <div key={rowKey} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <button type="button" onClick={() => toggleRow(rowKey)} className="inline-flex min-w-0 flex-1 items-center gap-3 text-left">
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{row.fullName || `Owner ${index + 1}`}</p>
                  <p className="truncate text-xs text-slate-500">{parentText}</p>
                </div>
              </button>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700">{row.shareholderType || 'Individual'}</span>
                {row.ownershipPercentage ? <span className="rounded-full bg-brand-50 px-2 py-1 font-semibold text-brand-700">{row.ownershipPercentage}%</span> : null}
                {nationalityText ? <span className="max-w-[180px] truncate rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">{nationalityText}</span> : null}
                {row.isUbo ? <span className="rounded-full bg-cyan-50 px-2 py-1 font-semibold text-cyan-700">UBO</span> : null}
                {row.linkedClientId ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">Linked client</span> : null}
              </div>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                title="Remove owner"
                aria-label={`Remove ${row.fullName || `owner ${index + 1}`}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {isExpanded ? (
              <div className="p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Select label="Shareholder type" value={row.shareholderType || 'Individual'} options={['Individual', 'Corporate Entity']} onChange={(value) => patchRow(index, { shareholderType: value, linkedClientId: '', linkedClientName: '' })} />
                  <label className="text-sm font-medium text-slate-700">
                    Parent owner / owned entity
                    <select
                      value={row.parentRowId || ''}
                      onChange={(event) => patchRow(index, { parentRowId: event.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="">Direct shareholder of {rootName || 'client company'}</option>
                      {corporateParents
                        .filter((parent, parentIndex) => (parent.id || String(parentIndex)) !== rowKey)
                        .map((parent, parentIndex) => {
                          const parentId = parent.id || String(parentIndex);
                          return (
                            <option key={parentId} value={parentId}>
                              {parent.fullName || `Corporate shareholder ${parentIndex + 1}`}
                            </option>
                          );
                        })}
                    </select>
                  </label>
                  <Field label="Full name" value={row.fullName} onChange={(value) => patchRow(index, { fullName: value })} />
                  <MultiSelect label="Nationality / country" value={row.nationality} options={countryOptions.filter(Boolean)} onChange={(value) => patchRow(index, { nationality: value })} placeholder="Select countries" />
                  <Field label={(row.shareholderType || 'Individual') === 'Corporate Entity' ? 'Date of incorporation' : 'Date of birth'} type="date" value={row.dateOfBirth} onChange={(value) => patchRow(index, { dateOfBirth: value })} />
                  <div className="text-sm font-medium text-slate-700">
                    <span>{(row.shareholderType || 'Individual') === 'Corporate Entity' ? 'CR number' : 'QID / Passport number'}</span>
                    <div className="mt-1 flex gap-2">
                      <input value={row.identityNumber || ''} onChange={(event) => patchRow(index, { identityNumber: event.target.value, linkedClientId: '', linkedClientName: '' })} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
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
                  <Field label="Ownership %" type="number" value={row.ownershipPercentage} onChange={(value) => patchRow(index, { ownershipPercentage: value })} />
                  <Field label="Residence / registered address" value={row.residenceAddress} onChange={(value) => patchRow(index, { residenceAddress: value })} />
                  <label className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={Boolean(row.isUbo)} onChange={(event) => patchRow(index, { isUbo: event.target.checked })} />
                    Mark as UBO
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {!rows.length ? <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">No ownership rows added yet.</div> : null}
    </div>
  );
}

function OwnershipStructureDiagram({ rootName, rows, ubos }: { rootName: string; rows: Row[]; ubos: Row[] }) {
  const hasRows = rows.length > 0;
  const uboIds = new Set([
    ...rows.filter((row) => row.isUbo).map((row, index) => row.id || String(index)),
    ...ubos.map((row) => String(row.identityNumber || row.fullName || ''))
  ]);
  const normalizedRows: Row[] = rows.map((row, index) => ({ ...row, id: row.id || `ownership-${index + 1}` }));
  const childrenByParent = new Map<string, Row[]>();
  normalizedRows.forEach((row) => {
    const parent = row.parentRowId || 'ROOT';
    childrenByParent.set(parent, [...(childrenByParent.get(parent) || []), row]);
  });
  type DiagramNode = Row & { id: string; parentId: string; depth: number; x: number };
  const diagramNodes: DiagramNode[] = [{ id: 'ROOT', parentId: '', depth: 0, x: 0.5, fullName: rootName || 'Client company', shareholderType: 'Client company' } as DiagramNode];
  let leafIndex = 0;
  let maxDepth = 0;
  const walk = (parentId: string, depth: number): number => {
    const children = childrenByParent.get(parentId) || [];
    if (!children.length) return leafIndex++;
    const childXs = children.map((row) => {
      const childX = walk(row.id, depth + 1);
      diagramNodes.push({ ...(row as Row), id: String(row.id), parentId, depth, x: childX } as DiagramNode);
      maxDepth = Math.max(maxDepth, depth);
      return childX;
    });
    return childXs.reduce((sum, value) => sum + value, 0) / childXs.length;
  };
  const rootX = walk('ROOT', 1);
  const leafCount = Math.max(1, leafIndex);
  diagramNodes.forEach((node) => {
    node.x = ((node.id === 'ROOT' ? rootX : node.x) + 0.5) / leafCount;
  });
  const layerColors = ['bg-slate-950 text-white', 'bg-blue-50 text-slate-950 border-blue-300', 'bg-green-50 text-slate-950 border-green-300', 'bg-amber-50 text-slate-950 border-amber-300', 'bg-purple-50 text-slate-950 border-purple-300', 'bg-red-50 text-slate-950 border-red-300', 'bg-cyan-50 text-slate-950 border-cyan-300'];
  const layerCount = Math.max(1, maxDepth + 1);
  const diagramWidth = Math.max(920, leafCount * 250 + 170);
  const rowHeight = 128;
  const nodeWidth = 220;
  const nodeHeight = 92;
  const diagramHeight = 84 + layerCount * rowHeight;
  const leftRail = 122;
  const topOffset = 62;
  const usableWidth = diagramWidth - leftRail - 55;
  const nodeCenterX = (node: DiagramNode) => leftRail + 30 + node.x * usableWidth;
  const nodeTop = (node: DiagramNode) => topOffset + node.depth * rowHeight;
  const nodeDetail = (node: DiagramNode) => {
    if (node.id === 'ROOT') return 'Layer 0';
    if (Array.isArray(node.nationality)) return node.nationality.join(', ');
    return node.nationality || node.residenceAddress || '';
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-950">Ownership Structure</p>
      {!hasRows ? (
        <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No ownership structure generated.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-md border-2 border-slate-800 bg-white p-3">
          <div className="relative mx-auto" style={{ width: diagramWidth, height: diagramHeight }}>
            <h4 className="absolute left-0 right-0 top-3 text-center text-lg font-bold uppercase tracking-wide text-slate-950">
              {rootName || 'Client company'} - Ownership Structure
            </h4>
            {Array.from({ length: layerCount }).map((_, depth) => (
              <div
                key={depth}
                className={`absolute left-3 flex h-12 w-24 items-center justify-center rounded-md border text-sm font-bold shadow-sm ${layerColors[depth] || 'border-slate-300 bg-slate-50 text-slate-950'}`}
                style={{ top: topOffset + depth * rowHeight + 12 }}
              >
                Layer {depth}
              </div>
            ))}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${diagramWidth} ${diagramHeight}`} preserveAspectRatio="none">
              {diagramNodes.filter((node) => node.parentId).map((node) => {
                const parent = diagramNodes.find((candidate) => candidate.id === node.parentId);
                if (!parent) return null;
                const x1 = nodeCenterX(parent);
                const y1 = nodeTop(parent) + nodeHeight;
                const x2 = nodeCenterX(node);
                const y2 = nodeTop(node);
                const elbowY = (y1 + y2) / 2;
                return (
                  <g key={`${node.parentId}-${node.id}`}>
                    <path d={`M ${x1} ${y1} V ${elbowY} H ${x2} V ${y2}`} fill="none" stroke="#111827" strokeWidth="2" />
                    <path d={`M ${x2 - 5} ${y2 - 8} L ${x2} ${y2} L ${x2 + 5} ${y2 - 8}`} fill="none" stroke="#111827" strokeWidth="2" />
                    <text x={x2 + 8} y={Math.max(y2 - 12, elbowY - 4)} className="fill-slate-950 text-[13px] font-bold">
                      {node.ownershipPercentage ? `${node.ownershipPercentage}%` : ''}
                    </text>
                  </g>
                );
              })}
            </svg>
            {diagramNodes.map((node) => {
              const isRoot = node.id === 'ROOT';
              const isUbo = Boolean(node.isUbo) || uboIds.has(String(node.identityNumber || node.fullName || ''));
              const top = nodeTop(node);
              const left = nodeCenterX(node) - nodeWidth / 2;
              return (
                <div
                  key={node.id}
                  className={`absolute flex flex-col items-center justify-center rounded-md border px-8 py-2 text-center text-xs shadow-sm ${isRoot ? 'border-slate-950 bg-slate-950 text-white' : layerColors[node.depth] || 'border-slate-300 bg-white text-slate-950'}`}
                  style={{ width: nodeWidth, height: nodeHeight, left, top }}
                >
                  <p className="line-clamp-2 min-h-[28px] font-bold uppercase leading-tight">{node.fullName || 'Unnamed owner'}</p>
                  <p className={`mt-1 leading-tight ${isRoot ? 'text-slate-200' : 'text-slate-600'}`}>{node.shareholderType || 'Individual'}</p>
                  <p className={`mt-0.5 line-clamp-1 leading-tight ${isRoot ? 'text-slate-200' : 'text-slate-600'}`}>{nodeDetail(node)}</p>
                  {isUbo ? <span className="absolute right-2 top-2 rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold leading-none text-cyan-800">UBO</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function SectionCForm({ data, onChange }: FormProps) {
  return <DynamicRows title="Managers, Directors, Secretary and Signatories" rows={data.managers || []} onChange={(rows) => onChange({ ...data, managers: rows })} fields={[
    ['fullName', 'Full name'], ['entityName', 'Entity name'], ['nationality', 'Nationality', 'multiselect', countryOptions], ['address', 'Address'], ['dateOfBirth', 'Date of birth', 'date'], ['identityNumber', 'QID / Passport No.'], ['position', 'Position', 'multiselect', positionOptions], ['isAuthorizedSignatory', 'Authorized signatory', 'checkbox']
  ]} />;
}

function SectionDComplianceForm({ data, onChange }: FormProps) {
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
      <Choice label="Any PEP exposure?" value={data.pepQuestion || 'No'} onChange={setPepQuestion} />
      <Field label="PEP details" value={data.pepDetails} onChange={(value) => update(data, onChange, 'pepDetails', value)} textarea wide />
      {hasPepExposure ? (
        <SectionDSupportingDocuments label="PEP supporting documents" data={data} fieldKey="pepDocumentFileNames" onChange={onChange} />
      ) : null}
      <Choice label="Any sanction exposure?" value={data.sanctionQuestion || 'No'} onChange={setSanctionQuestion} />
      <Field label="Sanction details" value={data.sanctionDetails} onChange={(value) => update(data, onChange, 'sanctionDetails', value)} textarea wide />
      {hasSanctionExposure ? (
        <SectionDSupportingDocuments label="Sanction supporting documents" data={data} fieldKey="sanctionDocumentFileNames" onChange={onChange} />
      ) : null}
      <Choice label="Any dual citizenship?" value={data.dualCitizenshipQuestion || 'No'} onChange={setDualCitizenshipQuestion} />
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
      <span>{label}</span>
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

function SectionEContactForm({ data, onChange }: FormProps) {
  function setNationality(nationality: string) {
    onChange({
      ...data,
      nationality,
      ...(nationality === 'Other' ? {} : { nationalityOther: '' }),
      mobileNumber: applyCountryDialCode(data.mobileNumber || '', countryFromNationality(nationality))
    });
  }

  function setMobileNumber(mobileNumber: string) {
    onChange({
      ...data,
      mobileNumber: applyCountryDialCode(mobileNumber, countryFromNationality(data.nationality || ''))
    });
  }

  return <FormGrid>
    <Field label="Full name" value={data.fullName} onChange={(value) => update(data, onChange, 'fullName', value)} />
    <MultiSelect label="Position / Job title" value={data.position} otherValue={data.positionOther} options={positionOptions.filter(Boolean)} onChange={(value) => onChange({ ...data, position: value })} onOtherChange={(value) => update(data, onChange, 'positionOther', value)} allowOther placeholder="Select positions" />
    <Select label="Nationality" value={data.nationality} otherValue={data.nationalityOther} options={nationalityOptions} onChange={setNationality} onOtherChange={(value) => update(data, onChange, 'nationalityOther', value)} allowOther />
    <Field label="QID / Passport Number" value={data.identityNumber} onChange={(value) => update(data, onChange, 'identityNumber', value)} />
    <Field label="Mobile Number" value={applyCountryDialCode(data.mobileNumber || '', countryFromNationality(data.nationality || ''))} onChange={setMobileNumber} />
    <Field label="Email" type="email" value={data.email} onChange={(value) => update(data, onChange, 'email', value)} />
  </FormGrid>;
}

function SectionFRequiredDocumentsChecklist({ caseId, data, onChange }: FormProps & { caseId: string }) {
  const documents = data.documents || [];
  const additionalDocuments = data.additionalDocuments || [];
  const [uploadingKey, setUploadingKey] = useState('');
  const [uploadError, setUploadError] = useState('');

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
                  Provided
                </label>
                <MultiFileUploadControl
                  names={names}
                  disabled={uploadingKey === `required-${index}`}
                  buttonLabel={uploadingKey === `required-${index}` ? 'Uploading...' : 'Upload files'}
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

function SectionGDeclarationForm({ data, onChange }: FormProps) {
  return <FormGrid>
    <Field label="Full name" value={data.fullName} onChange={(value) => update(data, onChange, 'fullName', value)} />
    <Select label="Position" value={data.position} otherValue={data.positionOther} options={positionOptions} onChange={(value) => updateSelect(data, onChange, 'position', value)} onOtherChange={(value) => update(data, onChange, 'positionOther', value)} allowOther />
    <Field label="Date" type="date" value={data.date} onChange={(value) => update(data, onChange, 'date', value)} />
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
  const mlroDecisionValues = mlroFinalRisk === 'HIGH' ? highRiskMlroDecisionOptions : mlroFinalRisk ? standardMlroDecisionOptions : [''];
  const mlroDecisionValue = mlroDecisionValues.includes(data.mlroDecision || '') ? data.mlroDecision || '' : '';

  function updateMlroFinalRisk(value: string) {
    const nextDecisionOptions = value === 'HIGH' ? highRiskMlroDecisionOptions : value ? standardMlroDecisionOptions : [''];
    onChange({
      ...data,
      reviewPart: mode,
      mlroFinalRiskClassification: value,
      mlroDecision: nextDecisionOptions.includes(data.mlroDecision || '') ? data.mlroDecision : ''
    });
  }

  return <FormGrid>
    {showAml ? (
      <>
        <Choice label="Accuracy checked by AML Supervisor" value={data.amlAccuracyChecked ? 'Yes' : 'No'} onChange={(value) => onChange({ ...data, reviewPart: mode, amlAccuracyChecked: value === 'Yes' })} />
        <Field label="Clarification / findings" value={data.amlClarificationFindings} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'amlClarificationFindings', value)} textarea wide />
        <Select label="Risk classification" value={data.riskClassification} otherValue={data.riskClassificationOther} options={['', 'LOW', 'MEDIUM', 'HIGH']} onChange={(value) => updateSelect({ ...data, reviewPart: mode }, onChange, 'riskClassification', value)} onOtherChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'riskClassificationOther', value)} allowOther />
        <Select label="Due diligence type" value={data.dueDiligenceType} otherValue={data.dueDiligenceTypeOther} options={['', 'SIMPLIFIED', 'REGULAR', 'ENHANCED']} onChange={(value) => updateSelect({ ...data, reviewPart: mode }, onChange, 'dueDiligenceType', value)} onOtherChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dueDiligenceTypeOther', value)} allowOther />
        <Field label="AML Supervisor Name" value={data.amlName} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'amlName', value)} />
        <UploadField label="AML Supervisor signature" fileName={data.amlSignatureFileName} imageDataUrl={data.amlSignatureDataUrl} onChange={(file, dataUrl) => onChange({ ...data, reviewPart: mode, amlSignatureFileName: file.name, amlSignatureDataUrl: dataUrl })} />
        <Field label="AML Supervisor date" type="date" value={data.amlDate} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'amlDate', value)} />
      </>
    ) : null}
    {showDmlro ? (
      <>
        <Field label="DMLRO name" value={data.dmlroName} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroName', value)} />
        <UploadField label="DMLRO signature" fileName={data.dmlroSignatureFileName} imageDataUrl={data.dmlroSignatureDataUrl} onChange={(file, dataUrl) => onChange({ ...data, reviewPart: mode, dmlroSignatureFileName: file.name, dmlroSignatureDataUrl: dataUrl })} />
        <Field label="DMLRO date" type="date" value={data.dmlroDate} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroDate', value)} />
        <Select label="DMLRO decision" value={data.dmlroDecision || 'APPROVE'} options={dmlroDecisionOptions} optionLabels={dmlroDecisionLabels} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroDecision', value)} wide />
        {data.dmlroDecision === 'APPROVE_WITH_CONDITIONS' ? (
          <Field label="DMLRO approval conditions" value={data.dmlroConditions} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroConditions', value)} textarea wide />
        ) : null}
        {data.dmlroDecision === 'REQUEST_ADDITIONAL_INFORMATION' ? (
          <Field label="Additional information requested from AML Supervisor" value={data.dmlroReason} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroReason', value)} textarea wide />
        ) : null}
        {data.dmlroDecision === 'RETURN_TO_SUPERVISOR' ? (
          <Field label="Reason for returning to AML Supervisor" value={data.dmlroReason} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'dmlroReason', value)} textarea wide />
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
        <Field label="MLRO comments" value={data.mlroComments} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'mlroComments', value)} textarea wide />
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
        {data.sefDecision === 'REJECT' ? (
          <Field label="SEF rejection reason" value={data.sefConditions} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'sefConditions', value)} textarea wide />
        ) : null}
        <Field label="SEF comments" value={data.sefComments} onChange={(value) => update({ ...data, reviewPart: mode }, onChange, 'sefComments', value)} textarea wide />
      </>
    ) : null}
  </FormGrid>;
}

function LiveDocumentPreviewPanel({ form }: { form: KycFormData }) {
  return (
    <aside className="max-h-[calc(100vh-160px)] overflow-auto rounded-lg border border-slate-200 bg-slate-200 p-4">
      <div className="mx-auto min-h-[1120px] w-full max-w-[794px] bg-white p-8 text-[11px] leading-5 text-slate-900 shadow-sm">
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
            ['Date', form.sectionA.date], ['Reference', form.sectionA.reference], ['Legal Name of Company', form.sectionA.legalName], ['Commercial Registration No.', form.sectionA.commercialRegistrationNo], ['Tax Identification No.', form.sectionA.taxIdentificationNo], ['Date of Incorporation', form.sectionA.dateOfIncorporation], ['Country of Incorporation', resolveOtherValue(form.sectionA.countryOfIncorporation, form.sectionA.countryOfIncorporationOther)], ['Legal Form', resolveOtherValue(form.sectionA.legalForm, form.sectionA.legalFormOther)], ['Registered Office Address', form.sectionA.registeredOfficeAddress], ['Telephone', form.sectionA.telephone], ['Email', form.sectionA.email], ['Website', form.sectionA.website], ['Main purpose / nature of business', resolveOtherValue(form.sectionA.businessNature, form.sectionA.businessNatureOther)], ['License activities', form.sectionA.licenseActivities], ['Related Industry', resolveOtherValue(form.sectionA.relatedIndustry, form.sectionA.relatedIndustryOther)], ['Nature of prospective service from Newoon', displaySelectedList(form.sectionA.prospectiveService, form.sectionA.prospectiveServiceOther)]
          ]} />
        </PreviewSection>
        <PreviewSection title="B. Ownership / Shareholders">
          <PreviewTable headers={['Type', 'Full name', 'Nationality / country', 'DOB / Incorporation', 'QID / Passport / CR', 'Ownership %', 'Address', 'Linked client', 'UBO']} rows={(form.sectionB.shareholders || []).map((row) => [row.shareholderType || 'Individual', row.fullName, displaySelectedList(row.nationality, row.nationalityOther), displayDate(row.dateOfBirth), row.identityNumber, row.ownershipPercentage, row.residenceAddress, row.linkedClientName || '-', row.isUbo ? 'Yes' : 'No'])} />
          <p className="mt-2 font-semibold">Total ownership percentage: {form.sectionB.totalOwnershipPercentage || 0}%</p>
          <p>UBO different from shareholders: {form.sectionB.uboDifferentFromShareholders || 'No'}</p>
          <p>UBO group structure notes: {form.sectionB.uboGroupStructureNotes || '-'}</p>
          <OwnershipStructureDiagram rootName={form.sectionA.legalName || 'Client company'} rows={form.sectionB.shareholders || []} ubos={form.sectionB.ubos || []} />
          <PreviewTable headers={['UBO name', 'Nationality', 'DOB', 'Identity No.', 'Ownership %', 'Address']} rows={effectiveUboRows(form.sectionB).map((row: Row) => [row.fullName, displaySelectedList(row.nationality, row.nationalityOther), displayDate(row.dateOfBirth), row.identityNumber, row.ownershipPercentage, row.residenceAddress])} />
        </PreviewSection>
        <PreviewSection title="C. Manager / Authorized Signatory / Directors / Secretary">
          <PreviewTable headers={['Full name', 'Position', 'Entity', 'Nationality', 'Address', 'DOB', 'ID No.', 'Signatory']} rows={(form.sectionC.managers || []).map((row) => [row.fullName, displaySelectedList(row.position, row.positionOther), row.entityName, displaySelectedList(row.nationality) || row.nationalityAndAddress, row.address, displayDate(row.dateOfBirth), row.identityNumber, row.isAuthorizedSignatory ? 'Yes' : 'No'])} />
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
          <PreviewGrid rows={[['Full name', form.sectionE.fullName], ['Position / Job title', displaySelectedList(form.sectionE.position, form.sectionE.positionOther)], ['Nationality', resolveOtherValue(form.sectionE.nationality, form.sectionE.nationalityOther)], ['QID / Passport Number', form.sectionE.identityNumber], ['Mobile Number', form.sectionE.mobileNumber], ['Email', form.sectionE.email]]} />
        </PreviewSection>
        <PreviewSection title="F. Required Documents Checklist">
          <PreviewTable headers={['Document', 'Provided', 'Uploaded file']} rows={(form.sectionF.documents || []).map((row) => [row.documentType, row.isProvided ? '☑' : '☐', row.fileName])} />
          <PreviewTable headers={['Additional uploaded file']} rows={(form.sectionF.additionalDocuments || []).map((row: Row) => [row.fileName])} />
          <PreviewGrid rows={[['Additional notes for KYC preparation documents', form.sectionF.uploadedFilesNote || '-']]} />
        </PreviewSection>
        <PreviewSection title="G. Client Declaration">
          <PreviewGrid rows={[['Full name', form.sectionG.fullName], ['Position', resolveOtherValue(form.sectionG.position, form.sectionG.positionOther)], ['Date', form.sectionG.date], ['Authorized signature', previewImage(form.sectionG.signatureDataUrl, form.sectionG.signatureFileName)], ['Company stamp', previewImage(form.sectionG.stampDataUrl, form.sectionG.stampFileName)]]} />
        </PreviewSection>
        <PreviewSection title="H. Internal Use Only">
          <PreviewGrid rows={[['Accuracy checked', form.sectionH?.amlAccuracyChecked ? 'Yes' : 'No'], ['Clarification / findings', form.sectionH?.amlClarificationFindings], ['Risk classification', form.sectionH?.riskClassification], ['Due diligence type', form.sectionH?.dueDiligenceType], ['AML Supervisor Name', form.sectionH?.amlName], ['AML Supervisor signature', previewImage(form.sectionH?.amlSignatureDataUrl, form.sectionH?.amlSignatureFileName)], ['AML Supervisor date', form.sectionH?.amlDate], ['DMLRO name', form.sectionH?.dmlroName], ['DMLRO signature', previewImage(form.sectionH?.dmlroSignatureDataUrl, form.sectionH?.dmlroSignatureFileName)], ['DMLRO date', form.sectionH?.dmlroDate], ['DMLRO decision', dmlroDecisionLabels[form.sectionH?.dmlroDecision || ''] || form.sectionH?.dmlroDecision], ['DMLRO conditions', form.sectionH?.dmlroConditions], ['DMLRO reason', form.sectionH?.dmlroReason], ['DMLRO comments', form.sectionH?.dmlroComments], ['MLRO name', form.sectionH?.mlroName], ['MLRO signature', previewImage(form.sectionH?.mlroSignatureDataUrl, form.sectionH?.mlroSignatureFileName)], ['MLRO date', form.sectionH?.mlroDate], ['MLRO final decision', mlroDecisionLabels[form.sectionH?.mlroDecision || ''] || form.sectionH?.mlroDecision], ['Final risk classification', form.sectionH?.mlroFinalRiskClassification || form.sectionH?.riskClassification], ['Risk reason category', displayCodeLabel(form.sectionH?.mlroRiskReasonCategory)], ['Risk explanation', form.sectionH?.mlroRiskExplanation], ['MLRO conditions', form.sectionH?.mlroConditions], ['MLRO comments', form.sectionH?.mlroComments], ['SEF name', form.sectionH?.sefName], ['SEF signature', previewImage(form.sectionH?.sefSignatureDataUrl, form.sectionH?.sefSignatureFileName)], ['SEF date', form.sectionH?.sefDate], ['SEF management decision', sefDecisionLabels[form.sectionH?.sefDecision || ''] || form.sectionH?.sefDecision], ['SEF conditions', form.sectionH?.sefConditions], ['SEF comments', form.sectionH?.sefComments]]} />
        </PreviewSection>
        <div className="mt-8 border-t border-slate-300 pt-2 text-center text-[10px] font-medium text-slate-500">Newoon Corporate Services | KYC onboarding, engagement workflow and AML review support</div>
      </div>
    </aside>
  );
}

type FormProps = { data: Record<string, any>; onChange: (value: Record<string, any>) => void };

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Field({ label, value, onChange, type = 'text', textarea = false, wide = false }: { label: string; value: any; onChange: (value: string) => void; type?: string; textarea?: boolean; wide?: boolean }) {
  const className = `${wide ? 'md:col-span-2' : ''} text-sm font-medium text-slate-700`;
  return (
    <label className={className}>
      {label}
      {textarea ? (
        <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      ) : (
        <input value={dateInputValue(value, type)} type={type} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
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
      <span>{label}</span>
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
      <span>{label}</span>
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
  return <div><p className="text-sm font-medium text-slate-700">{label}</p><div className="mt-2 inline-flex overflow-hidden rounded-md border border-slate-300">{['Yes', 'No'].map((option) => <button key={option} type="button" onClick={() => onChange(option)} className={`px-4 py-2 text-sm font-semibold ${value === option ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{option}</button>)}</div></div>;
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
      {label}
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

function DynamicRows({ title, rows, fields, onChange }: { title: string; rows: Row[]; fields: DynamicField[]; onChange: (rows: Row[]) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <button type="button" onClick={() => onChange([...rows, {}])} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" /> Add row</button>
      </div>
      {rows.map((row, index) => (
        <div key={index} className="rounded-md border border-slate-200 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map(([key, label, type, options]) => {
              if (type === 'checkbox') {
                return <label key={key} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={Boolean(row[key])} onChange={(event) => updateRow(rows, index, key, event.target.checked, onChange)} /> {label}</label>;
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

function PreviewGrid({ rows }: { rows: Array<[string, any]> }) {
  return <div className="grid grid-cols-2 border-l border-t border-slate-300">{rows.map(([label, value]) => <div key={label} className="min-h-8 border-b border-r border-slate-300 p-1"><span className="font-semibold">{label}: </span>{renderPreviewValue(label, value)}</div>)}</div>;
}

function previewImage(imageDataUrl?: string, fileName?: string) {
  return { imageDataUrl, fileName };
}

function renderPreviewValue(label: string, value: any) {
  if (value?.imageDataUrl) {
    return <img src={value.imageDataUrl} alt={`${label} preview`} className="mt-1 max-h-12 max-w-full object-contain" />;
  }

  if (value?.fileName) return value.fileName;
  if (value && typeof value === 'object') return '-';
  return value || '-';
}

function PreviewTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return <table className="mt-2 w-full border-collapse text-[10px]"><thead><tr>{headers.map((header) => <th key={header} className="border border-slate-300 bg-slate-100 p-1 text-left">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{headers.map((header, cellIndex) => <td key={cellIndex} className="border border-slate-300 p-1">{renderPreviewValue(header, row[cellIndex])}</td>)}</tr>) : <tr><td colSpan={headers.length} className="border border-slate-300 p-2 text-center text-slate-500">No rows added</td></tr>}</tbody></table>;
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

function normalizeForm(form: KycFormData): KycFormData {
  const sectionA = {
    ...emptyForm.sectionA,
    ...(form.sectionA || {})
  };
  sectionA.telephone = applyCountryDialCode(sectionA.telephone || '', sectionA.countryOfIncorporation || '');
  const sectionE = {
    ...emptyForm.sectionE,
    ...(form.sectionE || {})
  };
  sectionE.position = listValue(sectionE.position);
  sectionE.mobileNumber = applyCountryDialCode(sectionE.mobileNumber || '', countryFromNationality(sectionE.nationality || ''));

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

function dateInputValue(value: any, type: string) {
  if (type !== 'date' || !value) return value || '';
  return String(value).slice(0, 10);
}

function displayDate(value: any) {
  return value ? String(value).slice(0, 10) : '';
}
