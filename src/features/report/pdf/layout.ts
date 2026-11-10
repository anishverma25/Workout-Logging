import { rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { drawSvg, parseSvg, viewBox, type SvgFonts, type SvgNode } from './svg';
import { hexToRgb, type PdfTheme } from './theme';

/**
 * A small box layout for the PDF: every node measures its height at a width and draws itself at
 * a top left corner. Coordinates are points from the page's top.
 */

export interface Ctx {
  page: PDFPage;
  theme: PdfTheme;
  fonts: SvgFonts;
}

export interface Node {
  height(width: number): number;
  draw(c: Ctx, x: number, top: number, width: number): void;
}

export const colorOf = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return rgb(r, g, b);
};

export interface Run {
  text: string;
  font: PDFFont;
  size: number;
  color: string;
}

interface Word {
  text: string;
  run: Run;
  width: number;
  space: number;
}

/** Wrapped text from runs; lines break between words, a word longer than a line breaks by letter. */
export function text(runs: Run[], o: { lineHeight?: number; align?: 'left' | 'center' | 'right'; fonts: SvgFonts }): Node {
  const lh = o.lineHeight ?? 1.38;
  const layout = (width: number) => {
    const words: Word[] = [];
    for (const r0 of runs) {
      const r = { ...r0, text: o.fonts.clean(r0.font, r0.text) };
      const parts = r.text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        if (/^\s+$/.test(p)) {
          const last = words[words.length - 1];
          if (last) last.space = r.font.widthOfTextAtSize(' ', r.size);
          continue;
        }
        words.push({ text: p, run: r, width: r.font.widthOfTextAtSize(p, r.size), space: 0 });
      }
    }
    const lines: Word[][] = [];
    let line: Word[] = [];
    let w = 0;
    for (const word of words) {
      const prevSpace = line.length ? line[line.length - 1]!.space : 0;
      if (line.length && w + prevSpace + word.width > width) {
        lines.push(line);
        line = [];
        w = 0;
      }
      if (!line.length && word.width > width) {
        // Break a very long word by letters.
        let chunk = '';
        for (const ch of word.text) {
          const next = chunk + ch;
          if (word.run.font.widthOfTextAtSize(next, word.run.size) > width && chunk) {
            lines.push([{ ...word, text: chunk, width: word.run.font.widthOfTextAtSize(chunk, word.run.size), space: 0 }]);
            chunk = ch;
          } else chunk = next;
        }
        line = [{ ...word, text: chunk, width: word.run.font.widthOfTextAtSize(chunk, word.run.size) }];
        w = line[0]!.width;
        continue;
      }
      w += (line.length ? prevSpace : 0) + word.width;
      line.push(word);
    }
    if (line.length) lines.push(line);
    const heights = lines.map((l) => Math.max(...l.map((x) => x.run.size)) * lh);
    return { lines, heights };
  };
  return {
    height: (width) => layout(width).heights.reduce((a, b) => a + b, 0),
    draw(c, x, top, width) {
      const { lines, heights } = layout(width);
      let y = top;
      lines.forEach((l, i) => {
        const h = heights[i]!;
        const size = Math.max(...l.map((wd) => wd.run.size));
        const lw = l.reduce((a, wd, k) => a + wd.width + (k < l.length - 1 ? wd.space : 0), 0);
        let cx = o.align === 'center' ? x + (width - lw) / 2 : o.align === 'right' ? x + width - lw : x;
        // Baseline: centre the cap height in the line box.
        const base = y + (h - size) / 2 + size * 0.8;
        for (const [k, wd] of l.entries()) {
          c.page.drawText(wd.text, {
            x: cx,
            y: c.page.getHeight() - base,
            size: wd.run.size,
            font: wd.run.font,
            color: colorOf(wd.run.color),
          });
          cx += wd.width + (k < l.length - 1 ? wd.space : 0);
        }
        y += h;
      });
    },
  };
}

export function vstack(nodes: (Node | null | false)[], gap: number): Node {
  const list = nodes.filter((n): n is Node => !!n);
  return {
    height: (w) => list.reduce((a, n, i) => a + n.height(w) + (i ? gap : 0), 0),
    draw(c, x, top, w) {
      let y = top;
      for (const n of list) {
        n.draw(c, x, y, w);
        y += n.height(w) + gap;
      }
    },
  };
}

export function spacer(h: number): Node {
  return { height: () => h, draw: () => undefined };
}

