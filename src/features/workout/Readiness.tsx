import { useState } from 'react';
import { X } from 'lucide-react';
import { IconButton, PrimaryButton } from '@/components/kit';
import { db } from '@/data/db';
import { updateWorkoutFeel } from '@/data/repositories/workouts';
import type { Readiness } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';

const ROWS: { key: keyof Readiness; label: string; low: string; high: string }[] = [
  { key: 'sleep', label: 'Sleep', low: 'Poor', high: 'Great' },
  { key: 'energy', label: 'Energy', low: 'Drained', high: 'Fresh' },
  { key: 'soreness', label: 'Soreness', low: 'None', high: 'Very sore' },
];

/**
 * Optional check before training. Over time the app compares how you felt with how the
 * session went, so you see your own patterns. Nothing here changes the workout. The answers
 * are self-reported and labelled that way wherever they appear.
 */
export function ReadinessCard({
  workoutId,
  initial,
  onSaved,
  onClose,
}: {
  workoutId: string;
  initial: Readiness | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Partial<Readiness>>(initial ?? {});
  const answered = ROWS.filter((r) => values[r.key] !== undefined).length;
  const complete = answered === ROWS.length;
  return (
    <section
      aria-labelledby="readiness-title"
      className="relative rounded-panel border border-border bg-surface p-4"
    >
      <div className="absolute right-3 top-3">
        <IconButton label="Close the check-in" icon={<X />} size={32} onClick={onClose} />
      </div>
      <h2 id="readiness-title" className="type-headline pr-12 text-text-1">
        How do you feel today?
      </h2>
      <p className="type-meta mt-0.5 pr-12 text-text-2">Optional and self-reported.</p>
      <div className="mt-3 flex flex-col gap-3">
        {ROWS.map((row) => (
          <div key={row.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="type-headline text-text-1">{row.label}</span>
              <span className="type-meta text-text-2">
                1 {row.low}, 5 {row.high}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={row.label}
              className="grid h-10 grid-cols-5 gap-0.5 rounded-field bg-surface-2 p-0.5"
            >
              {[1, 2, 3, 4, 5].map((v) => {
                const selected = values[row.key] === v;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${row.label} ${v} of 5`}
                    onClick={() => setValues((cur) => ({ ...cur, [row.key]: v }))}
                    className={cn(
                      'pressable chrome type-headline tabular rounded-tile transition-colors',
                      selected ? 'bg-text-1 text-bg' : 'text-text-1',
                    )}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <PrimaryButton
          compact
          disabled={!complete}
          onClick={async () => {
            await updateWorkoutFeel(db, workoutId, { readiness: values as Readiness });
            onSaved();
          }}
        >
          Save
        </PrimaryButton>
        {!complete && answered > 0 ? (
          <span className="type-meta text-text-2">{ROWS.length - answered} more to answer</span>
        ) : null}
      </div>
    </section>
  );
}

/** 1 to 10 effort for the whole session, asked when finishing. */
export function EffortPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <p className="type-meta font-semibold text-text-2">How hard was this session? (optional)</p>
      <div role="radiogroup" aria-label="Session effort" className="mt-2 grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => {
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Effort ${v} of 10`}
              onClick={() => onChange(selected ? null : v)}
              className={cn(
                'pressable chrome type-meta tabular h-10 rounded-tile font-semibold transition-colors',
                selected ? 'bg-text-1 text-bg' : 'bg-surface-2 text-text-1',
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
      <p className="type-caption mt-1 flex justify-between text-text-2">
        <span>Easy</span>
        <span>Maximal</span>
      </p>
    </div>
  );
}
