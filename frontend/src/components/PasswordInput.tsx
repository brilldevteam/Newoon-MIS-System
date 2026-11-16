import { Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { PASSWORD_MIN_LENGTH, passwordRules } from '../utils/password-policy';

export function PasswordInput({ id, value, onChange, autoComplete = 'new-password', minLength = PASSWORD_MIN_LENGTH, disabled = false, showRules = false }: {
  id: string; value: string; onChange: (value: string) => void; autoComplete?: 'new-password' | 'current-password'; minLength?: number; disabled?: boolean;
  // Small live checklist of the password rules under the field (for new passwords).
  showRules?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="mt-2">
    <div className="relative">
      <input id={id} name={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} minLength={minLength} maxLength={autoComplete === 'new-password' ? 72 : undefined} disabled={disabled} required aria-describedby={showRules ? `${id}-rules` : undefined} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 pr-12 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50" />
      <button type="button" disabled={disabled} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-1 top-1 grid h-8 w-9 place-items-center rounded text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-600">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
    </div>
    {showRules ? <PasswordRules id={`${id}-rules`} value={value} /> : null}
  </div>;
}

export function PasswordRules({ id, value }: { id?: string; value: string }) {
  return <ul id={id} className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-4" aria-label="Password requirements">
    {passwordRules.map((rule) => {
      const met = rule.test(value);
      return <li key={rule.key} className={`inline-flex items-center gap-1 ${met ? 'text-emerald-700' : 'text-slate-500'}`}>
        {met ? <Check className="h-3 w-3" aria-hidden="true" /> : <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden="true" />}
        {rule.label}<span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
      </li>;
    })}
  </ul>;
}
