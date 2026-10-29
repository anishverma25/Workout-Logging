import { BODY_AREAS, type BodyArea } from '@/domain/analytics/bodyMap';
import { BODY, type BodyView } from './bodyData';

const AREAS = new Set<string>(BODY_AREAS);
const FILL = {
  0: 'var(--muscle-rest)',
  1: 'var(--muscle-1)',
  2: 'var(--muscle-2)',
  3: 'var(--muscle-3)',
} as const;

function Figure({
  view,
  levels,
  label,
}: {
  view: BodyView;
  levels: Map<BodyArea, 1 | 2 | 3>;
  label: string;
}) {
  return (
    <figure className="m-0 flex min-w-0 flex-1 flex-col items-center">
      <svg
        viewBox={view.viewBox}
        className="h-auto w-full max-w-[9.5rem]"
        role="img"
        aria-label={label}
        preserveAspectRatio="xMidYMid meet"
      >
        {view.parts.map((part) => {
          const known = AREAS.has(part.slug);
          const level = known ? (levels.get(part.slug as BodyArea) ?? 0) : null;
          return (
            <g
              key={part.slug}
              fill={level === null ? 'var(--body-detail)' : FILL[level]}
              data-area={known ? part.slug : undefined}
              data-level={level ?? undefined}
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
      <figcaption className="type-caption mt-1 text-text-2">{label}</figcaption>
    </figure>
  );
}

/**
 * The body from the front and the back, each muscle shaded by how much of the workout went to
 * it. The figure follows the sex in the person's profile.
 */
export function BodyMap({
  levels,
  sex,
}: {
  levels: Map<BodyArea, 1 | 2 | 3>;
  sex: 'male' | 'female';
}) {
  const body = BODY[sex];
  return (
    <div className="flex items-start justify-center gap-4" data-body-map>
      <Figure view={body.front} levels={levels} label="Front" />
      <Figure view={body.back} levels={levels} label="Back" />
    </div>
  );
}

export default BodyMap;
