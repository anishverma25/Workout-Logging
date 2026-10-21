import { useMemo, useState } from 'react';
import { CircleCheck, Pencil } from 'lucide-react';
import {
  BottomSheet,
  Card,
  NumberField,
  PrimaryButton,
  SecondaryButton,
  TextLink,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { ProfileError, saveProfile } from '@/data/repositories/profile';
import type { BodySnapshot } from '@/domain/analytics/body';
import { performanceByExercise } from '@/domain/analytics/performance';
import { buildSessions, type TrainingData } from '@/domain/analytics/sessions';
import { e1rmRate } from '@/domain/analytics/standards';
import { targetInsights, type TargetInsight } from '@/domain/analytics/targets';
import { GOAL_ENERGY } from '@/domain/analytics/body';
import { dayTotals, nutritionSummary, realMaintenance } from '@/domain/nutrition/analysis';
import { dailyTargets } from '@/domain/nutrition/targets';
import { useFoodData } from '@/data/hooks';
import { useFeature } from '@/app/entitlement';
import { toDateKey } from '@/lib/dates';
import type { FoodLog, Profile } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { EvidenceLink } from '../science/EvidenceLink';
import { ExplainButton } from '../coach/CoachParts';
import { buildBrief } from '../coach/brief';
import { INSIGHT_TONE } from '../shared/insightTone';

const TONE = {
  good: { ...INSIGHT_TONE.positive, icon: CircleCheck },
  warn: INSIGHT_TONE.attention,
  info: INSIGHT_TONE.neutral,
} as const;

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

/**
 * The calorie and protein targets the person sets, and what their own data says about them:
 * the rate the calories predict, whether it fits the goal, what the weight trend says about
 * maintenance, protein per kg, and strength in a deficit.
 */
export function TargetsCard({
  profile,
  snapshot,
  data,
  now,
}: {
  profile: Profile;
  snapshot: BodySnapshot;
  data: TrainingData;
  now: Date;
}) {
  const toast = useToast();
  const food = useFoodData();
  const [editing, setEditing] = useState(false);
  const trainingDates = useMemo(
    () =>
      new Set(
        data.workouts
          .filter((w) => w.status === 'completed' && w.deletedAt === null)
          .map((w) => toDateKey(new Date(w.startedAt))),
      ),
    [data.workouts],
  );
  const foodBrief = (logs: FoodLog[]) =>
    logs.length
      ? {
          summary: nutritionSummary({
            logs,
            days: 14,
            now,
            proteinTargetG: daily.proteinG,
            trainingDates,
          }),
          today: dayTotals(logs, toDateKey(now)),
          maintenance: realMaintenance({ logs, trend: snapshot.trend, now }),
          targets: daily,
          diet: profile.dietType ?? null,
        }
      : null;
  const targets = {
    kcal: profile.calorieTarget ?? null,
    proteinG: profile.proteinTargetG ?? null,
  };
  const liftRates = useMemo(() => {
    const rates: number[] = [];
    for (const history of performanceByExercise(buildSessions(data)).values()) {
      const r = e1rmRate(history, now);
      if (r !== null) rates.push(r);
    }
    return rates;
  }, [data, now]);
  const insights = targetInsights({
    targets,
    energy: snapshot.energy,
    weightKg: snapshot.weightKg,
    rateKgPerWeek: snapshot.rate?.kgPerWeek ?? null,
    goal: profile.goal,
    experience: profile.experience,
    liftRates,
  });

  async function save(next: { calorieTarget?: number | null; proteinTargetG?: number | null }) {
    try {
      await saveProfile(db, {
        displayName: profile.displayName,
        birthDate: profile.birthDate,
        goal: profile.goal,
        experience: profile.experience,
        ...next,
      });
      return true;
    } catch (e) {
      toast(e instanceof ProfileError ? e.message : 'Could not save. Try again.');
      return false;
    }
  }

  const calc = snapshot.energy;
  const daily = dailyTargets(profile, calc);
  const set = targets.kcal !== null || targets.proteinG !== null;
  return (
    <Card as="section" aria-labelledby="targets-title" className="mt-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="targets-title" className="type-title text-text-1">
            Your targets
          </h2>
          <EvidenceLink topic="targets" about="target checks" />
          <ExplainButton
            topic="targets"
            about="your targets"
            brief={() =>
              buildBrief('targets', {
                unit: 'kg',
                now,
                profile,
                model: null,
                targets: {
                  kcal: targets.kcal,
                  proteinG: targets.proteinG,
                  calculatedKcal: calc ? Math.round(calc.targetKcal) : null,
                  bodyWeightKg: snapshot.weightKg,
                  insights,
                },
                nutrition: food.data ? foodBrief(food.data.logs) : null,
              })
            }
          />
        </div>
        <TextLink small icon={<Pencil />} onClick={() => setEditing(true)}>
          {set ? 'Edit' : 'Set your own'}
        </TextLink>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0 rounded-nested bg-surface-2 px-3 py-2.5">
          <dt className="type-meta text-text-2">Calories a day</dt>
          <dd className="type-headline tabular mt-0.5 text-text-1">
            {targets.kcal !== null ? `${n(targets.kcal)} kcal` : 'Not set'}
          </dd>
          {targets.kcal === null && calc ? (
            <dd className="type-caption text-text-2">Using {n(calc.targetKcal)} worked out</dd>
          ) : null}
        </div>
        <div className="min-w-0 rounded-nested bg-surface-2 px-3 py-2.5">
          <dt className="type-meta text-text-2">Protein a day</dt>
          <dd className="type-headline tabular mt-0.5 text-text-1">
            {targets.proteinG !== null ? `${n(targets.proteinG)} g` : 'Not set'}
          </dd>
          {targets.proteinG === null && calc ? (
            <dd className="type-caption text-text-2">
              Using {n(calc.proteinG[0])} to {n(calc.proteinG[1])} g worked out
            </dd>
          ) : null}
        </div>
      </dl>

      {insights.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {insights.map((i) => (
            <InsightRow
              key={i.id}
              insight={i}
              onApply={async (patch, label) => {
                if (await save(patch)) toast(`Target set to ${label}.`);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="type-meta mt-3 text-text-2">
          {set
            ? 'Add a weigh-in and your profile details to see how your targets compare.'
            : 'Set the calories and protein you are aiming for, and Overload checks them against your maintenance, your goal, your weight trend and your lifts.'}
        </p>
      )}
      <FoodLogBlock
        profile={profile}
        snapshot={snapshot}
        now={now}
        onApply={async (kcal) => {
          if (await save({ calorieTarget: kcal })) toast(`Target set to ${n(kcal)} kcal.`);
        }}
      />
      {snapshot.rate === null && targets.kcal !== null ? (
        <p className="type-meta mt-3 text-text-2">
          Weigh in on at least 6 days over 2 weeks and your trend shows whether the maintenance
          estimate fits you.
        </p>
      ) : null}

      <BottomSheet open={editing} onClose={() => setEditing(false)} title="Your daily targets">
        {editing ? (
          <TargetsForm
            initial={targets}
            calc={calc ? { kcal: calc.targetKcal, proteinG: calc.proteinG } : null}
            onCancel={() => setEditing(false)}
            onSave={async (next) => {
              if (await save(next)) setEditing(false);
            }}
          />
        ) : null}
      </BottomSheet>
    </Card>
  );
}

/**
 * What the food log says about the targets: average intake, and the person's real maintenance
 * from intake and the weight trend (Pro), with a target for their goal in one tap.
 */
function FoodLogBlock({
  profile,
  snapshot,
  now,
  onApply,
}: {
  profile: Profile;
  snapshot: BodySnapshot;
  now: Date;
  onApply: (kcal: number) => Promise<void>;
}) {
  const food = useFoodData();
  const pro = useFeature('food_insights');
  const logs = useMemo(() => food.data?.logs ?? [], [food.data]);
  const summary = useMemo(
    () => nutritionSummary({ logs, days: 14, now, proteinTargetG: null, trainingDates: new Set() }),
    [logs, now],
  );
  const maintenance = useMemo(
    () => realMaintenance({ logs, trend: snapshot.trend, now }),
    [logs, snapshot.trend, now],
  );
  if (food.status !== 'success') return null;
  if (!summary.avg)
    return (
      <p
        className="type-meta mt-4 flex flex-wrap items-center gap-x-2 text-text-2"
        data-food-log-block
      >
        Log what you eat and Overload compares it with these targets.
        <TextLink to="/food" small chevron>
          Log food
        </TextLink>
      </p>
    );
  const forGoal = maintenance
    ? Math.round((maintenance.kcal * (1 + GOAL_ENERGY[profile.goal])) / 50) * 50
    : null;
  return (
    <div className="mt-4 rounded-nested bg-surface-2 p-4" data-food-log-block>
      <p className="type-headline text-text-1">From your food log</p>
      <p className="type-meta mt-1 text-text-2">
        Last 14 days: {n(summary.avg.kcal)} kcal and {n(summary.avg.proteinG)} g protein a day on
        average, over {summary.loggedDays} fully logged days.
      </p>
      {pro ? (
        maintenance ? (
          <>
            <p className="type-meta mt-2 text-text-2">
              Your real maintenance is about{' '}
              <span className="tabular font-semibold text-text-1">{n(maintenance.kcal)} kcal</span>:
              you ate {n(maintenance.meanIntake)} kcal a day while your trend weight moved{' '}
              {maintenance.changeKg >= 0 ? '+' : '−'}
              {Math.abs(maintenance.changeKg).toFixed(1)} kg in {maintenance.days} days.
            </p>
            {forGoal !== null && forGoal !== profile.calorieTarget ? (
              <TextLink small className="mt-1" onClick={() => void onApply(forGoal)}>
                Use {n(forGoal)} kcal for your goal
              </TextLink>
            ) : null}
          </>
        ) : (
          <p className="type-meta mt-2 text-text-2">
            Real maintenance shows after 14 fully logged days in 4 weeks, with weigh-ins at both
            ends.
          </p>
        )
      ) : (
        <TextLink to="/pro" small className="mt-2" data-pro-lock="food_insights">
          Pro works out your real maintenance from this
        </TextLink>
      )}
    </div>
  );
}

function InsightRow({
  insight: i,
  onApply,
}: {
  insight: TargetInsight;
  onApply: (
    patch: { calorieTarget?: number; proteinTargetG?: number },
    label: string,
  ) => Promise<void>;
}) {
  const tone = TONE[i.tone];
  const Icon = tone.icon;
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full',
          tone.ring,
        )}
      >
        <Icon className="size-4" aria-label={tone.label} />
      </span>
      <div className="min-w-0">
        <p className="type-headline text-text-1">{i.title}</p>
        <p className="type-body mt-0.5 text-text-2">{i.body}</p>
        {i.suggestKcal !== undefined ? (
          <TextLink
            small
            className="mt-1"
            onClick={() =>
              void onApply({ calorieTarget: i.suggestKcal }, `${n(i.suggestKcal!)} kcal`)
            }
          >
            Use {n(i.suggestKcal)} kcal
          </TextLink>
        ) : null}
        {i.suggestProteinG !== undefined ? (
          <TextLink
            small
            className="mt-1"
            onClick={() =>
              void onApply({ proteinTargetG: i.suggestProteinG }, `${n(i.suggestProteinG!)} g`)
            }
          >
            Use {n(i.suggestProteinG)} g
          </TextLink>
        ) : null}
      </div>
    </li>
  );
}

function TargetsForm({
  initial,
  calc,
  onSave,
  onCancel,
}: {
  initial: { kcal: number | null; proteinG: number | null };
  calc: { kcal: number; proteinG: [number, number] } | null;
  onSave: (next: { calorieTarget: number | null; proteinTargetG: number | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [kcal, setKcal] = useState<number | null>(initial.kcal ?? calc?.kcal ?? null);
  const [protein, setProtein] = useState<number | null>(
    initial.proteinG ?? (calc ? Math.round((calc.proteinG[0] + calc.proteinG[1]) / 2) : null),
  );
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-4 pt-1"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          calorieTarget: kcal === null ? null : Math.round(kcal),
          proteinTargetG: protein === null ? null : Math.round(protein),
        });
        setBusy(false);
      }}
    >
      <p className="type-body text-text-2">
        Set what you are actually aiming to eat. Leave a field empty to use the worked-out number.
      </p>
      <NumberField
        label="Calories a day"
        value={kcal}
        onValueChange={setKcal}
        allowDecimal={false}
        min={800}
        max={8000}
        unit="kcal"
        placeholder={calc ? String(calc.kcal) : undefined}
      />
      <NumberField
        label="Protein a day"
        value={protein}
        onValueChange={setProtein}
        allowDecimal={false}
        min={20}
        max={500}
        unit="g"
        placeholder={calc ? String(Math.round(calc.proteinG[0])) : undefined}
      />
      {calc ? (
        <p className="type-meta text-text-2">
          Worked out for you: {n(calc.kcal)} kcal and {n(calc.proteinG[0])} to {n(calc.proteinG[1])}{' '}
          g.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <PrimaryButton block type="submit" loading={busy}>
          Save targets
        </PrimaryButton>
        <SecondaryButton
          block
          onClick={() => {
            setKcal(null);
            setProtein(null);
          }}
        >
          Clear both
        </SecondaryButton>
        <SecondaryButton block onClick={onCancel}>
          Cancel
        </SecondaryButton>
      </div>
    </form>
  );
}
