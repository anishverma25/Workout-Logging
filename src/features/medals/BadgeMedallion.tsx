import { useId } from 'react';
import { badgeStamp, type Badge } from '@/domain/achievements/badges';
import { cn } from '@/lib/cn';

/**
 * Badges 2.0 (approved design, Project doc `claude/badges-design-preview.html`): one shape per
 * family so a badge says what it is for, a metal per tier, and locked badges as dark glass with
 * a ring showing how close they are. Drawn in code, so it works offline.
 */

export type BadgeShape = 'workouts' | 'streaks' | 'medals' | 'round' | 'bodyweight' | 'habits';

/** The family's outline in a 100 by 100 box. */
export const SHAPES: Record<BadgeShape, string> = {
  workouts: 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z',
  streaks:
    'M50 3 C62 18 84 30 84 58 C84 80 68 96 50 96 C32 96 16 80 16 58 C16 40 28 30 34 18 C38 30 44 34 48 34 C46 22 46 12 50 3 Z',
  medals: 'M50 3 L61 30 L91 32 L68 51 L76 81 L50 65 L24 81 L32 51 L9 32 L39 30 Z',
  round: 'M50 3 A47 47 0 1 1 49.9 3 Z',
  bodyweight: 'M50 3 L88 16 L88 50 C88 73 71 89 50 97 C29 89 12 73 12 50 L12 16 Z',
  habits: 'M28 6 H72 C85 6 94 15 94 28 V72 C94 85 85 94 72 94 H28 C15 94 6 85 6 72 V28 C6 15 15 6 28 6 Z',
};

/** A small mark above the number, per family (stars carry none: no room). */
const GLYPH: Partial<Record<BadgeShape, string>> = {
  workouts: 'M30 46 h6 v-8 h6 v24 h-6 v-8 h-6z M58 38 h6 v8 h6 v8 h-6 v8 h-6z M42 47 h16 v6 h-16z',
  streaks:
    'M50 30 C55 37 60 41 60 49 C60 56 55 61 50 61 C45 61 40 56 40 49 C40 44 43 42 45 38 C46 42 48 43 50 43 C49 39 49 34 50 30z',
  round: 'M50 33 A13 13 0 1 1 49.9 33z M50 43 A3 3 0 1 0 50.1 43z',
  bodyweight: 'M50 31 A5 5 0 1 1 49.9 31z M42 41 h16 l-3 10 h-3 l1 12 h-6 l1 -12 h-3z',
  habits: 'M38 48 l8 8 l16 -16 l4 4 l-20 20 l-12 -12z',
};

/**
 * Where the number sits in each shape (its centre line) and how wide it may run, so numbers
 * always stay inside the outline. Checked at every length the badges use.
 */
export const FIT: Record<BadgeShape, { cy: number; w: number }> = {
  workouts: { cy: 56, w: 50 },
  streaks: { cy: 66, w: 42 },
  medals: { cy: 52, w: 30 },
  round: { cy: 56, w: 54 },
  bodyweight: { cy: 55, w: 52 },
  habits: { cy: 56, w: 58 },
};

export function badgeShape(b: Pick<Badge, 'group' | 'id'>): BadgeShape {
  if (b.id.startsWith('bw-')) return 'bodyweight';
  switch (b.group) {
    case 'workouts':
      return 'workouts';
    case 'streaks':
      return 'streaks';
    case 'medals':
      return 'medals';
    case 'habits':
      return 'habits';
    default:
      return 'round';
  }
}

/** Font sizes for the stamp: the number fits the shape's width, the word fits under it. */
export function stampLayout(shape: BadgeShape, big: string, small: string) {
  const f = FIT[shape];
  const word = shape === 'medals' ? '' : small;
  const bigSize = Math.min(shape === 'medals' ? 21 : 28, f.w / (Math.max(1, [...big].length) * 0.62));
  const smallSize = Math.min(7.6, (f.w * 1.15) / (Math.max(1, word.length) * 0.56));
  const bigY = f.cy + bigSize * 0.36 - (word ? 3 : 0);
  const smallY = f.cy + bigSize * 0.36 + smallSize + 0.5;
  const glyphTop = f.cy - bigSize * 0.5 - (word ? 4 : 0) - 9;
  return { bigSize, smallSize, bigY, smallY, glyphTop, word };
}

