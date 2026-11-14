import { useMemo } from 'react';
import { CalendarPlus, Users } from 'lucide-react';
import { Card, CapsuleButton, SecondaryButton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { trainingCalendar } from '@/data/calendar';
import { downloadText } from '@/data/export';
import { activeRoutine, daysForRoutine } from '@/domain/analytics/schedule';
import type { Session, TrainingData } from '@/domain/analytics/sessions';
import { buildWeekFacts } from '@/domain/brain/facts';
import { MUSCLE_LABELS } from '@/domain/models/labels';
import type { MuscleGroup } from '@/domain/models/schemas';
import { muscleSetsInsight } from '@/domain/onboarding/firstDays';

/**
 * After the first finished workout only (batch 9): something true back (the most-trained
 * muscle against the research range), then two reasons to come back: friends and the calendar.
 */
export function FirstWorkoutCard({
  session,
  data,
  className,
}: {
  session: Session;
  data: TrainingData;
  className?: string;
}) {
  const toast = useToast();
  const insight = useMemo(() => {
    const [week] = buildWeekFacts({
      sessions: [session],
      food: [],
      weights: [],
      from: session.date,
      to: session.date,
    });
    const muscles = Object.fromEntries(
      Object.entries(week?.muscles ?? {}).map(([m, n]) => [
        MUSCLE_LABELS[m as MuscleGroup] ?? m,
        n,
      ]),
    );
    return muscleSetsInsight(muscles);
  }, [session]);
  const routine = activeRoutine(data.routines);
  const planned = routine
    ? daysForRoutine(routine, data.routineDays).filter((d) => d.weekdays.length > 0)
    : [];

  return (
    <Card
      as="section"
      aria-labelledby="first-workout-title"
      className={className}
      data-first-workout
    >
      <p className="type-footnote text-lime">Your first workout</p>
      {insight ? (
        <>
          <h2 id="first-workout-title" className="type-headline mt-1 text-text-1">
            {insight.title}
          </h2>
          <p className="type-subhead mt-1 text-text-2">{insight.detail}</p>
        </>
      ) : (
        <h2 id="first-workout-title" className="type-headline mt-1 text-text-1">
          Every set you logged is saved to your account
        </h2>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <CapsuleButton to="/groups" tone="lime" icon={<Users className="size-4" aria-hidden />}>
          Train with friends
        </CapsuleButton>
        {routine && planned.length > 0 ? (
          <SecondaryButton
            compact
            icon={<CalendarPlus aria-hidden />}
            onClick={() => {
              downloadText(
                trainingCalendar({
                  routineName: routine.name,
                  days: planned,
                  time: '18:00',
                  minutes: data.profile?.sessionMinutes ?? 60,
                  remindBefore: 30,
                }),
                'training-days.ics',
                'text/calendar',
              );
              toast('Calendar file downloaded. Change the time in Settings any time.');
            }}
          >
            Add training days to your calendar
          </SecondaryButton>
        ) : null}
      </div>
    </Card>
  );
}
