// App-wide "your file is being prepared / downloaded" notice. Document downloads (KYC PDF/DOCX, Preliminary KYC
// PDF, CRRF export, form revisions) can take several seconds while the server builds the file; without feedback
// the page looked idle. Wrap the slow call in trackDownload and <DownloadToast /> (in AppLayout) shows progress.
export type DownloadProgress = { busy: boolean; label: string; done: string };

let active = 0;
let state: DownloadProgress = { busy: false, label: '', done: '' };
let hideTimer: number | undefined;
let doneTimer: number | undefined;
const listeners = new Set<(next: DownloadProgress) => void>();

function publish(next: DownloadProgress) {
  state = next;
  listeners.forEach((listener) => listener(state));
}

export function subscribeDownloadProgress(listener: (next: DownloadProgress) => void) {
  listeners.add(listener);
  listener(state);
  return () => { listeners.delete(listener); };
}

export async function trackDownload<T>(label: string, run: () => Promise<T>, doneLabel = '') {
  active += 1;
  window.clearTimeout(hideTimer);
  window.clearTimeout(doneTimer);
  publish({ busy: true, label, done: '' });
  let ok = false;
  try {
    const result = await run();
    ok = true;
    return result;
  } finally {
    active = Math.max(0, active - 1);
    if (!active) {
      // A short grace period keeps the notice steady between "preparing" and "downloading" steps.
      hideTimer = window.setTimeout(() => {
        if (active) return;
        publish({ busy: false, label: '', done: ok ? doneLabel : '' });
        if (ok && doneLabel) doneTimer = window.setTimeout(() => publish({ busy: false, label: '', done: '' }), 4000);
      }, 400);
    }
  }
}
