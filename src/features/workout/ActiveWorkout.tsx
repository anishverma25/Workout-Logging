import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Dumbbell, Pause, Play, Plus, Timer, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Fields';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { useProfile } from '@/data/hooks';
import { useDeviceSettings } from '@/app/deviceSettings';
import { useWakeLock } from './useWakeLock';
import type { WorkoutExerciseView, WorkoutView } from '@/data/repositories/workoutView';
import {
  addExercisesToWorkout,
  cancelWorkout,
  elapsedMs,
  finishCheck,
  finishWorkout,
  pauseWorkout,
  resumeWorkout,
  updateWorkoutDetails,
  updateWorkoutFeel,
  restAfterSet,
  type FinishCheck,
} from '@/data/repositories/workouts';
import type { Preferences, Workout, WorkoutSet } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { restSecondsAfterSet } from '@/domain/workout/rest';
import { ReorderSheet } from './ReorderSheet';
import { readableError } from '@/lib/errors';
import { formatClock, pluralize } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { ExerciseCard } from './ExerciseCard';
import { restActions } from './restActions';
import { RestTimerBar, RestTimerSheet } from './RestTimer';
import { EffortPicker, ReadinessCard } from './Readiness';

interface Props {
  view: WorkoutView;
  prefs: Preferences;
}

