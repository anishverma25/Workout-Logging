import { COPY } from '@/domain/analytics/thresholdCopy';
import { useState } from 'react';
import { Plus, Target, Trash2, Trophy } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import { Button } from '@/components/ui/Button';
import { Chips, TextField } from '@/components/ui/Fields';
import { NumberField } from '@/components/ui/NumberField';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { addGoal, deleteGoal, GoalError, updateGoal } from '@/data/repositories/goals';
import type { GoalProgress } from '@/domain/analytics/goals';
import type { Exercise, GoalKind, TrainingGoal } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { formatShortDate, toDateKey } from '@/lib/dates';
import {
  formatWeightValue,
  fromDisplayWeight,
  toDisplayWeight,
  type WeightUnit,
} from '@/lib/units';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
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
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <h2
          id="goals-title"
          className="font-display text-[1.3rem] font-semibold leading-tight tracking-tight"
        >
          Goals
        </h2>
        {progress.length > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setEditing('new')}
          >
            Add goal
          </Button>
        ) : null}
      </div>

      {progress.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-surface p-5">
          <span className="flex size-11 items-center justify-center rounded-[0.8rem] bg-[var(--tile-ember)] text-white">
            <Target className="size-5" aria-hidden />
          </span>
          <p className="max-w-[48ch] text-sm text-muted">
            Set a target for a lift or your body weight, with a date if you like. The app tracks it
            from your logged sets and works out when you will get there at your current rate.
          </p>
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
            Add a goal
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {[...open, ...reached].map((p) => (
            <li key={p.goal.id}>
              <button
                type="button"
                onClick={() => setEditing(p.goal)}
                className="block w-full rounded-[var(--radius-card)] bg-surface p-4 text-left transition-colors active:bg-surface-2"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{goalTitle(p.goal, names, unit)}</span>
                  {p.reached ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-accent-text">
                      <Trophy className="size-4" aria-hidden /> Reached
                    </span>
                  ) : p.goal.targetDate ? (
                    <span className="shrink-0 text-sm text-faint">
                      by {formatShortDate(new Date(`${p.goal.targetDate}T12:00:00`))}
                    </span>
                  ) : null}
                </span>
                <span className="mt-2.5 block h-2 overflow-hidden rounded-full bg-[var(--ring-track)]">
                  <span
                    className="block h-full rounded-full bg-lime transition-[width] duration-700"
                    style={{ width: `${(p.fraction ?? 0) * 100}%` }}
                  />
                </span>
                <span className="tabular mt-1.5 flex justify-between gap-3 text-sm text-faint">
                  <span>
                    {p.current !== null
                      ? `Now ${formatWeightValue(p.current, unit)} ${unit}`
                      : 'No recent sets'}
                    {p.start !== null ? `, from ${formatWeightValue(p.start, unit)}` : ''}
                  </span>
                  {p.fraction !== null ? <span>{Math.round(p.fraction * 100)}%</span> : null}
                </span>
                {!p.reached ? (
                  <span
                    className={cn(
                      'mt-1 block text-sm',
                      p.pace === 'behind' ? 'text-warn' : 'text-muted',
                    )}
                  >
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
      <Sheet
        open={!picking && !confirmDelete}
        onClose={onClose}
        title={goal ? 'Edit goal' : 'New goal'}
        footer={
          <div className="flex items-center justify-between gap-2">
            {goal ? (
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
            <Button onClick={save}>{goal ? 'Save changes' : 'Add goal'}</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted">Goal type</p>
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
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted">Exercise</p>
              <Button
                variant="secondary"
                onClick={() => setPicking(true)}
                className="justify-start"
              >
                {exerciseId ? names.get(exerciseId) : 'Choose an exercise'}
              </Button>
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
            <p className="-mt-3 text-sm text-faint">
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
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </Sheet>
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
        danger
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
