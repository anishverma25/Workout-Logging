import { GOAL_PROTEIN, targetRate } from '../analytics/body';
import { muscleName } from '../analytics/weekly';
import type { Experience, Goal } from '../models/schemas';
import type { WeekFacts } from './facts';
import {
  AREA_MUSCLES,
  EVENT_EFFECTS,
  EVENT_LABEL,
  GENTLER,
  PAIN_LABEL,
  RETURN_WEEKS,
  addDaysKey,
  daysInWeek,
  needsProfessional,
  weekAfter,
  type LifeEvent,
  type PainArea,
  type PainReport,
} from './life';
import {
  CUT_BAND,
  DEFICIT_KCAL,
  DELOAD_GAP_WEEKS,
  DELOAD_SHARE,
  EVENT_MIN_DAYS,
  HOLD_BAND,
  INTAKE_TOLERANCE,
  KCAL_PER_KG,
  KCAL_ROUND,
  LIFT_DOWN,
  LIFT_UP,
  MAX_KCAL_STEP,
  MAX_SET_STEP,
  MAX_SURPLUS_SHARE,
  MAX_VOLUME_CHANGES,
  MIN_FOOD_DAYS,
  MIN_WEIGH_INS,
  PROTEIN_RANGE,
  PROTEIN_ROUND,
  SETS_CEILING,
  SETS_FLOOR,
  SETS_LOW,
  calorieFloor,
  roundTo,
} from './limits';
import { SET_BANDS, findingFor, type Estimate, type ResponseModel, type SetBand } from './response';

/**
 * The Adaptive Engine: once a week it decides the next week from the person's own logs, inside
 * the limits in `limits.ts`. It only proposes. Nothing here writes anything: the person sees
 * each change with its reason and applies it, or keeps their plan.
 *
 * Maths decides: every number below comes from fixed rules. The sentences are written here too,
 * so the AI never has to produce a figure.
 */

export type Text = { en: string; hi: string };

export type Cause =
  | 'pace'
  | 'floor'
  | 'protein'
  | 'progress'
  | 'recovery'
  | 'personal'
  | 'stall'
  | 'deload'
  | 'event'
  | 'pain'
  | 'restore';

interface ChangeBase {
  id: string;
  title: Text;
  reason: Text;
  cause: Cause;
  /** The science topic the Why opens. */
  topic: string;
  /** For a change that goes back by itself: the Monday it ends (yyyy-mm-dd). */
  until: string | null;
}

export type Change = ChangeBase &
  (
    | { kind: 'calories'; from: number; to: number }
    | { kind: 'protein'; from: number; to: number }
    | { kind: 'sets'; muscle: string; from: number; to: number }
    | { kind: 'deload'; share: number }
    | { kind: 'swap'; fromExerciseId: string; toExerciseId: string }
    | { kind: 'session'; minutes: number }
    | { kind: 'restore'; temporaryId: string }
  );

export interface Hold {
  kind: 'calories' | 'protein' | 'volume';
  reason: Text;
}

export interface Decision {
  weekStart: string;
  stage: ResponseModel['stage'];
  maintenance: Estimate | null;
  changes: Change[];
  /** What stays, and why. */
  holds: Hold[];
  /** Pain that must not be trained around. */
  warnings: { area: PainArea; text: Text }[];
  /** Guidance for the week that changes no number. */
  notes: Text[];
}

/** A change applied earlier that goes back by itself when its time is up. */
export interface Temporary {
  id: string;
  cause: 'event' | 'pain' | 'deload';
  /** The Monday it ends. */
  until: string;
  /** Muscles whose sets it holds, and whether it holds the calorie target. */
  muscles: string[];
  calories: boolean;
  label: Text;
}

export interface DecideInput {
  /** Monday of the week being planned. */
  nextWeekStart: string;
  /** Oldest first; the last one is the week that just finished. */
  weeks: WeekFacts[];
  model: ResponseModel;
  person: {
    goal: Goal;
    experience: Experience;
    weightKg: number | null;
    bmrKcal: number | null;
    targetKg: number | null;
    /** The person typed their own protein target: it is theirs to keep. */
    ownProtein: boolean;
  };
  plan: {
    kcal: number | null;
    proteinG: number | null;
    /** Planned weekly sets per muscle from the active routine. */
    muscleSets: Record<string, number>;
    /** Exercises in the active routine. */
    exerciseIds: string[];
    /** The longest planned session in minutes, when it can be worked out. */
    sessionMinutes: number | null;
  };
  events: LifeEvent[];
  /** Reports not yet acted on. */
  pains: PainReport[];
  stalls: { exerciseId: string; cause: string; variationId?: string }[];
  temporaries: Temporary[];
  /** Monday of the last deload week, if there was one. */
  lastDeload: string | null;
  exercise: {
    name: (id: string) => string;
    keyOf: (id: string) => string | null;
    idOf: (key: string) => string | null;
  };
}

