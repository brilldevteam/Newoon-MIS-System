import { AlertTriangle, CheckCircle2, KeyRound, LoaderCircle, PlugZap, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '../components/ToastProvider';
import { getApiErrorMessage } from '../services/api';
import { AiSettings, getAiSettings, removeAiSettings, saveAiSettings, testAiSettings } from '../services/ai-settings.service';

const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

// Administration > AI document reading (requirements A01-A06). The company adds its own OpenAI API key; uploaded
// legal documents are then read by OpenAI to fill in their details. The key is never shown again after saving.
export function AiDocumentReadingPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    getAiSettings()
      .then((next) => { setSettings(next); setModel(next.model); })
      .catch((requestError) => setError(getApiErrorMessage(requestError, 'Unable to load the AI settings.')));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const next = await saveAiSettings({ apiKey: apiKey.trim() || undefined, model: model.trim() || undefined, enabled: settings?.configured ? settings.enabled : true });
      setSettings(next);
      setApiKey('');
      showToast('AI document reading saved.', 'success');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to save the AI settings.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(enabled: boolean) {
    try {
      setSettings(await saveAiSettings({ enabled }));
      showToast(enabled ? 'AI document reading turned on.' : 'AI document reading turned off. Documents are read on the server only.', 'success');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to change the setting.'), 'error');
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testAiSettings());
    } catch (requestError) {
      setTestResult({ ok: false, message: getApiErrorMessage(requestError, 'The test could not be run.') });
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    if (!window.confirm('Remove the stored OpenAI key? Documents will then be read on the server only.')) return;
    try {
      const next = await removeAiSettings();
      setSettings(next);
      setModel(next.model);
      setTestResult(null);
      showToast('The key was removed.', 'success');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to remove the key.'), 'error');
    }
  }

  if (error) return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!settings) return <p className="text-sm text-slate-500">Loading AI settings...</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950"><Sparkles className="h-6 w-6 text-violet-600" />AI document reading</h1>
        <p className="mt-1 text-sm text-slate-600">
          Connect your company's OpenAI account to read uploaded legal documents (CR extracts, licences, computer and tax cards, certificates), including
          scans, Arabic documents and the people listed on a CR. Staff always check the values before they are saved.
        </p>
      </header>

      <section className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">Documents are sent to OpenAI while this is on</p>
          <p>Each file staff choose to read is sent to OpenAI under your company's account and API terms. Use it only if your data-protection policy allows client KYC documents to be processed by OpenAI. Without a key, or when turned off, documents are read on this server only (PDF text and English OCR).</p>
        </div>
      </section>

      {!settings.serverCanStoreKeys ? (
        <p className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />The server cannot store keys yet: SETTINGS_ENCRYPTION_KEY must be set in the server environment first.
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">OpenAI connection</h2>
            <p className="text-xs text-slate-500">
              {settings.configured
                ? `Key ${settings.keyHint}${settings.keyReadable === false ? ' (cannot be read: enter it again)' : ''} · model ${settings.model} · ${settings.enabled ? 'on' : 'off'}`
                : 'Not set up. Documents are read on the server only.'}
            </p>
          </div>
          {settings.configured ? (
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={settings.enabled} onChange={(event) => toggle(event.target.checked)} />Use AI reading
            </label>
          ) : null}
        </div>

        <form onSubmit={save} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            {settings.configured ? 'Replace the API key' : 'OpenAI API key *'}
            <div className="relative mt-1">
              <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings.configured ? 'Leave empty to keep the current key' : 'sk-...'} className={`${inputClass} pl-9`} />
            </div>
            <span className="mt-1 block text-xs font-normal text-slate-500">Stored encrypted on the server and never shown again. Create it at platform.openai.com under your company's account.</span>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Model
            <input value={model} maxLength={80} onChange={(event) => setModel(event.target.value)} className={`${inputClass} mt-1`} />
            <span className="mt-1 block text-xs font-normal text-slate-500">A model that reads PDF files and images. Use "Test connection" to check it is available to your key.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || (!settings.configured && !apiKey.trim())} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Save
            </button>
            {settings.configured ? (
              <>
                <button type="button" disabled={testing} onClick={test} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}Test connection
                </button>
                <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">
                  <Trash2 className="h-4 w-4" />Remove key
                </button>
              </>
            ) : null}
          </div>
          {testResult ? (
            <p className={`rounded-md px-3 py-2 text-sm ${testResult.ok ? 'border border-emerald-200 bg-emerald-50 text-emerald-800' : 'border border-rose-200 bg-rose-50 text-rose-800'}`}>{testResult.message}</p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
