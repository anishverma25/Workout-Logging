/**
 * Voice sets: what someone said in the gym, turned into a set. Strict on purpose: English and
 * Hinglish numbers and units are read by fixed rules, and when a sentence could mean two things
 * the set is filled in but left for a tap instead of being guessed.
 *
 *   "bench 80 kilo 8 reps"   "80 ke 8"   "assi kilo aath"   "sadhe sattar into 6"   "same again"
 */

export interface SpokenSet {
  kind: 'set';
  /** In the unit said, or the logger's unit when none was said. */
  weight: number | null;
  unit: 'kg' | 'lb' | null;
  reps: number | null;
  /** Words said before the numbers, to find the exercise ("bench"). */
  exercise: string | null;
  /** Both numbers were said in a form that can only mean one thing. */
  sure: boolean;
}
export type Spoken = SpokenSet | { kind: 'same' };

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  // How a phone often writes a spoken number.
  ate: 8, won: 1,
  // Hindi, as people say it in the gym.
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5, che: 6, chhe: 6, chhah: 6,
  saat: 7, sat: 7, aath: 8, aat: 8, nau: 9, das: 10, dus: 10, gyarah: 11, gyara: 11, barah: 12,
  bara: 12, terah: 13, chaudah: 14, pandrah: 15, solah: 16, satrah: 17, atharah: 18, unnis: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  bees: 20, bis: 20, tees: 30, tis: 30, chalis: 40, chaalis: 40, pachas: 50, pachaas: 50,
  saath: 60, sattar: 70, assi: 80, nabbe: 90,
};
/** Hindi numbers that are a single word: 25, 35, 45 ... and the hundreds people load. */
const WHOLE: Record<string, number> = {
  pachees: 25, pachis: 25, paintees: 35, paintis: 35, paintalis: 45, pachpan: 55, painsath: 65,
  pachattar: 75, pachasi: 85, pachanve: 95, sau: 100, hundred: 100,
};
const UNIT: Record<string, 'kg' | 'lb'> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', killo: 'kg', kilogram: 'kg', kilograms: 'kg', kilogramme: 'kg', k: 'kg', kay: 'kg',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
};
const REP_WORDS = new Set(['rep', 'reps', 'raps', 'rap', 'wraps', 'repetition', 'repetitions', 'baar', 'bar', 'times']);
/** Words that sit between a weight and its reps: "80 ke 8", "80 into 8", "80 for 8". */
const JOINERS = new Set(['ke', 'k', 'ka', 'ki', 'kay', 'key', 'into', 'x', 'by', 'for', 'pe', 'par', 'se', 'cross', 'times']);
const SAME = [/^same( again| set| as (before|last))?$/, /^(wahi|vahi|wohi)( wala| set)?$/, /^phir se$/, /^(again|repeat)$/, /^ek (aur|baar aur)$/];
const FILLER = new Set(['and', 'aur', 'a', 'the', 'of', 'with', 'at', 'set', 'did', 'done', 'kiya', 'kiye', 'ho', 'gaya', 'hua']);

const clean = (text: string) =>
  text
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/(\d)\s*(kgs?|kilos?|lbs?)\b/g, '$1 $2')
    .replace(/(\d)\s*[x×*]\s*(\d)/g, '$1 x $2')
    // Hindi digits, when the phone writes them.
    .replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Reads one number starting at `i`: digits, number words, and Hindi halves and quarters. */