export function BadgeMedallion({
  badge,
  className,
  still,
}: {
  badge: Badge;
  className?: string;
  /** No moving shine, for small lists. */
  still?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const earned = badge.earnedAt !== null;
  const shape = badgeShape(badge);
  const outline = SHAPES[shape];
  const { big, small } = badgeStamp(badge);
  const l = stampLayout(shape, big, small);
  const tier = badge.tier;
  const holo = tier === 'legend';
  const progress = Math.min(1, badge.current / Math.max(1, badge.target));
  const ring = 2 * Math.PI * 48;
  const ink = earned ? `var(--tier-${tier}-ink)` : 'var(--text-2)';
  const shine = earned && !still && (tier === 'gold' || tier === 'legend');
  const plates = earned && shape === 'round';

  return (
    <svg viewBox="0 0 100 100" className={cn('shrink-0 overflow-visible', className)} aria-hidden data-badge-shape={shape}>
      <defs>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
          {holo ? (
            <>
              <stop offset="0" stopColor="var(--tier-legend-a)" />
              <stop offset="0.35" stopColor="var(--tier-legend-b)" />
              <stop offset="0.65" stopColor="var(--tier-legend-c)" />
              <stop offset="1" stopColor="var(--tier-legend-d)" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor={`var(--tier-${tier}-a)`} />
              <stop offset="0.55" stopColor={`var(--tier-${tier}-b)`} />
              <stop offset="1" stopColor={`var(--tier-${tier}-c)`} />
            </>
          )}
        </linearGradient>
        <radialGradient id={`h${id}`} cx="0.3" cy="0.22" r="0.7">
          <stop offset="0" stopColor="var(--text-1)" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="var(--text-1)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`c${id}`}>
          <path d={outline} />
        </clipPath>
      </defs>

      {!earned ? (
        <>
          <circle cx="50" cy="50" r="48" fill="none" stroke="var(--track)" strokeWidth="2.5" />
          {progress > 0 ? (
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="var(--lime)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={`${ring * progress} ${ring}`}
              transform="rotate(-90 50 50)"
            />
          ) : null}
        </>
      ) : null}

      <g transform={earned ? undefined : 'translate(50 50) scale(0.8) translate(-50 -50)'}>
        {earned ? <path d={outline} fill={`var(--tier-${tier}-b)`} opacity="0.35" transform="translate(0 3)" /> : null}
        <path
          d={outline}
          fill={earned ? `url(#m${id})` : 'var(--fill)'}
          className={holo && earned && !still ? 'badge-holo' : undefined}
          stroke={earned ? 'var(--text-1)' : 'var(--border-strong)'}
          strokeOpacity={earned ? 0.55 : 1}
          strokeWidth={earned ? 1.6 : 1.2}
        />
        {earned ? <path d={outline} fill={`url(#h${id})`} /> : null}
        {plates ? (
          <g fill={`var(--tier-${tier}-ink)`} fillOpacity="0.35">
            <circle cx="50" cy="50" r="36" fill="none" stroke={`var(--tier-${tier}-ink)`} strokeOpacity="0.28" strokeWidth="2" />
            <circle cx="91" cy="50" r="2.4" />
            <circle cx="50" cy="91" r="2.4" />
            <circle cx="9" cy="50" r="2.4" />
            <circle cx="50" cy="9" r="2.4" />
          </g>
        ) : null}
        {shine ? (
          <g clipPath={`url(#c${id})`}>
            <rect className="badge-sheen" x="20" y="-20" width="16" height="140" fill="var(--text-1)" opacity="0.45" />
          </g>
        ) : null}
        {GLYPH[shape] ? (
          <g transform={`translate(50 ${l.glyphTop.toFixed(2)}) scale(0.3) translate(-50 -46)`}>
            <path d={GLYPH[shape]} fill={ink} opacity={earned ? 0.82 : 0.7} />
          </g>
        ) : null}
        <text
          x="50"
          y={l.bigY.toFixed(2)}
          textAnchor="middle"
          fontFamily="'Inter Display', 'Inter', sans-serif"
          fontWeight="700"
          fontSize={l.bigSize.toFixed(1)}
          letterSpacing="-0.5"
          fill={ink}
          className="tabular"
        >
          {big}
        </text>
        {l.word ? (
          <text
            x="50"
            y={l.smallY.toFixed(2)}
            textAnchor="middle"
            fontFamily="'Inter', sans-serif"
            fontWeight="600"
            fontSize={l.smallSize.toFixed(1)}
            fill={ink}
            opacity="0.8"
          >
            {l.word}
          </text>
        ) : null}
      </g>
    </svg>
  );
}
