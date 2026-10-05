import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Ellipsis, NotebookPen, Pencil, Trash2, Trophy } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ActionList, TextArea, TextField } from '@/components/ui/Fields';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { usePreferences, useTrainingData, useWorkoutView } from '@/data/hooks';
import type { WorkoutExerciseView } from '@/data/repositories/workoutView';
import { deleteWorkout, updateWorkoutDetails } from '@/data/repositories/workouts';
import { estimateOneRepMax, supportsE1rm } from '@/domain/analytics/e1rm';
import { formatRecordValue, PR_LABELS, type PersonalRecord } from '@/domain/analytics/prs';
import { SET_TYPE_LABELS, SET_TYPE_SHORT } from '@/domain/models/labels';
import type { Preferences, WorkoutSet } from '@/domain/models/schemas';
import { summarizeWorkout, type ExerciseChange } from '@/domain/workout/summary';
import { cn } from '@/lib/cn';
import { formatLongDay } from '@/lib/dates';
import { readableError } from '@/lib/errors';
import { formatCompact, formatDurationMinutes, formatSignedPercent, pluralize } from '@/lib/format';
import { formatWeight, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { formatSetValues, setLabels, SET_TYPE_STYLES, trackingOf } from '../workout/format';
import { EditLoggedSetSheet } from './EditLoggedSetSheet';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function WorkoutDetailPage() {
  const { workoutId } = useParams();
  const view = useWorkoutView(workoutId);
  const training = useTrainingData();
  const prefs = usePreferences();
  const navigate = useNavigate();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editSet, setEditSet] = useState<string | null>(null);

  const summary = useMemo(
    () => (training.data && workoutId ? summarizeWorkout(training.data, workoutId) : null),
    [training.data, workoutId],
  );

  if (view.status === 'loading' || training.status === 'loading') {
    return <Skeleton className="mt-10 h-96" />;
  }
  if (view.status === 'error') return <ErrorState error={view.error} />;
  const data = view.data;
  if (!data || data.workout.status === 'cancelled') {
    return (
      <div className="pt-10">
        <EmptyState
          icon={<Trash2 className="size-5" aria-hidden />}
          title="Workout not found"
          body="It may have been deleted. Your other workouts are not affected."
          actions={
            <Button variant="secondary" onClick={() => navigate('/history')}>
              Back to history
            </Button>
          }
        />
      </div>
    );
  }
  if (data.workout.status === 'in_progress') return <Navigate to="/workout" replace />;

  const { workout } = data;
  const start = new Date(workout.startedAt);
  const prBySet = new Map<string, PersonalRecord[]>();
  for (const pr of summary?.prs ?? [])
    prBySet.set(pr.setId, [...(prBySet.get(pr.setId) ?? []), pr]);
  const exercises = data.exercises.filter((e) => e.sets.some((s) => s.completedAt !== null));
  const allSets = exercises.flatMap((e) => e.sets);
  const editing_set = allSets.find((s) => s.id === editSet) ?? null;
  const editingView = exercises.find((e) => e.sets.some((s) => s.id === editSet));
  const routine = training.data?.routines.find((r) => r.id === workout.routineId);

  return (
    <div className="pb-8">
      <div className="pt-4 lg:pt-8">
        <Link
          to="/history"
          className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden /> History
        </Link>
      </div>
      <header className="flex items-start justify-between gap-3 pb-5 pt-1">
        <div className="min-w-0">
          <h1 className="font-display text-[2.2rem] font-bold leading-none sm:text-[2.6rem]">
            {workout.name}
          </h1>
          <p className="mt-2 text-muted">
            {formatLongDay(start)} at {timeFormat.format(start)}
            {routine ? <span className="text-faint"> · {routine.name}</span> : null}
          </p>
        </div>
        <IconButton
          label="Workout options"
          icon={<Ellipsis className="size-5" aria-hidden />}
          onClick={() => setMenu(true)}
        />
      </header>

      {summary ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Duration"
            value={
              summary.minutes === null
                ? 'n/a'
                : summary.minutes < 1
                  ? '<1 min'
                  : formatDurationMinutes(summary.minutes)
            }
          />
          <Stat label="Working sets" value={String(summary.workingSets)} />
          <Stat
            label={`Volume (${prefs.weightUnit})`}
            value={
              summary.volumeKg > 0
                ? formatCompact(toDisplayWeight(summary.volumeKg, prefs.weightUnit))
                : 'n/a'
            }
          />
          <Stat
            label="Records"
            value={String(new Set(summary.prs.map((p) => p.exerciseId)).size)}
          />
        </dl>
      ) : null}

      {workout.notes ? (
        <Card className="mt-4 p-4">
          <p className="whitespace-pre-line text-muted">{workout.notes}</p>
        </Card>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2 lg:items-start">
        {exercises.map((ex) => (
          <ExerciseBlock
            key={ex.workoutExercise.id}
            view={ex}
            prefs={prefs}
            prBySet={prBySet}
            change={
              summary?.exercises.find((e) => e.exerciseId === ex.workoutExercise.exerciseId)
                ?.change ?? null
            }
            onEditSet={setEditSet}
          />
        ))}
      </div>
      <p className="mt-4 text-sm text-faint">
        Tap a set to correct it. Records and analytics update automatically.
      </p>

      <Sheet open={menu} onClose={() => setMenu(false)} title={workout.name}>
        <ActionList
          items={[
            {
              label: 'Rename and edit notes',
              icon: <Pencil className="size-5" aria-hidden />,
              onSelect: () => {
                setMenu(false);
                setEditing(true);
              },
            },
            {
              label: 'Delete workout',
              hint: 'Removes it from history, records and analytics.',
              icon: <Trash2 className="size-5" aria-hidden />,
              danger: true,
              onSelect: () => {
                setMenu(false);
                setConfirmDelete(true);
              },
            },
          ]}
        />
      </Sheet>
      {editing ? (
        <EditWorkoutSheet
          name={workout.name}
          notes={workout.notes ?? ''}
          onClose={() => setEditing(false)}
          onSave={(name, notes) => updateWorkoutDetails(db, workout.id, { name, notes })}
        />
      ) : null}
      <ConfirmSheet
        open={confirmDelete}
        title={`Delete ${workout.name}?`}
        body={`This removes ${pluralize(allSets.filter((s) => s.completedAt).length, 'logged set')} from your history. Records and analytics are recalculated without it. This cannot be undone.`}
        confirmLabel="Delete workout"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteWorkout(db, workout.id);
          toast('Workout deleted');
          navigate('/history', { replace: true });
        }}
      />
      <EditLoggedSetSheet
        set={editing_set}
        exercise={editingView?.exercise}
        exerciseName={editingView?.workoutExercise.exerciseName ?? ''}
        unit={prefs.weightUnit}
        onClose={() => setEditSet(null)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3.5 py-3">
      <dt className="text-xs font-medium text-faint">{label}</dt>
      <dd className="tabular mt-1 font-display text-[1.6rem] font-bold leading-none">{value}</dd>
    </div>
  );
}

