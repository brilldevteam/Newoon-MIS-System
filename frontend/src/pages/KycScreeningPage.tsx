import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Eye, FileText, Plus, Save, Trash2, Upload } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SearchableSelect } from '../components/SearchableSelect';
import {
  completeScreeningRecord,
  createScreeningRecord,
  deleteScreeningDocument,
  getScreeningContext,
  ScreeningCheck,
  ScreeningCheckType,
  ScreeningContext,
  ScreeningDocument,
  ScreeningEntityOption,
  ScreeningRecord,
  ScreeningResultStatus,
  updateScreeningRecord,
  uploadScreeningDocuments,
  viewScreeningDocument
} from '../services/kyc-workflow.service';

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

function entityLabel(entity: ScreeningEntityOption) {
  return `${entity.name} | ${entity.role}${entity.identifier ? ` | ${entity.identifier}` : ''}`;
}

function emptyCheck(checkType: ScreeningCheckType): ScreeningCheck {
  return {
    id: `${checkType}-draft`,
    checkType,
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

function DocumentList({
  documents,
  caseId,
  onDelete,
  busyDocumentId
}: {
  documents: ScreeningDocument[];
  caseId: string;
  onDelete: (documentId: string) => void;
  busyDocumentId: string;
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
            onClick={() => viewScreeningDocument(caseId, document)}
            className="text-slate-500 hover:text-brand-700"
            title="View document"
            aria-label={`View ${document.fileName}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
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
        </div>
      ))}
    </div>
  );
}

export function KycScreeningPage() {
  const { id = '' } = useParams();
  const [context, setContext] = useState<ScreeningContext | null>(null);
  const [selectedEntityLabel, setSelectedEntityLabel] = useState('');
  const [manualEntityName, setManualEntityName] = useState('');
  const [manualIdentifier, setManualIdentifier] = useState('');
  const [manualCountry, setManualCountry] = useState('');
  const [otherDocumentType, setOtherDocumentType] = useState('Other screening document');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [busyDocumentId, setBusyDocumentId] = useState('');
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    getScreeningContext(id)
      .then((screeningContext) => {
        setContext(screeningContext);
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
  const isManualEntity = selectedEntityLabel === 'Manual screening entry';

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
          remarks: record.remarks,
          checks: record.checks.map((check) => ({
            checkType: check.checkType,
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

  async function finalizeRecord(recordId: string) {
    if (!id) return;
    setError('');
    setMessage('');
    setBusyKey(`finalize-${recordId}`);
    try {
      setContext(await completeScreeningRecord(id, recordId));
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

      {message ? <div className="rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-3">
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
            disabled={busyKey === 'add-record' || (!selectedEntity && !manualEntityName.trim())}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Screening
          </button>
        </div>
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
            <label className="text-sm font-medium text-slate-700">
              Country
              <input value={manualCountry} onChange={(event) => setManualCountry(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>
        ) : null}
      </section>

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
            const expanded = expandedRecordIds.has(record.id);
            const completedChecks = checks.filter((check) => check.resultStatus !== 'NOT_CHECKED' && check.documents.length).length;
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
                      <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
                        {completedChecks}/{context.mandatoryChecks.length} evidence
                      </span>
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
                      onClick={() => finalizeRecord(record.id)}
                      disabled={busyKey === `finalize-${record.id}`}
                      className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Finalize
                    </button>
                    </div>

                <div className="space-y-5 p-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="text-sm font-medium text-slate-700">
                      Screening name
                      <input value={record.entityName} onChange={(event) => updateRecordLocally(record.id, { entityName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Identifier
                      <input value={record.identifier || ''} onChange={(event) => updateRecordLocally(record.id, { identifier: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Country
                      <input value={record.country || ''} onChange={(event) => updateRecordLocally(record.id, { country: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="grid grid-cols-[1fr_180px_1.2fr_260px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span>Screening tool</span>
                      <span>Result</span>
                      <span>Notes</span>
                      <span>PDF evidence</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {checks.map((check) => (
                        <div key={check.checkType} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_180px_1.2fr_260px] lg:items-start">
                          <p className="font-semibold text-slate-900">{checkLabels[check.checkType]}</p>
                          <select
                            value={check.resultStatus}
                            onChange={(event) => updateCheckLocally(record.id, check.checkType, { resultStatus: event.target.value as ScreeningResultStatus })}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                          >
                            {resultOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            value={check.notes || ''}
                            onChange={(event) => updateCheckLocally(record.id, check.checkType, { notes: event.target.value })}
                            placeholder="Finding notes"
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                          <div className="space-y-3">
                            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                              <Upload className={`h-4 w-4 ${busyKey === `upload-${record.id}-${check.checkType}` ? 'animate-pulse' : ''}`} />
                              Upload PDF
                              <input
                                type="file"
                                accept="application/pdf,.pdf"
                                multiple
                                className="hidden"
                                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                  uploadFiles(record.id, check.checkType, Array.from(event.target.files || []));
                                  event.currentTarget.value = '';
                                }}
                              />
                            </label>
                            <DocumentList documents={check.documents} caseId={id} onDelete={removeDocument} busyDocumentId={busyDocumentId} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_220px] md:items-end">
                      <label className="text-sm font-medium text-slate-700">
                        Other relevant document type
                        <input value={otherDocumentType} onChange={(event) => setOtherDocumentType(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <Upload className={`h-4 w-4 ${busyKey === `upload-${record.id}-OTHER` ? 'animate-pulse' : ''}`} />
                        Upload documents
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            uploadFiles(record.id, 'OTHER', Array.from(event.target.files || []), otherDocumentType);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <div className="mt-3">
                      <DocumentList documents={record.documents} caseId={id} onDelete={removeDocument} busyDocumentId={busyDocumentId} />
                    </div>
                  </div>

                  <label className="block text-sm font-medium text-slate-700">
                    Observation / remarks <span className="text-red-600">*</span>
                    <textarea
                      value={record.remarks || ''}
                      onChange={(event) => updateRecordLocally(record.id, { remarks: event.target.value })}
                      rows={4}
                      placeholder="Record screening observations, matches, and compliance remarks before finalizing."
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
