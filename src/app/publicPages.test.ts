import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOME_PAGE, PUBLIC_PAGES, SITE_ORIGIN, pageHtml, sitemapXml } from './publicPages';

const INDEX = readFileSync('index.html', 'utf8');
const ROUTER = readFileSync('src/app/router.tsx', 'utf8');

describe('public pages', () => {
  it('are all real routes outside the account gate', () => {
    for (const page of PUBLIC_PAGES.filter((p) => p.path !== '/')) {
      expect(ROUTER).toContain(`path: '${page.path.slice(1)}'`);
    }
  });

  it('have titles and descriptions search results can show in full', () => {
    for (const page of PUBLIC_PAGES) {
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeGreaterThanOrEqual(50);
      expect(page.description.length).toBeLessThanOrEqual(160);
    }
    expect(new Set(PUBLIC_PAGES.map((p) => p.title)).size).toBe(PUBLIC_PAGES.length);
  });

  it('builds a sitemap of the listed pages on the new domain', () => {
    const xml = sitemapXml();
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/terms</loc>`);
    expect(xml).not.toContain('/sign-in<');
  });

  it('gives each page its own head and keeps the home page off other pages', () => {
    const terms = pageHtml(INDEX, PUBLIC_PAGES.find((p) => p.path === '/terms')!);
    expect(terms).toContain('<title>Terms and conditions | Overload</title>');
    expect(terms).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/terms" />`);
    expect(terms).toContain(`<meta property="og:url" content="${SITE_ORIGIN}/terms" />`);
    expect(terms).not.toContain('id="landing"');
    expect(terms).toContain('<div id="root"></div>');

    const home = pageHtml(INDEX, HOME_PAGE);
    expect(home).toContain('id="landing"');
    expect(home).toContain(`<title>${HOME_PAGE.title}</title>`);
  });

  it('matches what index.html says for the home page', () => {
    expect(pageHtml(INDEX, HOME_PAGE)).toBe(INDEX);
  });

  it('fails loudly if index.html loses a tag it must replace', () => {
    expect(() => pageHtml('<html></html>', HOME_PAGE)).toThrow();
  });
});