export function ActiveWorkout({ view, prefs }: Props) {
  const experience = useProfile().data?.experience ?? null;
  const device = useDeviceSettings();
  useWakeLock(device.keepAwake && view.workout.pausedAt === null);
  const { workout, exercises } = view;
  const navigate = useNavigate();
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const openReorder = useCallback(() => setReordering(true), []);
  const [finishing, setFinishing] = useState<FinishCheck | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [readinessDone, setReadinessDone] = useState(false);
  const paused = workout.pausedAt !== null;

  const allSets = exercises.flatMap((e) => e.sets);
  const exercisesRef = useRef(exercises);
  useEffect(() => {
    exercisesRef.current = exercises;
  });
  const doneSets = allSets.filter((s) => s.completedAt !== null).length;

  // Superset labels: A1, A2 for the first group, B1, B2 for the next.
  const supersets = useMemo(() => {
    const map = new Map<string, { label: string; linkedNext: boolean; linkedPrev: boolean }>();
    let letter = 0;
    exercises.forEach((ex, i) => {
      const g = ex.workoutExercise.supersetGroup;
      if (g == null) return;
      const prev = exercises[i - 1]?.workoutExercise.supersetGroup === g;
      const next = exercises[i + 1]?.workoutExercise.supersetGroup === g;
      if (!prev && !next) return;
      if (!prev) letter++;
      const position = prev
        ? Number(map.get(exercises[i - 1]!.workoutExercise.id)!.label.slice(1)) + 1
        : 1;
      map.set(ex.workoutExercise.id, {
        label: `${String.fromCharCode(64 + letter)}${position}`,
        linkedNext: next,
        linkedPrev: prev,
      });
    });
    return map;
  }, [exercises]);

  const onSetCompleted = useCallback(
    (set: WorkoutSet, ex: WorkoutExerciseView) => {
      if (!prefs.autoStartRest) return;
      // Inside a superset, go straight to the next exercise; rest after the round.
      const flow = restAfterSet(
        ex.workoutExercise.id,
        exercisesRef.current.map((e, i) => ({
          id: e.workoutExercise.id,
          order: i,
          supersetGroup: e.workoutExercise.supersetGroup,
          pending: e.sets.filter((x) => x.completedAt === null && x.id !== set.id).length,
        })),
      );
      if (!flow) return;
      const all = exercisesRef.current;
      const pendingOf = (e: WorkoutExerciseView) =>
        e.sets.filter((x) => x.completedAt === null && x.id !== set.id).length;
      const seconds = restSecondsAfterSet({
        plannedSec: ex.workoutExercise.target?.rest ?? null,
        defaultSec: prefs.defaultRestSeconds,
        warmup: set.setType === 'warmup',
        lastOfExercise: pendingOf(ex) === 0,
        moreToCome: all.some(
          (e) => e.workoutExercise.id !== ex.workoutExercise.id && pendingOf(e) > 0,
        ),
        changeSec: prefs.exerciseChangeRestSeconds,
      });
      if (seconds > 0) void restActions.start(seconds, workout.id);
    },
    [prefs.autoStartRest, prefs.defaultRestSeconds, prefs.exerciseChangeRestSeconds, workout.id],
  );

  async function finish(keepUnconfirmed: boolean, effort: number | null) {
    try {
      if (effort !== null) await updateWorkoutFeel(db, workout.id, { sessionRpe: effort });
      await finishWorkout(db, workout.id, { keepUnconfirmed });
      await restActions.clear();
      navigate(`/workouts/${workout.id}/summary`, { replace: true });
    } catch (err) {
      setFinishing(null);
      toast(readableError(err));
    }
  }

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-20 -mx-4 border-b border-line bg-bg/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl lg:-mx-10 lg:px-10 lg:pt-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="min-w-0 flex-1 text-left"
            aria-label={`${workout.name}. Rename workout`}
          >
            <span className="block truncate font-display text-[1.3rem] font-bold leading-tight">
              {workout.name}
            </span>
            <span className="flex items-center gap-2 text-sm text-muted">
              <Clock workout={workout} />
              <span className="text-faint">·</span>
              <span className="tabular">
                {doneSets} of {allSets.length} sets
              </span>
            </span>
          </button>
          <IconButton
            label="Rest timer"
            icon={<Timer className="size-5" aria-hidden />}
            onClick={() => setTimerOpen(true)}
          />
          <IconButton
            label={paused ? 'Resume workout' : 'Pause workout'}
            icon={
              paused ? (
                <Play className="size-5" aria-hidden />
              ) : (
                <Pause className="size-5" aria-hidden />
              )
            }
            onClick={() => (paused ? resumeWorkout(db, workout.id) : pauseWorkout(db, workout.id))}
          />
          <Button
            size="sm"
            className="h-11 px-4"
            onClick={async () => setFinishing(await finishCheck(db, workout.id))}
          >
            Finish
          </Button>
        </div>
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Sets done"
          aria-valuemin={0}
          aria-valuemax={allSets.length}
          aria-valuenow={doneSets}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${allSets.length ? (doneSets / allSets.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      {!readinessDone && !workout.readiness && doneSets === 0 ? (
        <div className="mt-4">
          <ReadinessCard workoutId={workout.id} onDone={() => setReadinessDone(true)} />
        </div>
      ) : null}

      {paused ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-warn-soft px-4 py-3">
          <p className="text-sm font-medium text-warn">
            Paused. The workout clock is stopped; you can still edit sets.
          </p>
          <Button size="sm" variant="secondary" onClick={() => resumeWorkout(db, workout.id)}>
            Resume
          </Button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2 xl:items-start">
        {exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.workoutExercise.id}
            view={ex}
            index={i}
            count={exercises.length}
            prefs={prefs}
            experience={experience}
            onSetCompleted={onSetCompleted}
            onReorder={openReorder}
            superset={supersets.get(ex.workoutExercise.id) ?? null}
            hasNext={i < exercises.length - 1}
          />
        ))}
      </div>

      {exercises.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<Dumbbell className="size-5" aria-hidden />}
          title="Add your first exercise"
          body="Pick exercises as you go. Each one shows what you did last time, so you know what to beat."
        />
      ) : null}

      <Button
        variant="secondary"
        size="lg"
        block
        className="mt-4"
        icon={<Plus className="size-5" aria-hidden />}
        onClick={() => setPicking(true)}
      >
        Add exercise
      </Button>

      <WorkoutNotes workout={workout} />

      <div className="mt-6 flex justify-center">
        <Button
          variant="ghost"
          icon={<Trash2 className="size-4" aria-hidden />}
          className="text-danger hover:bg-danger-soft hover:text-danger"
          onClick={() => setDiscarding(true)}
        >
          Discard workout
        </Button>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-30 px-3 lg:bottom-6 lg:left-[17rem]">
        <RestTimerBar onOpen={() => setTimerOpen(true)} />
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        title="Add exercises"
        mode="multi"
        presentIds={exercises.map((e) => e.workoutExercise.exerciseId)}
        onPick={async (ids) => {
          await addExercisesToWorkout(db, workout.id, ids);
        }}
      />
      <ReorderSheet open={reordering} exercises={exercises} onClose={() => setReordering(false)} />
      <RestTimerSheet
        open={timerOpen}
        onClose={() => setTimerOpen(false)}
        workoutId={workout.id}
        defaultSeconds={prefs.defaultRestSeconds}
      />
      {finishing ? (
        <FinishSheet
          check={finishing}
          onClose={() => setFinishing(null)}
          onFinish={finish}
          onDiscard={() => {
            setFinishing(null);
            setDiscarding(true);
          }}
        />
      ) : null}
      <ConfirmSheet
        open={discarding}
        title="Discard this workout?"
        body={
          doneSets > 0
            ? `The ${pluralize(doneSets, 'completed set')} will be deleted and nothing is saved to your history.`
            : 'Nothing has been logged yet. It will not appear in your history.'
        }
        confirmLabel="Discard workout"
        danger
        onClose={() => setDiscarding(false)}
        onConfirm={async () => {
          await cancelWorkout(db, workout.id);
          await restActions.clear();
          toast('Workout discarded');
          navigate('/', { replace: true });
        }}
      />
      {renaming ? (
        <RenameWorkoutSheet workout={workout} onClose={() => setRenaming(false)} />
      ) : null}
    </div>
  );
}

