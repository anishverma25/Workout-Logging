import dmsans from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url';
import dmmono400 from '@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff2?url';
import dmmono500 from '@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff2?url';
import bric400 from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-400-normal.woff2?url';
import bric600 from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-600-normal.woff2?url';
import bric800 from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2?url';
import sport600 from '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-600-normal.woff2?url';
import sport800 from '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-800-normal.woff2?url';
import doto400 from '@fontsource/doto/files/doto-latin-400-normal.woff2?url';
import doto700 from '@fontsource/doto/files/doto-latin-700-normal.woff2?url';
import serif400i from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url';
import serif400 from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
import tight400 from '@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff2?url';
import tight500 from '@fontsource/inter-tight/files/inter-tight-latin-500-normal.woff2?url';
import tight600 from '@fontsource/inter-tight/files/inter-tight-latin-600-normal.woff2?url';
import tight800 from '@fontsource/inter-tight/files/inter-tight-latin-800-normal.woff2?url';
import marker400 from '@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff2?url';
import pixel400 from '@fontsource/pixelify-sans/files/pixelify-sans-latin-400-normal.woff2?url';
import pixel600 from '@fontsource/pixelify-sans/files/pixelify-sans-latin-600-normal.woff2?url';
import mono400 from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff2?url';
import mono700 from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2?url';
import syne600 from '@fontsource/syne/files/syne-latin-600-normal.woff2?url';
import syne800 from '@fontsource/syne/files/syne-latin-800-normal.woff2?url';
import unb400 from '@fontsource/unbounded/files/unbounded-latin-400-normal.woff2?url';
import unb600 from '@fontsource/unbounded/files/unbounded-latin-600-normal.woff2?url';

/**
 * The story card and weekly report fonts (November 2026). Self-hosted from @fontsource, fetched
 * only when the share sheet or the report needs them, and never precached by the service worker
 * (build/pwa.ts leaves them out by name: LAZY_FONTS). Each family loads on its own, so one that
 * fails falls back without blocking the others.
 */

export type FontId = 'bric' | 'unb' | 'syne' | 'doto' | 'pixel' | 'serif' | 'mono' | 'sport';
export type Family = FontId | 'tight' | 'marker' | 'dmsans' | 'dmmono';

/** Names the faces are registered under; prefixed so they never clash with page fonts. */
export const FAMILY: Record<Family, string> = {
  bric: 'MT Bricolage',
  unb: 'MT Unbounded',
  syne: 'MT Syne',
  doto: 'MT Doto',
  pixel: 'MT Pixelify',
  serif: 'MT Instrument',
  mono: 'MT Space Mono',
  sport: 'MT Big Shoulders',
  tight: 'MT Inter Tight',
  marker: 'MT Marker',
  dmsans: 'MT DM Sans',
  dmmono: 'MT DM Mono',
};

/** Fallbacks when a face could not load: the closest look that is always there. */
const FALLBACK: Record<Family, string> = {
  bric: 'sans-serif',
  unb: 'sans-serif',
  syne: 'sans-serif',
  doto: 'monospace',
  pixel: 'monospace',
  serif: 'Georgia, serif',
  mono: 'monospace',
  sport: 'sans-serif',
  tight: 'Inter, sans-serif',
  marker: 'cursive',
  dmsans: 'Inter, sans-serif',
  dmmono: 'monospace',
};

export const css = (f: Family) => `'${FAMILY[f]}', '${FAMILY.tight}', ${FALLBACK[f]}`;

/** The font buttons in the editor, each set in its own face. */
export const FONT_CHOICES: { id: FontId; label: string }[] = [
  { id: 'bric', label: 'Bricolage' },
  { id: 'unb', label: 'Unbounded' },
  { id: 'syne', label: 'Syne' },
  { id: 'doto', label: 'Dot matrix' },
  { id: 'pixel', label: 'Pixel' },
  { id: 'serif', label: 'Editorial' },
  { id: 'mono', label: 'Mono' },
  { id: 'sport', label: 'Sporty' },
];

const FILES: Record<Family, { url: string; weight: string; style?: string }[]> = {
  bric: [
    { url: bric400, weight: '400' },
    { url: bric600, weight: '600' },
    { url: bric800, weight: '800' },
  ],
  unb: [
    { url: unb400, weight: '400' },
    { url: unb600, weight: '600' },
  ],
  syne: [
    { url: syne600, weight: '600' },
    { url: syne800, weight: '800' },
  ],
  doto: [
    { url: doto400, weight: '400' },
    { url: doto700, weight: '700' },
  ],
  pixel: [
    { url: pixel400, weight: '400' },
    { url: pixel600, weight: '600' },
  ],
  serif: [
    { url: serif400, weight: '400' },
    { url: serif400i, weight: '400', style: 'italic' },
  ],
  mono: [
    { url: mono400, weight: '400' },
    { url: mono700, weight: '700' },
  ],
  sport: [
    { url: sport600, weight: '600' },
    { url: sport800, weight: '800' },
  ],
  tight: [
    { url: tight400, weight: '400' },
    { url: tight500, weight: '500' },
    { url: tight600, weight: '600' },
    { url: tight800, weight: '800' },
  ],
  marker: [{ url: marker400, weight: '400' }],
  dmsans: [{ url: dmsans, weight: '100 1000' }],
  dmmono: [
    { url: dmmono400, weight: '400' },
    { url: dmmono500, weight: '500' },
  ],
};

const loading = new Map<Family, Promise<void>>();

/** Loads the families a card needs. Resolves even when a face fails: the fallback is used. */
export function loadFamilies(families: Iterable<Family>): Promise<void> {
  const jobs = [...new Set(families)].map((f) => {
    let job = loading.get(f);
    if (!job) {
      job = Promise.all(
        FILES[f].map(async (file) => {
          try {
            const face = new FontFace(FAMILY[f], `url(${file.url})`, {
              weight: file.weight,
              style: file.style ?? 'normal',
            });
            document.fonts.add(await face.load());
          } catch {
            // The fallback face draws instead.
          }
        }),
      ).then(() => undefined);
      loading.set(f, job);
    }
    return job;
  });
  return Promise.all(jobs).then(() => undefined);
}
