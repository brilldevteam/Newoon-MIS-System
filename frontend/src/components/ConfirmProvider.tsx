import { AlertTriangle, HelpCircle } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// One in-page dialog for every "are you sure?" and "give a reason" question, instead of the browser's own popups.
// Use it as `const { confirm, prompt } = useConfirm();` and `await` the answer.

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // "danger" (red button) for deleting or removing; the safe button is focused first.
  tone?: 'danger' | 'default';
};

type PromptOptions = ConfirmOptions & {
  label?: string;
  placeholder?: string;
  // The confirm button stays disabled until something is typed.
  required?: boolean;
};

type Dialog =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [text, setText] = useState('');
  const queue = useRef<Dialog[]>([]);

  // The dialog on screen lives in a ref as well, so queueing never depends on a state updater running once.
  const current = useRef<Dialog | null>(null);

  const open = useCallback((next: Dialog) => {
    if (current.current) {
      queue.current.push(next);
      return;
    }
    current.current = next;
    setText('');
    setDialog(next);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => open({ kind: 'confirm', options, resolve })), [open]);
  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => open({ kind: 'prompt', options, resolve })), [open]);
  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  function close(answer: boolean) {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(answer);
    else dialog.resolve(answer ? text.trim() || '' : null);
    const next = queue.current.shift() || null;
    current.current = next;
    setText('');
    setDialog(next);
  }

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog ? <ConfirmDialog dialog={dialog} text={text} onText={setText} onClose={close} /> : null}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ dialog, text, onText, onClose }: { dialog: Dialog; text: string; onText: (value: string) => void; onClose: (answer: boolean) => void }) {
  const { options } = dialog;
  const danger = options.tone === 'danger';
  const isPrompt = dialog.kind === 'prompt';
  const required = isPrompt && Boolean((options as PromptOptions).required);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canConfirm = !required || Boolean(text.trim());

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Questions about deleting start on the safe button; a question that needs typing starts in the box.
    (isPrompt ? inputRef.current : danger ? cancelRef.current : null)?.focus();
    return () => previous?.focus?.();
  }, [danger, isPrompt]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const Icon = danger ? AlertTriangle : HelpCircle;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(false); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}><Icon aria-hidden="true" className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-950">{options.title}</h2>
            {options.message ? <p id="confirm-message" className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-slate-600">{options.message}</p> : null}
            {isPrompt ? (
              <label className="mt-3 block text-sm font-medium text-slate-700">
                {(options as PromptOptions).label || 'Reason'}{required ? <span className="text-red-600"> *</span> : null}
                <textarea
                  ref={inputRef}
                  value={text}
                  rows={3}
                  placeholder={(options as PromptOptions).placeholder}
                  onChange={(event) => onText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && canConfirm) { event.preventDefault(); onClose(true); } }}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </label>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={() => onClose(false)} className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">{options.cancelLabel || 'Cancel'}</button>
          <button type="button" disabled={!canConfirm} onClick={() => onClose(true)} className={`inline-flex min-h-10 items-center rounded-md px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}>{options.confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider.');
  return context;
}
