import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  BottomSheet,
  ConfirmSheet,
  DestructiveButton,
  NumberField,
  PrimaryButton,
  SegmentedControl,
  TextField,
} from '@/components/kit';
import { TextArea } from '@/components/ui/Fields';
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
      <BottomSheet
        open={!confirmDelete}
        onClose={onClose}
        title={entry ? 'Edit weigh-in' : 'Add weigh-in'}
        subtitle="Weighing at a similar time each day, for example in the morning, makes the trend easier to read."
        footer={
          <div className="flex items-center justify-between gap-2">
            {entry ? (
              <DestructiveButton
                icon={<Trash2 aria-hidden />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </DestructiveButton>
            ) : (
              <span />
            )}
            <PrimaryButton onClick={save}>{entry ? 'Save changes' : 'Save weigh-in'}</PrimaryButton>
          </div>
        }
      >
        <form
          className="flex flex-col gap-4 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
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
              tall
              className="mb-1.5"
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
          <TextField
            label="Date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
          <TextArea
            label="Note (optional)"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="After a late dinner, travel day"
          />
          {error ? (
            <p role="alert" className="type-meta text-danger-text">
              {error}
            </p>
          ) : null}
        </form>
      </BottomSheet>
      <ConfirmSheet
        open={confirmDelete}
        title="Delete this weigh-in?"
        body="It is removed from your body-weight history and averages."
        confirmLabel="Delete"
        destructive
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
