import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chips, MultiChips, TextArea, TextField } from '@/components/ui/Fields';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Sheet } from '@/components/ui/Sheet';
import { readableError } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { useLiveData } from '@/data/hooks';
import {
  createCustomExercise,
  exerciseDependents,
  updateCustomExercise,
} from '@/data/repositories/exercises';
import {
  CATEGORY_LABELS,
  EQUIPMENT_LABELS,
  LOAD_MODE_LABELS,
  MUSCLE_LABELS,
  TRACKING_HINTS,
  TRACKING_LABELS,
} from '@/domain/models/labels';
import {
  Equipment,
  MUSCLE_GROUPS,
  TrackingType,
  type CustomExerciseInput,
  type Exercise,
  type MuscleGroup,
} from '@/domain/models/schemas';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit this exercise; create a new one when absent. */
  exercise?: Exercise | null;
  /** Prefill the name, for example from a search that found nothing. */
  initialName?: string;
  onSaved?: (exercise: Exercise) => void;
}

const blank = (name = ''): CustomExerciseInput => ({
  name,
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  category: 'compound',
  trackingType: 'weight_reps',
  loadMode: 'total',
  instructions: '',
});

const fromExercise = (e: Exercise): CustomExerciseInput => ({
  name: e.name,
  primaryMuscle: e.primaryMuscle,
  secondaryMuscles: e.secondaryMuscles,
  equipment: e.equipment,
  category: e.category,
  trackingType: e.trackingType,
  loadMode: e.loadMode,
  instructions: e.instructions ?? '',
});

const muscles = MUSCLE_GROUPS.map((m) => ({ value: m, label: MUSCLE_LABELS[m] }));

/** Form state lives in the open sheet only, so each opening starts from the current values. */
export function CustomExerciseSheet(props: Props) {
  return props.open ? <CustomExerciseForm {...props} /> : null;
}

function CustomExerciseForm({ onClose, exercise, initialName, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<CustomExerciseInput>(() =>
    exercise ? fromExercise(exercise) : blank(initialName),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = !!exercise;

  const deps = useLiveData(
    async () => (exercise ? exerciseDependents(db, exercise.id) : null),
    [exercise?.id],
  );
  const trackingLocked = editing && (deps.data?.loggedSets ?? 0) > 0;
  const set = <K extends keyof CustomExerciseInput>(key: K, value: CustomExerciseInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = editing
        ? await updateCustomExercise(db, exercise.id, form)
        : await createCustomExercise(db, form);
      toast(editing ? 'Exercise updated' : `${saved.name} added to your exercises`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  const weightTracked =
    form.trackingType !== 'duration' &&
    form.trackingType !== 'distance' &&
    form.trackingType !== 'bodyweight_reps';

  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit exercise' : 'New exercise'}
      description={
        editing
          ? 'Changes apply everywhere this exercise is used. Logged workouts keep the name they were logged with.'
          : 'Your own exercise, tracked just like the built-in ones.'
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={busy || form.name.trim().length < 2}>
            {editing ? 'Save changes' : 'Create exercise'}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Name"
          value={form.name}
          maxLength={80}
          autoComplete="off"
          onChange={(e) => set('name', e.target.value)}
          placeholder="For example, landmine press"
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-muted">Primary muscle</legend>
          <Chips
            label="Primary muscle"
            options={muscles}
            value={form.primaryMuscle}
            onChange={(m) =>
              m &&
              setForm((f) => ({
                ...f,
                primaryMuscle: m,
                secondaryMuscles: f.secondaryMuscles.filter((x) => x !== m),
              }))
            }
            className="sm:flex-wrap"
          />
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted">
            Secondary muscles <span className="font-normal text-faint">(optional)</span>
          </legend>
          <MultiChips<MuscleGroup>
            label="Secondary muscles"
            options={muscles.filter((m) => m.value !== form.primaryMuscle)}
            value={form.secondaryMuscles}
            onChange={(v) => set('secondaryMuscles', v)}
          />
          <p className="mt-2 text-sm text-faint">
            Muscle workload counts a working set as 1 for the primary muscle and 0.5 for each
            secondary muscle.
          </p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted">Equipment</legend>
          <Chips
            label="Equipment"
            options={Equipment.options.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))}
            value={form.equipment}
            onChange={(e) => e && set('equipment', e)}
            className="sm:flex-wrap"
          />
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Type</span>
          <SegmentedControl
            label="Exercise type"
            value={form.category}
            options={(['compound', 'isolation'] as const).map((c) => ({
              value: c,
              label: CATEGORY_LABELS[c],
            }))}
            onChange={(c) => set('category', c)}
          />
        </div>

        <fieldset disabled={trackingLocked} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-muted">How it is tracked</legend>
          <Chips
            label="Tracking type"
            options={TrackingType.options.map((t) => ({ value: t, label: TRACKING_LABELS[t] }))}
            value={form.trackingType}
            onChange={(t) => t && set('trackingType', t)}
            className="sm:flex-wrap"
          />
          <p className="text-sm text-faint">
            {trackingLocked
              ? 'Locked because sets are already logged with this exercise. Changing it would change what those numbers mean.'
              : TRACKING_HINTS[form.trackingType]}
          </p>
          {weightTracked ? (
            <div className="mt-2 flex flex-col gap-2">
              <span className="text-sm font-medium text-muted">Load you enter</span>
              <SegmentedControl
                label="Load you enter"
                value={form.loadMode}
                options={(['total', 'per_hand'] as const).map((m) => ({
                  value: m,
                  label: LOAD_MODE_LABELS[m],
                }))}
                onChange={(m) => !trackingLocked && set('loadMode', m)}
              />
              <p className="text-sm text-faint">
                Per dumbbell or side: you log one dumbbell, and volume counts both.
              </p>
            </div>
          ) : null}
        </fieldset>

        <TextArea
          label="Instructions (optional)"
          value={form.instructions ?? ''}
          maxLength={1000}
          onChange={(e) => set('instructions', e.target.value)}
          placeholder="Setup and cues you want to remember"
        />
      </form>
    </Sheet>
  );
}
