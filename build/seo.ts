import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { PUBLIC_PAGES, pageHtml, sitemapXml } from '../src/app/publicPages.ts';

/**
 * Cloudflare Pages `_routes.json`: which requests run `functions/_middleware.ts` (the 301 from
 * the old address). Pages and their HTML only. Never `/sw.js`: a service worker cannot be
 * redirected, and installed apps on the old address must keep getting updates so they can move
 * themselves once their changes are saved (src/app/layout/MoveToNewHome.tsx).
 */
export const FUNCTION_ROUTES = {
  version: 1,
  include: ['/*'],
  exclude: [
    '/assets/*',
    '/fonts/*',
    '/icons/*',
    '/landing/*',
    '/sw.js',
    '/manifest.webmanifest',
    '/icon.svg',
    '/og-image.png',
    '/robots.txt',
    '/sitemap.xml',
  ],
};

/**
 * After the build: one HTML file per public page (its own title, description and canonical
 * address, so search engines and link previews see the right ones without running scripts),
 * the sitemap, and the Pages Functions routes. Cloudflare Pages serves `/terms` from
 * `terms.html`; every other address still gets index.html, as before.
 */
export function seo(): Plugin {
  return {
    name: 'overload-seo',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir ?? 'dist';
      const index = readFileSync(join(dir, 'index.html'), 'utf8');
      for (const page of PUBLIC_PAGES) {
        const file = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
        writeFileSync(join(dir, file), pageHtml(index, page));
      }
      writeFileSync(join(dir, 'sitemap.xml'), sitemapXml());
      writeFileSync(join(dir, '_routes.json'), `${JSON.stringify(FUNCTION_ROUTES, null, 2)}\n`);
    },
  };
}
