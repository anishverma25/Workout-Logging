import { useId, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Check, ChevronLeft, FileUp, History, Sparkles } from 'lucide-react';
import { useAccount } from '@/app/account';
import { APP_NAME } from '@/app/navigation';
import { safeNext } from '@/features/account/next';
import {
  Badge,
  Card,
  InlineNotice,
  OptionCard,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  Switch,
  TextLink,
} from '@/components/kit';
import { db } from '@/data/db';
import { useExerciseCatalog, usePreferences } from '@/data/hooks';
import { applyImport, type ImportResult } from '@/data/repositories/importer';
import {
  ImportFormatError,
  readExport,
  type ImportedLog,
  type ImportSource,
} from '@/domain/import/formats';
import { planImport, type ExerciseChoice, type ImportPlan } from '@/domain/import/plan';
import { ROUTINE_WINDOW_DAYS, type InferredRoutine } from '@/domain/import/routine';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '@/domain/models/schemas';
import { MUSCLE_LABELS } from '@/domain/models/labels';
import { formatCalendarDate, pluralize } from '@/lib/format';

/**
 * Bringing training history over from Hevy or Strong. Offered right after sign-up (with
 * `welcome`), and any time from More and Settings. Nothing is saved until the person has seen
 * what will come in and what each exercise becomes; saving the same export twice adds nothing.
 */

type Step = 'choose' | 'files' | 'review' | 'done';

const APPS: Record<ImportSource, { name: string; how: string[]; files: string }> = {
  hevy: {
    name: 'Hevy',
    how: [
      'In Hevy, open your profile, then Settings.',
      'Choose Export data, then export your workouts.',
      'If you log body weight in Hevy, export your measurements too.',
    ],
    files: 'Choose the workouts file, and the measurements file if you have one.',
  },
  strong: {
    name: 'Strong',
    how: [
      'In Strong, open Settings.',
      'Choose Export data and save the CSV file.',
      'Tell us below whether you logged in kg or lb in Strong.',
    ],
    files: 'Choose the CSV file Strong saved.',
  },
};

