import { ActionMenu } from '@/components/kit/menu';
import { formatRest, type RestInterval } from '@/domain/analytics/rest';
import { Fragment, memo, useCallback, useMemo, useState, useRef } from 'react';
import {
  GripVertical,
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Ellipsis,
  Calculator,
  Check,
  ChevronDown,
  Flame,
  Link2,
  NotebookPen,
  Replace,
  Minus,
  Plus,
  Trash2,
  TrendingUp,
  Timer,
  ArrowLeftRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Fields';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { db } from '@/data/db';
import type { WorkoutExerciseView } from '@/data/repositories/workoutView';
import {
  addSet,
  removeLastOpenSet,
  restoreSet,
  addWarmupSets,
  swapWorkoutExercise,
  toggleSupersetWithNext,
  moveWorkoutExercise,
  removeWorkoutExercise,
  updateSet,
  updateWorkoutExerciseAngle,
  setWorkoutExerciseBySide,
} from '@/data/repositories/workouts';
import { canLogBySide, logsBySide } from '@/data/library/sides';
import {
  AnglePicker,
  IconButton as KitIconButton,
  PrimaryButton,
  SecondaryButton,
  TextLink,
} from '@/components/kit';
import { formatWeightValue, type WeightUnit } from '@/lib/units';
import type { TrackingType } from '@/domain/models/schemas';
import { useLongPress } from '@/components/ui/useLongPress';
import { angleKind, DEFAULT_ANGLE, formatAngle, type AngleKind } from '@/domain/workout/angle';
import { checkProgression, loadIncrement, progressionStyle } from '@/domain/analytics/progression';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/units';
import { useFeature } from '@/app/entitlement';
import type { Experience, Preferences, WorkoutSet } from '@/domain/models/schemas';
import { matchingPreviousSet, suggestFor } from '@/domain/workout/previous';
import { differenceInCalendarDays, formatRelativeDayInline } from '@/lib/dates';
import { formatCalendarDate, formatRepRange } from '@/lib/format';
import { columnsFor, formatSetValues, setLabels, trackingOf } from './format';
import { SetRow, SET_GRID, SET_GRID_NO_EFFORT } from './SetRow';
import { SetSheet } from './SetSheet';
import { loadPreviousPerformance } from '@/data/repositories/workoutView';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/Toast';
import { readableError } from '@/lib/errors';
import { warmupSets } from '@/domain/workout/plates';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { PlateSheet } from './PlateSheet';
import { ExerciseNote, type ExerciseNoteHandle } from './ExerciseNote';
import { sharesFor, sharesSummary } from '@/data/library/shares';
import { MuscleShares } from '@/features/exercises/MuscleShares';

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
  /** Opens the reorder list (press and hold the exercise name). */
  onReorder?: () => void;
  /** The first exercise with sets still to do: drawn with a stronger border. */
  active?: boolean;
  /** Rest taken before each finished set of the workout, by set id. */
  rests?: Map<string, RestInterval>;
}

