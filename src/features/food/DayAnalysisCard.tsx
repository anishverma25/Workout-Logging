import { useMemo } from 'react';
import { Link } from 'react-router';
import { Crown, Microscope } from 'lucide-react';
import { Card } from '@/components/kit';
import { useFeature } from '@/app/entitlement';
import { GOAL_PROTEIN } from '@/domain/analytics/body';
import { realMaintenance } from '@/domain/nutrition/analysis';
import { analyseDay, type Check, type Verdict } from '@/domain/nutrition/dayAnalysis';
import { MEALS } from '@/domain/nutrition/types';
import { cn } from '@/lib/cn';
import { toDateKey } from '@/lib/dates';
import { EvidenceLink } from '../science/EvidenceLink';
import { MEAL_LABEL, type FoodContext } from './useFoodContext';

/**
 * Pro: the day's food analysed against published ranges (`domain/nutrition/dayAnalysis.ts`,
 * science topic `day-analysis`). Each check shows its number, the range and a plain verdict;
 * nothing is folded into an invented score. Free accounts see what it covers and where to get it.
 */
export function DayAnalysisCard({ ctx, date, now }: { ctx: FoodContext; date: string; now: Date }) {
  const pro = useFeature('food_insights');
  const today = toDateKey(now);
  const analysis = useMemo(() => {
    const goal = ctx.profile?.goal ?? null;
    const maintenance = ctx.snapshot
      ? realMaintenance({ logs: ctx.logs, trend: ctx.snapshot.trend, now })
      : null;
    return analyseDay({
      logs: ctx.logs,
      date,
      today,
      targets: ctx.targets,
      proteinRangeGPerKg: goal ? GOAL_PROTEIN[goal] : null,
      weightKg: ctx.snapshot?.weightKg ?? null,
      maintenanceKcal: maintenance?.kcal ?? null,
      trainingDay: ctx.trainingDates.has(date),
    });
  }, [ctx, date, today, now]);

  if (!analysis) return null;

  if (!pro)
    return (
      <Card as="section" aria-labelledby="day-analysis" data-pro-lock="food_insights">
        <Header partial={analysis.partial} />
        <p className="type-body mt-2 text-text-2">
          See how today measures up, the way a sports dietitian would: energy against your target,
          your protein, carb and fat split, protein per kg and per meal, fibre, and carbs on
          training days, each against the published range.
        </p>
        <Link
          to="/pro"
          className="type-meta mt-3 inline-flex items-center gap-1.5 font-semibold text-text-1"
        >
          <Crown className="size-4 text-lime" aria-hidden />
          Get the full analysis with Pro
        </Link>
      </Card>
    );

  const { energy, split, proteinPerKg, proteinSpread, fibre, trainingCarbs } = analysis;
  return (
    <Card as="section" aria-labelledby="day-analysis" data-day-analysis>
      <Header partial={analysis.partial} />

      <Block title="Energy" verdict={energy.verdict}>
        <p className="flex items-baseline gap-1.5">
          <Big>{analysis.kcal.toLocaleString('en-IN')}</Big>
          <Unit>kcal</Unit>
          {energy.target ? (
            <span className="type-meta tabular text-text-2">
              of {energy.target.toLocaleString('en-IN')} ·{' '}
              <strong className="font-semibold text-text-1">
                {Math.round((energy.ofTarget ?? 0) * 100)}%
              </strong>
            </span>
          ) : null}
        </p>
        {energy.target ? (
          <Gauge
            value={analysis.kcal}
            max={Math.max(energy.target * 1.4, analysis.kcal)}
            band={[energy.target * 0.9, energy.target * 1.1]}
            label="Energy against your target, with the on-target band"
          />
        ) : (
          <p className="type-meta mt-1 text-text-2">Set a calorie target on Body to judge it.</p>
        )}
        {energy.vsMaintenance !== null ? (
          <p className="type-meta tabular mt-2 text-text-2">
            <strong className="font-semibold text-text-1">
              {energy.vsMaintenance > 0 ? '+' : ''}
              {energy.vsMaintenance.toLocaleString('en-IN')} kcal
            </strong>{' '}
            against your real maintenance
          </p>
        ) : null}
      </Block>

      {split ? (
        <Block
          title="Where the energy comes from"
          note="Judged against the Institute of Medicine ranges"
        >
          <div
            className="flex h-3 overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={`Protein ${split.protein.value}%, carbs ${split.carbs.value}%, fat ${split.fat.value}%`}
          >
            <span className="h-full bg-lime" style={{ width: `${split.protein.value}%` }} />
            <span className="h-full bg-chart-2" style={{ width: `${split.carbs.value}%` }} />
            <span className="h-full bg-text-3" style={{ width: `${split.fat.value}%` }} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            <Macro label="Protein" dot="bg-lime" check={split.protein} />
            <Macro label="Carbs" dot="bg-chart-2" check={split.carbs} />
            <Macro label="Fat" dot="bg-text-3" check={split.fat} />
          </dl>
        </Block>
      ) : null}

      {proteinPerKg ? (
        <Block title="Protein for your goal" verdict={proteinPerKg.verdict}>
          <p className="flex items-baseline gap-1.5">
            <Big>{proteinPerKg.value.toFixed(1)}</Big>
            <Unit>g per kg</Unit>
            <span className="type-meta tabular text-text-2">
              aim {proteinPerKg.range[0]} to {proteinPerKg.range[1]}
            </span>
          </p>
          <Gauge
            value={proteinPerKg.value}
            max={Math.max(proteinPerKg.range[1] * 1.4, proteinPerKg.value)}
            band={proteinPerKg.range}
            label="Protein per kg against your goal's range"
          />
          {proteinSpread ? (
            <div className="mt-3">
              <ul className="flex gap-2" aria-label="Protein dose at each meal">
                {MEALS.map((m) => {
                  const ate = proteinSpread.meals.includes(m);
                  const hit = proteinSpread.reached.includes(m);
                  return (
                    <li
                      key={m}
                      className={cn(
                        'type-caption flex-1 rounded-full px-2 py-1.5 text-center font-semibold',
                        hit
                          ? 'bg-lime-dim text-text-1'
                          : ate
                            ? 'bg-surface-2 text-text-2'
                            : 'border border-dashed border-border text-text-3',
                      )}
                    >
                      {MEAL_LABEL[m]}
                      <span className="sr-only">
                        {hit ? ', reached the dose' : ate ? ', below the dose' : ', nothing logged'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="type-meta tabular mt-2 text-text-2">
                <strong className="font-semibold text-text-1">
                  {proteinSpread.reached.length} of {proteinSpread.meals.length}
                </strong>{' '}
                {proteinSpread.meals.length === 1 ? 'meal' : 'meals'} reached{' '}
                <strong className="font-semibold text-text-1">{proteinSpread.doseG} g</strong>{' '}
                protein, the dose that counts for muscle
              </p>
            </div>
          ) : null}
        </Block>
      ) : (
        <Block title="Protein for your goal">
          <p className="type-meta text-text-2">Log your weight on Body to judge protein per kg.</p>
        </Block>
      )}

      <Block title="Fibre" verdict={fibre.verdict}>
        <p className="flex items-baseline gap-1.5">
          <Big>{fibre.value.toFixed(0)}</Big>
          <Unit>g</Unit>
          <span className="type-meta tabular text-text-2">
            of at least {fibre.range[0]} g for what you ate
          </span>
        </p>
      </Block>

      {trainingCarbs ? (
        <Block title="Carbs for training" verdict={trainingCarbs.verdict}>
          <p className="flex items-baseline gap-1.5">
            <Big>{trainingCarbs.value.toFixed(1)}</Big>
            <Unit>g per kg</Unit>
            <span className="type-meta tabular text-text-2">
              aim {trainingCarbs.range[0]} to {trainingCarbs.range[1]} on training days
            </span>
          </p>
          <Gauge
            value={trainingCarbs.value}
            max={Math.max(trainingCarbs.range[1] * 1.3, trainingCarbs.value)}
            band={trainingCarbs.range}
            label="Carbs per kg against the range for strength training"
          />
        </Block>
      ) : null}
    </Card>
  );
}

function Header({ partial }: { partial: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id="day-analysis" className="type-title flex items-center gap-2 text-text-1">
          <Microscope className="size-5 text-lime" aria-hidden />
          Day analysis
        </h2>
        <p className="type-meta mt-0.5 text-text-2">
          {partial ? 'Today so far, judged as it stands' : 'The whole day'} against published ranges
        </p>
      </div>
      <EvidenceLink topic="day-analysis" about="the day analysis" />
    </div>
  );
}

const VERDICT: Record<Verdict, { label: string; className: string }> = {
  in_range: { label: 'In range', className: 'bg-lime-dim text-text-1' },
  low: { label: 'Below', className: 'bg-surface-2 text-text-1' },
  high: { label: 'Above', className: 'bg-surface-2 text-text-1' },
};

function Block({
  title,
  verdict,
  note,
  children,
}: {
  title: string;
  verdict?: Verdict | null;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t-[0.5px] border-divider pt-4" data-check={title}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="type-headline text-text-1">{title}</h3>
        {verdict ? <Chip verdict={verdict} /> : null}
      </div>
      {note ? <p className="type-caption -mt-1 mb-3 text-text-2">{note}</p> : null}
      {children}
    </div>
  );
}

function Chip({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span
      className={cn(
        'type-caption inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-semibold',
        v.className,
      )}
    >
      {v.label}
    </span>
  );
}

const Big = ({ children }: { children: React.ReactNode }) => (
  <span className="type-stat tabular text-text-1">{children}</span>
);
const Unit = ({ children }: { children: React.ReactNode }) => (
  <span className="type-headline text-text-2">{children}</span>
);

function Macro({ label, dot, check }: { label: string; dot: string; check: Check }) {
  return (
    <div>
      <dt className="type-caption flex items-center gap-1.5 text-text-2">
        <span className={cn('size-2 rounded-full', dot)} aria-hidden />
        {label}
      </dt>
      <dd>
        <span className="type-title tabular font-bold text-text-1">{check.value}%</span>
        <span className="type-caption tabular block text-text-2">
          {check.range[0]} to {check.range[1]}%
        </span>
        <span
          className={cn(
            'type-caption mt-1 inline-block font-semibold',
            check.verdict === 'in_range' ? 'text-lime' : 'text-text-1',
          )}
        >
          {VERDICT[check.verdict].label}
        </span>
      </dd>
    </div>
  );
}

/** A track with the recommended band shaded and a marker at the value. */
function Gauge({
  value,
  max,
  band,
  label,
}: {
  value: number;
  max: number;
  band: readonly [number, number];
  label: string;
}) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  return (
    <div className="relative mt-3 h-2.5 rounded-full bg-surface-2" role="img" aria-label={label}>
      <span
        className="absolute inset-y-0 rounded-full bg-lime-dim"
        style={{ left: pct(band[0]), width: `calc(${pct(band[1])} - ${pct(band[0])})` }}
      />
      <span
        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-lime"
        style={{ left: pct(value) }}
      />
    </div>
  );
}
