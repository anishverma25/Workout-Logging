import type { ReactNode } from 'react';
import type { Experience, Goal } from '@/domain/models/schemas';

/**
 * Small duotone drawings (lime on near-black) for the setup choices, so picking a goal or a
 * level reads as a picture first and a sentence second. Colours come from tokens; every drawing
 * is decorative (the label next to it says the same thing).
 */

const LIME = 'var(--lime)';
const DIM = 'var(--lime-dim)';
const INK = 'var(--text-3)';
const FILL = 'var(--fill)';

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg
      viewBox="0 0 160 96"
      className="h-full w-full"
      aria-hidden
      focusable="false"
      data-setup-art={label}
    >
      <defs>
        <radialGradient id={`glow-${label}`} cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor={LIME} stopOpacity="0.28" />
          <stop offset="100%" stopColor={LIME} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="96" rx="14" fill={FILL} />
      <rect width="160" height="96" rx="14" fill={`url(#glow-${label})`} />
      {children}
    </svg>
  );
}

/** A barbell seen from the front: plates on each side, bigger for heavier goals. */
function Barbell({ y = 52, plates = 2, w = 120 }: { y?: number; plates?: number; w?: number }) {
  const x0 = (160 - w) / 2;
  const sizes = [30, 24, 18].slice(0, plates);
  return (
    <g>
      <rect x={x0} y={y - 2} width={w} height="4" rx="2" fill={INK} />
      {sizes.map((h, i) => (
        <g key={i}>
          <rect x={x0 + 10 + i * 7} y={y - h / 2} width="6" height={h} rx="2" fill={LIME} />
          <rect x={x0 + w - 16 - i * 7} y={y - h / 2} width="6" height={h} rx="2" fill={LIME} />
        </g>
      ))}
    </g>
  );
}

const GOAL_ART: Record<Goal, () => ReactNode> = {
  // Muscle: a flexed arm drawn as one curve, with growth rings behind.
  hypertrophy: () => (
    <Frame label="hypertrophy">
      <circle cx="80" cy="50" r="30" fill="none" stroke={DIM} strokeWidth="6" />
      <circle cx="80" cy="50" r="18" fill="none" stroke={DIM} strokeWidth="4" />
      <path
        d="M52 70 C 52 52, 60 40, 72 34 C 80 30, 90 30, 96 38 C 101 44, 98 52, 90 54 L 84 55 C 92 58, 104 56, 108 46"
        fill="none"
        stroke={LIME}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  ),
  strength: () => (
    <Frame label="strength">
      <Barbell plates={3} />
      <path
        d="M80 18 v14 M73 25 l7 -7 l7 7"
        stroke={LIME}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  ),
  strength_hypertrophy: () => (
    <Frame label="strength_hypertrophy">
      <Barbell plates={2} y={60} />
      <circle cx="80" cy="32" r="14" fill="none" stroke={DIM} strokeWidth="5" />
      <path
        d="M72 34 c4 -8 12 -8 16 0"
        stroke={LIME}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
    </Frame>
  ),
  // Fat loss: a falling trend line that eases off, with a soft flame.
  fat_loss: () => (
    <Frame label="fat_loss">
      <path
        d="M24 30 C 52 34, 70 50, 90 58 S 126 68, 136 68"
        fill="none"
        stroke={LIME}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {[24, 57, 90, 120].map((x, i) => (
        <circle key={x} cx={x} cy={[30, 44, 58, 66][i]} r="4" fill={LIME} />
      ))}
      <path
        d="M124 26 c6 6 8 12 2 18 c-2 -6 -6 -6 -6 -2 c-6 -4 -4 -12 4 -16z"
        fill={DIM}
        stroke={LIME}
        strokeWidth="2"
      />
    </Frame>
  ),
  // Recomposition: one line down (fat), one line up (muscle), crossing.
  recomposition: () => (
    <Frame label="recomposition">
      <path
        d="M28 28 C 60 34, 92 58, 132 66"
        fill="none"
        stroke={INK}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M28 68 C 60 62, 92 38, 132 28"
        fill="none"
        stroke={LIME}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M124 22 l9 6 l-9 6"
        fill="none"
        stroke={LIME}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  ),
  general_fitness: () => (
    <Frame label="general_fitness">
      <circle cx="80" cy="48" r="30" fill="none" stroke={DIM} strokeWidth="6" />
      <path
        d="M30 50 h28 l6 -14 l10 28 l8 -22 l6 8 h42"
        fill="none"
        stroke={LIME}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  ),
};

/** Levels as steps: one, two or three lit, with a figure further up for each level. */
function Steps({ lit }: { lit: 1 | 2 | 3 }) {
  return (
    <Frame label={`level-${lit}`}>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={34 + i * 32}
          y={70 - (i + 1) * 14}
          width="30"
          height={(i + 1) * 14}
          rx="4"
          fill={i < lit ? LIME : DIM}
        />
      ))}
      <circle cx={49 + (lit - 1) * 32} cy={70 - lit * 14 - 12} r="6" fill={LIME} />
    </Frame>
  );
}

export function GoalArt({ goal }: { goal: Goal }) {
  return <>{GOAL_ART[goal]()}</>;
}

export function LevelArt({ level }: { level: Experience }) {
  return <Steps lit={level === 'beginner' ? 1 : level === 'intermediate' ? 2 : 3} />;
}
