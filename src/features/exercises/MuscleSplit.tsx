import { lazy, Suspense, useMemo } from 'react';
import type { ExerciseShares } from '@/data/library/muscleShares';
import { sharesSummary, shortRegion } from '@/data/library/shares';
import { exerciseLevels, leadsFromBehind, shareRole } from '@/domain/analytics/bodyMap';
import { cn } from '@/lib/cn';
import { ROLE_FILL, useBodySex, useGrown } from './muscleRoles';

// The drawings are large, so they load only when an exercise with shares is on screen.
const MiniBody = lazy(() => import('@/components/body/MiniBody'));

/** A small body shaded for one exercise. */
export function ExerciseBody({
  shares,
  show,
  className,
}: {
  shares: ExerciseShares;
  show?: 'front' | 'back' | 'both';
  className?: string;
}) {
  const sex = useBodySex();
  const levels = useMemo(() => exerciseLevels(shares.regions), [shares]);
  const side = show ?? (leadsFromBehind(shares.regions) ? 'back' : 'front');
  return (
    <span className={cn('block shrink-0', className)} aria-hidden>
      <Suspense fallback={null}>
        <MiniBody levels={levels} sex={sex} show={side} />
      </Suspense>
    </span>
  );
}

/** One thin bar split by muscle, each piece in its role's shade. */
export function MuscleStrip({ shares, className }: { shares: ExerciseShares; className?: string }) {
  const grown = useGrown();
  return (
    <span className={cn('flex h-1.5 gap-0.5 overflow-hidden rounded-full', className)} aria-hidden>
      {shares.regions.map((r, i) => (
        <span
          key={r.region}
          className="score-grow block h-full"
          style={{
            width: grown ? `${r.share}%` : 0,
            background: ROLE_FILL[shareRole(i, r.share)],
          }}
        />
      ))}
    </span>
  );
}

/** "Mid chest 35% · Triceps 20% · +3 more", the leading muscles in bold. */
export function MuscleLine({ shares, top = 2 }: { shares: ExerciseShares; top?: number }) {
  // One text, so a long line ends in an ellipsis inside the row and nothing runs off screen.
  return (
    <span className="type-meta tabular block truncate text-text-2">
      {sharesSummary(shares, top)}
    </span>
  );
}

/**
 * The logger's muscles line: small chips with each leading muscle and its share, shaded by role.
 * Tapping opens the full breakdown.
 */
export function MusclesPanel({ shares, onOpen }: { shares: ExerciseShares; onOpen: () => void }) {
  const top = shares.regions.slice(0, 2);
  const more = shares.regions.length - top.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="pressable chrome mt-2 flex max-w-full flex-nowrap items-center overflow-hidden gap-1.5 text-left"
      aria-label={`Muscles worked: ${top.map((r) => `${shortRegion(r.region)} ${r.share}%`).join(', ')}. Show the breakdown`}
      data-muscles-panel
    >
      {top.map((r, i) => (
        <span
          key={r.region}
          className="type-caption inline-flex h-6 items-center gap-1.5 rounded-full bg-fill px-2.5 whitespace-nowrap text-text-1"
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: ROLE_FILL[shareRole(i, r.share)] }}
            aria-hidden
          />
          {shortRegion(r.region)}
          <span className="tabular font-semibold">{r.share}%</span>
        </span>
      ))}
      {more > 0 ? (
        <span className="type-caption inline-flex h-6 items-center rounded-full px-1.5 text-text-2">
          +{more}
        </span>
      ) : null}
    </button>
  );
}
