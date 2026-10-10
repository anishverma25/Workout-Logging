import { useState, type FormEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatSeconds } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { PrimaryButton, SecondaryButton, TextLink } from './actions';
import { Stepper } from './inputs';
import { Chip } from './selection';
import { clampTo, parseDurationDigits, parseWholeNumber, REST_PRESETS_SEC } from './keypad';

/**
 * Pickers for the workout and routine sheets (UI Part 6, B5): a stepper with a big value,
 * preset chips and a keypad for exact entry. They replace the scroll wheels. Values outside the
 * range are clamped for display only; nothing is saved until the person changes it.
 */

/** Inline keypad entry that stands in for the stepper while typing. */
function KeypadEntry({
  label,
  initial,
  hint,
  parse,
  onDone,
  onCancel,
}: {
  label: string;
  initial: string;
  hint: string;
  parse: (text: string) => number | null;
  onDone: (value: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState(false);
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const v = parse(text);
    if (v === null) {
      setError(true);
      return;
    }
    onDone(v);
  };
  return (
    <form onSubmit={submit} className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          aria-label={label}
          aria-invalid={error || undefined}
          aria-describedby={`${label}-hint`}
          value={text}
          onChange={(e) => {
            setText(e.target.value.replace(/[^\d:]/g, '').slice(0, 5));
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          className={cn(
            'type-stat tabular h-13 w-full rounded-field border bg-surface-2 px-4 text-center text-text-1 outline-none focus:border-text-2',
            error ? 'border-danger-text' : 'border-transparent',
          )}
        />
        <p
          id={`${label}-hint`}
          className={cn('type-meta mt-1.5', error ? 'text-danger-text' : 'text-text-2')}
        >
          {hint}
        </p>
      </div>
      <PrimaryButton type="submit" compact>
        Done
      </PrimaryButton>
    </form>
  );
}

interface RestPickerProps {
  label: string;
  value: number;
  onChange: (seconds: number) => void;
  min?: number;
  max?: number;
  presets?: number[];
  /** Shows "Default is 2:00" with a "Use default" link. */
  defaultSeconds?: number;
  footnote?: ReactNode;
}

/** Rest length: −15s and +15s around the time, preset chips, and a keypad on the time. */
export function RestPicker({
  label,
  value,
  onChange,
  min = 15,
  max = 600,
  presets = REST_PRESETS_SEC,
  defaultSeconds,
  footnote,
}: RestPickerProps) {
  const [typing, setTyping] = useState(false);
  const shown = clampTo(value, min, max);
  const set = (v: number) => {
    haptic('light');
    onChange(clampTo(v, min, max));
  };
  return (
    <div>
      {typing ? (
        <KeypadEntry
          label={`${label}, type a time`}
          initial=""
          hint={`Type 230 for 2:30. From ${formatSeconds(min)} to ${formatSeconds(max)}.`}
          parse={parseDurationDigits}
          onDone={(v) => {
            set(v);
            setTyping(false);
          }}
          onCancel={() => setTyping(false)}
        />
      ) : (
        <Stepper
          label={label}
          value={shown}
          min={min}
          max={max}
          step={15}
          format={formatSeconds}
          decreaseLabel="−15s"
          increaseLabel="+15s"
          onChange={set}
          onValuePress={() => setTyping(true)}
        />
      )}
      <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label={`${label} presets`}>
        {presets
          .filter((p) => p >= min && p <= max)
          .map((p) => (
            <Chip key={p} selected={value === p} onClick={() => set(p)} className="justify-center">
              {formatSeconds(p)}
            </Chip>
          ))}
      </div>
      {defaultSeconds !== undefined ? (
        <p className="type-meta mt-3 flex flex-wrap items-center gap-x-2 text-text-2">
          <span className="tabular">Default is {formatSeconds(defaultSeconds)}</span>
          {value !== defaultSeconds ? (
            <TextLink small onClick={() => set(defaultSeconds)}>
              Use default
            </TextLink>
          ) : null}
        </p>
      ) : null}
      {footnote ? <p className="type-meta mt-1 text-text-2">{footnote}</p> : null}
    </div>
  );
}

export type BenchKind = 'incline' | 'decline';

/** Bench outline: the base stays level, the backrest rotates about its pivot to the angle. */
export function BenchDiagram({ degrees, kind }: { degrees: number; kind: BenchKind }) {
  const pivotX = 60;
  const pivotY = 40;
  const rotation = kind === 'incline' ? -degrees : degrees;
  const r = 22;
  const rad = (Math.PI / 180) * degrees;
  const arcEnd =
    kind === 'incline'
      ? { x: pivotX + r * Math.cos(rad), y: pivotY - r * Math.sin(rad) }
      : { x: pivotX + r * Math.cos(rad), y: pivotY + r * Math.sin(rad) };
  return (
    <svg
      viewBox="0 0 160 56"
      width={160}
      height={56}
      aria-hidden
      className="mx-auto overflow-visible"
    >
      <line
        x1={12}
        y1={48}
        x2={148}
        y2={48}
        stroke="var(--text-1)"
        strokeOpacity={0.3}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        x1={pivotX}
        y1={pivotY}
        x2={30}
        y2={pivotY}
        stroke="var(--text-1)"
        strokeOpacity={0.3}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {degrees > 0 ? (
        <path
          d={`M ${pivotX + r} ${pivotY} A ${r} ${r} 0 0 ${kind === 'incline' ? 0 : 1} ${arcEnd.x} ${arcEnd.y}`}
          fill="none"
          stroke="var(--text-2)"
          strokeWidth={1.5}
        />
      ) : null}
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${pivotX}px ${pivotY}px`,
          transition: 'transform 200ms var(--ease-standard)',
        }}
      >
        <line
          x1={pivotX}
          y1={pivotY}
          x2={pivotX + 70}
          y2={pivotY}
          stroke="var(--lime)"
          strokeWidth={5}
          strokeLinecap="round"
        />
      </g>
      <circle cx={pivotX} cy={pivotY} r={3} fill="var(--text-1)" />
    </svg>
  );
}

const ANGLE_PRESETS: Record<BenchKind, number[]> = {
  incline: [0, 15, 30, 45, 60, 90],
  decline: [0, 15, 30, 45],
};
const ANGLE_MAX: Record<BenchKind, number> = { incline: 90, decline: 45 };

/**
 * Bench angle in whole degrees, stored signed (positive incline, negative decline). Not set is
 * its own state, with "Add angle" starting at `startAt`.
 */
export function AnglePicker({
  kind,
  value,
  onChange,
  startAt,
}: {
  kind: BenchKind;
  /** Signed degrees, or null when not set. */
  value: number | null;
  onChange: (signed: number | null) => void;
  startAt: number;
}) {
  const [typing, setTyping] = useState(false);
  const max = ANGLE_MAX[kind];
  const deg = value === null ? null : clampTo(Math.abs(value), 0, max);
  const signed = (d: number) => (kind === 'decline' ? -Math.abs(d) : Math.abs(d));
  const set = (d: number) => {
    haptic('light');
    onChange(signed(clampTo(Math.round(d), 0, max)));
  };
  const kindLabel = kind === 'incline' ? 'Incline' : 'Decline';
  return (
    <div>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h3 className="type-label text-text-2">Bench angle</h3>
        {value !== null ? (
          <TextLink small onClick={() => onChange(null)}>
            Clear
          </TextLink>
        ) : null}
      </div>
      {deg === null ? (
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="type-body text-text-2">Not set</p>
          <SecondaryButton compact onClick={() => set(startAt)}>
            Add angle
          </SecondaryButton>
        </div>
      ) : (
        <>
          <BenchDiagram degrees={deg} kind={kind} />
          <div className="mt-3">
            {typing ? (
              <KeypadEntry
                label={`${kindLabel} angle in degrees, type a number`}
                initial=""
                hint={`Whole degrees, 0 to ${max}.`}
                parse={parseWholeNumber}
                onDone={(v) => {
                  set(v);
                  setTyping(false);
                }}
                onCancel={() => setTyping(false)}
              />
            ) : (
              <Stepper
                label={`${kindLabel} angle`}
                value={deg}
                min={0}
                max={max}
                step={5}
                format={(d) => `${d}°`}
                decreaseLabel="−5°"
                increaseLabel="+5°"
                onChange={set}
                onValuePress={() => setTyping(true)}
              />
            )}
            <p className="type-meta mt-1 text-center text-text-2">
              {deg === 0 ? 'Flat' : kindLabel}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Angle presets">
            {ANGLE_PRESETS[kind].map((p) => (
              <Chip key={p} selected={deg === p} onClick={() => set(p)}>
                {p === 0 ? 'Flat' : `${p}°`}
              </Chip>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const RIR_CHIPS = [0, 0.5, 1, 1.5, 2, 3];

/** Target reps in reserve: stepper in steps of 0.5 from 0 to 5, chips, and "None". */
export function RirPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rir: number | null) => void;
}) {
  const set = (v: number | null) => {
    haptic('light');
    onChange(v);
  };
  return (
    <div>
      {value === null ? (
        <div className="flex items-center justify-between gap-3">
          <p className="type-body text-text-2">No target</p>
          <SecondaryButton compact onClick={() => set(2)}>
            Add a target
          </SecondaryButton>
        </div>
      ) : (
        <Stepper
          label="Target RIR"
          value={value}
          min={0}
          max={5}
          step={0.5}
          format={(v) => `RIR ${v.toLocaleString('en-GB')}`}
          onChange={set}
        />
      )}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Target RIR presets">
        {RIR_CHIPS.map((r) => (
          <Chip key={r} selected={value === r} onClick={() => set(r)}>
            {r.toLocaleString('en-GB')}
          </Chip>
        ))}
        <Chip selected={value === null} onClick={() => set(null)}>
          None
        </Chip>
      </div>
    </div>
  );
}

/** A small "Saved" check that shows for a second after each change. */
export function SavedFlash({ tick }: { tick: number }) {
  if (tick === 0) return null;
  return (
    <span
      key={tick}
      role="status"
      className="saved-flash type-meta inline-flex items-center gap-1 text-text-2"
    >
      <Check className="size-4" aria-hidden />
      Saved
    </span>
  );
}
