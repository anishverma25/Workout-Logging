import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Armchair,
  Briefcase,
  ChevronLeft,
  Dumbbell,
  Footprints,
  Hammer,
  Home,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { APP_NAME } from '@/app/navigation';
import {
  NumberField,
  OptionCard,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  StatTile,
  TextField,
  TextLink,
} from '@/components/kit';
// The kit control gives no tab stop while nothing is selected, and sex starts unanswered.
import { SegmentedControl as OptionalSegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { activeRoutine } from '@/domain/analytics/schedule';
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
  Routine,
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
  // A routine brought over from Hevy or Strong is already the plan: setup does not offer
  // another one on top of it.
  const current = activeRoutine(training.data.routines);
  const imported = current && current.description?.startsWith('Imported from') ? current : null;
  return <SetupFlow own={own} latestKg={latestKg ?? null} imported={imported} />;
}

function SetupFlow({
  own,
  latestKg,
  imported,
}: {
  own: Profile | null;
  latestKg: number | null;
  imported: Routine | null;
}) {
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
      toast(imported ? 'You are all set' : 'Profile saved');
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : 'Could not save. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg pt-safe">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-safe">
        <header className="chrome flex h-14 items-center justify-between gap-3">
          {index > 0 ? (
            <button
              type="button"
              onClick={() => go(-1)}
              className="pressable tap-target type-body -ml-2 inline-flex h-11 items-center gap-0.5 rounded-field pr-2 font-medium text-text-1"
            >
              <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden />
              Back
            </button>
          ) : (
            <span className="type-headline text-text-1">{APP_NAME}</span>
          )}
          {step !== 'plan' && step !== 'name' ? (
            <TextLink onClick={() => go(1)} className="px-2">
              Skip
            </TextLink>
          ) : (
            <TextLink onClick={() => navigate(next, { replace: true })} className="px-2">
              {own ? 'Cancel' : 'Not now'}
            </TextLink>
          )}
        </header>

        <div
          className="mt-1 flex gap-1"
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
                'h-1 flex-1 rounded-full transition-colors duration-[var(--dur-move)]',
                i <= index ? 'bg-lime' : 'bg-track',
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
              <p className="type-meta mb-2 text-text-2">Days a week</p>
              <NumberPicker
                label="Days a week"
                values={[2, 3, 4, 5, 6, 7]}
                value={draft.trainingDays}
                onChange={(v) => set('trainingDays', v)}
              />
              <p className="type-meta mt-8 mb-2 text-text-2">Time per session</p>
              <WheelPicker
                label="Minutes per session"
                values={SESSION_MINUTES}
                value={draft.sessionMinutes ?? DEFAULT_SESSION}
                onChange={(v) => set('sessionMinutes', v)}
                unit="min"
              />
              <p className="type-meta mt-2 text-center text-text-2">
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
                  <p className="type-meta mb-2 text-text-2">Sex</p>
                  <OptionalSegmentedControl<Sex>
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
                    <p className="type-meta text-text-2">Height</p>
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
              imported={imported}
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
            <p role="alert" className="type-meta mt-4 text-danger-text">
              {error}
            </p>
          ) : null}

          <div className="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 bg-bg pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {step === 'plan' && imported ? (
              <PrimaryButton block disabled={busy} onClick={() => void finish(false)}>
                {busy ? 'Saving...' : 'Save and start training'}
              </PrimaryButton>
            ) : step === 'plan' && !guided ? (
              <>
                <PrimaryButton block disabled={busy} onClick={() => void finish('blank')}>
                  {busy ? 'Saving...' : 'Build my routine'}
                </PrimaryButton>
                <SecondaryButton block disabled={busy} onClick={() => void finish(false)}>
                  Save, I will set it up later
                </SecondaryButton>
              </>
            ) : step === 'plan' ? (
              <>
                {templateKey ? (
                  <PrimaryButton block disabled={busy} onClick={() => void finish(true)}>
                    {busy ? 'Saving...' : 'Create my routine'}
                  </PrimaryButton>
                ) : null}
                {templateKey ? (
                  <SecondaryButton block disabled={busy} onClick={() => void finish(false)}>
                    Save, I will pick a routine later
                  </SecondaryButton>
                ) : (
                  <PrimaryButton block disabled={busy} onClick={() => void finish(false)}>
                    Save and finish
                  </PrimaryButton>
                )}
              </>
            ) : (
              <PrimaryButton block disabled={!canContinue} onClick={() => go(1)}>
                Continue
              </PrimaryButton>
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
      <h1 id="setup-question" tabIndex={-1} className="type-display text-text-1 outline-none">
        {title}
      </h1>
      <p className="type-body mt-2 mb-8 text-text-2 [text-wrap:balance]">{usedFor}</p>
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
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <OptionCard
            key={o.value}
            title={o.label}
            description={o.detail}
            icon={Icon ? <Icon /> : undefined}
            selected={value === o.value}
            onSelect={() => onChange(o.value)}
          />
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
              'pressable chrome flex min-h-14 flex-col items-center justify-center rounded-nested',
              selected ? 'bg-text-1 text-bg' : 'bg-surface-2 text-text-1',
            )}
          >
            <span className="type-title tabular">{v}</span>
            {suffix ? (
              <span className={cn('type-caption', selected ? 'text-bg/75' : 'text-text-2')}>
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
  imported,
  templateKey,
  onChoose,
  planOptions,
}: {
  name: string;
  goal: Goal;
  experience: Experience;
  energy: ReturnType<typeof energyPlan>;
  recommendation: ReturnType<typeof recommendProgram>;
  imported: Routine | null;
  templateKey: string | null;
  onChoose: (key: string) => void;
  planOptions: Parameters<typeof personalizeTemplate>[1];
}) {
  const options = recommendation ? [recommendation.template, ...recommendation.alternatives] : [];
  const picked = options.find((t) => t.key === templateKey) ?? null;
  const preview = picked ? personalizeTemplate(picked, planOptions) : null;
  return (
    <section aria-labelledby="setup-question">
      <h1 id="setup-question" tabIndex={-1} className="type-display text-text-1 outline-none">
        {name ? `${name.split(/\s+/)[0]}, here is your plan` : 'Here is your plan'}
      </h1>
      <p className="type-body mt-2 text-text-2 [text-wrap:balance]">
        {GOAL_LABEL[goal]}, {EXPERIENCE_LABEL[experience].toLowerCase()}. Change any of it later in
        your profile.
      </p>

      {energy ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <StatTile
            label="Daily calories"
            value={energy.targetKcal.toLocaleString('en-GB')}
            unit="kcal"
            caption={
              energy.adjustment === 0
                ? 'Your maintenance'
                : `Maintenance ${energy.tdee.toLocaleString('en-GB')}, ${energy.adjustment > 0 ? '+' : '−'}${Math.round(Math.abs(energy.adjustment) * 100)}% for your goal`
            }
          />
          <StatTile
            label="Protein"
            value={`${energy.proteinG[0].toFixed(1)} to ${energy.proteinG[1].toFixed(1)}`}
            unit="g"
            caption="A day, spread over meals"
          />
        </div>
      ) : (
        <p className="type-meta mt-6 rounded-nested bg-surface-2 px-4 py-3 text-text-2">
          Add your sex, birth date, height and weight in your profile to see daily calories and
          protein worked out for you.
        </p>
      )}

      {imported ? (
        <div className="mt-6 rounded-panel border border-border bg-surface p-5">
          <p className="type-meta text-text-2">Your routine</p>
          <h2 className="type-title mt-0.5 break-words text-text-1">{imported.name}</h2>
          <p className="type-body mt-2 text-text-2">
            {imported.description}, with your days, exercises and sets as you left them. Your next
            workout starts from it, with last time&rsquo;s numbers ready. Change it any time under
            Routines.
          </p>
        </div>
      ) : experience !== 'beginner' ? (
        <div className="mt-6 rounded-panel border border-border bg-surface p-5">
          <h2 className="type-title text-text-1">Bring your own split</h2>
          <p className="type-body mt-2 text-text-2">
            At an {EXPERIENCE_LABEL[experience].toLowerCase()} level you most likely train to a
            routine that already works for you, so we will not swap it for ours. Set it up once, day
            by day, and every session after that opens with last time&rsquo;s numbers ready.
          </p>
          <p className="type-meta mt-3 text-text-2">
            Prefer a starting point? Every template is still under Routines.
          </p>
        </div>
      ) : recommendation ? (
        <div className="mt-6">
          <h2 className="type-title mb-3 text-text-1">Recommended routine</h2>
          <div role="radiogroup" aria-label="Routine" className="flex flex-col gap-2">
            {options.map((t, i) => (
              <OptionCard
                key={t.key}
                title={t.name}
                description={`${i === 0 ? 'Best fit' : `${t.daysPerWeek} days`} · ${
                  i === 0 ? recommendation.reason : t.summary
                }`}
                selected={t.key === templateKey}
                onSelect={() => onChoose(t.key)}
              />
            ))}
          </div>
          {preview ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Days in this routine">
              {preview.days.map((d) => (
                <li
                  key={d.name}
                  className="type-meta rounded-full bg-surface-2 px-3 py-1.5 text-text-2"
                >
                  {d.name} · {d.exercises.length} exercises
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="type-meta mt-6 rounded-nested bg-surface-2 px-4 py-3 text-text-2">
          Tell us how many days you can train to get a routine recommendation.
        </p>
      )}
    </section>
  );
}
