import type { Food } from '@/domain/nutrition/calc';
import type { Meal } from '@/domain/nutrition/types';
import type { BrandedRow } from './types';

/**
 * Packaged foods from the Branded Food Macro Database (November 2026): protein powders, dairy,
 * oats and spreads, bars, protein ice cream, chocolates and drinks from 49 brand groups. One
 * food per product; a per-scoop, per-pack or per-100 g figure is the same food with a serving
 * to choose. Values are copied, never estimated: rows missing calories, protein, carbs or fat
 * were left out (docs/branded-foods.md).
 */

const ALL: Meal[] = ['breakfast', 'lunch', 'snacks', 'dinner'];
const MEALS: Partial<Record<BrandedRow[3], Meal[]>> = {
  breakfast: ['breakfast', 'snacks'],
  snack: ['snacks', 'breakfast'],
  sweet: ['snacks', 'dinner'],
};

/** Other names people type for a brand. Search treats each like the brand's own name. */
export const BRAND_ALIASES: Record<string, string[]> = {
  MuscleBlaze: ['mb', 'muscle blaze', 'muscleblaze'],
  Naturaltein: ['natural tein'],
  'Beast Life': ['beastlife'],
  Avvatar: ['avatar', 'avvtar'],
  Nakpro: ['nak pro'],
  FuelOne: ['fuel one'],
  'Optimum Nutrition': ['on', 'optimum', 'gold standard'],
  'The Whole Truth': ['twt', 'whole truth'],
  TrueBasics: ['true basics'],
  SuperYou: ['super you'],
  "Only What's Needed": ['own', 'only whats needed'],
  'AS-IT-IS': ['asitis', 'as it is'],
  Nutrabay: ['nutra bay'],
  'Guru Mann': ['gurumann', 'gmn'],
  'Milky Mist': ['milkymist'],
  'Country Delight': ['countrydelight'],
  'Yoga Bar': ['yogabar'],
  MyPB: ['my pb'],
  "Doctor's Choice": ['doctors choice'],
  'GOAT Life': ['goatlife'],
  "Bagrry's": ['bagrys', 'bagrry', 'bagrrys'],
  RiteBite: ['rite bite', 'ritebite', 'max protein'],
  'Get-A-Way': ['getaway', 'get a way'],
  'Go Zero': ['gozero'],
  Dabur: ['real juice', 'dabur real'],
  Cadbury: ['cadbury'],
  Nestlé: ['nestle'],
  MillD: ['mill d'],
  'Coca-Cola': ['coke', 'coca cola'],
  'Thums Up': ['thumbs up', 'thumsup'],
  '7UP': ['7 up', 'seven up'],
  'Red Bull': ['redbull'],
  'Monster Energy': ['monster'],
};

export function fromBranded(r: BrandedRow): Food {
  const [id, name, brand, category, kcal, p, c, f, fibre, , basis, unit, pieceG, pieceName] = r;
  const [, , , , , , , , , , , , , , flag, note, printedKcal] = r;
  const k = 100 / basis;
  const round = (v: number) => Math.round(v * k * 100) / 100;
  const liquid = unit === 'ml';
  return {
    id,
    name,
    aliases: BRAND_ALIASES[brand] ?? [],
    brand,
    category,
    region: 'all',
    meals: MEALS[category] ?? ALL,
    diet: 'veg',
    jain: false,
    // ml is taken as g, as every pack label in the library does (drinks sit close to 1 g/ml).
    per100: {
      kcal: round(kcal),
      proteinG: round(p),
      carbsG: round(c),
      fatG: round(f),
      fibreG: fibre === null ? 0 : round(fibre),
    },
    fatPer100: null,
    units: pieceG ? ['piece', liquid ? 'ml' : 'g'] : [liquid ? 'ml' : 'g'],
    defaultAmount: pieceG ? 1 : liquid ? 200 : 100,
    density: 1,
    pieceG,
    pieceName,
    servingG: null,
    source: 'label',
    recipe: null,
    ...(fibre === null ? { fibreUnknown: true } : {}),
    ...(printedKcal ? { printedKcal: true } : {}),
    ...(flag && note ? { check: { kind: flag, note } } : {}),
  };
}
