import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Colour of the small icon tile at the start of a row. Fills only; the icon is white. */
export type TileTone = 'lime' | 'ember' | 'iris' | 'sky' | 'amber' | 'rose' | 'plum' | 'graphite';

const TILE: Record<TileTone, string> = {
  lime: 'bg-[var(--tile-lime)]',
  ember: 'bg-[var(--tile-ember)]',
  iris: 'bg-[var(--tile-iris)]',
  sky: 'bg-[var(--tile-sky)]',
  amber: 'bg-[var(--tile-amber)]',
  rose: 'bg-[var(--tile-rose)]',
  plum: 'bg-[var(--tile-plum)]',
  graphite: 'bg-[var(--tile-graphite)]',
};

export function IconTile({
  icon: Icon,
  tone,
  size = 'md',
}: {
  icon: LucideIcon;
  tone: TileTone;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center text-white',
        size === 'md' ? 'size-[1.875rem] rounded-[0.5rem]' : 'size-11 rounded-[0.8rem]',
        TILE[tone],
      )}
    >
      <Icon className={size === 'md' ? 'size-[1.1rem]' : 'size-6'} strokeWidth={2.1} />
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
      {title ? (
        <h2 className="mb-1.5 px-4 text-[0.8125rem] font-medium text-faint">{title}</h2>
      ) : null}
      <ul className="list-group overflow-hidden rounded-[var(--radius-card)] bg-surface">
        {children}
      </ul>
      {footer ? <p className="mt-1.5 px-4 text-[0.8125rem] text-faint">{footer}</p> : null}
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
}: ListRowProps) {
  const body = (
    <>
      {icon ? <IconTile icon={icon} tone={tone} /> : null}
      <span className="list-row-text flex min-w-0 flex-1 items-center gap-3 self-stretch py-3">
        <span className="min-w-0 flex-1">
          <span className={cn('block font-medium leading-snug', danger && 'text-danger')}>
            {title}
          </span>
          {detail ? (
            <span className="mt-0.5 block text-sm leading-snug text-faint">{detail}</span>
          ) : null}
        </span>
        {value !== undefined ? (
          <span className="tabular shrink-0 text-[0.95rem] text-faint">{value}</span>
        ) : null}
        {accessory}
        {to || onClick ? (
          <ChevronRight className="-mr-1 size-4 shrink-0 text-faint/70" aria-hidden />
        ) : null}
      </span>
    </>
  );
  const rowClass = 'flex min-h-12 w-full items-center gap-3.5 pl-4 pr-4 text-left';
  return (
    <li>
      {to ? (
        <Link to={to} className={cn(rowClass, 'transition-colors active:bg-surface-2')}>
          {body}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(rowClass, 'transition-colors active:bg-surface-2')}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

/** An on/off switch with the iOS look. */
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
        'tap-target relative h-[1.9375rem] w-[3.1875rem] shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-[var(--switch-on)]' : 'bg-[var(--seg-track)]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-0.5 top-0.5 size-[1.6875rem] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] transition-transform duration-200 ease-[var(--ease-spring)]',
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
      {title ? (
        <h2 className="mb-1.5 px-4 text-[0.8125rem] font-medium text-faint">{title}</h2>
      ) : null}
      <div className="panel-body rounded-[var(--radius-card)] bg-surface px-4">{children}</div>
      {footer ? <p className="mt-1.5 px-4 text-[0.8125rem] text-faint">{footer}</p> : null}
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
        <p className="font-medium leading-snug">{title}</p>
        {detail ? <p className="mt-0.5 text-sm leading-snug text-faint">{detail}</p> : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
