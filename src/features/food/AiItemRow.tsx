import { useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Globe,
  Minus,
  Pencil,
  Plus,
  ScanText,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { NumberField, PrimaryButton, TextLink } from '@/components/kit';
import { editedPortion, type EditedNumbers } from '@/app/foodAi';
import { measurePortion, type FoodPortion } from '@/data/repositories/food';
import { portionText } from '@/domain/nutrition/calc';
import { fillMacros } from '@/domain/nutrition/fillMacros';
import { cn } from '@/lib/cn';
import { itemCount, MAX_COUNT, MAX_SERVING_G, resizedPortion, withCount } from './resize';

/** One food OverloadGPT found, with where its numbers come from and how sure it is. */
export function AiItemRow({
  portion,
  katoriMl,
  confidence,
  onChange,
}: {
  portion: FoodPortion;
  katoriMl: number | null;
  confidence?: 'high' | 'medium' | 'low';
  /** When given, the numbers can be corrected before the food goes on the plate. */
  onChange?: (next: FoodPortion) => void;
}) {
  const [editing, setEditing] = useState(false);
  const f = portion.food;
  const amount =
    f.ai && portion.unit === 'serving'
      ? f.ai.portion === `${f.servingG} g`
        ? f.ai.portion
        : `${f.ai.portion} (${f.servingG} g)`
      : portionText(portion.amount, portion.unit, portion.size, f.pieceName);
  let kcal: number | null = null;
  let protein: number | null = null;
  let current: EditedNumbers | null = null;
  try {
    const m = measurePortion(portion, katoriMl);
    kcal = Math.round(m.nutrients.kcal);
    protein = Math.round(m.nutrients.proteinG);
    current = { grams: m.grams, ...m.nutrients };
  } catch {
    // Shown without numbers; the plate measures it again.
  }
  const check = confidence === 'low';
  const count = itemCount(portion);
  return (
    <li
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-nested bg-surface-2 p-3',
        check && 'ring-1 ring-divider',
      )}
      data-confidence={confidence}
    >
      <span className="min-w-0 flex-1">
        <span className="type-headline block text-[1.125rem] text-text-1">{f.name}</span>
        {f.ai?.ref ? <span className="type-caption block text-text-3">{f.ai.ref}</span> : null}
        {onChange && count && !editing ? (
          <CountStepper
            name={f.name}
            amount={amount}
            count={count}
            onCount={(c) => {
              const next = withCount(portion, c);
              if (next) onChange(next);
            }}
          />
        ) : (
          <span className="type-meta tabular block text-text-2">{amount}</span>
        )}
        {kcal !== null ? (
          <span className="mt-1 flex items-baseline gap-3">
            <span className="type-title tabular font-bold text-text-1">
              {kcal}
              <span className="type-meta ml-0.5 font-normal text-text-2">kcal</span>
            </span>
            <span className="type-headline tabular text-text-1">
              {protein} g<span className="type-meta ml-1 text-text-2">protein</span>
            </span>
          </span>
        ) : null}
        {onChange && current && !editing ? (
          <ServingField
            name={f.name}
            grams={current.grams}
            onGrams={(g) => {
              const next = resizedPortion(portion, g, katoriMl);
              if (next) onChange(next);
            }}
          />
        ) : null}
        {check ? (
          <span className="type-caption mt-1 flex items-center gap-1 font-semibold text-text-1">
            <AlertCircle className="size-3.5" aria-hidden />
            Not sure about this one. Check it on your plate.
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <Source portion={portion} />
        {onChange && current && !editing ? (
          <TextLink small onClick={() => setEditing(true)} data-edit-ai-item>
            <Pencil className="mr-1 inline size-3.5" aria-hidden />
            Edit
          </TextLink>
        ) : null}
      </span>
      {editing && current && onChange ? (
        <ItemEditor
          name={f.name}
          start={current}
          onDone={(n) => {
            onChange(editedPortion(f.name, f.diet, n));
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : null}
    </li>
  );
}

/**
 * The serving in grams, right on the card: change it and the calories and macros follow, so
 * the amount is right before the food goes on the plate.
 */
function ServingField({
  name,
  grams,
  onGrams,
}: {
  name: string;
  grams: number;
  onGrams: (g: number) => void;
}) {
  return (
    <span className="mt-2 flex items-center gap-2" data-ai-serving>
      <span className="type-meta text-text-2" aria-hidden>
        Serving
      </span>
      <NumberField
        label={`Serving of ${name} in grams`}
        hideLabel
        value={Math.round(grams)}
        onValueChange={(v) => {
          if (v !== null && v > 0 && v <= MAX_SERVING_G) onGrams(v);
        }}
        allowDecimal={false}
        min={1}
        max={MAX_SERVING_G}
        unit="g"
        // The card is the same grey as a field: a darker box shows where to type.
        className="w-28 [&>div]:bg-surface"
      />
    </span>
  );
}

function Source({ portion }: { portion: FoodPortion }) {
  const ai = portion.food.ai;
  const [icon, label] = !ai
    ? [<Check key="i" className="size-3.5" aria-hidden />, 'Library']
    : ai.basis === 'yours'
      ? [<UserRound key="i" className="size-3.5" aria-hidden />, 'Your numbers']
      : ai.basis === 'web'
        ? [<Globe key="i" className="size-3.5" aria-hidden />, 'From the web']
        : ai.basis === 'label'
          ? [<ScanText key="i" className="size-3.5" aria-hidden />, 'From the label']
          : ai.basis === 'photo'
            ? [<Camera key="i" className="size-3.5" aria-hidden />, 'From the photo']
            : [<Sparkles key="i" className="size-3.5" aria-hidden />, 'Estimated'];
  return (
    <span className="type-caption inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-1 font-semibold text-text-2">
      {icon}
      {label}
    </span>
  );
}

const FIELDS: { key: keyof EditedNumbers; label: string; unit: string; max: number }[] = [
  { key: 'grams', label: 'Amount', unit: 'g', max: 5000 },
  { key: 'kcal', label: 'Calories', unit: 'kcal', max: 9000 },
  { key: 'proteinG', label: 'Protein', unit: 'g', max: 1000 },
  { key: 'carbsG', label: 'Carbs', unit: 'g', max: 1000 },
  { key: 'fatG', label: 'Fat', unit: 'g', max: 1000 },
  { key: 'fibreG', label: 'Fibre', unit: 'g', max: 500 },
];

/**
 * Correct a food's numbers for the amount eaten. Changing only the amount scales the rest;
 * anything typed is kept exactly.
 */
function ItemEditor({
  name,
  start,
  onDone,
  onCancel,
}: {
  name: string;
  start: EditedNumbers;
  onDone: (n: EditedNumbers) => void;
  onCancel: () => void;
}) {
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const [vals, setVals] = useState<Record<keyof EditedNumbers, number | null>>({
    grams: Math.round(start.grams),
    kcal: Math.round(start.kcal),
    proteinG: round1(start.proteinG),
    carbsG: round1(start.carbsG),
    fatG: round1(start.fatG),
    fibreG: round1(start.fibreG),
  });
  const [touched, setTouched] = useState<Set<keyof EditedNumbers>>(new Set());
  const [filled, setFilled] = useState(false);
  const set = (k: keyof EditedNumbers) => (v: number | null) => {
    const now = new Set(touched).add(k);
    setTouched(now);
    setVals((o) => {
      // A new amount scales every number the person has not typed.
      if (k === 'grams' && v && o.grams) {
        const f = v / o.grams;
        const scaled = { ...o, grams: v };
        for (const key of ['kcal', 'proteinG', 'carbsG', 'fatG', 'fibreG'] as const)
          if (!touched.has(key) && o[key] !== null)
            scaled[key] = key === 'kcal' ? Math.round(o[key]! * f) : round1(o[key]! * f);
        return scaled;
      }
      const next = { ...o, [k]: v };
      // New calories or protein: carbs and fat the person has not typed follow them, split
      // the way the suggested food splits them.
      if ((k === 'kcal' || k === 'proteinG') && !(now.has('carbsG') && now.has('fatG'))) {
        const m = fillMacros(next.kcal, next.proteinG, start);
        if (m) {
          if (!now.has('carbsG')) next.carbsG = m.carbsG;
          if (!now.has('fatG')) next.fatG = m.fatG;
          setFilled(true);
        }
      }
      return next;
    });
  };
  const ready = FIELDS.every((fl) => vals[fl.key] !== null) && (vals.grams ?? 0) > 0;
  return (
    <div className="w-full border-t-[0.5px] border-divider pt-3" data-ai-item-editor>
      <p className="type-meta mb-2 text-text-2">{name}: the numbers for what you ate.</p>
      <div className="grid grid-cols-3 gap-2 [&>div>div]:bg-surface">
        {FIELDS.map((fl) => (
          <NumberField
            key={fl.key}
            label={fl.label}
            value={vals[fl.key]}
            onValueChange={set(fl.key)}
            allowDecimal={fl.key !== 'grams' && fl.key !== 'kcal'}
            min={fl.key === 'grams' ? 1 : 0}
            max={fl.max}
            unit={fl.unit}
          />
        ))}
      </div>
      {filled ? (
        <p className="type-caption mt-2 text-text-2" data-macros-filled>
          Carbs and fat follow your calories and protein. Change them if you know them.
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-3">
        <PrimaryButton
          compact
          disabled={!ready}
          onClick={() => onDone(vals as unknown as EditedNumbers)}
          data-save-ai-item
        >
          Use these numbers
        </PrimaryButton>
        <TextLink small onClick={onCancel}>
          Cancel
        </TextLink>
      </div>
    </div>
  );
}

/**
 * How many of the item, with - and + right next to it: the photo saw 3 rotis and there were 4.
 * One tap changes the count, and the calories and macros follow.
 */
function CountStepper({
  name,
  amount,
  count,
  onCount,
}: {
  name: string;
  amount: string;
  count: { count: number; step: number };
  onCount: (c: number) => void;
}) {
  const less = count.count - count.step;
  const more = count.count + count.step;
  const btn =
    'pressable tap-target inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-text-1 disabled:opacity-40';
  return (
    <span className="mt-1 flex items-center gap-2" data-ai-count>
      <button
        type="button"
        className={btn}
        onClick={() => onCount(less)}
        disabled={less < count.step - 1e-9}
        aria-label={`One less ${name}`}
        data-ai-less
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="type-headline tabular min-w-0 text-text-1" aria-live="polite">
        {amount}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onCount(more)}
        disabled={more > MAX_COUNT}
        aria-label={`One more ${name}`}
        data-ai-more
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </span>
  );
}
