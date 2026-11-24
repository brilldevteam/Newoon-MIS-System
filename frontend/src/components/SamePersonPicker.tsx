import { Link2 } from 'lucide-react';
import { createContext, useContext } from 'react';
import { linkedRoles, personChoices, PersonSlot } from '../utils/linked-people';

type Props = {
  people: PersonSlot[];
  slot: string;
  onPick: (sourceSlot: string) => void;
  disabled?: boolean;
};

// "Same person as ...": copies an already entered person's details onto this row instead of typing them again.
// Rows that share a QID / passport number stay linked; the note names the other roles of this person.
export function SamePersonPicker({ people, slot, onPick, disabled = false }: Props) {
  const choices = personChoices(people, slot);
  const also = linkedRoles(people, slot);
  if (!choices.length && !also.length) return null;
  return (
    <div className="min-w-0" style={{ gridColumn: '1 / -1' }}>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
        <Link2 className="h-4 w-4 shrink-0 text-slate-500" />
        {choices.length ? (
          <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            Same person as
            <select
              aria-label="Same person as"
              className="min-h-9 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
              value=""
              disabled={disabled}
              onChange={(event) => { if (event.target.value) onPick(event.target.value); }}
            >
              <option value="">Select a person already entered</option>
              {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            </select>
          </label>
        ) : null}
        {also.length ? <span className="text-xs text-teal-800">Linked by QID / passport number. Also: {also.join(', ')}. Changes to the person's details are copied to the linked rows.</span> : null}
      </div>
    </div>
  );
}

// Lets person rows deep in the enquiry editors offer the picker without passing props through every level.
export type PeopleLink = { people: PersonSlot[]; slotOf: (row: object) => string | undefined; pick: (slot: string, sourceSlot: string) => void };
export const PeopleLinkContext = createContext<PeopleLink | null>(null);

export function LinkedPersonPicker({ row }: { row: object }) {
  const link = useContext(PeopleLinkContext);
  const slot = link?.slotOf(row);
  if (!link || !slot) return null;
  return <SamePersonPicker people={link.people} slot={slot} onPick={(source) => link.pick(slot, source)} />;
}
