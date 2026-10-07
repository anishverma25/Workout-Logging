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
import {
  DEFAULT_SESSION_MINUTES,
  LIFESTYLE_PAL,
  TRAINING_MET,
  MEASURED_FAT_DAYS,
  RATE_MIN_DAYS,
  RATE_MIN_ENTRIES,
  TREND_ALPHA,
} from '@/domain/analytics/body';
import { PLATEAU_MIN_SESSIONS, PLATEAU_WEEKS } from '@/domain/analytics/standards';

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
          ['energy', 'Calories and protein'],
          ['composition', 'BMI, body fat, FFMI'],
          ['levels', 'Strength levels and DOTS'],
          ['rate', 'Rate and plateaus'],
          ['balance', 'Balance and load'],
          ['rings', 'Weekly rings'],
          ['plan', 'Your plan'],
          ['insights', 'Insights'],
          ['progression', 'Progression'],
          ['recovery', 'Recovery'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full bg-surface px-3 py-1.5 font-medium text-muted hover:text-text"
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

        <Topic
          id="e1rm"
          title="Estimated 1RM"
          formula="up to 5 reps: load × 36 ÷ (37 − reps)   (Brzycki)
6 to 12 reps: load × (1 + reps ÷ 30)   (Epley)"
        >
          <p>
            The most you could probably lift once, estimated from a set. It uses the best set of
            each session. Brzycki is used up to 5 reps, where it matches real maxes more closely,
            and Epley from 6 to 12. A single rep with nothing in reserve counts as its own load.
          </p>
          <p>
            Reps in reserve count as reps: 8 reps with 2 in reserve is estimated as a set of 10, as
            long as the total stays at {E1RM_MAX_REPS} or fewer. Sets above {E1RM_MAX_REPS} reps are
            not estimated, because the formulas become unreliable at high reps. It is never applied
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

        <Topic
          id="body"
          title="Body weight"
          formula={`trend = previous trend + (1 − 0.9^days) × (weigh-in − previous trend)`}
        >
          <p>
            The trend line smooths your weigh-ins: each one pulls it {TREND_ALPHA * 100}% of the way
            toward it per day since the last, so a salty dinner barely moves it while a real change
            shows within a couple of weeks. The weekly change is the least-squares slope of the
            trend over the last 4 weeks, shown once there are {RATE_MIN_ENTRIES} weigh-ins over at
            least {RATE_MIN_DAYS} days. The {ROLLING_WINDOW_DAYS}-day average (Home and Progress) is
            the mean of your weigh-ins in the {ROLLING_WINDOW_DAYS} days up to each entry, shown
            with at least {ROLLING_MIN_ENTRIES}.
          </p>
          <p className="mt-2">
            The weekly change is compared with a pace for your goal, as a share of body weight per
            week: losing fat 0.5 to 1%; losing fat while building 0 to 0.5%; building muscle 0.25 to
            0.5% for beginners, 0.2 to 0.4% for intermediates and 0.1 to 0.25% for advanced lifters;
            strength 0 to 0.25%.
          </p>
          <Caveat>
            The app does not judge whether a weight is good or ideal. Formulas are estimates, not
            medical advice.
          </Caveat>
        </Topic>

        <Topic
          id="energy"
          title="Calories and protein"
          formula={`BMR (Mifflin-St Jeor) = 10 × kg + 6.25 × cm − 5 × age + 5 (men) or − 161 (women)
BMR (Katch-McArdle, only without sex but with body fat) = 370 + 21.6 × lean kg
Maintenance = BMR × day level + training kcal
Training kcal a day = sessions a week × hours × (3.5 − 1) MET × kg ÷ 7`}
        >
          <p>
            This is the factorial method used in energy-requirement research, rather than one
            activity multiplier for everything. The day level covers everything except training,
            from the FAO/WHO/UNU report on human energy requirements (2004): mostly sitting{' '}
            {LIFESTYLE_PAL.sitting}, some walking {LIFESTYLE_PAL.mixed}, on your feet{' '}
            {LIFESTYLE_PAL.on_feet}, physical work {LIFESTYLE_PAL.physical}. Training is added from
            the Compendium of Physical Activities: weight training with rests averages{' '}
            {TRAINING_MET} MET, and one MET is 1 kcal per kg per hour. The resting MET is taken off,
            because the day level already counts that time. Sessions a week are your logged average
            over the last 4 weeks once you have that much history, otherwise your plan; session
            length is from your profile ({DEFAULT_SESSION_MINUTES} minutes if not set). Mifflin-St
            Jeor is used whenever sex, age and height are known, because it was the most accurate
            common equation in validation studies (Frankenfield and colleagues, 2005). Weight is the
            smoothed trend, not a single weigh-in.
          </p>
          <p className="mt-2">
            Daily target: maintenance plus 10% to build muscle, plus 5% for strength, minus 20% to
            lose fat, minus 10% to lose fat while building, maintenance for general fitness, rounded
            to 50 kcal. Protein per kg of body weight: 1.6 to 2.2 g for muscle and strength (Morton
            and colleagues, 2018), 2.0 to 2.4 g when losing fat (Helms and colleagues, 2014), 1.2 to
            1.6 g for general fitness. Fat at least 0.8 g per kg; carbohydrate fills the rest.
          </p>
          <Caveat>
            Any formula is a starting point. If your trend moves differently from your goal for 2 to
            3 weeks, change your intake by 100 to 200 kcal. Without your sex (or a body-fat
            reading), age, height and weight, no number is shown.
          </Caveat>
        </Topic>

        <Topic
          id="composition"
          title="BMI, body fat and lean mass index"
          formula={`BMI = kg ÷ m²
Body fat (US Navy), men = 495 ÷ (1.0324 − 0.19077 log₁₀(waist − neck) + 0.15456 log₁₀(height)) − 450
Body fat (US Navy), women = 495 ÷ (1.29579 − 0.35004 log₁₀(waist + hip − neck) + 0.22100 log₁₀(height)) − 450
FFMI = lean kg ÷ m², normalised = FFMI + 6.1 × (1.8 − m)`}
        >
          <p>
            BMI bands are the WHO's (18.5, 25, 30); for South Asian adults the WHO suggests acting
            from 23 and 27.5, and the explanation shows both. The tape method (Hodgdon and Beckett,
            1984) uses your latest waist, neck and, for women, hip measurements, and is usually
            within 3 to 4 points of lab tests. A reading you enter from a scale or scan is used
            instead for {MEASURED_FAT_DAYS} days. Lean mass is weight × (1 − body fat). The lean
            mass index (Kouri and colleagues, 1995) is BMI for muscle.
          </p>
          <Caveat>BMI cannot tell muscle from fat, so it misreads many lifters.</Caveat>
        </Topic>

        <Topic
          id="levels"
          title="Strength levels and DOTS"
          formula={`Level = best e1RM of the last 12 weeks ÷ body weight, against standard multiples
DOTS = total × 500 ÷ (a + b·bw + c·bw² + d·bw³ + e·bw⁴)`}
        >
          <p>
            Levels (beginner, novice, intermediate, advanced, elite) use rule-of-thumb multiples of
            body weight for men and women in the tradition of Kilgore, Rippetoe and Pendlay, for
            squat, bench press, deadlift, overhead press and barbell row. For example, a men's bench
            press reaches intermediate at 1.25 times body weight. They need your sex and a weigh-in.
          </p>
          <p className="mt-2">
            DOTS uses the published coefficients for men and women with your estimated squat, bench
            and deadlift maxes added up, so it is labelled an estimate.
          </p>
          <Caveat>Not adjusted for age. A guide for yourself, not a ranking.</Caveat>
        </Topic>

        <Topic
          id="rate"
          title="Rate of progress and stalled lifts"
          formula="Rate = least-squares slope of each session's best e1RM, kg per week"
        >
          <p>
            The rate uses every session of a compound lift in the last 8 weeks, with at least 4
            sessions over 3 weeks. A lift has stalled when its best estimated 1RM has not been
            beaten for {PLATEAU_WEEKS} weeks or more, across at least {PLATEAU_MIN_SESSIONS}{' '}
            sessions, and you trained it in the last 2 weeks. The suggestion: a new rep range for 3
            weeks of stalling, a lighter week for 4 weeks or more (or straight away for advanced
            lifters), a variation of the lift after 6 weeks.
          </p>
        </Topic>

        <Topic
          id="balance"
          title="Balance and training load"
          formula={`Balance = working sets of one group ÷ the other, last 4 weeks
Load ratio = working sets in the last 7 days ÷ weekly average of the 4 weeks before
Session load = session effort (1 to 10) × minutes`}
        >
          <p>
            Push is chest, triceps and shoulder presses; pull is back and biceps; shoulder raises
            and flyes count for neither. Push to pull outside 0.67 to 1.5 is flagged; quads to
            hamstrings and upper to lower body may run to 2. A pair needs 20 sets to be judged.
          </p>
          <p className="mt-2">
            A load ratio above 1.5 is flagged, because sudden jumps in training are linked with more
            injuries (Gabbett, 2016). It needs 5 weeks of history and at least 10 sets a week
            before. Session load (Foster's session RPE) is shown when you rate a finished workout.
          </p>
        </Topic>

        <Topic id="rings" title="Weekly rings and streak">
          <p>
            Sessions this calendar week against the days a week in your profile (or the planned days
            of your active routine); working sets against the sets your routine plans for the week;
            minutes against days × session length. A ring without a target is not shown. The streak
            counts weeks in a row that met the session target, and includes this week once it does.
          </p>
        </Topic>

        <Topic id="plan" title="Your plan">
          <p>
            The recommended split follows your days a week: 2 days full body, 3 days full body (the
            beginner programme in your first year), 4 days upper and lower, 5 days push, pull, legs,
            upper, lower, 6 or 7 days push, pull and legs twice.
          </p>
          <p className="mt-2">
            Fitting a template to you: your goal sets reps, effort and rest (for example strength:
            the first lift 3 to 5 reps with 3.5 minutes rest; muscle: 6 to 10 reps, then 8 to 12 and
            10 to 15 on isolation work). Beginners do at most 3 sets per exercise and 2 on isolation
            work; advanced lifters get one more set on the first two lifts. Exercises are swapped
            for ones your equipment allows. With a session length, isolation work at the end of the
            day is dropped until the day fits, estimating 45 seconds per set plus its rest and 2
            minutes per exercise to set up. Every result is a normal routine you can edit.
          </p>
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
            Looks at the last session of each exercise that had a routine target. Beginners progress
            linearly: a suggestion appears once every target working set reaches the bottom of the
            rep range. Intermediate and advanced lifters use double progression: every set has to
            reach the top of the range first. In both, logged RIR has to stay at or above the target
            (half a rep of slack, since RIR is a self-estimate). If RIR was not logged, the
            suggestion says effort could not be checked.
          </p>
          <p className="mt-2">
            The next load is your heaviest working set plus the smallest sensible jump: 5 kg (10 lb)
            on lower-body barbell lifts for beginners, otherwise 2.5 kg (5 lb), with reps back to
            the bottom of the range. Your routine is never changed automatically, and you can
            dismiss a suggestion.
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
        <p className="tabular my-3 whitespace-pre-line rounded-xl bg-surface-2 px-4 py-3 font-mono text-sm text-text">
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
