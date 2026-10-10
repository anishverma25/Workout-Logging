import type { RecentWorkout } from '@/domain/analytics/dashboard';
import { Card, SectionHeader } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import type { WeightUnit } from '@/lib/units';
import { workoutStats } from '@/features/shared/workoutStats';
import { WorkoutRow } from '@/features/shared/WorkoutRow';

export function RecentActivity({
  items,
  unit,
  className,
}: {
  items: RecentWorkout[];
  unit: WeightUnit;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <Card className={cn('p-5', className)} aria-labelledby="recent-title">
      <SectionHeader
        id="recent-title"
        title="Recent workouts"
        action={{ label: 'History', to: '/history' }}
      />
      <ul className="divide-y-[0.5px] divide-divider">
        {items.map(({ session, minutes, workingSets, volumeKg, prCount }) => (
          <li key={session.workout.id}>
            <WorkoutRow
              to={`/history/${session.workout.id}`}
              date={session.date}
              name={session.workout.name}
              stats={workoutStats(minutes, workingSets, volumeKg, unit)}
              exercises={session.exercises
                .filter((e) => e.sets.some((s) => s.completedAt !== null))
                .map((e) => e.workoutExercise.exerciseName)}
              records={prCount}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
