import { memo, useCallback, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Ellipsis,
  Calculator,
  Flame,
  Link2,
  NotebookPen,
  Replace,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { ActionList, TextArea } from '@/components/ui/Fields';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { db } from '@/data/db';
import type { WorkoutExerciseView } from '@/data/repositories/workoutView';
import {
  addSet,
  addWarmupSets,
  swapWorkoutExercise,
  toggleSupersetWithNext,
  moveWorkoutExercise,
  removeWorkoutExercise,
  updateSet,
  updateWorkoutExerciseNotes,
} from '@/data/repositories/workouts';
import { checkProgression, loadIncrement, progressionStyle } from '@/domain/analytics/progression';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/units';
import { useFeature } from '@/app/entitlement';
import type { Experience, Preferences, WorkoutSet } from '@/domain/models/schemas';
import { matchingPreviousSet, suggestFor } from '@/domain/workout/previous';
import {
  differenceInCalendarDays,
  formatDayMonth,
  formatRelativeDayInline,
  formatShortDate,
  formatWeekday,
} from '@/lib/dates';
import { formatRepRange } from '@/lib/format';
import { columnsFor, setLabels, trackingOf } from './format';
import { SetRow, SET_GRID, SET_GRID_NO_EFFORT } from './SetRow';
import { SetSheet } from './SetSheet';
import { loadPreviousPerformance } from '@/data/repositories/workoutView';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/Toast';
import { readableError } from '@/lib/errors';
import { warmupSets } from '@/domain/workout/plates';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { PlateSheet } from './PlateSheet';

interface Props {
  /** Set when the exercise is part of a superset: its position label and links. */
  superset?: { label: string; linkedNext: boolean; linkedPrev: boolean } | null;
  hasNext: boolean;
  view: WorkoutExerciseView;
  index: number;
  count: number;
  prefs: Preferences;
  /** Sets how load goes up (linear for beginners, double progression otherwise). */
  experience: Experience | null;
  onSetCompleted: (set: WorkoutSet, view: WorkoutExerciseView) => void;
}

function ExerciseCardImpl({
  view,
  index,
  count,
  prefs,
  experience,
  onSetCompleted,
  superset,
  hasNext,
}: Props) {
  const { workoutExercise: we, exercise, sets, previous } = view;
  const tracking = trackingOf(exercise);
  const cols = columnsFor(tracking, prefs.weightUnit);
  const [menu, setMenu] = useState(false);
  const [plates, setPlates] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const toast = useToast();
  const [editingNotes, setEditingNotes] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const labels = useMemo(() => setLabels(sets), [sets]);
  const prevSets = useMemo(() => previous?.sets ?? [], [previous]);
  const doneCount = sets.filter((s) => s.completedAt !== null).length;
  const target = we.target;
  const emptySets = sets.filter(
    (s) =>
      s.completedAt === null &&
      s.weightKg === null &&
      s.reps === null &&
      s.durationSec === null &&
      s.distanceM === null,
  );
  // The same rule as the Progress page, applied to last time's sets with today's target.
  const progressionIncluded = useFeature('progression');
  const readyToProgress =
    progressionIncluded &&
    previous &&
    target &&
    we.exerciseId === previous.workoutExercise.exerciseId
      ? checkProgression(target, previous.sets, tracking, progressionStyle(experience))
      : null;
  // Suggested next load: the heaviest working set last time plus the smallest sensible jump.
  const unit = prefs.weightUnit;
  const nextLoad = (() => {
    if (!readyToProgress || tracking !== 'weight_reps') return null;
    const heaviest = Math.max(...readyToProgress.working.map((s) => s.weightKg ?? 0));
    const step = loadIncrement(exercise, experience, unit);
    const shown = Math.round(toDisplayWeight(heaviest, unit) / step) * step + step;
    return { shown, step, kg: fromDisplayWeight(shown, unit) };
  })();
  const fillable = emptySets.filter((s) => s.setType === 'working');

  async function applyNextLoad() {
    if (!nextLoad || !target) return;
    for (const s of fillable) {
      await updateSet(db, s.id, { weightKg: nextLoad.kg, reps: target.repMin });
    }
  }
  const canCopy = previous && emptySets.some((s) => matchingPreviousSet(prevSets, sets, s.id));
  // The weight warm-ups lead up to: today's first working set, else last time's.
  const firstWorking = sets.find((s) => s.setType === 'working');
  const workingKg =
    firstWorking?.weightKg ??
    (firstWorking ? suggestFor(prevSets, sets, firstWorking.id)?.weightKg : null) ??
    null;
  const barbell = exercise?.equipment === 'barbell';
  const loadTracked = tracking === 'weight_reps';

  async function addWarmups() {
    if (!workingKg) {
      toast('Enter the working weight first.');
      return;
    }
    const shown = toDisplayWeight(workingKg, unit);
    const bar = barbell ? (unit === 'kg' ? 20 : 45) : null;
    const plan = warmupSets(shown, { bar, step: unit === 'kg' ? 2.5 : 5 });
    if (plan.length === 0) {
      toast('This weight is light enough to start without warm-ups.');
      return;
    }
    await addWarmupSets(
      db,
      we.id,
      plan.map((w) => ({ weightKg: fromDisplayWeight(w.weight, unit), reps: w.reps })),
    );
    toast(`${plan.length} warm-up ${plan.length === 1 ? 'set' : 'sets'} added`);
  }

  const onCompleted = useCallback(
    (set: WorkoutSet) => onSetCompleted(set, view),
    [onSetCompleted, view],
  );

  async function copyAll() {
    for (const s of emptySets) {
      const p = matchingPreviousSet(prevSets, sets, s.id);
      if (!p) continue;
      await updateSet(db, s.id, {
        weightKg: tracking === 'bodyweight_reps' ? null : p.weightKg,
        reps: p.reps,
        durationSec: p.durationSec,
        distanceM: p.distanceM,
      });
    }
  }

  return (
    <section
      aria-labelledby={`ex-${we.id}`}
      className={cn(
        'relative rounded-[var(--radius-card)] bg-surface py-4',
        superset && 'ring-2 ring-inset ring-[var(--ring-2)]/40',
      )}
    >
      {superset?.linkedNext ? (
        <span aria-hidden className="absolute -bottom-4 left-8 h-4 w-0.5 bg-[var(--ring-2)]" />
      ) : null}
      <header className="flex items-start justify-between gap-2 px-4">
        <div className="min-w-0">
          {superset ? (
            <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <span aria-hidden className="size-2 rounded-full bg-[var(--ring-2)]" />
              Superset {superset.label}
              {superset.linkedNext ? ', no rest before the next exercise' : ', rest after this one'}
            </p>
          ) : null}
          <h2 id={`ex-${we.id}`} className="font-display text-[1.45rem] font-bold leading-tight">
            {we.exerciseName}
          </h2>
          <p className="tabular mt-0.5 text-sm text-muted">
            {target
              ? `Target ${target.sets} × ${formatRepRange(target.repMin, target.repMax)}${
                  target.rir !== null ? ` · RIR ${target.rir}` : ''
                }`
              : 'No target'}
            <span className="text-faint">
              {' '}
              · {doneCount} of {sets.length} done
            </span>
          </p>
        </div>
        <IconButton
          label={`Options for ${we.exerciseName}`}
          icon={<Ellipsis className="size-5" aria-hidden />}
          onClick={() => setMenu(true)}
          className="-mr-2 -mt-1.5"
        />
      </header>

      {we.notes ? (
        <button
          type="button"
          onClick={() => setEditingNotes(true)}
          className="mx-4 mt-2 block w-[calc(100%-2rem)] rounded-xl bg-surface-2 px-3 py-2 text-left text-sm text-muted"
        >
          {we.notes}
        </button>
      ) : null}

      {readyToProgress ? (
        <div className="mx-4 mt-3 rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
          <p className="flex items-start gap-2">
            <TrendingUp className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
            <span>
              Last time every set reached{' '}
              {progressionStyle(experience) === 'linear'
                ? `${target!.repMin} reps`
                : 'the top of the range'}
              {readyToProgress.effort === 'met' ? ' at the planned effort' : ''}.{' '}
              {nextLoad
                ? `Add ${nextLoad.step} ${unit} today: ${nextLoad.shown} ${unit} for ${target!.repMin} reps.`
                : 'Consider a little more load today.'}
            </span>
          </p>
          {nextLoad && fillable.length > 0 ? (
            <button
              type="button"
              onClick={() => void applyNextLoad()}
              className="ml-6 mt-1.5 inline-flex h-8 items-center rounded-full bg-accent px-3 text-[0.8125rem] font-semibold text-accent-ink"
            >
              Use {nextLoad.shown} {unit}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mx-4 mt-3 flex min-h-8 items-center justify-between gap-2 text-sm">
        {previous ? (
          <span className="text-faint">
            Last time{' '}
            <span className="font-medium text-muted">
              {lastTimeLabel(new Date(previous.workout.startedAt))}
            </span>
          </span>
        ) : previous === null ? (
          <span className="text-faint">First time logging this exercise</span>
        ) : (
          <span aria-hidden />
        )}
        {canCopy ? (
          <button
            type="button"
            onClick={copyAll}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 font-semibold text-accent-text hover:bg-accent-soft"
          >
            <CopyPlus className="size-4" aria-hidden />
            Copy last time
          </button>
        ) : null}
      </div>

      <div className="mt-1 px-2">
        <div
          aria-hidden
          className={cn(
            cols.showEffort ? SET_GRID : SET_GRID_NO_EFFORT,
            'px-1 pb-1 text-[0.7rem] font-medium text-faint',
          )}
        >
          <span className="text-center">Set</span>
          <span>Last</span>
          <span className="text-center">{cols.load ?? ''}</span>
          <span className="text-center">{cols.amount}</span>
          {cols.showEffort ? (
            <span className="text-center">{prefs.effortMetric.toUpperCase()}</span>
          ) : null}
          <span />
        </div>
        <div className="flex flex-col gap-0.5">
          {sets.map((s) => (
            <SetRow
              key={s.id}
              set={s}
              label={labels.get(s.id) ?? ''}
              tracking={tracking}
              prefs={prefs}
              previous={matchingPreviousSet(prevSets, sets, s.id)}
              suggestion={suggestFor(prevSets, sets, s.id)}
              loadSuggestion={
                previous === undefined
                  ? async () => {
                      const workout = await db.workouts.get(we.workoutId);
                      if (!workout) return null;
                      const map = await loadPreviousPerformance(
                        db,
                        [we.exerciseId],
                        workout.startedAt,
                        we.workoutId,
                      );
                      return suggestFor(map.get(we.exerciseId)?.sets ?? [], sets, s.id);
                    }
                  : undefined
              }
              targetRir={target?.rir ?? null}
              onOpenOptions={(set) => setOptionsFor(set.id)}
              onCompleted={onCompleted}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 px-4">
        <Button
          variant="ghost"
          block
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => addSet(db, we.id)}
          className="h-11 bg-surface-2/60 text-text"
        >
          Add set
        </Button>
      </div>

      <PlateSheet
        open={plates}
        onClose={() => setPlates(false)}
        unit={unit}
        initial={
          workingKg !== null ? Math.round(toDisplayWeight(workingKg, unit) * 100) / 100 : null
        }
      />
      <ExercisePicker
        open={swapping}
        onClose={() => setSwapping(false)}
        title={`Swap ${we.exerciseName}`}
        mode="single"
        presentIds={[we.exerciseId]}
        suggestMuscle={exercise?.primaryMuscle}
        onPick={async (ids) => {
          if (!ids[0]) return;
          try {
            await swapWorkoutExercise(db, we.id, ids[0]);
            setSwapping(false);
          } catch (err) {
            toast(readableError(err));
          }
        }}
      />

      <SetSheet
        set={sets.find((s) => s.id === optionsFor) ?? null}
        label={optionsFor ? (labels.get(optionsFor) ?? '') : ''}
        exerciseName={we.exerciseName}
        onClose={() => setOptionsFor(null)}
      />

      <Sheet open={menu} onClose={() => setMenu(false)} title={we.exerciseName}>
        <ActionList
          items={[
            ...(loadTracked
              ? [
                  {
                    label: 'Add warm-up sets',
                    hint: barbell
                      ? 'Empty bar, then about 40%, 60% and 80% of your working weight.'
                      : 'About 40%, 60% and 80% of your working weight.',
                    icon: <Flame className="size-5" aria-hidden />,
                    onSelect: async () => {
                      setMenu(false);
                      await addWarmups();
                    },
                  },
                ]
              : []),
            {
              label: 'Add one warm-up set',
              hint: 'Warm-ups do not count toward volume, estimated 1RM or records.',
              icon: <Flame className="size-5" aria-hidden />,
              onSelect: async () => {
                await addSet(db, we.id, 'warmup');
                setMenu(false);
              },
            },
            ...(barbell
              ? [
                  {
                    label: 'Plate calculator',
                    icon: <Calculator className="size-5" aria-hidden />,
                    onSelect: () => {
                      setMenu(false);
                      setPlates(true);
                    },
                  },
                ]
              : []),
            {
              label: 'Swap exercise',
              hint:
                doneCount > 0
                  ? 'Sets are already done. Add the other exercise instead.'
                  : 'Machine taken? Pick another exercise for the same muscle.',
              icon: <Replace className="size-5" aria-hidden />,
              disabled: doneCount > 0,
              onSelect: () => {
                setMenu(false);
                setSwapping(true);
              },
            },
            {
              label: superset?.linkedNext
                ? 'Unlink from next exercise'
                : 'Superset with next exercise',
              hint: superset?.linkedNext
                ? undefined
                : 'Do the two back to back and rest after the round.',
              icon: <Link2 className="size-5" aria-hidden />,
              disabled: !hasNext,
              onSelect: async () => {
                setMenu(false);
                await toggleSupersetWithNext(db, we.id);
              },
            },
            {
              label: we.notes ? 'Edit notes' : 'Add notes',
              icon: <NotebookPen className="size-5" aria-hidden />,
              onSelect: () => {
                setMenu(false);
                setEditingNotes(true);
              },
            },
            {
              label: 'Move up',
              icon: <ArrowUp className="size-5" aria-hidden />,
              disabled: index === 0,
              onSelect: async () => {
                await moveWorkoutExercise(db, we.id, -1);
                setMenu(false);
              },
            },
            {
              label: 'Move down',
              icon: <ArrowDown className="size-5" aria-hidden />,
              disabled: index === count - 1,
              onSelect: async () => {
                await moveWorkoutExercise(db, we.id, 1);
                setMenu(false);
              },
            },
            {
              label: 'Remove from workout',
              icon: <Trash2 className="size-5" aria-hidden />,
              danger: true,
              onSelect: async () => {
                setMenu(false);
                if (doneCount > 0) setConfirmRemove(true);
                else await removeWorkoutExercise(db, we.id);
              },
            },
          ]}
        />
      </Sheet>
      <ConfirmSheet
        open={confirmRemove}
        title={`Remove ${we.exerciseName}?`}
        body={`The ${doneCount} completed sets for it are removed from this workout. Your routine is not changed.`}
        confirmLabel="Remove"
        danger
        onClose={() => setConfirmRemove(false)}
        onConfirm={async () => {
          await removeWorkoutExercise(db, we.id);
          setConfirmRemove(false);
        }}
      />
      {editingNotes ? (
        <NotesSheet
          title={`Notes for ${we.exerciseName}`}
          initial={we.notes ?? ''}
          onSave={(notes) => updateWorkoutExerciseNotes(db, we.id, notes)}
          onClose={() => setEditingNotes(false)}
        />
      ) : null}
    </section>
  );
}

function lastTimeLabel(date: Date): string {
  const diff = differenceInCalendarDays(new Date(), date);
  if (diff <= 1) return formatRelativeDayInline(date);
  if (diff < 7) return `${formatWeekday(date)}, ${formatDayMonth(date)}`;
  return formatShortDate(date);
}

export function NotesSheet({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  onSave: (notes: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(initial);
  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <Button
          block
          onClick={async () => {
            await onSave(notes);
            onClose();
          }}
        >
          Save notes
        </Button>
      }
    >
      <TextArea
        label="Notes"
        hideLabel
        autoFocus
        value={notes}
        maxLength={500}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Seat height, grip, how it felt"
      />
    </Sheet>
  );
}

export const ExerciseCard = memo(ExerciseCardImpl);
