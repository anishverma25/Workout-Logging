// Builds every app icon from the Macrotrophy mark (`public/landing/mark.svg`, traced from the
// brand artwork): the favicon and in-app logo (`public/icon.svg`, `public/favicon.svg`) and the
// PNG icons, rendered with Chromium (Playwright). Run after changing the mark:
// `node scripts/generate-icons.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const mark = readFileSync('public/landing/mark.svg', 'utf8')
  .replace(/^<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');

/** The mark on a near-black square with a faint lime glow in two corners, as in the artwork. */
function icon({ width, rx }) {
  const glow = (id, at, o) =>
    `<radialGradient id="${id}" cx="${at}" cy="${at}" r="0.7"><stop offset="0" stop-color="#C6F432" stop-opacity="${o}"/><stop offset="1" stop-color="#C6F432" stop-opacity="0"/></radialGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${glow('a', 0, 0.18)}${glow('b', 1, 0.14)}</defs>
<rect width="512" height="512" rx="${rx}" fill="#050505"/><rect width="512" height="512" rx="${rx}" fill="url(#a)"/><rect width="512" height="512" rx="${rx}" fill="url(#b)"/>
<g transform="translate(256 262) scale(${(width / 100).toFixed(3)})">${mark}</g>
</svg>
`;
}

const rounded = icon({ width: 370, rx: 112 });
writeFileSync('public/icon.svg', rounded);
writeFileSync('public/favicon.svg', rounded);

const ICONS = [
  { file: 'icon-192.png', size: 192, svg: rounded },
  { file: 'icon-512.png', size: 512, svg: rounded },
  // Maskable: full-bleed background, the mark inside the central 80% safe zone.
  { file: 'icon-maskable-512.png', size: 512, svg: icon({ width: 290, rx: 0 }) },
  // iOS applies its own rounding and dislikes transparency.
  { file: 'apple-touch-icon.png', size: 180, svg: icon({ width: 340, rx: 0 }) },
];

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
for (const i of ICONS) {
  await page.setViewportSize({ width: i.size, height: i.size });
  const svg = i.svg.replace('<svg ', `<svg width="${i.size}" height="${i.size}" `);
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: `public/icons/${i.file}`, omitBackground: true });
  console.log(`public/icons/${i.file}`);
}
await browser.close();
