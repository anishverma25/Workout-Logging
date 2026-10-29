import type { ElementType, ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/*
 * UI v3 primitives (docs/UI_V3_BRIEF.md, G3 and G5): one number style, one section, one group,
 * one stat grid, one empty line and one capsule button, used the same way on every screen.
 */

type MetricTier = 'hero' | 'primary' | 'secondary';

const tierCls: Record<MetricTier, string> = {
  hero: 'type-hero',
  primary: 'type-metric',
  secondary: 'type-metric-sm',
};
const unitCls: Record<MetricTier, string> = {
  hero: 'text-[1.5rem] leading-none',
  primary: 'text-[0.9375rem] leading-none',
  secondary: 'text-[0.8125rem] leading-none',
};

/**
 * A number that matters, with its unit at about half its size that never wraps onto a line of
 * its own. Label above in footnote; the hero's label may be lime.
 */
export function Metric({
  value,
  unit,
  label,
  tier = 'primary',
  accentLabel,
  className,
  children,
}: {
  value: ReactNode;
  unit?: ReactNode;
  label?: ReactNode;
  tier?: MetricTier;
  /** Lime label, for the one hero on a screen. */
  accentLabel?: boolean;
  className?: string;
  /** Under the number: a change capsule or a caption. */
  children?: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <p
          className={cn('type-meta mb-1 font-semibold', accentLabel ? 'text-lime' : 'text-text-2')}
        >
          {label}
        </p>
      ) : null}
      <p className={cn(tierCls[tier], 'whitespace-nowrap text-text-1')} data-metric={tier}>
        {value}
        {unit ? (
          <span
            className={cn(
              'ml-[0.2em] font-sans font-medium tracking-normal text-text-2',
              unitCls[tier],
            )}
          >
            {unit}
          </span>
        ) : null}
      </p>
      {children}
    </div>
  );
}

/** A change as a small capsule: green up, red down, grey flat. Colour is never the only cue. */
export function Delta({
  children,
  tone,
  className,
  arrow = true,
}: {
  children: ReactNode;
  tone: 'up' | 'down' | 'flat';
  className?: string;
  arrow?: boolean;
}) {
  const Icon = tone === 'up' ? ArrowUpRight : tone === 'down' ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        'type-caption tabular inline-flex h-[1.375rem] shrink-0 items-center gap-0.5 rounded-full px-2 font-semibold whitespace-nowrap',
        tone === 'up' && 'bg-up-dim text-up',
        tone === 'down' && 'bg-down-dim text-down',
        tone === 'flat' && 'bg-fill text-text-2',
        className,
      )}
    >
      {arrow ? <Icon className="size-3" strokeWidth={2.4} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Section: a Title 2 header outside its group, optional actions on the right and a footer. */
export function Section({
  title,
  id,
  action,
  info,
  footer,
  children,
  className,
  as: As = 'section',
  'aria-label': ariaLabel,
}: {
  title?: ReactNode;
  id?: string;
  /** A text button ("See all", "Edit") or a capsule on the right. */
  action?: ReactNode;
  /** Info and Explain icons beside the action. */
  info?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: ElementType;
  'aria-label'?: string;
}) {
  return (
    <As className={className} aria-labelledby={title && id ? id : undefined} aria-label={ariaLabel}>
      {title || action || info ? (
        <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
          {title ? (
            <h2 id={id} className="type-section min-w-0 text-text-1">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action || info ? (
            <div className="flex shrink-0 items-center gap-2">
              {info}
              {action}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
      {footer ? <div className="type-meta mt-2 px-4 text-text-2">{footer}</div> : null}
    </As>
  );
}

/** Rows on one rounded surface with hairlines between them. */
export function Group({
  children,
  className,
  as: As = 'div',
  inset = true,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** Side padding on the group (rows that bring their own padding pass false). */
  inset?: boolean;
}) {
  return (
    <As
      className={cn(
        'divide-y-[0.5px] divide-divider overflow-hidden rounded-card bg-surface [&>li]:list-none',
        inset && 'px-4',
        className,
      )}
    >
      {children}
    </As>
  );
}

/** Two columns of stat tiles, 12 apart. At most four tiles; zero tiles are left out by callers. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3', className)}>{children}</div>;
}

/** One calm line instead of a grid of zeros, with the action that fills it. */
export function EmptyLine({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-card bg-surface px-4 py-5 text-center',
        className,
      )}
    >
      <p className="type-subhead text-text-2">{children}</p>
      {actions ? (
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">{actions}</div>
      ) : null}
    </div>
  );
}

/** Lime text button for tertiary actions ("See all", "Edit", "Add steps"). */
export function TextButton({
  children,
  to,
  onClick,
  className,
  small,
  icon,
  'aria-label': ariaLabel,
  ...rest
}: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  className?: string;
  small?: boolean;
  icon?: ReactNode;
  'aria-label'?: string;
  [data: `data-${string}`]: unknown;
}) {
  const cls = cn(
    'pressable chrome tap-target inline-flex shrink-0 items-center gap-1 rounded-tile text-lime',
    small ? 'type-subhead font-medium' : 'text-[1.0625rem] leading-[1.375rem]',
    className,
  );
  const inner = (
    <>
      {icon ? <span className="inline-flex size-4 [&>svg]:size-4">{icon}</span> : null}
      {children}
    </>
  );
  if (to)
    return (
      <Link to={to} onClick={onClick} className={cls} aria-label={ariaLabel} {...rest}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={ariaLabel} {...rest}>
      {inner}
    </button>
  );
}

/** A 32-high capsule for a row's own action ("Start", "Log", "+ 250 ml"). */
export function CapsuleButton({
  children,
  to,
  onClick,
  icon,
  tone = 'fill',
  className,
  disabled,
  'aria-label': ariaLabel,
  ...rest
}: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  icon?: ReactNode;
  tone?: 'fill' | 'lime';
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
  [data: `data-${string}`]: unknown;
}) {
  const cls = cn(
    'pressable chrome tap-target type-subhead inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3.5 font-semibold whitespace-nowrap disabled:text-text-3',
    tone === 'lime' ? 'bg-lime text-on-lime' : 'bg-fill text-text-1',
    className,
  );
  const inner = (
    <>
      {icon ? <span className="inline-flex size-4 [&>svg]:size-4">{icon}</span> : null}
      {children}
    </>
  );
  if (to)
    return (
      <Link to={to} onClick={onClick} className={cls} aria-label={ariaLabel} {...rest}>
        {inner}
      </Link>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls}
      aria-label={ariaLabel}
      {...rest}
    >
      {inner}
    </button>
  );
}
