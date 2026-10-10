import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

import { fieldBase } from './fieldStyles';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string | null;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel, hint, error, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className={cn('type-meta text-text-2', hideLabel && 'sr-only')}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? hintId : undefined}
        className={cn(fieldBase, 'h-13', error ? 'border-danger' : 'border-transparent')}
        {...props}
      />
      {error ? (
        <p id={hintId} className="type-meta text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="type-meta text-text-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hideLabel?: boolean;
  hint?: ReactNode;
}

export function TextArea({ label, hideLabel, hint, className, id, ...props }: TextAreaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className={cn('type-meta text-text-2', hideLabel && 'sr-only')}>
        {label}
      </label>
      <textarea
        id={inputId}
        rows={3}
        className={cn(fieldBase, 'min-h-24 resize-y border-transparent py-3 leading-relaxed')}
        {...props}
      />
      {hint ? <p className="type-meta text-text-2">{hint}</p> : null}
    </div>
  );
}

interface ChipOption<T> {
  value: T;
  label: string;
}

interface ChipsProps<T extends string> {
  label: string;
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Show an "All" chip that clears the selection. */
  allLabel?: string;
  className?: string;
}

/** Single-select filter chips in a horizontally scrolling row. */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  allLabel,
  className,
}: ChipsProps<T>) {
  const chip = (selected: boolean) =>
    cn(
      'pressable chrome type-meta h-9 shrink-0 rounded-full px-4 font-semibold whitespace-nowrap',
      selected ? 'bg-text-1 text-bg' : 'bg-surface-2 text-text-1',
    );
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        '-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0',
        className,
      )}
    >
      {allLabel ? (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          className={chip(value === null)}
          onClick={() => onChange(null)}
        >
          {allLabel}
        </button>
      ) : null}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={chip(value === o.value)}
          onClick={() => onChange(value === o.value && allLabel ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface MultiChipsProps<T extends string> {
  label: string;
  options: ChipOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  className?: string;
}

export function MultiChips<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: MultiChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const selected = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onChange(selected ? value.filter((v) => v !== o.value) : [...value, o.value])
            }
            className={cn(
              'pressable chrome type-meta h-9 rounded-full px-4 font-semibold',
              selected ? 'bg-text-1 text-bg' : 'bg-surface-2 text-text-1',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step?: number;
  /** Shown instead of the number when the value is null. */
  emptyLabel?: string;
  /** Allows stepping down past min to null ("none"). */
  allowEmpty?: boolean;
  format?: (value: number) => string;
}

/** Plus and minus around a value. Fast for small integer targets like sets or reps. */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  emptyLabel = 'None',
  allowEmpty,
  format = String,
}: StepperProps) {
  const id = useId();
  const dec = () => {
    if (value === null) return;
    const next = Math.round((value - step) * 100) / 100;
    if (next < min) onChange(allowEmpty ? null : min);
    else onChange(next);
  };
  const inc = () => {
    if (value === null) return onChange(min);
    onChange(Math.min(max, Math.round((value + step) * 100) / 100));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="type-meta text-text-2">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={id}
        className="flex h-13 items-center justify-between rounded-field bg-surface-2"
      >
        <button
          type="button"
          onClick={dec}
          disabled={value === null || (!allowEmpty && value <= min)}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="inline-flex h-full w-12 items-center justify-center text-muted hover:text-text disabled:opacity-30"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <output aria-live="polite" className="type-title tabular min-w-12 text-center">
          {value === null ? (
            <span className="text-base text-faint">{emptyLabel}</span>
          ) : (
            format(value)
          )}
        </output>
        <button
          type="button"
          onClick={inc}
          disabled={value !== null && value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="inline-flex h-full w-12 items-center justify-center text-muted hover:text-text disabled:opacity-30"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

interface ActionItem {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

/** Vertical list of large tappable actions, used inside sheets as a mobile-friendly menu. */
export function ActionList({ items }: { items: ActionItem[] }) {
  return (
    <ul className="-mx-2 flex flex-col">
      {items.map((item) => (
        <li key={item.label}>
          <button
            type="button"
            disabled={item.disabled}
            onClick={item.onSelect}
            className={cn(
              'chrome type-headline flex min-h-13 w-full items-center gap-3.5 rounded-field px-3 py-2.5 text-left font-medium transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent',
              item.danger ? 'text-danger' : 'text-text',
            )}
          >
            <span className={cn('shrink-0', item.danger ? 'text-danger' : 'text-text-2')}>
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block">{item.label}</span>
              {item.hint ? <span className="type-meta block text-text-2">{item.hint}</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
