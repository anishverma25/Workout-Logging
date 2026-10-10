import { chromium } from '@playwright/test';
const out = '/tmp/claude-0/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [w, h, tag] of [[390, 844, 'phone'], [1440, 900, 'desktop']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('http://localhost:5190/'); 
  await page.evaluate(() => sessionStorage.setItem('overload.dev.entitlement', 'pro'));
  for (const p of (process.argv[2]||'/progress').split(',')) {
    await page.goto('http://localhost:5190' + p); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
    const name = p.slice(1).replace(/[\/?=]/g, '-');
    await page.screenshot({ path: `${out}/${tag}-${name}.png`, fullPage: tag === 'phone' });
    console.log(tag, p, 'overflow', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  }
  await ctx.close();
}
await browser.close();
