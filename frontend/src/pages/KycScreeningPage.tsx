import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Eye, FileText, Plus, Save, Trash2, Upload } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SearchableSelect } from '../components/SearchableSelect';
import { useAuth } from '../hooks/useAuth';
import {
  completeScreeningRecord,
  createScreeningRecord,
  deleteMergedScreeningDocument,
  deleteScreeningDocument,
  deleteScreeningRecord,
  getScreeningContext,
  ScreeningCheck,
  ScreeningCaseCheck,
  ScreeningCheckType,
  ScreeningConclusionStatus,
  ScreeningContext,
  ScreeningDocument,
  ScreeningEntityOption,
  ScreeningRecord,
  ScreeningResultStatus,
  updateScreeningRecord,
  updateMergedScreeningCheck,
  uploadMergedScreeningDocuments,
  uploadScreeningDocuments,
  viewMergedScreeningDocument,
  viewScreeningDocument
} from '../services/kyc-workflow.service';
import { hasAnyRole } from '../utils/access-control';
import { countryDialOptions } from '../utils/country-phone';
import { PDF_ONLY_ACCEPT, PDF_ONLY_HINT, STANDARD_DOCUMENT_ACCEPT, STANDARD_DOCUMENT_HINT, validatePdfDocuments, validateStandardDocuments } from '../utils/upload-security';

const countryOptions = countryDialOptions.map((country) => country.name);

const checkLabels: Record<ScreeningCheckType, string> = {
  NCTC: 'NCTC',
  UN: 'UN',
  OFAC: 'OFAC',
  EU: 'EU',
  PPO_LIST: 'PPO List',
  WORLD_CHECK: 'World-Check',
  GOOGLE: 'Google',
  OTHER: 'Other screening document'
};

const resultOptions: Array<{ value: ScreeningResultStatus; label: string }> = [
  { value: 'NOT_CHECKED', label: 'Not checked' },
  { value: 'CLEAR', label: 'Clear' },
  { value: 'POTENTIAL_MATCH', label: 'Potential match' },
  { value: 'CONFIRMED_MATCH', label: 'Confirmed match' }
];

const googleResultOptions: Array<{ value: ScreeningResultStatus; label: string }> = [
  { value: 'NO_NEGATIVE_NEWS', label: 'No negative news' },
  { value: 'NEGATIVE_NEWS_FOUND', label: 'Negative news found' },
  { value: 'PREVIOUSLY_NEGATIVE_NEWS', label: 'Previously negative news' },
  { value: 'PREVIOUSLY_VIOLATIONS', label: 'Previously violations' }
];

const conclusionOptions: Array<{ value: ScreeningConclusionStatus; label: string }> = [
  { value: 'CLEAR', label: 'Clear' },
  { value: 'NOT_CLEAR', label: 'Not clear' },
  { value: 'NO_SANCTION_FOUND', label: 'No sanction found' },
  { value: 'SANCTION_FOUND', label: 'Sanction found' }
];

function entityLabel(entity: ScreeningEntityOption) {
  return `${entity.name} | ${entity.role}${entity.identifier ? ` | ${entity.identifier}` : ''}`;
}

function emptyCheck(checkType: ScreeningCheckType): ScreeningCheck {
  return {
    id: `${checkType}-draft`,
    checkType,
    isSelected: false,
    resultStatus: 'NOT_CHECKED',
    notes: '',
    documents: []
  };
}

function errorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return typeof message === 'string' ? message : fallback;
}

type MergedScreeningDraft = {
  resultStatus: ScreeningResultStatus;
  notes: string;
};

function mergedDraftsFromContext(screeningContext: ScreeningContext) {
  return Object.fromEntries(
    screeningContext.mergedChecks.map((check) => [
      check.checkType,
      { resultStatus: check.resultStatus, notes: check.notes || '' }
    ])
  ) as Record<ScreeningCheckType, MergedScreeningDraft>;
}

