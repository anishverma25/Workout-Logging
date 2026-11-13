import { useEffect, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Milestone } from './roadmapPlan';

/** A card choice with a drawing on top: used for goals and levels in setup. */
export function PictureOptions<T extends string>({
  label,
  value,
  onChange,
  options,
  columns = 2,
}: {
  label: string;
  value: T | null;
  onChange: (value: T) => void;
  options: { value: T; label: string; detail?: string; art: ReactNode }[];
  columns?: 1 | 2;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-2.5', columns === 2 ? 'grid-cols-2' : 'grid-cols-1')}
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'pressable chrome relative flex flex-col overflow-hidden rounded-card bg-surface-2 text-left text-text-1',
              columns === 1 && 'flex-row items-center',
              selected && 'ring-2 ring-lime ring-inset',
            )}
          >
            <span
              className={cn(
                'block shrink-0 p-2',
                columns === 2 ? 'aspect-[5/3] w-full' : 'h-20 w-32',
              )}
            >
              {o.art}
            </span>
            <span className={cn('min-w-0 px-3 pb-3', columns === 1 && 'py-3 pl-1')}>
              <span className="type-headline block">{o.label}</span>
              {o.detail ? (
                <span className="type-caption mt-0.5 block text-text-2">{o.detail}</span>
              ) : null}
            </span>
            {selected ? (
              <span
                aria-hidden
                className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-lime text-on-lime"
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * "Building your plan": each line is a real step the app takes with their answers, ticked one
 * after another, then the roadmap. About two seconds; at once with reduced motion.
 */
export function Personalising({ lines, children }: { lines: string[]; children: ReactNode }) {
  const [done, setDone] = useState(() => (reduceMotion() ? lines.length : 0));
  useEffect(() => {
    if (done >= lines.length) return;
    const t = window.setTimeout(() => setDone((d) => d + 1), done === 0 ? 350 : 480);
    return () => window.clearTimeout(t);
  }, [done, lines.length]);
  const ready = done >= lines.length;
  return (
    <div className="flex flex-col gap-6" data-personalising={ready ? 'done' : 'working'}>
      <ul className="flex flex-col gap-2.5" aria-live="polite">
        {lines.map((line, i) => {
          const ticked = i < done;
          const working = i === done;
          return (
            <li
              key={line}
              className={cn(
                'flex items-center gap-3 transition-opacity duration-300',
                i > done ? 'opacity-35' : 'opacity-100',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full',
                  ticked ? 'bg-lime text-on-lime' : 'bg-surface-2',
                )}
                aria-hidden
              >
                {ticked ? (
                  <Check className="size-4" strokeWidth={3} />
                ) : working ? (
                  <span className="size-2 animate-pulse rounded-full bg-lime" />
                ) : null}
              </span>
              <span className={cn('type-body', ticked ? 'text-text-1' : 'text-text-2')}>
                {line}
              </span>
            </li>
          );
        })}
      </ul>
      {ready ? <div className="rise-in">{children}</div> : null}
    </div>
  );
}

/** The weeks ahead as a vertical timeline. */
export function RoadmapTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="relative flex flex-col gap-5 pl-8" data-roadmap>
      <span
        aria-hidden
        className="absolute top-2 bottom-2 left-[0.6875rem] w-0.5 rounded-full bg-track"
      />
      {milestones.map((m, i) => (
        <li key={m.when} className="relative">
          <span
            aria-hidden
            className={cn(
              'absolute top-1 -left-8 flex size-6 items-center justify-center rounded-full',
              i === milestones.length - 1 ? 'glow-lime bg-lime' : 'bg-surface-2 ring-2 ring-lime',
            )}
          >
            {i === milestones.length - 1 ? (
              <Check className="size-3.5 text-on-lime" strokeWidth={3} />
            ) : null}
          </span>
          <p className="type-caption font-semibold text-lime">{m.when}</p>
          <p className="type-headline text-text-1">{m.title}</p>
          <p className="type-subhead text-text-2">{m.detail}</p>
        </li>
      ))}
    </ol>
  );
}
