import { lazy, Suspense, useId, useMemo } from 'react';
import { Card } from '@/components/kit';
import { sharesFor } from '@/data/library/shares';
import {
  areasWorked,
  BODY_AREA_LABEL,
  setsPerArea,
  shadeLevels,
  type ExerciseLog,
} from '@/domain/analytics/bodyMap';
import type { Sex } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';

// The drawings are large, so they load only when a workout is shown.
const BodyMap = lazy(() => import('@/components/body/BodyMap'));

const setsText = (n: number) => `${n} ${n === 1 ? 'set' : 'sets'}`;

/**
 * Which muscles a workout trained, on a body from the front and the back, with the sets each
 * one got. Sets are spread over muscles by the research-based shares of each exercise, so a
 * bench set counts mostly for the chest and partly for the shoulders and triceps.
 */
export function MuscleMapCard({
  exercises,
  sex,
  className,
}: {
  exercises: ExerciseLog[];
  sex: Sex | null | undefined;
  className?: string;
}) {
  const id = useId();
  const sets = useMemo(() => setsPerArea(exercises, sharesFor), [exercises]);
  const levels = useMemo(() => shadeLevels(sets), [sets]);
  const worked = useMemo(() => areasWorked(sets), [sets]);
  if (worked.length === 0) return null;
  return (
    <Card as="section" aria-labelledby={id} className={cn('p-5', className)} data-muscle-map>
      <h2 id={id} className="type-headline text-text-1">
        Muscles worked
      </h2>
      <div className="mt-4">
        <Suspense fallback={<div className="aspect-[2/1.9] w-full" aria-hidden />}>
          <BodyMap levels={levels} sex={sex === 'female' ? 'female' : 'male'} />
        </Suspense>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5" data-muscle-list>
        {worked.slice(0, 8).map((w) => (
          <li key={w.area} className="type-meta flex items-center gap-1.5 text-text-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: `var(--muscle-${levels.get(w.area) ?? 1})` }}
            />
            <span className="text-text-1">{BODY_AREA_LABEL[w.area]}</span>
            <span className="tabular">{setsText(w.sets)}</span>
          </li>
        ))}
      </ul>
      <p className="type-caption mt-3 text-text-2">
        Each set is split across the muscles it works, from research on each exercise. Warm-ups are
        left out.
      </p>
    </Card>
  );
}
