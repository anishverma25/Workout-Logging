import { useId, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { Card, TextLink } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { setWorkoutKcal } from '@/data/repositories/workouts';
import { workoutBurn } from '@/domain/activity/burn';
import type { BodyWeightEntry, Workout, WorkoutSet } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { EvidenceLink } from '../science/EvidenceLink';
import { EstimateNote } from '../activity/EstimateNote';
import { KcalSheet } from '../activity/KcalSheet';

/**
 * Calories burned in a finished workout: an estimate from the minutes, how hard the sets were
 * and body weight, or the number the person typed from a watch or tracker.
 */
export function WorkoutBurnCard({
  workout,
  sets,
  bodyWeights,
  className,
}: {
  workout: Workout;
  sets: WorkoutSet[];
  bodyWeights: BodyWeightEntry[];
  className?: string;
}) {
  const id = useId();
  const toast = useToast();
  const [typing, setTyping] = useState(false);
  const burn = useMemo(() => workoutBurn(workout, sets, bodyWeights), [workout, sets, bodyWeights]);
  const save = async (kcal: number | null) => {
    try {
      await setWorkoutKcal(db, workout.id, kcal);
      setTyping(false);
      toast(kcal === null ? 'Back to the estimate' : 'Calories saved');
    } catch {
      toast('Could not save. Try again.');
    }
  };
  return (
    <Card as="section" aria-labelledby={id} className={cn(className)} data-workout-burn>
      <div className="flex items-center gap-2">
        <h2 id={id} className="type-title text-text-1">
          Calories burned
        </h2>
        <EvidenceLink topic="activity-energy" about="how calories burned are estimated" />
      </div>
      {burn ? (
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-surface-2 text-text-2">
            <Flame className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="type-stat tabular text-text-1" data-burn-kcal>
              {burn.source === 'estimated' ? '~' : ''}
              {burn.kcal.toLocaleString('en-GB')}
              <span className="type-meta ml-1 font-normal text-text-2">kcal</span>
            </p>
            <p className="type-caption text-text-2">
              {burn.source === 'estimated'
                ? `Estimate: ${burn.basis}`
                : 'From your watch or tracker'}
            </p>
          </div>
        </div>
      ) : (
        <p className="type-meta mt-2 text-text-2">
          Add a weigh-in on the Body page to estimate calories burned, or type a number from your
          tracker.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <TextLink small onClick={() => setTyping(true)} data-enter-kcal>
          {burn?.source === 'typed' ? 'Change the number' : 'Enter from my watch or app'}
        </TextLink>
      </div>
      <EstimateNote className="mt-3" />
      <KcalSheet
        open={typing}
        onClose={() => setTyping(false)}
        title="Calories burned"
        initial={burn?.source === 'typed' ? burn.kcal : null}
        onSave={save}
        onClear={burn?.source === 'typed' ? () => save(null) : undefined}
      />
    </Card>
  );
}
