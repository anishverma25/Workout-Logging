import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useFeature } from '@/app/entitlement';
import type { ProgressModel } from '@/domain/analytics/progress';
import { LEVELS, type BalanceRatio, type Plateau } from '@/domain/analytics/standards';
import type { Exercise } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { formatDayMonth } from '@/lib/dates';
import { pluralize } from '@/lib/format';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { ProLock } from '../pro/ProLock';

function Block({
  id,
  title,
  detail,
  children,
}: {
  id: string;
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`sec-${id}`} className="mt-9">
      <h2
        id={`sec-${id}`}
        className="font-display text-[1.3rem] font-bold leading-tight tracking-tight"
      >
        {title}
      </h2>
      {detail ? (
        <p className="mb-3 mt-0.5 text-sm text-faint">{detail}</p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
    </section>
  );
}

/** Strength against standard levels for your body weight, and DOTS. */
export function LevelsSection({
  model,
  unit,
  sexKnown,
}: {
  model: ProgressModel;
  unit: WeightUnit;
  sexKnown: boolean;
}) {
  const included = useFeature('strength_levels');
  const { levels, dots } = model.strength;
  return (
    <Block
      id="levels"
      title="Strength levels"
      detail="Your best estimated 1RM of the last 12 weeks as a multiple of body weight."
    >
      {!included ? (
        <ProLock
          feature="strength_levels"
          lead={
            levels.length > 0
              ? `${pluralize(levels.length, 'of your lifts has', 'of your lifts have')} a level.`
              : undefined
          }
        />
      ) : levels.length === 0 ? (
        <p className="rounded-[var(--radius-card)] bg-surface p-5 text-sm text-muted">
          {!sexKnown ? (
            <>
              Levels differ for men and women, so they need your sex in your{' '}
              <Link to="/profile" className="font-medium text-accent-text">
                profile
              </Link>
              , and a weigh-in.
            </>
          ) : (
            'Log squat, bench press, deadlift, overhead press or barbell row, plus a weigh-in, to see where you stand.'
          )}
        </p>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ul className="rounded-[var(--radius-card)] bg-surface px-4">
            {levels.map((l, i) => (
              <li key={l.key} className={cn('py-3.5', i > 0 && 'border-t border-line')}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{l.name}</span>
                  <span className="tabular text-sm text-faint">
                    {formatWeightValue(l.e1rm, unit)} {unit} · {l.ratio.toFixed(2)}× body weight
                  </span>
                </div>
                <div className="mt-2 flex gap-1" aria-hidden>
                  {LEVELS.map((name, j) => {
                    const reached = l.level ? LEVELS.indexOf(l.level) >= j : false;
                    const current = l.next === name;
                    return (
                      <span
                        key={name}
                        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ring-track)]"
                      >
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-[var(--ring-1)]"
                          style={{ width: reached ? '100%' : current ? `${l.progress * 100}%` : 0 }}
                        />
                      </span>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  {l.level ?? 'Below beginner'}
                  {l.next && l.nextKg
                    ? `. ${l.next} at ${formatWeightValue(l.nextKg, unit)} ${unit}.`
                    : '. The top level.'}
                </p>
              </li>
            ))}
          </ul>
          <div className="rounded-[var(--radius-card)] bg-surface p-5">
            <p className="text-[0.8125rem] font-medium text-faint">DOTS score, estimated</p>
            {dots ? (
              <>
                <p className="tabular mt-1 font-display text-[2rem] font-bold leading-tight tracking-tight">
                  {dots.score.toFixed(0)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  From an estimated total of {formatWeightValue(dots.totalKg, unit)} {unit} (squat,
                  bench and deadlift). DOTS compares lifters of different body weights: around 300
                  is a solid gym lifter, 400 and up is competitive.
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Needs squat, bench press and deadlift in the last 12 weeks.
              </p>
            )}
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-faint">
        Rule-of-thumb standards for adults under 40, not adjusted for age. A guide, not a ranking.
      </p>
    </Block>
  );
}

/** How fast each lift is going up: the slope of the best e1RM per session. */
export function RatesSection({
  model,
  unit,
  names,
}: {
  model: ProgressModel;
  unit: WeightUnit;
  names: Map<string, string>;
}) {
  const rates = model.strength.rates.slice(0, 6);
  if (rates.length === 0) return null;
  return (
    <Block
      id="rates"
      title="Rate of progress"
      detail="Change in estimated 1RM per week, fitted to every session of the last 8 weeks."
    >
      <ul className="rounded-[var(--radius-card)] bg-surface px-4">
        {rates.map((r, i) => {
          const v = toDisplayWeight(r.kgPerWeek, unit);
          return (
            <li
              key={r.exerciseId}
              className={cn(
                'flex items-center justify-between gap-3 py-3',
                i > 0 && 'border-t border-line',
              )}
            >
              <span className="min-w-0 truncate font-medium">
                {names.get(r.exerciseId) ?? 'Exercise'}
              </span>
              <span
                className={cn(
                  'tabular shrink-0 font-display text-lg font-semibold',
                  v > 0.05 ? 'text-accent-text' : v < -0.05 ? 'text-warn' : 'text-muted',
                )}
              >
                {v > 0 ? '+' : v < 0 ? '−' : ''}
                {Math.abs(v).toFixed(2)} {unit}
                <span className="text-sm font-medium text-faint"> a week</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Block>
  );
}

const SUGGESTION: Record<Plateau['suggestion'], string> = {
  rep_range:
    'Try a new rep range for 4 weeks, for example 4 to 6 reps if you train 8 to 12, or the other way round.',
  deload:
    'Take a lighter week: the same exercises at about 60% of your usual weight, then build back up.',
  variation:
    'Swap it for a close variation for a few weeks (incline for flat bench, front squat for back squat), then return.',
};

export function PlateausSection({
  model,
  unit,
  exercises,
}: {
  model: ProgressModel;
  unit: WeightUnit;
  exercises: Exercise[];
}) {
  const included = useFeature('plateaus');
  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const plateaus = model.plateaus;
  return (
    <Block
      id="plateaus"
      title="Stalled lifts"
      detail="No new best estimated 1RM for 3 weeks or more, across at least 4 sessions."
    >
      {!included ? (
        <ProLock
          feature="plateaus"
          lead={
            plateaus.length > 0
              ? `${pluralize(plateaus.length, 'lift has', 'lifts have')} stalled.`
              : undefined
          }
        />
      ) : plateaus.length === 0 ? (
        <p className="rounded-[var(--radius-card)] bg-surface p-5 text-sm text-muted">
          Nothing has stalled. Every lift you train regularly set a best in the last 3 weeks.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {plateaus.map((p) => (
            <li key={p.exerciseId} className="rounded-[var(--radius-card)] bg-surface p-4">
              <p className="font-semibold">{names.get(p.exerciseId) ?? 'Exercise'}</p>
              <p className="mt-0.5 text-sm text-faint">
                Best {formatWeightValue(p.bestE1rm, unit)} {unit} on {formatDayMonth(p.bestDate)},{' '}
                {pluralize(p.weeks, 'week')} and {pluralize(p.sessionsSince, 'session')} ago.
              </p>
              <p className="mt-2 text-sm">{SUGGESTION[p.suggestion]}</p>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

const VERDICT: Record<BalanceRatio['verdict'], string> = {
  balanced: 'Balanced',
  a_heavy: 'Leans to the first',
  b_heavy: 'Leans to the second',
  too_little: 'Not enough sets yet',
};

export function BalanceSection({ model }: { model: ProgressModel }) {
  const included = useFeature('training_balance');
  return (
    <Block
      id="balance"
      title="Balance"
      detail="Working sets by primary muscle in the last 4 weeks."
    >
      {!included ? (
        <ProLock feature="training_balance" />
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-3">
          {model.balance.map((b) => {
            const total = b.a.sets + b.b.sets;
            const share = total > 0 ? b.a.sets / total : 0.5;
            const flagged = b.verdict === 'a_heavy' || b.verdict === 'b_heavy';
            return (
              <li key={b.key} className="rounded-[var(--radius-card)] bg-surface p-4">
                <p className="text-[0.8125rem] font-medium text-faint">{b.label}</p>
                <div className="mt-2 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
                  <span className="bg-[var(--chart-1)]" style={{ width: `${share * 100}%` }} />
                  <span className="flex-1 bg-[var(--chart-2)]" />
                </div>
                <p className="tabular mt-2 flex justify-between text-sm">
                  <span>
                    {b.a.label} <strong>{b.a.sets}</strong>
                  </span>
                  <span>
                    {b.b.label} <strong>{b.b.sets}</strong>
                  </span>
                </p>
                <p className={cn('mt-1 text-sm', flagged ? 'text-warn' : 'text-muted')}>
                  {b.verdict === 'a_heavy'
                    ? `More ${b.a.label.toLowerCase()} than ${b.b.label.toLowerCase()}. Add some ${b.b.label.toLowerCase()} work.`
                    : b.verdict === 'b_heavy'
                      ? `More ${b.b.label.toLowerCase()} than ${b.a.label.toLowerCase()}. Add some ${b.a.label.toLowerCase()} work.`
                      : VERDICT[b.verdict]}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Block>
  );
}
