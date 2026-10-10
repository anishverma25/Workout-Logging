import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { AlertCircle, Eye, EyeOff, Minus, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isValidDraft, parseDraft, toDraft } from '@/lib/numberInput';
import { stepValue } from './stepValue';

/* Inputs use 17px text so iOS never zooms on focus. */
const fieldShell =
  'flex h-13 items-center gap-2 rounded-field border bg-surface-2 px-3.5 transition-colors duration-[var(--dur-press)] focus-within:border-text-2';
const inputCls =
  'w-full min-w-0 bg-transparent text-[1.0625rem] leading-[1.375rem] text-text-1 outline-none placeholder:text-text-3';

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="type-meta mt-1.5 flex items-start gap-1.5 text-danger-text">
      <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hideLabel?: boolean;
  /** Error message under the field, Meta --danger-text with an icon. */
  error?: ReactNode;
  /** Help text under the field, Meta --text-2. */
  hint?: ReactNode;
  /** Something inside the field on the right (a unit, a button). */
  trailing?: ReactNode;
  className?: string;
}

/** Label (Meta --text-2) above a 52px field, error below. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel, error, hint, trailing, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={cn('type-meta mb-1.5 block text-text-2', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <div className={cn(fieldShell, error ? 'border-danger-text' : 'border-transparent')}>
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={inputCls}
          {...props}
        />
        {trailing}
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {hint && !error ? (
        <p id={hintId} className="type-meta mt-1.5 text-text-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

/** TextField with a show or hide button. */
export const PasswordField = forwardRef<
  HTMLInputElement,
  Omit<TextFieldProps, 'type' | 'trailing'>
>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      ref={ref}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="pressable tap-target -mr-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-text-2 hover:text-text-1"
        >
          {visible ? (
            <EyeOff className="size-5" aria-hidden />
          ) : (
            <Eye className="size-5" aria-hidden />
          )}
        </button>
      }
      {...props}
    />
  );
});

interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** 44px search on surface-2, no border, with a clear button once there is text. */
export function SearchField({ label, value, onChange, placeholder, className }: SearchFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      role="search"
      className={cn(
        'flex h-11 items-center gap-2 rounded-field bg-surface-2 px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
        className,
      )}
    >
      <Search className="size-5 shrink-0 text-text-2" aria-hidden />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={input}
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          inputCls,
          'focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden',
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            input.current?.focus();
          }}
          className="pressable tap-target inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-text-3 text-surface"
        >
          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

interface NumberFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'min' | 'max' | 'size'
> {
  label: string;
  hideLabel?: boolean;
  value: number | null;
  onValueChange: (value: number | null) => void;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  error?: ReactNode;
  className?: string;
}

/**
 * Number input that may be empty while typing, accepts "77,5" as well as "77.5", and never
 * forces a 0 in. Validated when it loses focus. Numeric keypad, Title-size tabular digits.
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
  error,
  className,
  onBlur,
  onFocus,
  ...props
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(() => toDraft(value));
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // While the person types, their text wins; otherwise the field shows the stored value.
  const shown = editing ? draft : toDraft(value);
  const errorId = `${id}-error`;
  const message =
    error ??
    (invalid ? `Enter a number${max !== undefined ? ` from ${min} to ${max}` : ''}` : null);

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={cn('type-meta mb-1.5 block text-text-2', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <div className={cn(fieldShell, message ? 'border-danger-text' : 'border-transparent')}>
        <input
          id={id}
          type="text"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          autoComplete="off"
          enterKeyHint="next"
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? errorId : undefined}
          value={shown}
          onFocus={(e) => {
            setDraft(toDraft(value));
            setEditing(true);
            e.currentTarget.select();
            onFocus?.(e);
          }}
          onChange={(e) => {
            const next = e.target.value;
            if (!isValidDraft(next, allowDecimal)) return;
            setDraft(next);
            setInvalid(false);
            onValueChange(parseDraft(next, { allowDecimal }));
          }}
          onBlur={(e) => {
            setEditing(false);
            const parsed = parseDraft(draft, { allowDecimal, min, max });
            setInvalid(draft !== '' && parsed === null);
            onValueChange(parsed);
            onBlur?.(e);
          }}
          className={cn(inputCls, 'type-title tabular')}
          {...props}
        />
        {unit ? <span className="type-meta shrink-0 text-text-2">{unit}</span> : null}
      </div>
      {message ? <FieldError id={errorId}>{message}</FieldError> : null}
    </div>
  );
}

/**
 * Repeats while held: first step on press, repeats after 400 ms, faster after 1 s. `step`
 * returns false at a limit, which ends the repeat (a disabled button gets no pointerup).
 */
function useRepeatPress(step: () => boolean) {
  const timer = useRef<number | null>(null);
  const ticks = useRef(0);
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const tick = () => {
    if (!stepRef.current()) {
      stop();
      return;
    }
    // 400 ms, then four repeats at 160 ms: about 1 s in, it speeds up.
    ticks.current += 1;
    timer.current = window.setTimeout(tick, ticks.current > 4 ? 60 : 160);
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      ticks.current = 0;
      if (stepRef.current()) timer.current = window.setTimeout(tick, 400);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // Keyboard and assistive tech: one step per activation.
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        stepRef.current();
      }
    },
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
}

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** How the value reads (2:00, 5°, RIR 1). */
  format?: (value: number) => string;
  /** Labels on the buttons, such as "−15s" and "+15s". Defaults to minus and plus icons. */
  decreaseLabel?: string;
  increaseLabel?: string;
  /** Value size: Stat (default) or Headline. */
  size?: 'stat' | 'headline';
  /** Tapping the value (to open a keypad). */
  onValuePress?: () => void;
}

/**
 * − value +. Hold a button to repeat; it speeds up after 1 s. The value is a spinbutton, so
 * arrow keys, Page Up and Down, Home and End work too.
 */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format = String,
  decreaseLabel,
  increaseLabel,
  size = 'stat',
  onValuePress,
}: StepperProps) {
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });
  const change = (delta: number) => {
    const next = stepValue(valueRef.current, delta, min, max, step);
    if (next === valueRef.current) return false;
    valueRef.current = next;
    onChange(next);
    return true;
  };
  const down = useRepeatPress(() => change(-step));
  const up = useRepeatPress(() => change(step));
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: step * 4,
      PageDown: -step * 4,
    };
    const delta = map[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      change(delta);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    } else if (e.key === 'Enter' && onValuePress) {
      e.preventDefault();
      onValuePress();
    }
  };
  const btn =
    'pressable chrome inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-1 select-none touch-none disabled:text-text-3';
  return (
    <div className="flex items-center justify-between gap-4" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        className={cn(btn, decreaseLabel && 'type-meta tabular font-semibold')}
        {...down}
      >
        {decreaseLabel ?? <Minus className="size-5" aria-hidden />}
      </button>
      <div
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        onKeyDown={onKey}
        onClick={onValuePress}
        className={cn(
          'chrome tabular min-w-0 flex-1 rounded-field py-1 text-center text-text-1',
          size === 'stat' ? 'type-stat' : 'type-headline',
          onValuePress && 'pressable cursor-pointer',
        )}
      >
        {format(value)}
      </div>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        className={cn(btn, increaseLabel && 'type-meta tabular font-semibold')}
        {...up}
      >
        {increaseLabel ?? <Plus className="size-5" aria-hidden />}
      </button>
    </div>
  );
}
