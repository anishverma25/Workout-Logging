import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:5175/welcome');
await p.waitForTimeout(1200);
for (let i = 0; i < 8; i++) { await p.getByRole('button', { name: /Take the tour|Next/ }).click(); await p.waitForTimeout(450); }
await p.waitForTimeout(2500);
await p.screenshot({ path: '/tmp/claude-0/shots/20-reviews.png' });
await p.waitForTimeout(3500);
await p.screenshot({ path: '/tmp/claude-0/shots/21-reviews-next.png' });
await browser.close();
