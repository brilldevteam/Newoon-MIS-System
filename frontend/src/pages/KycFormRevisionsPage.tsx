import { ArrowLeft, Download, FileText, GitCompareArrows } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { safeCommentHtml } from '../components/RichTextEditor';
import { getApiErrorMessage } from '../services/api';
import { downloadKycFormRevision, downloadKycRevisionFile, getKycForm, getKycFormRevision, getKycFormRevisions, KycFormData, KycFormRevision, KycFormRevisionDetail } from '../services/kyc-workflow.service';
import { compareKycForms } from '../utils/kyc-form-diff';
import { LiveDocumentPreviewPanel, normalizeForm } from './KycFormEditorPage';

const sectionNames: Record<string, string> = { sectionA: 'Company', sectionB: 'Ownership', sectionC: 'Management', sectionD: 'Compliance', sectionE: 'Contact', sectionF: 'Documents', sectionG: 'Declaration' };
const label = (path: string) => path.split(' / ').map((part) => sectionNames[part] || part.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase())).join(' / ');

function ChangeValue({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') return <span className="text-slate-500">Not provided</span>;
  if (typeof value === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(value)) return <img src={value} alt="Signature or stamp" className="h-24 max-w-full object-contain object-left" />;
  if (typeof value === 'string' && value.startsWith('data:')) return <span>Embedded file content</span>;
  if (Array.isArray(value)) return <span>{value.map(String).join(', ')}</span>;
  if (typeof value === 'object') return <dl className="space-y-1">{Object.entries(value).filter(([key]) => !['id', 'tenantId', 'kycFormId', 'kycCaseId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'storagePath'].includes(key)).map(([key, item]) => <div key={key}><dt className="inline font-medium">{label(key)}: </dt><dd className="inline"><ChangeValue value={item} /></dd></div>)}</dl>;
  if (typeof value === 'string' && /<\/?[a-z][^>]*>/i.test(value)) return <div className="review-rich-text" dangerouslySetInnerHTML={{ __html: safeCommentHtml(value) }} />;
  return <span className="whitespace-pre-wrap">{typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}</span>;
}

export function KycFormRevisionsPage() {
  const { id } = useParams();
  const [current, setCurrent] = useState<KycFormData | null>(null);
  const [revisions, setRevisions] = useState<KycFormRevision[]>([]);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('current');
  const [left, setLeft] = useState<KycFormRevisionDetail | null>(null);
  const [right, setRight] = useState<KycFormRevisionDetail | null>(null);
  const [view, setView] = useState<'changes' | 'forms'>('changes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) return;
    setLoading(true); setError(''); setCurrent(null); setLeft(null); setRight(null);
    Promise.all([getKycForm(id), getKycFormRevisions(id)]).then(([form, history]) => {
      if (!active) return;
      setCurrent(form); setRevisions(history); setLeftId(history[0]?.id || ''); setRightId('current');
    }).catch((failure) => { if (active) setError(getApiErrorMessage(failure, 'Unable to load form history.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    if (!id || !leftId || !current) return;
    setLoading(true); setError(''); setLeft(null); setRight(null);
    Promise.all([getKycFormRevision(id, leftId), rightId === 'current' ? Promise.resolve(null) : getKycFormRevision(id, rightId)])
      .then(([original, amendment]) => { if (active) { setLeft(original); setRight(amendment); } })
      .catch((failure) => { if (active) setError(getApiErrorMessage(failure, 'Unable to load selected revisions.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, leftId, rightId, current]);

  const rightForm = rightId === 'current' ? current : right?.snapshot || null;
  useEffect(() => { if (leftId === rightId) setRightId('current'); }, [leftId, rightId]);
  const changes = useMemo(() => left && rightForm ? compareKycForms({ ...left.snapshot }, { ...rightForm }) : [], [left, rightForm]);

  async function download(revision: KycFormRevisionDetail, type: 'PDF' | 'DOCX') {
    if (!id || busy) return;
    setBusy(true); setError('');
    try { await downloadKycFormRevision(id, revision.id, type); }
    catch (failure) { setError(getApiErrorMessage(failure, 'Unable to download revision.')); }
    finally { setBusy(false); }
  }

  function revisionPanel(revision: KycFormRevisionDetail | null, form: KycFormData, title: string) {
    return <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{title} - Revision {form.version}</h2>
        {revision ? <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void download(revision, 'PDF')} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"><Download className="h-4 w-4" />PDF</button>
          {!form.preliminaryDocument ? <button type="button" disabled={busy} onClick={() => void download(revision, 'DOCX')} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"><FileText className="h-4 w-4" />DOCX</button> : null}</div> : <Link to={`/kyc/${id}/form`} className="text-sm text-brand-700 underline">Open current form</Link>}
      </div>
      <LiveDocumentPreviewPanel form={normalizeForm(form)} />
      {revision?.files.length ? <details className="mt-3 border-t border-slate-200 py-3"><summary className="cursor-pointer text-sm font-medium">Archived attachments ({revision.files.length})</summary><ul className="mt-2 space-y-2">{revision.files.map((file) => <li key={file.id}><button type="button" disabled={busy} className="inline-flex max-w-full items-center gap-2 break-all text-left text-sm text-brand-700 disabled:opacity-50" onClick={async () => {
        if (!id) return; setBusy(true); setError('');
        try { await downloadKycRevisionFile(id, revision.id, file.id, file.fileName); }
        catch (failure) { setError(getApiErrorMessage(failure, 'Unable to download archived attachment.')); }
        finally { setBusy(false); }
      }}><Download className="h-4 w-4 shrink-0" />{file.fileName}</button></li>)}</ul></details> : null}
    </section>;
  }

  return <div className="min-w-0 space-y-5">
    <Link to={`/kyc/${id}`} className="inline-flex items-center gap-2 text-sm text-brand-700"><ArrowLeft className="h-4 w-4" />Back to case</Link>
    <h1 className="text-2xl font-semibold">KYC Revisions</h1>
    {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {current && revisions.length ? <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Original revision<select value={leftId} onChange={(event) => setLeftId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2">{revisions.map((revision) => <option key={revision.id} value={revision.id}>Revision {revision.version} - {new Date(revision.createdAt).toLocaleDateString()}</option>)}</select></label>
        <label className="text-sm font-medium">Compare with<select value={rightId} onChange={(event) => setRightId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="current">Revision {current.version} - Current {current.status === 'AMENDMENT_DRAFT' ? 'amendment' : 'form'}</option>{revisions.filter((revision) => revision.id !== leftId).map((revision) => <option key={revision.id} value={revision.id}>Revision {revision.version}</option>)}</select></label>
      </div>
      {left ? <div className="border-l-4 border-amber-400 bg-amber-50 p-3 text-sm"><p className="font-semibold">Return / amendment reason</p><div className="review-rich-text mt-1" dangerouslySetInnerHTML={{ __html: safeCommentHtml(left.reason) }} /></div> : null}
      <div role="tablist" aria-label="Revision views" className="flex gap-1 border-b border-slate-200">{(['changes', 'forms'] as const).map((mode) => <button key={mode} role="tab" aria-selected={view === mode} onClick={() => setView(mode)} className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${view === mode ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600'}`}><GitCompareArrows className="h-4 w-4" />{mode === 'changes' ? `Changes (${changes.length})` : 'Compare forms'}</button>)}</div>
      {!loading && left && rightForm ? view === 'forms' ? <div className="grid min-w-0 gap-6 2xl:grid-cols-2">{revisionPanel(left, left.snapshot, 'Original')}{revisionPanel(right, rightForm, 'Amendment')}</div> : <div className="space-y-3">
        {!changes.length ? <p className="py-4 text-sm text-slate-600">No client form changes between these revisions.</p> : changes.map((change) => <section key={change.path} className="border-b border-slate-200 py-3"><h2 className="mb-2 break-words text-sm font-semibold">{label(change.path)} <span className="ml-2 text-xs font-normal text-slate-500">{change.kind}</span></h2><div className="grid gap-3 md:grid-cols-2"><div className="min-w-0 break-words border-l-2 border-red-300 pl-3 text-sm"><p className="mb-1 text-xs font-medium text-slate-500">Original</p><ChangeValue value={change.before} /></div><div className="min-w-0 break-words border-l-2 border-emerald-400 pl-3 text-sm"><p className="mb-1 text-xs font-medium text-slate-500">Amendment</p><ChangeValue value={change.after} /></div></div></section>)}
      </div> : null}
    </> : !loading && current ? <p className="text-sm text-slate-600">No previous revisions. The current form will be preserved when an amendment is opened.</p> : null}
    {loading ? <p role="status" className="text-sm text-slate-500">Loading revisions...</p> : null}
  </div>;
}
