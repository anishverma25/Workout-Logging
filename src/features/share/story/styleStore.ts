import { sanePlacement } from '@/domain/share/layout';
import { FONT_CHOICES, type FontId } from './fonts';
import { ACCENTS, DEFAULT_STYLE, DESIGNS, type StoryStyle } from './render';

/**
 * The person's last story card choices, remembered on this device only (design, font, colours,
 * opacity, size, position, brand, tilt, text colour). The photo itself is never stored.
 */

const KEY = 'overload.story';

const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d;
const pct = (v: unknown, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : d;

/** Reads stored choices back, ignoring anything unknown or out of range. */
export function saneStyle(raw: unknown): StoryStyle {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fonts = FONT_CHOICES.map((f) => f.id);
  return {
    design: oneOf(
      o.design,
      DESIGNS.map((d) => d.id),
      DEFAULT_STYLE.design,
    ),
    font: oneOf<FontId | 'auto'>(o.font, ['auto', ...fonts], 'auto'),
    accent: oneOf(
      o.accent,
      ACCENTS.map((a) => a.value),
      DEFAULT_STYLE.accent,
    ),
    ink: oneOf(o.ink, ['white', 'black'] as const, 'white'),
    boxOpacity: pct(o.boxOpacity, DEFAULT_STYLE.boxOpacity),
    dim: pct(o.dim, DEFAULT_STYLE.dim),
    tags: typeof o.tags === 'boolean' ? o.tags : true,
    showName: typeof o.showName === 'boolean' ? o.showName : true,
    brand: oneOf(o.brand, ['top', 'safe'] as const, 'top'),
    brandSize: oneOf(o.brandSize, ['s', 'm', 'l'] as const, 'm'),
    // A photo is never remembered, so a stored "photo" background starts on the brand one.
    background: oneOf(o.background, ['bg1', 'bg2', 'bg3', 'bg4'] as const, 'bg1'),
    placement: sanePlacement(o.placement as never),
  };
}

export function loadStyle(): StoryStyle {
  try {
    return saneStyle(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return DEFAULT_STYLE;
  }
}

export function saveStyle(style: StoryStyle) {
  try {
    const { background, ...rest } = style;
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...rest, background: background === 'photo' ? 'bg1' : background }),
    );
  } catch {
    // Private windows may refuse storage; the choices still apply until the sheet closes.
  }
}
