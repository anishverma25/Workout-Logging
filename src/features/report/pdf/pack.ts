/**
 * Page packing for the weekly report PDF (spec: "Our own pagination"). Blocks are atomic: a
 * block is never split. A heading travels with the block under it. When a whole section would
 * fit on a fresh page but not in what is left of a page that is already well filled, the
 * section starts on the next page, so pages tend to begin and end with whole sections.
 */

export interface PackBlock {
  /** Height in points at the page content width. */
  height: number;
  /** Section the block belongs to; consecutive blocks with the same section form one. */
  section: string;
  /** A heading: never the last thing on a page. */
  heading?: boolean;
  /** Starts a new page (the cover is followed by one). */
  breakBefore?: boolean;
}

export interface PackOptions {
  /** Content height of a page in points. */
  pageHeight: number;
  /** Space between blocks in points. */
  gap: number;
  /** Space before a new section on the same page. */
  sectionGap: number;
  /** A page this full (0 to 1) moves a section that fits whole on the next page. */
  keepSectionsFrom?: number;
}

/** Height a run of blocks takes when stacked from the top of a page. */
function stackHeight(blocks: PackBlock[], from: number, to: number, o: PackOptions) {
  let h = 0;
  for (let i = from; i < to; i++) {
    if (i > from) h += blocks[i]!.section !== blocks[i - 1]!.section ? o.sectionGap : o.gap;
    h += blocks[i]!.height;
  }
  return h;
}

function sectionEnd(blocks: PackBlock[], i: number) {
  let j = i;
  while (j < blocks.length && blocks[j]!.section === blocks[i]!.section) j++;
  return j;
}

/** Returns the indexes of the blocks on each page, in order. Deterministic. */
export function packPages(blocks: PackBlock[], o: PackOptions): number[][] {
  const keepFrom = o.keepSectionsFrom ?? 0.8;
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;

  const newPage = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
  };
  const spaceBefore = (i: number) =>
    page.length === 0 ? 0 : blocks[i]!.section !== blocks[page[page.length - 1]!]!.section ? o.sectionGap : o.gap;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.breakBefore && page.length) newPage();

    const firstOfSection = page.length === 0 || blocks[page[page.length - 1]!]!.section !== b.section;
    if (firstOfSection && page.length) {
      const end = sectionEnd(blocks, i);
      const whole = stackHeight(blocks, i, end, o);
      const fitsHere = used + o.sectionGap + whole <= o.pageHeight;
      const fitsFresh = whole <= o.pageHeight;
      if (!fitsHere && fitsFresh && used / o.pageHeight >= keepFrom) newPage();
    }

    // A heading needs the next block beside it.
    let need = b.height;
    if (b.heading && i + 1 < blocks.length && !blocks[i + 1]!.breakBefore) {
      need = stackHeight(blocks, i, i + 2, o);
    }
    if (page.length && used + spaceBefore(i) + need > o.pageHeight) newPage();

    used += spaceBefore(i) + b.height;
    page.push(i);
  }
  newPage();
  return pages;
}
