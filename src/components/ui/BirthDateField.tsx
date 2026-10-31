import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { checkBirthDate, MONTHS, partsFromIso, type DateParts as Parts } from '@/lib/birthDate';
import { fieldBase } from './fieldStyles';

/**
 * Birth date as three number boxes, day, month, year, in that order. The number keyboard opens,
 * focus moves on as each box fills, and backspace in an empty box goes back. Pasting a whole
 * date such as 14/03/1996 into any box fills all three. Reports an ISO date, or '' while
 * incomplete or invalid.
 */
export function BirthDateField({
  value,
  onChange,
  label = 'Birth date',
}: {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
}) {
  const [parts, setParts] = useState<Parts>(() => partsFromIso(value));
  const refs = {
    day: useRef<HTMLInputElement>(null),
    month: useRef<HTMLInputElement>(null),
    year: useRef<HTMLInputElement>(null),
  };
  const id = useId();
  const check = checkBirthDate(parts);

  function update(next: Parts) {
    setParts(next);
    const c = checkBirthDate(next);
    onChange(c.ok ? c.iso : '');
  }

  function type(key: keyof Parts, raw: string) {
    const max = key === 'year' ? 4 : 2;
    let digits = raw.replace(/\D/g, '').slice(0, max);
    // A day of 4 to 9 or a month of 2 to 9 cannot take a second digit: pad and move on.
    const early =
      digits.length === 1 && ((key === 'day' && digits > '3') || (key === 'month' && digits > '1'));
    if (early) digits = `0${digits}`;
    update({ ...parts, [key]: digits });
    if (digits.length === max) {
      if (key === 'day') refs.month.current?.focus();
      if (key === 'month') refs.year.current?.focus();
    }
  }

  function back(key: keyof Parts, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Backspace' || parts[key] !== '') return;
    if (key === 'month') refs.day.current?.focus();
    if (key === 'year') refs.month.current?.focus();
  }

  function paste(e: ClipboardEvent<HTMLInputElement>) {
    const m = /^\s*(\d{1,2})\D+(\d{1,2})\D+(\d{4})\s*$/.exec(e.clipboardData.getData('text'));
    if (!m) return;
    e.preventDefault();
    update({ day: m[1]!.padStart(2, '0'), month: m[2]!.padStart(2, '0'), year: m[3]! });
    refs.year.current?.focus();
  }

  const box = (key: keyof Parts, placeholder: string, name: string, autoComplete: string) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-faint">{name}</span>
      <input
        ref={refs[key]}
        value={parts[key]}
        onChange={(e) => type(key, e.target.value)}
        onKeyDown={(e) => back(key, e)}
        onPaste={paste}
        onFocus={(e) => e.currentTarget.select()}
        inputMode="numeric"
        autoComplete={autoComplete}
        enterKeyHint={key === 'year' ? 'done' : 'next'}
        placeholder={placeholder}
        aria-label={`${label}, ${name.toLowerCase()}`}
        aria-describedby={`${id}-hint`}
        aria-invalid={check.ok || !check.error ? undefined : true}
        className={cn(
          fieldBase,
          'tabular h-12 w-full text-center font-display text-[1.15rem] font-semibold tracking-wide',
          !check.ok && check.error ? 'border-danger' : 'border-transparent',
        )}
      />
    </label>
  );

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-muted">{label}</legend>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] gap-2">
        {box('day', 'DD', 'Day', 'bday-day')}
        {box('month', 'MM', 'Month', 'bday-month')}
        {box('year', 'YYYY', 'Year', 'bday-year')}
      </div>
      <p
        id={`${id}-hint`}
        aria-live="polite"
        className={cn('text-sm', !check.ok && check.error ? 'text-danger' : 'text-faint')}
      >
        {check.ok
          ? `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1]} ${parts.year}, age ${check.age}`
          : (check.error ?? 'Day, month and year, for example 14 03 1996.')}
      </p>
    </fieldset>
  );
}
