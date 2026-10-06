import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import {
  ACTIVITY_STEPS,
  GOAL_ENERGY,
  GOAL_PROTEIN,
  type BodySnapshot,
  type BmiBand,
  type RateVerdict,
} from '@/domain/analytics/body';
import { GOAL_LABEL } from '@/domain/models/labels';
import type { Goal, Sex } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';

const BMI_LABEL: Record<BmiBand, string> = {
  under: 'Underweight',
  healthy: 'Healthy range',
  over: 'Overweight',
  obese: 'Obese',
};

const RATE_LABEL: Record<RateVerdict, string> = {
  on_track: 'On track for your goal',
  too_fast: 'Faster than your goal suggests',
  too_slow: 'Slower than your goal suggests',
  wrong_way: 'Moving away from your goal',
};

type Topic = 'energy' | 'protein' | 'bmi' | 'fat' | 'ffmi' | 'rate';

const fmt = (v: number, digits = 1) =>
  v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });

interface Props {
  snapshot: BodySnapshot;
  goal: Goal | null;
  sex: Sex | null;
  heightCm: number | null;
  unit: WeightUnit;
  hasProfile: boolean;
}

/**
 * Personal numbers from published formulas. Each tile opens the formula with the person's own
 * values plugged in; a tile whose inputs are missing says exactly what to add.
 */
export function BodyNumbers({ snapshot: s, goal, sex, heightCm, unit, hasProfile }: Props) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const kg = (v: number) => `${formatWeightValue(v, unit)} ${unit}`;
  const needs = (items: string[]) => `Add your ${items.join(', ')}`;
  const missingFor = {
    energy: [
      s.missing.weight && 'weight',
      s.bodyFat === null && s.missing.sex && 'sex',
      s.bodyFat === null && s.missing.age && 'birth date',
      s.bodyFat === null && s.missing.height && 'height',
      s.missing.trainingDays && 'training days',
    ].filter(Boolean) as string[],
    bmi: [s.missing.weight && 'weight', s.missing.height && 'height'].filter(Boolean) as string[],
  };

  return (
    <section aria-labelledby="numbers-title">
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <h2
          id="numbers-title"
          className="font-display text-[1.3rem] font-semibold leading-tight tracking-tight"
        >
          Your numbers
        </h2>
        <Link
          to="/progress/methodology#body"
          className="tap-target text-sm font-medium text-accent-text"
        >
          How they are worked out
        </Link>
      </div>
      {!hasProfile ? (
        <p className="mb-3 rounded-[1rem] bg-surface p-4 text-sm text-muted">
          These use your profile.{' '}
          <Link to="/setup?next=/body" className="font-medium text-accent-text">
            Set up your profile
          </Link>{' '}
          to see daily calories, protein, BMI and more.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <Tile
          label="Daily calories"
          onOpen={s.energy ? () => setTopic('energy') : undefined}
          value={s.energy ? s.energy.targetKcal.toLocaleString() : null}
          unit="kcal"
          detail={
            s.energy
              ? `Maintenance about ${s.energy.tdee.toLocaleString()}`
              : missingFor.energy.length
                ? needs(missingFor.energy)
                : 'Needs your profile'
          }
          tone={1}
        />
        <Tile
          label="Protein a day"
          onOpen={s.energy ? () => setTopic('protein') : undefined}
          value={s.energy ? `${s.energy.proteinG[0]}–${s.energy.proteinG[1]}` : null}
          unit="g"
          detail={
            s.energy && goal
              ? `${GOAL_PROTEIN[goal][0]} to ${GOAL_PROTEIN[goal][1]} g per kg`
              : 'Needs your weight and goal'
          }
          tone={1}
        />
        <Tile
          label="BMI"
          onOpen={s.bmi ? () => setTopic('bmi') : undefined}
          value={s.bmi ? fmt(s.bmi.value) : null}
          detail={s.bmi ? BMI_LABEL[s.bmi.band] : needs(missingFor.bmi)}
          tone={3}
        />
        <Tile
          label="Body fat"
          onOpen={s.bodyFat ? () => setTopic('fat') : undefined}
          value={s.bodyFat ? fmt(s.bodyFat.pct) : null}
          unit="%"
          detail={
            s.bodyFat
              ? s.bodyFat.source === 'navy'
                ? 'Tape estimate (US Navy)'
                : 'From your scale or scan'
              : sex === 'unspecified'
                ? 'Add a reading from a scale or scan'
                : 'Add waist and neck measurements'
          }
          tone={2}
        />
        <Tile
          label="Lean mass index"
          onOpen={s.ffmi ? () => setTopic('ffmi') : undefined}
          value={s.ffmi ? fmt(s.ffmi.normalized) : null}
          detail={s.ffmi ? `Lean mass ${kg(s.leanKg!)}` : 'Needs body fat and height'}
          tone={2}
        />
        <Tile
          label="Weekly change"
          onOpen={s.rate ? () => setTopic('rate') : undefined}
          value={
            s.rate
              ? `${s.rate.kgPerWeek >= 0 ? '+' : '−'}${fmt(Math.abs(toDisplayWeight(s.rate.kgPerWeek, unit)), 2)}`
              : null
          }
          unit={unit}
          detail={s.rate ? RATE_LABEL[s.rate.verdict] : 'Needs 2 weeks of weigh-ins'}
          tone={s.rate?.verdict === 'on_track' ? 1 : 2}
        />
      </div>

      <Sheet
        open={topic !== null}
        onClose={() => setTopic(null)}
        title={topic ? TITLES[topic] : ''}
      >
        {topic ? (
          <Explanation topic={topic} s={s} goal={goal} sex={sex} heightCm={heightCm} unit={unit} />
        ) : null}
      </Sheet>
    </section>
  );
}

const TITLES: Record<Topic, string> = {
  energy: 'Daily calories',
  protein: 'Protein',
  bmi: 'Body mass index',
  fat: 'Body fat',
  ffmi: 'Lean mass index',
  rate: 'Weekly change',
};

function Tile({
  label,
  value,
  unit,
  detail,
  onOpen,
  tone,
}: {
  label: string;
  value: string | null;
  unit?: string;
  detail: string;
  onOpen?: () => void;
  tone: 1 | 2 | 3;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-faint">
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: value ? `var(--ring-${tone})` : 'var(--line-strong)' }}
        />
        {label}
        {onOpen ? <ChevronRight className="ml-auto size-4 text-faint/70" aria-hidden /> : null}
      </span>
      {value ? (
        <span className="tabular mt-1.5 block font-display text-[1.6rem] font-semibold leading-tight tracking-tight">
          {value}
          {unit ? <span className="ml-1 text-base font-medium text-faint">{unit}</span> : null}
        </span>
      ) : (
        <span className="mt-1.5 block font-display text-[1.6rem] font-semibold leading-tight text-faint/60">
          –
        </span>
      )}
      <span className="mt-0.5 block text-xs leading-snug text-faint">{detail}</span>
    </>
  );
  const cls = 'block w-full rounded-[1.1rem] bg-surface p-4 text-left';
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className={cn(cls, 'transition-colors active:bg-surface-2')}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <p className="tabular my-3 rounded-xl bg-surface-2 px-3.5 py-3 text-[0.9rem] leading-relaxed">
      {children}
    </p>
  );
}

