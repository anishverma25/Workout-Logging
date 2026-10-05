import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Fields';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { addBodyWeight, deleteBodyWeight, updateBodyWeight } from '@/data/repositories/bodyweight';
import type { BodyWeightEntry } from '@/domain/models/schemas';
import { toDateKey } from '@/lib/dates';
import { readableError } from '@/lib/errors';
import { fromDisplayWeight, toDisplayWeight, type WeightUnit } from '@/lib/units';

interface Props {
  open: boolean;
  /** Edit this entry; add a new one when absent. */
  entry?: BodyWeightEntry | null;
  defaultUnit: WeightUnit;
  /** Prefill for new entries: the latest weight, which is usually close. */
  lastKg?: number | null;
  onClose: () => void;
}

export function BodyWeightSheet(props: Props) {
  return props.open ? <Form {...props} /> : null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function Form({ entry, defaultUnit, lastKg, onClose }: Props) {
  const toast = useToast();
  const startUnit = entry?.enteredUnit ?? defaultUnit;
  const [unit, setUnit] = useState<WeightUnit>(startUnit);
  const [weight, setWeight] = useState<number | null>(
    entry ? round1(toDisplayWeight(entry.weightKg, startUnit)) : null,
  );
  const [date, setDate] = useState(
    entry ? toDateKey(new Date(entry.measuredAt)) : toDateKey(new Date()),
  );
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const today = toDateKey(new Date());

  async function save() {
    setError(null);
    try {
      const input = { weight: weight ?? NaN, unit, date, note };
      if (entry) await updateBodyWeight(db, entry.id, input);
      else await addBodyWeight(db, input);
      toast(entry ? 'Weigh-in updated' : 'Weigh-in saved');
      onClose();
    } catch (err) {
      setError(readableError(err));
    }
  }

  return (
    <>
      <Sheet
        open={!confirmDelete}
        onClose={onClose}
        title={entry ? 'Edit weigh-in' : 'Add weigh-in'}
        description="Weighing at a similar time each day, for example in the morning, makes the trend easier to read."
        footer={
          <div className="flex items-center justify-between gap-2">
            {entry ? (
              <Button
                variant="danger"
                icon={<Trash2 className="size-4" aria-hidden />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={save}>{entry ? 'Save changes' : 'Save weigh-in'}</Button>
          </div>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <NumberField
              label="Weight"
              value={weight}
              onValueChange={setWeight}
              unit={unit}
              max={unit === 'kg' ? 400 : 880}
              autoFocus={!entry}
              placeholder={lastKg ? String(round1(toDisplayWeight(lastKg, unit))) : undefined}
            />
            <SegmentedControl
              label="Unit"
              value={unit}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
              onChange={(u) => {
                if (weight !== null && u !== unit) {
                  const kg = fromDisplayWeight(weight, unit);
                  setWeight(round1(toDisplayWeight(kg, u)));
                }
                setUnit(u);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bw-date" className="text-sm font-medium text-muted">
              Date
            </label>
            <input
              id="bw-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="h-12 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 text-[1rem] outline-none focus:border-accent-text"
            />
          </div>
          <TextArea
            label="Note (optional)"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="After a late dinner, travel day"
          />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        title="Delete this weigh-in?"
        body="It is removed from your body-weight history and averages."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteBodyWeight(db, entry!.id);
          toast('Weigh-in deleted');
          onClose();
        }}
      />
    </>
  );
}