function ExerciseBlock({
  view,
  prefs,
  prBySet,
  change,
  onEditSet,
}: {
  view: WorkoutExerciseView;
  prefs: Preferences;
  prBySet: Map<string, PersonalRecord[]>;
  change: ExerciseChange | null;
  onEditSet: (id: string) => void;
}) {
  const { workoutExercise: we, exercise } = view;
  const sets = view.sets.filter((s) => s.completedAt !== null);
  const tracking = trackingOf(exercise);
  const labels = setLabels(sets);
  const best = sets.reduce<number | null>((b, s) => {
    if (!supportsE1rm(exercise) || s.setType === 'warmup') return b;
    const e = estimateOneRepMax(s.weightKg, s.reps);
    return e !== null && (b === null || e > b) ? e : b;
  }, null);

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 truncate font-display text-[1.35rem] font-bold">
          {we.exerciseName}
        </h2>
        {change && change.kind !== 'first' ? (
          <span
            className={cn(
              'tabular shrink-0 text-sm font-semibold',
              change.change > 0.0005
                ? 'text-accent-text'
                : change.change < -0.0005
                  ? 'text-warn'
                  : 'text-muted',
            )}
            title="Best set compared with the previous session"
          >
            {Math.abs(change.change) < 0.0005
              ? 'Same as last time'
              : formatSignedPercent(change.change, 1)}
            <span className="sr-only"> compared with the previous session</span>
          </span>
        ) : null}
      </div>
      {we.target ? (
        <p className="tabular text-sm text-faint">
          Target {we.target.sets} ×{' '}
          {we.target.repMin === we.target.repMax
            ? we.target.repMin
            : `${we.target.repMin}–${we.target.repMax}`}
          {we.target.rir !== null ? ` · RIR ${we.target.rir}` : ''}
        </p>
      ) : null}
      {we.notes ? <p className="mt-1 text-sm text-muted">{we.notes}</p> : null}
      <ol className="mt-3 flex flex-col">
        {sets.map((s) => (
          <SetLine
            key={s.id}
            set={s}
            label={SET_TYPE_SHORT[s.setType] || labels.get(s.id) || ''}
            text={formatSetValues(s, tracking, prefs.weightUnit)}
            prs={prBySet.get(s.id) ?? []}
            unit={prefs.weightUnit}
            onEdit={() => onEditSet(s.id)}
          />
        ))}
      </ol>
      {best !== null ? (
        <p className="mt-2 text-xs text-faint">
          Best estimated 1RM {formatWeight(best, prefs.weightUnit)}. An estimate from the set, not a
          lift performed.
        </p>
      ) : null}
    </Card>
  );
}

