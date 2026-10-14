import { useId } from 'react';
import { badgeStamp, type Badge } from '@/domain/achievements/badges';
import { cn } from '@/lib/cn';

/** Octagon points around (50, 50). */
function octagon(r: number, cx = 50, cy = 50): [number, number][] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = ((i * 45 + 22.5) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}
const points = (r: number) =>
  octagon(r)
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');

/**
 * A badge: an octagonal medallion in its tier's metal with the number it stands for. Locked
 * badges are grey, with a lime ring showing how close they are.
 */
export function BadgeMedallion({ badge, className }: { badge: Badge; className?: string }) {
  const id = useId().replace(/:/g, '');
  const earned = badge.earnedAt !== null;
  const { big, small } = badgeStamp(badge);
  const progress = Math.min(1, badge.current / badge.target);
  const ring = 2 * Math.PI * 48;
  const size = big.length >= 4 ? 22 : big.length === 3 ? 27 : 32;
  return (
    <svg viewBox="0 0 100 100" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`var(--tier-${badge.tier}-1)`} />
          <stop offset="1" stopColor={`var(--tier-${badge.tier}-2)`} />
        </linearGradient>
      </defs>
      {!earned ? (
        <>
          <circle cx="50" cy="50" r="48" fill="none" stroke="var(--track)" strokeWidth="3" />
          {progress > 0 ? (
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="var(--lime)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${ring * progress} ${ring}`}
              transform="rotate(-90 50 50)"
            />
          ) : null}
        </>
      ) : null}
      <polygon
        points={points(earned ? 46 : 40)}
        fill={earned ? `url(#g${id})` : 'var(--surface-2)'}
        strokeLinejoin="round"
      />
      <polygon
        points={points(earned ? 38 : 33)}
        fill="none"
        stroke={earned ? 'rgba(0,0,0,0.22)' : 'var(--border-strong)'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <text
        x="50"
        y={small ? 54 : 58}
        textAnchor="middle"
        fontFamily="'Inter Display', 'Inter', sans-serif"
        fontWeight="700"
        fontSize={earned ? size : size * 0.86}
        fill={earned ? 'var(--on-gold)' : 'var(--text-3)'}
      >
        {big}
      </text>
      {small ? (
        <text
          x="50"
          y={earned ? 69 : 66}
          textAnchor="middle"
          fontFamily="'Inter', sans-serif"
          fontWeight="600"
          fontSize={earned ? 9.5 : 8.5}
          letterSpacing="0.04em"
          fill={earned ? 'rgba(0,0,0,0.7)' : 'var(--text-3)'}
        >
          {small}
        </text>
      ) : null}
    </svg>
  );
}
