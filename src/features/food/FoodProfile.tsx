import { Camera, Check, Globe, ScanText, Sparkles } from 'lucide-react';
import { PrimaryButton } from '@/components/kit';
import { measurePortion, type FoodPortion } from '@/data/repositories/food';
import { portionText, type Food } from '@/domain/nutrition/calc';
import type { Nutrients } from '@/domain/nutrition/types';
import type { DailyTargets } from '@/domain/nutrition/targets';
import { cn } from '@/lib/cn';
import { EvidenceLink } from '../science/EvidenceLink';
import { SOURCE } from './foodText';
import { PortionEditor } from './PortionEditor';

/**
 * A food's profile while logging: its nutrients for the portion chosen, how they split, what
 * they are per 100 g, and the portion itself to adjust (unit, size, amount, oil). Every number
 * comes from `measurePortion`, the same function that saves the log.
 */
export function FoodProfile({
  portion,
  onChange,
  katoriMl,
  targets,
  actionLabel,
  onDone,
}: {
  portion: FoodPortion;
  onChange: (next: FoodPortion) => void;
  katoriMl: number | null;
  targets: DailyTargets | null;
  /** "Add to plate" for a new food, "Done" when adjusting one already on the plate. */
  actionLabel: string;
  onDone: () => void;
}) {
  let measured: ReturnType<typeof measurePortion> | null;
  try {
    measured = measurePortion(portion, katoriMl);
  } catch {
    measured = null;
  }
  const { food } = portion;
  return (
    <div className="flex flex-col gap-5" data-food-profile={food.id}>
      <SourceLine food={food} />
      {measured ? (
        <NutritionPanel
          nutrients={measured.nutrients}
          grams={measured.grams}
          portionLabel={portionText(portion.amount, portion.unit, portion.size, food.pieceName)}
          per100={food.per100}
          targets={targets}
        />
      ) : (
        <p className="type-meta rounded-nested bg-surface-2 p-4 text-text-2">
          Choose an amount to see the nutrients.
        </p>
      )}
      <section aria-labelledby="portion-title" className="flex flex-col gap-3">
        <h3 id="portion-title" className="type-headline text-text-1">
          How much did you have?
        </h3>
        <PortionEditor
          portion={portion}
          onChange={onChange}
          katoriMl={katoriMl}
          showSource={false}
          showTotals={false}
        />
      </section>
      <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 border-t-[0.5px] border-divider bg-surface px-5 pt-3 pb-5">
        <PrimaryButton block disabled={!measured} onClick={onDone} data-profile-action>
          {measured ? `${actionLabel} · ${Math.round(measured.nutrients.kcal)} kcal` : actionLabel}
        </PrimaryButton>
      </div>
    </div>
  );
}

function SourceLine({ food }: { food: Food }) {
  const icon =
    food.source === 'ai' ? (
      food.ai?.basis === 'photo' ? (
        <Camera />
      ) : food.ai?.basis === 'label' ? (
        <ScanText />
      ) : food.ai?.basis === 'web' ? (
        <Globe />
      ) : (
        <Sparkles />
      )
    ) : (
      <Check />
    );
  return (
    <p className="type-meta flex flex-wrap items-center gap-x-2 gap-y-1 text-text-2">
      <span className="inline-flex size-4 text-text-2 [&>svg]:size-4" aria-hidden>
        {icon}
      </span>
      {SOURCE[food.source]}
      {food.source === 'recipe' || food.source === 'ingredient' ? (
        <EvidenceLink topic="food-values" about="how food values are worked out" />
      ) : null}
    </p>
  );
}

const MACROS = [
  { key: 'proteinG', label: 'Protein', kcalPerG: 4, tone: 'bg-lime' },
  { key: 'carbsG', label: 'Carbs', kcalPerG: 4, tone: 'bg-chart-2' },
  { key: 'fatG', label: 'Fat', kcalPerG: 9, tone: 'bg-text-2' },
] as const;

/** The nutrients of one portion, large and easy to scan, with how they split and the day. */
export function NutritionPanel({
  nutrients,
  grams,
  portionLabel,
  per100,
  targets,
}: {
  nutrients: Nutrients;
  grams: number;
  portionLabel: string;
  per100: Nutrients;
  targets: DailyTargets | null;
}) {
  const fromMacros = nutrients.proteinG * 4 + nutrients.carbsG * 4 + nutrients.fatG * 9 || 1;
  const share = (kcal: number) => Math.round((kcal / fromMacros) * 100);
  const ofDay = (value: number, target: number | null | undefined) =>
    target ? Math.round((value / target) * 100) : null;
  const kcalDay = ofDay(nutrients.kcal, targets?.kcal);
  const proteinDay = ofDay(nutrients.proteinG, targets?.proteinG);
  return (
    <section className="rounded-panel bg-surface-2 p-4" aria-label="Nutrients" data-nutrition-panel>
      <div className="flex items-end justify-between gap-4">
        <p>
          <span className="type-display tabular text-text-1" data-portion-kcal>
            {Math.round(nutrients.kcal)}
          </span>
          <span className="type-headline ml-1.5 text-text-2">kcal</span>
        </p>
        <p className="type-meta tabular text-right text-text-2">
          {portionLabel}
          {/ g$/.test(portionLabel) ? null : (
            <>
              <br />
              {Math.round(grams)} g
            </>
          )}
        </p>
      </div>
      {kcalDay !== null || proteinDay !== null ? (
        <p className="type-meta tabular mt-1 text-text-2">
          {[
            kcalDay !== null ? `${kcalDay}% of your calories` : null,
            proteinDay !== null ? `${proteinDay}% of your protein` : null,
          ]
            .filter(Boolean)
            .join(' · ')}{' '}
          for the day
        </p>
      ) : null}

      <div
        className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface"
        role="img"
        aria-label={`Energy from protein ${share(nutrients.proteinG * 4)}%, carbs ${share(nutrients.carbsG * 4)}%, fat ${share(nutrients.fatG * 9)}%`}
      >
        {MACROS.map((m) => (
          <span
            key={m.key}
            className={cn('h-full', m.tone)}
            style={{ width: `${share(nutrients[m.key] * m.kcalPerG)}%` }}
          />
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-4 gap-2">
        {MACROS.map((m) => (
          <div key={m.key}>
            <dt className="type-caption flex items-center gap-1.5 text-text-2">
              <span className={cn('size-2 rounded-full', m.tone)} aria-hidden />
              {m.label}
            </dt>
            <dd className="type-title tabular mt-0.5 text-text-1">
              {nutrients[m.key].toFixed(nutrients[m.key] < 10 ? 1 : 0)}
              <span className="type-meta ml-0.5 text-text-2">g</span>
            </dd>
          </div>
        ))}
        <div>
          <dt className="type-caption text-text-2">Fibre</dt>
          <dd className="type-title tabular mt-0.5 text-text-1">
            {nutrients.fibreG.toFixed(1)}
            <span className="type-meta ml-0.5 text-text-2">g</span>
          </dd>
        </div>
      </dl>

      <p className="type-caption tabular mt-4 border-t-[0.5px] border-divider pt-3 text-text-2">
        Per 100 g: {Math.round(per100.kcal)} kcal · {per100.proteinG.toFixed(1)} g protein ·{' '}
        {per100.carbsG.toFixed(1)} g carbs · {per100.fatG.toFixed(1)} g fat ·{' '}
        {per100.fibreG.toFixed(1)} g fibre
      </p>
    </section>
  );
}
