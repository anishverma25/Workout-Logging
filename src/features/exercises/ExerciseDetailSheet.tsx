import { useMemo, useState } from 'react';
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { deleteCustomExercise, exerciseDependents } from '@/data/repositories/exercises';
import { addExercisesToDay } from '@/data/repositories/routines';
import { E1RM_MAX_REPS } from '@/domain/analytics/e1rm';
import { performanceByExercise } from '@/domain/analytics/performance';
import { buildSessions } from '@/domain/analytics/sessions';
import { daysForRoutine } from '@/domain/analytics/schedule';
import {
  CATEGORY_LABELS,
  EQUIPMENT_LABELS,
  LOAD_MODE_LABELS,
  MUSCLE_LABELS,
  TRACKING_LABELS,
} from '@/domain/models/labels';
import type { Exercise } from '@/domain/models/schemas';
import { formatRelativeDay } from '@/lib/dates';
import { pluralize } from '@/lib/format';
import { formatWeight } from '@/lib/units';
import { CustomExerciseSheet } from './CustomExerciseSheet';
import { MuscleShares } from './MuscleShares';
import { sharesFor } from '@/data/library/shares';
import { readableError } from '@/lib/errors';

interface Props {
  exercise: Exercise | null;
  onClose: () => void;
}

export function ExerciseDetailSheet({ exercise, onClose }: Props) {
  const toast = useToast();
  const training = useTrainingData();
  const prefs = usePreferences();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ slots: number; sets: number } | null>(null);
  const [addingToRoutine, setAddingToRoutine] = useState(false);

  const stats = useMemo(() => {
    if (!exercise || !training.data) return null;
    const history = performanceByExercise(buildSessions(training.data)).get(exercise.id) ?? [];
    if (history.length === 0) return null;
    const pick = (f: (p: (typeof history)[number]) => number | null) =>
      history.reduce<number | null>((best, p) => {
        const v = f(p);
        return v !== null && (best === null || v > best) ? v : best;
      }, null);
    return {
      sessions: history.length as number,
      last: history[history.length - 1]!.date,
      bestE1rm: pick((p) => p.bestE1rm),
      heaviest: pick((p) => p.heaviestLoad),
      mostReps: pick((p) => p.mostReps),
    } as const;
  }, [exercise, training.data]);

  if (!exercise) return null;
  const shares = sharesFor(exercise.id);
  const meta: [string, string][] = [
    ['Primary', MUSCLE_LABELS[exercise.primaryMuscle]],
    [
      'Secondary',
      exercise.secondaryMuscles.length
        ? exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')
        : 'None',
    ],
    ['Equipment', EQUIPMENT_LABELS[exercise.equipment]],
    ['Type', CATEGORY_LABELS[exercise.category]],
    ['Tracked as', TRACKING_LABELS[exercise.trackingType]],
  ];
  if (exercise.loadMode === 'per_hand') meta.push(['Load', LOAD_MODE_LABELS.per_hand]);

  async function askDelete() {
    const d = await exerciseDependents(db, exercise!.id);
    setConfirmDelete({ slots: d.routineSlots, sets: d.loggedSets });
  }

  return (
    <>
      <Sheet
        open={!editing && !confirmDelete && !addingToRoutine}
        onClose={onClose}
        title={exercise.name}
        description={
          <span className="flex items-center gap-2">
            {exercise.isCustom ? (
              <Badge tone="accent">Your exercise</Badge>
            ) : (
              <Badge>Library</Badge>
            )}
          </span>
        }
        footer={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<CalendarPlus className="size-4" aria-hidden />}
              onClick={() => setAddingToRoutine(true)}
            >
              Add to routine
            </Button>
            {exercise.isCustom ? (
              <>
                <Button
                  variant="secondary"
                  icon={<Pencil className="size-4" aria-hidden />}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  icon={<Trash2 className="size-4" aria-hidden />}
                  onClick={askDelete}
                >
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-[0.95rem]">
          {meta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-faint">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {shares ? (
          <section className="mt-6" aria-labelledby="shares-heading">
            <h3 id="shares-heading" className="mb-3 font-display text-lg font-semibold">
              What it works
            </h3>
            <MuscleShares shares={shares} />
          </section>
        ) : null}

        {exercise.instructions ? (
          <section className="mt-6">
            <h3 className="mb-1.5 font-display text-lg font-semibold">How to do it</h3>
            <p className="leading-relaxed text-muted">{exercise.instructions}</p>
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl bg-surface-2 p-4">
          <h3 className="font-display text-lg font-semibold">Your history</h3>
          {!stats ? (
            <p className="mt-1 text-sm text-muted">
              Not logged yet. Your best sets will appear here once you do.
            </p>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <Stat label="Sessions" value={String(stats.sessions)} />
              <Stat label="Last done" value={formatRelativeDay(stats.last)} />
              {stats.heaviest !== null ? (
                <Stat label="Heaviest" value={formatWeight(stats.heaviest, prefs.weightUnit)} />
              ) : null}
              {stats.bestE1rm !== null ? (
                <Stat
                  label="Best estimated 1RM"
                  value={formatWeight(stats.bestE1rm, prefs.weightUnit)}
                />
              ) : null}
              {stats.mostReps !== null ? (
                <Stat label="Most reps" value={String(stats.mostReps)} />
              ) : null}
            </dl>
          )}
          {stats && exercise.trackingType === 'weight_reps' ? (
            <p className="mt-3 text-xs text-faint">
              Estimated 1RM uses the Epley formula on sets of {E1RM_MAX_REPS} reps or fewer,
              counting logged reps in reserve. It is an estimate, not a lift you have done.
            </p>
          ) : null}
        </section>
      </Sheet>

      <CustomExerciseSheet open={editing} onClose={() => setEditing(false)} exercise={exercise} />

      <ConfirmSheet
        open={!!confirmDelete}
        title={`Delete ${exercise.name}?`}
        danger
        confirmLabel="Delete exercise"
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          try {
            await deleteCustomExercise(db, exercise.id);
            toast('Exercise deleted');
            setConfirmDelete(null);
            onClose();
          } catch (err) {
            toast(readableError(err));
          }
        }}
        body={
          <>
            {confirmDelete && confirmDelete.slots > 0 ? (
              <p>It will be removed from {pluralize(confirmDelete.slots, 'routine slot')}.</p>
            ) : null}
            <p className={confirmDelete && confirmDelete.slots > 0 ? 'mt-2' : ''}>
              {confirmDelete && confirmDelete.sets > 0
                ? `Your ${pluralize(confirmDelete.sets, 'logged set')} stay in your history under this name.`
                : 'You have not logged it yet.'}
            </p>
          </>
        }
      />

      <AddToRoutineSheet
        open={addingToRoutine}
        exercise={exercise}
        onClose={() => setAddingToRoutine(false)}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-faint">{label}</dt>
      <dd className="tabular mt-0.5 font-display text-lg font-semibold">{value}</dd>
    </div>
  );
}

function AddToRoutineSheet({
  open,
  exercise,
  onClose,
}: {
  open: boolean;
  exercise: Exercise;
  onClose: () => void;
}) {
  const training = useTrainingData();
  const toast = useToast();
  const routines = training.data?.routines ?? [];
  return (
    <Sheet open={open} onClose={onClose} title="Add to routine" description={exercise.name}>
      {!training.data ? null : routines.length === 0 ? (
        <p className="text-muted">Create a routine first, then add exercises to its days.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {routines.map((r) => (
            <section key={r.id}>
              <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
                {r.name}
                {r.isActive ? <Badge tone="accent">Active</Badge> : null}
              </h3>
              <div className="flex flex-wrap gap-2">
                {daysForRoutine(r, training.data!.routineDays).map((d) => (
                  <Button
                    key={d.id}
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await addExercisesToDay(db, d.id, [exercise.id]);
                      toast(`Added to ${d.name}`);
                      onClose();
                    }}
                  >
                    {d.name}
                  </Button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
