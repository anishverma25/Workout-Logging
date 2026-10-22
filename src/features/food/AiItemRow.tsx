import { AlertCircle, Camera, Check, Globe, ScanText, Sparkles } from 'lucide-react';
import { measurePortion, type FoodPortion } from '@/data/repositories/food';
import { portionText } from '@/domain/nutrition/calc';
import { cn } from '@/lib/cn';

/** One food OverloadGPT found, with where its numbers come from and how sure it is. */
export function AiItemRow({
  portion,
  katoriMl,
  confidence,
}: {
  portion: FoodPortion;
  katoriMl: number | null;
  confidence?: 'high' | 'medium' | 'low';
}) {
  const f = portion.food;
  const amount =
    f.ai && portion.unit === 'serving'
      ? `${f.ai.portion} (${f.servingG} g)`
      : portionText(portion.amount, portion.unit, portion.size, f.pieceName);
  let kcal: number | null = null;
  let protein: number | null = null;
  try {
    const m = measurePortion(portion, katoriMl);
    kcal = Math.round(m.nutrients.kcal);
    protein = Math.round(m.nutrients.proteinG);
  } catch {
    // Shown without numbers; the plate measures it again.
  }
  const check = confidence === 'low';
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-nested bg-surface-2 p-3',
        check && 'ring-1 ring-divider',
      )}
      data-confidence={confidence}
    >
      <span className="min-w-0 flex-1">
        <span className="type-headline block text-[1.125rem] text-text-1">{f.name}</span>
        {f.ai?.ref ? <span className="type-caption block text-text-3">{f.ai.ref}</span> : null}
        <span className="type-meta tabular block text-text-2">{amount}</span>
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
        {check ? (
          <span className="type-caption mt-1 flex items-center gap-1 font-semibold text-text-1">
            <AlertCircle className="size-3.5" aria-hidden />
            Not sure about this one. Check it on your plate.
          </span>
        ) : null}
      </span>
      <Source portion={portion} />
    </li>
  );
}

function Source({ portion }: { portion: FoodPortion }) {
  const ai = portion.food.ai;
  const [icon, label] = !ai
    ? [<Check key="i" className="size-3.5" aria-hidden />, 'Library']
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
