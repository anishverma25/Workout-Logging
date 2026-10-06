import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Fields';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import {
  addMeasurement,
  deleteMeasurement,
  MEASUREMENT_LABELS,
  updateMeasurement,
  type LengthUnit,
} from '@/data/repositories/measurements';
import { updatePreferences } from '@/data/repositories/meta';
import {
  MEASUREMENT_FIELDS,
  type BodyMeasurement,
  type MeasurementField,
  type Sex,
} from '@/domain/models/schemas';
import { toDateKey } from '@/lib/dates';
import { readableError } from '@/lib/errors';
import { toDisplayLength } from './format';

interface Props {
  open: boolean;
  entry?: BodyMeasurement | null;
  unit: LengthUnit;
  sex: Sex | null;
  onClose: () => void;
}

/** Where to measure, so readings stay comparable from week to week. */
const HOW: Record<MeasurementField, string> = {
  waistCm: 'At the navel, relaxed, after breathing out',
  neckCm: 'Just below the Adam’s apple',
  hipCm: 'Widest point of the hips',
  chestCm: 'Across the nipples, arms down',
  armCm: 'Flexed, at the peak of the biceps',
  thighCm: 'Halfway between hip and knee',
  calfCm: 'Widest point',
};

export function MeasurementSheet(props: Props) {
  return props.open ? <Form {...props} /> : null;
}

function Form({ entry, unit: startUnit, sex, onClose }: Props) {
  const toast = useToast();
  const [unit, setUnit] = useState<LengthUnit>(startUnit);
  const [values, setValues] = useState<Partial<Record<MeasurementField, number | null>>>(() =>
    Object.fromEntries(
      MEASUREMENT_FIELDS.map((f) => [f, entry?.[f] ? toDisplayLength(entry[f]!, startUnit) : null]),
    ),
  );
  const [bodyFat, setBodyFat] = useState<number | null>(entry?.bodyFatPct ?? null);
  const [date, setDate] = useState(
    entry ? toDateKey(new Date(entry.measuredAt)) : toDateKey(new Date()),
  );
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Hips feed the body-fat formula for women; show it first in that case.
  const fields: MeasurementField[] =
    sex === 'female'
      ? ['waistCm', 'neckCm', 'hipCm', 'chestCm', 'armCm', 'thighCm', 'calfCm']
      : ['waistCm', 'neckCm', 'chestCm', 'armCm', 'thighCm', 'calfCm', 'hipCm'];

  async function save() {
    setError(null);
    try {
      const input = { values, unit, bodyFatPct: bodyFat, date, note };
      if (entry) await updateMeasurement(db, entry.id, input);
      else await addMeasurement(db, input);
      if (unit !== startUnit) await updatePreferences(db, { lengthUnit: unit });
      toast(entry ? 'Measurements updated' : 'Measurements saved');
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
        size="lg"
        title={entry ? 'Edit measurements' : 'Add measurements'}
        description="Fill in any you like. Waist and neck give a body-fat estimate."
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
            <Button onClick={save}>{entry ? 'Save changes' : 'Save measurements'}</Button>
          </div>
        }
      >
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="m-date" className="text-sm font-medium text-muted">
                Date
              </label>
              <input
                id="m-date"
                type="date"
                value={date}
                max={toDateKey(new Date())}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 rounded-[var(--radius-control)] border border-transparent bg-surface-2 px-3.5 text-[1rem] outline-none focus:border-accent-text"
              />
            </div>
            <SegmentedControl
              label="Length unit"
              value={unit}
              options={[
                { value: 'cm', label: 'cm' },
                { value: 'in', label: 'in' },
              ]}
              onChange={(u) => {
                if (u === unit) return;
                setValues((v) =>
                  Object.fromEntries(
                    Object.entries(v).map(([k, x]) => [
                      k,
                      x == null ? x : Math.round((u === 'in' ? x / 2.54 : x * 2.54) * 10) / 10,
                    ]),
                  ),
                );
                setUnit(u);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fields.map((f) => (
              <div key={f}>
                <NumberField
                  label={MEASUREMENT_LABELS[f]}
                  unit={unit}
                  value={values[f] ?? null}
                  onValueChange={(v) => setValues((cur) => ({ ...cur, [f]: v }))}
                />
                <p className="mt-1 text-xs leading-snug text-faint">{HOW[f]}</p>
              </div>
            ))}
            <div>
              <NumberField
                label="Body fat"
                unit="%"
                value={bodyFat}
                max={70}
                onValueChange={setBodyFat}
              />
              <p className="mt-1 text-xs leading-snug text-faint">From a smart scale or a scan</p>
            </div>
          </div>
          <TextArea
            label="Note (optional)"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
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
        title="Delete these measurements?"
        body="They are removed from your history and charts."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteMeasurement(db, entry!.id);
          toast('Measurements deleted');
          onClose();
        }}
      />
    </>
  );
}