const kcalText = (n: number) => n.toLocaleString('en-IN');
const pct = (share: number) => `${Math.abs(share * 100).toFixed(1)}%`;
const weeksBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / (7 * 86_400_000));

// ---------------------------------------------------------------------------------------------
// Calories
// ---------------------------------------------------------------------------------------------

type Direction = 'lose' | 'gain' | 'hold';

function paceBand(person: DecideInput['person']): { dir: Direction; lo: number; hi: number } {
  const { goal, experience, weightKg, targetKg } = person;
  let dir: Direction;
  if (targetKg !== null && weightKg !== null) {
    const diff = targetKg - weightKg;
    dir = Math.abs(diff) < 0.5 ? 'hold' : diff < 0 ? 'lose' : 'gain';
  } else {
    dir =
      goal === 'fat_loss'
        ? 'lose'
        : goal === 'hypertrophy' || goal === 'strength_hypertrophy'
          ? 'gain'
          : 'hold';
  }
  if (dir === 'lose') return { dir, lo: -CUT_BAND[1], hi: -CUT_BAND[0] };
  if (dir === 'gain') {
    const gainGoal =
      goal === 'hypertrophy' || goal === 'strength_hypertrophy' ? goal : 'hypertrophy';
    const [lo, hi] = targetRate(gainGoal, experience);
    return { dir, lo, hi };
  }
  if (goal === 'recomposition' && targetKg === null) return { dir, lo: -0.005, hi: 0 };
  return { dir, lo: -HOLD_BAND, hi: HOLD_BAND };
}

const weighed = (w: WeekFacts | undefined): w is WeekFacts & { meanWeightKg: number } =>
  !!w && w.weighIns >= MIN_WEIGH_INS && w.meanWeightKg !== null;

/** Weight change a week over the last two or three weighed weeks, kg. */
function observedRate(weeks: WeekFacts[]): number | null {
  const [a, b, c] = [weeks.at(-1), weeks.at(-2), weeks.at(-3)];
  if (!weighed(a) || !weighed(b)) return null;
  if (weighed(c)) return (a.meanWeightKg - c.meanWeightKg) / 2;
  return a.meanWeightKg - b.meanWeightKg;
}

function activeEvent(input: DecideInput): LifeEvent | null {
  return (
    input.events
      .filter((e) => daysInWeek(e, input.nextWeekStart) >= EVENT_MIN_DAYS)
      .sort((x, y) => x.start.localeCompare(y.start))[0] ?? null
  );
}

