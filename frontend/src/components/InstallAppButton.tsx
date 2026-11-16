import { Download, Share } from 'lucide-react';
import { useEffect, useState } from 'react';
import { canPromptInstall, isIosSafari, isStandalone, promptInstall, subscribeInstallPrompt } from '../pwa';

// "Install app" for Android/desktop Chrome and Edge; iPhone Safari has no prompt, so it gets a short hint instead.
export function InstallAppButton() {
  const [available, setAvailable] = useState(canPromptInstall);
  const [showIosHint, setShowIosHint] = useState(false);
  useEffect(() => subscribeInstallPrompt(() => setAvailable(canPromptInstall())), []);

  if (isStandalone()) return null;

  if (available) {
    return (
      <button type="button" onClick={() => void promptInstall()} className="flex w-full items-center gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100">
        <Download className="h-4 w-4" />
        Install app
      </button>
    );
  }

  if (isIosSafari()) {
    return (
      <div>
        <button type="button" onClick={() => setShowIosHint((current) => !current)} className="flex w-full items-center gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100">
          <Download className="h-4 w-4" />
          Install app
        </button>
        {showIosHint ? (
          <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-600">
            Tap <Share className="inline h-3.5 w-3.5" aria-label="Share" /> Share, then <strong>Add to Home Screen</strong>.
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}
