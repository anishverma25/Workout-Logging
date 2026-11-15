import { readFileSync } from 'node:fs';

/** Batch 16 (X1, X7): text and fill tokens reach WCAG AA (4.5:1) where they are used. */
const CSS = readFileSync('src/styles/tokens.css', 'utf8');

type Rgb = [number, number, number];
function token(name: string): { rgb: Rgb; alpha: number } {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(CSS);
  if (!m) throw new Error(`no --${name}`);
  const v = m[1]!.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(v);
  if (!rgb) throw new Error(`cannot read --${name}: ${v}`);
  return { rgb: [+rgb[1]!, +rgb[2]!, +rgb[3]!], alpha: rgb[4] ? +rgb[4] : 1 };
}
const lum = ([r, g, b]: Rgb) => {
  const c = [r, g, b].map((x) => {
    const v = x / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const over = (fg: { rgb: Rgb; alpha: number }, bg: Rgb): Rgb =>
  fg.rgb.map((v, i) => v * fg.alpha + bg[i]! * (1 - fg.alpha)) as Rgb;
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('colour tokens', () => {
  it.each(['bg', 'surface', 'surface-2'])('text-2 and text-3 read at 4.5:1 on --%s', (bg) => {
    const base = token(bg).rgb;
    for (const t of ['text-2', 'text-3'])
      expect(contrast(over(token(t), base), base)).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on the delete red reaches 4.5:1', () => {
    expect(contrast([255, 255, 255], token('danger-fill').rgb)).toBeGreaterThanOrEqual(4.5);
  });
});
