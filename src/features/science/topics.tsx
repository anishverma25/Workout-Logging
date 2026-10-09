import type { ReactNode } from 'react';
import { E1RM_MAX_REPS, E1RM_PREFERRED_MAX_REPS } from '@/domain/analytics/e1rm';
import {
  BELOW_BEST_THRESHOLD,
  SIZE_EXPONENT,
  STRENGTH_CHANGE_THRESHOLD,
  VOLUME_CHANGE_THRESHOLD,
} from '@/domain/analytics/insights';
import {
  HARD_SET_MAX_RIR,
  PRIMARY_SET_WEIGHT,
  SECONDARY_SET_WEIGHT,
} from '@/domain/analytics/muscles';
import {
  DEFAULT_SESSION_MINUTES,
  GOAL_ENERGY,
  GOAL_PROTEIN,
  LIFESTYLE_PAL,
  MEASURED_FAT_DAYS,
  RATE_MIN_DAYS,
  RATE_MIN_ENTRIES,
  TRAINING_MET,
  TREND_DAYS,
} from '@/domain/analytics/body';
import { PLATEAU_MIN_SESSIONS, PLATEAU_WEEKS } from '@/domain/analytics/standards';
import { REST_PRESETS } from '@/domain/workout/restTimer';
import { GOAL_LABEL } from '@/domain/models/labels';

/**
 * Every number in the app, the formula behind it and the research it rests on. Thresholds are
 * imported from the code that applies them, so this page cannot drift from the calculations.
 * Content follows the Evidence Corner (Project doc claude/evidence-corner.md).
 */

export interface Formula {
  tex: string;
  /** What a screen reader says. */
  spoken: string;
  /** Optional line under the formula naming the symbols. */
  where?: string;
}

export interface Topic {
  id: string;
  title: string;
  /** Key in METRIC_EVIDENCE; topics without one are app rules. */
  evidence?: string;
  shows: ReactNode;
  formulas?: Formula[];
  why?: ReactNode[];
  forYou?: ReactNode;
  limits?: ReactNode;
}

