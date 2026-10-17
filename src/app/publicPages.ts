/**
 * The pages anyone can open without an account, with what search engines and link previews
 * show for each. One list serves three places:
 *
 * - the build (`build/seo.ts`), which writes a copy of index.html per page with its own title,
 *   description and canonical address, and the sitemap;
 * - `usePageMeta`, which sets the same three in the browser as people move between pages;
 * - the tests, which keep the list, the router and the sitemap in step.
 *
 * Only relative imports and no browser APIs here: the build reads this file from Node.
 */

/** The one address search engines should know. Old and preview addresses point here. */
export const SITE_ORIGIN = 'https://overloadgym.in';

export interface PublicPage {
  path: string;
  /** The full title, as it shows in search results and the browser tab. */
  title: string;
  /** About 150 characters: the line under the title in search results. */
  description: string;
  /** Listed in sitemap.xml. Sign in and password pages are reachable but not worth listing. */
  inSitemap: boolean;
}

export const HOME_PAGE: PublicPage = {
  path: '/',
  title: 'Overload: workout log and strength progress tracker',
  description:
    'Log every set in seconds, see your strength, volume and records grow, and train with routines built on published research. Works offline. Free to start.',
  inSitemap: true,
};

export const PUBLIC_PAGES: PublicPage[] = [
  HOME_PAGE,
  {
    path: '/welcome',
    title: 'Take the tour | Overload',
    description:
      'See how Overload logs a workout, tracks your progress and celebrates your records, with sample data and no account needed.',
    inSitemap: true,
  },
  {
    path: '/sign-up',
    title: 'Create your account | Overload',
    description:
      'Create a free Overload account to log workouts, keep your training backed up and see your progress on every device.',
    inSitemap: true,
  },
  {
    path: '/sign-in',
    title: 'Sign in | Overload',
    description: 'Sign in to Overload to log your workouts and see your progress.',
    inSitemap: false,
  },
  {
    path: '/terms',
    title: 'Terms and conditions | Overload',
    description: 'The rules for using Overload, the workout log and progress tracker, in plain language.',
    inSitemap: true,
  },
  {
    path: '/privacy',
    title: 'Privacy policy | Overload',
    description: 'What Overload keeps about you and your training, why, and how you can remove it.',
    inSitemap: true,
  },
  {
    path: '/refunds',
    title: 'Cancellation and refund policy | Overload',
    description: 'How to cancel Overload Pro, and when a payment can be refunded.',
    inSitemap: true,
  },
  {
    path: '/contact',
    title: 'Contact us | Overload',
    description: 'How to reach the Overload team, by email or on Instagram.',
    inSitemap: true,
  },
];

export function publicPage(path: string): PublicPage | undefined {
  return PUBLIC_PAGES.find((p) => p.path === path);
}

/** sitemap.xml for the pages worth listing. No dates: a wrong date is worse than none. */
export function sitemapXml(pages: PublicPage[] = PUBLIC_PAGES): string {
  const urls = pages
    .filter((p) => p.inSitemap)
    .map((p) => `  <url><loc>${SITE_ORIGIN}${p.path}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * index.html for one public page: its title, description and canonical address (also in the
 * share preview tags), and without the landing page, which belongs to the home page only.
 * Throws if a tag it must replace is missing, so a changed index.html fails the build.
 */
export function pageHtml(indexHtml: string, page: PublicPage): string {
  const url = `${SITE_ORIGIN}${page.path}`;
  const replacements: [RegExp, string][] = [
    [/<title>[^<]*<\/title>/, `<title>${escapeAttr(page.title)}</title>`],
    [
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeAttr(page.description)}" />`,
    ],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${escapeAttr(page.title)}" />`,
    ],
    [
      /<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${escapeAttr(page.title)}" />`,
    ],
    [
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${escapeAttr(page.description)}" />`,
    ],
    [
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
      `<meta name="twitter:description" content="${escapeAttr(page.description)}" />`,
    ],
  ];
  let html = indexHtml;
  for (const [pattern, value] of replacements) {
    if (!pattern.test(html)) throw new Error(`index.html is missing ${pattern}`);
    html = html.replace(pattern, value);
  }
  if (page.path === '/') return html;
  const landing = /\s*<!-- landing:start -->[\s\S]*<!-- landing:end -->/;
  if (!landing.test(html)) throw new Error('index.html is missing the landing markers');
  return html.replace(landing, '');
}
