import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export interface RingSpec {
  /** 1, 2 or 3: outer to inner, drawn lime at 100%, 60% and 30%. */
  hue: 1 | 2 | 3;
  value: number;
  target: number;
  label: string;
}

const STROKE = 12;
const GAP = 6;

/**
 * Concentric progress rings (UI Part 3): 12px thick, 6px apart, round caps, --grid tracks,
 * lime at 100%, 60% and 30%. Each ring fills to value / target, capped at one turn. The numbers
 * always appear as text in the legend, so colour is never the only cue.
 */
export function Rings({
  rings,
  size = 132,
  className,
}: {
  rings: RingSpec[];
  size?: number;
  className?: string;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={cn('shrink-0 -rotate-90', className)}
      aria-hidden
    >
      {rings.map((r, i) => {
        const radius = size / 2 - STROKE / 2 - i * (STROKE + GAP);
        if (radius <= 0) return null;
        const circumference = 2 * Math.PI * radius;
        const fraction = r.target > 0 ? Math.min(1, Math.max(0, r.value / r.target)) : 0;
        // A tiny visible dot for a started-but-small ring, nothing for zero.
        const shown = fraction === 0 ? 0 : Math.max(fraction, 0.012);
        return (
          <g key={r.hue}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={STROKE}
              stroke="var(--grid)"
            />
            <circle
              className="ring-arc"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              stroke={`var(--ring-${r.hue})`}
              strokeDasharray={circumference}
              strokeDashoffset={drawn ? circumference * (1 - shown) : circumference}
              style={{ transitionDelay: `${i * 90}ms`, opacity: shown === 0 ? 0 : 1 }}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** The legend that goes with the rings: label with its ring's colour dot, value and target. */
export function RingLegend({
  rings,
  format = (n) => n.toLocaleString('en-GB'),
  className,
}: {
  rings: (RingSpec & { unit?: string })[];
  format?: (n: number) => string;
  className?: string;
}) {
  return (
    <dl className={cn('flex flex-col gap-3', className)}>
      {rings.map((r) => (
        <div key={r.hue} className="min-w-0">
          <dt className="type-meta flex items-center gap-1.5 text-text-2">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: `var(--ring-${r.hue})` }}
            />
            {r.label}
          </dt>
          <dd className="tabular flex items-baseline">
            <span className="type-stat text-text-1">{format(r.value)}</span>
            <span className="type-meta text-text-2">
              /{format(r.target)}
              {r.unit ? <span className="ml-0.5">{r.unit}</span> : null}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
