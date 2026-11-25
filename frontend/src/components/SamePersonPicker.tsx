import { Link2 } from 'lucide-react';
import { createContext, useContext } from 'react';
import { linkedRoles, personChoices, PersonSlot } from '../utils/linked-people';

type Props = {
  people: PersonSlot[];
  slot: string;
  onPick: (sourceSlot: string) => void;
  disabled?: boolean;
  label?: string;
};

// "Same person as ...": copies an already entered person's details onto this row instead of typing them again.
// Rows that share a QID / passport number stay linked; the note names the other roles of this person.
export function SamePersonPicker({ people, slot, onPick, disabled = false, label = 'Same person as' }: Props) {
  const choices = personChoices(people, label === 'Select person' ? '' : slot);
  const selected = label === 'Select person' ? choices.find(choice => choice.slots.includes(slot))?.value || '' : '';
  const also = linkedRoles(people.filter(person => !person.slot.startsWith('document:')), slot);
  if (!choices.length && !also.length && label !== 'Select person') return null;
  return (
    <div className="min-w-0" style={{ gridColumn: '1 / -1' }}>
      <div className="min-w-0 space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-3">
        {choices.length || label === 'Select person' ? (
          <label className="block min-w-0 text-sm font-medium text-slate-700">
            <span className="mb-1.5 flex items-center gap-2"><Link2 aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />{label}</span>
            <select
              aria-label={label}
              className="block min-h-10 w-full min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              value={selected}
              disabled={disabled}
              onChange={(event) => { if (event.target.value || label === 'Select person') onPick(event.target.value); }}
            >
              <option value="">{label === 'Select person' ? 'Enter a new person manually' : 'Select a person already entered'}</option>
              {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            </select>
          </label>
        ) : null}
        {also.length ? <p className="break-words text-xs leading-5 text-teal-800">Also linked to: {also.join(', ')}.</p> : null}
      </div>
    </div>
  );
}

// Lets person rows deep in the enquiry editors offer the picker without passing props through every level.
export type PeopleLink = { people: PersonSlot[]; slotOf: (row: object) => string | undefined; pick: (slot: string, sourceSlot: string) => void; pickerLabel?: string };
export const PeopleLinkContext = createContext<PeopleLink | null>(null);

export function LinkedPersonPicker({ row }: { row: object }) {
  const link = useContext(PeopleLinkContext);
  const slot = link?.slotOf(row);
  if (!link || !slot) return null;
  return <SamePersonPicker people={link.people} slot={slot} onPick={(source) => link.pick(slot, source)} label={link.pickerLabel} />;
}
