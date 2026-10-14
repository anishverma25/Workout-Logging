import { useEffect } from 'react';
import { formatRecordValue, PR_LABELS, type PrType } from '@/domain/analytics/prs';
import type { WeightUnit } from '@/lib/units';
import { MedalIcon } from '../medals/Medal';

export interface MedalNews {
  key: number;
  exerciseName: string;
  medals: { type: PrType; value: number }[];
}

/**
 * The live record alert: drops in at the top of the workout for a few seconds when a set
 * beats the person's best. Announced to screen readers; tap to dismiss.
 */
export function MedalAlert({
  news,
  unit,
  onDone,
}: {
  news: MedalNews | null;
  unit: WeightUnit;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!news) return;
    const t = window.setTimeout(onDone, 4000);
    return () => window.clearTimeout(t);
  }, [news, onDone]);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 flex justify-center px-3"
    >
      {news ? (
        <button
          key={news.key}
          type="button"
          onClick={onDone}
          className="medal-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-panel border border-gold/40 bg-surface-2 px-4 py-3 text-left"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-dim">
            <MedalIcon className="size-7" />
          </span>
          <span className="min-w-0">
            <span className="type-caption block font-semibold text-gold">
              {news.medals.length > 1 ? `${news.medals.length} new records` : 'New record'}
            </span>
            <span className="type-headline block truncate text-text-1">{news.exerciseName}</span>
            <span className="type-meta tabular block truncate text-text-2">
              {news.medals
                .map((m) => `${PR_LABELS[m.type]} ${formatRecordValue(m.type, m.value, unit)}`)
                .join(' · ')}
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}
