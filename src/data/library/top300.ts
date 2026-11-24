import { normalize } from '@/domain/exercises/search';
import type { Food } from '@/domain/nutrition/calc';
import type { Meal } from '@/domain/nutrition/types';

/**
 * Top 300 Indian foods by serving (November 2026), written by scripts/top300/build.py: each
 * with its natural serving (1 medium chapati, 1 katori, 1 plate, 1 can) and the numbers for
 * that serving as the sheet gives them. Rows the sheet marks "Recipe estimate" say so.
 */
export interface Top300Row {
  id: string;
  name: string;
  category: Food['category'];
  diet: Food['diet'];
  kcal: number;
  p: number;
  c: number;
  f: number;
  fibre: number | null;
  servingG: number;
  unit: 'g' | 'ml';
  /** How many pieces the serving is (10 almonds). */
  qty: number;
  piece: [string, string];
  serving: string;
  estimate: boolean;
  note: string | null;
}

const ALL: Meal[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

export function fromTop300(r: Top300Row): Food {
  const k = 100 / r.servingG;
  const pieceG = r.servingG / (r.qty || 1);
  return {
    id: r.id,
    name: r.name,
    aliases: r.name
      .split(/\s*\/\s*/)
      .slice(1)
      .map((a) => a.toLowerCase()),
    category: r.category,
    region: 'all',
    meals: ALL,
    diet: r.diet,
    jain: false,
    per100: {
      kcal: r.kcal * k,
      proteinG: r.p * k,
      carbsG: r.c * k,
      fatG: r.f * k,
      fibreG: (r.fibre ?? 0) * k,
    },
    fatPer100: null,
    units: ['piece', r.unit === 'ml' ? 'ml' : 'g'],
    defaultAmount: r.qty || 1,
    density: 1,
    pieceG,
    pieceName: r.piece,
    servingG: null,
    source: 'ingredient',
    recipe: null,
    ...(r.fibre === null ? { fibreUnknown: true } : {}),
    ...(r.estimate
      ? {
          check: {
            kind: 'estimate' as const,
            note: `Household portion: ${r.serving}. Worked out from a standard recipe, not weighed.`,
          },
        }
      : {}),
  };
}

/** Words that do not make a different food: "plain chapati" is a chapati, "cooked rice" rice. */
const FILLER = new Set([
  'plain',
  'cooked',
  'raw',
  'steamed',
  'boiled',
  'homemade',
  'fresh',
  'whole',
  'regular',
  'simple',
  'basic',
  'indian',
  'style',
  'with',
  'and',
  'the',
  'a',
  'of',
  'curry',
  'sabzi',
]);
const plain = (s: string) =>
  normalize(s.replace(/\(.*?\)/g, ' '))
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .sort()
    .join(' ');

/**
 * The sheet's foods the library does not already have: a row is left out when any of its names
 * ("Plain chapati / wheat roti") matches a library food's name or alias, ignoring word order
 * and brackets. Existing foods keep their tested values; nothing is listed twice.
 */
export function newTop300(rows: Top300Row[], library: readonly Food[]): Food[] {
  const known = new Set<string>();
  // Packaged foods by their brand's first word: "Lay's salted potato chips" is the library's
  // "Lay's Classic Salted Chips" when they share a word besides the brand.
  const byBrandWord = new Map<string, Set<string>[]>();
  for (const f of library) {
    known.add(plain(f.name));
    for (const a of f.aliases) known.add(plain(a));
    if (f.brand || f.source === 'label' || f.source === 'chain') {
      const words = normalize(f.name).split(' ').filter(Boolean);
      const first = words[0];
      if (!first) continue;
      const list = byBrandWord.get(first) ?? [];
      list.push(new Set(plain(f.name).split(' ')));
      byBrandWord.set(first, list);
    }
  }
  const samePack = (name: string) => {
    const words = normalize(name).split(' ').filter(Boolean);
    const packs = words[0] ? byBrandWord.get(words[0]) : undefined;
    if (!packs) return false;
    const mine = plain(name)
      .split(' ')
      .filter((w) => w !== plain(words[0]!));
    return packs.some((p) => mine.some((w) => p.has(w)));
  };
  return rows
    .filter((r) => !samePack(r.name) && !r.name.split(/\s*\/\s*/).some((n) => known.has(plain(n))))
    .map(fromTop300);
}
