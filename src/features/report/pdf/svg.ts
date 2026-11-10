import { LineCapStyle, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { cssVar, hexToRgb, type PdfTheme } from './theme';

/**
 * Draws the report's own SVG charts into the PDF as vector shapes, so the PDF shows exactly the
 * chart on the screen. Only what the report's charts use is supported: g, rect, circle, line,
 * path, polygon and text, with colours from the theme.
 */

export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#x27': "'", '#39': "'" };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => ENTITIES[e.toLowerCase()] ?? (e.startsWith('#x') ? String.fromCodePoint(parseInt(e.slice(2), 16)) : e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : m));

/** Parses the markup React renders for a chart. */
export function parseSvg(markup: string): SvgNode {
  const root: SvgNode = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack: SvgNode[] = [root];
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    const top = stack[stack.length - 1]!;
    if (m[5] !== undefined) {
      top.text += decode(m[5]);
      continue;
    }
    if (m[1]) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3]!.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]!] = decode(a[2]!);
    const node: SvgNode = { tag: m[2]!.toLowerCase(), attrs, children: [], text: '' };
    top.children.push(node);
    if (!m[4]) stack.push(node);
  }
  return root.children.find((c) => c.tag === 'svg') ?? root;
}

export function viewBox(svg: SvgNode): [number, number, number, number] {
  const v = (svg.attrs.viewBox ?? svg.attrs.viewbox ?? '0 0 100 100').split(/[\s,]+/).map(Number);
  return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 100, v[3] ?? 100];
}

export interface SvgFonts {
  mono: PDFFont;
  monoBold: PDFFont;
  display: PDFFont;
  sans: PDFFont;
  clean: (font: PDFFont, s: string) => string;
}

function colour(theme: PdfTheme, v: string | undefined) {
  if (!v || v === 'none' || v === 'transparent') return null;
  const varName = /^var\((--[\w-]+)\)$/.exec(v.trim())?.[1];
  const hex = varName ? cssVar(theme, varName) : v.startsWith('#') ? v : null;
  if (!hex) return null;
  const [r, g, b] = hexToRgb(hex);
  return rgb(r, g, b);
}

const num = (v: string | undefined, d = 0) => {
  const n = v === undefined ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!rr) return `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  return `M${x + rr} ${y} H${x + w - rr} A${rr} ${rr} 0 0 1 ${x + w} ${y + rr} V${y + h - rr} A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h} H${x + rr} A${rr} ${rr} 0 0 1 ${x} ${y + h - rr} V${y + rr} A${rr} ${rr} 0 0 1 ${x + rr} ${y} Z`;
}

/**
 * Draws `svg` with its top left at (x, top) in PDF points (top measured down from the page top),
 * `width` wide. Returns the drawn height.
 */
export function drawSvg(page: PDFPage, svg: SvgNode, at: { x: number; top: number; width: number }, theme: PdfTheme, fonts: SvgFonts): number {
  const [vx, vy, vw, vh] = viewBox(svg);
  const s = at.width / vw;
  const H = page.getHeight();
  const X = (v: number) => at.x + (v - vx) * s;
  const Y = (v: number) => H - (at.top + (v - vy) * s);
  // drawSvgPath maps path coordinates (y down) from its origin with the given scale.
  const origin = { x: at.x - vx * s, y: H - at.top + vy * s, scale: s };

  const walk = (n: SvgNode, inherited: Record<string, string>) => {
    const a = { ...inherited, ...n.attrs };
    const opacity = num(n.attrs.opacity, 1);
    const fill = colour(theme, a.fill);
    const stroke = colour(theme, a.stroke);
    const sw = num(a['stroke-width'] ?? a.strokeWidth, 1);
    const dash = (a['stroke-dasharray'] ?? '').split(/[\s,]+/).filter(Boolean).map((d) => Number(d) * s);
    switch (n.tag) {
      case 'svg':
      case 'g':
        for (const c of n.children) walk(c, pickInherited(a));
        return;
      case 'rect': {
        const d = roundedRect(num(a.x), num(a.y), num(a.width), num(a.height), num(a.rx));
        page.drawSvgPath(d, { ...origin, color: fill ?? undefined, opacity, borderColor: stroke ?? undefined, borderWidth: stroke ? sw : 0 });
        return;
      }
      case 'circle': {
        const r = num(a.r) * s;
        page.drawCircle({
          x: X(num(a.cx)),
          y: Y(num(a.cy)),
          size: r,
          color: fill ?? undefined,
          opacity,
          borderColor: stroke ?? undefined,
          borderWidth: stroke ? sw * s : 0,
          borderOpacity: opacity,
        });
        return;
      }
      case 'line':
        if (!stroke) return;
        page.drawLine({
          start: { x: X(num(a.x1)), y: Y(num(a.y1)) },
          end: { x: X(num(a.x2)), y: Y(num(a.y2)) },
          thickness: sw * s,
          color: stroke,
          opacity,
          dashArray: dash.length ? dash : undefined,
        });
        return;
      case 'path':
      case 'polygon': {
        const d =
          n.tag === 'path'
            ? (a.d ?? '')
            : `M${(a.points ?? '').trim().split(/\s+/).join(' L')} Z`;
        if (!d) return;
        page.drawSvgPath(d, {
          ...origin,
          color: fill ?? undefined,
          opacity,
          borderColor: stroke ?? undefined,
          borderWidth: stroke ? sw : 0,
          borderOpacity: opacity,
          borderLineCap: (a['stroke-linecap'] ?? a.strokeLinecap) === 'round' ? LineCapStyle.Round : undefined,
          borderDashArray: dash.length ? dash.map((d2) => d2 / s) : undefined,
        });
        return;
      }
      case 'text': {
        const style = a.style ?? '';
        const weight = num(a['font-weight'] ?? a.fontWeight, 400);
        const font = /Bricolage/.test(style) ? fonts.display : /Mono/.test(style) ? (weight >= 500 ? fonts.monoBold : fonts.mono) : fonts.sans;
        const size = num(a['font-size'] ?? a.fontSize, 11) * s;
        const text = fonts.clean(font, collectText(n));
        if (!text) return;
        const w = font.widthOfTextAtSize(text, size);
        const anchor = a['text-anchor'] ?? a.textAnchor;
        const x = X(num(a.x)) - (anchor === 'end' ? w : anchor === 'middle' ? w / 2 : 0);
        page.drawText(text, { x, y: Y(num(a.y)), size, font, color: fill ?? colour(theme, 'var(--text-1)')!, opacity });
        return;
      }
      default:
        return;
    }
  };
  walk(svg, {});
  return vh * s;
}

function collectText(n: SvgNode): string {
  return n.text + n.children.map(collectText).join('');
}

function pickInherited(a: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const k of ['fill', 'stroke', 'style', 'font-size', 'font-weight', 'text-anchor']) if (a[k] !== undefined) out[k] = a[k];
  return out;
}
