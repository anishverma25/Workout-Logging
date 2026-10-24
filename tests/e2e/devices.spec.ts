/**
 * Every main page on an iPhone 16 (393 px) and a small Galaxy (360 px) screen: nothing runs off
 * the side, the avatar stays beside the title, and the title is clear of the top edge.
 */
import { expect, test } from '@playwright/test';
import { startWithDemo } from './session';
const pages = [
  '/',
  '/food',
  '/activity',
  '/progress',
  '/history',
  '/routines',
  '/workout',
  '/more',
  '/body',
  '/records',
  '/settings',
  '/journey',
  '/badges',
  '/exercises',
  '/science',
  '/pro',
  '/coach',
  '/profile',
  '/feedback',
];
for (const [name, w, h] of [
  ['iphone16', 393, 852],
  ['galaxy', 360, 780],
] as const) {
  test('fits on ' + name, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: w, height: h });
    await startWithDemo(page);
    const problems: string[] = [];
    for (const p of pages) {
      await page.goto(p);
      await page.waitForLoadState('networkidle');
      const r = await page.evaluate(() => {
        const vw = window.innerWidth;
        const out: string[] = [];
        if (document.documentElement.scrollWidth > vw) out.push('page scrolls sideways');
        document
          .querySelectorAll('main button, main a, main h1, main h2, main h3, main p, main span')
          .forEach((el) => {
            const b = el.getBoundingClientRect();
            if (!b.width) return;
            if (el.closest('[data-scroll-x], .overflow-x-auto')) return;
            if (b.right > vw + 0.5 || b.left < -0.5)
              out.push('off screen: ' + (el.textContent || '').trim().slice(0, 30));
          });
        // The avatar must sit on the same line as the start of the title.
        const h1 = [...document.querySelectorAll('main h1')].find(
          (e) => e.getBoundingClientRect().width > 0,
        );
        const av = document.querySelector('main header a[href="/more"]');
        if (h1 && av) {
          const a = av.getBoundingClientRect(),
            t = h1.getBoundingClientRect();
          if (a.top > t.top + 12) out.push('avatar below title');
        }
        if (h1 && h1.getBoundingClientRect().top < 20)
          out.push('title too close to top: ' + Math.round(h1.getBoundingClientRect().top));
        return [...new Set(out)].slice(0, 6);
      });
      if (r.length) problems.push(p + ': ' + r.join(' | '));
    }
    expect(problems).toEqual([]);
  });
}