function decideCalories(
  input: DecideInput,
  event: LifeEvent | null,
): { change: Change | null; hold: Hold | null } {
  const { plan, person, weeks, model } = input;
  const last = weeks.at(-1);
  const kcal = plan.kcal;
  const none = { change: null, hold: null };
  if (kcal === null || person.weightKg === null) return none;
  const frozen = input.temporaries.find((t) => t.calories && t.until > input.nextWeekStart);
  if (frozen)
    return {
      change: null,
      hold: {
        kind: 'calories',
        reason: {
          en: `Calories stay at ${kcalText(kcal)} for now: ${frozen.label.en.toLowerCase()}.`,
          hi: `Calories abhi ${kcalText(kcal)} par rahengi: ${frozen.label.hi.toLowerCase()}.`,
        },
      },
    };
  const floor = calorieFloor(person.bmrKcal);
  const maintenance = model.maintenance ? roundTo(model.maintenance.value, KCAL_ROUND) : null;

  // A target under the safe floor is raised to it, whatever else is going on.
  if (kcal < floor)
    return {
      change: {
        id: 'calories',
        kind: 'calories',
        from: kcal,
        to: floor,
        cause: 'floor',
        topic: 'adaptive-plan',
        until: null,
        title: {
          en: `Calories ${kcalText(kcal)} to ${kcalText(floor)}`,
          hi: `Calories ${kcalText(kcal)} se ${kcalText(floor)}`,
        },
        reason: {
          en: `${kcalText(kcal)} kcal is under the lowest target the plan allows for you (${kcalText(floor)}).`,
          hi: `${kcalText(kcal)} kcal aapke liye sabse kam safe target (${kcalText(floor)}) se neeche hai.`,
        },
      },
      hold: null,
    };

  if (event && EVENT_EFFECTS[event.kind].maintenance) {
    const label = EVENT_LABEL[event.kind];
    if (maintenance !== null && kcal <= maintenance - KCAL_ROUND)
      return {
        change: {
          id: 'calories',
          kind: 'calories',
          from: kcal,
          to: maintenance,
          cause: 'event',
          topic: 'adaptive-plan',
          until: weekAfter(event, input.nextWeekStart),
          title: {
            en: `Calories ${kcalText(kcal)} to ${kcalText(maintenance)}`,
            hi: `Calories ${kcalText(kcal)} se ${kcalText(maintenance)}`,
          },
          reason: {
            en: `${label.en} this week: eat at maintenance, no deficit. The target goes back afterwards.`,
            hi: `Is hafte ${label.hi}: maintenance par khaiye, deficit nahi. Baad mein target wapas aa jayega.`,
          },
        },
        hold: null,
      };
    return {
      change: null,
      hold: {
        kind: 'calories',
        reason: {
          en: `Calories stay at ${kcalText(kcal)} through ${label.en.toLowerCase()}.`,
          hi: `${label.hi} ke dauran calories ${kcalText(kcal)} par rahengi.`,
        },
      },
    };
  }

  if (!last || last.foodDays < MIN_FOOD_DAYS || last.weighIns < MIN_WEIGH_INS)
    return {
      change: null,
      hold: {
        kind: 'calories',
        reason: {
          en: `Calories stay at ${kcalText(kcal)}. A change needs ${MIN_FOOD_DAYS} logged food days and ${MIN_WEIGH_INS} weigh-ins in the week; this week had ${last?.foodDays ?? 0} and ${last?.weighIns ?? 0}.`,
          hi: `Calories ${kcalText(kcal)} par rahengi. Badlav ke liye hafte mein ${MIN_FOOD_DAYS} food days aur ${MIN_WEIGH_INS} weigh-ins chahiye; is hafte ${last?.foodDays ?? 0} aur ${last?.weighIns ?? 0} the.`,
        },
      },
    };
  const rate = observedRate(weeks);
  if (rate === null)
    return {
      change: null,
      hold: {
        kind: 'calories',
        reason: {
          en: `Calories stay at ${kcalText(kcal)}. The pace needs ${MIN_WEIGH_INS} weigh-ins in each of the last two weeks.`,
          hi: `Calories ${kcalText(kcal)} par rahengi. Pace ke liye pichhle do hafton mein ${MIN_WEIGH_INS}-${MIN_WEIGH_INS} weigh-ins chahiye.`,
        },
      },
    };
  const eaten = Math.round(last.meanKcal!);
  if (Math.abs(eaten / kcal - 1) > INTAKE_TOLERANCE)
    return {
      change: null,
      hold: {
        kind: 'calories',
        reason: {
          en: `Calories stay at ${kcalText(kcal)}. You ate about ${kcalText(roundTo(eaten, 10))} a day, so the target has not been tested yet.`,
          hi: `Calories ${kcalText(kcal)} par rahengi. Aapne roz lagbhag ${kcalText(roundTo(eaten, 10))} khaya, to target abhi test nahi hua.`,
        },
      },
    };

  const band = paceBand(person);
  const share = rate / person.weightKg;
  if (share >= band.lo && share <= band.hi)
    return {
      change: null,
      hold: {
        kind: 'calories',
        reason: {
          en: `Calories stay at ${kcalText(kcal)}: your weight is moving at the planned pace.`,
          hi: `Calories ${kcalText(kcal)} par rahengi: weight planned pace par chal raha hai.`,
        },
      },
    };

  const aim = (band.lo + band.hi) / 2;
  const needed = ((aim - share) * person.weightKg * KCAL_PER_KG) / 7;
  let step = Math.max(-MAX_KCAL_STEP, Math.min(MAX_KCAL_STEP, roundTo(needed, KCAL_ROUND)));
  if (step === 0) step = needed > 0 ? KCAL_ROUND : -KCAL_ROUND;
  let to = kcal + step;
  if (step < 0) to = Math.max(to, floor);
  if (maintenance !== null) {
    // A cut never goes above maintenance, and a gain never far above it.
    if (band.dir === 'lose' && step > 0) to = Math.min(to, Math.max(kcal, maintenance));
    if (band.dir === 'gain' && step > 0)
      to = Math.min(to, Math.max(kcal, roundTo(maintenance * (1 + MAX_SURPLUS_SHARE), KCAL_ROUND)));
  }
  if (to === kcal) {
    const atFloor = step < 0;
    return {
      change: null,
      hold: {
        kind: 'calories',
        reason: atFloor
          ? {
              en: `Calories stay at ${kcalText(kcal)}: that is the lowest target the plan allows for you.`,
              hi: `Calories ${kcalText(kcal)} par rahengi: yeh aapke liye sabse kam safe target hai.`,
            }
          : {
              en: `Calories stay at ${kcalText(kcal)}.`,
              hi: `Calories ${kcalText(kcal)} par rahengi.`,
            },
      },
    };
  }
  const moving =
    Math.abs(share) < 0.0005
      ? { en: 'held steady', hi: 'steady raha' }
      : share < 0
        ? { en: `fell ${pct(share)} a week`, hi: `har hafte ${pct(share)} gira` }
        : { en: `rose ${pct(share)} a week`, hi: `har hafte ${pct(share)} badha` };
  const wanted =
    band.dir === 'lose'
      ? {
          en: `the plan aims for ${pct(band.hi)} to ${pct(band.lo)} down`,
          hi: `plan ${pct(band.hi)} se ${pct(band.lo)} neeche ka hai`,
        }
      : band.dir === 'gain'
        ? {
            en: `the plan aims for ${pct(band.lo)} to ${pct(band.hi)} up`,
            hi: `plan ${pct(band.lo)} se ${pct(band.hi)} upar ka hai`,
          }
        : { en: 'the plan is to hold it', hi: 'plan weight hold karne ka hai' };
  return {
    change: {
      id: 'calories',
      kind: 'calories',
      from: kcal,
      to,
      cause: 'pace',
      topic: 'adaptive-plan',
      until: null,
      title: {
        en: `Calories ${kcalText(kcal)} to ${kcalText(to)}`,
        hi: `Calories ${kcalText(kcal)} se ${kcalText(to)}`,
      },
      reason: {
        en: `Your weight ${moving.en}; ${wanted.en}.`,
        hi: `Aapka weight ${moving.hi}; ${wanted.hi}.`,
      },
    },
    hold: null,
  };
}

