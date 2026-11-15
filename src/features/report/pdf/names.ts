import { SYSTEM_EXERCISES } from '@/data/library/exercises';

const LIBRARY = new Map(SYSTEM_EXERCISES.map((e) => [e.id, e.name]));

/**
 * A lift's name as the PDF can print it (R6). The PDF fonts carry Latin letters only, so a name
 * typed in Devanagari (or any script the font lacks) would print blank: it becomes the library
 * exercise's name, or "Lift" for a custom exercise.
 */
export function printableName(
  name: string,
  exerciseId: string,
  clean: (s: string) => string,
): string {
  const wanted = name.trim();
  const letters = (s: string) => [...s].filter((c) => /\p{L}|\p{N}/u.test(c)).length;
  const kept = clean(wanted).trim();
  if (wanted && letters(kept) > 0 && letters(kept) === letters(wanted)) return wanted;
  const library = LIBRARY.get(exerciseId);
  if (library && letters(clean(library)) === letters(library)) return library;
  return 'Lift';
}
