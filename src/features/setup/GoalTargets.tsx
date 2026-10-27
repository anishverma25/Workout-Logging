import { AlertTriangle, CalendarCheck } from 'lucide-react';
import { NumberField, TextLink } from '@/components/kit';
import {
  intakeOutcome,
  MIN_DAILY_KCAL,
  type IntakeOutcome,
  type TargetInput,
  type TargetPlan,
} from '@/domain/analytics/goalPlan';
import { toDisplayWeight, type WeightUnit } from '@/lib/units';
import { cn } from '@/lib/cn';

const kcalText = (v: number) => Math.round(v).toLocaleString('en-GB');
const dateText = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * Daily calories and protein for the person's target weight, and when they get there. Both are
 * suggestions they can change; every change works the date out again.
 */
export function GoalTargets({
  input,
  plan,
  kcal,
  proteinG,
  unit,
  onChange,
}: {
  input: TargetInput;
  plan: TargetPlan;
  /** The person's own numbers, null for the suggestion. */
  kcal: number | null;
  proteinG: number | null;
  unit: WeightUnit;
  onChange: (next: { kcal: number | null; proteinG: number | null }) => void;
}) {
  const shownKcal = kcal ?? plan.kcal;
  const shownProtein = proteinG ?? plan.proteinG;
  const outcome = intakeOutcome({ ...input, kcal: shownKcal, proteinG: shownProtein });
  const edited = kcal !== null || proteinG !== null;
  const w = (kg: number) =>
    `${Math.round(toDisplayWeight(kg, unit) * 10) / 10} ${unit}`;
  return (
    <div className="mt-6 rounded-panel border border-border bg-surface p-5" data-goal-targets>
      <h2 className="type-title text-text-1">Your daily targets</h2>
      <p className="type-meta mt-1 text-text-2">
        Worked out for {w(input.targetKg)} from your {w(input.weightKg)} today. Change either one
        and the date updates.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <NumberField
          label="Calories a day"
          value={shownKcal}
          onValueChange={(v) => onChange({ kcal: v === plan.kcal ? null : v, proteinG })}
          allowDecimal={false}
          min={800}
          max={8000}
          unit="kcal"
        />
        <NumberField
          label="Protein a day"
          value={shownProtein}
          onValueChange={(v) => onChange({ kcal, proteinG: v === plan.proteinG ? null : v })}
          allowDecimal={false}
          min={20}
          max={500}
          unit="g"
        />
      </div>
      <Timeline
        outcome={outcome}
        plan={plan}
        input={input}
        w={w}
        kcal={shownKcal}
        proteinG={shownProtein}
      />
      {edited ? (
        <TextLink small className="mt-3" onClick={() => onChange({ kcal: null, proteinG: null })}>
          Use the suggestion ({kcalText(plan.kcal)} kcal, {plan.proteinG} g protein)
        </TextLink>
      ) : null}
      <p className="type-caption mt-3 text-text-3">
        From about 7,700 kcal per kg of body weight and your estimated maintenance of{' '}
        {kcalText(input.maintenanceKcal)} kcal. The body adapts as weight changes, so treat the
        date as a guide; Overload checks it against your weigh-ins.
      </p>
    </div>
  );
}

function Timeline({
  outcome,
  plan,
  input,
  w,
  kcal,
  proteinG,
}: {
  outcome: IntakeOutcome;
  plan: TargetPlan;
  input: TargetInput;
  w: (kg: number) => string;
  kcal: number;
  proteinG: number;
}) {
  const rate = Math.abs(outcome.rateKgPerWeek);
  const pct = ((rate / input.weightKg) * 100).toFixed(1);
  const losing = outcome.rateKgPerWeek < 0;
  const target = w(input.targetKg);
  const warn = (text: string) => (
    <p className="type-meta mt-2 flex items-start gap-2 text-text-1" data-goal-warning>
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <span>{text}</span>
    </p>
  );
  let main: string;
  switch (outcome.status) {
    case 'at_target':
      main = 'You are at your target already. These targets hold your weight steady.';
      break;
    case 'too_low':
      main = `Under ${kcalText(MIN_DAILY_KCAL)} kcal a day is too little to train on safely.`;
      break;
    case 'no_change':
      main = `At ${kcalText(kcal)} kcal your weight would hold, so you would not reach ${target}.`;
      break;
    case 'wrong_way':
      main = `At ${kcalText(kcal)} kcal you would ${losing ? 'lose' : 'gain'} weight, away from ${target}.`;
      break;
    default:
      main = `You reach ${target} around ${dateText(outcome.date!)}, in about ${Math.max(1, Math.round(outcome.weeks!))} weeks.`;
  }
  const reached = outcome.date !== null;
  return (
    <div
      className={cn(
        'mt-4 rounded-nested px-4 py-3',
        reached ? 'bg-lime-dim' : 'bg-surface-2',
      )}
      data-goal-timeline
      aria-live="polite"
    >
      <p className="type-headline flex items-start gap-2 text-text-1">
        {reached ? <CalendarCheck className="mt-0.5 size-5 shrink-0 text-lime" aria-hidden /> : null}
        <span>{main}</span>
      </p>
      {reached ? (
        <p className="type-meta mt-1 text-text-2">
          {losing ? 'Losing' : 'Gaining'} about {rate.toFixed(2)} kg a week ({pct}% of your
          weight).
          {plan.goalOverridden
            ? ` Your target is ${losing ? 'below' : 'above'} your weight, so the plan ${losing ? 'loses' : 'gains'} at the rate that suits that.`
            : ''}
        </p>
      ) : null}
      {outcome.status === 'too_fast'
        ? warn(
            losing
              ? `Losing more than 1% of your weight a week costs muscle and strength. About ${kcalText(plan.kcal)} kcal is the safer pace.`
              : `Gaining this fast adds mostly fat, not muscle. About ${kcalText(plan.kcal)} kcal is the better pace.`,
          )
        : null}
      {outcome.status === 'slow'
        ? warn(`This is a slow pace. About ${kcalText(plan.kcal)} kcal would get you there sooner.`)
        : null}
      {plan.floored && outcome.status === 'on_track' && kcal === plan.kcal
        ? warn(
            `Kept at your resting energy (${kcalText(kcal)} kcal), so this is slower than the usual pace.`,
          )
        : null}
      {outcome.proteinLow
        ? warn(
            `${proteinG} g is ${outcome.proteinPerKg} g per kg. For your goal aim for at least ${outcome.proteinMinG} g to keep and build muscle.`,
          )
        : null}
    </div>
  );
}
