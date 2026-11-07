/**
 * Plain HTML for public pages that the app otherwise draws with scripts (the science page and
 * the legal pages), written into `#root` by the build, so search engines read the text without
 * running anything. The app replaces it with the real page when it starts, and the opening mark
 * covers it until then, so people never see it. Guides do the same with `guideHtml`.
 *
 * Only relative imports and no browser APIs here: the build reads this file from Node.
 */

import {
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  LAST_UPDATED,
  OWNER_NAME,
  SUPPORT_EMAIL,
} from '../features/legal/contact';
import { LEGAL_DOCUMENTS, type LegalDocument } from '../features/legal/documents';
import { BRAND } from './marketing';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const backLinks = `<p><a href="/sign-up">Create free account</a> · <a href="/">${BRAND}</a> · <a href="/science">The science</a></p>`;

export function legalDocument(path: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((d) => `/${d.slug}` === path);
}

/** A legal page as plain HTML: the same title, date, sections and contact details as the app. */
export function legalHtml(doc: LegalDocument): string {
  const contact =
    doc.slug === 'contact'
      ? `<p>${esc(doc.summary)}</p><ul><li>Run by ${esc(OWNER_NAME)}, India</li><li>Email: <a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a></li><li>Instagram: <a href="${esc(INSTAGRAM_URL)}">${esc(INSTAGRAM_HANDLE)}</a></li></ul>`
      : '';
  const sections = doc.sections
    .map(
      (s) =>
        `<h2>${esc(s.heading)}</h2>` +
        (s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('') +
        (s.items ? `<ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''),
    )
    .join('');
  return `<main data-static-page><h1>${esc(doc.title)}</h1><p>Last updated ${esc(LAST_UPDATED)}</p>${contact}${sections}${backLinks}</main>`;
}

/** One science topic with its text already turned into HTML by the build. */
export interface StaticTopic {
  id: string;
  title: string;
  /** HTML (from the topic's React content, rendered at build time). */
  body: string;
  /** What each formula says, in words. */
  formulas: string[];
}

export interface StaticTopicGroup {
  title: string;
  topics: StaticTopic[];
}

export const SCIENCE_HEADING = 'How every number is calculated';
export const SCIENCE_INTRO =
  'Every number in Macrotrophy, the formula behind it and the research it rests on. Read a section, follow a source, and judge it for yourself.';

/** The science page as plain HTML: every group, topic, formula (in words) and explanation. */
export function scienceHtml(groups: StaticTopicGroup[]): string {
  const body = groups
    .map(
      (g) =>
        `<h2>${esc(g.title)}</h2>` +
        g.topics
          .map(
            (t) =>
              `<section id="${esc(t.id)}"><h3>${esc(t.title)}</h3>${t.body}` +
              (t.formulas.length
                ? `<ul>${t.formulas.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`
                : '') +
              '</section>',
          )
          .join(''),
    )
    .join('');
  return `<main data-static-page><h1>${esc(SCIENCE_HEADING)}</h1><p>${esc(SCIENCE_INTRO)}</p>${body}${backLinks}</main>`;
}
