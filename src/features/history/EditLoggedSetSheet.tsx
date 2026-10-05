import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Fields';
import { NumberField } from '@/components/ui/NumberField';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { deleteSet, missingForCompletion, updateSet } from '@/data/repositories/workouts';
import { SET_TYPE_LABELS } from '@/domain/models/labels';
import { SetType, type Exercise, type WorkoutSet } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { fromDisplayWeight, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { columnsFor, trackingOf } from '../workout/format';

interface Props {
  set: WorkoutSet | null;
  exercise: Exercise | undefined;
  exerciseName: string;
  unit: WeightUnit;
  onClose: () => void;
}

/** Corrects a set in a finished workout. Nothing is saved until "Save". */
export function EditLoggedSetSheet(props: Props) {
  return props.set ? <EditForm key={props.set.id} {...props} set={props.set} /> : null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function EditForm({ set, exercise, exerciseName, unit, onClose }: Props & { set: WorkoutSet }) {
  const toast = useToast();
  const tracking = trackingOf(exercise);
  const cols = columnsFor(tracking, unit);
  const [load, setLoad] = useState<number | null>(
    set.weightKg === null ? null : round2(toDisplayWeight(set.weightKg, unit)),
  );
  const [amount, setAmount] = useState<number | null>(set[cols.amountField]);
  const [rir, setRir] = useState(set.rir);
  const [rpe, setRpe] = useState(set.rpe);
  const [type, setType] = useState(set.setType);
  const [notes, setNotes] = useState(set.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    const next = {
      weightKg: cols.load ? (load === null ? null : fromDisplayWeight(load, unit)) : set.weightKg,
      reps: cols.amountField === 'reps' ? amount : set.reps,
      durationSec: cols.amountField === 'durationSec' ? amount : set.durationSec,
      distanceM: cols.amountField === 'distanceM' ? amount : set.distanceM,
    };
    const missing = missingForCompletion(next, exercise);
    if (missing) {
      setError(missing.replace(' first.', '.'));
      return;
    }
    await updateSet(db, set.id, { ...next, rir, rpe, setType: type, notes });
    toast('Set updated');
    onClose();
  }

  return (
    <>
      <Sheet
        open={!confirmDelete}
        onClose={onClose}
        title="Edit set"
        description={exerciseName}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" aria-hidden />}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {cols.load ? (
            <NumberField
              label={`Load (${cols.load})`}
              value={load}
              onValueChange={setLoad}
              max={2000}
            />
          ) : null}
          <NumberField
            label={cols.amount === 'Reps' ? 'Reps' : cols.amount === 'Sec' ? 'Seconds' : 'Metres'}
            value={amount}
            onValueChange={setAmount}
            allowDecimal={cols.amountField === 'distanceM'}
            max={99_999}
          />
          <NumberField label="RIR" value={rir} onValueChange={setRir} min={0} max={10} />
          <NumberField label="RPE" value={rpe} onValueChange={setRpe} min={1} max={10} />
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium text-muted">Set type</legend>
          <div className="grid grid-cols-2 gap-2">
            {SetType.options.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={cn(
                  'h-11 rounded-xl border text-sm font-semibold transition-colors',
                  type === t
                    ? 'border-accent-text/50 bg-accent-soft text-text'
                    : 'border-line bg-surface-2/60 text-muted',
                )}
              >
                {SET_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </fieldset>
        <TextArea
          label="Notes"
          className="mt-4"
          value={notes}
          maxLength={300}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        title="Delete this set?"
        body="It is removed from this workout. Records and analytics are recalculated."
        confirmLabel="Delete set"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteSet(db, set.id);
          toast('Set deleted');
          onClose();
        }}
      />
    </>
  );
}
