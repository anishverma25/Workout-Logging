import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ChipGroup, SegmentedControl, stepValue } from '@/components/kit';
import { Minus, Plus } from 'lucide-react';
import { parseQuantity } from '@/domain/nutrition/quantity';
import { measurePortion, type FoodPortion } from '@/data/repositories/food';
import { CUP_ML, KATORI_ML } from '@/domain/nutrition/calc';
import type { OilLevel, SizeId } from '@/domain/nutrition/types';
import { cn } from '@/lib/cn';
import { EvidenceLink } from '../science/EvidenceLink';
import { cap, SOURCE, unitName } from './foodText';

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
      <span className="font-semibold text-text-1">{proteinG.toFixed(1)} g</span> protein
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
  showSource = true,
  showTotals = true,
}: {
  portion: FoodPortion;
  onChange: (next: FoodPortion) => void;
  katoriMl: number | null;
  /** Off when the screen already shows where the numbers come from and the totals. */
  showSource?: boolean;
  showTotals?: boolean;
}) {
  const { food } = portion;
  const [showRecipe, setShowRecipe] = useState(false);
  let measured: ReturnType<typeof measurePortion> | null = null;
  try {
    measured = measurePortion(portion, katoriMl);
  } catch {
    measured = null;
  }
  // Grams and ml are typed as whole numbers; everything else counts katoris, plates, pieces.
  const grams = portion.unit === 'g' || portion.unit === 'ml';
  const set = (changes: Partial<FoodPortion>) => onChange({ ...portion, ...changes });

  return (
    <div className="flex flex-col gap-4" data-portion={food.id}>
      {showSource ? (
        <p className="type-meta flex flex-wrap items-center gap-x-2 text-text-2">
          {SOURCE[food.source]}
          {food.source === 'recipe' || food.source === 'ingredient' ? (
            <EvidenceLink topic="food-values" about="how food values are worked out" />
          ) : null}
        </p>
      ) : null}

      {food.units.length > 1 ? (
        <ChipGroup
          label="Measure"
          options={food.units.map((u) => ({ value: u, label: unitName(food, u) }))}
          value={portion.unit}
          onChange={(unit) =>
            set({
              unit,
              amount:
                unit === 'g'
                  ? Math.round(measured?.grams ?? 100)
                  : unit === 'ml'
                    ? Math.round((measured?.grams ?? 100) / (food.density || 1))
                    : 1,
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

      <AmountInput
        portion={portion}
        grams={grams}
        gramsText={measured && portion.unit !== 'g' ? `${Math.round(measured.grams)} g` : null}
        onChange={set}
      />

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

      {measured && showTotals ? (
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

/**
 * The quantity: type any number, or use the buttons, and type a whole quantity such as
 * "2 scoops", "150 g" or "250 ml" to switch the unit with it. Numbers update as you type.
 */
function AmountInput({
  portion,
  grams,
  gramsText,
  onChange,
}: {
  portion: FoodPortion;
  grams: boolean;
  gramsText: string | null;
  onChange: (changes: Partial<FoodPortion>) => void;
}) {
  const { food } = portion;
  const [draft, setDraft] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [typedState, setTypedState] = useState<'idle' | 'ok' | 'bad'>('idle');
  const min = grams ? 1 : 0.1;
  const max = grams ? 5000 : 100;
  const step = grams ? 10 : portion.unit === 'piece' ? 1 : 0.5;
  const shown = draft ?? String(portion.amount);
  const label =
    portion.unit === 'g'
      ? 'grams'
      : portion.unit === 'ml'
        ? 'ml'
        : unitName(food, portion.unit).toLowerCase();
  const btn =
    'pressable chrome inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-1 select-none disabled:text-text-3';

  function typeAmount(text: string) {
    setDraft(text);
    const v = Number(text.replace(',', '.'));
    if (text !== '' && Number.isFinite(v) && v >= min && v <= max) onChange({ amount: v });
  }

  function applyTyped() {
    if (typed.trim() === '') return;
    const q = parseQuantity(typed, food, portion.unit);
    if (!q) {
      setTypedState('bad');
      return;
    }
    setTypedState('ok');
    setDraft(null);
    onChange({
      amount: q.amount,
      unit: q.unit,
      size: q.unit === 'katori' || q.unit === 'cup' ? (portion.size ?? 'medium') : null,
    });
  }

  return (
    <div className="flex flex-col gap-2" data-amount>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className={btn}
          aria-label={`Decrease ${label}`}
          disabled={portion.amount <= min}
          onClick={() => {
            setDraft(null);
            onChange({ amount: stepValue(portion.amount, -step, min, max, grams ? 1 : 0.25) });
          }}
        >
          <Minus className="size-5" aria-hidden />
        </button>
        <label className="flex min-w-0 flex-1 flex-col items-center">
          <span className="sr-only">How many {label}</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={shown}
            aria-label={`How many ${label}`}
            data-amount-input
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => typeAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            onBlur={() => setDraft(null)}
            className="type-headline tabular w-full min-w-0 rounded-nested bg-surface-2 px-3 py-2 text-center text-text-1 outline-none focus-visible:ring-2 focus-visible:ring-lime"
          />
          <span className="type-caption tabular mt-1 text-text-2">
            {label}
            {gramsText ? ` · ${gramsText}` : ''}
          </span>
        </label>
        <button
          type="button"
          className={btn}
          aria-label={`Increase ${label}`}
          disabled={portion.amount >= max}
          onClick={() => {
            setDraft(null);
            onChange({ amount: stepValue(portion.amount, step, min, max, grams ? 1 : 0.25) });
          }}
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
      <input
        type="text"
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={typed}
        placeholder="Or type it: 2 scoops, 150 g, 250 ml"
        aria-label="Type a quantity"
        data-quantity-text
        onChange={(e) => {
          setTyped(e.target.value);
          setTypedState('idle');
        }}
        onBlur={applyTyped}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyTyped();
          }
        }}
        className="type-meta w-full rounded-nested bg-surface-2 px-3 py-2.5 text-text-1 outline-none placeholder:text-text-3 focus-visible:ring-2 focus-visible:ring-lime"
      />
      {typedState === 'bad' ? (
        <p className="type-caption text-danger-text" role="alert">
          {food.name} cannot be measured that way. Try one of:{' '}
          {food.units.map((u) => unitName(food, u).toLowerCase()).join(', ')}.
        </p>
      ) : null}
    </div>
  );
}
