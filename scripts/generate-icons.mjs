// Renders the app icons from the brand mark with Chromium (Playwright). Run once after
// changing the mark: `node scripts/generate-icons.mjs`. Output goes to public/icons.
import { chromium } from '@playwright/test';

const BG = '#000000';
const ACCENT = '#C6F432';

/** The rising bars, drawn in a 64-unit box; `pad` shrinks them into the maskable safe zone. */
function svg({ size, rounded, pad }) {
  const scale = (64 - pad * 2) / 64;
  const bars = [
    { x: 14, y: 36, h: 14, o: 0.45 },
    { x: 28, y: 26, h: 24, o: 0.7 },
    { x: 42, y: 14, h: 36, o: 1 },
  ]
    .map(
      (b) =>
        `<rect x="${b.x}" y="${b.y}" width="8" height="${b.h}" rx="2" fill="${ACCENT}" opacity="${b.o}"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="${rounded ? 16 : 0}" fill="${BG}"/>
    <g transform="translate(${pad} ${pad}) scale(${scale})">${bars}</g>
  </svg>`;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, rounded: true, pad: 0 },
  { file: 'icon-512.png', size: 512, rounded: true, pad: 0 },
  // Maskable: full-bleed background, artwork inside the central 80% safe zone.
  { file: 'icon-maskable-512.png', size: 512, rounded: false, pad: 9 },
  // iOS applies its own rounding and dislikes transparency.
  { file: 'apple-touch-icon.png', size: 180, rounded: false, pad: 4 },
];

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(icon)}</body></html>`,
  );
  await page.locator('svg').screenshot({ path: `public/icons/${icon.file}`, omitBackground: true });
  console.log(`public/icons/${icon.file}`);
}
await browser.close();
