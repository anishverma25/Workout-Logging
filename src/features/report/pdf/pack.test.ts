import { packPages, type PackBlock } from './pack';

const O = { pageHeight: 700, gap: 10, sectionGap: 30 };

function heightOf(blocks: PackBlock[], page: number[]) {
  let h = 0;
  page.forEach((i, k) => {
    if (k) h += blocks[i]!.section !== blocks[page[k - 1]!]!.section ? O.sectionGap : O.gap;
    h += blocks[i]!.height;
  });
  return h;
}

describe('packPages', () => {
  it('keeps every block whole, in order, and within the page', () => {
    const blocks: PackBlock[] = Array.from({ length: 30 }, (_, i) => ({
      height: 40 + ((i * 37) % 260),
      section: `s${Math.floor(i / 3)}`,
      heading: i % 3 === 0,
    }));
    const pages = packPages(blocks, O);
    expect(pages.flat()).toEqual(blocks.map((_, i) => i));
    for (const p of pages) expect(heightOf(blocks, p)).toBeLessThanOrEqual(O.pageHeight);
  });

  it('never leaves a heading last on a page', () => {
    const blocks: PackBlock[] = [
      { height: 620, section: 'a' },
      { height: 40, section: 'b', heading: true },
      { height: 200, section: 'b' },
    ];
    const pages = packPages(blocks, O);
    expect(pages).toEqual([[0], [1, 2]]);
  });

  it('starts a section on the next page when it fits whole there and this page is well filled', () => {
    const blocks: PackBlock[] = [
      { height: 580, section: 'a' },
      { height: 40, section: 'b', heading: true },
      { height: 40, section: 'b' },
      { height: 200, section: 'b' },
    ];
    expect(packPages(blocks, O)).toEqual([[0], [1, 2, 3]]);
  });

  it('fills a sparse page instead of moving a section', () => {
    const blocks: PackBlock[] = [
      { height: 150, section: 'a' },
      { height: 40, section: 'b', heading: true },
      { height: 300, section: 'b' },
      { height: 300, section: 'b' },
    ];
    // Page one is only about a quarter full, so section b starts there.
    expect(packPages(blocks, O)).toEqual([[0, 1, 2], [3]]);
  });

  it('honours page breaks and is deterministic', () => {
    const blocks: PackBlock[] = [
      { height: 100, section: 'cover' },
      { height: 100, section: 'x', breakBefore: true },
    ];
    expect(packPages(blocks, O)).toEqual([[0], [1]]);
    expect(packPages(blocks, O)).toEqual(packPages(blocks, O));
  });
});