// ---------------------------------------------------------------------------------------------
// Protein
// ---------------------------------------------------------------------------------------------

export function proteinRange(goal: Goal, weightKg: number): [number, number] {
  const [gLo, gHi] = GOAL_PROTEIN[goal];
  const lo = Math.min(PROTEIN_RANGE[0], gLo);
  const hi = Math.max(PROTEIN_RANGE[1], gHi);
  return [
    Math.ceil((lo * weightKg) / PROTEIN_ROUND) * PROTEIN_ROUND,
    Math.floor((hi * weightKg) / PROTEIN_ROUND) * PROTEIN_ROUND,
  ];
}

function decideProtein(input: DecideInput): Change | null {
  const { person, plan } = input;
  if (person.ownProtein || person.weightKg === null || plan.proteinG === null) return null;
  const [lo, hi] = proteinRange(person.goal, person.weightKg);
  const to = plan.proteinG < lo ? lo : plan.proteinG > hi ? hi : plan.proteinG;
  if (to === plan.proteinG) return null;
  const low = to > plan.proteinG;
  return {
    id: 'protein',
    kind: 'protein',
    from: plan.proteinG,
    to,
    cause: 'protein',
    topic: 'adaptive-plan',
    until: null,
    title: {
      en: `Protein ${plan.proteinG} g to ${to} g`,
      hi: `Protein ${plan.proteinG} g se ${to} g`,
    },
    reason: low
      ? {
          en: `At ${person.weightKg.toFixed(1)} kg, ${plan.proteinG} g is under the range that supports muscle (${lo} to ${hi} g).`,
          hi: `${person.weightKg.toFixed(1)} kg par ${plan.proteinG} g muscle ke liye sahi range (${lo} se ${hi} g) se kam hai.`,
        }
      : {
          en: `At ${person.weightKg.toFixed(1)} kg, more than ${hi} g adds nothing for muscle; the room goes back to carbs and fat.`,
          hi: `${person.weightKg.toFixed(1)} kg par ${hi} g se zyada protein muscle ke liye kuch nahi jodta.`,
        },
  };
}

