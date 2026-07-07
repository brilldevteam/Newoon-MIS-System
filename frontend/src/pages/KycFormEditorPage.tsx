import { Download, FileText, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  downloadGeneratedKycDocument,
  generateKycDocument,
  getKycCase,
  getKycForm,
  KycCase,
  KycFormData,
  saveKycFormSection
} from '../services/kyc-workflow.service';
import { applyCountryDialCode, countryDialOptions } from '../utils/country-phone';

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

const countryOptions = [...countryDialOptions.map((option) => option.name), 'Other'];

const nationalityOptions = [
  '',
  'Qatari',
  'Saudi',
  'Emirati',
  'Bahraini',
  'Kuwaiti',
  'Omani',
  'Indian',
  'Pakistani',
  'Bangladeshi',
  'Sri Lankan',
  'British',
  'American',
  'Other'
];

const legalFormOptions = [
  '',
  'LLC',
  'Branch',
  'Partnership',
  'Government entity',
  'Registered in stock exchange',
  'Trust/Funds',
  'Sole establishment',
  'Other'
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
  'Trading',
  'Other'
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
  'Holding company',
  'Other'
];

const prospectiveServiceOptions = [
  '',
  'Company Formation',
  'Secretary & Compliance services',
  'Director services',
  'Senior executive function services',
  'Accounting services',
  'Tax services',
  'AML / Compliance advisory',
  'Other'
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
  'Compliance Officer',
  'Other'
];

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
  sectionF: { documents: requiredDocuments.map((documentType) => ({ documentType, isRequired: true, isProvided: false })) },
  sectionG: {},
  sectionH: {},
  generatedDocuments: [],
  updatedAt: ''
};

type SectionKey = (typeof sections)[number]['key'];
type Row = Record<string, any>;

