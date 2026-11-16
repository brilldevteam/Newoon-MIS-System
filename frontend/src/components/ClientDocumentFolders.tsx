import { Archive, ChevronDown, FileText, FolderPlus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { MultiFileUploadControl } from './MultiFileUploadControl';
import { useToast } from './ToastProvider';
import { getApiErrorMessage } from '../services/api';
import {
  ClientDocument,
  ClientDocumentFolders as Folders,
  ClientDocumentSection,
  createDocumentSection,
  deleteClientDocument,
  updateDocumentSection,
  uploadClientDocuments,
  viewClientDocument
} from '../services/compliance-clients.service';

const inputClass = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type Props = {
  clientId: string;
  sections: ClientDocumentSection[];
  canEdit: boolean;
  onChange: (folders: Folders | null) => void;
  // Compliance Documentation lets editors add and archive their own folders; CDD and Monitoring are fixed.
  allowCustomFolders?: boolean;
  collapsible?: boolean;
};

export function ClientDocumentFolders({ clientId, sections, canEdit, onChange, allowCustomFolders = false, collapsible = false }: Props) {
  const { showToast } = useToast();
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<ClientDocument | null>(null);
  const [newFolder, setNewFolder] = useState<{ title: string; description: string } | null>(null);
  const [savingFolder, setSavingFolder] = useState(false);

  async function addFolder(event: FormEvent) {
    event.preventDefault();
    if (!newFolder?.title.trim()) return;
    setSavingFolder(true);
    try {
      await createDocumentSection(clientId, { title: newFolder.title.trim(), description: newFolder.description.trim() || undefined });
      showToast(`Folder "${newFolder.title.trim()}" added for all clients.`, 'success');
      setNewFolder(null);
      onChange(null);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to add the folder.'), 'error');
    } finally {
      setSavingFolder(false);
    }
  }

  async function archiveFolder(section: ClientDocumentSection) {
    if (!window.confirm(`Archive the "${section.title}" folder for all clients? Existing files stay visible; no new uploads are allowed.`)) return;
    try {
      await updateDocumentSection(clientId, section.id, { isActive: false });
      showToast(`Folder "${section.title}" archived.`, 'success');
      onChange(null);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to archive the folder.'), 'error');
    }
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const open = !collapsible || Boolean(openIds[section.id]);
        return (
          <section key={section.id} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={!collapsible}
                onClick={() => setOpenIds((current) => ({ ...current, [section.id]: !open }))}
                aria-expanded={open}
                className="flex min-w-0 items-start gap-2 text-left disabled:cursor-default"
              >
                {collapsible ? <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} /> : null}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">
                    {section.title}
                    <span className="ml-2 rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-500">{section.documents.length}</span>
                    {!section.isActive ? <span className="ml-2 rounded-full bg-amber-50 px-1.5 text-xs font-medium text-amber-700">Archived</span> : null}
                  </span>
                  {section.description ? <span className="block text-xs text-slate-500">{section.description}</span> : null}
                </span>
              </button>
              {canEdit && allowCustomFolders && !section.isSystem && section.isActive ? (
                <button type="button" onClick={() => archiveFolder(section)} className="inline-flex items-center gap-1 self-start text-xs font-medium text-slate-500 hover:text-slate-700 sm:self-auto">
                  <Archive className="h-3.5 w-3.5" />
                  Archive folder
                </button>
              ) : null}
            </div>
            {open ? (
              <div className="space-y-4 p-4">
                {section.documents.length ? (
                  <ul className="divide-y divide-slate-100">
                    {section.documents.map((document) => (
                      <li key={document.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium text-slate-900">{document.title}</p>
                            <p className="break-all text-xs text-slate-500">
                              {[document.title !== document.fileName ? document.fileName : null, formatSize(document.size), formatDate(document.createdAt), document.uploadedBy ? `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}` : null]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            {document.notes ? <p className="mt-1 whitespace-pre-line break-words text-xs text-slate-600">{document.notes}</p> : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => viewClientDocument(clientId, document).catch((requestError) => showToast(getApiErrorMessage(requestError, 'Unable to open this document.'), 'error'))}
                            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            View
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => setDeleting(document)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                              aria-label={`Delete ${document.title}`}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">No documents in this folder yet.</p>
                )}
                {canEdit && section.isActive ? <UploadForm clientId={clientId} section={section} onUploaded={onChange} /> : null}
              </div>
            ) : null}
          </section>
        );
      })}

      {canEdit && allowCustomFolders ? (
        newFolder ? (
          <form onSubmit={addFolder} className="rounded-lg border border-dashed border-brand-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">New folder</p>
            <p className="text-xs text-slate-500">Folders are shared by every compliance client in your company.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input aria-label="Folder name" placeholder="Folder name" maxLength={120} value={newFolder.title} onChange={(event) => setNewFolder({ ...newFolder, title: event.target.value })} className={inputClass} autoFocus />
              <input aria-label="Folder description" placeholder="Description (optional)" maxLength={300} value={newFolder.description} onChange={(event) => setNewFolder({ ...newFolder, description: event.target.value })} className={inputClass} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setNewFolder(null)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={savingFolder || !newFolder.title.trim()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {savingFolder ? 'Adding...' : 'Add folder'}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setNewFolder({ title: '', description: '' })}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-4 text-sm font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
          >
            <FolderPlus className="h-4 w-4" />
            Add folder
          </button>
        )
      ) : null}

      {deleting ? <DeleteDialog clientId={clientId} document={deleting} onClose={() => setDeleting(null)} onDeleted={onChange} /> : null}
    </div>
  );
}

function UploadForm({ clientId, section, onUploaded }: { clientId: string; section: ClientDocumentSection; onUploaded: (folders: Folders) => void }) {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!files.length) return;
    setUploading(true);
    try {
      const folders = await uploadClientDocuments(clientId, { sectionId: section.id, title, notes, files });
      showToast(`${files.length === 1 ? 'Document' : `${files.length} documents`} uploaded to ${section.title}.`, 'success');
      setFiles([]);
      setTitle('');
      setNotes('');
      setResetKey((key) => key + 1);
      onUploaded(folders);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to upload the document.'), 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-md bg-slate-50 p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <input aria-label={`Document name for ${section.title}`} placeholder="Document name (defaults to the file name)" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
        <input aria-label={`Notes for ${section.title}`} placeholder="Notes (optional)" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <MultiFileUploadControl
            key={resetKey}
            names={files.map((file) => file.name)}
            disabled={uploading}
            buttonLabel="Choose files"
            onSelect={(selected) => setFiles(selected)}
            onRemoveName={(index) => setFiles((current) => current.filter((_, position) => position !== index))}
          />
        </div>
        <button type="submit" disabled={uploading || !files.length} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </form>
  );
}

function DeleteDialog({ clientId, document, onClose, onDeleted }: { clientId: string; document: ClientDocument; onClose: () => void; onDeleted: (folders: Folders) => void }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const folders = await deleteClientDocument(clientId, document.id, reason);
      showToast(`${document.title} removed.`, 'success');
      onDeleted(folders);
      onClose();
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to remove the document.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true" aria-labelledby="delete-document-title">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 id="delete-document-title" className="text-lg font-semibold text-slate-950">Remove document</h2>
        <p className="mt-1 break-words text-sm text-slate-500">
          {document.title} will be removed from this folder. The file is kept as an archived record and the removal is recorded in the audit log.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="delete-document-reason">Reason (optional)</label>
        <textarea id="delete-document-reason" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className={`${inputClass} mt-1`} placeholder="For example: uploaded to the wrong client" autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{saving ? 'Removing...' : 'Remove'}</button>
        </div>
      </form>
    </div>
  );
}