// ---------------------------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------------------------

export type LiftStatus = 'up' | 'flat' | 'down';

/** How each lift moved: the best of the last two weeks against the best of the two before. */
export function liftStatuses(
  weeks: WeekFacts[],
): Record<string, { muscle: string; change: number; status: LiftStatus; sessions: number }> {
  const recent = weeks.slice(-2);
  const before = weeks.slice(-4, -2);
  const out: Record<
    string,
    { muscle: string; change: number; status: LiftStatus; sessions: number }
  > = {};
  const best = (list: WeekFacts[], id: string) =>
    Math.max(0, ...list.map((w) => w.lifts[id]?.e1rm ?? 0));
  for (const id of new Set(recent.flatMap((w) => Object.keys(w.lifts)))) {
    const now = best(recent, id);
    const then = best(before, id);
    if (!now || !then) continue;
    const change = now / then - 1;
    const sessions = recent.reduce((n, w) => n + (w.lifts[id]?.sessions ?? 0), 0);
    const muscle = recent.find((w) => w.lifts[id])!.lifts[id]!.muscle;
    out[id] = {
      muscle,
      change,
      sessions,
      status: change >= LIFT_UP ? 'up' : change <= LIFT_DOWN && sessions >= 2 ? 'down' : 'flat',
    };
  }
  return out;
}

function muscleStatus(lifts: ReturnType<typeof liftStatuses>, muscle: string): LiftStatus | null {
  const mine = Object.values(lifts).filter((l) => l.muscle === muscle);
  if (mine.length === 0) return null;
  const mean = mine.reduce((n, l) => n + l.change, 0) / mine.length;
  if (mean >= LIFT_UP) return 'up';
  if (mean <= LIFT_DOWN && mine.some((l) => l.status === 'down')) return 'down';
  return 'flat';
}

function inDeficit(weeks: WeekFacts[], maintenance: Estimate | null): boolean {
  if (!maintenance) return false;
  const recent = weeks.slice(-2).filter((w) => w.foodDays >= MIN_FOOD_DAYS && w.meanKcal !== null);
  return recent.length > 0 && recent.every((w) => w.meanKcal! <= maintenance.value - DEFICIT_KCAL);
}

const totalSets = (w: WeekFacts) => Object.values(w.muscles).reduce((a, b) => a + b, 0);

function setsChange(
  muscle: string,
  from: number,
  to: number,
  cause: Cause,
  reason: Text,
  until: string | null = null,
): Change {
  const name = muscleName(muscle);
  const delta = to - from;
  const word = delta > 0 ? `plus ${delta}` : `minus ${-delta}`;
  return {
    id: `sets:${muscle}`,
    kind: 'sets',
    muscle,
    from,
    to,
    cause,
    topic: 'adaptive-plan',
    until,
    title: {
      en: `${name} ${word} ${Math.abs(delta) === 1 ? 'set' : 'sets'} a week`,
      hi: `${name} ${delta > 0 ? '+' : '-'}${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'set' : 'sets'} har hafte`,
    },
    reason,
  };
}

