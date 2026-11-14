import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Time each step stays on screen while it is worked on. */
const STEP_MS = 640;
/** How long "Your plan is ready" shows before the plan itself. */
const READY_MS = 900;

const R = 70;
const CIRC = 2 * Math.PI * R;

/**
 * "Building your plan", full screen, between the last question and the plan. Every line is a
 * real step the app takes with the person's answers (and the numbers in it are the real ones),
 * ticked off one after another while a ring fills. About four seconds, then the plan. With
 * reduced motion everything is ticked at once and it moves on after a short pause.
 */
export function BuildingPlan({
  name,
  lines,
  onDone,
}: {
  name: string;
  lines: string[];
  onDone: () => void;
}) {
  const still = reduceMotion();
  const [done, setDone] = useState(() => (still ? lines.length : 0));
  const finished = done >= lines.length;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (finished) {
      haptic('medium');
      const t = window.setTimeout(() => doneRef.current(), still ? 1200 : READY_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setDone((d) => d + 1), done === 0 ? 450 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [done, finished, still]);

  const share = lines.length ? done / lines.length : 1;
  const percent = Math.round(share * 100);
  const first = name.split(/\s+/)[0];

  return (
    <section
      className="flex flex-1 flex-col items-center justify-center py-6 text-center"
      aria-labelledby="setup-question"
      data-building-plan={finished ? 'done' : 'working'}
    >
      <div className="relative size-48">
        <div className="build-glow absolute -inset-10 rounded-full" aria-hidden />
        <svg viewBox="0 0 160 160" className="relative size-full -rotate-90" aria-hidden>
          <circle cx="80" cy="80" r={R} fill="none" strokeWidth="8" className="build-ring-track" />
          <circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="build-ring-fill"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - share)}
          />
        </svg>
        {!finished ? (
          <svg viewBox="0 0 160 160" className="build-orbit absolute inset-0 size-full" aria-hidden>
            <circle cx="80" cy={80 - R} r="4" className="fill-lime" />
          </svg>
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center">
          {finished ? (
            <span className="build-done flex size-20 items-center justify-center rounded-full bg-lime text-on-lime">
              <Check className="size-10" strokeWidth={3} aria-hidden />
            </span>
          ) : (
            <span className="font-display text-[2.75rem] leading-none font-bold tracking-[-0.03em] text-text-1 tabular">
              {percent}
              <span className="text-[1.25rem] text-text-2">%</span>
            </span>
          )}
        </div>
      </div>

      <h1
        id="setup-question"
        tabIndex={-1}
        className="type-display mt-8 text-text-1 outline-none [text-wrap:balance]"
        aria-live="polite"
      >
        {finished
          ? first
            ? `${first}, your plan is ready`
            : 'Your plan is ready'
          : first
            ? `Building ${first}'s plan`
            : 'Building your plan'}
      </h1>
      <p className="type-body mt-2 text-text-2">
        From your answers, with the same science as every number in the app.
      </p>

      <ul className="mt-8 flex w-full max-w-sm flex-col gap-3 text-left" aria-live="polite">
        {lines.map((line, i) => {
          const ticked = i < done;
          const working = i === done;
          return (
            <li
              key={line}
              className={cn(
                'flex items-center gap-3 transition-opacity duration-300',
                i > done ? 'opacity-30' : 'opacity-100',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
                  ticked ? 'bg-lime text-on-lime' : 'bg-surface-2',
                )}
                aria-hidden
              >
                {ticked ? (
                  <Check
                    className="size-4 [animation:check-pop_300ms_var(--ease-snap)]"
                    strokeWidth={3}
                  />
                ) : working ? (
                  <span className="size-2 animate-pulse rounded-full bg-lime" />
                ) : null}
              </span>
              <span className={cn('type-subhead', ticked ? 'text-text-1' : 'text-text-2')}>
                {line}
                {ticked ? <span className="sr-only"> done</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
