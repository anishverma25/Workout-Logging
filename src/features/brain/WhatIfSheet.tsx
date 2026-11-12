import { useMemo, useState } from 'react';
import { BottomSheet } from '@/components/kit';
import { KCAL_ROUND, SETS_CEILING, SETS_FLOOR, roundTo } from '@/domain/brain/limits';
import { whatIf, WHAT_IF_WEEKS } from '@/domain/brain/whatIf';
import { muscleName } from '@/domain/analytics/weekly';
import type { Brain } from './useBrain';

const kg = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`;

/**
 * "Try a different plan": two sliders next to the real decision. The numbers come from the same
 * model the weekly plan uses, as a range, and say what they are based on.
 */
export function WhatIfSheet({ open, onClose, brain }: { open: boolean; onClose: () => void; brain: Brain }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Try a different plan"
      subtitle={`What it would likely do over ${WHAT_IF_WEEKS} weeks`}
    >
      {open ? <Sliders brain={brain} /> : null}
    </BottomSheet>
  );
}

function Sliders({ brain }: { brain: Brain }) {
  const model = brain.model!;
  const input = brain.input!;
  const maintenance = roundTo(model.maintenance!.value, KCAL_ROUND);
  const weightKg = input.person.weightKg!;

  // The lift with the most weeks behind it, in a muscle the routine trains.
  const main = useMemo(() => {
    const last = brain.weeks.at(-1);
    const candidates = Object.entries(model.lifts)
      .map(([id, trend]) => {
        const muscle = [...brain.weeks].reverse().find((w) => w.lifts[id])?.lifts[id]?.muscle;
        return muscle ? { id, trend, muscle } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => b.trend.weeks - a.trend.weeks || b.trend.latest - a.trend.latest);
    const pick = candidates[0];
    if (!pick) return null;
    const planned = Math.round(input.plan.muscleSets[pick.muscle] ?? last?.muscles[pick.muscle] ?? 10);
    return { ...pick, planned: Math.max(SETS_FLOOR, Math.min(SETS_CEILING, planned)) };
  }, [brain.weeks, model.lifts, input.plan.muscleSets]);

  const [kcal, setKcal] = useState(input.plan.kcal ?? maintenance);
  const [sets, setSets] = useState(main?.planned ?? 10);
  const result = whatIf({
    model,
    weightKg,
    bmrKcal: input.person.bmrKcal,
    kcal,
    lift: main ? { exerciseId: main.id, muscle: main.muscle, sets } : null,
  });
  const lo = Math.min(result.floor, roundTo(maintenance - 800, KCAL_ROUND));
  const hi = roundTo(maintenance + 600, KCAL_ROUND);
  const basis =
    model.maintenance!.confidence === 'personal'
      ? `Based on your own maintenance of about ${maintenance.toLocaleString('en-IN')} kcal, from ${model.maintenance!.n} logged weeks.`
      : model.maintenance!.confidence === 'learning'
        ? `Based on a maintenance of about ${maintenance.toLocaleString('en-IN')} kcal, part your logs and part the body formula. The range is wider until more weeks are logged.`
        : `Based on the body formula's maintenance of about ${maintenance.toLocaleString('en-IN')} kcal. Log food and weigh in for a few weeks to make this yours.`;

  return (
    <div className="flex flex-col gap-6" data-what-if>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="what-if-kcal" className="type-headline text-text-1">
            Calories a day
          </label>
          <span className="type-headline tabular text-text-1" data-what-if-kcal>
            {kcal.toLocaleString('en-IN')}
          </span>
        </div>
        <input
          id="what-if-kcal"
          type="range"
          min={lo}
          max={hi}
          step={KCAL_ROUND}
          value={kcal}
          onChange={(e) => setKcal(Number(e.target.value))}
          className="w-full accent-lime"
        />
        {!result.allowed ? (
          <p className="type-footnote text-danger-text" role="status">
            Under {result.floor.toLocaleString('en-IN')} kcal is below the lowest target the plan allows for you.
          </p>
        ) : null}
      </div>

      {main ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="what-if-sets" className="type-headline text-text-1">
              {muscleName(main.muscle)} sets a week
            </label>
            <span className="type-headline tabular text-text-1">{sets}</span>
          </div>
          <input
            id="what-if-sets"
            type="range"
            min={SETS_FLOOR}
            max={SETS_CEILING}
            step={1}
            value={sets}
            onChange={(e) => setSets(Number(e.target.value))}
            className="w-full accent-lime"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-nested bg-surface-2 p-4">
        {result.weight ? (
          <div data-what-if-weight>
            <p className="type-footnote text-text-2">Body weight in {WHAT_IF_WEEKS} weeks</p>
            <p className="type-title tabular text-text-1">
              {kg(result.weight.mid)} kg
              <span className="type-subhead text-text-3">
                {' '}
                ({kg(Math.min(result.weight.lo, result.weight.hi))} to {kg(Math.max(result.weight.lo, result.weight.hi))})
              </span>
            </p>
            <p className="type-footnote tabular text-text-3">
              {signed(result.weight.perWeek)} kg a week from {kg(weightKg)} kg
            </p>
          </div>
        ) : null}
        {result.lift && main ? (
          <div data-what-if-lift>
            <p className="type-footnote text-text-2">
              {input.exercise.name(main.id)}, estimated 1RM in {WHAT_IF_WEEKS} weeks
            </p>
            <p className="type-title tabular text-text-1">
              {kg(result.lift.mid)} kg
              <span className="type-subhead text-text-3">
                {' '}
                ({kg(result.lift.lo)} to {kg(result.lift.hi)})
              </span>
            </p>
            <p className="type-footnote text-text-3">
              {result.lift.personal
                ? 'From how this muscle has answered to this many sets in your own logs.'
                : 'Your trend of the last 8 weeks carried forward. Your logs do not yet show how sets change it.'}
            </p>
          </div>
        ) : null}
      </div>

      <p className="type-footnote text-text-3">
        {basis} The 7,700 kcal per kg rule is a guide for the first weeks; the body adapts as weight changes.
      </p>
    </div>
  );
}