/** Columns: fixed point widths or `'flex'` sharing the rest. */
export function row(cols: { node: Node; width: number | 'flex' }[], gap: number, align: 'top' | 'center' = 'top'): Node {
  const widths = (w: number) => {
    const fixed = cols.reduce((a, col) => a + (col.width === 'flex' ? 0 : col.width), 0);
    const flex = cols.filter((col) => col.width === 'flex').length;
    const rest = Math.max(0, w - fixed - gap * (cols.length - 1));
    return cols.map((col) => (col.width === 'flex' ? rest / Math.max(1, flex) : col.width));
  };
  return {
    height: (w) => {
      const ws = widths(w);
      return Math.max(0, ...cols.map((col, i) => col.node.height(ws[i]!)));
    },
    draw(c, x, top, w) {
      const ws = widths(w);
      const h = Math.max(0, ...cols.map((col, i) => col.node.height(ws[i]!)));
      let cx = x;
      cols.forEach((col, i) => {
        const ch = col.node.height(ws[i]!);
        col.node.draw(c, cx, align === 'center' ? top + (h - ch) / 2 : top, ws[i]!);
        cx += ws[i]! + gap;
      });
    },
  };
}

/** Equal columns, rows as tall as their tallest cell (cells stretch to it when `fill`). */
export function grid(nodes: Node[], columns: number, gap: number): Node {
  const rows = (w: number) => {
    const cw = (w - gap * (columns - 1)) / columns;
    const out: { cells: Node[]; h: number }[] = [];
    for (let i = 0; i < nodes.length; i += columns) {
      const cells = nodes.slice(i, i + columns);
      out.push({ cells, h: Math.max(...cells.map((n) => n.height(cw))) });
    }
    return { cw, out };
  };
  return {
    height: (w) => {
      const { out } = rows(w);
      return out.reduce((a, r, i) => a + r.h + (i ? gap : 0), 0);
    },
    draw(c, x, top, w) {
      const { cw, out } = rows(w);
      let y = top;
      for (const r of out) {
        r.cells.forEach((n, i) => {
          const cell = n as Node & { drawAt?: (c: Ctx, x: number, top: number, w: number, h: number) => void };
          if (cell.drawAt) cell.drawAt(c, x + i * (cw + gap), y, cw, r.h);
          else n.draw(c, x + i * (cw + gap), y, cw);
        });
        y += r.h + gap;
      }
    },
  };
}

export function roundedPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + rr} ${y} H${x + w - rr} A${rr} ${rr} 0 0 1 ${x + w} ${y + rr} V${y + h - rr} A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h} H${x + rr} A${rr} ${rr} 0 0 1 ${x} ${y + h - rr} V${y + rr} A${rr} ${rr} 0 0 1 ${x + rr} ${y} Z`;
}

export function fillRect(c: Ctx, x: number, top: number, w: number, h: number, r: number, fill: string, border?: string) {
  c.page.drawSvgPath(roundedPath(0, 0, w, h, r), {
    x,
    y: c.page.getHeight() - top,
    color: colorOf(fill),
    borderColor: border ? colorOf(border) : undefined,
    borderWidth: border ? 0.8 : 0,
  });
}

/** A filled rounded box around a child; in a grid it stretches to the row height. */
export function box(child: Node, o: { fill: string; radius?: number; pad?: number; border?: string }): Node {
  const pad = o.pad ?? 14;
  const r = o.radius ?? 12;
  const node: Node & { drawAt: (c: Ctx, x: number, top: number, w: number, h: number) => void } = {
    height: (w) => child.height(w - pad * 2) + pad * 2,
    draw(c, x, top, w) {
      node.drawAt(c, x, top, w, node.height(w));
    },
    drawAt(c, x, top, w, h) {
      fillRect(c, x, top, w, h, r, o.fill, o.border);
      child.draw(c, x + pad, top + pad, w - pad * 2);
    },
  };
  return node;
}

/** A chart from the screen's SVG markup, at most `maxWidth` wide, centred. */
export function chart(markup: string, maxWidth = Infinity): Node {
  const svg: SvgNode = parseSvg(markup);
  const [, , vw, vh] = viewBox(svg);
  const width = (w: number) => Math.min(w, maxWidth);
  return {
    height: (w) => (width(w) / vw) * vh,
    draw(c, x, top, w) {
      drawSvg(c.page, svg, { x: x + (w - width(w)) / 2, top, width: width(w) }, c.theme, c.fonts);
    },
  };
}

/** A thin rule across the width. */
export function rule(colorKey: keyof PdfTheme = 'divider', pad = 0): Node {
  return {
    height: () => pad * 2 + 0.8,
    draw(c, x, top, w) {
      c.page.drawLine({
        start: { x, y: c.page.getHeight() - top - pad },
        end: { x: x + w, y: c.page.getHeight() - top - pad },
        thickness: 0.8,
        color: colorOf(c.theme[colorKey]),
      });
    },
  };
}

/** Draws something custom at a fixed height. */
export function custom(h: number, draw: Node['draw']): Node {
  return { height: () => h, draw };
}
