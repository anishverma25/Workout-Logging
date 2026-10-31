/**
 * Every main page on an iPhone 16 (393 px) and a small Galaxy (360 px) screen: nothing runs off
 * the side, the avatar stays beside the title, the title is clear of the top edge, and no two
 * buttons or links sit on top of each other (UI v3).
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
        // No tappable thing may cover another: overlapping buttons mean a mistap on a phone.
        const taps = [...document.querySelectorAll('main button, main a')]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            const st = getComputedStyle(el);
            return (
              b.width > 0 && b.height > 0 && st.visibility !== 'hidden' && !el.closest('.sr-only')
            );
          })
          .slice(0, 250);
        for (let i = 0; i < taps.length; i++) {
          for (let j = i + 1; j < taps.length; j++) {
            const x = taps[i]!,
              y = taps[j]!;
            if (x.contains(y) || y.contains(x)) continue;
            const a = x.getBoundingClientRect(),
              b = y.getBoundingClientRect();
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const hh = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 4 && hh > 4)
              out.push(
                'overlap: ' +
                  (x.textContent || x.getAttribute('aria-label') || '').trim().slice(0, 20) +
                  ' / ' +
                  (y.textContent || y.getAttribute('aria-label') || '').trim().slice(0, 20),
              );
          }
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
