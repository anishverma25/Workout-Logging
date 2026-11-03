import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  BottomSheet,
  ConfirmSheet,
  DestructiveButton,
  NumberField,
  PrimaryButton,
  SegmentedControl,
  Switch,
  TextField,
} from '@/components/kit';
import { TextArea } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import {
  addMeasurement,
  deleteMeasurement,
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
import { HOW, RIGHT_FIELDS, RIGHT_OF, measurementGroups, measurementLabel } from './measureSites';

interface Props {
  open: boolean;
  entry?: BodyMeasurement | null;
  unit: LengthUnit;
  sex: Sex | null;
  onClose: () => void;
}

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
  const [bothSides, setBothSides] = useState(() =>
    [...RIGHT_FIELDS].some((f) => entry?.[f] != null),
  );
  const [bodyFat, setBodyFat] = useState<number | null>(entry?.bodyFatPct ?? null);
  const [date, setDate] = useState(
    entry ? toDateKey(new Date(entry.measuredAt)) : toDateKey(new Date()),
  );
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const groups = measurementGroups(sex);

  async function save() {
    setError(null);
    try {
      // Turning both sides off leaves only one value for each part.
      const kept = bothSides
        ? values
        : Object.fromEntries(Object.entries(values).filter(([f]) => !RIGHT_FIELDS.has(f as MeasurementField)));
      const input = { values: kept, unit, bodyFatPct: bodyFat, date, note };
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
        subtitle="Fill in any you like. Waist and neck give a body-fat estimate; the rest show where you are changing."
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
          <div className="flex items-center justify-between gap-3 rounded-card bg-surface-2 px-4 py-3">
            <span id="both-sides" className="min-w-0">
              <span className="type-headline block text-text-1">Left and right</span>
              <span className="type-meta block text-text-2">
                Measure arms, forearms, thighs and calves on both sides
              </span>
            </span>
            <Switch
              checked={bothSides}
              onChange={setBothSides}
              aria-labelledby="both-sides"
              data-both-sides
            />
          </div>
          {groups.map((g) => (
            <fieldset key={g.title} className="flex flex-col gap-3" data-measure-group={g.title}>
              <legend className="type-meta mb-3 font-semibold text-text-2">{g.title}</legend>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {g.fields.flatMap((f) => {
                  const right = bothSides ? RIGHT_OF[f] : undefined;
                  return [f, ...(right ? [right] : [])].map((k) => (
                    <div key={k}>
                      <NumberField
                        label={measurementLabel(k, sex, bothSides)}
                        unit={unit}
                        value={values[k] ?? null}
                        onValueChange={(v) => setValues((cur) => ({ ...cur, [k]: v }))}
                      />
                      <p className="type-meta mt-1.5 text-text-2">{HOW[k]}</p>
                    </div>
                  ));
                })}
              </div>
            </fieldset>
          ))}
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
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
