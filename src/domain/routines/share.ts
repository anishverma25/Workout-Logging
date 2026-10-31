import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';
import { Equipment, LoadMode, MuscleGroup, TrackingType, Weekday } from '../models/schemas';

/**
 * A routine as a link. Everything travels inside the link itself (compressed, after the #, so
 * it never reaches a server): days, exercises, sets, rep ranges, effort, rest, bench angle,
 * supersets and whether reps are logged per side. Library exercises go by their permanent key;
 * the sender's own exercises go with what is needed to make them again.
 */

const SharedCustomExercise = z.object({
  name: z.string().trim().min(2).max(80),
  primaryMuscle: MuscleGroup,
  secondaryMuscles: z.array(MuscleGroup).max(10),
  equipment: Equipment,
  category: z.enum(['compound', 'isolation']),
  trackingType: TrackingType,
  loadMode: LoadMode,
});
export type SharedCustomExercise = z.infer<typeof SharedCustomExercise>;

const SharedExercise = z
  .object({
    /** A library exercise, by its permanent key. */
    key: z.string().min(1).max(80).optional(),
    /** One of the sender's own exercises. */
    custom: SharedCustomExercise.optional(),
    sets: z.number().int().min(1).max(20),
    repMin: z.number().int().min(1).max(100),
    repMax: z.number().int().min(1).max(100),
    rir: z.number().min(0).max(10).nullable(),
    rest: z.number().int().min(0).max(900),
    angle: z.number().int().min(-45).max(90).nullish(),
    superset: z.number().int().min(1).max(50).nullish(),
    bySide: z.boolean().nullish(),
    notes: z.string().max(500).nullish(),
  })
  .refine((e) => !!e.key !== !!e.custom, 'An exercise is either from the library or custom.')
  .refine((e) => e.repMin <= e.repMax, 'Rep range out of order.');
export type SharedExercise = z.infer<typeof SharedExercise>;

export const SharedRoutine = z.object({
  v: z.literal(1),
  name: z.string().trim().min(1).max(60),
  days: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        weekdays: z.array(Weekday).max(7),
        exercises: z.array(SharedExercise).max(40),
      }),
    )
    .min(1)
    .max(7),
});
export type SharedRoutine = z.infer<typeof SharedRoutine>;

/** The page a shared routine opens on. */
export const SHARE_PATH = '/r';

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** The routine as a short code for a link. */
export function encodeRoutine(routine: SharedRoutine): string {
  const checked = SharedRoutine.parse(routine);
  return toBase64Url(deflateSync(strToU8(JSON.stringify(checked)), { level: 9 }));
}

/** The routine in a code, or null when the code is damaged, cut short or not a routine. */
export function decodeRoutine(code: string): SharedRoutine | null {
  const clean = code.trim().replace(/^#/, '');
  if (!clean || clean.length > 20_000 || !/^[A-Za-z0-9_-]+$/.test(clean)) return null;
  try {
    const json: unknown = JSON.parse(strFromU8(inflateSync(fromBase64Url(clean))));
    const parsed = SharedRoutine.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The full link to send. */
export function shareLink(origin: string, routine: SharedRoutine): string {
  return `${origin}${SHARE_PATH}#${encodeRoutine(routine)}`;
}