export interface TopicGroup {
  id: string;
  title: string;
  topics: Topic[];
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export const SCIENCE: TopicGroup[] = [
  {
    id: 'strength',
    title: 'Strength',
    topics: [
      {
        id: 'e1rm',
        title: 'Estimated 1RM',
        evidence: 'estimated1RM',
        shows:
          'An estimate of the most you could lift once, worked out from a set you actually did. It drives the strength charts and records.',
        formulas: [
          {
            tex: String.raw`\text{e1RM} = W \times \left(1 + \dfrac{r}{30}\right)`,
            spoken: 'e1RM equals W times, 1 plus r over 30',
            where: 'W is the load lifted and r the reps completed (Epley).',
          },
          {
            tex: String.raw`\begin{gathered} \text{e1RM} = W \times \left(1 + \dfrac{r + \text{RIR}}{30}\right) \\ \text{when } r + \text{RIR} \le ${E1RM_MAX_REPS} \end{gathered}`,
            spoken: `With reps in reserve logged: W times, 1 plus r plus RIR over 30, when r plus RIR is at most ${E1RM_MAX_REPS}`,
            where:
              'RIR is the reps you had left. A single rep with nothing left counts as its own load.',
          },
        ],
        why: [
          <>
            Reynolds and colleagues tested 1RM prediction in 70 people plus a 20 person validation
            group. The 5RM predicted the true max best (R² of 0.974 on leg press and 0.993 on chest
            press), and they concluded that no more than 10 reps should go into a linear equation.
            That is why sets above {E1RM_MAX_REPS} reps are not estimated.
          </>,
          <>
            In the same comparison Epley was among the most accurate linear equations, with the
            smallest average error and only a slight tendency to overestimate. The app uses it
            rather than an invented formula.
          </>,
          <>
            Nuzzo and colleagues pooled 898 reps to failure tests from about 7,000 people. At 80% of
            1RM the average was 9.75 reps with a standard deviation of 2.51, and leg press allowed
            more reps than bench press at every load. One formula cannot be exact for everyone, so
            the charts prefer your best set of 1 to {E1RM_PREFERRED_MAX_REPS} reps when there is
            one.
          </>,
        ],
        forYou:
          'You can watch strength rise without testing a max. Heavy sets of about 5 reps or fewer give the most trustworthy estimate.',
        limits:
          'Accuracy falls as reps rise and differs between exercises. It is always labelled an estimate and only used on weight and reps exercises.',
      },
      {
        id: 'effort',
        title: 'Effort (RIR and RPE)',
        evidence: 'effortInput',
        shows: 'How many reps you had left at the end of a set (RIR), or the matching RPE.',
        formulas: [
          {
            tex: String.raw`\text{RPE} = 10 - \text{RIR}`,
            spoken: 'RPE equals 10 minus RIR',
            where:
              'RPE 10 is no reps left, 9 is one left, 8 is two left, 7 is three left, 5 to 6 is four to six left.',
          },
        ],
        why: [
          <>
            Zourdos and colleagues validated this reps in reserve scale in 29 lifters. Bar speed
            tracked the ratings closely (r = −0.88 in experienced lifters, −0.77 in novices), so the
            number reflects how close you really were to failure.
          </>,
          <>
            Halperin and colleagues pooled 262 estimates: lifters under predicted their reps to
            failure by about 0.95 reps on average, and were more accurate on sets of 12 reps or
            fewer and closer to failure.
          </>,
        ],
        forYou:
          'Logging RIR sharpens your estimated 1RM and tells the app how hard you trained. Expect your guess to be off by about one rep.',
        limits:
          'It is a self report, so an estimate built from a set far from failure is less certain.',
      },
      {
        id: 'relative',
        title: 'Relative strength',
        evidence: 'relativeStrength',
        shows:
          'Strength per unit of body weight, so progress is not hidden when your weight changes.',
        formulas: [
          {
            tex: String.raw`R = \dfrac{\text{e1RM}}{m}`,
            spoken: 'R equals e1RM over body mass',
            where: 'Shown on screen. m is your body weight on the day.',
          },
          {
            tex: String.raw`S_n = \dfrac{\text{e1RM}}{m^{${SIZE_EXPONENT}}}`,
            spoken: `S n equals e1RM over body mass to the power ${SIZE_EXPONENT}`,
            where: 'Size adjusted index used behind the scenes for trend insights.',
          },
        ],
        why: [
          <>
            Jaric&apos;s review recommends dividing force measures by body mass to the power 0.67:
            muscle force scales with cross sectional area, which scales with mass to the two thirds
            power. A 1RM is a force measure, so 0.67 applies.
          </>,
        ],
        forYou:
          'The plain ratio is easy to read. The adjusted index stops a heavier body from making you look weaker when you are actually stronger.',
        limits:
          'The exponent is a population average. Body weight is your latest weigh-in on or before the day, so without one this is not shown.',
      },
      {
        id: 'insights',
        title: 'What counts as real progress',
        evidence: 'insightThreshold',
        shows: 'Insights only appear when a change is bigger than normal day to day noise.',
        formulas: [
          {
            tex: String.raw`\dfrac{\lvert E_{\text{now}} - E_{\text{before}} \rvert}{E_{\text{before}}} \ge ${STRENGTH_CHANGE_THRESHOLD * 100}\%`,
            spoken: `The relative change in e1RM is at least ${STRENGTH_CHANGE_THRESHOLD * 100} percent`,
          },
        ],
        why: [
          <>
            Grgic and colleagues reviewed 32 studies of 1RM test reliability (1,595 people). The
            typical test to test noise, the coefficient of variation, was about 4.2%. An estimate
            from a rep set is noisier than a tested max, so the app sets its line slightly above, at{' '}
            {STRENGTH_CHANGE_THRESHOLD * 100}%.
          </>,
          <>
            The same {pct(BELOW_BEST_THRESHOLD)} applies to a session below your best, and{' '}
            {pct(VOLUME_CHANGE_THRESHOLD)} to volume changes. A strength trend needs at least 3
            sessions. When the plain change is under the line but the size adjusted index above
            clears it, the insight says your strength for your size went up.
          </>,
        ],
        forYou: 'A 1 or 2% wobble is noise. When the app flags a change, it is a real one.',
        limits: 'The 4.2% comes from tested maxes, which is why the threshold is rounded up.',
      },
      {
        id: 'progression',
        title: 'Progression suggestions',
        evidence: 'progression',
        shows:
          'A nudge to add load once every working set reached the top of your rep range at the effort you planned.',
        formulas: [
          {
            tex: String.raw`\begin{gathered} W_{\text{next}} = W_{\max} + \Delta W \\ \Delta W \in \{2.5,\ 5\}\ \text{kg} \end{gathered}`,
            spoken: 'Next load equals your heaviest working set plus 2.5 or 5 kilograms',
            where:
              '5 kg (10 lb) on lower body barbell lifts for beginners, otherwise 2.5 kg (5 lb). Reps go back to the bottom of the range.',
          },
        ],
        why: [
          <>
            Plotkin and colleagues randomised 43 trained lifters for 8 weeks to add either load or
            reps. Muscle growth was similar, and strength slightly favoured adding load (about 2
            kg). Both work, so the app uses double progression: fill the rep range, then add load.
          </>,
          <>
            Beginners progress as soon as every set reaches the bottom of the range. Logged RIR has
            to stay at or above the target, with half a rep of slack because RIR is a guess.
          </>,
        ],
        forYou:
          'When a weight feels easy across all sets, add a rep or nudge the load. Both build muscle.',
        limits: 'The app suggests. It never changes your routine, and you can dismiss it.',
      },
      {
        id: 'levels',
        title: 'Strength levels and DOTS',
        evidence: 'strengthLevels',
        shows:
          'Where your squat, bench, deadlift, overhead press and row sit from beginner to elite, and a DOTS score for your total.',
        formulas: [
          {
            tex: String.raw`\text{level} = \dfrac{\max \text{e1RM}_{\,12\ \text{weeks}}}{m}`,
            spoken: 'Level is your best e1RM of the last 12 weeks over body weight',
            where: 'Compared with standard multiples of body weight for men and women.',
          },
          {
            tex: String.raw`\text{DOTS} = \dfrac{500\,T}{a + bm + cm^2 + dm^3 + em^4}`,
            spoken: 'DOTS equals total times 500 over a fourth degree polynomial in body mass',
            where:
              'T is your estimated squat, bench and deadlift added up; a to e are the published coefficients.',
          },
        ],
        why: [
          <>
            Levels follow the body weight multiples popularised by Kilgore, Rippetoe and Pendlay.
            For example, a men&apos;s bench press reaches intermediate at 1.25 times body weight.
          </>,
          <>
            DOTS was adopted by German powerlifting (BVDK) to compare lifters of different sizes.
          </>,
        ],
        limits:
          'Rules of thumb, not adjusted for age. A guide for yourself, not a ranking. Needs your sex and a weigh-in.',
      },
      {
        id: 'plateaus',
        title: 'Rate of progress and stalled lifts',
        shows: 'How fast a compound lift is moving, and when it has stopped.',
        formulas: [
          {
            tex: String.raw`\text{rate} = 7 \cdot \dfrac{\sum_i (x_i - \bar{x})(y_i - \bar{y})}{\sum_i (x_i - \bar{x})^2}`,
            spoken: 'Rate is 7 times the least squares slope of best e1RM against days',
            where:
              'x is the day and y the session best e1RM, over the last 8 weeks (at least 4 sessions across 3 weeks).',
          },
        ],
        why: [
          <>
            A lift has stalled when its best has not been beaten for {PLATEAU_WEEKS} weeks or more,
            across at least {PLATEAU_MIN_SESSIONS} sessions, and you trained it in the last 2 weeks.
            The suggestion: a new rep range at 3 weeks, a lighter week at 4 or more, a variation
            after 6.
          </>,
        ],
        limits: 'An app rule built on your own data, not a scientific threshold.',
      },
      {
        id: 'records',
        title: 'Personal records',
        evidence: 'personalRecords',
        shows:
          'The best value you have actually recorded: heaviest load, best estimated 1RM, most reps, longest hold or distance.',
        why: [
          <>
            Found by going through your sessions in order and noting each time a best is beaten.
            Your first session with an exercise is the baseline, not a record. Editing a past set
            recalculates every record.
          </>,
        ],
      },
    ],
  },
  {
    id: 'training',
    title: 'Training',
    topics: [
      {
        id: 'muscles',
        title: 'Hard sets per muscle',
        evidence: 'muscleHardSets',
        shows:
          'Weekly sets for each muscle. A muscle worked directly counts as a full set, one that helps counts as half.',
        formulas: [
          {
            tex: String.raw`\begin{aligned} S_{\text{muscle}} &= ${PRIMARY_SET_WEIGHT} \times N_{\text{direct}} \\ &\quad + ${SECONDARY_SET_WEIGHT} \times N_{\text{indirect}} \end{aligned}`,
            spoken: `Muscle sets equal ${PRIMARY_SET_WEIGHT} times direct sets plus ${SECONDARY_SET_WEIGHT} times indirect sets`,
            where: `Only completed working sets with ${HARD_SET_MAX_RIR} or fewer reps in reserve (or no effort logged) count.`,
          },
        ],
        why: [
          <>
            Pelland and colleagues (2026) analysed 67 studies and 2,058 people. Counting an indirect
            set as half best predicted both growth and strength. Their own example: 5 sets of curls
            plus 5 sets of rows give the biceps 7.5 sets. That is exactly this rule.
          </>,
          <>
            More volume kept producing more growth across the range studied, with strength
            flattening sooner than size. So the app shows your count and trend, not one ideal
            number.
          </>,
          <>
            Baz-Valle and colleagues found counting sets near failure is a valid volume measure for
            6 to 20+ reps, which is why sets far from failure are left out.
          </>,
        ],
        forYou:
          'More quality sets generally means more growth, with returns flattening as the total climbs.',
        limits: 'A volume proxy, not a direct measure of growth.',
      },
      {
        id: 'shares',
        title: 'What each exercise works',
        evidence: 'muscleShares',
        shows:
          'Under each library exercise, the approximate share of the work done by each muscle region, for example upper chest 40%.',
        why: [
          <>
            Each breakdown was built from electromyography (EMG) and muscle growth studies of that
            exercise, or the closest one studied, then rounded to 5% so the shares add up to 100%.
            The sources sit under every exercise.
          </>,
          <>
            For example, the López-Vivancos meta-analysis of bench press variants shows decline
            pressing shifts work toward the lower chest and incline toward the upper chest.
          </>,
        ],
        forYou:
          'Pick exercises for the region you want to bring up, and see why they feel the way they do.',
        limits:
          'Muscle activity is not the same as the load each muscle carries, and form changes it. Treat the numbers as a guide. Exercises marked as estimated borrow from a similar movement.',
      },
      {
        id: 'volume',
        title: 'Volume load',
        evidence: 'volumeLoad',
        shows: 'Total weight moved on an exercise.',
        formulas: [
          {
            tex: String.raw`V = \sum_{i} w_i \times r_i`,
            spoken: 'Volume equals the sum of load times reps over completed sets',
            where:
              'Dumbbell and single side exercises count both sides: 20 kg × 10 each hand is 400 kg.',
          },
        ],
        why: [
          <>
            Bookkeeping, not a scientific claim. Baz-Valle and colleagues note it always comes out
            higher on a leg press than a squat at the same effort, so it suits tracking one exercise
            over time, not comparing exercises. Hard sets are better for that.
          </>,
        ],
        limits: 'Not a growth score, and bodyweight exercises are left out.',
      },
      {
        id: 'effort-target',
        title: 'Effort targets in routines',
        evidence: 'effortTarget',
        shows:
          'The reps in reserve your routine aims for: closer to failure for size, heavier and less close for pure strength.',
        why: [
          <>
            Robinson and colleagues (2024) found that for muscle growth, finishing closer to failure
            helped. For strength, closeness to failure barely mattered and load mattered more. So
            size and strength goals get different cues.
          </>,
        ],
        forYou: 'For size, end most sets within a few reps of failure. For strength, lift heavy.',
        limits:
          'RIR in those studies was estimated afterwards, so the exact best value is uncertain.',
      },
      {
        id: 'rest',
        title: 'Rest times',
        evidence: 'restTimer',
        shows: `Rest presets of ${REST_PRESETS.join(', ')} seconds, with 90 to 120 a sensible default. You can set any length to the second, and a separate rest when you move to the next exercise.`,
        why: [
          <>
            Singer and colleagues (2024) pooled 9 studies: resting more than 60 seconds gave a small
            growth benefit, likely because short rests cut the reps you manage on later sets. Beyond
            about 90 seconds there was no further gain, and no loss either.
          </>,
        ],
        forYou: 'Rest at least a minute between hard sets. Longer does not cost you growth.',
        limits: 'The effect is small and mostly studied in untrained people.',
      },
      {
        id: 'frequency',
        title: 'Training frequency',
        evidence: 'frequency',
        shows: 'Workouts per week and per month, framed as consistency.',
        formulas: [
          {
            tex: String.raw`f = \dfrac{\text{workouts}}{\text{days} \,/\, 7}`,
            spoken: 'Frequency equals workouts over days divided by 7',
            where:
              'Days before your first workout are not counted. A weekly rate needs 7 days of history.',
          },
        ],
        why: [
          <>
            Schoenfeld, Grgic and Krieger (25 studies) found that with weekly volume matched,
            training a muscle 1, 2, 3 or 4 to 6 days a week produced similar growth.
          </>,
          <>
            The 2026 ACSM Position Stand, built from 137 systematic reviews, advises each major
            muscle at least twice a week and stresses that consistency is the biggest win.
          </>,
        ],
        forYou:
          'Hit your weekly sets and keep showing up. Twice a week per muscle is a solid floor.',
      },
      {
        id: 'adherence',
        title: 'Adherence',
        evidence: 'adherence',
        shows: 'How many of your planned sessions you completed.',
        formulas: [
          {
            tex: String.raw`A = \dfrac{\text{planned, completed}}{\text{planned}} \times 100\%`,
            spoken:
              'Adherence equals completed planned sessions over planned sessions times 100 percent',
          },
        ],
        why: [
          <>
            A ratio of your plan to your log. Only days that have passed count, and today counts
            once you log it.
          </>,
        ],
        limits: 'Shown only when your routine has planned days.',
      },
      {
        id: 'load',
        title: 'Balance and training load',
        evidence: 'trainingLoad',
        shows: 'Push to pull balance, sudden jumps in weekly sets, and the load of each session.',
        formulas: [
          {
            tex: String.raw`\text{load ratio} = \dfrac{N_{\text{last 7 days}}}{\tfrac{1}{4}\, N_{\text{4 weeks before}}}`,
            spoken:
              'Load ratio equals sets in the last 7 days over the weekly average of the 4 weeks before',
          },
          {
            tex: String.raw`L = \text{RPE}_{\text{session}} \times t_{\text{minutes}}`,
            spoken: 'Session load equals session effort times minutes',
          },
        ],
        why: [
          <>
            Gabbett (2016) linked sudden spikes in training, a ratio above about 1.5, with more
            injuries, so the app flags that. It needs 5 weeks of history.
          </>,
          <>
            Session load is Foster&apos;s session RPE method, shown when you rate a finished
            workout. Push to pull outside 0.67 to 1.5 is flagged once a pair has 20 sets.
          </>,
        ],
        limits: 'A prompt to look at your training, not an injury prediction.',
      },
    ],
  },
  {
    id: 'body',
    title: 'Body',
    topics: [
      {
        id: 'body-weight',
        title: 'Body weight trend',
        evidence: 'bodyWeightTrend',
        shows: `Your weigh-ins and a ${TREND_DAYS} day average line.`,
        formulas: [
          {
            tex: String.raw`\bar{m}_t = \dfrac{1}{n} \sum_{d = t - ${TREND_DAYS - 1}}^{t} m_d`,
            spoken: `The trend is the mean of the weigh-ins in the ${TREND_DAYS} days ending today`,
            where: 'n is the number of weigh-ins in that window.',
          },
        ],
        why: [
          <>
            Orsama and colleagues tracked 4,657 daily weigh-ins from 80 adults. Weight rises after
            the weekend and falls across the week, often lowest on Friday. Those swings are normal,
            and the study itself used a 7 day moving average to find the real trend.
          </>,
        ],
        forYou:
          'One day means little. Judge progress from the average, weighing under the same conditions.',
        limits: 'Needs about a week of weigh-ins. The app never calls a weight good or ideal.',
      },
      {
        id: 'rate',
        title: 'Weekly rate of change',
        evidence: 'weightChangeRate',
        shows: `How fast the trend is moving, with a target only for the ${GOAL_LABEL.fat_loss} goal.`,
        formulas: [
          {
            tex: String.raw`-1\% \;\le\; \dfrac{\Delta m_{\text{week}}}{m} \;\le\; -0.5\%`,
            spoken: 'Losing between 0.5 and 1 percent of body weight per week',
            where: `The weekly change is the least squares slope of the trend over 4 weeks, shown after ${RATE_MIN_ENTRIES} weigh-ins over ${RATE_MIN_DAYS} days.`,
          },
        ],
        why: [
          <>
            Helms, Aragon and Fitschen (2014) recommend losing about 0.5 to 1% of body weight a week
            to keep muscle. In the studies they cite, losing 0.7% a week raised lean mass by 2.1%
            while 1.4% a week did not, and a 1 kg weekly loss cost about 5% of bench strength.
          </>,
        ],
        forYou: 'When cutting, slower protects the muscle you built.',
        limits: 'Context, not a prescription. Other goals see their rate without a verdict.',
      },
      {
        id: 'bmr',
        title: 'Resting energy (BMR)',
        evidence: 'bmr',
        shows: 'The calories your body uses at rest, the base of your maintenance number.',
        formulas: [
          {
            tex: String.raw`\begin{aligned} \text{BMR} &= 10m + 6.25h - 5a + s \\ s &= \begin{cases} +5 & \text{men} \\ -161 & \text{women} \end{cases} \end{aligned}`,
            spoken:
              'BMR equals 10 times kilograms plus 6.25 times centimetres minus 5 times age, plus 5 for men or minus 161 for women',
            where: 'Mifflin-St Jeor. m in kg (your trend weight), h in cm, a in years.',
          },
          {
            tex: String.raw`\text{BMR} = 370 + 21.6\, m_{\text{lean}}`,
            spoken: 'BMR equals 370 plus 21.6 times lean mass',
            where: 'Katch-McArdle, used only when sex is not set but body fat is known.',
          },
        ],
        why: [
          <>
            Frankenfield and colleagues (2005) compared the common equations and found Mifflin-St
            Jeor the most accurate in healthy adults, within 10% of measured values for most people.
          </>,
        ],
        limits:
          'Any equation is a starting point. Without age, height and weight no number is shown.',
      },
      {
        id: 'maintenance',
        title: 'Maintenance calories',
        evidence: 'maintenance',
        shows: 'Calories to hold your weight, and a daily target for your goal.',
        formulas: [
          {
            tex: String.raw`\begin{aligned} \text{TDEE} &= \text{BMR} \times \text{PAL} \\ &\quad + \dfrac{n\,t\,(\text{MET} - 1)\,m}{7} \end{aligned}`,
            spoken:
              'Maintenance equals BMR times activity level, plus sessions a week times hours times MET minus 1 times kilograms, over 7',
            where: `PAL is your day outside training: ${LIFESTYLE_PAL.sitting} mostly sitting, ${LIFESTYLE_PAL.mixed} some walking, ${LIFESTYLE_PAL.on_feet} on your feet, ${LIFESTYLE_PAL.physical} physical work. MET = ${TRAINING_MET}, n sessions a week, t hours a session (${DEFAULT_SESSION_MINUTES} minutes if not set).`,
          },
          {
            tex: String.raw`\text{target} = \text{TDEE} \times (1 + g)`,
            spoken: 'Target equals maintenance times 1 plus the goal adjustment',
            where: `g is ${Object.entries(GOAL_ENERGY)
              .map(
                ([k, v]) =>
                  `${v > 0 ? '+' : ''}${Math.round(v * 100)}% for ${GOAL_LABEL[k as keyof typeof GOAL_LABEL]}`,
              )
              .join(', ')}. Rounded to 50 kcal.`,
          },
        ],
        why: [
          <>
            The factorial method from the FAO/WHO/UNU report on human energy requirements (2004): a
            level for your day, plus training added separately, rather than one multiplier for
            everything.
          </>,
          <>
            Weight training averages {TRAINING_MET} MET in the 2024 Compendium of Physical
            Activities. One MET is about 1 kcal per kg per hour, and the resting MET is taken off
            because the day level already covers that time.
          </>,
        ],
        forYou:
          'If your trend moves the wrong way for 2 to 3 weeks, change intake by 100 to 200 kcal.',
        limits: 'An estimate. Your trend weight is the real test.',
      },
      {
        id: 'protein',
        title: 'Protein',
        evidence: 'protein',
        shows: 'A daily protein range, exact to one decimal.',
        formulas: [
          {
            tex: String.raw`\begin{gathered} P = m \times p \\ p \in [${GOAL_PROTEIN.hypertrophy[0]},\ ${GOAL_PROTEIN.hypertrophy[1]}]\ \text{g/kg} \end{gathered}`,
            spoken: `Protein equals body weight times ${GOAL_PROTEIN.hypertrophy[0]} to ${GOAL_PROTEIN.hypertrophy[1]} grams per kilogram`,
            where: `${GOAL_PROTEIN.fat_loss[0]} to ${GOAL_PROTEIN.fat_loss[1]} g/kg when losing fat or recomposing, ${GOAL_PROTEIN.general_fitness[0]} to ${GOAL_PROTEIN.general_fitness[1]} g/kg for general fitness.`,
          },
        ],
        why: [
          <>
            Morton and colleagues (49 studies, 1,863 people) found the benefit for muscle and
            strength levelled off at about 1.6 g per kg a day, with 2.2 a sensible upper bound.
          </>,
          <>Helms and colleagues recommend more in a calorie deficit to protect lean mass.</>,
        ],
        limits:
          'Total daily protein matters most. Not medical advice for kidney or other conditions.',
      },
      {
        id: 'composition',
        title: 'BMI, body fat and lean mass',
        evidence: 'bodyFat',
        shows: 'BMI, an estimated body fat from tape measurements, and a lean mass index.',
        formulas: [
          {
            tex: String.raw`\text{BMI} = \dfrac{m}{h^2}`,
            spoken: 'BMI equals kilograms over height in metres squared',
          },
          {
            tex: String.raw`\begin{aligned} \%\text{BF} &= \dfrac{495}{D} - 450 \\ D_{\text{men}} &= 1.0324 - 0.19077 \log_{10}(w - n) \\ &\quad + 0.15456 \log_{10} h \end{aligned}`,
            spoken:
              'Body fat equals 495 over D, minus 450. For men, D is 1.0324 minus 0.19077 log of waist minus neck, plus 0.15456 log of height',
          },
          {
            tex: String.raw`\begin{aligned} D_{\text{women}} &= 1.29579 \\ &\quad - 0.35004 \log_{10}(w + p - n) \\ &\quad + 0.22100 \log_{10} h \end{aligned}`,
            spoken:
              'For women, D is 1.29579 minus 0.35004 log of waist plus hip minus neck, plus 0.22100 log of height',
            where: 'w waist, n neck, p hip, h height, all in cm.',
          },
          {
            tex: String.raw`\begin{aligned} \text{FFMI} &= \dfrac{m\,(1 - \text{BF})}{h^2} \\ \text{normalised} &= \text{FFMI} + 6.1\,(1.8 - h) \end{aligned}`,
            spoken:
              'Lean mass index equals lean mass over height squared, normalised to 1.8 metres',
          },
        ],
        why: [
          <>
            The tape method (Hodgdon and Beckett, 1984) is usually within 3 to 4 points of lab
            tests. A reading you enter from a scale or scan replaces it for {MEASURED_FAT_DAYS}{' '}
            days.
          </>,
          <>
            BMI bands are the WHO&apos;s (18.5, 25, 30), with 23 and 27.5 shown for South Asian
            adults. FFMI (Kouri and colleagues, 1995) is BMI for muscle.
          </>,
        ],
        limits: 'BMI cannot tell muscle from fat, so it misreads many lifters.',
      },
    ],
  },
  {
    id: 'app',
    title: 'App rules',
    topics: [
      {
        id: 'which-sets',
        title: 'Which sets count',
        shows:
          'Only sets you marked done. Warm-ups stay in your history but are left out of volume, estimated 1RM, records and muscle sets.',
      },
      {
        id: 'rings',
        title: 'Weekly rings and streak',
        evidence: 'workoutsPerWeek',
        shows:
          'Sessions, working sets and minutes this week against your plan. The streak counts weeks in a row that met the session target.',
      },
      {
        id: 'plan',
        title: 'Your plan',
        shows:
          'The recommended split follows your days a week, your goal sets reps, effort and rest, and long days are trimmed to your session length. Every result is a normal routine you can edit.',
      },
      {
        id: 'recovery',
        title: 'Recovery',
        shows:
          'The app does not guess how recovered a muscle is, because a workout log cannot tell you that. It only shows days since each muscle was last trained.',
      },
      {
        id: 'trial',
        title: 'Trial length',
        evidence: 'trialLength',
        shows: 'The Pro trial is exactly 168 hours, counted on the server.',
      },
    ],
  },
];
