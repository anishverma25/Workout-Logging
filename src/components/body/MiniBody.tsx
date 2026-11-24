import type { BodyArea } from '@/domain/analytics/bodyMap';
import { BODY_AREAS } from '@/domain/analytics/bodyMap';
import { BODY, type BodyView } from './bodyData';

const AREAS = new Set<string>(BODY_AREAS);
const FILL = {
  0: 'var(--muscle-rest)',
  1: 'var(--muscle-1)',
  2: 'var(--muscle-2)',
  3: 'var(--muscle-3)',
} as const;

function View({
  view,
  levels,
  colors,
}: {
  view: BodyView;
  levels: Map<BodyArea, 1 | 2 | 3>;
  colors?: Map<BodyArea, string>;
}) {
  return (
    <svg
      viewBox={view.viewBox}
      className="h-full w-auto"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      {view.parts.map((part) => {
        const known = AREAS.has(part.slug);
        const level = known ? (levels.get(part.slug as BodyArea) ?? 0) : null;
        const color = known ? colors?.get(part.slug as BodyArea) : undefined;
        return (
          <g
            key={part.slug}
            fill={level === null ? 'var(--body-detail)' : (color ?? FILL[level])}
            className={color ? 'transition-[fill] duration-500' : undefined}
          >
            {part.paths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        );
      })}
      <path
        d={view.outline}
        fill="none"
        stroke="var(--body-outline)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** A small body (front, back or both) shaded for one exercise: for list rows and the logger. */
export default function MiniBody({
  levels,
  sex = 'male',
  show,
  colors,
}: {
  levels: Map<BodyArea, 1 | 2 | 3>;
  /** A colour per area in place of the lime shades (Progress, ready to train). */
  colors?: Map<BodyArea, string>;
  sex?: 'male' | 'female';
  show: 'front' | 'back' | 'both';
}) {
  const body = BODY[sex];
  return (
    <span className="flex h-full items-center justify-center gap-px" data-mini-body={show}>
      {show !== 'back' ? <View view={body.front} levels={levels} colors={colors} /> : null}
      {show !== 'front' ? <View view={body.back} levels={levels} colors={colors} /> : null}
    </span>
  );
}
