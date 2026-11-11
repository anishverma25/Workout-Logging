import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import type { Plugin } from 'vite';
import { fillLanding } from '../src/app/marketing.ts';
import { PUBLIC_PAGES, SCIENCE_PAGE, pageHtml, sitemapXml } from '../src/app/publicPages.ts';
import {
  legalDocument,
  legalHtml,
  scienceHtml,
  type StaticTopicGroup,
} from '../src/app/staticPages.ts';

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
    '/favicon.svg',
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
/**
 * Fills the home page's reviews, questions and guide links from src/app/marketing.ts, in the
 * dev server and the build alike, so tests and visitors see the same page.
 */
export function landingContent(): Plugin {
  return {
    name: 'overload-landing-content',
    transformIndexHtml: { order: 'pre', handler: (html) => fillLanding(html) },
  };
}

export function seo(): Plugin {
  return {
    name: 'overload-seo',
    apply: 'build',
    async writeBundle(options) {
      const dir = options.dir ?? 'dist';
      const index = readFileSync(join(dir, 'index.html'), 'utf8');
      const science = scienceHtml(await scienceGroups());
      for (const page of PUBLIC_PAGES) {
        const file = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
        const legal = legalDocument(page.path);
        const body =
          page.path === SCIENCE_PAGE.path ? science : legal ? legalHtml(legal) : undefined;
        writeFileSync(join(dir, file), pageHtml(index, page, body));
      }
      writeFileSync(join(dir, 'sitemap.xml'), sitemapXml());
      writeFileSync(join(dir, '_routes.json'), `${JSON.stringify(FUNCTION_ROUTES, null, 2)}\n`);
    },
  };
}

/**
 * The science topics with their text as HTML. They are React content (`src/features/science/
 * topics.tsx`), so a short-lived Vite server loads them and React renders them to markup.
 */
async function scienceGroups(): Promise<StaticTopicGroup[]> {
  const { createServer } = await import('vite');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement, Fragment } = await import('react');
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    // Its own cache, so it never races the dev server's dependency optimizer (which would
    // leave the app asking for stale pre-bundled files).
    cacheDir: 'node_modules/.vite-seo',
    optimizeDeps: { noDiscovery: true },
    logLevel: 'error',
  });
  try {
    const { SCIENCE } = (await server.ssrLoadModule('/src/features/science/topics.tsx')) as {
      SCIENCE: {
        title: string;
        topics: {
          id: string;
          title: string;
          shows: ReactNode;
          why?: ReactNode[];
          forYou?: ReactNode;
          limits?: ReactNode;
          formulas?: { spoken: string; where?: string }[];
        }[];
      }[];
    };
    const html = (n: ReactNode) =>
      n == null || n === false ? '' : renderToStaticMarkup(createElement(Fragment, null, n));
    const para = (n: ReactNode) => (html(n) ? `<p>${html(n)}</p>` : '');
    return SCIENCE.map((g) => ({
      title: g.title,
      topics: g.topics.map((t) => ({
        id: t.id,
        title: t.title,
        body: para(t.shows) + (t.why ?? []).map(para).join('') + para(t.forYou) + para(t.limits),
        formulas: (t.formulas ?? []).map((f) => (f.where ? `${f.spoken}, ${f.where}` : f.spoken)),
      })),
    }));
  } finally {
    await server.close();
  }
}
