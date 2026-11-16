import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export function PasswordInput({ id, value, onChange, autoComplete = 'new-password', minLength = 16, disabled = false }: {
  id: string; value: string; onChange: (value: string) => void; autoComplete?: 'new-password' | 'current-password'; minLength?: number; disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="relative mt-2">
    <input id={id} name={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} minLength={minLength} maxLength={autoComplete === 'new-password' ? 72 : undefined} disabled={disabled} required className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 pr-12 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50" />
    <button type="button" disabled={disabled} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-1 top-1 grid h-8 w-9 place-items-center rounded text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-600">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
  </div>;
}
