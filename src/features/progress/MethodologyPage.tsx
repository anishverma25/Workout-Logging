import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ROLLING_MIN_ENTRIES, ROLLING_WINDOW_DAYS } from '@/domain/analytics/bodyweight';
import { E1RM_MAX_REPS } from '@/domain/analytics/e1rm';
import {
  BELOW_BEST_THRESHOLD,
  STRENGTH_CHANGE_THRESHOLD,
  VOLUME_CHANGE_THRESHOLD,
} from '@/domain/analytics/insights';
import { PRIMARY_SET_WEIGHT, SECONDARY_SET_WEIGHT } from '@/domain/analytics/muscles';

/**
 * Every number in the app, explained. Values here are imported from the code that computes
 * them, so this page cannot drift from the calculations.
 */
export function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl pb-10">
      <div className="pt-4 lg:pt-8">
        <Link
          to="/progress"
          className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden /> Progress
        </Link>
      </div>
      <header className="pb-6 pt-1">
        <h1 className="font-display text-[1.5rem] font-bold leading-none sm:text-[1.75rem]">
          How it is calculated
        </h1>
        <p className="mt-3 max-w-[60ch] text-muted">
          Every number comes from the sets you logged, with fixed formulas. Nothing is guessed by AI
          and nothing is made up to fill a chart. When there is not enough data, the app says so
          instead.
        </p>
      </header>

      <nav aria-label="On this page" className="mb-8 flex flex-wrap gap-2 text-sm">
        {[
          ['which-sets', 'Which sets count'],
          ['volume', 'Volume load'],
          ['e1rm', 'Estimated 1RM'],
          ['records', 'Records'],
          ['relative', 'Relative strength'],
          ['frequency', 'Frequency'],
          ['adherence', 'Adherence'],
          ['muscles', 'Muscle sets'],
          ['body', 'Body weight'],
          ['insights', 'Insights'],
          ['progression', 'Progression'],
          ['recovery', 'Recovery'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full border border-line bg-surface px-3 py-1.5 font-medium text-muted hover:text-text"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-4">
        <Topic id="which-sets" title="Which sets count">
          <p>
            Only sets you marked done count. Warm-up sets are kept in your history but left out of
            volume, estimated 1RM, records and muscle set counts. Working, back-off and drop sets
            all count.
          </p>
        </Topic>

        <Topic id="volume" title="Volume load" formula="Volume load = Σ (load × reps)">
          <p>
            Added up over completed working sets of exercises tracked by weight and reps. For
            dumbbell and single-arm exercises logged per hand, both sides count, so 20 kg × 10 per
            hand is 400 kg. Bodyweight exercises are not included, because your body weight is not
            part of the logged load.
          </p>
          <Caveat>
            Volume load tracks how much work you did. It is not a direct measure of muscle growth,
            and a machine's numbers are not comparable with a barbell's.
          </Caveat>
        </Topic>

        <Topic id="e1rm" title="Estimated 1RM" formula="e1RM = load × (1 + reps ÷ 30)   (Epley)">
          <p>
            The most you could probably lift once, estimated from a set. It uses the best set of
            each session. A single rep counts as its own load. Sets above {E1RM_MAX_REPS} reps are
            not estimated, because the formula becomes unreliable at high reps. It is never applied
            to timed, distance or bodyweight-only exercises.
          </p>
          <Caveat>It is always labelled an estimate. It is not a lift you performed.</Caveat>
        </Topic>

        <Topic id="records" title="Personal records">
          <p>
            Found by going through your sessions in order and noting each time a best is beaten:
            heaviest load lifted, best estimated 1RM, most reps on a bodyweight exercise, longest
            hold or distance. Your first session with an exercise is the baseline, not a record.
            Records are recalculated whenever a set is edited or deleted, so they are never stored
            as fixed facts.
          </p>
        </Topic>

        <Topic
          id="relative"
          title="Relative strength"
          formula="Relative strength = e1RM ÷ body weight"
        >
          <p>
            Uses the latest estimated 1RM in the period and your body weight on that day: the latest
            weigh-in on or before it, or if there is none, the first within a week after. Without a
            weigh-in it is not shown.
          </p>
          <Caveat>
            Good for tracking yourself over time. Not meant for comparing with other people.
          </Caveat>
        </Topic>

        <Topic
          id="frequency"
          title="Training frequency"
          formula="Workouts per week = workouts ÷ (days ÷ 7)"
        >
          <p>
            Counts finished workouts in the period. Days before your first workout are not counted,
            so a new account is not penalised. A weekly rate needs at least 7 days of history and a
            monthly rate at least 28.
          </p>
        </Topic>

        <Topic
          id="adherence"
          title="Adherence"
          formula="Adherence = completed planned sessions ÷ planned sessions × 100"
        >
          <p>
            Planned sessions come from the weekdays set on your active routine's days. Only days
            that have passed count; today counts once you log it, so an evening workout is not
            marked missed at noon. A routine workout on a different day still counts toward
            completion. With no planned days, adherence is not shown.
          </p>
        </Topic>

        <Topic
          id="muscles"
          title="Sets per muscle group"
          formula={`Muscle sets = ${PRIMARY_SET_WEIGHT} × primary sets + ${SECONDARY_SET_WEIGHT} × secondary sets`}
        >
          <p>
            Each completed working set counts {PRIMARY_SET_WEIGHT} for the exercise's primary muscle
            and {SECONDARY_SET_WEIGHT} for each secondary muscle, using the exercise library's
            muscle data. Over two weeks or longer it is shown per week. Bodyweight and timed sets
            count too, because a hard set is a hard set.
          </p>
          <Caveat>
            It is a way to see balance between muscle groups, not a precise measure of stimulus.
          </Caveat>
        </Topic>

        <Topic id="body" title="Body weight">
          <p>
            The {ROLLING_WINDOW_DAYS}-day average is the mean of your weigh-ins in the{' '}
            {ROLLING_WINDOW_DAYS} days up to each entry, shown only when there are at least{' '}
            {ROLLING_MIN_ENTRIES}. Trends compare averages at least a week apart, never two single
            weigh-ins, because daily weight moves with water and food.
          </p>
          <Caveat>
            The app does not judge whether a weight is good or ideal, and makes no health
            assessments.
          </Caveat>
        </Topic>

        <Topic id="insights" title="Insights">
          <p>Each insight is a fixed rule with a threshold, and shows the numbers it used:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Strength trends need at least 3 sessions and a change of{' '}
              {STRENGTH_CHANGE_THRESHOLD * 100}% or more.
            </li>
            <li>
              Below best: compound lifts only, the latest session at least{' '}
              {BELOW_BEST_THRESHOLD * 100}% under your best estimate, and never when the load just
              went up.
            </li>
            <li>
              Volume changes of {VOLUME_CHANGE_THRESHOLD * 100}% or more against the previous period
              of the same length.
            </li>
            <li>Planned sessions completed, when your routine has planned days.</li>
            <li>
              Muscles you have trained before but not directly in the period (14 days or longer).
            </li>
          </ul>
        </Topic>

        <Topic id="progression" title="Progression suggestions">
          <p>
            Looks at the last session of each exercise that had a routine target. A suggestion
            appears only when every target working set reached the top of the rep range, and logged
            RIR stayed at or above the target (half a rep of slack, since RIR is a self-estimate).
            If RIR was not logged, the suggestion says effort could not be checked. Your routine is
            never changed automatically, and you can dismiss a suggestion.
          </p>
        </Topic>

        <Topic id="recovery" title="Recovery">
          <p>
            The app does not estimate how recovered a muscle is. Workout logs cannot tell you that,
            so there are no recovery percentages. It shows only the days since each muscle was last
            trained directly, which is a fact from your log.
          </p>
        </Topic>
      </div>
    </div>
  );
}

function Topic({
  id,
  title,
  formula,
  children,
}: {
  id: string;
  title: string;
  formula?: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20 p-5" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-display text-[1.4rem] font-bold">
        {title}
      </h2>
      {formula ? (
        <p className="tabular my-3 rounded-xl bg-surface-2 px-4 py-3 font-mono text-sm text-text">
          {formula}
        </p>
      ) : null}
      <div className="mt-1 leading-relaxed text-muted">{children}</div>
    </Card>
  );
}

function Caveat({ children }: { children: ReactNode }) {
  return <p className="mt-3 border-l-2 border-warn/50 pl-3 text-sm text-faint">{children}</p>;
}