/** Ticks once a second on its own, so the rest of the screen does not re-render with it. */
function Clock({ workout }: { workout: Workout }) {
  const now = useNow(1000);
  return (
    <span className={cn('tabular font-medium', workout.pausedAt ? 'text-warn' : 'text-text')}>
      {formatClock(elapsedMs(workout, now) / 1000)}
    </span>
  );
}

function FinishSheet({
  check,
  onClose,
  onFinish,
  onDiscard,
}: {
  check: FinishCheck;
  onClose: () => void;
  onFinish: (keepUnconfirmed: boolean, effort: number | null) => void;
  onDiscard: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [effort, setEffort] = useState<number | null>(null);
  const run = (keep: boolean) => {
    setBusy(true);
    onFinish(keep, effort);
  };
  const nothingDone = check.completedSets === 0;

  if (nothingDone && check.unconfirmedSets === 0) {
    return (
      <Sheet open onClose={onClose} title="Nothing logged yet">
        <p className="text-muted">
          No sets are marked done, so there is nothing to save. Mark a set done with the check
          button, or discard this workout.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={onClose} className="sm:flex-1">
            Keep logging
          </Button>
          <Button variant="danger" onClick={onDiscard} className="sm:flex-1">
            Discard workout
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Finish workout?">
      <p className="text-muted">
        {pluralize(check.completedSets, 'set')} marked done.
        {check.emptySets > 0 ? ` ${pluralize(check.emptySets, 'empty set')} will be removed.` : ''}
      </p>
      <div className="mt-4">
        <EffortPicker value={effort} onChange={setEffort} />
      </div>
      {check.unconfirmedSets > 0 ? (
        <div className="mt-4 rounded-2xl border border-warn/30 bg-warn-soft p-4">
          <p className="font-semibold text-warn">
            {pluralize(check.unconfirmedSets, 'set has', 'sets have')} numbers but{' '}
            {check.unconfirmedSets === 1 ? 'is' : 'are'} not marked done.
          </p>
          <p className="mt-1 text-sm text-muted">
            Did you do {check.unconfirmedSets === 1 ? 'it' : 'them'}?
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button disabled={busy} onClick={() => run(true)} className="sm:flex-1">
              Yes, save {check.unconfirmedSets === 1 ? 'it' : 'them'}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || nothingDone}
              onClick={() => run(false)}
              className="sm:flex-1"
            >
              No, leave {check.unconfirmedSets === 1 ? 'it' : 'them'} out
            </Button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full text-center text-sm font-medium text-muted underline-offset-4 hover:underline"
          >
            Keep logging
          </button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Button size="lg" disabled={busy} onClick={() => run(false)} className="sm:flex-1">
            Finish and save
          </Button>
          <Button size="lg" variant="secondary" onClick={onClose} className="sm:flex-1">
            Keep logging
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function WorkoutNotes({ workout }: { workout: Workout }) {
  const [notes, setNotes] = useState(workout.notes ?? '');
  return (
    <TextArea
      label="Workout notes"
      className="mt-6"
      value={notes}
      maxLength={1000}
      placeholder="Energy, sleep, anything worth remembering"
      onChange={(e) => setNotes(e.target.value)}
      onBlur={() => {
        if ((workout.notes ?? '') !== notes) void updateWorkoutDetails(db, workout.id, { notes });
      }}
    />
  );
}

function RenameWorkoutSheet({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const [name, setName] = useState(workout.name);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      await updateWorkoutDetails(db, workout.id, { name });
      onClose();
    } catch (err) {
      setError(readableError(err));
    }
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title="Rename workout"
      footer={
        <Button block onClick={save}>
          Save
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Workout name"
          value={name}
          maxLength={60}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
      </form>
    </Sheet>
  );
}
