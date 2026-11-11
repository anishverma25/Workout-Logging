import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sampleReport } from '../reportFixture';
import { makeReportPdf, type PdfFontBytes } from './makePdf';

/**
 * The PDF from a realistic week: it opens, has the cover and page footers, keeps every section
 * heading on one page, and stays in the planned page counts. Set REPORT_PDF_OUT to a folder to
 * keep the files for a look by eye.
 */

const file = (p: string) => readFileSync(join('node_modules', p));
const fonts: PdfFontBytes = {
  display600: file('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-600-normal.woff'),
  display800: file('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff'),
  sans400: file('@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff'),
  sans600: file('@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff'),
  mono400: file('@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff'),
  mono500: file('@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff'),
};

const OUT = process.env.REPORT_PDF_OUT;

function hasPdfToText() {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Text of each page, from poppler when the machine has it. */
function pagesText(bytes: Uint8Array, name: string): string[] | null {
  if (!hasPdfToText()) return null;
  const dir = OUT ?? join(process.cwd(), 'node_modules', '.cache', 'report-pdf');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.pdf`);
  writeFileSync(path, bytes);
  const txt = execFileSync('pdftotext', ['-layout', path, '-']).toString();
  return txt.split('\f').filter((p) => p.trim());
}

const sections = (full: boolean) =>
  full
    ? ['Your week in numbers', "Last week's plan", 'Training meets food', 'What both logs say together', 'Strength', 'Training volume', 'Body and energy', 'Nutrition', 'Next week', 'Make it yours', 'How this was made']
    : ['Your week in numbers', "Last week's plan", 'Training meets food', 'What we noticed', 'Next week'];

describe('weekly report PDF', () => {
  for (const mode of ['full', 'quick'] as const)
    for (const theme of ['dark', 'light'] as const)
      it(`${mode} ${theme}: whole sections on their pages, numbered pages`, async () => {
        const report = sampleReport();
        const bytes = await makeReportPdf({ report, number: 3, mode, lang: 'en', theme, fonts });
        expect(bytes.length).toBeGreaterThan(10_000);
        const pages = pagesText(bytes, `${mode}-${theme}`);
        if (!pages) return;
        const total = pages.length;
        if (mode === 'full') expect(total).toBeGreaterThanOrEqual(5);
        if (mode === 'full') expect(total).toBeLessThanOrEqual(10);
        if (mode === 'quick') expect(total).toBeLessThanOrEqual(4);
        if (mode === 'full') expect(total).toBeLessThanOrEqual(9);
        pages.forEach((p, i) => expect(p).toContain(`Page ${i + 1} of ${total}`));
        expect(pages[0]).toContain('Macrotrophy');
        expect(pages[0]).toContain(report.verdict.en.split(' ').slice(0, 3).join(' '));
        for (const s of sections(mode === 'full')) {
          if (s === "Last week's plan" && !report.lastWeek) continue;
          const on = pages.filter((p) => p.split('\n').some((line) => line.trim() === s || line.trim().startsWith(`${s}  `)));
          expect(on.length, s).toBe(1);
        }
      }, 30_000);

  it('a thin week leaves parts out and still lays out', async () => {
    const report = sampleReport({ thin: true });
    const bytes = await makeReportPdf({ report, number: 1, mode: 'full', lang: 'hi', theme: 'dark', fonts });
    const pages = pagesText(bytes, 'thin');
    if (!pages) return;
    expect(pages.join('')).toContain(report.verdict.hi.split(' ').slice(0, 2).join(' '));
  }, 30_000);
});