export function KycFormEditorPage() {
  const { id } = useParams();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [form, setForm] = useState<KycFormData>(emptyForm);
  const [activeSection, setActiveSection] = useState<SectionKey>('sectionA');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([getKycCase(id), getKycForm(id)]).then(([caseData, formData]) => {
      setKycCase(caseData);
      setForm(normalizeForm(formData));
    });
  }, [id]);

  const totalOwnership = useMemo(
    () => (form.sectionB.shareholders || []).reduce((sum, row) => sum + Number(row.ownershipPercentage || 0), 0),
    [form.sectionB.shareholders]
  );

  function setSection(section: SectionKey, value: Record<string, any>) {
    setForm((current) => ({ ...current, [section]: value }));
  }

  async function save(section: SectionKey) {
    if (!id) return;
    setSaving(true);
    setMessage('');
    setError('');
    const endpoint = sections.find((item) => item.key === section)?.id;
    if (!endpoint) return;

    const payload = section === 'sectionB' ? { ...form.sectionB, totalOwnershipPercentage: totalOwnership } : (form[section] as Record<string, any>);
    try {
      const updated = await saveKycFormSection(id, endpoint, payload);
      setForm(normalizeForm(updated));
      setMessage('Draft saved');
      return normalizeForm(updated);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to save this KYC section.');
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
      const saved = await save(activeSection);
      if (!saved) return;
      const document = await generateKycDocument(id, type);
      const updated = await getKycForm(id);
      setForm(normalizeForm(updated));
      await downloadGeneratedKycDocument(id, document.id, document.fileName);
      setMessage(`${type.toUpperCase()} generated and downloaded`);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || `Unable to generate ${type.toUpperCase()} document.`);
    } finally {
      setSaving(false);
    }
  }

  if (!kycCase) {
    return <p className="text-sm text-slate-500">Loading KYC form builder...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Link to={`/kyc/${kycCase.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-900">
            Back to case
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">KYC Part 1 Form Builder</h1>
          <p className="text-sm text-slate-500">
            {kycCase.client.name} | {kycCase.service?.name || 'Service not selected'} | Version {form.version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => save(activeSection)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
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

      {message ? <p className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-5 2xl:grid-cols-[220px_minmax(430px,0.85fr)_minmax(520px,1.15fr)]">
        <KycFormSectionSidebar active={activeSection} onChange={setActiveSection} />
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-sm font-semibold text-slate-950">{sections.find((item) => item.key === activeSection)?.label}</p>
            <p className="text-xs text-slate-500">Changes update the preview immediately. Save each section when ready.</p>
          </div>
          <div className="max-h-[calc(100vh-230px)] overflow-auto p-5">
            {activeSection === 'sectionA' ? <SectionAForm data={form.sectionA} onChange={(value) => setSection('sectionA', value)} /> : null}
            {activeSection === 'sectionB' ? <SectionBForm data={form.sectionB} total={totalOwnership} onChange={(value) => setSection('sectionB', value)} /> : null}
            {activeSection === 'sectionC' ? <SectionCForm data={form.sectionC} onChange={(value) => setSection('sectionC', value)} /> : null}
            {activeSection === 'sectionD' ? <SectionDComplianceForm data={form.sectionD} onChange={(value) => setSection('sectionD', value)} /> : null}
            {activeSection === 'sectionE' ? <SectionEContactForm data={form.sectionE} onChange={(value) => setSection('sectionE', value)} /> : null}
            {activeSection === 'sectionF' ? <SectionFRequiredDocumentsChecklist data={form.sectionF} onChange={(value) => setSection('sectionF', value)} /> : null}
            {activeSection === 'sectionG' ? <SectionGDeclarationForm data={form.sectionG} onChange={(value) => setSection('sectionG', value)} /> : null}
            {activeSection === 'sectionH' ? <SectionHInternalReviewForm data={form.sectionH || {}} onChange={(value) => setSection('sectionH', value)} /> : null}
          </div>
        </section>
        <LiveDocumentPreviewPanel form={{ ...form, sectionB: { ...form.sectionB, totalOwnershipPercentage: totalOwnership } }} />
      </div>
    </div>
  );
}

function KycFormSectionSidebar({ active, onChange }: { active: SectionKey; onChange: (key: SectionKey) => void }) {
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
      <Select label="Country of Incorporation" value={data.countryOfIncorporation} options={countryOptions} onChange={setCountryOfIncorporation} />
      <Select label="Legal Form" value={data.legalForm} options={legalFormOptions} onChange={(value) => update(data, onChange, 'legalForm', value)} />
      <Field label="Telephone" value={applyCountryDialCode(data.telephone || '', data.countryOfIncorporation || '')} onChange={setTelephone} />
      <Field label="Email" type="email" value={data.email} onChange={(value) => update(data, onChange, 'email', value)} />
      <Field label="Website" value={data.website} onChange={(value) => update(data, onChange, 'website', value)} />
      <Field label="Registered Office Address" value={data.registeredOfficeAddress} onChange={(value) => update(data, onChange, 'registeredOfficeAddress', value)} wide textarea />
      <Select label="Main purpose / nature of business" value={data.businessNature} options={businessNatureOptions} onChange={(value) => update(data, onChange, 'businessNature', value)} wide />
      <Field label="License activities" value={data.licenseActivities} onChange={(value) => update(data, onChange, 'licenseActivities', value)} wide textarea />
      <Select label="Related Industry" value={data.relatedIndustry} options={industryOptions} onChange={(value) => update(data, onChange, 'relatedIndustry', value)} />
      <Select label="Nature of prospective service from Newoon" value={data.prospectiveService} options={prospectiveServiceOptions} onChange={(value) => update(data, onChange, 'prospectiveService', value)} wide />
    </FormGrid>
  );
}

function SectionBForm({ data, total, onChange }: FormProps & { total: number }) {
  return (
    <div className="space-y-5">
      <DynamicRows title="Shareholders" rows={data.shareholders || []} onChange={(rows) => onChange({ ...data, shareholders: rows })} fields={[
        ['fullName', 'Full name'], ['nationality', 'Nationality', 'select', nationalityOptions], ['dateOfBirth', 'Date of birth', 'date'], ['identityNumber', 'QID / Passport / CR No.'], ['ownershipPercentage', 'Ownership %', 'number'], ['residenceAddress', 'Residence address']
      ]} />
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">Total ownership percentage: {total.toFixed(2)}%</div>
      <Choice label="UBO different from shareholders" value={data.uboDifferentFromShareholders || 'No'} onChange={(value) => onChange({ ...data, uboDifferentFromShareholders: value })} />
      <Field label="UBO group structure notes" value={data.uboGroupStructureNotes} onChange={(value) => update(data, onChange, 'uboGroupStructureNotes', value)} textarea wide />
      <DynamicRows title="UBO rows" rows={data.ubos || []} onChange={(rows) => onChange({ ...data, ubos: rows })} fields={[
        ['fullName', 'Full name'], ['nationality', 'Nationality', 'select', nationalityOptions], ['dateOfBirth', 'Date of birth', 'date'], ['identityNumber', 'QID / Passport / CR No.'], ['ownershipPercentage', 'Ownership %', 'number'], ['residenceAddress', 'Residence address']
      ]} />
    </div>
  );
}

function SectionCForm({ data, onChange }: FormProps) {
  return <DynamicRows title="Managers, Directors, Secretary and Signatories" rows={data.managers || []} onChange={(rows) => onChange({ ...data, managers: rows })} fields={[
    ['fullName', 'Full name'], ['entityName', 'Entity name'], ['nationalityAndAddress', 'Nationality and address'], ['dateOfBirth', 'Date of birth', 'date'], ['identityNumber', 'QID / Passport No.'], ['position', 'Position', 'select', positionOptions], ['isAuthorizedSignatory', 'Authorized signatory', 'checkbox']
  ]} />;
}

function SectionDComplianceForm({ data, onChange }: FormProps) {
  return (
    <div className="space-y-5">
      <Choice label="Any PEP exposure?" value={data.pepQuestion || 'No'} onChange={(value) => onChange({ ...data, pepQuestion: value })} />
      <Field label="PEP details" value={data.pepDetails} onChange={(value) => update(data, onChange, 'pepDetails', value)} textarea wide />
      <Choice label="Any sanction exposure?" value={data.sanctionQuestion || 'No'} onChange={(value) => onChange({ ...data, sanctionQuestion: value })} />
      <Field label="Sanction details" value={data.sanctionDetails} onChange={(value) => update(data, onChange, 'sanctionDetails', value)} textarea wide />
      <Choice label="Any dual citizenship?" value={data.dualCitizenshipQuestion || 'No'} onChange={(value) => onChange({ ...data, dualCitizenshipQuestion: value })} />
      <Field label="Dual citizenship details" value={data.dualCitizenshipDetails} onChange={(value) => update(data, onChange, 'dualCitizenshipDetails', value)} textarea wide />
    </div>
  );
}

function SectionEContactForm({ data, onChange }: FormProps) {
  return <FormGrid>
    <Field label="Full name" value={data.fullName} onChange={(value) => update(data, onChange, 'fullName', value)} />
    <Select label="Position / Job title" value={data.position} options={positionOptions} onChange={(value) => update(data, onChange, 'position', value)} />
    <Select label="Nationality" value={data.nationality} options={nationalityOptions} onChange={(value) => update(data, onChange, 'nationality', value)} />
    <Field label="QID / Passport Number" value={data.identityNumber} onChange={(value) => update(data, onChange, 'identityNumber', value)} />
    <Field label="Mobile Number" value={data.mobileNumber} onChange={(value) => update(data, onChange, 'mobileNumber', value)} />
    <Field label="Email" type="email" value={data.email} onChange={(value) => update(data, onChange, 'email', value)} />
  </FormGrid>;
}

function SectionFRequiredDocumentsChecklist({ data, onChange }: FormProps) {
  const documents = data.documents || [];

  function uploadDocument(index: number, file: File | null) {
    if (!file) return;
    onChange({
      ...data,
      documents: documents.map((row: Row, rowIndex: number) =>
        rowIndex === index
          ? {
              ...row,
              isProvided: true,
              fileName: file.name,
              mimeType: file.type || undefined,
              size: file.size
            }
          : row
      )
    });
  }

  return (
    <div className="space-y-3">
      {documents.map((document: Row, index: number) => (
        <div key={`${document.documentType}-${index}`} className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_110px_minmax(180px,1fr)]">
          <p className="text-sm font-medium text-slate-800">{document.documentType}</p>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={Boolean(document.isProvided)} onChange={(event) => updateRow(documents, index, 'isProvided', event.target.checked, (rows) => onChange({ ...data, documents: rows }))} />
            Provided
          </label>
          <label
            className="inline-flex h-10 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            title={document.fileName || 'Upload'}
          >
            {document.fileName ? (
              <span className="truncate">{document.fileName}</span>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload
              </>
            )}
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                uploadDocument(index, event.target.files?.[0] || null);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      ))}
      <Field label="Upload related document files note" value={data.uploadedFilesNote} onChange={(value) => update(data, onChange, 'uploadedFilesNote', value)} textarea wide />
    </div>
  );
}

function SectionGDeclarationForm({ data, onChange }: FormProps) {
  return <FormGrid>
    <Field label="Full name" value={data.fullName} onChange={(value) => update(data, onChange, 'fullName', value)} />
    <Select label="Position" value={data.position} options={positionOptions} onChange={(value) => update(data, onChange, 'position', value)} />
    <Field label="Date" type="date" value={data.date} onChange={(value) => update(data, onChange, 'date', value)} />
    <UploadField label="Authorized signature" fileName={data.signatureFileName} onChange={(file) => update(data, onChange, 'signatureFileName', file.name)} />
    <UploadField label="Company stamp" fileName={data.stampFileName} onChange={(file) => update(data, onChange, 'stampFileName', file.name)} />
  </FormGrid>;
}

function SectionHInternalReviewForm({ data, onChange }: FormProps) {
  return <FormGrid>
    <Choice label="Accuracy checked by AML Supervisor" value={data.amlAccuracyChecked ? 'Yes' : 'No'} onChange={(value) => onChange({ ...data, reviewPart: 'AML', amlAccuracyChecked: value === 'Yes' })} />
    <Field label="Clarification / findings" value={data.amlClarificationFindings} onChange={(value) => update({ ...data, reviewPart: 'AML' }, onChange, 'amlClarificationFindings', value)} textarea wide />
    <Select label="Risk classification" value={data.riskClassification} options={['', 'LOW', 'MEDIUM', 'HIGH']} onChange={(value) => update({ ...data, reviewPart: 'AML' }, onChange, 'riskClassification', value)} />
    <Select label="Due diligence type" value={data.dueDiligenceType} options={['', 'SIMPLIFIED', 'REGULAR', 'ENHANCED']} onChange={(value) => update({ ...data, reviewPart: 'AML' }, onChange, 'dueDiligenceType', value)} />
    <Field label="AML name" value={data.amlName} onChange={(value) => update({ ...data, reviewPart: 'AML' }, onChange, 'amlName', value)} />
    <UploadField label="AML signature" fileName={data.amlSignatureFileName} onChange={(file) => update({ ...data, reviewPart: 'AML' }, onChange, 'amlSignatureFileName', file.name)} />
    <Field label="AML date" type="date" value={data.amlDate} onChange={(value) => update({ ...data, reviewPart: 'AML' }, onChange, 'amlDate', value)} />
    <Field label="DMLRO name" value={data.dmlroName} onChange={(value) => update({ ...data, reviewPart: 'DMLRO' }, onChange, 'dmlroName', value)} />
    <UploadField label="DMLRO signature" fileName={data.dmlroSignatureFileName} onChange={(file) => update({ ...data, reviewPart: 'DMLRO' }, onChange, 'dmlroSignatureFileName', file.name)} />
    <Field label="DMLRO date" type="date" value={data.dmlroDate} onChange={(value) => update({ ...data, reviewPart: 'DMLRO' }, onChange, 'dmlroDate', value)} />
    <Field label="DMLRO comments" value={data.dmlroComments} onChange={(value) => update({ ...data, reviewPart: 'DMLRO' }, onChange, 'dmlroComments', value)} textarea wide />
    <Field label="MLRO name" value={data.mlroName} onChange={(value) => update({ ...data, reviewPart: 'MLRO' }, onChange, 'mlroName', value)} />
    <UploadField label="MLRO signature" fileName={data.mlroSignatureFileName} onChange={(file) => update({ ...data, reviewPart: 'MLRO' }, onChange, 'mlroSignatureFileName', file.name)} />
    <Field label="MLRO date" type="date" value={data.mlroDate} onChange={(value) => update({ ...data, reviewPart: 'MLRO' }, onChange, 'mlroDate', value)} />
    <Field label="MLRO comments" value={data.mlroComments} onChange={(value) => update({ ...data, reviewPart: 'MLRO' }, onChange, 'mlroComments', value)} textarea wide />
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
        <h2 className="mt-5 text-center text-base font-bold uppercase text-slate-950">Know Your Customer Form - Part 1</h2>
        <PreviewSection title="A. General Company Information">
          <PreviewGrid rows={[
            ['Date', form.sectionA.date], ['Reference', form.sectionA.reference], ['Legal Name of Company', form.sectionA.legalName], ['Commercial Registration No.', form.sectionA.commercialRegistrationNo], ['Tax Identification No.', form.sectionA.taxIdentificationNo], ['Date of Incorporation', form.sectionA.dateOfIncorporation], ['Country of Incorporation', form.sectionA.countryOfIncorporation], ['Legal Form', form.sectionA.legalForm], ['Registered Office Address', form.sectionA.registeredOfficeAddress], ['Telephone', form.sectionA.telephone], ['Email', form.sectionA.email], ['Website', form.sectionA.website], ['Main purpose / nature of business', form.sectionA.businessNature], ['License activities', form.sectionA.licenseActivities], ['Related Industry', form.sectionA.relatedIndustry], ['Nature of prospective service from Newoon', form.sectionA.prospectiveService]
          ]} />
        </PreviewSection>
        <PreviewSection title="B. Ownership / Shareholders">
          <PreviewTable headers={['Full name', 'Nationality', 'DOB', 'QID / Passport / CR', 'Ownership %', 'Address']} rows={(form.sectionB.shareholders || []).map((row) => [row.fullName, row.nationality, displayDate(row.dateOfBirth), row.identityNumber, row.ownershipPercentage, row.residenceAddress])} />
          <p className="mt-2 font-semibold">Total ownership percentage: {form.sectionB.totalOwnershipPercentage || 0}%</p>
          <p>UBO different from shareholders: {form.sectionB.uboDifferentFromShareholders || 'No'}</p>
          <p>UBO group structure notes: {form.sectionB.uboGroupStructureNotes || '-'}</p>
          <PreviewTable headers={['UBO name', 'Nationality', 'DOB', 'Identity No.', 'Ownership %', 'Address']} rows={(form.sectionB.ubos || []).map((row) => [row.fullName, row.nationality, displayDate(row.dateOfBirth), row.identityNumber, row.ownershipPercentage, row.residenceAddress])} />
        </PreviewSection>
        <PreviewSection title="C. Manager / Authorized Signatory / Directors / Secretary">
          <PreviewTable headers={['Full name', 'Entity', 'Nationality and address', 'DOB', 'ID No.', 'Position', 'Signatory']} rows={(form.sectionC.managers || []).map((row) => [row.fullName, row.entityName, row.nationalityAndAddress, displayDate(row.dateOfBirth), row.identityNumber, row.position, row.isAuthorizedSignatory ? 'Yes' : 'No'])} />
        </PreviewSection>
        <PreviewSection title="D. Compliance and Risk Information">
          <PreviewGrid rows={[['PEP question', form.sectionD.pepQuestion], ['PEP details', form.sectionD.pepDetails], ['Sanction question', form.sectionD.sanctionQuestion], ['Sanction details', form.sectionD.sanctionDetails], ['Dual citizenship question', form.sectionD.dualCitizenshipQuestion], ['Dual citizenship details', form.sectionD.dualCitizenshipDetails]]} />
        </PreviewSection>
        <PreviewSection title="E. Key Communication Person">
          <PreviewGrid rows={[['Full name', form.sectionE.fullName], ['Position / Job title', form.sectionE.position], ['Nationality', form.sectionE.nationality], ['QID / Passport Number', form.sectionE.identityNumber], ['Mobile Number', form.sectionE.mobileNumber], ['Email', form.sectionE.email]]} />
        </PreviewSection>
        <PreviewSection title="F. Required Documents Checklist">
          <PreviewTable headers={['Document', 'Provided', 'Uploaded file']} rows={(form.sectionF.documents || []).map((row) => [row.documentType, row.isProvided ? '☑' : '☐', row.fileName])} />
        </PreviewSection>
        <PreviewSection title="G. Client Declaration">
          <PreviewGrid rows={[['Full name', form.sectionG.fullName], ['Position', form.sectionG.position], ['Date', form.sectionG.date], ['Authorized signature', form.sectionG.signatureFileName], ['Company stamp', form.sectionG.stampFileName]]} />
        </PreviewSection>
        <PreviewSection title="H. Internal Use Only">
          <PreviewGrid rows={[['Accuracy checked', form.sectionH?.amlAccuracyChecked ? 'Yes' : 'No'], ['Clarification / findings', form.sectionH?.amlClarificationFindings], ['Risk classification', form.sectionH?.riskClassification], ['Due diligence type', form.sectionH?.dueDiligenceType], ['AML name', form.sectionH?.amlName], ['DMLRO name', form.sectionH?.dmlroName], ['DMLRO comments', form.sectionH?.dmlroComments], ['MLRO name', form.sectionH?.mlroName], ['MLRO comments', form.sectionH?.mlroComments]]} />
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

function Select({ label, value, options, onChange, wide = false }: { label: string; value: any; options: string[]; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <label className={`${wide ? 'md:col-span-2' : ''} text-sm font-medium text-slate-700`}>
      {label}
      <select value={value || ''} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
        {options.map((option) => (
          <option key={option} value={option}>
            {option || 'Select'}
          </option>
        ))}
      </select>
    </label>
  );
}

function Choice({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><p className="text-sm font-medium text-slate-700">{label}</p><div className="mt-2 inline-flex overflow-hidden rounded-md border border-slate-300">{['Yes', 'No'].map((option) => <button key={option} type="button" onClick={() => onChange(option)} className={`px-4 py-2 text-sm font-semibold ${value === option ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{option}</button>)}</div></div>;
}

