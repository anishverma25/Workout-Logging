import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
 * session went, so you see your own patterns. Nothing here changes the workout.
 */
export function ReadinessCard({ workoutId, onDone }: { workoutId: string; onDone: () => void }) {
  const [values, setValues] = useState<Partial<Readiness>>({});
  const complete = ROWS.every((r) => values[r.key] !== undefined);
  return (
    <section
      aria-labelledby="readiness-title"
      className="relative rounded-[var(--radius-card)] bg-surface p-4"
    >
      <button
        type="button"
        onClick={onDone}
        aria-label="Skip the check-in"
        className="tap-target absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full bg-[var(--seg-track)] text-muted"
      >
        <X className="size-4" strokeWidth={2.5} aria-hidden />
      </button>
      <h2 id="readiness-title" className="pr-10 font-semibold">
        How do you feel today?
      </h2>
      <p className="mt-0.5 pr-10 text-sm text-faint">
        Optional. Over time you will see how sleep and energy affect your sessions.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {ROWS.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex justify-between text-xs text-faint">
              <span className="font-medium text-muted">{row.label}</span>
              <span>
                1 {row.low}, 5 {row.high}
              </span>
            </div>
            <div role="radiogroup" aria-label={row.label} className="grid grid-cols-5 gap-1.5">
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
                      'tabular h-10 rounded-[0.7rem] font-display font-semibold transition-colors',
                      selected ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text',
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
      <Button
        size="sm"
        className="mt-4"
        disabled={!complete}
        onClick={async () => {
          await updateWorkoutFeel(db, workoutId, { readiness: values as Readiness });
          onDone();
        }}
      >
        Save
      </Button>
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
      <p className="text-sm font-medium text-muted">How hard was this session? (optional)</p>
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
                'tabular h-10 rounded-[0.6rem] text-sm font-semibold transition-colors',
                selected ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text',
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
      <p className="mt-1 flex justify-between text-xs text-faint">
        <span>Easy</span>
        <span>Maximal</span>
      </p>
    </div>
  );
}
