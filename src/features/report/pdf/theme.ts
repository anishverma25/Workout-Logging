/**
 * Colours for the weekly report PDF. A PDF cannot read the app's CSS, so the screen tokens are
 * written out here as solid colours (the app's translucent text tokens blended onto the surface).
 * Dark matches the screen; Print friendly is a light version for paper. Every text pair used is
 * checked for contrast in `theme.test.ts` (4.5 to 1, 3 to 1 for large text and chart marks).
 */

export type PdfThemeName = 'dark' | 'light';

export interface PdfTheme {
  page: string;
  surface: string;
  surface2: string;
  text1: string;
  text2: string;
  text3: string;
  divider: string;
  /** Lime as a fill (bars, pills, rings). */
  lime: string;
  /** Lime as text on page or surface. */
  limeText: string;
  onLime: string;
  limeDim: string;
  food: string;
  foodText: string;
  body: string;
  bodyText: string;
  up: string;
  warning: string;
  danger: string;
  grid: string;
  track: string;
  /** The logo tile is always the brand's own near black. */
  markTile: string;
  markWhite: string;
  markLime: string;
}

export const PDF_THEMES: Record<PdfThemeName, PdfTheme> = {
  dark: {
    page: '#0b0b0c',
    surface: '#1c1c1e',
    surface2: '#2c2c2e',
    text1: '#ffffff',
    text2: '#a8a8ae',
    text3: '#8e8e95',
    divider: '#38383b',
    lime: '#c6f432',
    limeText: '#c6f432',
    onLime: '#000000',
    limeDim: '#2a3314',
    food: '#ffb020',
    foodText: '#ffb020',
    body: '#5cc8ff',
    bodyText: '#5cc8ff',
    up: '#30d158',
    warning: '#ffb340',
    danger: '#ff6b5e',
    grid: '#2a2a2d',
    track: '#333336',
    markTile: '#050505',
    markWhite: '#ffffff',
    markLime: '#c6f432',
  },
  light: {
    page: '#ffffff',
    surface: '#f2f2f5',
    surface2: '#e4e4e9',
    text1: '#111114',
    text2: '#45454c',
    text3: '#5c5c64',
    divider: '#d4d4da',
    lime: '#4f6d00',
    limeText: '#3f5800',
    onLime: '#ffffff',
    limeDim: '#eef6d6',
    food: '#b86e00',
    foodText: '#8a5200',
    body: '#0b72ad',
    bodyText: '#085a8a',
    up: '#1a7f37',
    warning: '#9a5b00',
    danger: '#c42b1c',
    grid: '#e6e6ea',
    track: '#dcdce2',
    markTile: '#050505',
    markWhite: '#ffffff',
    markLime: '#c6f432',
  },
};

/** The screen's CSS variables, as the report's SVG charts use them. */
export function cssVar(theme: PdfTheme, name: string): string | null {
  switch (name) {
    case '--lime':
      return theme.lime;
    case '--lime-dim':
      return theme.limeDim;
    case '--on-lime':
      return theme.onLime;
    case '--report-food':
      return theme.food;
    case '--report-body':
      return theme.body;
    case '--text-1':
      return theme.text1;
    case '--text-2':
      return theme.text2;
    case '--text-3':
      return theme.text3;
    case '--grid':
      return theme.grid;
    case '--track':
      return theme.track;
    case '--surface':
      return theme.surface;
    case '--border-strong':
      return theme.divider;
    case '--up':
      return theme.up;
    case '--warning':
      return theme.warning;
    case '--danger':
      return theme.danger;
    default:
      return null;
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map(lin) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Text colour pairs the PDF draws, with the contrast each needs. */
export function textPairs(t: PdfTheme): { name: string; fg: string; bg: string; min: number }[] {
  const pairs: { name: string; fg: string; bg: string; min: number }[] = [];
  for (const [bgName, bg] of [
    ['page', t.page],
    ['surface', t.surface],
  ] as const) {
    for (const [fgName, fg] of [
      ['text1', t.text1],
      ['text2', t.text2],
      ['text3', t.text3],
      ['limeText', t.limeText],
      ['foodText', t.foodText],
      ['bodyText', t.bodyText],
      ['up', t.up],
      ['warning', t.warning],
      ['danger', t.danger],
    ] as const) {
      pairs.push({ name: `${fgName} on ${bgName}`, fg, bg, min: 4.5 });
    }
  }
  pairs.push({ name: 'onLime on lime', fg: t.onLime, bg: t.lime, min: 4.5 });
  pairs.push({ name: 'text1 on limeDim', fg: t.text1, bg: t.limeDim, min: 4.5 });
  pairs.push({ name: 'text2 on limeDim', fg: t.text2, bg: t.limeDim, min: 4.5 });
  pairs.push({ name: 'limeText on limeDim', fg: t.limeText, bg: t.limeDim, min: 4.5 });
  pairs.push({ name: 'text1 on surface2', fg: t.text1, bg: t.surface2, min: 4.5 });
  pairs.push({ name: 'text2 on surface2', fg: t.text2, bg: t.surface2, min: 4.5 });
  // Chart marks against the surface: 3 to 1 for graphics.
  for (const [n, c] of [
    ['lime', t.lime],
    ['food', t.food],
    ['body', t.body],
  ] as const)
    pairs.push({ name: `${n} mark on surface`, fg: c, bg: t.surface, min: 3 });
  // Labels drawn on chart bars.
  pairs.push({ name: 'onLime on food bar', fg: t.onLime, bg: t.food, min: 3 });
  return pairs;
}