export function decideWeek(input: DecideInput): Decision {
  const { weeks, model, plan } = input;
  const last = weeks.at(-1);
  const changes: Change[] = [];
  const holds: Hold[] = [];
  const warnings: Decision['warnings'] = [];
  const notes: Text[] = [];
  const lockedMuscles = new Set<string>();
  const event = activeEvent(input);
  const effect = event ? EVENT_EFFECTS[event.kind] : null;

  // 1. Anything temporary whose time is up goes back.
  let deloadEnding = false;
  for (const t of input.temporaries) {
    if (t.until <= input.nextWeekStart) {
      changes.push({
        id: `restore:${t.id}`,
        kind: 'restore',
        temporaryId: t.id,
        cause: 'restore',
        topic: 'adaptive-plan',
        until: null,
        title: { en: `Back to normal: ${t.label.en}`, hi: `Wapas normal: ${t.label.hi}` },
        reason: {
          en: 'The time for this change is up, so your plan goes back to what it was.',
          hi: 'Is badlav ka samay poora hua, plan pehle jaisa ho jayega.',
        },
      });
      if (t.cause === 'deload') deloadEnding = true;
      // Sets that are just going back are not moved again in the same week.
      for (const m of t.muscles) lockedMuscles.add(m);
    } else {
      for (const m of t.muscles) lockedMuscles.add(m);
    }
  }
  const deloadRunning = input.temporaries.some(
    (t) => t.cause === 'deload' && t.until > input.nextWeekStart,
  );

  // 2. Something hurts.
  const routine = new Set(plan.exerciseIds);
  for (const pain of input.pains) {
    const label = PAIN_LABEL[pain.area];
    if (needsProfessional(pain)) {
      warnings.push({
        area: pain.area,
        text: {
          en: `${label.en}: this needs a doctor or physiotherapist before you train it again. The plan is not changed around it. Skip anything that brings the pain on.`,
          hi: `${label.hi}: ise dobara train karne se pehle doctor ya physio ko dikhaiye. Plan iske hisaab se badla nahi gaya. Jo dard badhaye woh skip kijiye.`,
        },
      });
      continue;
    }
    const back = RETURN_WEEKS[pain.severity === 'moderate' ? 'moderate' : 'mild'];
    const until = addDaysKey(input.nextWeekStart, back * 7);
    const weeksText = `${back} weeks`;
    for (const id of plan.exerciseIds) {
      const key = input.exercise.keyOf(id);
      const gentler = key ? GENTLER[pain.area][key] : undefined;
      const toId = gentler ? input.exercise.idOf(gentler) : null;
      if (!toId || routine.has(toId)) continue;
      routine.add(toId);
      changes.push({
        id: `swap:${id}`,
        kind: 'swap',
        fromExerciseId: id,
        toExerciseId: toId,
        cause: 'pain',
        topic: 'adaptive-plan',
        until,
        title: {
          en: `${input.exercise.name(id)} to ${input.exercise.name(toId)}`,
          hi: `${input.exercise.name(id)} ki jagah ${input.exercise.name(toId)}`,
        },
        reason: {
          en: `Your ${label.en.toLowerCase()} hurt. This usually loads it less. It goes back after ${weeksText}.`,
          hi: `${label.hi} mein dard tha. Yeh usually us par kam load daalta hai. ${back} hafte baad wapas.`,
        },
      });
    }
    for (const muscle of AREA_MUSCLES[pain.area]) {
      const from = Math.round(plan.muscleSets[muscle] ?? 0);
      if (lockedMuscles.has(muscle)) continue;
      lockedMuscles.add(muscle);
      if (from - MAX_SET_STEP < SETS_FLOOR) continue;
      changes.push(
        setsChange(
          muscle,
          from,
          from - MAX_SET_STEP,
          'pain',
          {
            en: `Less work around your ${label.en.toLowerCase()} for ${weeksText}, then back up.`,
            hi: `${label.hi} ke aas-paas ${back} hafte kam kaam, phir wapas.`,
          },
          until,
        ),
      );
    }
    notes.push({
      en: 'This is training guidance, not medical advice. If the pain is sharp, lasts, or comes with swelling or numbness, stop and see a professional.',
      hi: 'Yeh training guidance hai, medical advice nahi. Dard tez ho, bana rahe, ya sujan ya sunn-pan ho to rukiye aur professional ko dikhaiye.',
    });
  }

  // 3. What is coming up.
  if (event && effect) {
    const label = EVENT_LABEL[event.kind];
    if (effect.sessionMinutes !== null && (plan.sessionMinutes ?? 0) > effect.sessionMinutes)
      changes.push({
        id: 'session',
        kind: 'session',
        minutes: effect.sessionMinutes,
        cause: 'event',
        topic: 'adaptive-plan',
        until: weekAfter(event, input.nextWeekStart),
        title: {
          en: `Sessions of about ${effect.sessionMinutes} minutes`,
          hi: `Lagbhag ${effect.sessionMinutes} minute ke sessions`,
        },
        reason: {
          en: `${label.en} this week: the main lifts stay, the extras are trimmed. It goes back afterwards.`,
          hi: `Is hafte ${label.hi}: main lifts rahenge, extra kam honge. Baad mein wapas.`,
        },
      });
    if (event.kind === 'ramadan')
      notes.push({
        en: 'Train after iftar, once you have eaten and had water. Keep a couple of reps in reserve on every set.',
        hi: 'Iftar ke baad, khana aur paani lene ke baad train kijiye. Har set mein do reps bacha kar rakhiye.',
      });
    if (event.kind === 'vrat')
      notes.push({
        en: 'On fast days keep training easy or rest. Sabudana, makhana, curd, milk, paneer, fruit and peanuts fit most vrats.',
        hi: 'Vrat ke din training halki rakhiye ya rest kijiye. Sabudana, makhana, dahi, doodh, paneer, phal aur moongphali zyadatar vrat mein chalte hain.',
      });
    if (event.kind === 'sick')
      notes.push({
        en: 'Rest until you feel well. Missed sessions this week are not counted against you.',
        hi: 'Theek hone tak rest kijiye. Is hafte ke missed sessions ginne nahi jayenge.',
      });
  } else {
    for (const e of input.events) {
      if (daysInWeek(e, input.nextWeekStart) > 0)
        notes.push({
          en: `${EVENT_LABEL[e.kind].en} is in this week. The plan stays; do what you can.`,
          hi: `Is hafte ${EVENT_LABEL[e.kind].hi} hai. Plan wahi rahega; jitna ho sake kijiye.`,
        });
    }
  }

  // 4. Food.
  const calories = decideCalories(input, event);
  if (calories.change) changes.push(calories.change);
  if (calories.hold) holds.push(calories.hold);
  const protein = decideProtein(input);
  if (protein) changes.push(protein);

  // 5. Training. Nothing is added in a deload, right after one, or while life is in the way.
  const lifts = liftStatuses(weeks);
  const deficit = inDeficit(weeks, model.maintenance);
  const quiet = !!effect || deloadRunning || deloadEnding;
  const down = Object.values(lifts).filter((l) => l.status === 'down');
  const priorSets = weeks
    .slice(-5, -1)
    .map(totalSets)
    .filter((n) => n > 0);
  const usualSets = priorSets.length
    ? priorSets.reduce((a, b) => a + b, 0) / priorSets.length
    : null;
  const grinding = last?.medianRir !== null && last?.medianRir !== undefined && last.medianRir <= 1;
  const overreached = !!last && usualSets !== null && totalSets(last) >= usualSets * 1.2;
  const sinceDeload = input.lastDeload ? weeksBetween(input.lastDeload, input.nextWeekStart) : null;
  const deload =
    !quiet &&
    !input.pains.some(needsProfessional) &&
    down.length >= 2 &&
    (deficit || grinding || overreached) &&
    (sinceDeload === null || sinceDeload >= DELOAD_GAP_WEEKS);

  if (deload) {
    const why = deficit
      ? {
          en: 'while you are eating under maintenance',
          hi: 'jab aap maintenance se kam kha rahe hain',
        }
      : grinding
        ? {
            en: 'with almost nothing left in reserve on your sets',
            hi: 'aur sets mein reserve lagbhag khatam hai',
          }
        : { en: 'after a heavier stretch than usual', hi: 'usual se bhaari hafton ke baad' };
    changes.push({
      id: 'deload',
      kind: 'deload',
      share: DELOAD_SHARE,
      cause: 'deload',
      topic: 'adaptive-plan',
      until: addDaysKey(input.nextWeekStart, 7),
      title: { en: 'A lighter week', hi: 'Ek halka hafta' },
      reason: {
        en: `${down.length} lifts dropped across two sessions ${why.en}. One week at about ${Math.round(DELOAD_SHARE * 100)}% of your sets, same weights, then back.`,
        hi: `${down.length} lifts do sessions mein giri ${why.hi}. Ek hafta lagbhag ${Math.round(DELOAD_SHARE * 100)}% sets, wahi weights, phir wapas.`,
      },
    });
  } else if (!quiet) {
    const candidates: { score: number; change: Change }[] = [];
    for (const [muscle, plannedRaw] of Object.entries(plan.muscleSets)) {
      const planned = Math.round(plannedRaw);
      if (planned <= 0 || lockedMuscles.has(muscle)) continue;
      const status = muscleStatus(lifts, muscle);
      if (status === null) continue;
      const done = last?.muscles[muscle] ?? 0;
      const personal = findingFor(model, 'sets', muscle);
      const band = personal?.confidence === 'personal' ? (personal.best as SetBand) : null;
      const name = muscleName(muscle);
      if (
        status === 'down' &&
        (deficit || planned >= SET_BANDS.high[0]) &&
        planned - MAX_SET_STEP >= SETS_FLOOR
      ) {
        candidates.push({
          score: 3,
          change: setsChange(muscle, planned, planned - MAX_SET_STEP, 'recovery', {
            en: deficit
              ? `${name} lifts dropped while you are eating under maintenance. A little less work lets them recover.`
              : `${name} lifts dropped at ${planned} sets a week. A little less work lets them recover.`,
            hi: deficit
              ? `${name} ki lifts giri jab aap maintenance se kam kha rahe hain. Thoda kam kaam recovery dega.`
              : `${name} ki lifts ${planned} sets par giri. Thoda kam kaam recovery dega.`,
          }),
        });
        continue;
      }
      if (status !== 'flat') continue;
      if (band && planned >= SET_BANDS[band][1] && planned - MAX_SET_STEP >= SETS_FLOOR) {
        candidates.push({
          score: 2,
          change: setsChange(muscle, planned, planned - MAX_SET_STEP, 'personal', {
            en: `Your own logs show your ${name.toLowerCase()} lifts move best at fewer weekly sets than this.`,
            hi: `Aapke apne logs dikhate hain ki ${name} ki lifts isse kam weekly sets par behtar chalti hain.`,
          }),
        });
        continue;
      }
      // More work only when the planned work is being done and there is room for it.
      if (done < planned * 0.8) continue;
      const ceiling = band
        ? Math.min(
            SETS_CEILING,
            SET_BANDS[band][1] === Infinity ? SETS_CEILING : SET_BANDS[band][1],
          )
        : SETS_CEILING;
      if (planned + MAX_SET_STEP > ceiling || deficit) continue;
      candidates.push({
        score: planned < SETS_LOW ? 2 : 1,
        change: setsChange(muscle, planned, planned + MAX_SET_STEP, 'progress', {
          en:
            planned < SETS_LOW
              ? `${name} lifts have not moved in 4 weeks at ${planned} sets a week, under the range most people grow on.`
              : `${name} lifts have not moved in 4 weeks, and you are doing the planned work.`,
          hi:
            planned < SETS_LOW
              ? `${name} ki lifts 4 hafton se ${planned} sets par ruki hain, jo zyadatar logon ki growth range se kam hai.`
              : `${name} ki lifts 4 hafton se ruki hain, aur aap planned kaam poora kar rahe hain.`,
        }),
      });
    }
    candidates
      .sort((a, b) => b.score - a.score || a.change.id.localeCompare(b.change.id))
      .slice(0, MAX_VOLUME_CHANGES)
      .forEach((c) => changes.push(c.change));

    // A lift that stalled for want of a new stimulus rotates to its close variation.
    let swaps = 0;
    for (const stall of input.stalls) {
      if (swaps >= 2) break;
      if (stall.cause !== 'variation' || !stall.variationId) continue;
      if (!plan.exerciseIds.includes(stall.exerciseId) || routine.has(stall.variationId)) continue;
      if (changes.some((c) => c.kind === 'swap' && c.fromExerciseId === stall.exerciseId)) continue;
      routine.add(stall.variationId);
      swaps += 1;
      changes.push({
        id: `swap:${stall.exerciseId}`,
        kind: 'swap',
        fromExerciseId: stall.exerciseId,
        toExerciseId: stall.variationId,
        cause: 'stall',
        topic: 'stalls',
        until: null,
        title: {
          en: `${input.exercise.name(stall.exerciseId)} to ${input.exercise.name(stall.variationId)}`,
          hi: `${input.exercise.name(stall.exerciseId)} ki jagah ${input.exercise.name(stall.variationId)}`,
        },
        reason: {
          en: 'This lift has stalled with frequency, effort and sets all in place. A close variation gives it a new stimulus.',
          hi: 'Yeh lift ruki hai jabki frequency, effort aur sets theek hain. Ek close variation naya stimulus degi.',
        },
      });
    }
  } else if (effect?.easy) {
    holds.push({
      kind: 'volume',
      reason: {
        en: 'Training stays as it is this week, with nothing added.',
        hi: 'Is hafte training wahi rahegi, kuch joda nahi jayega.',
      },
    });
  }

  if (model.stage.learning)
    notes.push({
      en: `Learning your patterns, week ${Math.max(1, model.stage.week)} of ${model.stage.of}. Until then the plan uses research defaults.`,
      hi: `Aapke patterns seekh raha hai, hafta ${Math.max(1, model.stage.week)} of ${model.stage.of}. Tab tak plan research defaults par chalega.`,
    });

  return {
    weekStart: input.nextWeekStart,
    stage: model.stage,
    maintenance: model.maintenance,
    changes,
    holds,
    warnings,
    notes,
  };
}
