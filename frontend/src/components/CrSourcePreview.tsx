import { Eye, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { viewLegalDocument, type LegalDocument } from '../services/kyc-workflow.service';

type Props = { caseId: string; documents: LegalDocument[] };

// View-only: lists the CR copies received with the enquiry so the details below can be checked against them.
// View opens the file in a new tab, the same as everywhere else in the system.
export function CrSourcePreview({ caseId, documents }: Props) {
  const [openingId, setOpeningId] = useState('');
  const [error, setError] = useState('');

  async function view(document: LegalDocument) {
    setOpeningId(document.id);
    setError('');
    try {
      await viewLegalDocument(caseId, document);
    } catch {
      setError('The CR copy could not be opened.');
    } finally {
      setOpeningId('');
    }
  }

  if (!documents.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600" style={{ gridColumn: '1 / -1' }}>
        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
        No CR copy was attached to the enquiry. Enter the company details from the CR by hand.
      </div>
    );
  }

  return (
    <section aria-label="Source CR copy" className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" style={{ gridColumn: '1 / -1' }}>
      <p className="text-sm font-semibold text-slate-950">Source: Commercial Registration</p>
      <p className="text-xs text-slate-500">From the enquiry attachments. Check the details below against this copy.</p>
      <ul className="mt-2 space-y-2">
        {documents.map((document) => (
          <li key={document.id} className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
            <FileText className="h-4 w-4 shrink-0 text-brand-600" />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800" title={document.fileName}>{document.fileName}</span>
            <button type="button" disabled={openingId === document.id} onClick={() => void view(document)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {openingId === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}View
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-2 text-xs text-amber-800">{error}</p> : null}
    </section>
  );
}