function UploadField({ label, fileName, onChange }: { label: string; fileName?: string; onChange: (file: File) => void }) {
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
              if (file) onChange(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <div className="flex h-10 min-w-0 items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-normal text-slate-600">
          <span className="truncate">{fileName || 'No file selected'}</span>
        </div>
      </div>
    </div>
  );
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
                return <Select key={key} label={label} value={row[key]} options={options || ['']} onChange={(value) => updateRow(rows, index, key, value, onChange)} />;
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
  return <div className="grid grid-cols-2 border-l border-t border-slate-300">{rows.map(([label, value]) => <div key={label} className="min-h-8 border-b border-r border-slate-300 p-1"><span className="font-semibold">{label}: </span>{value || '-'}</div>)}</div>;
}

function PreviewTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return <table className="mt-2 w-full border-collapse text-[10px]"><thead><tr>{headers.map((header) => <th key={header} className="border border-slate-300 bg-slate-100 p-1 text-left">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{headers.map((_, cellIndex) => <td key={cellIndex} className="border border-slate-300 p-1">{row[cellIndex] || '-'}</td>)}</tr>) : <tr><td colSpan={headers.length} className="border border-slate-300 p-2 text-center text-slate-500">No rows added</td></tr>}</tbody></table>;
}

function update(data: Record<string, any>, onChange: (value: Record<string, any>) => void, key: string, value: any) {
  onChange({ ...data, [key]: value });
}

function updateRow(rows: Row[], index: number, key: string, value: any, onChange: (rows: Row[]) => void) {
  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
}

function normalizeForm(form: KycFormData): KycFormData {
  const sectionA = {
    ...emptyForm.sectionA,
    ...(form.sectionA || {})
  };
  sectionA.telephone = applyCountryDialCode(sectionA.telephone || '', sectionA.countryOfIncorporation || '');

  return {
    ...emptyForm,
    ...form,
    sectionA,
    sectionB: { ...emptyForm.sectionB, ...(form.sectionB || {}), shareholders: form.sectionB?.shareholders || [], ubos: form.sectionB?.ubos || [] },
    sectionC: { ...emptyForm.sectionC, ...(form.sectionC || {}), managers: form.sectionC?.managers || [] },
    sectionF: { ...emptyForm.sectionF, ...(form.sectionF || {}), documents: form.sectionF?.documents?.length ? form.sectionF.documents : emptyForm.sectionF.documents },
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
