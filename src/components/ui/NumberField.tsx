import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { isValidDraft, parseDraft, toDraft } from '@/lib/numberInput';

interface NumberFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'min' | 'max'
> {
  label: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  value: number | null;
  onValueChange: (value: number | null) => void;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  unit?: string;
}

/**
 * Workout number input. Built on a text input with a numeric keyboard rather than
 * type="number", so the field can be empty while typing, accepts "77,5" as well as "77.5",
 * and never forces a 0 into the box. The value is validated when the field loses focus.
 */
export function NumberField({
  label,
  hideLabel,
  value,
  onValueChange,
  allowDecimal = true,
  min = 0,
  max,
  unit,
  className,
  onBlur,
  ...props
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(() => toDraft(value));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  // Follow external value changes (copying last time's numbers) unless the user is typing.
  useEffect(() => {
    if (!focused.current) setDraft(toDraft(value));
  }, [value]);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-xs font-medium text-faint', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div
        className={cn(
          'flex h-12 items-center rounded-[var(--radius-control)] border bg-surface-2 px-3 transition-colors focus-within:border-accent-text',
          invalid ? 'border-danger' : 'border-transparent',
        )}
      >
        <input
          id={id}
          type="text"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          autoComplete="off"
          enterKeyHint="next"
          aria-invalid={invalid || undefined}
          value={draft}
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onChange={(e) => {
            const next = e.target.value;
            if (!isValidDraft(next, allowDecimal)) return;
            setDraft(next);
            setInvalid(false);
            onValueChange(parseDraft(next, { allowDecimal }));
          }}
          onBlur={(e) => {
            focused.current = false;
            const parsed = parseDraft(draft, { allowDecimal, min, max });
            setInvalid(draft !== '' && parsed === null);
            if (parsed !== null) setDraft(toDraft(parsed));
            onValueChange(parsed);
            onBlur?.(e);
          }}
          className="tabular w-full min-w-0 bg-transparent font-display text-2xl font-semibold outline-none placeholder:text-faint"
          {...props}
        />
        {unit ? <span className="ml-1 text-sm text-faint">{unit}</span> : null}
      </div>
    </div>
  );
}
