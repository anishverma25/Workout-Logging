import { useState } from 'react';
import { ArrowDown, ArrowUp, Link2, Repeat2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Fields';
import {
  AnglePicker,
  PrimaryButton,
  RestPicker,
  RirPicker,
  SavedFlash,
  Stepper as KitStepper,
} from '@/components/kit';
import { usePreferences } from '@/data/hooks';
import { angleKind, DEFAULT_ANGLE } from '@/domain/workout/angle';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import {
  moveExercise,
  removeExercise,
  swapExercise,
  toggleSlotSuperset,
  updateSlotAngle,
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
  const prefs = usePreferences();
  const [targets, setTargets] = useState<RoutineTargets>(() => targetsOf(slot));
  const [notes, setNotes] = useState(slot.notes ?? '');
  const [swapping, setSwapping] = useState(false);

  const timed = exercise?.trackingType === 'duration';
  const distance = exercise?.trackingType === 'distance';
  const unitLabel = timed ? 'seconds' : distance ? 'metres' : 'reps';

  const [savedTick, setSavedTick] = useState(0);
  const save = (next: RoutineTargets) => {
    setTargets(next);
    setSavedTick((t) => t + 1);
    void updateTargets(db, slot.id, { ...next, notes: notes || null });
  };
  const angle = angleKind(exercise);
  const effortTracked = !timed && !distance;

  return (
    <>
      <Sheet
        open={!swapping}
        onClose={() => {
          void updateTargets(db, slot.id, { ...targets, notes: notes || null });
          onClose();
        }}
        title={exercise?.name ?? 'Exercise'}
        description={
          <span className="tabular">
            {targets.targetSets} × {formatRepRange(targets.repMin, targets.repMax)} {unitLabel}
            {targets.targetRir !== null ? ` · RIR ${targets.targetRir}` : ''} ·{' '}
            {formatSeconds(targets.restSeconds)} rest
          </span>
        }
        footer={
          <div className="flex flex-col gap-3">
            {effortTracked ? (
              <p className="type-meta text-text-2">
                RIR is reps in reserve: how many more reps you could have done. RIR 2 means you
                stopped about two reps short of failure.
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <PrimaryButton
                block
                onClick={() => {
                  void updateTargets(db, slot.id, { ...targets, notes: notes || null });
                  onClose();
                }}
              >
                Done
              </PrimaryButton>
            </div>
          </div>
        }
      >
        <section aria-labelledby="slot-sets">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="slot-sets" className="type-label text-text-2">
              Sets and {unitLabel}
            </h3>
            <SavedFlash tick={savedTick} />
          </div>
          <div className="flex flex-col gap-5">
            <KitStepper
              label="Sets"
              value={targets.targetSets}
              min={1}
              max={10}
              step={1}
              size="headline"
              format={(v) => `${v} ${v === 1 ? 'set' : 'sets'}`}
              onChange={(v) => save({ ...targets, targetSets: v })}
            />
            <KitStepper
              label={`Lowest ${unitLabel}`}
              value={targets.repMin}
              min={1}
              max={timed ? 600 : 100}
              step={timed ? 5 : 1}
              size="headline"
              format={(v) => `From ${v}`}
              onChange={(v) => save({ ...targets, repMin: v, repMax: Math.max(v, targets.repMax) })}
            />
            <KitStepper
              label={`Highest ${unitLabel}`}
              value={targets.repMax}
              min={1}
              max={timed ? 600 : 100}
              step={timed ? 5 : 1}
              size="headline"
              format={(v) => `To ${v}`}
              onChange={(v) => save({ ...targets, repMax: v, repMin: Math.min(v, targets.repMin) })}
            />
          </div>
        </section>

        {effortTracked ? (
          <section aria-labelledby="slot-rir" className="mt-6">
            <h3 id="slot-rir" className="type-label mb-3 text-text-2">
              Target RIR
            </h3>
            <RirPicker
              value={targets.targetRir}
              onChange={(v) => save({ ...targets, targetRir: v })}
            />
          </section>
        ) : null}

        <section aria-labelledby="slot-rest" className="mt-6">
          <h3 id="slot-rest" className="type-label mb-3 text-text-2">
            Rest after each set
          </h3>
          <RestPicker
            label="Rest after each set"
            value={targets.restSeconds}
            onChange={(v) => save({ ...targets, restSeconds: v })}
            defaultSeconds={prefs.defaultRestSeconds}
            footnote="Applies to every set of this exercise."
          />
        </section>

        {angle ? (
          <section className="mt-6">
            <AnglePicker
              kind={angle}
              value={slot.angleDeg ?? null}
              startAt={DEFAULT_ANGLE[angle]}
              onChange={(deg) => {
                setSavedTick((t) => t + 1);
                void updateSlotAngle(db, slot.id, deg);
              }}
            />
          </section>
        ) : null}

        <TextArea
          label="Notes (optional)"
          className="mt-6"
          value={notes}
          maxLength={500}
          placeholder="Cues, tempo, machine settings"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => void updateTargets(db, slot.id, { ...targets, notes: notes || null })}
        />

        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          disabled={isLast}
          icon={<Link2 className="size-4" aria-hidden />}
          onClick={async () => {
            await toggleSlotSuperset(db, slot.id);
            toast(
              slot.supersetGroup != null ? 'Superset updated' : 'Superset with the next exercise',
            );
          }}
        >
          {slot.supersetGroup != null ? 'Change superset link' : 'Superset with next'}
        </Button>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