function ExerciseCardImpl({
  view,
  index,
  count,
  prefs,
  experience,
  onSetCompleted,
  onReorder,
  superset,
  hasNext,
  active = false,
  rests,
}: Props) {
  const { workoutExercise: we, exercise, sets, previous } = view;
  const tracking = trackingOf(exercise);
  const cols = columnsFor(tracking, prefs.weightUnit);
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [editingAngle, setEditingAngle] = useState(false);
  const [showingShares, setShowingShares] = useState(false);
  const shares = sharesFor(we.exerciseId);
  const holdToReorder = useLongPress(() => onReorder?.());
  const [plates, setPlates] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const toast = useToast();
  const noteField = useRef<ExerciseNoteHandle>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const labels = useMemo(() => setLabels(sets), [sets]);
  const prevSets = useMemo(() => previous?.sets ?? [], [previous]);
  const doneCount = sets.filter((s) => s.completedAt !== null).length;
  // B2: once every set is ticked the card folds to one row; a tap opens it again.
  const allDone = sets.length > 0 && doneCount === sets.length;
  const [expanded, setExpanded] = useState(false);
  const collapsed = allDone && !expanded;
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
  const angle = angleKind(exercise);
  // Dumbbell and single-side moves: the weight typed is one dumbbell (or one side).
  const perHand = exercise?.loadMode === 'per_hand' && cols.load !== null && tracking !== 'cardio';
  const loadTracked = tracking === 'weight_reps';
  // One arm or one leg at a time: reps for the left and right side apart.
  const sideable = canLogBySide(exercise);
  const bySide = logsBySide(we.bySide, exercise);

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
      data-exercise-card={we.id}
      className={cn(
        // min-w-0: a grid item must not grow to fit the one-line muscle summary.
        'relative min-w-0 scroll-mt-32 rounded-panel border bg-surface',
        collapsed ? 'py-0' : 'py-4',
        active && !collapsed ? 'border-border-strong' : 'border-border',
      )}
    >
      {superset?.linkedNext ? (
        <span aria-hidden className="absolute -bottom-4 left-8 h-4 w-0.5 bg-border-strong" />
      ) : null}
      {collapsed ? (
        <CollapsedRow
          headingId={`ex-${we.id}`}
          name={we.exerciseName}
          done={doneCount}
          total={sets.length}
          summary={bestSetSummary(sets, tracking, unit)}
          onExpand={() => setExpanded(true)}
        />
      ) : (
        <>
          <header className="flex items-start justify-between gap-2 px-4">
            <div className="min-w-0">
              {superset ? (
                <p className="type-caption mb-0.5 flex items-center gap-1.5 font-semibold text-text-2">
                  <Link2 className="size-3.5" aria-hidden />
                  Superset {superset.label}
                  {superset.linkedNext
                    ? ', no rest before the next exercise'
                    : ', rest after this one'}
                </p>
              ) : null}
              <h2
                id={`ex-${we.id}`}
                {...holdToReorder}
                className="type-title select-none text-text-1 [-webkit-touch-callout:none]"
              >
                {we.exerciseName}
              </h2>
              <p className="type-meta tabular mt-0.5 text-text-2">
                {target
                  ? `Target ${target.sets} × ${formatRepRange(target.repMin, target.repMax)}${
                      target.rir !== null ? ` · RIR ${target.rir}` : ''
                    }`
                  : 'No target'}
              </p>
              {shares ? (
                <button
                  type="button"
                  onClick={() => setShowingShares(true)}
                  className="type-meta tabular mt-0.5 block max-w-full truncate text-left text-text-2 hover:text-text-1"
                  aria-label={`Muscles worked: ${sharesSummary(shares, 3)}. Show the breakdown`}
                >
                  {sharesSummary(shares)}
                </button>
              ) : null}
              {angle ? (
                <button
                  type="button"
                  onClick={() => setEditingAngle(true)}
                  className={cn(
                    'pressable chrome type-meta mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 font-semibold',
                    we.angleDeg != null ? 'text-text-1' : 'text-text-2',
                  )}
                >
                  {we.angleDeg != null ? `Bench ${formatAngle(we.angleDeg)}` : 'Set bench angle'}
                </button>
              ) : null}
              {bySide ? (
                <p className="type-caption mt-1 text-text-2" data-by-side>
                  Reps for each side: left, then right. Volume counts both sides.
                </p>
              ) : perHand ? (
                <p className="type-caption mt-1 text-text-2">
                  Enter the weight of one dumbbell: 25 in each hand is 25, not 50. Volume counts
                  both hands.
                </p>
              ) : null}
            </div>
            <KitIconButton
              label={`Options for ${we.exerciseName}`}
              icon={<Ellipsis />}
              ref={menuButton}
              aria-expanded={menu}
              aria-haspopup="menu"
              onClick={() => setMenu((m) => !m)}
              className="-mt-1"
            />
          </header>

          <ExerciseNote
            ref={noteField}
            workoutExerciseId={we.id}
            exerciseName={we.exerciseName}
            notes={we.notes}
            lastNote={previous?.workoutExercise.notes ?? null}
          />

          {readyToProgress ? (
            <div className="type-meta mx-4 mt-3 rounded-field bg-lime-dim px-3 py-2.5 text-text-1">
              <p className="flex items-start gap-2">
                <TrendingUp className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
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
                  className="pressable chrome type-meta tabular ml-6 mt-2 inline-flex h-9 items-center rounded-full bg-text-1 px-4 font-semibold text-bg"
                >
                  Use {nextLoad.shown} {unit}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="type-meta mx-4 mt-2 flex min-h-11 items-center justify-between gap-2 text-text-2">
            {previous ? (
              <span className="tabular">
                Last: {lastTimeLabel(new Date(previous.workout.startedAt))}
              </span>
            ) : previous === null ? (
              <span>First time logging this exercise</span>
            ) : (
              <span aria-hidden />
            )}
            {canCopy ? (
              <TextLink small icon={<CopyPlus />} onClick={() => void copyAll()}>
                Copy last time
              </TextLink>
            ) : null}
          </div>

          <div className="mt-1 px-2">
            <div
              aria-hidden
              className={cn(
                cols.showEffort ? SET_GRID : SET_GRID_NO_EFFORT,
                'type-caption px-1.5 pb-1 text-text-2',
              )}
            >
              <span className="text-center">Set</span>
              <span>Last</span>
              <span className="text-center">
                {perHand ? `${cols.load} each` : (cols.load ?? '')}
              </span>
              {bySide ? (
                <span className="grid grid-cols-2 gap-1 text-center">
                  <span>L</span>
                  <span>R</span>
                </span>
              ) : (
                <span className="text-center">{cols.amount}</span>
              )}
              {cols.showEffort ? (
                <span className="text-center">{prefs.effortMetric.toUpperCase()}</span>
              ) : null}
              <span />
            </div>
            <div className="flex flex-col gap-0.5">
              {sets.map((s) => (
                <Fragment key={s.id}>
                  {rests?.get(s.id) ? <RestTaken rest={rests.get(s.id)!} /> : null}
                  <SetRow
                    key={s.id}
                    set={s}
                    label={labels.get(s.id) ?? ''}
                    tracking={tracking}
                    perHand={perHand}
                    bySide={bySide}
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
                </Fragment>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2">
              <SecondaryButton compact icon={<Plus />} onClick={() => void addSet(db, we.id)}>
                Add set
              </SecondaryButton>
              {/* Fewer sets than planned today: drops the last set not yet done. */}
              {doneCount < sets.length ? (
                <SecondaryButton
                  compact
                  icon={<Minus />}
                  onClick={async () => {
                    const removed = await removeLastOpenSet(db, we.id);
                    if (removed) {
                      toast('Set removed', {
                        label: 'Undo',
                        onSelect: () => void restoreSet(db, removed),
                      });
                    }
                  }}
                >
                  Remove set
                </SecondaryButton>
              ) : null}
            </div>
            {allDone && expanded ? (
              <TextLink small onClick={() => setExpanded(false)}>
                Hide sets
              </TextLink>
            ) : null}
          </div>
        </>
      )}

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

      {editingAngle && angle ? (
        <AngleSheet
          kind={angle}
          value={we.angleDeg ?? null}
          onChange={(deg) => void updateWorkoutExerciseAngle(db, we.id, deg)}
          onClose={() => setEditingAngle(false)}
        />
      ) : null}
      {shares ? (
        <Sheet
          open={showingShares}
          onClose={() => setShowingShares(false)}
          title="What it works"
          description={we.exerciseName}
        >
          {showingShares ? <MuscleShares shares={shares} /> : null}
        </Sheet>
      ) : null}
      <ActionMenu
        open={menu}
        onClose={() => setMenu(false)}
        anchor={menuButton}
        label={`Options for ${we.exerciseName}`}
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
          ...(sideable
            ? [
                {
                  label: bySide ? 'Log both sides together' : 'Log left and right',
                  icon: <ArrowLeftRight className="size-5" aria-hidden />,
                  onSelect: async () => {
                    setMenu(false);
                    await setWorkoutExerciseBySide(db, we.id, !bySide);
                  },
                },
              ]
            : []),
          {
            label: we.notes ? 'Edit note' : 'Add a note',
            icon: <NotebookPen className="size-5" aria-hidden />,
            onSelect: () => {
              setMenu(false);
              // After the menu has closed, so the keyboard opens on the note.
              requestAnimationFrame(() => noteField.current?.focus());
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
          ...(onReorder && count > 1
            ? [
                {
                  label: 'Reorder exercises',
                  hint: 'Or press and hold an exercise name.',
                  icon: <GripVertical className="size-5" aria-hidden />,
                  onSelect: () => {
                    setMenu(false);
                    onReorder();
                  },
                },
              ]
            : []),
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
    </section>
  );
}

/** The best completed working set, for the folded card: "70 kg × 8". */
function bestSetSummary(sets: WorkoutSet[], tracking: TrackingType, unit: WeightUnit): string {
  const done = sets.filter((s) => s.completedAt !== null && s.setType !== 'warmup');
  if (done.length === 0) return '';
  const best = [...done].sort(
    (a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0),
  )[0]!;
  if (tracking === 'weight_reps' && best.weightKg !== null)
    return `${formatWeightValue(best.weightKg, unit, 2)} ${unit} × ${best.reps ?? '?'}`;
  return formatSetValues(best, tracking, unit);
}

function CollapsedRow({
  headingId,
  name,
  done,
  total,
  summary,
  onExpand,
}: {
  headingId: string;
  name: string;
  done: number;
  total: number;
  summary: string;
  onExpand: () => void;
}) {
  return (
    <>
      <h2 id={headingId} className="sr-only">
        {name}
      </h2>
      <button
        type="button"
        onClick={onExpand}
        aria-expanded={false}
        aria-label={`${name}, all ${total} sets done. Show sets`}
        className="pressable chrome flex min-h-16 w-full items-center gap-3 rounded-panel px-4 text-left"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-headline block truncate text-text-1">{name}</span>
          <span className="type-meta tabular block truncate text-text-2">
            {done} of {total}
            {summary ? ` · ${summary}` : ''}
          </span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-text-2" aria-hidden />
      </button>
    </>
  );
}

function lastTimeLabel(date: Date): string {
  const diff = differenceInCalendarDays(new Date(), date);
  if (diff <= 1) return formatRelativeDayInline(date);
  return formatCalendarDate(date);
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

/** Bench angle for this workout's exercise: stepper, presets, keypad and a bench diagram. */
function AngleSheet({
  kind,
  value,
  onChange,
  onClose,
}: {
  kind: AngleKind;
  value: number | null;
  onChange: (deg: number | null) => void;
  onClose: () => void;
}) {
  const [deg, setDeg] = useState<number | null>(value);
  return (
    <Sheet
      open
      onClose={onClose}
      title="Bench angle"
      description={
        kind === 'incline'
          ? 'A steeper incline moves work toward the upper chest and front delts.'
          : 'A decline moves work toward the lower chest.'
      }
      footer={
        <PrimaryButton
          block
          onClick={() => {
            onChange(deg);
            onClose();
          }}
        >
          {deg === null ? 'Done' : `Save ${formatAngle(deg).toLowerCase()}`}
        </PrimaryButton>
      }
    >
      <AnglePicker kind={kind} value={deg} startAt={DEFAULT_ANGLE[kind]} onChange={setDeg} />
    </Sheet>
  );
}

/** The rest actually taken before a set, measured from when the sets were ticked off. */
function RestTaken({ rest }: { rest: RestInterval }) {
  return (
    <p className="type-caption tabular flex items-center gap-1 pl-[34px] text-text-2">
      <Timer className="size-3" strokeWidth={2} aria-hidden />
      {rest.kind === 'set'
        ? `Rested ${formatRest(rest.seconds)}`
        : `${formatRest(rest.seconds)} since the last exercise`}
    </p>
  );
}
