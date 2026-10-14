import { MedalIcon } from '@/features/medals/Medal';
import { ShareSheet } from '@/features/share/ShareSheet';
import { useStartWorkout } from '@/features/workout/StartWorkout';
import { ActionMenu } from '@/components/kit/menu';
import { formatRest, restIntervals, type RestInterval } from '@/domain/analytics/rest';
import { RestCard } from '@/features/shared/RestCard';
import { useId, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import {
  ArrowDownRight,
  ArrowUpRight,
  Ellipsis,
  Minus,
  NotebookPen,
  Pencil,
  Play,
  Share,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  BottomSheet,
  Card,
  ConfirmSheet,
  IconButton,
  IconTile,
  PrimaryButton,
  SecondaryButton,
} from '@/components/kit';
import { TextArea, TextField } from '@/components/ui/Fields';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { usePreferences, useTrainingData, useWorkoutView } from '@/data/hooks';
import { buildSessions } from '@/domain/analytics/sessions';
import { performanceByExercise } from '@/domain/analytics/performance';
import { sessionLoad } from '@/domain/analytics/standards';
import type { WorkoutExerciseView } from '@/data/repositories/workoutView';
import { deleteWorkout, updateWorkoutDetails } from '@/data/repositories/workouts';
import { estimateOneRepMax, supportsE1rm } from '@/domain/analytics/e1rm';
import { formatRecordValue, PR_LABELS, type PersonalRecord } from '@/domain/analytics/prs';
import { SET_TYPE_LABELS, SET_TYPE_SHORT } from '@/domain/models/labels';
import type { Preferences, TrackingType, WorkoutSet } from '@/domain/models/schemas';
import { summarizeWorkout, type ExerciseChange } from '@/domain/workout/summary';
import { formatLongDay } from '@/lib/dates';
import { readableError } from '@/lib/errors';
import { formatCompact, formatSignedPercent, pluralize } from '@/lib/format';
import { formatWeight, formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { columnsFor, formatSetValues, setLabels, trackingOf } from '../workout/format';
import { EditLoggedSetSheet } from './EditLoggedSetSheet';
import { DurationValue, StatItem } from './StatItem';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function WorkoutDetailPage() {
  const { workoutId } = useParams();
  const view = useWorkoutView(workoutId);
  const training = useTrainingData();
  const prefs = usePreferences();
  const navigate = useNavigate();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const startWorkout = useStartWorkout();
  const [starting, setStarting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editSet, setEditSet] = useState<string | null>(null);

  const summary = useMemo(
    () => (training.data && workoutId ? summarizeWorkout(training.data, workoutId) : null),
    [training.data, workoutId],
  );
  // Best estimated 1RM of each exercise before this workout, for % of 1RM on every set.
  const startedAt = view.data?.workout.startedAt;
  const references = useMemo(() => {
    const map = new Map<string, number>();
    if (!training.data || !startedAt) return map;
    const before = buildSessions(training.data).filter(
      (s) => s.workout.startedAt < startedAt && s.workout.id !== workoutId,
    );
    for (const [id, list] of performanceByExercise(before)) {
      const best = Math.max(...list.map((p) => p.bestE1rm ?? 0));
      if (best > 0) map.set(id, best);
    }
    return map;
  }, [training.data, startedAt, workoutId]);

  if (view.status === 'loading' || training.status === 'loading') {
    return <Skeleton className="mt-10 h-96" />;
  }
  if (view.status === 'error') return <ErrorState error={view.error} />;
  const data = view.data;
  if (!data || data.workout.status === 'cancelled') {
    return (
      <div className="pt-10">
        <Card className="flex flex-col items-center gap-3 px-5 py-8 text-center">
          <IconTile icon={<Trash2 />} />
          <div>
            <h1 className="type-headline text-text-1">Workout not found</h1>
            <p className="type-meta mt-1 max-w-[36ch] text-text-2 [text-wrap:balance]">
              It may have been deleted. Your other workouts are not affected.
            </p>
          </div>
          <SecondaryButton compact onClick={() => navigate('/history')}>
            Back to history
          </SecondaryButton>
        </Card>
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
  const rests = restIntervals(allSets);
  const editing_set = allSets.find((s) => s.id === editSet) ?? null;
  const editingView = exercises.find((e) => e.sets.some((s) => s.id === editSet));
  const routine = training.data?.routines.find((r) => r.id === workout.routineId);

  return (
    <div className="pb-8">
      <PageHeader
        back={{ to: '/history', label: 'History' }}
        title={workout.name}
        subtitle={
          <>
            {formatLongDay(start)} at {timeFormat.format(start)}
            {routine ? ` · ${routine.name}` : null}
          </>
        }
        actions={
          <IconButton
            label="Workout options"
            icon={<Ellipsis aria-hidden />}
            ref={menuButton}
            aria-expanded={menu}
            aria-haspopup="menu"
            onClick={() => setMenu((m) => !m)}
          />
        }
      />

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <PrimaryButton
          block
          icon={<Play className="fill-current" aria-hidden />}
          loading={starting}
          onClick={async () => {
            setStarting(true);
            try {
              await startWorkout({ fromWorkoutId: workout.id });
            } finally {
              setStarting(false);
            }
          }}
        >
          Start this workout
        </PrimaryButton>
        <SecondaryButton icon={<Share aria-hidden />} onClick={() => setSharing(true)}>
          Share
        </SecondaryButton>
      </div>
      <ShareSheet workoutId={workout.id} open={sharing} onClose={() => setSharing(false)} />

      {summary ? (
        <dl className="grid grid-cols-2 gap-3 tab:grid-cols-4">
          <StatItem
            label="Duration"
            value={summary.minutes !== null ? <DurationValue minutes={summary.minutes} /> : null}
            empty={summary.minutes === null ? 'Not recorded' : undefined}
          />
          <StatItem label="Working sets" value={String(summary.workingSets)} />
          <StatItem
            label="Volume load"
            value={formatCompact(toDisplayWeight(summary.volumeKg, prefs.weightUnit))}
            unit={prefs.weightUnit}
            empty={summary.volumeKg > 0 ? undefined : 'None'}
          />
          <StatItem
            label="Records"
            value={String(new Set(summary.prs.map((p) => p.exerciseId)).size)}
          />
        </dl>
      ) : null}
      {workout.sessionRpe || workout.readiness ? (
        <p className="type-meta tabular mt-3 text-text-2">
          {workout.readiness
            ? `Before: sleep ${workout.readiness.sleep}/5, energy ${workout.readiness.energy}/5, soreness ${workout.readiness.soreness}/5. `
            : ''}
          {workout.sessionRpe
            ? `Session effort ${workout.sessionRpe}/10${
                summary?.minutes
                  ? `, training load ${sessionLoad(workout.sessionRpe, Math.round(summary.minutes))} (effort × minutes)`
                  : ''
              }.`
            : ''}
        </p>
      ) : null}

      {workout.notes ? (
        <p className="type-body mt-4 rounded-nested bg-surface-2 px-4 py-3 whitespace-pre-line text-text-2">
          {workout.notes}
        </p>
      ) : null}

      <RestCard exercises={exercises} minutes={summary?.minutes ?? null} className="mt-4" />

      <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-start">
        {exercises.map((ex) => (
          <ExerciseBlock
            key={ex.workoutExercise.id}
            view={ex}
            prefs={prefs}
            prBySet={prBySet}
            reference={references.get(ex.workoutExercise.exerciseId) ?? null}
            change={
              summary?.exercises.find((e) => e.exerciseId === ex.workoutExercise.exerciseId)
                ?.change ?? null
            }
            onEditSet={setEditSet}
            rests={rests}
          />
        ))}
      </div>
      <p className="type-meta mt-4 text-text-2">
        Tap a set to correct it. Records and analytics update automatically.
      </p>

      <ActionMenu
        open={menu}
        onClose={() => setMenu(false)}
        anchor={menuButton}
        label={`Options for ${workout.name}`}
        items={[
          {
            label: 'Rename and edit notes',
            icon: <Pencil aria-hidden />,
            onSelect: () => {
              setMenu(false);
              setEditing(true);
            },
          },
          {
            label: 'Delete workout',
            hint: 'Removes it from history, records and analytics.',
            icon: <Trash2 aria-hidden />,
            danger: true,
            onSelect: () => {
              setMenu(false);
              setConfirmDelete(true);
            },
          },
        ]}
      />
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
        destructive
        busy={deleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await deleteWorkout(db, workout.id);
            toast('Workout deleted');
            navigate('/history', { replace: true });
          } catch (err) {
            setDeleting(false);
            toast(readableError(err));
          }
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

const round2 = (v: number) => Math.round(v * 100) / 100;

/** The numbers in the load and amount columns, as the logger shows them. */
function cellValues(set: WorkoutSet, tracking: TrackingType, unit: WeightUnit) {
  const cols = columnsFor(tracking, unit);
  if (tracking === 'cardio') {
    return {
      load: set.durationSec === null ? null : String(round2(set.durationSec / 60)),
      amount: set.distanceM === null ? null : String(round2(set.distanceM / 1000)),
    };
  }
  const amount = set[cols.amountField];
  return {
    load: set.weightKg === null ? null : formatWeightValue(set.weightKg, unit, 2),
    amount: amount === null ? null : String(amount),
  };
}

function ExerciseBlock({
  view,
  prefs,
  prBySet,
  change,
  onEditSet,
  reference,
  rests,
}: {
  rests: Map<string, RestInterval>;
  view: WorkoutExerciseView;
  prefs: Preferences;
  prBySet: Map<string, PersonalRecord[]>;
  change: ExerciseChange | null;
  onEditSet: (id: string) => void;
  /** Best e1RM before this workout; this workout's own best when there is none. */
  reference?: number | null;
}) {
  const { workoutExercise: we, exercise } = view;
  const headingId = useId();
  const unit = prefs.weightUnit;
  const sets = view.sets.filter((s) => s.completedAt !== null);
  const tracking = trackingOf(exercise);
  const cols = columnsFor(tracking, unit);
  const labels = setLabels(sets);
  const best = sets.reduce<number | null>((b, s) => {
    if (!supportsE1rm(exercise) || s.setType === 'warmup') return b;
    const e = estimateOneRepMax(s.weightKg, s.reps, s.rir);
    return e !== null && (b === null || e > b) ? e : b;
  }, null);
  const percentOf = (s: WorkoutSet) =>
    supportsE1rm(exercise) && s.weightKg && (reference ?? best)
      ? Math.round((s.weightKg / (reference ?? best)!) * 100)
      : null;

  // The effort column follows what was logged: RIR, or RPE when only RPE was recorded.
  const effortKey: 'rir' | 'rpe' | null = !cols.showEffort
    ? null
    : sets.some((s) => s.rir !== null)
      ? 'rir'
      : sets.some((s) => s.rpe !== null)
        ? 'rpe'
        : null;
  const showPercent = sets.some((s) => percentOf(s) !== null);
  const perHand = exercise?.loadMode === 'per_hand' && cols.load !== null && tracking !== 'cardio';
  const columns = [
    '28px',
    ...(cols.load !== null ? ['minmax(0,1fr)'] : []),
    'minmax(0,1fr)',
    ...(effortKey ? ['minmax(0,0.8fr)'] : []),
    ...(showPercent ? ['minmax(0,0.9fr)'] : []),
  ].join(' ');
  const same = change && change.kind !== 'first' && Math.abs(change.change) < 0.0005;
  const TrendIcon =
    change && change.kind !== 'first'
      ? change.change > 0.0005
        ? ArrowUpRight
        : change.change < -0.0005
          ? ArrowDownRight
          : Minus
      : null;

  return (
    <Card as="section" aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-3">
        <h2 id={headingId} className="type-headline min-w-0 truncate text-text-1">
          {we.exerciseName}
        </h2>
        {change && change.kind !== 'first' && TrendIcon ? (
          <span
            className="type-meta tabular flex shrink-0 items-center gap-1 text-text-2"
            title="Best set compared with the previous session"
          >
            <TrendIcon className="size-4" aria-hidden />
            {same ? 'Same as last time' : formatSignedPercent(change.change, 1)}
            <span className="sr-only"> compared with the previous session</span>
          </span>
        ) : null}
      </div>
      {we.target ? (
        <p className="type-meta tabular mt-0.5 text-text-2">
          Target {we.target.sets} ×{' '}
          {we.target.repMin === we.target.repMax
            ? we.target.repMin
            : `${we.target.repMin} to ${we.target.repMax}`}
          {we.target.rir !== null ? ` · RIR ${we.target.rir}` : ''}
        </p>
      ) : null}
      {we.notes ? <p className="type-meta mt-1 text-text-2">{we.notes}</p> : null}

      <div
        aria-hidden
        className="type-caption mt-4 grid items-center gap-1.5 px-1.5 pb-1 text-text-2"
        style={{ gridTemplateColumns: columns }}
      >
        <span className="text-center">Set</span>
        {cols.load !== null ? (
          <span className="text-center">{perHand ? `${cols.load} each` : cols.load}</span>
        ) : null}
        <span className="text-center">{cols.amount}</span>
        {effortKey ? <span className="text-center">{effortKey.toUpperCase()}</span> : null}
        {showPercent ? (
          <span className="text-center" title="Share of your best estimated 1RM">
            % 1RM
          </span>
        ) : null}
      </div>
      <ol className="flex flex-col gap-0.5">
        {sets.map((s) => (
          <SetLine
            key={s.id}
            set={s}
            label={SET_TYPE_SHORT[s.setType] || labels.get(s.id) || ''}
            text={formatSetValues(s, tracking, unit)}
            cells={cellValues(s, tracking, unit)}
            hasLoad={cols.load !== null}
            effortKey={effortKey}
            columns={columns}
            prs={prBySet.get(s.id) ?? []}
            unit={unit}
            onEdit={() => onEditSet(s.id)}
            percent={showPercent ? percentOf(s) : undefined}
            rest={rests.get(s.id)}
          />
        ))}
      </ol>
      {best !== null ? (
        <p className="type-meta mt-3 text-text-2">
          Best estimated 1RM {formatWeight(best, unit)}. An estimate from the set, not a lift
          performed.
        </p>
      ) : null}
    </Card>
  );
}

function SetLine({
  set,
  label,
  text,
  cells,
  hasLoad,
  effortKey,
  columns,
  prs,
  unit,
  onEdit,
  percent,
  rest,
}: {
  rest?: RestInterval;
  set: WorkoutSet;
  label: string;
  text: string;
  cells: { load: string | null; amount: string | null };
  hasLoad: boolean;
  effortKey: 'rir' | 'rpe' | null;
  columns: string;
  prs: PersonalRecord[];
  unit: WeightUnit;
  onEdit: () => void;
  /** Load as a share of the best estimated 1RM; undefined when the column is not shown. */
  percent?: number | null;
}) {
  const effort = set.rir !== null ? `RIR ${set.rir}` : set.rpe !== null ? `RPE ${set.rpe}` : null;
  // The column shows the bare number; a set logged in the other scale keeps its label.
  const effortCell =
    effortKey === 'rir'
      ? set.rir !== null
        ? String(set.rir)
        : effort
      : effortKey === 'rpe'
        ? set.rpe !== null
          ? String(set.rpe)
          : effort
        : null;
  return (
    <li>
      {rest ? (
        <p className="type-caption tabular pl-[42px] text-text-2">
          {rest.kind === 'set'
            ? `Rested ${formatRest(rest.seconds)}`
            : `${formatRest(rest.seconds)} since the last exercise`}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${SET_TYPE_LABELS[set.setType]} set ${label}: ${text}${effort ? `, ${effort}` : ''}. Edit`}
        className="pressable w-full rounded-field px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
      >
        <span className="grid items-center gap-1.5" style={{ gridTemplateColumns: columns }}>
          <span className="type-caption tabular flex size-7 items-center justify-center rounded-full bg-surface-2 font-semibold text-text-2">
            {label}
          </span>
          {hasLoad ? (
            <span className="type-headline tabular truncate text-center text-text-1">
              {cells.load ?? ''}
            </span>
          ) : null}
          <span className="type-headline tabular truncate text-center text-text-1">
            {cells.amount ?? ''}
          </span>
          {effortKey ? (
            <span className="type-body tabular truncate text-center text-text-2">
              {effortCell ?? ''}
            </span>
          ) : null}
          {percent !== undefined ? (
            <span className="type-meta tabular truncate text-center text-text-2">
              {percent !== null ? `${percent}%` : ''}
            </span>
          ) : null}
        </span>
        {prs.length > 0 || set.notes ? (
          <span className="mt-1 flex flex-col gap-1 pl-[34px]">
            {prs.length > 0 ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="type-caption inline-flex h-6 items-center gap-1 rounded-full bg-gold-dim pr-2.5 pl-1.5 font-semibold text-gold">
                  <MedalIcon className="size-4" />
                  {prs.length > 1 ? `${prs.length} medals` : 'Medal'}
                </span>
                <span className="type-meta tabular text-text-2">
                  {prs
                    .map((p) => `${PR_LABELS[p.type]} ${formatRecordValue(p.type, p.value, unit)}`)
                    .join(' · ')}
                </span>
              </span>
            ) : null}
            {set.notes ? (
              <span className="type-meta block truncate text-text-2">{set.notes}</span>
            ) : null}
          </span>
        ) : null}
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
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await onSave(name, notes);
      onClose();
    } catch (err) {
      setError(readableError(err));
      setSaving(false);
    }
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Edit workout"
      footer={
        <PrimaryButton block loading={saving} onClick={save}>
          Save
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
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
        <p className="type-meta flex items-center gap-2 text-text-2">
          <NotebookPen className="size-4 shrink-0" aria-hidden /> Sets are edited by tapping them.
        </p>
      </div>
    </BottomSheet>
  );
}
