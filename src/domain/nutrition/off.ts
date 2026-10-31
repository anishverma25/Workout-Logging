import type { LabelReading, LabelValues } from '../../../supabase/functions/_shared/coach.ts';

/**
 * A product from Open Food Facts (the free, open database of food labels) as a label reading,
 * so it opens in the same check-and-amount form as a photographed label. Only what the
 * database has is filled in; nothing is estimated.
 */

type Nutriments = Record<string, unknown>;

const n = (v: unknown, max: number): number | null => {
  const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(x) && x >= 0 && x <= max ? Math.round(x * 10) / 10 : null;
};

function column(
  nut: Nutriments,
  suffix: '_100g' | '_serving',
  maxKcal: number,
): LabelValues | null {
  const kj = n(nut[`energy-kj${suffix}`] ?? nut[`energy${suffix}`], maxKcal * 4.2);
  const kcal =
    n(nut[`energy-kcal${suffix}`], maxKcal) ?? (kj !== null ? Math.round(kj / 4.184) : null);
  const out: LabelValues = {
    kcal,
    proteinG: n(nut[`proteins${suffix}`], suffix === '_100g' ? 100 : 500),
    carbsG: n(nut[`carbohydrates${suffix}`], suffix === '_100g' ? 100 : 500),
    fatG: n(nut[`fat${suffix}`], suffix === '_100g' ? 100 : 500),
    fibreG: n(nut[`fiber${suffix}`], suffix === '_100g' ? 100 : 500),
    sugarG: n(nut[`sugars${suffix}`], suffix === '_100g' ? 100 : 500),
  };
  return out.kcal !== null ? out : null;
}

export function labelFromOff(json: unknown): LabelReading | null {
  const root = json as { status?: number; product?: Record<string, unknown> } | null;
  const p = root?.product;
  if (!p || root?.status === 0) return null;
  const nut = (p.nutriments ?? {}) as Nutriments;
  const per100 = column(nut, '_100g', 900);
  const perServing = column(nut, '_serving', 3000);
  if (!per100 && !perServing) return null;
  const text = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null;
  const serving = n(p.serving_quantity, 2000);
  const brand = text(typeof p.brands === 'string' ? p.brands.split(',')[0] : null, 40);
  return {
    product: text(p.product_name_en ?? p.product_name, 60),
    brand,
    servingG: serving && serving > 0 ? serving : null,
    servingText: text(p.serving_size, 40),
    per100,
    perServing,
    check: [],
  };
}

/** EAN-13, EAN-8, UPC-A and UPC-E codes: digits only, 8 to 14 long. */
export const isBarcode = (code: string) => /^\d{8,14}$/.test(code.trim());
