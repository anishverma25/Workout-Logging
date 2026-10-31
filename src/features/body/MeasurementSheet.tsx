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
      <BottomSheet
        open={!confirmDelete}
        onClose={onClose}
        title={entry ? 'Edit measurements' : 'Add measurements'}
        subtitle="Fill in any you like. Waist and neck give a body-fat estimate."
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
            <PrimaryButton onClick={save}>
              {entry ? 'Save changes' : 'Save measurements'}
            </PrimaryButton>
          </div>
        }
      >
        <form
          className="flex flex-col gap-5 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <TextField
              label="Date"
              type="date"
              value={date}
              max={toDateKey(new Date())}
              onChange={(e) => setDate(e.target.value)}
            />
            <SegmentedControl
              label="Length unit"
              tall
              className="mb-1.5"
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
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {fields.map((f) => (
              <div key={f}>
                <NumberField
                  label={MEASUREMENT_LABELS[f]}
                  unit={unit}
                  value={values[f] ?? null}
                  onValueChange={(v) => setValues((cur) => ({ ...cur, [f]: v }))}
                />
                <p className="type-meta mt-1.5 text-text-2">{HOW[f]}</p>
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
              <p className="type-meta mt-1.5 text-text-2">From a smart scale or a scan</p>
            </div>
          </div>
          <TextArea
            label="Note (optional)"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
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
        title="Delete these measurements?"
        body="They are removed from your history and charts."
        confirmLabel="Delete"
        destructive
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
