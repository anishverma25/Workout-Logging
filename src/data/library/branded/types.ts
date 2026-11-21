/**
 * One product from the Branded Food Macro Database (November 2026, 49 brand groups), as
 * written by `scripts/branded-foods/gen.py`. The numbers are for `basis` grams or ml, exactly
 * as the source lists them; null means the source does not list it.
 */
export type BrandedRow = [
  id: string,
  name: string,
  brand: string,
  category: 'drink' | 'snack' | 'dairy' | 'breakfast' | 'basic' | 'sweet' | 'paneer',
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fibre: number | null,
  sugar: number | null,
  basis: number,
  basisUnit: 'g' | 'ml',
  pieceG: number | null,
  pieceName: [string, string] | null,
  /** conflict: listings disagree; check: may be another product; estimate: some numbers worked out. */
  flag: 'conflict' | 'check' | 'estimate' | null,
  note: string | null,
  /** 1: the printed calories differ by over 20% from 4/4/9 of the macros; kept as printed. */
  printedKcal: 0 | 1,
  /** 1: sold by the cup or cone with no weight printed; logged by the piece only. */
  servingOnly: 0 | 1,
];
