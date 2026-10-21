import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ChipGroup, SegmentedControl, Stepper } from '@/components/kit';
import { measurePortion, type FoodPortion } from '@/data/repositories/food';
import { CUP_ML, KATORI_ML, type Food } from '@/domain/nutrition/calc';
import type { OilLevel, SizeId } from '@/domain/nutrition/types';
import { cn } from '@/lib/cn';
import { EvidenceLink } from '../science/EvidenceLink';
import { cap, unitName } from './foodText';

const SOURCE: Record<Food['source'], string> = {
  recipe: 'Calculated from a home recipe. Varies with oil and portion.',
  ingredient: 'USDA lab values.',
  label: 'From the pack label.',
  usda: 'USDA lab values.',
  indb: 'Indian Nutrient Databank, calculated from a published Indian recipe.',
  off: 'From the pack label, via Open Food Facts.',
  ai: 'Worked out by OverloadGPT. Check the portion.',
  custom: 'Your food, from its label.',
  custom_recipe: 'Your recipe.',
};

export function NutrientLine({
  kcal,
  proteinG,
  carbsG,
  fatG,
  className,
}: {
  kcal: number;
  proteinG: number;
  carbsG?: number;
  fatG?: number;
  className?: string;
}) {
  return (
    <p className={cn('type-meta tabular text-text-2', className)}>
      <span className="font-semibold text-text-1">{Math.round(kcal)} kcal</span>
      {' · '}
      {proteinG.toFixed(1)} g protein
      {carbsG !== undefined ? ` · ${carbsG.toFixed(0)} g carbs` : ''}
      {fatG !== undefined ? ` · ${fatG.toFixed(0)} g fat` : ''}
    </p>
  );
}

/**
 * Unit, size, amount and oil level for one food, with its numbers updating as they change.
 * Every number comes from `measurePortion`, the same function that saves the log.
 */
export function PortionEditor({
  portion,
  onChange,
  katoriMl,
}: {
  portion: FoodPortion;
  onChange: (next: FoodPortion) => void;
  katoriMl: number | null;
}) {
  const { food } = portion;
  const [showRecipe, setShowRecipe] = useState(false);
  let measured: ReturnType<typeof measurePortion> | null = null;
  try {
    measured = measurePortion(portion, katoriMl);
  } catch {
    measured = null;
  }
  const grams = portion.unit === 'g';
  const set = (changes: Partial<FoodPortion>) => onChange({ ...portion, ...changes });

  return (
    <div className="flex flex-col gap-4" data-portion={food.id}>
      <p className="type-meta flex flex-wrap items-center gap-x-2 text-text-2">
        {SOURCE[food.source]}
        {food.source === 'recipe' || food.source === 'ingredient' ? (
          <EvidenceLink topic="food-values" about="how food values are worked out" />
        ) : null}
      </p>

      {food.units.length > 1 ? (
        <ChipGroup
          label="Measure"
          options={food.units.map((u) => ({ value: u, label: unitName(food, u) }))}
          value={portion.unit}
          onChange={(unit) =>
            set({
              unit,
              amount: unit === 'g' ? Math.round(measured?.grams ?? 100) : 1,
              size: unit === 'katori' || unit === 'cup' ? (portion.size ?? 'medium') : null,
            })
          }
        />
      ) : null}

      {portion.unit === 'katori' ? (
        <div>
          <SegmentedControl<SizeId>
            label="Katori size"
            block
            value={portion.size ?? 'medium'}
            onChange={(size) => set({ size })}
            options={(['small', 'medium', 'large'] as const).map((s) => ({
              value: s,
              label: cap(s),
            }))}
          />
          <p className="type-caption tabular mt-1.5 text-text-2">
            {cap(portion.size ?? 'medium')} katori,{' '}
            {Math.round(
              katoriMl
                ? katoriMl * { small: 0.75, medium: 1, large: 1.25 }[portion.size ?? 'medium']
                : KATORI_ML[portion.size ?? 'medium'],
            )}{' '}
            ml{katoriMl ? ' (from your katori)' : ''}
          </p>
        </div>
      ) : null}
      {portion.unit === 'cup' ? (
        <SegmentedControl<SizeId>
          label="Cup size"
          block
          value={portion.size === 'small' ? 'small' : 'medium'}
          onChange={(size) => set({ size })}
          options={[
            { value: 'small', label: `Small ${CUP_ML.small} ml` },
            { value: 'medium', label: `Regular ${CUP_ML.medium} ml` },
          ]}
        />
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <Stepper
          label={`How many ${grams ? 'grams' : unitName(food, portion.unit).toLowerCase()}`}
          value={portion.amount}
          onChange={(amount) => set({ amount })}
          min={grams ? 5 : 0.25}
          max={grams ? 2000 : 20}
          step={grams ? 10 : portion.unit === 'piece' ? 1 : 0.5}
          size="headline"
          format={(v) => (grams ? `${v} g` : String(v))}
        />
        {measured && !grams ? (
          <span className="type-meta tabular text-text-2">{Math.round(measured.grams)} g</span>
        ) : null}
      </div>

      {food.fatPer100 ? (
        <div>
          <p className="type-meta mb-2 text-text-2">Oil and ghee</p>
          <SegmentedControl<OilLevel>
            label="Oil and ghee"
            block
            value={portion.oilLevel ?? 'normal'}
            onChange={(oilLevel) => set({ oilLevel })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'normal', label: 'Normal' },
              { value: 'rich', label: 'Rich' },
            ]}
          />
        </div>
      ) : null}

      {measured ? (
        <div className="rounded-nested bg-surface-2 p-4">
          <NutrientLine {...measured.nutrients} />
          <p className="type-caption mt-1 tabular text-text-2">
            {measured.nutrients.fibreG.toFixed(1)} g fibre
          </p>
        </div>
      ) : null}

      {food.recipe ? (
        <div>
          <button
            type="button"
            className="pressable type-meta inline-flex items-center gap-1 font-semibold text-text-1"
            aria-expanded={showRecipe}
            onClick={() => setShowRecipe((v) => !v)}
          >
            How this is calculated
            <ChevronDown
              className={cn('size-4 transition-transform', showRecipe && 'rotate-180')}
              aria-hidden
            />
          </button>
          {showRecipe ? (
            <div className="type-meta mt-2 text-text-2">
              <p>
                Recipe for {food.recipe.makes}, {Math.round(food.recipe.cookedG)} g cooked:
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {food.recipe.lines.map((l) => (
                  <li key={l.name} className="flex justify-between gap-4">
                    <span>{l.name}</span>
                    <span className="tabular">{l.grams} g</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
