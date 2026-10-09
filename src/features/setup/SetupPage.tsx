import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Armchair,
  Briefcase,
  Check,
  ChevronLeft,
  Dumbbell,
  Footprints,
  Hammer,
  Home,
  Info,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { APP_NAME } from '@/app/navigation';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Fields';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { recommendProgram, personalizeTemplate } from '@/data/library/programs';
import { addBodyWeight } from '@/data/repositories/bodyweight';
import { ProfileError, saveProfile } from '@/data/repositories/profile';
import {
  createBlankRoutine,
  createRoutineFromTemplate,
  setActiveRoutine,
} from '@/data/repositories/routines';
import { energyPlan } from '@/domain/analytics/body';
import { EXPERIENCE_LABEL, GOAL_DETAIL, GOAL_LABEL } from '@/domain/models/labels';
import type {
  DailyActivity,
  Experience,
  Goal,
  GymAccess,
  Profile,
  Sex,
} from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { BirthDateField } from '@/components/ui/BirthDateField';
import { WheelPicker } from '@/components/ui/WheelPicker';
import { DEFAULT_SESSION, SESSION_MINUTES } from '@/domain/models/labels';
import { ageFromBirthDate, toDateKey } from '@/lib/dates';
import { fromDisplayWeight } from '@/lib/units';
import { CM_PER_INCH } from '@/data/repositories/measurements';

interface Draft {
  name: string;
  goal: Goal | null;
  experience: Experience | null;
  trainingDays: number | null;
  sessionMinutes: number | null;
  equipment: GymAccess | null;
  sex: Sex | null;
  birthDate: string;
  heightCm: number | null;
  weight: number | null;
  dailyActivity: DailyActivity | null;
}

const STEPS = [
  'name',
  'goal',
  'experience',
  'schedule',
  'equipment',
  'body',
  'activity',
  'plan',
] as const;
type Step = (typeof STEPS)[number];

const GOAL_ORDER: Goal[] = [
  'hypertrophy',
  'strength',
  'strength_hypertrophy',
  'fat_loss',
  'recomposition',
  'general_fitness',
];

const EXPERIENCE_DETAIL: Record<Experience, string> = {
  beginner: 'Less than a year of regular lifting.',
  intermediate: 'One to three years. Progress now takes weeks, not sessions.',
  advanced: 'Three years or more. Progress takes planning.',
};

const EQUIPMENT: { value: GymAccess; label: string; detail: string; icon: LucideIcon }[] = [
  {
    value: 'full_gym',
    label: 'Full gym',
    detail: 'Barbells, machines, cables and dumbbells.',
    icon: Warehouse,
  },
  {
    value: 'dumbbells',
    label: 'Dumbbells and a bench',
    detail: 'A home setup or the free-weight corner of a gym.',
    icon: Dumbbell,
  },
  {
    value: 'home',
    label: 'Body weight at home',
    detail: 'No weights. A pull-up bar helps if you have one.',
    icon: Home,
  },
];

const ACTIVITY: { value: DailyActivity; label: string; detail: string; icon: LucideIcon }[] = [
  {
    value: 'sitting',
    label: 'Mostly sitting',
    detail: 'Desk work or study, little walking.',
    icon: Armchair,
  },
  {
    value: 'mixed',
    label: 'Some walking',
    detail: 'A mix of sitting and moving around.',
    icon: Briefcase,
  },
  {
    value: 'on_feet',
    label: 'On my feet',
    detail: 'Standing or walking most of the day.',
    icon: Footprints,
  },
  {
    value: 'physical',
    label: 'Physical work',
    detail: 'Lifting, carrying or labour most of the day.',
    icon: Hammer,
  },
];

/** Why each question is asked, shown under it. */
const USED_FOR: Record<Step, string> = {
  name: 'Used to greet you. Nothing else.',
  goal: 'Sets your rep ranges, rest times and daily calories.',
  experience: 'Sets how many sets you do and how you add weight.',
  schedule: 'Picks your split and sizes each session to fit.',
  equipment: 'Swaps exercises for ones you can do with what you have.',
  body: 'Used by the energy, BMI and strength formulas. Optional: skip anything you prefer not to share.',
  activity: 'Sets the activity factor in your daily energy.',
  plan: '',
};

/**
 * First-time setup: one question per screen, each one skippable except the name. Saves
 * everything at the end, so leaving halfway changes nothing.
 */
