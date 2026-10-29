import { restIntervals } from '@/domain/analytics/rest';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Dumbbell, Pause, Play, Plus, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DestructiveButton,
  IconButton as KitIconButton,
  InlineNotice,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  TextLink,
} from '@/components/kit';
import { KeyboardToolbar } from './KeyboardToolbar';
import { haptic } from '@/lib/haptics';
import { TextArea, TextField } from '@/components/ui/Fields';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { useBestsBefore, useBodyWeights, useProfile } from '@/data/hooks';
import { workoutBurn } from '@/domain/activity/burn';
import { medalsForSet } from '@/domain/analytics/medals';
import { MedalAlert, type MedalNews } from './MedalAlert';
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
  const [readinessHidden, setReadinessHidden] = useState(false);
  const [editingReadiness, setEditingReadiness] = useState(false);
  const paused = workout.pausedAt !== null;
  // Live records: each finished set is compared with the bests from before this workout.
  const bests = useBestsBefore(workout.id);
  const bestsRef = useRef(bests);
  useEffect(() => {
    bestsRef.current = bests;
  });
  const liveRecordsRef = useRef(device.liveRecords);
  useEffect(() => {
    liveRecordsRef.current = device.liveRecords;
  });
  const [medal, setMedal] = useState<MedalNews | null>(null);
  const clearMedal = useCallback(() => setMedal(null), []);

  const allSets = exercises.flatMap((e) => e.sets);
  // Rest actually taken before each finished set, shown on the set and saved with the workout.
  const rests = restIntervals(allSets);
  const exercisesRef = useRef(exercises);
  useEffect(() => {
    exercisesRef.current = exercises;
  });
  const doneSets = allSets.filter((s) => s.completedAt !== null).length;
  const activeId =
    exercises.find((e) => e.sets.some((s) => s.completedAt === null))?.workoutExercise.id ?? null;

  // B2: after an exercise's last set, move to the next one, but only if the person has not
  // touched, scrolled or focused anything in the second since.
  const lastInteraction = useRef(0);
  useEffect(() => {
    const mark = () => (lastInteraction.current = performance.now());
    const opts = { passive: true, capture: true } as const;
    window.addEventListener('touchstart', mark, opts);
    window.addEventListener('wheel', mark, opts);
    window.addEventListener('scroll', mark, opts);
    window.addEventListener('keydown', mark, opts);
    return () => {
      window.removeEventListener('touchstart', mark, opts);
      window.removeEventListener('wheel', mark, opts);
      window.removeEventListener('scroll', mark, opts);
      window.removeEventListener('keydown', mark, opts);
    };
  }, []);
  const scrollToNext = useCallback((finishedId: string) => {
    const started = performance.now();
    window.setTimeout(() => {
      if (lastInteraction.current > started + 50) return;
      const focused = document.activeElement;
      if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) return;
      const list = exercisesRef.current;
      const from = list.findIndex((e) => e.workoutExercise.id === finishedId);
      const next = list.slice(from + 1).find((e) => e.sets.some((s) => s.completedAt === null));
      if (!next) return;
      const el = document.querySelector(`[data-exercise-card="${next.workoutExercise.id}"]`);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, 1000);
  }, []);

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
      if (liveRecordsRef.current && bestsRef.current && set.setType !== 'warmup') {
        const won = medalsForSet(
          set,
          ex.exercise,
          ex.sets.map((x) => (x.id === set.id ? set : x)),
          bestsRef.current.get(ex.workoutExercise.exerciseId),
        );
        if (won.length > 0) {
          haptic('success');
          setMedal({ key: Date.now(), exerciseName: ex.workoutExercise.exerciseName, medals: won });
        }
      }
      if (ex.sets.every((x) => x.id === set.id || x.completedAt !== null)) {
        scrollToNext(ex.workoutExercise.id);
      }
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
    [
      prefs.autoStartRest,
      prefs.defaultRestSeconds,
      prefs.exerciseChangeRestSeconds,
      workout.id,
      scrollToNext,
    ],
  );

  async function finish(keepUnconfirmed: boolean, effort: number | null) {
    try {
      if (effort !== null) await updateWorkoutFeel(db, workout.id, { sessionRpe: effort });
      await finishWorkout(db, workout.id, { keepUnconfirmed });
      haptic('success');
      await restActions.clear();
      navigate(`/workouts/${workout.id}/summary`, { replace: true });
    } catch (err) {
      setFinishing(null);
      toast(readableError(err));
    }
  }

  return (
    <div className="mx-auto max-w-[640px] pb-32">
      <MedalAlert news={medal} unit={prefs.weightUnit} onDone={clearMedal} />
      <header className="chrome sticky top-0 z-20 -mx-4 border-b-[0.5px] border-divider bg-bg px-4 pt-[max(0.5rem,env(safe-area-inset-top))] lg:-mx-10 lg:px-10 lg:pt-5">
        <div className="flex min-h-14 items-center gap-2">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="pressable min-w-0 flex-1 text-left"
            aria-label={`${workout.name}. Rename workout`}
          >
            <span className="type-headline block truncate text-text-1">{workout.name}</span>
            <span className="type-meta tabular flex items-center gap-1.5 text-text-2">
              <Clock workout={workout} />
              <span aria-hidden>·</span>
              <span>
                {doneSets} of {allSets.length} sets
              </span>
              <LiveBurn workout={workout} sets={allSets} doneSets={doneSets} />
            </span>
          </button>
          <KitIconButton label="Rest timer" icon={<Timer />} onClick={() => setTimerOpen(true)} />
          <KitIconButton
            label={paused ? 'Resume workout' : 'Pause workout'}
            icon={paused ? <Play /> : <Pause />}
            onClick={() => (paused ? resumeWorkout(db, workout.id) : pauseWorkout(db, workout.id))}
          />
          <button
            type="button"
            onClick={async () => setFinishing(await finishCheck(db, workout.id))}
            className="pressable chrome type-headline tap-target h-9 shrink-0 rounded-full bg-lime px-4 text-on-lime"
          >
            Finish
          </button>
        </div>
        <ProgressBar
          value={doneSets}
          max={Math.max(1, allSets.length)}
          label="Sets done"
          thickness={4}
          className="mb-2 mt-2"
        />
      </header>

      {doneSets === 0 && !readinessHidden ? (
        <div className="mt-4">
          {workout.readiness && !editingReadiness ? (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-panel border border-border bg-surface px-4 py-2">
              <span className="type-meta flex items-center gap-2 text-text-2">
                <Check className="size-4" aria-hidden />
                Check-in saved
              </span>
              <TextLink small onClick={() => setEditingReadiness(true)}>
                Edit
              </TextLink>
            </div>
          ) : (
            <ReadinessCard
              workoutId={workout.id}
              initial={workout.readiness ?? null}
              onSaved={() => setEditingReadiness(false)}
              onClose={() => {
                setEditingReadiness(false);
                if (!workout.readiness) setReadinessHidden(true);
              }}
            />
          )}
        </div>
      ) : null}

      {paused ? (
        <InlineNotice
          icon={<Pause />}
          className="mt-4"
          action={
            <SecondaryButton compact onClick={() => resumeWorkout(db, workout.id)}>
              Resume
            </SecondaryButton>
          }
        >
          Paused. The workout clock is stopped; you can still edit sets.
        </InlineNotice>
      ) : null}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
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
            active={ex.workoutExercise.id === activeId}
            rests={rests}
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

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+1rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-60">
        <RestTimerBar onOpen={() => setTimerOpen(true)} />
      </div>
      <KeyboardToolbar />

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

/**
 * A rough running estimate of calories burned, once a few sets are done. It updates when the
 * minutes pass or a set is logged, and says it is an estimate.
 */
function LiveBurn({
  workout,
  sets,
  doneSets,
}: {
  workout: Workout;
  sets: WorkoutSet[];
  doneSets: number;
}) {
  const weights = useBodyWeights();
  const now = useNow(30_000);
  if (doneSets < 2 || weights.status !== 'success') return null;
  const burn = workoutBurn(workout, sets, weights.data ?? [], now);
  if (!burn) return null;
  return (
    <>
      <span aria-hidden>·</span>
      <span title="A rough estimate. It can be wrong." data-live-burn>
        ~{burn.kcal} kcal
      </span>
    </>
  );
}

/** Ticks once a second on its own, so the rest of the screen does not re-render with it. */
function Clock({ workout }: { workout: Workout }) {
  const now = useNow(1000);
  return (
    <span className={cn('tabular', workout.pausedAt ? 'text-warning' : 'text-text-2')}>
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
  const total = check.completedSets + check.unconfirmedSets + check.emptySets;
  const unticked = total - check.completedSets;

  if (nothingDone && check.unconfirmedSets === 0) {
    return (
      <Sheet
        open
        onClose={onClose}
        title="Nothing logged yet"
        footer={
          <div className="flex flex-col gap-2">
            <SecondaryButton block onClick={onClose}>
              Keep going
            </SecondaryButton>
            <DestructiveButton block onClick={onDiscard}>
              Discard workout
            </DestructiveButton>
          </div>
        }
      >
        <p className="type-body text-text-2">
          No sets are marked done, so there is nothing to save. Mark a set done with the check
          button, or discard this workout.
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={unticked > 0 ? 'Finish anyway?' : 'Finish workout?'}
      footer={
        check.unconfirmedSets > 0 ? (
          <div className="flex flex-col gap-2">
            <PrimaryButton block loading={busy} onClick={() => run(true)}>
              Yes, save {check.unconfirmedSets === 1 ? 'it' : 'them'}
            </PrimaryButton>
            <SecondaryButton block disabled={busy || nothingDone} onClick={() => run(false)}>
              No, leave {check.unconfirmedSets === 1 ? 'it' : 'them'} out
            </SecondaryButton>
            <TextLink onClick={onClose} className="self-center">
              Keep going
            </TextLink>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <PrimaryButton block loading={busy} onClick={() => run(false)}>
              Finish and save
            </PrimaryButton>
            <SecondaryButton block onClick={onClose}>
              Keep going
            </SecondaryButton>
          </div>
        )
      }
    >
      <p className="type-headline tabular text-text-1">
        {check.completedSets} of {total} sets done.
      </p>
      {check.emptySets > 0 ? (
        <p className="type-meta mt-1 text-text-2">
          {pluralize(check.emptySets, 'empty set')} will be removed.
        </p>
      ) : null}
      {check.unconfirmedSets > 0 ? (
        <InlineNotice tone="warning" className="mt-4">
          {pluralize(check.unconfirmedSets, 'set has', 'sets have')} numbers but{' '}
          {check.unconfirmedSets === 1 ? 'is' : 'are'} not marked done. Did you do{' '}
          {check.unconfirmedSets === 1 ? 'it' : 'them'}?
        </InlineNotice>
      ) : null}
      <div className="mt-5">
        <EffortPicker value={effort} onChange={setEffort} />
      </div>
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
