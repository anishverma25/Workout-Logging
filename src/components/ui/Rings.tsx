import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/cn';

export interface RingSpec {
  /** 1, 2 or 3: picks the ring's colour family (training, effort, time). */
  hue: 1 | 2 | 3;
  value: number;
  target: number;
  label: string;
}

/**
 * Concentric progress rings. The outermost ring is the first one. Each ring fills to
 * value / target (capped at one full turn); the numbers are always shown as text next to the
 * rings, so colour is never the only carrier of the information.
 */
export function Rings({
  rings,
  size = 168,
  className,
}: {
  rings: RingSpec[];
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const stroke = Math.round(size * 0.115);
  const gap = Math.max(2, Math.round(size * 0.018));
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
      <defs>
        {rings.map((r) => (
          <linearGradient key={r.hue} id={`${id}-g${r.hue}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: `var(--ring-${r.hue})` }} />
            <stop offset="100%" style={{ stopColor: `var(--ring-${r.hue}-to)` }} />
          </linearGradient>
        ))}
      </defs>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap);
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
              strokeWidth={stroke}
              style={{ stroke: 'var(--ring-track)' }}
            />
            <circle
              className="ring-arc"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              stroke={`url(#${id}-g${r.hue})`}
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

/** The legend that goes with the rings: label, value and target, in the ring's colour. */
export function RingLegend({
  rings,
  format = (n) => n.toLocaleString(),
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
          <dt className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: `var(--ring-${r.hue})` }}
            />
            {r.label}
          </dt>
          <dd className="tabular font-display text-[1.6rem] font-semibold leading-tight tracking-tight">
            {format(r.value)}
            <span className="text-[1.05rem] font-medium text-faint">
              /{format(r.target)}
              {r.unit ? <span className="ml-0.5">{r.unit}</span> : null}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