export function SetupPage() {
  const training = useTrainingData();
  if (training.status !== 'success') return <div className="min-h-dvh bg-bg" aria-busy="true" />;
  const own = training.data.profile?.origin === 'user' ? training.data.profile : null;
  const latestKg = training.data.bodyWeights
    .filter((b) => b.origin === 'user')
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0]?.weightKg;
  return <SetupFlow own={own} latestKg={latestKg ?? null} />;
}

function SetupFlow({ own, latestKg }: { own: Profile | null; latestKg: number | null }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const toast = useToast();
  const prefs = usePreferences();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [feet, setFeet] = useState<number | null>(null);
  const [inches, setInches] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(() => ({
    name: own?.displayName ?? '',
    goal: own?.goal ?? null,
    experience: own?.experience ?? null,
    trainingDays: own?.trainingDays ?? null,
    sessionMinutes: own?.sessionMinutes ?? DEFAULT_SESSION,
    equipment: own?.equipment ?? null,
    sex: own?.sex ?? null,
    birthDate: own?.birthDate ?? '',
    heightCm: own?.heightCm ?? null,
    weight: null,
    dailyActivity: own?.dailyActivity ?? null,
  }));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const step = STEPS[index]!;
  useEffect(() => {
    document.getElementById('setup-question')?.focus();
  }, [index]);

  const weightKg =
    draft.weight !== null ? fromDisplayWeight(draft.weight, prefs.weightUnit) : latestKg;
  const goal = draft.goal ?? 'strength_hypertrophy';
  const experience = draft.experience ?? 'beginner';

  // Only beginners get a recommended routine. Intermediate and advanced lifters usually have a
  // split they trust, so they are offered a blank routine to enter it instead.
  const guided = experience === 'beginner';
  const recommendation = useMemo(
    () =>
      guided && draft.trainingDays
        ? recommendProgram({ trainingDays: draft.trainingDays, experience, goal })
        : null,
    [guided, draft.trainingDays, experience, goal],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const templateKey = chosen ?? recommendation?.template.key ?? null;

  const energy = energyPlan({
    sex: draft.sex,
    age: draft.birthDate ? ageFromBirthDate(draft.birthDate) : null,
    heightCm: draft.heightCm,
    weightKg,
    bodyFatPct: null,
    goal,
    dailyActivity: draft.dailyActivity,
    plannedDays: draft.trainingDays,
    loggedDaysPerWeek: null,
    sessionMinutes: draft.sessionMinutes,
  });

  const canContinue = step !== 'name' || draft.name.trim().length > 0;
  const go = (delta: 1 | -1) => {
    setError(null);
    setIndex((i) => Math.min(Math.max(i + delta, 0), STEPS.length - 1));
  };

  async function finish(createRoutine: boolean | 'blank') {
    setBusy(true);
    setError(null);
    try {
      await saveProfile(db, {
        displayName: draft.name,
        birthDate: draft.birthDate || null,
        goal,
        experience,
        sex: draft.sex,
        heightCm: draft.heightCm,
        trainingDays: draft.trainingDays,
        sessionMinutes: draft.sessionMinutes,
        equipment: draft.equipment,
        dailyActivity: draft.dailyActivity,
      });
      if (draft.weight !== null) {
        await addBodyWeight(db, {
          weight: draft.weight,
          unit: prefs.weightUnit,
          date: toDateKey(new Date()),
          note: null,
        });
      }
      if (createRoutine === 'blank') {
        const routine = await createBlankRoutine(db, draft.trainingDays ?? 3);
        await setActiveRoutine(db, routine.id);
        toast('Add your exercises to each day');
        navigate(`/routines/${routine.id}`, { replace: true });
        return;
      }
      if (createRoutine && templateKey) {
        const routine = await createRoutineFromTemplate(db, templateKey, undefined, {
          goal,
          experience,
          equipment: draft.equipment,
          sessionMinutes: draft.sessionMinutes,
        });
        await setActiveRoutine(db, routine.id);
        toast('Your plan is ready');
        navigate(`/routines/${routine.id}`, { replace: true });
        return;
      }
      toast('Profile saved');
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : 'Could not save. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg pt-safe">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-safe pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <header className="flex h-14 items-center justify-between gap-3">
          {index > 0 ? (
            <button
              type="button"
              onClick={() => go(-1)}
              className="tap-target -ml-2 inline-flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 font-medium text-accent-text"
            >
              <ChevronLeft className="size-5" aria-hidden />
              Back
            </button>
          ) : (
            <span className="font-display text-[1.05rem] font-semibold">{APP_NAME}</span>
          )}
          {step !== 'plan' && step !== 'name' ? (
            <button
              type="button"
              onClick={() => go(1)}
              className="tap-target rounded-full px-3 py-2 font-medium text-faint hover:text-text"
            >
              Skip
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(next, { replace: true })}
              className="tap-target rounded-full px-3 py-2 font-medium text-faint hover:text-text"
            >
              {own ? 'Cancel' : 'Not now'}
            </button>
          )}
        </header>

        <div
          className="mt-1 flex gap-1.5"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={index + 1}
        >
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i <= index ? 'bg-accent' : 'bg-[var(--seg-track)]',
              )}
            />
          ))}
        </div>

        <main key={step} className="rise-in mt-8 flex flex-1 flex-col">
          {step === 'name' ? (
            <Question title="What should we call you?" usedFor={USED_FOR.name}>
              <TextField
                label="Your name"
                hideLabel
                autoComplete="given-name"
                placeholder="Your name"
                maxLength={60}
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canContinue) go(1);
                }}
              />
            </Question>
          ) : null}

          {step === 'goal' ? (
            <Question title="What is your main goal?" usedFor={USED_FOR.goal}>
              <Options
                label="Goal"
                value={draft.goal}
                onChange={(v) => set('goal', v)}
                options={GOAL_ORDER.map((g) => ({
                  value: g,
                  label: GOAL_LABEL[g],
                  detail: GOAL_DETAIL[g],
                }))}
              />
            </Question>
          ) : null}

          {step === 'experience' ? (
            <Question title="How long have you been lifting?" usedFor={USED_FOR.experience}>
              <Options
                label="Experience"
                value={draft.experience}
                onChange={(v) => set('experience', v)}
                options={(['beginner', 'intermediate', 'advanced'] as const).map((e) => ({
                  value: e,
                  label: EXPERIENCE_LABEL[e],
                  detail: EXPERIENCE_DETAIL[e],
                }))}
              />
            </Question>
          ) : null}

          {step === 'schedule' ? (
            <Question title="How often can you train?" usedFor={USED_FOR.schedule}>
              <p className="mb-2.5 text-sm font-medium text-muted">Days a week</p>
              <NumberPicker
                label="Days a week"
                values={[2, 3, 4, 5, 6, 7]}
                value={draft.trainingDays}
                onChange={(v) => set('trainingDays', v)}
              />
              <p className="mb-2.5 mt-7 text-sm font-medium text-muted">Time per session</p>
              <WheelPicker
                label="Minutes per session"
                values={SESSION_MINUTES}
                value={draft.sessionMinutes ?? DEFAULT_SESSION}
                onChange={(v) => set('sessionMinutes', v)}
                unit="min"
              />
              <p className="mt-2 text-center text-sm text-faint">
                Scroll to choose, in 5 minute steps. Include warm-up and rests.
              </p>
            </Question>
          ) : null}

          {step === 'equipment' ? (
            <Question title="Where do you train?" usedFor={USED_FOR.equipment}>
              <Options
                label="Equipment"
                value={draft.equipment}
                onChange={(v) => set('equipment', v)}
                options={EQUIPMENT}
              />
            </Question>
          ) : null}

          {step === 'body' ? (
            <Question title="A little about you" usedFor={USED_FOR.body}>
              <div className="flex flex-col gap-6">
                <div>
                  <p className="mb-2.5 text-sm font-medium text-muted">Sex</p>
                  <SegmentedControl<Sex>
                    label="Sex"
                    value={draft.sex ?? ('' as Sex)}
                    onChange={(v) => set('sex', v)}
                    options={[
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'unspecified', label: 'Prefer not to say' },
                    ]}
                  />
                </div>
                <BirthDateField value={draft.birthDate} onChange={(v) => set('birthDate', v)} />
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-sm font-medium text-muted">Height</p>
                    <SegmentedControl
                      label="Height unit"
                      value={heightUnit}
                      onChange={(u) => setHeightUnit(u)}
                      options={[
                        { value: 'cm', label: 'cm' },
                        { value: 'ft', label: 'ft, in' },
                      ]}
                    />
                  </div>
                  {heightUnit === 'cm' ? (
                    <NumberField
                      label="Height in centimetres"
                      hideLabel
                      unit="cm"
                      value={draft.heightCm}
                      min={100}
                      max={250}
                      onValueChange={(v) => set('heightCm', v)}
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        label="Feet"
                        hideLabel
                        unit="ft"
                        allowDecimal={false}
                        value={feet}
                        min={3}
                        max={8}
                        onValueChange={(v) => {
                          setFeet(v);
                          set('heightCm', toCm(v, inches));
                        }}
                      />
                      <NumberField
                        label="Inches"
                        hideLabel
                        unit="in"
                        value={inches}
                        min={0}
                        max={11.9}
                        onValueChange={(v) => {
                          setInches(v);
                          set('heightCm', toCm(feet, v));
                        }}
                      />
                    </div>
                  )}
                </div>
                <NumberField
                  label={latestKg ? 'Weight today (optional)' : 'Weight'}
                  unit={prefs.weightUnit}
                  value={draft.weight}
                  min={prefs.weightUnit === 'kg' ? 20 : 44}
                  max={prefs.weightUnit === 'kg' ? 400 : 880}
                  onValueChange={(v) => set('weight', v)}
                />
              </div>
            </Question>
          ) : null}

          {step === 'activity' ? (
            <Question title="Outside the gym, your day is" usedFor={USED_FOR.activity}>
              <Options
                label="Daily activity"
                value={draft.dailyActivity}
                onChange={(v) => set('dailyActivity', v)}
                options={ACTIVITY}
              />
            </Question>
          ) : null}

          {step === 'plan' ? (
            <PlanSummary
              name={draft.name.trim()}
              goal={goal}
              experience={experience}
              energy={energy}
              recommendation={recommendation}
              templateKey={templateKey}
              onChoose={setChosen}
              planOptions={{
                goal,
                experience,
                equipment: draft.equipment,
                sessionMinutes: draft.sessionMinutes,
              }}
            />
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-auto flex flex-col gap-2 pt-8">
            {step === 'plan' && !guided ? (
              <>
                <Button size="lg" block disabled={busy} onClick={() => void finish('blank')}>
                  {busy ? 'Saving...' : 'Build my routine'}
                </Button>
                <Button
                  size="lg"
                  block
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void finish(false)}
                >
                  Save, I will set it up later
                </Button>
              </>
            ) : step === 'plan' ? (
              <>
                {templateKey ? (
                  <Button size="lg" block disabled={busy} onClick={() => void finish(true)}>
                    {busy ? 'Saving...' : 'Create my routine'}
                  </Button>
                ) : null}
                <Button
                  size="lg"
                  block
                  variant={templateKey ? 'secondary' : 'primary'}
                  disabled={busy}
                  onClick={() => void finish(false)}
                >
                  {templateKey ? 'Save, I will pick a routine later' : 'Save and finish'}
                </Button>
              </>
            ) : (
              <Button size="lg" block disabled={!canContinue} onClick={() => go(1)}>
                Continue
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

const toCm = (feet: number | null, inches: number | null) =>
  feet === null ? null : Math.round((feet * 12 + (inches ?? 0)) * CM_PER_INCH * 10) / 10;

function Question({
  title,
  usedFor,
  children,
}: {
  title: string;
  usedFor: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby="setup-question">
      <h1
        id="setup-question"
        tabIndex={-1}
        className="font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] outline-none"
      >
        {title}
      </h1>
      <p className="mb-7 mt-2.5 flex items-start gap-1.5 text-sm text-faint">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {usedFor}
      </p>
      {children}
    </section>
  );
}

interface Option<T extends string> {
  value: T;
  label: string;
  detail?: string;
  icon?: LucideIcon;
}

/** Big tappable cards, one choice. Tapping the selected one again keeps it selected. */
function Options<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | null;
  onChange: (value: T) => void;
  options: Option<T>[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2.5">
      {options.map((o) => {
        const selected = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex w-full items-center gap-3.5 rounded-[1.1rem] bg-surface px-4 py-3.5 text-left ring-2 transition-[box-shadow,background-color] duration-150 active:scale-[0.99]',
              selected ? 'ring-accent-text' : 'ring-transparent hover:bg-surface-2',
            )}
          >
            {Icon ? (
              <span
                aria-hidden
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] transition-colors',
                  selected ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted',
                )}
              >
                <Icon className="size-5" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug">{o.label}</span>
              {o.detail ? (
                <span className="mt-0.5 block text-sm leading-snug text-faint">{o.detail}</span>
              ) : null}
            </span>
            <span
              aria-hidden
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                selected ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong',
              )}
            >
              {selected ? <Check className="size-3.5" strokeWidth={3.5} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NumberPicker({
  label,
  values,
  value,
  onChange,
  suffix,
}: {
  label: string;
  values: number[];
  value: number | null;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-6 gap-2">
      {values.map((v) => {
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={suffix ? `${v} ${suffix === 'min' ? 'minutes' : suffix}` : String(v)}
            onClick={() => onChange(v)}
            className={cn(
              'flex aspect-square flex-col items-center justify-center rounded-[1rem] transition-colors active:scale-95',
              selected ? 'bg-accent text-accent-ink' : 'bg-surface text-text hover:bg-surface-2',
            )}
          >
            <span className="tabular font-display text-[1.4rem] font-semibold leading-none">
              {v}
            </span>
            {suffix ? (
              <span
                className={cn(
                  'mt-0.5 text-[0.7rem]',
                  selected ? 'text-accent-ink/70' : 'text-faint',
                )}
              >
                {suffix}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function PlanSummary({
  name,
  goal,
  experience,
  energy,
  recommendation,
  templateKey,
  onChoose,
  planOptions,
}: {
  name: string;
  goal: Goal;
  experience: Experience;
  energy: ReturnType<typeof energyPlan>;
  recommendation: ReturnType<typeof recommendProgram>;
  templateKey: string | null;
  onChoose: (key: string) => void;
  planOptions: Parameters<typeof personalizeTemplate>[1];
}) {
  const options = recommendation ? [recommendation.template, ...recommendation.alternatives] : [];
  const picked = options.find((t) => t.key === templateKey) ?? null;
  const preview = picked ? personalizeTemplate(picked, planOptions) : null;
  return (
    <section aria-labelledby="setup-question">
      <h1
        id="setup-question"
        tabIndex={-1}
        className="font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] outline-none"
      >
        {name ? `${name.split(/\s+/)[0]}, here is your plan` : 'Here is your plan'}
      </h1>
      <p className="mt-2.5 text-muted">
        {GOAL_LABEL[goal]}, {EXPERIENCE_LABEL[experience].toLowerCase()}. Change any of it later in
        your profile.
      </p>

      {energy ? (
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <Stat
            label="Daily calories"
            value={energy.targetKcal.toLocaleString()}
            unit="kcal"
            detail={
              energy.adjustment === 0
                ? 'Your maintenance'
                : `Maintenance ${energy.tdee.toLocaleString()}, ${energy.adjustment > 0 ? '+' : '−'}${Math.round(Math.abs(energy.adjustment) * 100)}% for your goal`
            }
          />
          <Stat
            label="Protein"
            value={`${energy.proteinG[0].toFixed(1)}–${energy.proteinG[1].toFixed(1)}`}
            unit="g"
            detail="A day, spread over meals"
          />
        </div>
      ) : (
        <p className="mt-6 rounded-[1rem] bg-surface p-4 text-sm text-muted">
          Add your sex, birth date, height and weight in your profile to see daily calories and
          protein worked out for you.
        </p>
      )}

      {experience !== 'beginner' ? (
        <div className="mt-6 rounded-[1.1rem] bg-surface p-5">
          <h2 className="font-display text-[1.2rem] font-semibold leading-tight">
            Bring your own split
          </h2>
          <p className="mt-1.5 text-muted">
            At an {EXPERIENCE_LABEL[experience].toLowerCase()} level you most likely train to a
            routine that already works for you, so we will not swap it for ours. Set it up once, day
            by day, and every session after that opens with last time&rsquo;s numbers ready.
          </p>
          <p className="mt-3 text-sm text-faint">
            Prefer a starting point? Every template is still under Routines.
          </p>
        </div>
      ) : recommendation ? (
        <div className="mt-6">
          <h2 className="mb-2.5 text-sm font-medium text-muted">Recommended routine</h2>
          <div role="radiogroup" aria-label="Routine" className="flex flex-col gap-2">
            {options.map((t, i) => {
              const selected = t.key === templateKey;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChoose(t.key)}
                  className={cn(
                    'rounded-[1.1rem] bg-surface px-4 py-3.5 text-left ring-2 transition-[box-shadow] duration-150',
                    selected ? 'ring-accent-text' : 'ring-transparent',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{t.name}</span>
                    <span className="shrink-0 text-sm text-faint">
                      {i === 0 ? 'Best fit' : `${t.daysPerWeek} days`}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm text-faint">
                    {i === 0 ? recommendation.reason : t.summary}
                  </span>
                </button>
              );
            })}
          </div>
          {preview ? (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Days in this routine">
              {preview.days.map((d) => (
                <li key={d.name} className="rounded-full bg-surface-2 px-3 py-1 text-sm text-muted">
                  {d.name} · {d.exercises.length} exercises
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Tell us how many days you can train to get a routine recommendation.
        </p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.1rem] bg-surface p-4">
      <p className="text-[0.8125rem] font-medium text-faint">{label}</p>
      <p className="tabular mt-1 font-display text-[1.6rem] font-semibold leading-tight tracking-tight">
        {value}
        <span className="ml-1 text-base font-medium text-faint">{unit}</span>
      </p>
      <p className="mt-0.5 text-xs text-faint">{detail}</p>
    </div>
  );
}