function readNumber(words: string[], i: number): { value: number; next: number } | null {
  let k = i;
  // "sadhe sattar" is 70.5, "sawa" adds a quarter, "paune" takes one away; "dhai" is 2.5.
  let shift = 0;
  const lead = words[k];
  if (lead === 'dhai' || lead === 'adhai') return { value: 2.5, next: k + 1 };
  if (lead === 'dedh') return { value: 1.5, next: k + 1 };
  if (lead === 'sadhe' || lead === 'saadhe' || lead === 'sade') shift = 0.5;
  else if (lead === 'sawa' || lead === 'sava') shift = 0.25;
  else if (lead === 'paune' || lead === 'pone') shift = -0.25;
  if (shift) k += 1;

  let value: number | null = null;
  const w = words[k];
  if (w === undefined) return null;
  if (/^\d+(\.\d+)?$/.test(w)) {
    value = Number(w);
    k += 1;
  } else if (w in WHOLE) {
    value = WHOLE[w]!;
    k += 1;
    // "sau bees" is 120, "hundred and ten" is 110.
    if (value === 100) {
      if (words[k] === 'and') k += 1;
      const rest = readNumber(words, k);
      if (rest && rest.value < 100 && Number.isInteger(rest.value)) {
        value += rest.value;
        k = rest.next;
      } else if (words[k - 1] === 'and') k -= 1;
    }
  } else if (w in TENS) {
    value = TENS[w]!;
    k += 1;
    const one = words[k];
    if (one !== undefined && one in ONES && ONES[one]! < 10 && ONES[one]! > 0) {
      value += ONES[one]!;
      k += 1;
    }
  } else if (w in ONES) {
    value = ONES[w]!;
    k += 1;
    // "one hundred", "do sau".
    if ((words[k] === 'hundred' || words[k] === 'sau') && value > 0 && value < 10) {
      value *= 100;
      k += 1;
      if (words[k] === 'and') k += 1;
      const rest = readNumber(words, k);
      if (rest && rest.value < 100 && Number.isInteger(rest.value)) {
        value += rest.value;
        k = rest.next;
      }
    }
  }
  if (value === null) return null;
  // "eighty point five", "80 and a half".
  if (words[k] === 'point' && words[k + 1] !== undefined) {
    const d = /^\d$/.test(words[k + 1]!) ? Number(words[k + 1]) : ONES[words[k + 1]!];
    if (d !== undefined && d >= 0 && d < 10) {
      value += d / 10;
      k += 2;
    }
  } else if (words[k] === 'and' && words[k + 1] === 'a' && words[k + 2] === 'half') {
    value += 0.5;
    k += 3;
  }
  return { value: value + shift, next: k };
}

export const VOICE_MAX_WEIGHT = 600;
export const VOICE_MAX_REPS = 100;

/** What was said, or null when it is not a set. */
export function parseSpokenSet(text: string): Spoken | null {
  const said = clean(text);
  if (!said) return null;
  if (SAME.some((r) => r.test(said))) return { kind: 'same' };
  const words = said.split(' ');
  const numbers: { value: number; at: number; next: number }[] = [];
  for (let i = 0; i < words.length; ) {
    const n = readNumber(words, i);
    if (n) {
      numbers.push({ value: n.value, at: i, next: n.next });
      i = n.next;
    } else i += 1;
  }
  if (numbers.length === 0 || numbers.length > 2) return null;

  const first = numbers[0]!;
  const exercise =
    words
      .slice(0, first.at)
      .filter((w) => !FILLER.has(w))
      .join(' ')
      .trim() || null;
  const after = (n: { next: number }) => words[n.next];
  let weight: number | null = null;
  let unit: SpokenSet['unit'] = null;
  let reps: number | null = null;
  let sure = false;

  if (numbers.length === 2) {
    const second = numbers[1]!;
    const between = words.slice(first.next, second.at);
    const unitWord = between.find((w) => w in UNIT);
    const joined = between.some((w) => JOINERS.has(w));
    const repsAfterSecond = REP_WORDS.has(after(second) ?? '');
    const repsAfterFirst = between.some((w) => REP_WORDS.has(w));
    const unitAfterSecond = UNIT[after(second) ?? ''];
    if (repsAfterFirst || (unitAfterSecond && !unitWord)) {
      // "8 reps 80 kilo": reps first.
      reps = first.value;
      weight = second.value;
      unit = unitAfterSecond ?? null;
      sure = repsAfterFirst && !!unitAfterSecond;
    } else {
      weight = first.value;
      reps = second.value;
      unit = unitWord ? UNIT[unitWord]! : null;
      // A unit, a joiner or "reps" pins down which number is which.
      sure = !!unitWord || joined || repsAfterSecond;
    }
  } else {
    const word = after(first) ?? '';
    if (word in UNIT) {
      weight = first.value;
      unit = UNIT[word]!;
    } else if (REP_WORDS.has(word)) reps = first.value;
    else return null;
  }

  if (reps !== null && (!Number.isInteger(reps) || reps < 1 || reps > VOICE_MAX_REPS)) return null;
  if (weight !== null && (weight < 0 || weight > VOICE_MAX_WEIGHT)) return null;
  // Weights come in quarter steps; anything else was misheard.
  if (weight !== null && Math.abs(weight * 4 - Math.round(weight * 4)) > 1e-9) sure = false;
  if (weight === null || reps === null) sure = false;
  return { kind: 'set', weight, unit, reps, exercise, sure };
}

/** The exercise of the workout that the words point at, when exactly one fits. */
export function matchSpokenExercise<T extends { name: string }>(spoken: string, exercises: T[]): T | null {
  const want = clean(spoken).split(' ').filter(Boolean);
  if (want.length === 0) return null;
  const hits = exercises.filter((e) => {
    const name = clean(e.name).split(' ');
    return want.every((w) => name.some((n) => n === w || (w.length >= 3 && n.startsWith(w))));
  });
  return hits.length === 1 ? hits[0]! : null;
}
