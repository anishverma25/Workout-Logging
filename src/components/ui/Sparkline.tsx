import { useId } from 'react';
import { cn } from '@/lib/cn';

interface SparklineProps {
  values: number[];
  /** Accessible description of what the line shows. */
  label: string;
  className?: string;
  tone?: 'accent' | 'data';
  /** Mark the final point (the latest value). */
  emphasizeLast?: boolean;
}

/** Minimal trend line drawn from real values. Renders nothing for fewer than two points. */
export function Sparkline({
  values,
  label,
  className,
  tone = 'accent',
  emphasizeLast = true,
}: SparklineProps) {
  const gradientId = useId();
  if (values.length < 2) return null;
  const w = 120;
  const h = 36;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (w - pad * 2),
    h - pad - ((v - min) / span) * (h - pad * 2),
  ]);
  const line = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x!.toFixed(1)},${y!.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${pts[pts.length - 1]![0]!.toFixed(1)},${h} L${pts[0]![0]!.toFixed(1)},${h} Z`;
  const last = pts[pts.length - 1]!;
  const color = tone === 'accent' ? 'var(--accent-text)' : 'var(--data-2)';

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      className={cn('h-9 w-28', className)}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {emphasizeLast ? <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} /> : null}
    </svg>
  );
}
