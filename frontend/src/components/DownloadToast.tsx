import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DownloadProgress, subscribeDownloadProgress } from '../utils/download-progress';

// Bottom-right notice shown while a document is being prepared and downloaded (see utils/download-progress).
export function DownloadToast() {
  const [progress, setProgress] = useState<DownloadProgress>({ busy: false, label: '', done: '' });
  useEffect(() => subscribeDownloadProgress(setProgress), []);
  if (!progress.busy && !progress.done) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg sm:max-w-sm">
      {progress.busy ? <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-brand-600" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />}
      <div className="min-w-0">
        <p className="font-semibold text-slate-950">{progress.busy ? progress.label : progress.done}</p>
        <p className="text-xs text-slate-500">{progress.busy ? 'This can take a few seconds. Please keep this page open.' : 'Check your Downloads folder.'}</p>
      </div>
    </div>
  );
}
