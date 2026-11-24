import type { Food } from '@/domain/nutrition/calc';
import { pickVariant, variantChoices } from '@/domain/nutrition/search';
import { cn } from '@/lib/cn';

/**
 * Size, crust or portion of a chain product: one row of choices per dimension. Changing one
 * keeps the others when that combination is sold.
 */
export function VariantPicker({
  food,
  variants,
  onPick,
}: {
  food: Food;
  variants: readonly Food[];
  onPick: (next: Food) => void;
}) {
  const choices = variantChoices(variants);
  if (!food.variant || choices.length === 0) return null;
  const current = new Map(food.variant.dims);
  return (
    <div className="flex flex-col gap-3" data-variant-picker>
      {choices.map(([dim, values]) => (
        <div key={dim} role="radiogroup" aria-label={dim}>
          <p className="type-caption mb-1.5 font-semibold text-text-2">{dim}</p>
          <div className="flex flex-wrap gap-1.5">
            {values.map((v) => {
              const on = current.get(dim) === v;
              const target = on ? food : pickVariant(variants, food, dim, v);
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!target}
                  onClick={() => target && target !== food && onPick(target)}
                  className={cn(
                    'pressable type-subhead h-9 rounded-full px-3.5 font-semibold disabled:opacity-40',
                    on ? 'bg-lime text-on-lime' : 'bg-surface-2 text-text-1',
                  )}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
