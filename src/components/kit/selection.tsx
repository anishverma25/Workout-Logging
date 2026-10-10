import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * Selection rule (UI rules 3.5): selected = white fill, black text; unselected = surface-2,
 * --text-1. The one exception is the current day in week strips, which is lime.
 */
const selectedCls = 'bg-text-1 text-bg';
const unselectedCls = 'bg-surface-2 text-text-1';

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  /** Trailing icon, such as a chevron on a filter chip. */
  trailing?: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  /** Chips in a ChipGroup report their state with aria-pressed; set false for plain buttons. */
  toggle?: boolean;
}

/** 36px pill. A toggle by default (aria-pressed). */
export function Chip({
  children,
  selected = false,
  onClick,
  trailing,
  leading,
  disabled,
  className,
  toggle = true,
  ...aria
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={toggle ? selected : undefined}
      className={cn(
        'pressable chrome type-meta inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 font-semibold whitespace-nowrap disabled:opacity-35',
        selected ? selectedCls : unselectedCls,
        'tabular',
        className,
      )}
      {...aria}
    >
      {leading ? <span className="inline-flex size-4 [&>svg]:size-4">{leading}</span> : null}
      {children}
      {trailing ? <span className="inline-flex size-4 [&>svg]:size-4">{trailing}</span> : null}
    </button>
  );
}

interface ChipOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

type ChipGroupProps<T extends string> = {
  label: string;
  options: ChipOption<T>[];
  /** Scroll sideways in one row instead of wrapping. */
  scroll?: boolean;
  className?: string;
} & (
  | { multiple?: false; value: T | null; onChange: (value: T) => void }
  | { multiple: true; value: T[]; onChange: (value: T[]) => void }
);

/** A labelled group of chips; single choice or several. */
export function ChipGroup<T extends string>(props: ChipGroupProps<T>) {
  const { label, options, scroll, className } = props;
  const isSelected = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);
  const toggle = (v: T) => {
    if (props.multiple) {
      props.onChange(
        props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v],
      );
    } else {
      props.onChange(v);
    }
  };
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex gap-2',
        scroll
          ? '-mx-4 overflow-x-auto px-4 [scrollbar-width:none] tab:-mx-6 tab:px-6'
          : 'flex-wrap',
        className,
      )}
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          selected={isSelected(o.value)}
          disabled={o.disabled}
          onClick={() => toggle(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Stretch segments to fill the width. */
  block?: boolean;
  /** Control height: 36 (default) or 40 (check-in scales). */
  tall?: boolean;
  className?: string;
}

/**
 * One rounded container of segments; a radio group with arrow-key navigation. The selected
 * segment is a white fill with black text.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  block,
  tall,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'chrome gap-0.5 rounded-full bg-surface-2 p-0.5',
        block ? 'flex w-full' : 'inline-flex',
        className,
      )}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(o.value)}
            className={cn(
              'type-meta tabular rounded-full px-4 font-semibold whitespace-nowrap transition-colors duration-[var(--dur-press)]',
              tall ? 'h-9' : 'h-8',
              block && 'flex-1 px-2',
              selected ? selectedCls : 'text-text-1',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label lives elsewhere; pass its id, or give an aria-label. */
  'aria-labelledby'?: string;
  'aria-label'?: string;
  disabled?: boolean;
}

/** 51 × 31 switch. On = lime track, off = surface-2; white thumb, no ring. */
export function Switch({ checked, onChange, disabled, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'chrome tap-target relative inline-flex h-[1.9375rem] w-[3.1875rem] shrink-0 items-center rounded-full transition-colors duration-[var(--dur-move)] disabled:opacity-35',
        checked ? 'bg-lime' : 'bg-surface-2',
      )}
      {...aria}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-0.5 size-[1.6875rem] rounded-full bg-text-1 transition-transform duration-[var(--dur-move)] ease-[var(--ease-standard)]',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}

interface OptionCardProps {
  title: string;
  description?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  /** Leading icon, 20px. */
  icon?: ReactNode;
  /** Radio semantics inside a radiogroup; checkbox semantics for multi-select. */
  role?: 'radio' | 'checkbox';
}

/** Large selectable card for setup questions. Min height 56. */
export function OptionCard({
  title,
  description,
  selected,
  onSelect,
  icon,
  role = 'radio',
}: OptionCardProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'pressable chrome flex min-h-14 w-full items-center gap-3 rounded-nested px-4 py-3 text-left',
        selected ? selectedCls : unselectedCls,
      )}
    >
      {icon ? (
        <span
          className={cn(
            'inline-flex size-5 shrink-0 [&>svg]:size-5',
            selected ? 'text-bg' : 'text-text-2',
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="type-headline block">{title}</span>
        {description ? (
          <span className={cn('type-meta mt-0.5 block', selected ? 'text-bg/75' : 'text-text-2')}>
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
