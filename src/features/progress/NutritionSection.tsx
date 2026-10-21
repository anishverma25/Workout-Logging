import { useMemo } from 'react';
import { BarChart } from '@/components/charts/BarChart';
import { Card, TextLink } from '@/components/kit';
import { useFeature } from '@/app/entitlement';
import { realMaintenance, nutritionSummary } from '@/domain/nutrition/analysis';
import { addDays, toDateKey } from '@/lib/dates';
import { ExplainButton } from '../coach/CoachParts';
import { buildBrief } from '../coach/brief';
import { nutritionBrief, type FoodContext } from '../food/useFoodContext';
import { ProLock } from '../pro/ProLock';
import { EvidenceLink } from '../science/EvidenceLink';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/**
 * Food on Progress (Pro): calories and protein each day against the targets, protein on
 * training and rest days, where protein comes from, and real maintenance.
 */
export function NutritionSection({
  ctx,
  days,
  now,
}: {
  ctx: FoodContext;
  days: number;
  now: Date;
}) {
  const pro = useFeature('food_insights');
  // Daily bars stay readable up to 90 days.
  const span = Math.min(days, 90);
  const summary = useMemo(
    () =>
      nutritionSummary({
        logs: ctx.logs,
        days: span,
        now,
        proteinTargetG: ctx.targets.proteinG,
        trainingDates: ctx.trainingDates,
      }),
    [ctx.logs, span, now, ctx.targets.proteinG, ctx.trainingDates],
  );
  const maintenance = useMemo(
    () =>
      ctx.snapshot ? realMaintenance({ logs: ctx.logs, trend: ctx.snapshot.trend, now }) : null,
    [ctx.logs, ctx.snapshot, now],
  );
  if (ctx.status !== 'success') return null;

  const bars = (value: (s: (typeof summary.series)[number]) => number, target: number | null) => {
    const byDate = new Map(summary.series.map((s) => [s.date, s]));
    const out = [];
    for (let i = span - 1; i >= 0; i -= 1) {
      const d = addDays(now, -i);
      const key = toDateKey(d);
      const s = byDate.get(key);
      out.push({
        key,
        label: dayFormat.format(d),
        longLabel: `${dayFormat.format(d)}${i === 0 ? ' (today, so far)' : ''}`,
        value: s ? value(s) : 0,
        highlight: target !== null && s !== undefined && value(s) >= target,
      });
    }
    return out;
  };

  return (
    <section id="nutrition" aria-labelledby="sec-nutrition" className="mt-8 scroll-mt-28">
      <div className="flex items-center gap-2">
        <h2 id="sec-nutrition" className="type-title text-text-1">
          Food
        </h2>
        <EvidenceLink topic="food-values" about="food numbers" />
        {pro && ctx.logs.length ? (
          <ExplainButton
            topic="targets"
            about="your food"
            className="ml-auto"
            brief={() =>
              buildBrief('targets', {
                unit: 'kg',
                now,
                profile: ctx.profile,
                model: null,
                nutrition: nutritionBrief(ctx, now, span),
              })
            }
          />
        ) : null}
      </div>
      <p className="type-meta mt-0.5 mb-3 text-text-2">
        Calculated from what you log on Food, last {span} days.
      </p>
      {!pro ? (
        <ProLock feature="food_insights" />
      ) : summary.series.length === 0 ? (
        <Card className="p-4 sm:p-5">
          <p className="type-meta flex flex-wrap items-center gap-x-2 text-text-2">
            Nothing logged in this period yet.
            <TextLink to="/food" small chevron>
              Log food
            </TextLink>
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4" data-nutrition-section>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Calories a day"
              value={summary.avg ? n(summary.avg.kcal) : null}
              detail={`${summary.loggedDays} fully logged days`}
            />
            <Tile
              label="Protein a day"
              value={summary.avg ? `${n(summary.avg.proteinG)} g` : null}
              detail={
                ctx.targets.proteinG !== null
                  ? `Target met on ${summary.proteinHitDays} of ${summary.loggedDays} days`
                  : 'No protein target set'
              }
            />
            <Tile
              label="Protein, training days"
              value={summary.proteinTraining !== null ? `${summary.proteinTraining} g` : null}
              detail={
                summary.proteinRest !== null
                  ? `${summary.proteinRest} g on rest days`
                  : 'Needs 3 of each'
              }
            />
            <Tile
              label="Real maintenance"
              value={maintenance ? n(maintenance.kcal) : null}
              detail={
                maintenance
                  ? `From ${maintenance.loggedDays} logged days and your weight trend`
                  : 'Needs 14 logged days and weigh-ins'
              }
            />
          </dl>
          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card className="p-4 sm:p-5">
              <h3 className="type-headline mb-2 text-text-1">
                Calories a day{ctx.targets.kcal !== null ? ` (target ${n(ctx.targets.kcal)})` : ''}
              </h3>
              <BarChart
                label="Calories a day"
                valueName="kcal"
                formatValue={(v) => n(v)}
                bars={bars((s) => s.kcal, null)}
                baseColor="var(--border-strong)"
                color="var(--lime)"
              />
            </Card>
            <Card className="p-4 sm:p-5">
              <h3 className="type-headline mb-2 text-text-1">
                Protein a day
                {ctx.targets.proteinG !== null ? ` (target ${ctx.targets.proteinG} g)` : ''}
              </h3>
              <BarChart
                label="Protein a day"
                valueName="g protein"
                formatValue={(v) => `${Math.round(v)} g`}
                bars={bars((s) => s.proteinG, ctx.targets.proteinG)}
                baseColor="var(--border-strong)"
                color="var(--lime)"
              />
              <p className="type-caption mt-2 text-text-2">
                Days at or above the target are filled.
              </p>
            </Card>
          </div>
          {summary.topProtein.length ? (
            <Card className="p-4 sm:p-5">
              <h3 className="type-headline text-text-1">Where your protein comes from</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {summary.topProtein.map((t) => (
                  <li key={t.foodName} className="type-meta flex justify-between gap-4 text-text-2">
                    <span className="truncate text-text-1">{t.foodName}</span>
                    <span className="tabular">{t.proteinG} g</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Tile({ label, value, detail }: { label: string; value: string | null; detail: string }) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4">
      <dt className="type-meta text-text-2">{label}</dt>
      {value === null ? (
        <dd className="type-headline mt-1.5 text-text-2">None yet</dd>
      ) : (
        <dd className="type-stat tabular mt-1 text-text-1">{value}</dd>
      )}
      <dd className="type-meta mt-1 text-text-2">{detail}</dd>
    </div>
  );
}
