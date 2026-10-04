import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../services/api';
import { AiAssistantMessage, askAiAssistant } from '../services/ai.service';

const welcomeMessage: AiAssistantMessage = {
  role: 'assistant',
  content: 'Ask me about Newoon MIS workflows, navigation, roles, Screening, CRRF, or KYC review steps.'
};

export function AiAssistant({ currentPath }: { currentPath: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiAssistantMessage[]>([welcomeMessage]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, open, busy]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;
    const nextMessages = [...messages, { role: 'user' as const, content: question }];
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const answer = await askAiAssistant(nextMessages, currentPath);
      setMessages((current) => [...current, { role: 'assistant', content: answer.message }]);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, 'Unable to get an answer from the AI Assistant.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <section className="mb-3 flex h-[min(36rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2"><Bot className="h-5 w-5" /><h2 className="text-sm font-semibold">Newoon AI Assistant</h2></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/10" aria-label="Close AI Assistant" title="Close AI Assistant"><X className="h-4 w-4" /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-5 ${message.role === 'user' ? 'ml-auto bg-brand-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
                {message.content}
              </div>
            ))}
            {busy ? <div className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Thinking...</div> : null}
            {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy} placeholder="Ask about this application" className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" />
            <button type="submit" disabled={busy || !draft.trim()} className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send question" title="Send question"><Send className="h-4 w-4" /></button>
          </form>
        </section>
      ) : null}
      <button type="button" onClick={() => setOpen((current) => !current)} className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/20 hover:bg-brand-700" aria-label="Open AI Assistant" title="Open AI Assistant">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
