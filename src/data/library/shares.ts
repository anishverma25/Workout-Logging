import type { Citation } from '@/domain/analytics/citations';
import { exerciseIdFor } from './exercises';
import {
  SHARE_SOURCE_IDS,
  SHARE_SOURCES,
  type ExerciseShares,
  type Laterality,
} from './muscleShares';
import TARGETING from './targeting.json';

interface SheetRow {
  key: string;
  confidence: ExerciseShares['confidence'];
  technique: string | null;
  laterality: Laterality;
  regions: { region: string; share: number }[];
  /** The second sheet lists its own sources per exercise. */
  sources?: string[];
}

/** The muscle regions of the targeting sheet: region to its group ("Mid chest (sternal pec)": Chest). */
export const MUSCLE_REGIONS: Readonly<Record<string, string>> = TARGETING.muscles;

const ROWS = TARGETING.exercises as SheetRow[];

/** By exercise key: the estimated share of the work per muscle region, from the sheet. */
export const MUSCLE_SHARES: Readonly<Record<string, ExerciseShares>> = Object.fromEntries(
  ROWS.map((r) => [
    r.key,
    {
      regions: r.regions,
      confidence: r.confidence,
      sources: r.sources ?? SHARE_SOURCE_IDS[r.key] ?? [],
      note: r.technique,
      laterality: r.laterality,
    } satisfies ExerciseShares,
  ]),
);

const byId = new Map(Object.entries(MUSCLE_SHARES).map(([key, s]) => [exerciseIdFor(key), s]));

/** Estimated muscle breakdown of a library exercise, or null (custom exercises). */
export const sharesFor = (exerciseId: string): ExerciseShares | null =>
  byId.get(exerciseId) ?? null;

const SHEET_SOURCES: Readonly<Record<string, Citation>> = Object.fromEntries(
  (TARGETING.citations as Citation[]).map((c) => [c.id, c]),
);

export const shareSource = (id: string): Citation | null =>
  SHARE_SOURCES[id] ?? SHEET_SOURCES[id] ?? null;

/** Other names people search for, by exercise id ("DB shrug", "tricep dip machine"). */
export const EXERCISE_ALIASES: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries(TARGETING.aliases as Record<string, string[]>).map(([key, words]) => [
    exerciseIdFor(key),
    words,
  ]),
);

/** "Mid chest" from "Mid chest (sternal pec)": the gym name, for chips and lists. */
/** Long region names with a short gym name and the rest as detail, so lists never overflow. */
const LONG_REGIONS: Readonly<Record<string, [short: string, detail: string]>> = {
  'Adductors – longus, brevis, gracilis, pectineus': [
    'Adductors',
    'longus, brevis, gracilis, pectineus',
  ],
  'Quads – vasti': ['Quads', 'vasti'],
  'Triceps lateral & medial heads': ['Triceps outer heads', 'lateral and medial heads'],
  'Infraspinatus & teres minor': ['Infraspinatus', 'with teres minor'],
  'Thumb adductors & intrinsic hand muscles': ['Thumb and hand', 'thumb adductors, intrinsics'],
};

export const shortRegion = (region: string) =>
  LONG_REGIONS[region]?.[0] ?? region.replace(/\s*\(.*\)$/, '');
/** "sternal pec" from "Mid chest (sternal pec)", or null. */
export const regionDetail = (region: string) =>
  LONG_REGIONS[region]?.[1] ?? region.match(/\((.*)\)$/)?.[1] ?? null;

/** "Upper chest 40% · Front delts 25%": the top regions, for lists. */
export function sharesSummary(shares: ExerciseShares, top = 2): string {
  return shares.regions
    .slice(0, top)
    .map((r) => `${shortRegion(r.region)} ${r.share}%`)
    .join(' · ');
}
