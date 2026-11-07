import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENTS } from '@/features/legal/documents';
import { INSTAGRAM_URL, LAST_UPDATED, SUPPORT_EMAIL } from '@/features/legal/contact';
import { SCIENCE } from '@/features/science/topics';
import { SCIENCE_HEADING, legalDocument, legalHtml, scienceHtml } from './staticPages';

describe('plain HTML of the legal pages', () => {
  it('carries every heading, paragraph and item of each document, once', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const html = legalHtml(doc);
      expect(legalDocument(`/${doc.slug}`)).toBe(doc);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toContain(`<h1>${doc.title}</h1>`);
      expect(html).toContain(`Last updated ${LAST_UPDATED}`);
      for (const s of doc.sections) {
        expect(html).toContain(`<h2>${s.heading.replace(/&/g, '&amp;')}</h2>`);
        for (const p of [...(s.paragraphs ?? []), ...(s.items ?? [])])
          expect(html).toContain(p.replace(/&/g, '&amp;').replace(/"/g, '&quot;'));
      }
    }
  });
  it('gives the contact page its email and Instagram links', () => {
    const html = legalHtml(legalDocument('/contact')!);
    expect(html).toContain(`href="mailto:${SUPPORT_EMAIL}"`);
    expect(html).toContain(`href="${INSTAGRAM_URL}"`);
  });
});

describe('plain HTML of the science page', () => {
  it('lists every group and topic under one heading, escaping text', () => {
    const groups = SCIENCE.map((g) => ({
      title: g.title,
      topics: g.topics.map((t) => ({
        id: t.id,
        title: t.title,
        body: '<p>x</p>',
        formulas: ['a < b'],
      })),
    }));
    const html = scienceHtml(groups);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain(`<h1>${SCIENCE_HEADING}</h1>`);
    for (const g of SCIENCE) {
      expect(html).toContain(`<h2>${g.title}</h2>`);
      for (const t of g.topics) expect(html).toContain(`<section id="${t.id}"><h3>`);
    }
    expect(html).toContain('<li>a &lt; b</li>');
  });
});