export function ImportPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const next = safeNext(params.get('next'), '/');
  const account = useAccount();
  const prefs = usePreferences();
  const catalog = useExerciseCatalog();

  const [step, setStep] = useState<Step>('choose');
  const [source, setSource] = useState<ImportSource>('hevy');
  const [strongUnit, setStrongUnit] = useState<'kg' | 'lb'>(prefs.weightUnit);
  const [log, setLog] = useState<ImportedLog | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [choices, setChoices] = useState<Record<string, ExerciseChoice>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [makeRoutine, setMakeRoutine] = useState(true);
  const fileInput = useId();

  const exercises = useMemo(() => catalog.data?.exercises ?? [], [catalog.data]);

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = [...(e.target.files ?? [])];
    e.target.value = '';
    if (picked.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const files = await Promise.all(
        picked.map(async (f) => ({ name: f.name, text: await f.text() })),
      );
      const read = readExport(files, { strongUnit });
      if (read.source !== source) {
        throw new ImportFormatError(
          `That looks like a ${APPS[read.source].name} export. Go back and choose ${APPS[read.source].name}, or pick the ${APPS[source].name} file.`,
        );
      }
      if (read.workouts.length === 0 && read.body.length === 0) {
        throw new ImportFormatError('There are no workouts or measurements in that file.');
      }
      const p = planImport(read, exercises);
      setLog(read);
      setPlan(p);
      setChoices(Object.fromEntries(p.exercises.map((x) => [x.name, x.choice])));
      setStep('review');
    } catch (err) {
      setError(
        err instanceof ImportFormatError
          ? err.message
          : 'That file could not be read. Export it again from the app and choose the CSV file.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!log) return;
    setBusy(true);
    setError(null);
    try {
      const namespace = account.user?.id ?? 'device';
      setResult(
        await applyImport(db, log, choices, namespace, {
          routine: makeRoutine ? (plan?.routine ?? null) : null,
        }),
      );
      setStep('done');
    } catch (err) {
      console.error(err);
      setError('Something went wrong while saving. Nothing was half-saved; try again.');
    } finally {
      setBusy(false);
    }
  }

  const back =
    step === 'files' ? () => setStep('choose') : step === 'review' ? () => setStep('files') : null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg pt-safe">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-safe pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="chrome flex h-14 items-center justify-between gap-3">
          {back ? (
            <button
              type="button"
              onClick={back}
              className="pressable tap-target type-body -ml-2 inline-flex h-11 items-center gap-0.5 rounded-field pr-2 font-medium text-text-1"
            >
              <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden />
              Back
            </button>
          ) : (
            <span className="type-headline text-text-1">{APP_NAME}</span>
          )}
          {step !== 'done' ? (
            <TextLink onClick={() => navigate(next, { replace: true })} className="px-2">
              {welcome ? 'Start fresh' : 'Cancel'}
            </TextLink>
          ) : null}
        </header>

        {step === 'choose' ? (
          <section aria-labelledby="import-title" className="mt-4 flex flex-1 flex-col">
            <h1 id="import-title" className="type-display text-text-1 [text-wrap:balance]">
              {welcome ? 'Coming from another app?' : 'Import your training'}
            </h1>
            <p className="type-body mt-2 mb-8 text-text-2 [text-wrap:balance]">
              Bring your workouts, records and body weight from Hevy or Strong. Overload carries on
              from your last session, with every chart and record built from your full history.
            </p>
            <div role="radiogroup" aria-label="Import from" className="flex flex-col gap-2">
              {(['hevy', 'strong'] as const).map((s) => (
                <OptionCard
                  key={s}
                  title={APPS[s].name}
                  description={s === 'hevy' ? 'Workouts and measurements' : 'Workouts'}
                  icon={<History />}
                  selected={source === s}
                  onSelect={() => setSource(s)}
                />
              ))}
            </div>
            <ul className="mt-6 flex flex-col gap-2.5">
              {[
                'Every set, rep and weight, with warm-ups and drop sets kept apart.',
                'Your exercises matched to Overload’s, and the rest kept as your own.',
                'Nothing is saved until you have checked it.',
              ].map((line) => (
                <li key={line} className="type-meta flex gap-2.5 text-text-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col gap-2 pt-8">
              <PrimaryButton block onClick={() => setStep('files')}>
                Continue with {APPS[source].name}
              </PrimaryButton>
              {welcome ? (
                <SecondaryButton block onClick={() => navigate(next, { replace: true })}>
                  I am new, start fresh
                </SecondaryButton>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === 'files' ? (
          <section aria-labelledby="files-title" className="mt-4 flex flex-1 flex-col">
            <h1 id="files-title" className="type-display text-text-1 [text-wrap:balance]">
              Export from {APPS[source].name}
            </h1>
            <ol className="mt-6 flex flex-col gap-3">
              {APPS[source].how.map((line, i) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="type-caption tabular inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-dim font-semibold text-text-1">
                    {i + 1}
                  </span>
                  <span className="type-body text-text-1">{line}</span>
                </li>
              ))}
            </ol>
            {source === 'strong' ? (
              <SegmentedControl
                label="Weights in Strong were in"
                value={strongUnit}
                options={[
                  { value: 'kg', label: 'kg' },
                  { value: 'lb', label: 'lb' },
                ]}
                onChange={setStrongUnit}
                className="mt-6"
              />
            ) : null}
            <p className="type-meta mt-6 text-text-2">{APPS[source].files}</p>
            {error ? (
              <InlineNotice tone="warning" className="mt-4">
                {error}
              </InlineNotice>
            ) : null}
            <div className="mt-auto pt-8">
              <input
                id={fileInput}
                type="file"
                accept=".csv,text/csv,text/comma-separated-values,application/vnd.ms-excel"
                multiple={source === 'hevy'}
                onChange={(e) => void onFiles(e)}
                className="sr-only"
                aria-label={`${APPS[source].name} export file`}
              />
              <label
                htmlFor={fileInput}
                className="pressable chrome type-headline flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-field bg-lime text-on-lime"
                aria-busy={busy}
              >
                <FileUp className="size-5" aria-hidden />
                {busy ? 'Reading...' : source === 'hevy' ? 'Choose files' : 'Choose file'}
              </label>
            </div>
          </section>
        ) : null}

        {step === 'review' && plan ? (
          <Review
            plan={plan}
            source={source}
            choices={choices}
            exercises={exercises}
            onChoice={(name, c) => setChoices((prev) => ({ ...prev, [name]: c }))}
            makeRoutine={makeRoutine}
            onMakeRoutine={setMakeRoutine}
            busy={busy}
            error={error}
            onImport={() => void runImport()}
          />
        ) : null}

        {step === 'done' && result ? (
          <Done
            result={result}
            source={source}
            firstWorkout={plan?.firstWorkout ?? null}
            welcome={welcome}
            onContinue={() => navigate(next, { replace: true })}
            onProgress={() => navigate('/progress?range=all', { replace: true })}
          />
        ) : null}
      </div>
    </div>
  );
}

function Review({
  plan,
  source,
  choices,
  exercises,
  onChoice,
  makeRoutine,
  onMakeRoutine,
  busy,
  error,
  onImport,
}: {
  plan: ImportPlan;
  source: ImportSource;
  choices: Record<string, ExerciseChoice>;
  exercises: Exercise[];
  onChoice: (name: string, choice: ExerciseChoice) => void;
  makeRoutine: boolean;
  onMakeRoutine: (on: boolean) => void;
  busy: boolean;
  error: string | null;
  onImport: () => void;
}) {
  const library = exercises.filter((e) => !e.isCustom).sort((a, b) => a.name.localeCompare(b.name));
  const yours = exercises.filter((e) => e.isCustom).sort((a, b) => a.name.localeCompare(b.name));
  const matched = plan.exercises.filter((e) => e.reason !== 'new').length;

  return (
    <section aria-labelledby="review-title" className="mt-4 flex flex-1 flex-col">
      <h1 id="review-title" className="type-display text-text-1 [text-wrap:balance]">
        Check before importing
      </h1>
      <p className="type-body mt-2 text-text-2">
        From your {APPS[source].name} export. Nothing is saved yet.
      </p>

      <Card className="mt-6">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dd className="type-stat tabular text-text-1">{plan.workouts}</dd>
            <dt className="type-meta text-text-2">
              {plan.workouts === 1 ? 'workout' : 'workouts'}
            </dt>
          </div>
          <div>
            <dd className="type-stat tabular text-text-1">{plan.sets.toLocaleString('en-IN')}</dd>
            <dt className="type-meta text-text-2">sets</dt>
          </div>
        </dl>
        {plan.firstWorkout && plan.lastWorkout ? (
          <p className="type-meta tabular mt-4 text-text-2">
            {formatCalendarDate(plan.firstWorkout)} to {formatCalendarDate(plan.lastWorkout)}
          </p>
        ) : null}
        {plan.bodyEntries > 0 ? (
          <p className="type-meta mt-1 text-text-2">
            Plus{' '}
            {pluralize(
              plan.bodyEntries,
              'body weight and measurement entry',
              'body weight and measurement entries',
            )}
            .
          </p>
        ) : null}
      </Card>

      {plan.routine && plan.routine.days.length > 0 ? (
        <RoutinePreview
          routine={plan.routine}
          source={source}
          on={makeRoutine}
          onChange={onMakeRoutine}
        />
      ) : null}

      {plan.exercises.length > 0 ? (
        <>
          <h2 className="type-title mt-8 text-text-1">Your exercises</h2>
          <p className="type-meta mt-1 text-text-2">
            {matched} of {plan.exercises.length} matched to Overload’s library, so their records,
            strength levels and muscle sets work straight away. The rest are kept as your own.
            Change any of them below.
          </p>
          <ul className="mt-4 flex flex-col gap-2" aria-label="Exercises to import">
            {plan.exercises.map((ex) => (
              <ExerciseRow
                key={ex.name}
                name={ex.name}
                sets={ex.sets}
                suggestion={ex.choice}
                choice={choices[ex.name] ?? ex.choice}
                library={library}
                yours={yours}
                onChange={(c) => onChoice(ex.name, c)}
              />
            ))}
          </ul>
        </>
      ) : null}

      {error ? (
        <InlineNotice tone="warning" className="mt-4">
          {error}
        </InlineNotice>
      ) : null}
      <div className="sticky bottom-0 mt-6 bg-bg pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <PrimaryButton block loading={busy} onClick={onImport}>
          {plan.workouts > 0
            ? `Import ${pluralize(plan.workouts, 'workout')}`
            : 'Import body weight'}
        </PrimaryButton>
      </div>
    </section>
  );
}

const CUSTOM = 'custom';

function ExerciseRow({
  name,
  sets,
  suggestion,
  choice,
  library,
  yours,
  onChange,
}: {
  name: string;
  sets: number;
  suggestion: ExerciseChoice;
  choice: ExerciseChoice;
  library: Exercise[];
  yours: Exercise[];
  onChange: (c: ExerciseChoice) => void;
}) {
  const selectId = useId();
  const muscleId = useId();
  const inferred = suggestion.kind === 'custom' ? suggestion.exercise : null;
  const value = choice.kind === 'existing' ? choice.exerciseId : CUSTOM;
  const current =
    choice.kind === 'existing'
      ? [...library, ...yours].find((e) => e.id === choice.exerciseId)
      : null;

  return (
    <li className="rounded-nested bg-surface-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="type-headline min-w-0 break-words text-text-1">{name}</p>
        <span className="type-meta tabular shrink-0 text-text-2">{pluralize(sets, 'set')}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {choice.kind === 'existing' ? (
          <Badge tone="lime" icon={<Sparkles />}>
            Matched
          </Badge>
        ) : (
          <Badge>Your own</Badge>
        )}
        <label htmlFor={selectId} className="sr-only">
          What {name} becomes in Overload
        </label>
        <select
          id={selectId}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === CUSTOM) {
              onChange({
                kind: 'custom',
                exercise: inferred ?? {
                  name,
                  primaryMuscle: current?.primaryMuscle ?? 'chest',
                  equipment: current?.equipment ?? 'other',
                  category: current?.category ?? 'isolation',
                  trackingType: current?.trackingType ?? 'weight_reps',
                  loadMode: current?.loadMode ?? 'total',
                },
              });
            } else onChange({ kind: 'existing', exerciseId: v });
          }}
          className="type-meta min-w-0 flex-1 truncate rounded-field border border-border bg-surface px-2 py-1.5 text-text-1"
        >
          <option value={CUSTOM}>Keep as my own exercise</option>
          {yours.length > 0 ? (
            <optgroup label="Your exercises">
              {yours.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Overload library">
            {library.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      {choice.kind === 'custom' ? (
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor={muscleId} className="type-meta text-text-2">
            Main muscle
          </label>
          <select
            id={muscleId}
            value={choice.exercise.primaryMuscle}
            onChange={(e) =>
              onChange({
                kind: 'custom',
                exercise: { ...choice.exercise, primaryMuscle: e.target.value as MuscleGroup },
              })
            }
            className="type-meta rounded-field border border-border bg-surface px-2 py-1.5 text-text-1"
          >
            {MUSCLE_GROUPS.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </li>
  );
}

function Done({
  result,
  source,
  firstWorkout,
  welcome,
  onContinue,
  onProgress,
}: {
  result: ImportResult;
  source: ImportSource;
  firstWorkout: Date | null;
  welcome: boolean;
  onContinue: () => void;
  onProgress: () => void;
}) {
  const anything =
    result.workoutsAdded + result.bodyWeightsAdded + result.measurementsAdded > 0 ||
    result.routine !== null;
  return (
    <section aria-labelledby="done-title" className="mt-4 flex flex-1 flex-col">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-lime-dim text-lime">
        <Check className="size-6" aria-hidden />
      </span>
      <h1 id="done-title" className="type-display mt-5 text-text-1 [text-wrap:balance]">
        {anything ? 'Your history is in' : 'Already imported'}
      </h1>
      <p className="type-body mt-2 text-text-2 [text-wrap:balance]">
        {anything
          ? `Everything from ${APPS[source].name} is now part of Overload${firstWorkout && result.workoutsAdded > 0 ? `, back to ${formatCalendarDate(firstWorkout)}` : ''}. Your next workout carries on from here.`
          : `These ${APPS[source].name} workouts were imported before, so nothing was added twice.`}
      </p>
      <Card className="mt-6">
        <ul className="flex flex-col gap-2">
          {[
            result.workoutsAdded > 0
              ? `${pluralize(result.workoutsAdded, 'workout')} and ${pluralize(result.setsAdded, 'set')} added`
              : null,
            result.exercisesCreated > 0
              ? `${pluralize(result.exercisesCreated, 'exercise')} of your own created`
              : null,
            result.bodyWeightsAdded > 0
              ? `${pluralize(result.bodyWeightsAdded, 'weigh-in')} added`
              : null,
            result.measurementsAdded > 0
              ? `${pluralize(result.measurementsAdded, 'set of measurements', 'sets of measurements')} added`
              : null,
            result.routine
              ? `Your routine, ${result.routine.name}, set up with ${pluralize(result.routine.days, 'day')}${result.routine.active ? ' and ready on Home' : ' under Routines'}`
              : null,
            result.workoutsSkipped > 0
              ? `${pluralize(result.workoutsSkipped, 'workout')} already here, left as they were`
              : null,
            result.dropped > 0
              ? `${pluralize(result.dropped, 'entry', 'entries')} left out because a value was impossible`
              : null,
          ]
            .filter((l): l is string => l !== null)
            .map((line) => (
              <li key={line} className="type-meta flex gap-2.5 text-text-1">
                <Check className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
                {line}
              </li>
            ))}
        </ul>
      </Card>
      <div className="mt-auto flex flex-col gap-2 pt-8">
        {welcome ? (
          <PrimaryButton block onClick={onContinue}>
            Continue setting up
          </PrimaryButton>
        ) : (
          <>
            <PrimaryButton block onClick={onProgress}>
              See my progress
            </PrimaryButton>
            <SecondaryButton block onClick={onContinue}>
              Done
            </SecondaryButton>
          </>
        )}
      </div>
    </section>
  );
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The routine rebuilt from recent workouts, created along with the import unless turned off. */
function RoutinePreview({
  routine,
  source,
  on,
  onChange,
}: {
  routine: InferredRoutine;
  source: ImportSource;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const titleId = useId();
  return (
    <Card as="section" className="mt-4" aria-labelledby={titleId}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="type-meta text-text-2">Your routine</p>
          <h2 id={titleId} className="type-title mt-0.5 break-words text-text-1">
            {routine.name}
          </h2>
        </div>
        <Switch checked={on} onChange={onChange} aria-label="Create this routine" />
      </div>
      <p className="type-meta mt-2 text-text-2">
        Rebuilt from your last {ROUTINE_WINDOW_DAYS / 7} weeks in {APPS[source].name}: each day with
        its exercises, sets and rep ranges, planned on the days you usually trained it. Your next
        workout starts from it, and you can edit it any time.
      </p>
      {on ? (
        <ul className="mt-4 flex flex-col gap-2" aria-label="Days in this routine">
          {routine.days.map((d) => (
            <li key={d.title} className="rounded-nested bg-surface-2 px-4 py-3">
              <p className="type-headline break-words text-text-1">{d.name}</p>
              <p className="type-meta tabular mt-0.5 text-text-2">
                {pluralize(d.slots.length, 'exercise')} ·{' '}
                {d.weekdays.length > 0
                  ? d.weekdays.map((w) => WEEKDAY_SHORT[w]).join(', ')
                  : 'no fixed day'}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
