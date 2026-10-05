import { memo, useCallback, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Ellipsis,
  Flame,
  NotebookPen,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { ActionList, TextArea } from '@/components/ui/Fields';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { db } from '@/data/db';
import type { WorkoutExerciseView } from '@/data/repositories/workoutView';
import {
  addSet,
  moveWorkoutExercise,
  removeWorkoutExercise,
  updateSet,
  updateWorkoutExerciseNotes,
} from '@/data/repositories/workouts';
import type { Preferences, WorkoutSet } from '@/domain/models/schemas';
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
import { cn } from '@/lib/cn';

interface Props {
  view: WorkoutExerciseView;
  index: number;
  count: number;
  prefs: Preferences;
  onSetCompleted: (set: WorkoutSet, view: WorkoutExerciseView) => void;
}

function ExerciseCardImpl({ view, index, count, prefs, onSetCompleted }: Props) {
  const { workoutExercise: we, exercise, sets, previous } = view;
  const tracking = trackingOf(exercise);
  const cols = columnsFor(tracking, prefs.weightUnit);
  const [menu, setMenu] = useState(false);
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
  const canCopy = previous && emptySets.some((s) => matchingPreviousSet(prevSets, sets, s.id));

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
      className="rounded-[var(--radius-card)] border border-line bg-surface py-4 shadow-[var(--shadow-card)]"
    >
      <header className="flex items-start justify-between gap-2 px-4">
        <div className="min-w-0">
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

      <div className="mx-4 mt-3 flex min-h-8 items-center justify-between gap-2 text-sm">
        {previous ? (
          <span className="text-faint">
            Last time{' '}
            <span className="font-medium text-muted">
              {lastTimeLabel(new Date(previous.workout.startedAt))}
            </span>
          </span>
        ) : (
          <span className="text-faint">First time logging this exercise</span>
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
            'px-1 pb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-faint',
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

      <SetSheet
        set={sets.find((s) => s.id === optionsFor) ?? null}
        label={optionsFor ? (labels.get(optionsFor) ?? '') : ''}
        exerciseName={we.exerciseName}
        onClose={() => setOptionsFor(null)}
      />

      <Sheet open={menu} onClose={() => setMenu(false)} title={we.exerciseName}>
        <ActionList
          items={[
            {
              label: 'Add warm-up set',
              hint: 'Warm-ups do not count toward volume, estimated 1RM or records.',
              icon: <Flame className="size-5" aria-hidden />,
              onSelect: async () => {
                await addSet(db, we.id, 'warmup');
                setMenu(false);
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