function Explanation({
  topic,
  s,
  goal,
  sex,
  heightCm,
  unit,
}: {
  topic: Topic;
  s: BodySnapshot;
  goal: Goal | null;
  sex: Sex | null;
  heightCm: number | null;
  unit: WeightUnit;
}) {
  const w = s.weightKg !== null ? fmt(s.weightKg) : '?';
  const text = 'text-[0.95rem] leading-relaxed text-muted';
  switch (topic) {
    case 'energy': {
      const e = s.energy!;
      const factorText = `${fmt(e.factor, 3)} for ${fmt(e.trainingDays, 1)} training days a week (${
        e.trainingDaysSource === 'logged' ? 'from your last 4 weeks' : 'from your profile'
      })`;
      return (
        <div className={text}>
          <p>
            Your body burns about{' '}
            <strong className="text-text">{e.bmr.toLocaleString()} kcal</strong> a day at rest
            (basal metabolic rate).
          </p>
          <Formula>
            {e.method === 'mifflin' ? (
              <>
                Mifflin-St Jeor: 10 × {w} kg + 6.25 × {fmt(heightCm ?? 0)} cm − 5 × {s.age} years{' '}
                {sex === 'female' ? '− 161' : '+ 5'} = {e.bmr.toLocaleString()} kcal
              </>
            ) : (
              <>
                Katch-McArdle, from lean mass: 370 + 21.6 × {fmt(s.leanKg ?? 0)} kg ={' '}
                {e.bmr.toLocaleString()} kcal
              </>
            )}
          </Formula>
          <p>Multiplied by an activity factor of {factorText}, maintenance is about:</p>
          <Formula>
            {e.bmr.toLocaleString()} × {fmt(e.factor, 3)} ≈ {e.tdee.toLocaleString()} kcal
          </Formula>
          <p>
            For {goal ? GOAL_LABEL[goal].toLowerCase() : 'your goal'} the target is{' '}
            {e.adjustment === 0
              ? 'maintenance'
              : `${e.adjustment > 0 ? '+' : '−'}${Math.round(Math.abs(e.adjustment) * 100)}%`}
            : <strong className="text-text">{e.targetKcal.toLocaleString()} kcal</strong> a day.
            With protein in the middle of its range and at least {e.fatMinG} g of fat, about{' '}
            {e.carbsG} g of carbohydrate fills the rest.
          </p>
          <p className="mt-3 text-sm text-faint">
            Factors run from {ACTIVITY_STEPS[0]} (little exercise) to {ACTIVITY_STEPS[4]} (hard
            physical work and training). Every formula is an estimate: if your weight trend moves
            differently from your goal for 2 to 3 weeks, adjust by 100 to 200 kcal.
          </p>
        </div>
      );
    }
    case 'protein': {
      const e = s.energy!;
      const [lo, hi] = goal ? GOAL_PROTEIN[goal] : [1.6, 2.2];
      return (
        <div className={text}>
          <Formula>
            {lo} to {hi} g × {w} kg = {e.proteinG[0]} to {e.proteinG[1]} g a day
          </Formula>
          <p>
            1.6 g per kg is where extra protein stops adding muscle on average, and 2.2 g the upper
            end of the range in the largest meta-analysis (Morton and colleagues, 2018). When eating
            less, more protein helps keep muscle, so fat loss goals use 2.0 to 2.4 g per kg. Spread
            it over 3 to 5 meals.
          </p>
          {goal ? (
            <p className="mt-3 text-sm text-faint">
              Calories for {GOAL_LABEL[goal].toLowerCase()}:{' '}
              {GOAL_ENERGY[goal] === 0
                ? 'maintenance'
                : `${GOAL_ENERGY[goal] > 0 ? '+' : '−'}${Math.abs(GOAL_ENERGY[goal]) * 100}% of maintenance`}
              .
            </p>
          ) : null}
        </div>
      );
    }
    case 'bmi': {
      const b = s.bmi!;
      return (
        <div className={text}>
          <Formula>
            {w} kg ÷ ({fmt((heightCm ?? 0) / 100, 2)} m)² = {fmt(b.value)}
          </Formula>
          <p>
            WHO bands: under 18.5 underweight, 18.5 to 24.9 healthy, 25 to 29.9 overweight, 30 and
            over obese. For South Asian adults the WHO suggests acting from 23 and 27.5, because
            health risk starts at a lower BMI. On those cut-offs you are in the{' '}
            {BMI_LABEL[b.asianBand].toLowerCase()} band.
          </p>
          <p className="mt-3 text-sm text-faint">
            BMI cannot tell muscle from fat, so it reads many lifters as overweight. Body fat and
            the lean mass index describe a lifter better.
          </p>
        </div>
      );
    }
    case 'fat': {
      const f = s.bodyFat!;
      return (
        <div className={text}>
          {f.source === 'navy' ? (
            <>
              <p>Estimated from your waist, neck{sex === 'female' ? ', hips' : ''} and height:</p>
              <Formula>
                {sex === 'female'
                  ? '495 ÷ (1.29579 − 0.35004 log₁₀(waist + hip − neck) + 0.22100 log₁₀(height)) − 450'
                  : '495 ÷ (1.0324 − 0.19077 log₁₀(waist − neck) + 0.15456 log₁₀(height)) − 450'}{' '}
                = {fmt(f.pct)}%
              </Formula>
              <p>
                The US Navy tape method (Hodgdon and Beckett, 1984) is usually within 3 to 4
                percentage points of lab tests. Measure the same way each time: waist at the navel
                {sex === 'female' ? ' (narrowest point for women)' : ''}, relaxed, in the morning.
              </p>
            </>
          ) : (
            <p>
              {fmt(f.pct)}%, from the reading you entered. A reading from a scale or scan is used
              for {60} days; after that the tape estimate takes over if you have one.
            </p>
          )}
          {s.leanKg !== null ? (
            <p className="mt-3">
              That puts lean mass (everything except fat) at {formatWeightValue(s.leanKg, unit)}{' '}
              {unit}.
            </p>
          ) : null}
        </div>
      );
    }
    case 'ffmi': {
      const f = s.ffmi!;
      return (
        <div className={text}>
          <Formula>
            {fmt(s.leanKg ?? 0)} kg ÷ ({fmt((heightCm ?? 0) / 100, 2)} m)² = {fmt(f.value)},
            adjusted to 1.8 m: {fmt(f.normalized)}
          </Formula>
          <p>
            The fat-free mass index (Kouri and colleagues, 1995) is BMI for muscle. For men, about
            18 to 20 is typical, 20 to 22 shows years of training, and above 25 is rare without
            drugs. Women typically sit about 3 to 4 points lower.
          </p>
        </div>
      );
    }
    case 'rate': {
      const r = s.rate!;
      const pct = (v: number) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v * 100), 2)}%`;
      return (
        <div className={text}>
          <p>
            The slope of your smoothed weight trend over the last 4 weeks:{' '}
            <strong className="text-text">
              {r.kgPerWeek >= 0 ? '+' : '−'}
              {fmt(Math.abs(toDisplayWeight(r.kgPerWeek, unit)), 2)} {unit} a week
            </strong>
            .
          </p>
          <p className="mt-3">
            For {goal ? GOAL_LABEL[goal].toLowerCase() : 'your goal'} a good pace is{' '}
            {pct(r.target[0])} to {pct(r.target[1])} of body weight a week.
          </p>
          <p className="mt-3 text-sm text-faint">
            The trend moves 10% of the way to each weigh-in per day, so water and food swings barely
            move it. Losing 0.5 to 1% a week keeps muscle in a deficit; gaining faster than 0.25 to
            0.5% mostly adds fat.
          </p>
        </div>
      );
    }
  }
}
