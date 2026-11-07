import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUIDES, fillLanding, guideHtml } from './marketing';
import { HOME_PAGE, PUBLIC_PAGES, SITE_ORIGIN, pageHtml, sitemapXml } from './publicPages';

const INDEX = fillLanding(readFileSync('index.html', 'utf8'));
const ROUTER = readFileSync('src/app/router.tsx', 'utf8');

describe('public pages', () => {
  it('are all real routes outside the account gate', () => {
    const guides = new Set(GUIDES.map((g) => g.path));
    for (const page of PUBLIC_PAGES.filter((p) => p.path !== '/' && !guides.has(p.path))) {
      expect(ROUTER).toContain(`path: '${page.path.slice(1)}'`);
    }
    // Guides get their routes from the same list, above the account gate.
    expect(ROUTER.indexOf('...GUIDES.map(')).toBeGreaterThan(0);
    expect(ROUTER.indexOf('...GUIDES.map(')).toBeLessThan(ROUTER.indexOf('<RequireAccount />'));
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
    const terms = pageHtml(
      INDEX,
      PUBLIC_PAGES.find((p) => p.path === '/terms')!,
    );
    expect(terms).toContain('<title>Terms and conditions | Macrotrophy</title>');
    expect(terms).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/terms" />`);
    expect(terms).toContain(`<meta property="og:url" content="${SITE_ORIGIN}/terms" />`);
    expect(terms).not.toContain('id="landing"');
    expect(terms).toContain('<div id="root"></div>');

    const home = pageHtml(INDEX, HOME_PAGE);
    expect(home).toContain('id="landing"');
    expect(home).toContain(`<title>${HOME_PAGE.title}</title>`);
  });

  it('matches what index.html says for the home page, adding only the structured data', () => {
    const home = pageHtml(INDEX, HOME_PAGE);
    const data = /\s*<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(home);
    expect(data).not.toBeNull();
    expect(home.replace(data![0], '')).toBe(INDEX);
    const parsed = JSON.parse(data![1]!) as { '@type': string; name?: string }[];
    expect(parsed.map((d) => d['@type'])).toEqual([
      'Organization',
      'WebSite',
      'SoftwareApplication',
      'FAQPage',
    ]);
    expect(parsed[0]!.name).toBe('Macrotrophy');
  });

  it('writes each guide as plain HTML search engines can read without scripts', () => {
    for (const g of GUIDES) {
      const page = PUBLIC_PAGES.find((p) => p.path === g.path)!;
      const html = pageHtml(INDEX, page);
      expect(html).toContain(`<div id="root">${guideHtml(g)}</div>`);
      expect(html).toContain(`<title>${page.title}</title>`);
      expect(html).not.toContain('id="landing"');
      expect(guideHtml(g).match(/<h1>/g)).toHaveLength(1);
    }
  });

  it('fails loudly if index.html loses a tag it must replace', () => {
    expect(() => pageHtml('<html></html>', HOME_PAGE)).toThrow();
  });
});
