import { COPY } from '@/domain/analytics/thresholdCopy';
import { useState } from 'react';
import { Plus, Target, Trash2, Trophy } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import {
  BottomSheet,
  Card,
  Chip,
  ConfirmSheet,
  DestructiveButton,
  IconTile,
  NumberField,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from '@/components/kit';
import { Chips } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { addGoal, deleteGoal, GoalError, updateGoal } from '@/data/repositories/goals';
import type { GoalProgress } from '@/domain/analytics/goals';
import type { Exercise, GoalKind, TrainingGoal } from '@/domain/models/schemas';
import { formatShortDate, toDateKey } from '@/lib/dates';
import {
  formatWeightValue,
  fromDisplayWeight,
  toDisplayWeight,
  type WeightUnit,
} from '@/lib/units';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { cn } from '@/lib/cn';
import { goalTitle } from './format';

const KIND_LABEL: Record<GoalKind, string> = {
  exercise_e1rm: 'Estimated 1RM',
  exercise_load: 'Heaviest set',
  body_weight: 'Body weight',
};

export function GoalsSection({
  progress,
  exercises,
  unit,
  currentFor,
}: {
  progress: GoalProgress[];
  exercises: Exercise[];
  unit: WeightUnit;
  /** The current value a new goal would start from. */
  currentFor: (kind: GoalKind, exerciseId: string | null) => number | null;
}) {
  const projections = useFeature('goal_projection');
  const [editing, setEditing] = useState<TrainingGoal | 'new' | null>(null);
  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const open = progress.filter((p) => !p.reached);
  const reached = progress.filter((p) => p.reached);

  return (
    <section aria-labelledby="goals-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="goals-title" className="type-title text-text-1">
          Goals
        </h2>
        {progress.length > 0 ? (
          <Chip toggle={false} leading={<Plus aria-hidden />} onClick={() => setEditing('new')}>
            Add goal
          </Chip>
        ) : null}
      </div>

      {progress.length === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <IconTile icon={<Target />} />
          <p className="type-body max-w-[48ch] text-text-2 [text-wrap:balance]">
            Set a target for a lift or your body weight, with a date if you like. The app tracks it
            from your logged sets and works out when you will get there at your current rate.
          </p>
          <SecondaryButton icon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
            Add a goal
          </SecondaryButton>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...open, ...reached].map((p) => (
            <li key={p.goal.id}>
              <button
                type="button"
                onClick={() => setEditing(p.goal)}
                className="pressable chrome block w-full rounded-panel border border-border bg-surface p-5 text-left"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="type-headline text-text-1">
                    {goalTitle(p.goal, names, unit)}
                  </span>
                  {p.reached ? (
                    <span className="type-meta inline-flex shrink-0 items-center gap-1 font-semibold text-text-1">
                      <Trophy className="size-4 text-text-2" aria-hidden /> Reached
                    </span>
                  ) : p.goal.targetDate ? (
                    <span className="type-meta shrink-0 text-text-2">
                      by {formatShortDate(new Date(`${p.goal.targetDate}T12:00:00`))}
                    </span>
                  ) : null}
                </span>
                <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-track">
                  <span
                    className="block h-full rounded-full bg-lime transition-[width] duration-[var(--dur-move)] ease-[var(--ease-standard)]"
                    style={{ width: `${(p.fraction ?? 0) * 100}%` }}
                  />
                </span>
                <span className="type-meta tabular mt-1.5 flex justify-between gap-3 text-text-2">
                  <span>
                    {p.current !== null
                      ? `Now ${formatWeightValue(p.current, unit)} ${unit}`
                      : 'No recent sets'}
                    {p.start !== null ? `, from ${formatWeightValue(p.start, unit)}` : ''}
                  </span>
                  {p.fraction !== null ? <span>{Math.round(p.fraction * 100)}%</span> : null}
                </span>
                {!p.reached ? (
                  <span className="type-meta mt-1 block text-text-2">
                    {!projections
                      ? 'Projected date: part of Pro.'
                      : p.projected
                        ? `At ${formatWeightValue(Math.abs(p.ratePerWeek ?? 0), unit, 2)} ${unit} a week you get there around ${formatShortDate(p.projected)}.${
                            p.pace === 'behind'
                              ? ' That is after your date.'
                              : p.pace === 'ahead'
                                ? ' Ahead of your date.'
                                : p.pace === 'on_track'
                                  ? ' On track.'
                                  : ''
                          }`
                        : p.ratePerWeek === null
                          ? COPY.goalProjectionEmpty
                          : 'Not moving toward it at the moment.'}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <GoalSheet
          goal={editing === 'new' ? null : editing}
          exercises={exercises}
          unit={unit}
          currentFor={currentFor}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function GoalSheet({
  goal,
  exercises,
  unit,
  currentFor,
  onClose,
}: {
  goal: TrainingGoal | null;
  exercises: Exercise[];
  unit: WeightUnit;
  currentFor: (kind: GoalKind, exerciseId: string | null) => number | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'exercise_e1rm');
  const [exerciseId, setExerciseId] = useState<string | null>(goal?.exerciseId ?? null);
  const [target, setTarget] = useState<number | null>(
    goal ? Math.round(toDisplayWeight(goal.targetValue, unit) * 10) / 10 : null,
  );
  const [date, setDate] = useState(goal?.targetDate ?? '');
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const current = currentFor(kind, kind === 'body_weight' ? null : exerciseId);

  async function save() {
    setError(null);
    try {
      const input = {
        kind,
        exerciseId: kind === 'body_weight' ? null : exerciseId,
        targetValue: target === null ? NaN : fromDisplayWeight(target, unit),
        startValue: goal ? goal.startValue : current,
        targetDate: date || null,
      };
      if (goal) await updateGoal(db, goal.id, input);
      else await addGoal(db, input);
      toast(goal ? 'Goal updated' : 'Goal added');
      onClose();
    } catch (err) {
      setError(err instanceof GoalError ? err.message : 'Could not save. Try again.');
    }
  }

  return (
    <>
      <BottomSheet
        open={!picking && !confirmDelete}
        onClose={onClose}
        title={goal ? 'Edit goal' : 'New goal'}
        footer={
          <div className="flex items-center justify-between gap-2">
            {goal ? (
              <DestructiveButton
                icon={<Trash2 aria-hidden />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </DestructiveButton>
            ) : (
              <span />
            )}
            <PrimaryButton onClick={save}>{goal ? 'Save changes' : 'Add goal'}</PrimaryButton>
          </div>
        }
      >
        <div className="flex flex-col gap-5 pt-1">
          <div>
            <p className="type-meta mb-1.5 text-text-2" aria-hidden>
              Goal type
            </p>
            {/* Chips with radio semantics: one goal type at a time. */}
            <Chips
              label="Goal type"
              options={(Object.keys(KIND_LABEL) as GoalKind[]).map((k) => ({
                value: k,
                label: KIND_LABEL[k],
              }))}
              value={kind}
              onChange={(v) => v && setKind(v)}
            />
          </div>
          {kind !== 'body_weight' ? (
            <div>
              <p className="type-meta mb-1.5 text-text-2">Exercise</p>
              <SecondaryButton
                block
                onClick={() => setPicking(true)}
                className={cn('justify-start', !exerciseId && 'text-text-2')}
              >
                {exerciseId ? names.get(exerciseId) : 'Choose an exercise'}
              </SecondaryButton>
            </div>
          ) : null}
          <NumberField
            label="Target"
            unit={unit}
            value={target}
            onValueChange={setTarget}
            max={unit === 'kg' ? 1000 : 2200}
          />
          {current !== null ? (
            <p className="type-meta -mt-3 text-text-2">
              You are at {formatWeightValue(current, unit)} {unit} now.
            </p>
          ) : null}
          <TextField
            label="By (optional)"
            type="date"
            min={toDateKey(new Date())}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {error ? (
            <p role="alert" className="type-meta text-danger-text">
              {error}
            </p>
          ) : null}
        </div>
      </BottomSheet>
      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        title="Choose an exercise"
        mode="single"
        onPick={(ids) => {
          setExerciseId(ids[0] ?? null);
          setPicking(false);
        }}
      />
      <ConfirmSheet
        open={confirmDelete}
        title="Delete this goal?"
        body="Your logged sets are not affected."
        confirmLabel="Delete"
        destructive
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteGoal(db, goal!.id);
          toast('Goal deleted');
          onClose();
        }}
      />
    </>
  );
}
