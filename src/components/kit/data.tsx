import { memo, type ElementType, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatTileProps {
  label: string;
  /** The number, already formatted. Zero or unavailable shows "None yet". */
  value: ReactNode | null;
  /** Unit beside the value (kg, min), Meta --text-2. */
  unit?: string;
  /** Short caption under the value. */
  caption?: ReactNode;
  className?: string;
}

/** Label (Meta), value (Stat) with unit, optional caption. Used in 2 × 2 grids, gap 12. */
export function StatTile({ label, value, unit, caption, className }: StatTileProps) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className={cn('rounded-panel border border-border bg-surface p-4', className)}>
      <p className="type-meta text-text-2">{label}</p>
      {empty ? (
        <p className="type-headline mt-1.5 text-text-2">None yet</p>
      ) : (
        <p className="mt-1 flex items-baseline gap-1">
          <span className="type-stat text-text-1">{value}</span>
          {unit ? <span className="type-meta text-text-2">{unit}</span> : null}
        </p>
      )}
      {caption ? <p className="type-meta mt-1 text-text-2">{caption}</p> : null}
    </div>
  );
}

interface IconTileProps {
  icon: ReactNode;
  /** The Pro row is the only lime-dim tile. */
  pro?: boolean;
  className?: string;
}

/** 36 × 36, radius 10, surface-2, 20px icon in --text-2. */
export function IconTile({ icon, pro, className }: IconTileProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-tile [&>svg]:size-5',
        pro ? 'bg-lime-dim text-lime' : 'bg-surface-2 text-text-2',
        className,
      )}
    >
      {icon}
    </span>
  );
}

interface ListRowProps {
  title: ReactNode;
  /** Second line, Meta --text-2. Makes the row 56 high. */
  subtitle?: ReactNode;
  leading?: ReactNode;
  /** Right-aligned value, Meta --text-2 (tabular). */
  value?: ReactNode;
  /** A control on the right (a switch, a button). */
  trailing?: ReactNode;
  chevron?: boolean;
  to?: string;
  onClick?: () => void;
  /** Headline weight 600 (default) or 500 for settings labels. */
  titleWeight?: 600 | 500;
  className?: string;
}

/**
 * One- or two-line row: min height 44, 56 with a subtitle. A link when `to` is set, a button
 * when `onClick` is set, plain otherwise. Memoised for long lists.
 */
export const ListRow = memo(function ListRow({
  title,
  subtitle,
  leading,
  value,
  trailing,
  chevron,
  to,
  onClick,
  titleWeight = 600,
  className,
}: ListRowProps) {
  const interactive = Boolean(to || onClick);
  const content = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'type-headline block truncate text-text-1',
            titleWeight === 500 && 'font-medium',
          )}
        >
          {title}
        </span>
        {subtitle ? (
          <span className="type-meta mt-0.5 block truncate text-text-2">{subtitle}</span>
        ) : null}
      </span>
      {value !== undefined ? (
        <span className="type-meta tabular shrink-0 text-right text-text-2">{value}</span>
      ) : null}
      {trailing}
      {chevron ? <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden /> : null}
    </>
  );
  const cls = cn(
    'flex w-full items-center gap-3 py-2 text-left',
    subtitle ? 'min-h-14' : 'min-h-11',
    interactive && 'pressable chrome rounded-field',
    className,
  );
  if (to) {
    return (
      <Link to={to} onClick={onClick} className={cls}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {content}
      </button>
    );
  }
  return <div className={cls}>{content}</div>;
});

/** Rows inside a card, separated by 0.5px dividers. */
export function ListGroup({
  children,
  label,
  as: As = 'ul',
  className,
}: {
  children: ReactNode;
  /** Group label above the card: Meta 600 uppercase, --text-2. */
  label?: string;
  as?: ElementType;
  className?: string;
}) {
  return (
    <section className={className}>
      {label ? <h2 className="type-label mb-2 px-1 text-text-2">{label}</h2> : null}
      <As className="divide-y-[0.5px] divide-divider rounded-panel border border-border bg-surface px-4 [&>li]:list-none">
        {children}
      </As>
    </section>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Circle with initials on surface-2, 1px border. No gradient. 40 by default, 56 on More. */
export function Avatar({ name, size = 40 }: { name: string; size?: 40 | 56 }) {
  return (
    <span
      role="img"
      aria-label={name || 'Profile'}
      className={cn(
        'chrome inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-semibold text-text-1',
        size === 40 ? 'size-10 text-[0.9375rem]' : 'size-14 text-[1.0625rem]',
      )}
    >
      {initials(name)}
    </span>
  );
}

interface ProgressBarProps {
  /** 0 to max. */
  value: number;
  max?: number;
  /** Accessible name. */
  label: string;
  /** 4px (header) or 6px (bars). */
  thickness?: 4 | 6;
  className?: string;
}

/** Lime fill on --track. */
export function ProgressBar({ value, max = 1, label, thickness = 6, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.max(0, Math.min(max, value))}
      className={cn(
        'w-full overflow-hidden rounded-full bg-track',
        thickness === 4 ? 'h-1' : 'h-1.5',
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-lime transition-[width] duration-[var(--dur-move)] ease-[var(--ease-standard)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  /** lime: soft accent (Active, Trial, Record). neutral: surface-2 with --text-2. */
  tone?: 'lime' | 'neutral';
  icon?: ReactNode;
  className?: string;
}

/** Small label pill, Caption 600. */
export function Badge({ children, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'chrome type-caption inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 font-semibold whitespace-nowrap',
        tone === 'lime' ? 'bg-lime-dim text-text-1' : 'bg-surface-2 text-text-2',
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            'inline-flex size-3.5 [&>svg]:size-3.5',
            tone === 'lime' ? 'text-lime' : 'text-text-2',
          )}
        >
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

export interface Ring {
  label: string;
  value: number;
  max: number;
}

/** Ring opacities, outer to inner: lime 100%, 60%, 30%. Colour is never the only cue. */
const RING_OPACITY = [1, 0.6, 0.3];

/**
 * Concentric rings, 12px thick, 6px apart, round caps, --grid tracks. The shell only draws;
 * the legend (label and value per ring) sits beside it on the screen that uses it.
 */
export function RingChart({
  rings,
  size = 132,
  label,
}: {
  rings: Ring[];
  size?: number;
  label: string;
}) {
  const stroke = 12;
  const gap = 6;
  const c = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label}: ${rings.map((r) => `${r.label} ${r.value} of ${r.max}`).join(', ')}`}
      className="shrink-0 -rotate-90"
    >
      {rings.slice(0, 3).map((ring, i) => {
        const r = c - stroke / 2 - i * (stroke + gap);
        if (r <= 0) return null;
        const length = 2 * Math.PI * r;
        const fraction = ring.max > 0 ? Math.max(0, Math.min(1, ring.value / ring.max)) : 0;
        return (
          <g key={ring.label}>
            <circle cx={c} cy={c} r={r} fill="none" stroke="var(--grid)" strokeWidth={stroke} />
            {fraction > 0 ? (
              <circle
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke="var(--lime)"
                strokeOpacity={RING_OPACITY[i]}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={length}
                strokeDashoffset={length * (1 - fraction)}
                className="ring-arc"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