function DocumentList({
  documents,
  caseId,
  onDelete,
  busyDocumentId,
  onView = viewScreeningDocument,
  canDelete = true
}: {
  documents: ScreeningDocument[];
  caseId: string;
  onDelete: (documentId: string) => void;
  busyDocumentId: string;
  onView?: (caseId: string, document: ScreeningDocument) => void;
  canDelete?: boolean;
}) {
  if (!documents.length) {
    return <p className="text-xs text-slate-500">No files uploaded yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {documents.map((document) => (
        <div key={document.id} className="flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[220px] truncate">{document.fileName}</span>
          <button
            type="button"
            onClick={() => onView(caseId, document)}
            className="text-slate-500 hover:text-brand-700"
            title="View document"
            aria-label={`View ${document.fileName}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {canDelete ? (
            <button
              type="button"
              onClick={() => onDelete(document.id)}
              disabled={busyDocumentId === document.id}
              className="text-red-500 hover:text-red-700 disabled:opacity-50"
              title="Delete document"
              aria-label={`Delete ${document.fileName}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function KycScreeningPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [context, setContext] = useState<ScreeningContext | null>(null);
  const [selectedEntityLabel, setSelectedEntityLabel] = useState('');
  const [manualEntityName, setManualEntityName] = useState('');
  const [manualIdentifier, setManualIdentifier] = useState('');
  const [manualCountry, setManualCountry] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [busyDocumentId, setBusyDocumentId] = useState('');
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());
  const [mergedDrafts, setMergedDrafts] = useState<Record<ScreeningCheckType, MergedScreeningDraft>>({} as Record<ScreeningCheckType, MergedScreeningDraft>);
  const [dirtyMergedChecks, setDirtyMergedChecks] = useState<Set<ScreeningCheckType>>(new Set());

  useEffect(() => {
    if (!id) return;
    getScreeningContext(id)
      .then((screeningContext) => {
        setContext(screeningContext);
        setMergedDrafts(mergedDraftsFromContext(screeningContext));
        setDirtyMergedChecks(new Set());
        setExpandedRecordIds((current) => {
          if (current.size || !screeningContext.records[0]) return current;
          return new Set([screeningContext.records[0].id]);
        });
      })
      .catch((requestError) => setError(errorMessage(requestError, 'Unable to load screening workspace.')));
  }, [id]);

  const entityOptions = useMemo(() => context?.entities.map(entityLabel) || [], [context]);
  const selectedEntity = useMemo(
    () => context?.entities.find((entity) => entityLabel(entity) === selectedEntityLabel) || null,
    [context, selectedEntityLabel]
  );
  const mergedDocumentsByCheck = useMemo(() => {
    const groups = new Map<ScreeningCheckType, ScreeningDocument[]>();
    context?.mergedDocuments.forEach((document) => {
      if (!document.checkType) return;
      groups.set(document.checkType, [...(groups.get(document.checkType) || []), document]);
    });
    return groups;
  }, [context?.mergedDocuments]);
  const mergedChecksByType = useMemo(() => {
    const groups = new Map<ScreeningCheckType, ScreeningCaseCheck>();
    context?.mergedChecks.forEach((check) => groups.set(check.checkType, check));
    return groups;
  }, [context?.mergedChecks]);
  const hasRequiredMergedEvidence = useMemo(
    () => Boolean(context?.mergedEvidenceChecks.every((checkType) => (mergedDocumentsByCheck.get(checkType) || []).length > 0)),
    [context?.mergedEvidenceChecks, mergedDocumentsByCheck]
  );
  const isManualEntity = selectedEntityLabel === 'Manual screening entry';
  const canEditScreening = hasAnyRole(user, ['AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN']);

  function updateRecordLocally(recordId: string, patch: Partial<ScreeningRecord>) {
    setContext((current) =>
      current
        ? {
            ...current,
            records: current.records.map((record) => (record.id === recordId ? { ...record, ...patch } : record))
          }
        : current
    );
  }

  function updateCheckLocally(recordId: string, checkType: ScreeningCheckType, patch: Partial<ScreeningCheck>) {
    setContext((current) =>
      current
        ? {
            ...current,
            records: current.records.map((record) =>
              record.id === recordId
                ? {
                    ...record,
                    checks: record.checks.map((check) => (check.checkType === checkType ? { ...check, ...patch } : check))
                  }
                : record
            )
          }
        : current
    );
  }

  async function addRecord() {
    if (!id) return;
    setError('');
    setMessage('');
    setBusyKey('add-record');
    try {
      const payload = selectedEntity
        ? { entitySourceId: selectedEntity.sourceId }
        : {
            entityType: 'MANUAL',
            entityName: manualEntityName,
            identifier: manualIdentifier,
            country: manualCountry
          };
      const nextContext = await createScreeningRecord(id, payload);
      setContext(nextContext);
      const newRecord = nextContext.records[0];
      if (newRecord) {
        setExpandedRecordIds((current) => new Set([...current, newRecord.id]));
      }
      setSelectedEntityLabel('');
      setManualEntityName('');
      setManualIdentifier('');
      setManualCountry('');
      setMessage('Screening record added.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to add screening record.'));
    } finally {
      setBusyKey('');
    }
  }

  async function saveRecord(record: ScreeningRecord) {
    if (!id) return;
    setError('');
    setMessage('');
    setBusyKey(`save-${record.id}`);
    try {
      setContext(
        await updateScreeningRecord(id, record.id, {
          entityName: record.entityName,
          identifier: record.identifier,
          country: record.country,
          conclusionStatus: record.conclusionStatus,
          remarks: record.remarks,
          checks: record.checks.map((check) => ({
            checkType: check.checkType,
            isSelected: check.isSelected,
            resultStatus: check.resultStatus,
            notes: check.notes
          }))
        })
      );
      setMessage('Screening draft saved.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to save screening record.'));
    } finally {
      setBusyKey('');
    }
  }

  async function finalizeRecord(record: ScreeningRecord) {
    if (!id) return;
    setError('');
    setMessage('');
    setBusyKey(`finalize-${record.id}`);
    try {
      await updateScreeningRecord(id, record.id, {
        entityName: record.entityName,
        identifier: record.identifier,
        country: record.country,
        conclusionStatus: record.conclusionStatus,
        remarks: record.remarks,
        checks: record.checks.map((check) => ({
          checkType: check.checkType,
          isSelected: check.isSelected,
          resultStatus: check.resultStatus,
          notes: check.notes
        }))
      });
      setContext(await completeScreeningRecord(id, record.id));
      setMessage('Screening record finalized.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to finalize screening record.'));
    } finally {
      setBusyKey('');
    }
  }

  function mergeCurrentDraft(nextContext: ScreeningContext, currentRecord: ScreeningRecord) {
    return {
      ...nextContext,
      records: nextContext.records.map((record) => {
        if (record.id !== currentRecord.id) return record;
        return {
          ...record,
          entityName: currentRecord.entityName,
          identifier: currentRecord.identifier,
          country: currentRecord.country,
          conclusionStatus: currentRecord.conclusionStatus,
          remarks: currentRecord.remarks,
          checks: record.checks.map((check) => {
            const currentCheck = currentRecord.checks.find((item) => item.checkType === check.checkType);
            return currentCheck
              ? {
                  ...check,
                  resultStatus: currentCheck.resultStatus,
                  notes: currentCheck.notes
                }
              : check;
          })
        };
      })
    };
  }

  async function uploadFiles(recordId: string, checkType: ScreeningCheckType, files: File[], documentType?: string) {
    if (!id || !files.length) return;
    const validationError = checkType === 'OTHER' ? validateStandardDocuments(files) : validatePdfDocuments(files);
    if (validationError) {
      setError(validationError);
      return;
    }
    const currentRecord = context?.records.find((record) => record.id === recordId);
    setError('');
    setMessage('');
    setBusyKey(`upload-${recordId}-${checkType}`);
    try {
      const nextContext = await uploadScreeningDocuments(id, recordId, { checkType, documentType, files });
      setContext(currentRecord ? mergeCurrentDraft(nextContext, currentRecord) : nextContext);
      setMessage('Screening document uploaded.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to upload screening document.'));
    } finally {
      setBusyKey('');
    }
  }

  async function uploadMergedFiles(checkType: ScreeningCheckType, files: File[]) {
    if (!id || !files.length) return;
    const validationError = validatePdfDocuments(files);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setMessage('');
    setBusyKey(`upload-merged-${checkType}`);
    try {
      setContext(await uploadMergedScreeningDocuments(id, { checkType, files }));
      setMessage('Merged screening PDF uploaded.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to upload merged screening PDF.'));
    } finally {
      setBusyKey('');
    }
  }

  function updateMergedDraft(checkType: ScreeningCheckType, patch: Partial<MergedScreeningDraft>) {
    setMergedDrafts((drafts) => ({
      ...drafts,
      [checkType]: { ...(drafts[checkType] || { resultStatus: 'NOT_CHECKED' as ScreeningResultStatus, notes: '' }), ...patch }
    }));
    setDirtyMergedChecks((currentChecks) => new Set([...currentChecks, checkType]));
  }

  async function saveMergedResults() {
    if (!id || !dirtyMergedChecks.size) return;
    const missingComment = Array.from(dirtyMergedChecks).find((checkType) => {
      const draft = mergedDrafts[checkType];
      return draft && ['POTENTIAL_MATCH', 'CONFIRMED_MATCH'].includes(draft.resultStatus) && !draft.notes.trim();
    });
    if (missingComment) {
      setError(`Add match comments for ${checkLabels[missingComment]} before saving.`);
      return;
    }

    setError('');
    setMessage('');
    setBusyKey('save-merged-results');
    try {
      let nextContext = context;
      for (const checkType of dirtyMergedChecks) {
        const draft = mergedDrafts[checkType];
        if (!draft) continue;
        nextContext = await updateMergedScreeningCheck(id, checkType, draft);
      }
      if (nextContext) {
        setContext(nextContext);
        setMergedDrafts(mergedDraftsFromContext(nextContext));
      }
      setDirtyMergedChecks(new Set());
      setMessage('Common screening results saved.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to save common screening results.'));
    } finally {
      setBusyKey('');
    }
  }

  function toggleRecord(recordId: string) {
    setExpandedRecordIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function expandAllRecords() {
    setExpandedRecordIds(new Set(context?.records.map((record) => record.id) || []));
  }

  function collapseAllRecords() {
    setExpandedRecordIds(new Set());
  }

  async function removeDocument(documentId: string) {
    if (!id || !window.confirm('Delete this screening document?')) return;
    setError('');
    setMessage('');
    setBusyDocumentId(documentId);
    try {
      setContext(await deleteScreeningDocument(id, documentId));
      setMessage('Screening document deleted.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to delete screening document.'));
    } finally {
      setBusyDocumentId('');
    }
  }

  async function removeMergedDocument(documentId: string) {
    if (!id || !window.confirm('Delete this merged screening PDF?')) return;
    setError('');
    setMessage('');
    setBusyDocumentId(documentId);
    try {
      setContext(await deleteMergedScreeningDocument(id, documentId));
      setMessage('Merged screening PDF deleted.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to delete merged screening PDF.'));
    } finally {
      setBusyDocumentId('');
    }
  }

  async function removeRecord(recordId: string) {
    if (!id || !window.confirm('Delete this screening entity and its uploaded evidence?')) return;
    setError('');
    setMessage('');
    setBusyKey(`delete-${recordId}`);
    try {
      setContext(await deleteScreeningRecord(id, recordId));
      setExpandedRecordIds((current) => {
        const next = new Set(current);
        next.delete(recordId);
        return next;
      });
      setMessage('Screening entity deleted.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to delete screening entity.'));
    } finally {
      setBusyKey('');
    }
  }

  if (!context) {
    return <p className="text-sm text-slate-500">Loading screening workspace...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/kyc/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
          <ArrowLeft className="h-4 w-4" />
          Back to case
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Screening Workspace</h1>
        <p className="mt-1 text-sm text-slate-500">Screen clients, shareholders, UBOs, managers, and manually added names before approval.</p>
      </div>

      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">KYC number</p>
          <p className="mt-2 font-semibold text-slate-950">{context.clientInfo.kycNumber || '-'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client name</p>
          <p className="mt-2 font-semibold text-slate-950">{context.clientInfo.clientName}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client code</p>
          <p className="mt-2 font-semibold text-slate-950">{context.clientInfo.clientCode || '-'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CR number</p>
          <p className="mt-2 font-semibold text-slate-950">{context.clientInfo.crNumber || '-'}</p>
        </div>
      </section>

      {!canEditScreening ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Screening is read-only for this review stage. AML roles can update screening records and evidence.
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Screening PDF Files</h2>
              <p className="mt-1 text-sm text-slate-500">Upload combined evidence for required common screening lists. World-Check and Google require a result and match comment only.</p>
            </div>
            {canEditScreening ? <button type="button" onClick={saveMergedResults} disabled={!dirtyMergedChecks.size || busyKey === 'save-merged-results'} className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Save className="h-4 w-4" />
              {busyKey === 'save-merged-results' ? 'Saving...' : 'Save common results'}
            </button> : null}
          </div>
        </div>
        <div className="grid gap-3 p-5 xl:grid-cols-5">
          {context.mergedResultChecks.map((checkType) => {
            const documents = mergedDocumentsByCheck.get(checkType) || [];
            const mergedCheck = mergedChecksByType.get(checkType);
            const requiresEvidence = context.mergedEvidenceChecks.includes(checkType);
            const draft = mergedDrafts[checkType] || { resultStatus: mergedCheck?.resultStatus || 'NOT_CHECKED', notes: mergedCheck?.notes || '' };
            const requiresMatchComment = ['POTENTIAL_MATCH', 'CONFIRMED_MATCH'].includes(draft.resultStatus);
            return (
              <div key={checkType} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-950">{checkLabels[checkType]}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${requiresEvidence ? (documents.length ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-600') : 'bg-slate-100 text-slate-600'}`}>
                    {requiresEvidence ? (documents.length ? `${documents.length} attached` : 'Required') : 'Result only'}
                  </span>
                </div>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Result
                  <select
                    value={draft.resultStatus}
                    onChange={(event) => updateMergedDraft(checkType, { resultStatus: event.target.value as ScreeningResultStatus })}
                    disabled={!canEditScreening || busyKey === 'save-merged-results'}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-700"
                  >
                    {(checkType === 'GOOGLE' ? googleResultOptions : resultOptions).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {requiresMatchComment ? (
                  <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Match comments
                    <input
                      value={draft.notes}
                      onChange={(event) => updateMergedDraft(checkType, { notes: event.target.value })}
                      disabled={!canEditScreening || busyKey === 'save-merged-results'}
                      placeholder="Comments required for this result"
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700"
                    />
                  </label>
                ) : null}
                {canEditScreening && requiresEvidence ? (
                  <label className="mt-3 inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Upload className={`h-4 w-4 ${busyKey === `upload-merged-${checkType}` ? 'animate-pulse' : ''}`} />
                    Upload evidence
                    <input
                      type="file"
                      accept={STANDARD_DOCUMENT_ACCEPT}
                      multiple
                      className="hidden"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        uploadMergedFiles(checkType, Array.from(event.target.files || []));
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                ) : null}
                  <div className="mt-3">
                  <DocumentList
                    documents={documents}
                    caseId={id}
                    onDelete={removeMergedDocument}
                    busyDocumentId={busyDocumentId}
                    onView={viewMergedScreeningDocument}
                    canDelete={canEditScreening}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {canEditScreening ? (
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Add Entity for Screening</h2>
          <p className="mt-1 text-sm text-slate-500">Select a KYC-linked person/entity or add an extra manual name if needed.</p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end">
          <SearchableSelect
            label="Entity"
            value={selectedEntityLabel}
            options={['Manual screening entry', ...entityOptions]}
            onChange={setSelectedEntityLabel}
            placeholder="Select entity to screen"
          />
          <button
            type="button"
            onClick={addRecord}
            disabled={!hasRequiredMergedEvidence || busyKey === 'add-record' || (!selectedEntity && !manualEntityName.trim())}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Screening
          </button>
        </div>
        {!hasRequiredMergedEvidence ? (
          <p className="px-5 pb-5 text-sm text-amber-700">Upload the required merged PDF evidence before adding individual screening records.</p>
        ) : null}
        {isManualEntity ? (
          <div className="grid gap-4 border-t border-slate-100 p-5 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Additional name
              <input value={manualEntityName} onChange={(event) => setManualEntityName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Identifier
              <input value={manualIdentifier} onChange={(event) => setManualIdentifier(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <SearchableSelect label="Country" value={manualCountry} options={countryOptions} onChange={setManualCountry} placeholder="Select country" />
          </div>
        ) : null}
      </section>
      ) : null}

      {context.records.length ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Screening records</h2>
              <p className="mt-1 text-sm text-slate-500">Open only the entity you are updating to keep the workspace compact.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={collapseAllRecords}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={expandAllRecords}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Expand
              </button>
            </div>
          </div>
          {context.records.map((record) => {
            const checks = context.mandatoryChecks.map((checkType) => record.checks.find((check) => check.checkType === checkType) || emptyCheck(checkType));
            const selectedChecks = checks.filter((check) => check.isSelected);
            const expanded = expandedRecordIds.has(record.id);
            const selectedFilters = checks.filter((check) => check.isSelected);
            const filtersWithEvidence = selectedFilters.filter((check) => check.documents.length).length;
            return (
              <section key={record.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleRecord(record.id)}
                  className="flex w-full flex-col gap-3 bg-slate-50 px-5 py-4 text-left hover:bg-slate-100 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-1 text-slate-500">{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-950">{record.entityName}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{record.entityType.replace('_', ' ')}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {filtersWithEvidence}/{selectedFilters.length} selected filters attached
                      </span>
                      {record.conclusionStatus ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Result set</span> : null}
                      {record.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Completed
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {record.identifier || 'No identifier'} {record.country ? `| ${record.country}` : ''}
                    </p>
                    </div>
                  </div>
                </button>

                {expanded ? (
                  <>
                    <div className="flex flex-wrap justify-end gap-2 border-b border-slate-200 px-5 py-3">
                    {canEditScreening ? (
                      <>
                        <button
                          type="button"
                          onClick={() => removeRecord(record.id)}
                          disabled={busyKey === `delete-${record.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                          title="Delete screening entity"
                          aria-label={`Delete screening entity ${record.entityName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => saveRecord(record)}
                          disabled={busyKey === `save-${record.id}`}
                          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          Save Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => finalizeRecord(record)}
                          disabled={busyKey === `finalize-${record.id}`}
                          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Finalize
                        </button>
                      </>
                    ) : null}
                    </div>

                <div className="space-y-5 p-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-sm font-medium text-slate-700">
                      Screening name
                      <input disabled={!canEditScreening} value={record.entityName} onChange={(event) => updateRecordLocally(record.id, { entityName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Identifier
                      <input disabled={!canEditScreening} value={record.identifier || ''} onChange={(event) => updateRecordLocally(record.id, { identifier: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" />
                    </label>
                    {canEditScreening ? (
                      <SearchableSelect label="Country" value={record.country || ''} options={countryOptions} onChange={(value) => updateRecordLocally(record.id, { country: value })} placeholder="Select country" />
                    ) : (
                      <label className="text-sm font-medium text-slate-700">Country
                        <input disabled value={record.country || ''} className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" />
                      </label>
                    )}
                    <label className="text-sm font-medium text-slate-700">
                      Result <span className="text-red-600">*</span>
                      <select
                        value={record.conclusionStatus || ''}
                        onChange={(event) => updateRecordLocally(record.id, { conclusionStatus: event.target.value as ScreeningConclusionStatus })}
                        disabled={!canEditScreening}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                      >
                        <option value="">Select conclusion</option>
                        {conclusionOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <fieldset className="rounded-lg border border-slate-200 p-4">
                    <legend className="px-1 text-sm font-semibold text-slate-900">Individual screening tools</legend>
                    <p className="mb-3 text-xs text-slate-500">Select only the tools needed for this individual. Selected tools require a result; supporting evidence is optional.</p>
                    <div className="flex flex-wrap gap-3">
                      {checks.map((check) => (
                        <label key={check.checkType} className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${check.isSelected ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-slate-700'}`}>
                          <input
                            type="checkbox"
                            checked={check.isSelected}
                            disabled={!canEditScreening}
                            onChange={(event) => updateCheckLocally(record.id, check.checkType, {
                              isSelected: event.target.checked,
                              resultStatus: event.target.checked ? check.resultStatus : 'NOT_CHECKED',
                              notes: event.target.checked ? check.notes : ''
                            })}
                            className="h-4 w-4 accent-brand-600"
                          />
                          {checkLabels[check.checkType]}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {selectedChecks.length ? (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="grid grid-cols-[1fr_180px_1.2fr_260px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span>Screening tool</span>
                      <span>Result</span>
                      <span>Notes</span>
                      <span>PDF evidence</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedChecks.map((check) => {
                        const isResultOnly = false;
                        const showMatchComment = ['POTENTIAL_MATCH', 'CONFIRMED_MATCH'].includes(check.resultStatus);
                        return (
                        <div key={check.checkType} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_180px_1.2fr_260px] lg:items-start">
                          <p className="font-semibold text-slate-900">{checkLabels[check.checkType]}</p>
                          <select
                            value={check.resultStatus}
                            onChange={(event) => updateCheckLocally(record.id, check.checkType, { resultStatus: event.target.value as ScreeningResultStatus })}
                            disabled={!canEditScreening}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                          >
                            {(check.checkType === 'GOOGLE' ? googleResultOptions : resultOptions).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {showMatchComment ? (
                            <input
                              value={check.notes || ''}
                              onChange={(event) => updateCheckLocally(record.id, check.checkType, { notes: event.target.value })}
                              placeholder="Match comments required"
                              disabled={!canEditScreening}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                            />
                          ) : (
                            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
                              Comments required for potential or confirmed matches.
                            </p>
                          )}
                          <div className="space-y-3">
                            {canEditScreening && !isResultOnly ? (
                              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                <Upload className={`h-4 w-4 ${busyKey === `upload-${record.id}-${check.checkType}` ? 'animate-pulse' : ''}`} />
                                Upload evidence
                                <input
                                  type="file"
                                  accept={STANDARD_DOCUMENT_ACCEPT}
                                  multiple
                                  className="hidden"
                                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                    uploadFiles(record.id, check.checkType, Array.from(event.target.files || []));
                                    event.currentTarget.value = '';
                                  }}
                                />
                              </label>
                            ) : null}
                            <p className="text-xs text-slate-500">
                              {isResultOnly
                                ? 'Result only. No individual file upload is required.'
                                : `Optional supporting evidence. ${STANDARD_DOCUMENT_HINT}`}
                            </p>
                            <DocumentList documents={check.documents} caseId={id} onDelete={removeDocument} busyDocumentId={busyDocumentId} canDelete={canEditScreening} />
                          </div>
                        </div>
                      );})}
                    </div>
                  </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No individual screening tools selected.</p>
                  )}

                  <label className="block text-sm font-medium text-slate-700">
                    Observation / remarks <span className="text-red-600">*</span>
                    <textarea
                      value={record.remarks || ''}
                      onChange={(event) => updateRecordLocally(record.id, { remarks: event.target.value })}
                      disabled={!canEditScreening}
                      rows={4}
                      placeholder="Record screening observations, matches, and compliance remarks before finalizing."
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </label>
                </div>
                  </>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-900">No screening records added yet.</p>
          <p className="mt-1 text-sm text-slate-500">Add the client company, shareholders, UBOs, managers, or any additional names that need screening.</p>
        </section>
      )}
    </div>
  );
}
