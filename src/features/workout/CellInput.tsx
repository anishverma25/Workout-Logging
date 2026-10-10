import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { isValidDraft, parseDraft, toDraft } from '@/lib/numberInput';

export interface CellInputHandle {
  /** Saves whatever is typed right now. Awaited before a set is marked done. */
  flush: () => Promise<void>;
}

interface Props {
  /** Accessible name, for example "Set 2 weight in kg". */
  label: string;
  value: number | null;
  /** Faint hint shown while empty: what tapping done would log. */
  placeholder?: string;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  onCommit: (value: number | null) => Promise<void> | void;
  className?: string;
  /** Completed sets render their values brighter. */
  done?: boolean;
  /** Step for the keyboard toolbar's − and + buttons (2.5 for kg, 1 for reps). */
  step?: number;
}

/** Sent by the keyboard toolbar to the focused cell: adds `detail` to its value. */
export const CELL_STEP_EVENT = 'cellstep';

const SAVE_DELAY_MS = 350;

/**
 * Number cell for the set table.
 * - A text input with a numeric keyboard, never type="number": it can be empty, never forces 0,
 *   and accepts both "77.5" and "77,5".
 * - Saves 350 ms after typing stops and immediately on blur, so a refresh mid-workout loses
 *   nothing and typing never waits on the database.
 * - Enter moves to the next cell in the table.
 */
export const CellInput = forwardRef<CellInputHandle, Props>(function CellInput(
  {
    label,
    value,
    placeholder,
    allowDecimal = true,
    min = 0,
    max = 9999,
    onCommit,
    className,
    done,
    step = 1,
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => toDraft(value));
  const [invalid, setInvalid] = useState(false);
  const [focused, setFocused] = useState(false);
  const timer = useRef<number | null>(null);
  const lastCommitted = useRef<number | null>(value);
  const draftRef = useRef(draft);
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });

  // Follow saved changes made elsewhere (copying last time, undo) while not typing here.
  // Adjusting state during render on a prop change is the React-recommended pattern.
  const [seenValue, setSeenValue] = useState(value);
  if (!focused && value !== seenValue) {
    setSeenValue(value);
    setDraft(toDraft(value));
    draftRef.current = toDraft(value);
    lastCommitted.current = value;
  }

  const commit = async (raw: string) => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const parsed = parseDraft(raw, { allowDecimal, min, max });
    const bad = raw.trim() !== '' && parsed === null;
    setInvalid(bad);
    if (bad || parsed === lastCommitted.current) return;
    lastCommitted.current = parsed;
    await commitRef.current(parsed);
  };

  useImperativeHandle(ref, () => ({ flush: () => commit(draftRef.current) }));

  // The keyboard toolbar nudges the focused cell by its step, starting from the typed value,
  // else the suggestion shown, else zero.
  const nudge = useRef<(delta: number) => void>(() => {});
  useEffect(() => {
    nudge.current = (delta: number) => {
      const opts = { allowDecimal, min, max };
      const base =
        parseDraft(draftRef.current, opts) ?? (placeholder ? parseDraft(placeholder, opts) : null);
      const next = Math.min(max, Math.max(min, Math.round(((base ?? 0) + delta) * 100) / 100));
      const text = toDraft(next);
      setDraft(text);
      draftRef.current = text;
      setInvalid(false);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void commit(text), SAVE_DELAY_MS);
    };
  });
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onStep = (e: Event) => nudge.current((e as CustomEvent<number>).detail);
    el.addEventListener(CELL_STEP_EVENT, onStep);
    return () => el.removeEventListener(CELL_STEP_EVENT, onStep);
  }, []);

  useEffect(
    () => () => {
      // Leaving the screen mid-typing still saves.
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        void commit(draftRef.current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="next"
      aria-label={label}
      aria-invalid={invalid || undefined}
      data-cell
      data-step={step}
      value={draft}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const next = e.target.value;
        if (!isValidDraft(next, allowDecimal)) return;
        setDraft(next);
        draftRef.current = next;
        setInvalid(false);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void commit(next), SAVE_DELAY_MS);
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseDraft(draftRef.current, { allowDecimal, min, max });
        if (parsed !== null) {
          const tidy = toDraft(parsed);
          setDraft(tidy);
          draftRef.current = tidy;
        }
        setSeenValue(parsed ?? value);
        void commit(draftRef.current);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const cells = [...document.querySelectorAll<HTMLInputElement>('input[data-cell]')];
        const next = cells[cells.indexOf(e.currentTarget) + 1];
        if (next) next.focus();
        else e.currentTarget.blur();
      }}
      className={cn(
        'type-title tabular h-13 w-full min-w-0 rounded-field border bg-surface-2 px-1 text-center text-text-1 outline-none transition-colors placeholder:text-text-3 focus:border-text-2',
        invalid ? 'border-danger-text' : 'border-transparent',
        done && 'bg-transparent',
        className,
      )}
    />
  );
});
