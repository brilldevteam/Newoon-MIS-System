import { UserPlus } from 'lucide-react';
import type { PersonChoice } from '../utils/linked-people';

const MANUAL = '__manual__';

type Props = {
  choices: PersonChoice[];
  // What the person is added as, for example "manager".
  role: string;
  // Someone already entered elsewhere in the form: their details are copied.
  onPick: (sourceSlot: string) => void;
  // Someone new: a blank person to type in.
  onAddManually: () => void;
  // Replaces the line under the dropdown.
  note?: string;
  disabled?: boolean;
};

// The one place to add a person to a list: one dropdown with "Enter manually" (a blank person) and everyone already
// entered elsewhere in the form (details copied, so nothing is typed twice).
export function AddExistingPerson({ choices, role, onPick, onAddManually, note, disabled = false }: Props) {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><UserPlus aria-hidden="true" className="h-4 w-4 text-teal-700" />Add a {role}</p>
      <select
        aria-label={`Add a ${role}`}
        disabled={disabled}
        value=""
        onChange={(event) => {
          const value = event.target.value;
          if (value === MANUAL) onAddManually();
          else if (value) onPick(value);
        }}
        className="mt-2 block min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
      >
        <option value="">Select a person...</option>
        <option value={MANUAL}>+ Enter manually (a new person)</option>
        {choices.length ? <optgroup label="Already entered in this form">{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</optgroup> : null}
      </select>
      <p className="mt-1.5 text-xs text-slate-600">{note || 'Pick someone already entered to copy their name, nationality, ID numbers and declarations, or enter a new person manually.'}</p>
    </div>
  );
}
