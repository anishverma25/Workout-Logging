import { useState } from 'react';
import { ArrowDown, ArrowUp, Repeat2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Stepper, TextArea } from '@/components/ui/Fields';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import {
  moveExercise,
  removeExercise,
  swapExercise,
  updateTargets,
} from '@/data/repositories/routines';
import type { Exercise, RoutineExercise, RoutineTargets } from '@/domain/models/schemas';
import { formatRepRange, formatSeconds } from '@/lib/format';
import { ExercisePicker } from '../exercises/ExercisePicker';

interface Props {
  slot: RoutineExercise | null;
  exercise: Exercise | undefined;
  isFirst: boolean;
  isLast: boolean;
  onClose: () => void;
}

const targetsOf = (s: RoutineExercise): RoutineTargets => ({
  targetSets: s.targetSets,
  repMin: s.repMin,
  repMax: s.repMax,
  targetRir: s.targetRir,
  restSeconds: s.restSeconds,
  notes: s.notes,
});

/**
 * Edits one exercise's targets in a routine. Every change saves immediately; there is no save
 * button to forget. Only the routine changes: logged workouts keep the targets they had.
 */
export function SlotSheet(props: Props) {
  // Keyed by slot: local state starts from that slot's saved targets each time it opens.
  return props.slot ? <SlotEditor key={props.slot.id} {...props} slot={props.slot} /> : null;
}

function SlotEditor({
  slot,
  exercise,
  isFirst,
  isLast,
  onClose,
}: Props & { slot: RoutineExercise }) {
  const toast = useToast();
  const [targets, setTargets] = useState<RoutineTargets>(() => targetsOf(slot));
  const [notes, setNotes] = useState(slot.notes ?? '');
  const [swapping, setSwapping] = useState(false);

  const timed = exercise?.trackingType === 'duration';
  const distance = exercise?.trackingType === 'distance';
  const unitLabel = timed ? 'seconds' : distance ? 'metres' : 'reps';

  const save = (next: RoutineTargets) => {
    setTargets(next);
    void updateTargets(db, slot.id, { ...next, notes: notes || null });
  };

  return (
    <>
      <Sheet
        open={!swapping}
        onClose={() => {
          void updateTargets(db, slot.id, { ...targets, notes: notes || null });
          onClose();
        }}
        title={exercise?.name ?? 'Exercise'}
        description={`${targets.targetSets} × ${formatRepRange(targets.repMin, targets.repMax)} ${unitLabel}${
          targets.targetRir !== null ? ` · RIR ${targets.targetRir}` : ''
        } · ${formatSeconds(targets.restSeconds)} rest. Changes save as you go.`}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Stepper
              label="Sets"
              value={targets.targetSets}
              min={1}
              max={10}
              onChange={(v) => v !== null && save({ ...targets, targetSets: v })}
            />
          </div>
          <Stepper
            label={`Lowest ${unitLabel}`}
            value={targets.repMin}
            min={1}
            max={timed ? 600 : 100}
            step={timed ? 5 : 1}
            onChange={(v) =>
              v !== null && save({ ...targets, repMin: v, repMax: Math.max(v, targets.repMax) })
            }
          />
          <Stepper
            label={`Highest ${unitLabel}`}
            value={targets.repMax}
            min={1}
            max={timed ? 600 : 100}
            step={timed ? 5 : 1}
            onChange={(v) =>
              v !== null && save({ ...targets, repMax: v, repMin: Math.min(v, targets.repMin) })
            }
          />
          {!timed && !distance ? (
            <Stepper
              label="Target RIR"
              value={targets.targetRir}
              min={0}
              max={5}
              step={0.5}
              allowEmpty
              emptyLabel="None"
              onChange={(v) => save({ ...targets, targetRir: v })}
            />
          ) : null}
          <Stepper
            label="Rest"
            value={targets.restSeconds}
            min={0}
            max={600}
            step={15}
            format={formatSeconds}
            onChange={(v) => v !== null && save({ ...targets, restSeconds: v })}
          />
        </div>
        {!timed && !distance ? (
          <p className="mt-2 text-xs text-faint">
            RIR is reps in reserve: how many more reps you could have done. RIR 2 means you stopped
            about two reps short of failure.
          </p>
        ) : null}

        <TextArea
          label="Notes (optional)"
          className="mt-4"
          value={notes}
          maxLength={500}
          placeholder="Cues, tempo, machine settings"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => void updateTargets(db, slot.id, { ...targets, notes: notes || null })}
        />

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            variant="secondary"
            size="sm"
            icon={<Repeat2 className="size-4" aria-hidden />}
            onClick={() => setSwapping(true)}
          >
            Swap
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isFirst}
            icon={<ArrowUp className="size-4" aria-hidden />}
            onClick={() => moveExercise(db, slot.id, -1)}
          >
            Earlier
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isLast}
            icon={<ArrowDown className="size-4" aria-hidden />}
            onClick={() => moveExercise(db, slot.id, 1)}
          >
            Later
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 className="size-4" aria-hidden />}
            onClick={async () => {
              await removeExercise(db, slot.id);
              toast(`${exercise?.name ?? 'Exercise'} removed`);
              onClose();
            }}
          >
            Remove
          </Button>
        </div>
      </Sheet>
      <ExercisePicker
        open={swapping}
        onClose={() => setSwapping(false)}
        title={`Swap ${exercise?.name ?? 'exercise'}`}
        mode="single"
        presentIds={[slot.exerciseId]}
        onPick={async ([id]) => {
          if (!id) return;
          await swapExercise(db, slot.id, id);
          toast('Exercise swapped. Targets kept.');
        }}
      />
    </>
  );
}
