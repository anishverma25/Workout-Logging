import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Kept for the call sites; since the redesign every tile is the same neutral IconTile
 * (36 x 36, radius 10, surface-2, icon in --text-2). Only the Pro row is lime-dim.
 */
export type TileTone = 'lime' | 'ember' | 'iris' | 'sky' | 'amber' | 'rose' | 'plum' | 'graphite';

export function IconTile({
  icon: Icon,
  tone,
  size = 'md',
  pro,
}: {
  icon: LucideIcon;
  tone: TileTone;
  size?: 'md' | 'lg';
  /** The Pro row's tile: lime-dim with a lime icon. */
  pro?: boolean;
}) {
  return (
    <span
      aria-hidden
      data-tone={tone}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-tile',
        size === 'md' ? 'size-9' : 'size-11',
        pro ? 'bg-lime-dim text-lime' : 'bg-surface-2 text-text-2',
      )}
    >
      <Icon className={size === 'md' ? 'size-5' : 'size-6'} strokeWidth={1.75} />
    </span>
  );
}

/**
 * Inset grouped list, as in iOS Settings: rows on one rounded surface with hairlines that
 * start after the icon.
 */
export function ListGroup({
  title,
  footer,
  children,
  className,
  label,
}: {
  title?: ReactNode;
  /** Small explanatory text under the group. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Accessible name when there is no visible title. */
  label?: string;
}) {
  return (
    <section className={className} aria-label={title ? undefined : label}>
      {title ? <h2 className="type-label mb-2 px-1 text-text-2">{title}</h2> : null}
      <ul className="list-group overflow-hidden rounded-panel border border-border bg-surface">
        {children}
      </ul>
      {footer ? <p className="type-meta mt-2 px-1 text-text-2">{footer}</p> : null}
    </section>
  );
}

interface ListRowProps {
  icon?: LucideIcon;
  tone?: TileTone;
  title: ReactNode;
  /** Secondary line under the title. */
  detail?: ReactNode;
  /** Value on the right, before the chevron. */
  value?: ReactNode;
  to?: string;
  onClick?: () => void;
  /** Control on the right (a switch, a segmented control). */
  accessory?: ReactNode;
  danger?: boolean;
  /** Lime-dim tile for the Pro row. */
  pro?: boolean;
}

export function ListRow({
  icon,
  tone = 'graphite',
  title,
  detail,
  value,
  to,
  onClick,
  accessory,
  danger,
  pro,
}: ListRowProps) {
  const body = (
    <>
      {icon ? <IconTile icon={icon} tone={tone} pro={pro} /> : null}
      <span className="list-row-text flex min-w-0 flex-1 items-center gap-3 self-stretch py-2.5">
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'type-headline block font-medium',
              danger ? 'text-danger' : 'text-text-1',
            )}
          >
            {title}
          </span>
          {detail ? <span className="type-meta mt-0.5 block text-text-2">{detail}</span> : null}
        </span>
        {value !== undefined ? (
          <span className="type-meta tabular shrink-0 text-right text-text-2">{value}</span>
        ) : null}
        {accessory}
        {to || onClick ? (
          <ChevronRight className="-mr-1 size-5 shrink-0 text-text-3" aria-hidden />
        ) : null}
      </span>
    </>
  );
  const rowClass = cn(
    'flex w-full items-center gap-3 px-4 text-left',
    detail ? 'min-h-14' : 'min-h-11',
  );
  return (
    <li>
      {to ? (
        <Link to={to} className={cn(rowClass, 'chrome transition-colors active:bg-surface-2')}>
          {body}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(rowClass, 'chrome transition-colors active:bg-surface-2')}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

/** 51 x 31 switch: lime track when on, surface-2 when off, white thumb, no ring. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'chrome tap-target relative h-[1.9375rem] w-[3.1875rem] shrink-0 rounded-full transition-colors duration-[var(--dur-move)]',
        checked ? 'bg-lime' : 'bg-surface-2',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-0.5 top-0.5 size-[1.6875rem] rounded-full bg-text-1 transition-transform duration-[var(--dur-move)] ease-[var(--ease-standard)]',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}

/**
 * A titled group whose content is free-form (forms, controls, text), styled like a grouped
 * list: the title sits outside the card, an optional footer explains it underneath.
 */
export function Panel({
  title,
  footer,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={className}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      {title ? <h2 className="type-label mb-2 px-1 text-text-2">{title}</h2> : null}
      <div className="panel-body rounded-panel border border-border bg-surface px-4">
        {children}
      </div>
      {footer ? <p className="type-meta mt-2 px-1 text-text-2">{footer}</p> : null}
    </section>
  );
}

/** One row inside a Panel: a label and detail on the left, a control on the right. */
export function PanelRow({
  title,
  detail,
  children,
  stack,
}: {
  title: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
  /** Put the control under the text, for wide controls on phones. */
  stack?: boolean;
}) {
  return (
    <div
      className={cn(
        'panel-row flex gap-3 py-3.5',
        stack
          ? 'flex-col sm:flex-row sm:items-center sm:justify-between'
          : 'items-center justify-between',
      )}
    >
      <div className="min-w-0">
        <p className="type-headline font-medium text-text-1">{title}</p>
        {detail ? <p className="type-meta mt-0.5 text-text-2">{detail}</p> : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