function SetLine({
  set,
  label,
  text,
  prs,
  unit,
  onEdit,
}: {
  set: WorkoutSet;
  label: string;
  text: string;
  prs: PersonalRecord[];
  unit: WeightUnit;
  onEdit: () => void;
}) {
  const effort = set.rir !== null ? `RIR ${set.rir}` : set.rpe !== null ? `RPE ${set.rpe}` : null;
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${SET_TYPE_LABELS[set.setType]} set ${label}: ${text}${effort ? `, ${effort}` : ''}. Edit`}
        className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-1.5 py-2 text-left transition-colors hover:bg-surface-2"
      >
        <span
          className={cn('tabular text-center font-display font-bold', SET_TYPE_STYLES[set.setType])}
        >
          {label}
        </span>
        <span className="min-w-0">
          <span className="tabular font-semibold">{text}</span>
          {set.notes ? (
            <span className="block truncate text-xs text-faint">{set.notes}</span>
          ) : null}
          {prs.length > 0 ? (
            <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs font-semibold text-accent-text">
              {prs.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1">
                  <Trophy className="size-3" aria-hidden />
                  {PR_LABELS[p.type]} {formatRecordValue(p.type, p.value, unit)}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        <span className="tabular text-sm text-faint">{effort ?? ''}</span>
      </button>
    </li>
  );
}

function EditWorkoutSheet({
  name: initialName,
  notes: initialNotes,
  onClose,
  onSave,
}: {
  name: string;
  notes: string;
  onClose: () => void;
  onSave: (name: string, notes: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      await onSave(name, notes);
      onClose();
    } catch (err) {
      setError(readableError(err));
    }
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit workout"
      footer={
        <Button block onClick={save}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <TextArea
          label="Notes"
          value={notes}
          maxLength={1000}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Energy, sleep, anything worth remembering"
        />
        <p className="flex items-center gap-2 text-sm text-faint">
          <NotebookPen className="size-4" aria-hidden /> Sets are edited by tapping them.
        </p>
      </div>
    </Sheet>
  );
}
