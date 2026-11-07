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

import { GUIDES, SITE_ORIGIN, guideHtml, guide, structuredData } from './marketing';

export { SITE_ORIGIN };

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
  title: 'Macrotrophy: Workout Tracker, Indian Food Calorie Counter',
  description:
    'Log every set and every Indian meal in one app. Track strength, calories and protein, compete with friends, and trust every number. Free to start.',
  inSitemap: true,
};

/** The science page, open to everyone: every formula in the app and the research behind it. */
export const SCIENCE_PAGE: PublicPage = {
  path: '/science',
  title: 'The science behind every number | Macrotrophy',
  description:
    'Estimated one rep max, hard sets, volume, body weight trend, calories and protein: the formula behind every number in Macrotrophy and the research it rests on.',
  inSitemap: true,
};

export const PUBLIC_PAGES: PublicPage[] = [
  HOME_PAGE,
  SCIENCE_PAGE,
  ...GUIDES.map((g) => ({
    path: g.path,
    title: g.title,
    description: g.description,
    inSitemap: true,
  })),
  {
    path: '/welcome',
    title: 'Take the tour | Macrotrophy',
    description:
      'See how Macrotrophy logs workouts and Indian meals, tracks your progress and coaches you with Macrotrophy AI, using sample data and no account.',
    inSitemap: true,
  },
  {
    path: '/sign-up',
    title: 'Create your account | Macrotrophy',
    description:
      'Create a free Macrotrophy account to log workouts, keep your training backed up and see your progress on every device.',
    inSitemap: true,
  },
  {
    path: '/sign-in',
    title: 'Sign in | Macrotrophy',
    description: 'Sign in to Macrotrophy to log your workouts and see your progress.',
    inSitemap: false,
  },
  {
    path: '/terms',
    title: 'Terms and conditions | Macrotrophy',
    description:
      'The rules for using Macrotrophy, the workout log and progress tracker, in plain language.',
    inSitemap: true,
  },
  {
    path: '/privacy',
    title: 'Privacy policy | Macrotrophy',
    description:
      'What Macrotrophy keeps about you and your training, why, and how you can remove it.',
    inSitemap: true,
  },
  {
    path: '/refunds',
    title: 'Cancellation and refund policy | Macrotrophy',
    description: 'How to cancel Macrotrophy Pro, and when a payment can be refunded.',
    inSitemap: true,
  },
  {
    path: '/contact',
    title: 'Contact us | Macrotrophy',
    description: 'How to reach the Macrotrophy team, by email or on Instagram.',
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
  if (page.path === '/') {
    if (!html.includes('</head>')) throw new Error('index.html is missing </head>');
    return html.replace('</head>', `    ${structuredData()}\n  </head>`);
  }
  const landing = /\s*<!-- landing:start -->[\s\S]*<!-- landing:end -->/;
  if (!landing.test(html)) throw new Error('index.html is missing the landing markers');
  html = html.replace(landing, '');
  const g = guide(page.path);
  if (g) {
    if (!html.includes('<div id="root"></div>')) throw new Error('index.html is missing #root');
    html = html.replace('<div id="root"></div>', `<div id="root">${guideHtml(g)}</div>`);
  }
  return html;
}
