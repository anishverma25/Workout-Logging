import { ChevronLeft, ChevronRight } from 'lucide-react';

export function DayNav({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: (() => void) | null;
}) {
  const btn =
    'pressable tap-target inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-text-1 disabled:opacity-40';
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" className={btn} onClick={onPrev} aria-label="Previous day">
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <h2 className="type-headline text-text-1" aria-live="polite" data-food-day>
        {label}
      </h2>
      <button
        type="button"
        className={btn}
        onClick={onNext ?? undefined}
        disabled={!onNext}
        aria-label="Next day"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}
