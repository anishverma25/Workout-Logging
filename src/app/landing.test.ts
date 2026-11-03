import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { ROUTINE_TEMPLATES } from '@/data/library/templates';
import { FREE_FEATURES, PRO_FEATURES } from '@/domain/entitlement/entitlement';
import { LANDING_ATTR, wantsLanding } from './landing';
import { REGULAR_PRICE_INR } from './billing';
import {
  COACHING_PRICE,
  FAQ,
  PUBLIC_PRICES,
  REVIEWS,
  SURVEY_RATINGS,
  averageRating,
  fillLanding,
} from './marketing';
import { PUBLIC_PAGES } from './publicPages';

const INDEX = fillLanding(readFileSync('index.html', 'utf8'));
const LANDING = INDEX.slice(
  INDEX.indexOf('<!-- landing:start -->'),
  INDEX.indexOf('<!-- landing:end -->'),
);
const BOOT = /<script>([\s\S]*?)<\/script>/.exec(INDEX)?.[1] ?? '';

function fakeStorage(entries: Record<string, string>) {
  const keys = Object.keys(entries);
  return {
    get length() {
      return keys.length;
    },
    key: (i: number) => keys[i] ?? null,
    getItem: (k: string) => entries[k] ?? null,
    setItem: () => {},
    removeItem: () => {},
  };
}

/** Runs index.html's head script and reports whether it showed the home page. */
function bootShows(pathname: string, storage: ReturnType<typeof fakeStorage>): boolean {
  let shown = false;
  runInNewContext(BOOT, {
    location: { pathname },
    localStorage: storage,
    document: {
      documentElement: {
        setAttribute: (name: string) => {
          if (name === LANDING_ATTR) shown = true;
        },
      },
    },
  });
  return shown;
}

const CASES: [string, string, Record<string, string>][] = [
  ['first visit at home', '/', {}],
  ['first visit elsewhere', '/history', {}],
  ['finished the tour', '/', { 'overload.seenTour': '1' }],
  ['signed in', '/', { 'sb-abcdef-auth-token': '{}' }],
  ['only a sign-in code waiting', '/', { 'sb-abcdef-auth-token-code-verifier': 'x' }],
  ['other app data', '/', { 'overload.whatsNew': 'x' }],
];

describe('public home page', () => {
  const original = globalThis.localStorage;
  afterEach(() => {
    globalThis.localStorage = original;
  });

  it.each(CASES)('head script and app agree: %s', (_name, path, entries) => {
    const storage = fakeStorage(entries);
    globalThis.localStorage = storage as unknown as Storage;
    expect(bootShows(path, storage)).toBe(wantsLanding(path));
  });

  it('shows only to a first visit at home', () => {
    expect(CASES.filter(([, p, e]) => bootShows(p, fakeStorage(e))).map(([n]) => n)).toEqual([
      'first visit at home',
      'only a sign-in code waiting',
      'other app data',
    ]);
  });

  it('states counts that match the app', () => {
    const count = (name: string) =>
      Number(new RegExp(`data-count="${name}">(\\d+)<`).exec(LANDING)?.[1]);
    expect(count('exercises')).toBe(SYSTEM_EXERCISES.length);
    expect(count('templates')).toBe(ROUTINE_TEMPLATES.length);
  });

  it('lists only real Free and Pro features', () => {
    const list = (plan: string) => {
      const block = new RegExp(`data-plan="${plan}">([\\s\\S]*?)</ul>`).exec(LANDING)?.[1] ?? '';
      return [...block.matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1]);
    };
    expect(list('free').length).toBeGreaterThan(0);
    for (const item of list('free')) expect(FREE_FEATURES).toContain(item);
    const pro = Object.values(PRO_FEATURES).map((f) => f.title);
    expect(list('pro').length).toBeGreaterThan(0);
    for (const item of list('pro')) expect(pro).toContain(item);
  });

  it('has one main heading and no broken links or images', () => {
    expect(LANDING.match(/<h1[\s>]/g)).toHaveLength(1);
    const paths = PUBLIC_PAGES.map((p) => p.path);
    for (const [, href] of LANDING.matchAll(/href="([^"]+)"/g)) {
      if (href!.startsWith('#')) expect(LANDING).toContain(`id="${href!.slice(1)}"`);
      else expect(paths).toContain(href);
    }
    for (const [, src] of LANDING.matchAll(/(?:src|srcset)="([^"]+)"/g)) {
      for (const part of src!.split(',')) {
        expect(existsSync(`public${part.trim().split(' ')[0]}`)).toBe(true);
      }
    }
    for (const [, tag] of LANDING.matchAll(/(<img[^>]*>)/g)) {
      // Screens are described; the logo beside the name is decoration.
      if (/src="\/(landing\/mark|icon)\.svg"/.test(tag!)) expect(tag).toMatch(/alt="" aria-hidden="true"/);
      else expect(tag).toMatch(/alt="[^"]{10,}"/);
    }
  });

  it('shows the real prices, with the regular ones crossed out', () => {
    const seed = readFileSync('supabase/migrations/20261011000008_razorpay_billing.sql', 'utf8');
    for (const [id, price] of Object.entries(PUBLIC_PRICES)) {
      // The plans migration seeds the same price the server charges today.
      expect(seed).toMatch(new RegExp(`\\('${id}', '[^']+', \\d+, ${price},`));
      const card = new RegExp(`data-plan-price="${id}">([\\s\\S]*?)</li>`).exec(LANDING)?.[1] ?? '';
      expect(card).toContain(`₹${price}</span>`);
      expect(card).toContain(`<s class="type-meta text-text-3">₹${REGULAR_PRICE_INR[id as keyof typeof REGULAR_PRICE_INR]}</s>`);
    }
    expect(LANDING).toContain('₹23 a month');
    expect(Math.round(PUBLIC_PRICES.quarterly / 3)).toBe(23);
    expect(Math.round(PUBLIC_PRICES.yearly / 12)).toBe(21);
    expect(LANDING).toContain('₹21 a month');
    expect(LANDING).toContain(`<span data-price-from>${PUBLIC_PRICES.monthly}</span>`);
    expect(LANDING).toContain(`<span data-price-coaching>${COACHING_PRICE}</span>`);
    const coaching = readFileSync('supabase/migrations/20261031000018_coaching.sql', 'utf8');
    expect(coaching).toMatch(new RegExp(`'coach_monthly'[^)]*\\b${COACHING_PRICE}\\b`));
  });

  it('quotes only real member reviews, with the real average rating', () => {
    expect(averageRating()).toBe(4.9);
    for (const m of LANDING.matchAll(/data-rating>([\d.]+)</g)) expect(Number(m[1])).toBe(averageRating());
    expect(LANDING).toContain(`<span data-count="ratings">${SURVEY_RATINGS.length}</span>`);
    expect(LANDING.match(/data-review>/g)).toHaveLength(REVIEWS.length);
    for (const r of REVIEWS) {
      expect(r.rating).toBeGreaterThanOrEqual(4);
      expect(r.name).not.toMatch(/\s/);
    }
    for (const f of FAQ) expect(LANDING).toContain(`<dt class="type-headline">${f.q}</dt>`);
  });

  it('follows the copy rules', () => {
    expect(INDEX).not.toMatch(/—/);
  });
});
