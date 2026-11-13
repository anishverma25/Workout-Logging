/**
 * What the public pages say about Macrotrophy: member reviews, the questions on the home page,
 * the guide pages for what people search for, and the structured data search engines read.
 * One source for three places: the build (index.html and each guide's own HTML, readable before
 * any script runs), the app (the same guides as pages) and the tests.
 *
 * Only relative imports and no browser APIs here: the build reads this file from Node.
 */

import { INSTAGRAM_URL, SUPPORT_EMAIL } from '../features/legal/contact';

/** The one address search engines should know. Old and preview addresses point here. */
export const SITE_ORIGIN = 'https://macrotrophy.in';

export const BRAND = 'Macrotrophy';
export const TAGLINE = 'Your workouts and your Indian meals, in one app.';

/**
 * Every rating from the member survey (Google Form, 31 October to 2 November 2026), in order.
 * The home page shows their average, so it can only change when real answers are added here.
 */
export const SURVEY_RATINGS = [5, 5, 5, 4, 5, 5, 5, 5, 5, 5, 5, 5];

export const averageRating = (ratings: number[] = SURVEY_RATINGS) =>
  Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;

export interface Review {
  /** First name only. */
  name: string;
  rating: number;
  /** The member's own words from the survey, with spelling and punctuation tidied. */
  quote: string;
}

/** The reviews on the home page, chosen from the survey answers above. */
export const REVIEWS: Review[] = [
  {
    name: 'Satyam',
    rating: 5,
    quote:
      'Imported all my data from Hevy and the experience has been very smooth. Macrotrophy has every tracking feature that is necessary, and the best part is both workout and food tracking in the same app. The workout tracking is seamless, with data points and suggestions to decide how much to lift next workout. It has become my go-to app.',
  },
  {
    name: 'Aryan',
    rating: 5,
    quote:
      'Best possible app I could find in the market right now. It helps me track my RIR, calories and my 1 rep max, and even gives me a personalised plan for working out.',
  },
  {
    name: 'Priyanshu',
    rating: 5,
    quote:
      'It makes it easy to keep track of exercises, monitor progress and manage daily food intake. I especially like having both fitness and nutrition tracking in one place. The interface is simple and everything is easy to navigate.',
  },
  {
    name: 'Prince',
    rating: 5,
    quote:
      'Whether it is tracking progress or calories, Macrotrophy makes it so convenient and easy. A solid 11/10 for those who want to step up their tracking game.',
  },
  {
    name: 'Tiyas',
    rating: 5,
    quote:
      'Really great features, very helpful for people who are serious about their training. You can track food, workouts, almost everything.',
  },
  {
    name: 'Mayukh',
    rating: 5,
    quote:
      'Excellent app! Smooth, user-friendly and packed with amazing features. Love the experience!',
  },
  {
    name: 'Naman',
    rating: 5,
    quote:
      'The app is well designed and meets all my expectations. It is super convenient and user friendly. I highly recommend it.',
  },
  {
    name: 'Hrishit',
    rating: 5,
    quote: 'Perfect for someone who is serious about their physique.',
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQ: Faq[] = [
  {
    q: 'Is Macrotrophy free?',
    a: 'Yes. Workout logging, your full history, every personal record, 2 routines and Indian food logging with calories are free forever. Pro adds the weekly plan, protein and macros, Macrotrophy AI, the weekly report and longer trends. Every new account gets 7 days of Pro free.',
  },
  {
    q: 'What happens after the 7-day trial?',
    a: 'Nothing is charged, because we never ask for a card to start. You move to the Free plan and keep everything you logged. Choose a Pro plan whenever you like.',
  },
  {
    q: 'Does it count calories for Indian food?',
    a: 'Yes. Dishes from every state are worked out from their ingredients, using USDA lab values and the Indian Food Composition Tables. Log by the katori, the plate or the roti. Pack foods use the numbers printed on the pack.',
  },
  {
    q: 'What is the Macrotrophy Brain?',
    a: 'The part of Pro that plans your next week. It reads your weight trend, your food and your lifts, then proposes calories, protein and sets for each muscle, with the reason for every change. Nothing changes until you tap Apply.',
  },
  {
    q: 'What is Macrotrophy AI?',
    a: 'An AI coach inside the app, part of Pro. It explains your progress and food in plain words, in English, Hinglish or Hindi, logs meals from a photo or a sentence, and never makes up numbers of its own.',
  },
  {
    q: 'Do I need to install anything?',
    a: "No. Macrotrophy runs in your phone's browser. Add it to your home screen and it opens full screen like any other app, even offline.",
  },
  {
    q: 'Can I move my data from Hevy or Strong?',
    a: 'Yes. Export your workouts from Hevy or Strong and import the file in Macrotrophy. Your workouts, records and routine come with you, and importing the same file twice adds nothing new.',
  },
  {
    q: 'How do I pay, and can I cancel?',
    a: 'Pay by UPI or card through Razorpay, with autopay or as a single payment that does not renew. Turn autopay off at any time and Pro stays on until the end of the period you paid for.',
  },
  {
    q: 'How do the leaderboards work?',
    a: 'Make a group and share its code, or join the global leaderboard. Points come from finished workouts, hard sets, personal records, protein days, training three days a week and getting stronger, with weekly limits, so effort counts more than how much you already lift.',
  },
  {
    q: 'How are the numbers calculated?',
    a: 'From your logged sets and meals only, with published methods. Estimates such as one rep max are labelled as estimates, and nothing is made up to fill a chart. The science page shows every formula and its research.',
  },
  {
    q: 'What happens to my data?',
    a: 'It is kept on your phone and in your account so it is never lost. We do not sell your data or show ads. You can export it as CSV or delete your account at any time.',
  },
];

/**
 * The plate on the home page ("Count a thali in five taps"). Kcal and protein for one of each
 * are the app's own numbers for the usual unit (medium katori, normal oil); landing.test.ts
 * recomputes them from the food library, so they cannot drift from what the app logs.
 */
export interface ThaliItem {
  /** The food's id in the library. */
  id: string;
  /** One and many, as said at home: "roti" and "rotis", "katori dal tadka". */
  one: string;
  many: string;
  /** The button's label. */
  label: string;
  kcal: number;
  proteinG: number;
  /** How many are on the plate when the page opens. */
  start: number;
}

export const THALI: ThaliItem[] = [
  { id: 'roti', one: 'roti', many: 'rotis', label: 'Roti', kcal: 102, proteinG: 4.0, start: 2 },
  {
    id: 'dal-tadka',
    one: 'katori dal tadka',
    many: 'katoris dal tadka',
    label: 'Dal tadka',
    kcal: 139,
    proteinG: 6.9,
    start: 1,
  },
  {
    id: 'rice',
    one: 'katori rice',
    many: 'katoris rice',
    label: 'Rice',
    kcal: 138,
    proteinG: 2.7,
    start: 1,
  },
  {
    id: 'curd',
    one: 'katori curd',
    many: 'katoris curd',
    label: 'Curd',
    kcal: 100,
    proteinG: 5.7,
    start: 1,
  },
  {
    id: 'paneer-bhurji',
    one: 'katori paneer bhurji',
    many: 'katoris paneer bhurji',
    label: 'Paneer bhurji',
    kcal: 269,
    proteinG: 14.3,
    start: 0,
  },
  {
    id: 'chicken-curry',
    one: 'katori chicken curry',
    many: 'katoris chicken curry',
    label: 'Chicken curry',
    kcal: 199,
    proteinG: 21.3,
    start: 0,
  },
  {
    id: 'rajma',
    one: 'katori rajma',
    many: 'katoris rajma',
    label: 'Rajma',
    kcal: 139,
    proteinG: 6.7,
    start: 0,
  },
  {
    id: 'boiled-egg',
    one: 'boiled egg',
    many: 'boiled eggs',
    label: 'Boiled egg',
    kcal: 72,
    proteinG: 6.3,
    start: 0,
  },
];

/** The day the thali's rings are drawn against. */
export const THALI_DAY = { kcal: 1800, proteinG: 90 };

export const thaliTotals = (items: ThaliItem[] = THALI) => ({
  kcal: items.reduce((a, i) => a + i.kcal * i.start, 0),
  proteinG: Math.round(items.reduce((a, i) => a + i.proteinG * i.start, 0)),
});

export const thaliLine = (items: ThaliItem[] = THALI) =>
  items
    .filter((i) => i.start > 0)
    .map((i) => `${i.start} ${i.start === 1 ? i.one : i.many}`)
    .join(', ');

/** What paying for a longer plan saves against paying monthly for the same time, in rupees. */
export const planSavings = (p: Prices = PUBLIC_PRICES) => ({
  quarterly: p.monthly * 3 - p.quarterly,
  yearly: p.monthly * 12 - p.yearly,
});

/** A guide: a public page for one thing people search for, with plain sections. */
export interface Guide {
  path: string;
  /** Shown in the footer and as the guide's heading. */
  heading: string;
  title: string;
  description: string;
  intro: string;
  sections: { heading: string; paragraphs?: string[]; points?: string[] }[];
}

export const GUIDES: Guide[] = [
  {
    path: '/indian-food-calorie-counter',
    heading: 'Indian food calorie counter',
    title: 'Indian food calorie counter | Macrotrophy',
    description:
      'Count calories and protein in Indian food by the katori, the plate or the roti. Thousands of dishes worked out from their ingredients. Free to start.',
    intro:
      'Most calorie apps were built for Western food, so dal, sabzi and roti end up as guesses from user entries. Macrotrophy counts Indian meals the way you actually eat them.',
    sections: [
      {
        heading: 'Log food the way you eat it',
        points: [
          'Portions in katoris, plates, bowls and rotis, not only grams.',
          'Light, normal or rich oil for home cooking, since oil changes calories the most.',
          'Your usual breakfast, lunch and dinner in one tap.',
          'Snap a photo of your plate or a nutrition label, or type what you ate in Hinglish.',
        ],
      },
      {
        heading: 'Where the numbers come from',
        paragraphs: [
          'Each dish is worked out from its ingredients, using USDA lab values and the Indian Food Composition Tables (IFCT 2017). Packed foods use the numbers printed on the pack, and chain restaurant servings use the chain’s published nutrition.',
        ],
      },
      {
        heading: 'Calories and protein against your own targets',
        paragraphs: [
          'Set a goal and Macrotrophy works out calories and protein for you, then checks each day against published ranges for protein, carbs, fat and fibre. Your real maintenance is measured from your weight trend, not guessed.',
        ],
      },
    ],
  },
  {
    path: '/workout-tracker',
    heading: 'Workout tracker',
    title: 'Workout tracker and gym log | Macrotrophy',
    description:
      'A fast gym log for your phone: last time’s weights beside every set, rest timer, records, and charts of strength and volume. Free to start.',
    intro:
      'Progress in the gym comes from doing a little more than last time. Macrotrophy shows you exactly what that is, set by set.',
    sections: [
      {
        heading: 'Fast logging between sets',
        points: [
          'Last time’s weight and reps beside every set, so you know what to beat.',
          'Tick a set and the rest timer starts.',
          'Routine templates, or a routine built from your days, session length and equipment.',
          'Supersets, bench angles, left and right reps and plate maths.',
        ],
      },
      {
        heading: 'Progress you can trust',
        paragraphs: [
          'Estimated one rep max, top sets, volume, hard sets per muscle and consistency, all calculated from the sets you log with published methods. When a lift stalls, the app names the most likely cause.',
        ],
      },
      {
        heading: 'Bring your history',
        paragraphs: [
          'Coming from Hevy or Strong? Import your export file and your workouts, records and routine come with you.',
        ],
      },
    ],
  },
  {
    path: '/gym-leaderboard',
    heading: 'Gym leaderboard',
    title: 'Gym leaderboard for you and your friends | Macrotrophy',
    description:
      'Make a group for your gym, share a 6-character code and compete on weekly and monthly leaderboards that are fair for every level.',
    intro:
      'Training is easier when your friends are watching. Macrotrophy turns your gym into a friendly weekly competition.',
    sections: [
      {
        heading: 'How it works',
        points: [
          'Create a group and share its 6-character code, or join a friend’s.',
          'Weekly and monthly boards, plus a global leaderboard for everyone on Macrotrophy.',
          'Your name shows on the global board; your username only if you choose.',
        ],
      },
      {
        heading: 'Points that are fair for every level',
        paragraphs: [
          'Points come from finished workouts, hard sets close to failure, personal records and days you hit your protein target, each with weekly limits. A beginner who shows up and trains hard can beat a strong lifter who skips.',
        ],
      },
    ],
  },
];

export const guide = (path: string) => GUIDES.find((g) => g.path === path);

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STAR =
  '<svg viewBox="0 0 20 20" class="size-4" aria-hidden="true"><path fill="currentColor" d="M10 1.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z"/></svg>';

const stars = (r: Review) =>
  `<span class="flex gap-0.5 text-lime" role="img" aria-label="${r.rating} out of 5">${STAR.repeat(r.rating)}</span>`;

function reviewCard(r: Review, copy: boolean): string {
  return `<li class="lp-card lp-review"${copy ? ' aria-hidden="true"' : ' data-review'}>
                ${stars(r)}
                <blockquote class="type-body mt-4 text-[1.0625rem] leading-relaxed text-text-1">“${esc(r.quote)}”</blockquote>
                <p class="mt-5 flex items-center gap-3"><span class="lp-avatar" aria-hidden="true">${esc(r.name[0]!)}</span><span><span class="type-headline block text-text-1">${esc(r.name)}</span><span class="type-caption block text-text-2">Macrotrophy member</span></span></p>
              </li>`;
}

function marqueeRow(reviews: Review[], reverse: boolean, speed: string): string {
  const items = (copy: boolean) => reviews.map((r) => reviewCard(r, copy)).join('\n              ');
  return `<div class="lp-marquee${reverse ? ' lp-marquee-reverse' : ''}" style="--lp-speed: ${speed}">
            <ul class="lp-marquee-track">
              ${items(false)}
            </ul>
            <ul class="lp-marquee-track" aria-hidden="true">
              ${items(true)}
            </ul>
          </div>`;
}

/**
 * The reviews on the home page: the first one large, the rest in two rows that glide past
 * (paused on hover, still with reduced motion). The moving copies are hidden from screen
 * readers, so each review is read once.
 */
export function reviewsHtml(reviews: Review[] = REVIEWS): string {
  const [first, ...rest] = reviews;
  if (!first) return '';
  const half = Math.ceil(rest.length / 2);
  return `<figure class="lp-card lp-card-lime lp-reveal mx-auto max-w-4xl p-7 tab:p-10" data-review>
            <span class="lp-quote-mark block" aria-hidden="true">“</span>
            <blockquote class="mt-2 font-display text-[1.25rem] leading-[1.3] font-semibold tracking-[-0.02em] text-text-1 tab:text-[1.875rem] tab:leading-[1.25] [text-wrap:pretty]">${esc(first.quote)}</blockquote>
            <figcaption class="mt-7 flex items-center gap-3"><span class="lp-avatar" aria-hidden="true">${esc(first.name[0]!)}</span><span><span class="type-headline block text-text-1">${esc(first.name)}</span><span class="type-caption block text-text-2">Macrotrophy member, moved from Hevy</span></span><span class="ml-auto">${stars(first)}</span></figcaption>
          </figure>
          <div class="lp-reveal mt-10 flex flex-col gap-4">
          ${marqueeRow(rest.slice(0, half), false, '55s')}
          ${marqueeRow(rest.slice(half), true, '60s')}
          </div>`;
}

/** The questions on the home page: each opens in place, and reads in full without scripts. */
export function faqHtml(faq: Faq[] = FAQ): string {
  return faq
    .map(
      (f, i) => `            <details class="lp-q"${i === 0 ? ' open' : ''}>
              <summary><span data-faq-q>${esc(f.q)}</span><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg></summary>
              <p>${esc(f.a)}</p>
            </details>`,
    )
    .join('\n');
}

/** The plate's buttons: one food each, with its numbers for the counter. */
export function thaliHtml(items: ThaliItem[] = THALI): string {
  return items
    .map(
      (
        i,
      ) => `                <li class="lp-food" data-food="${i.id}" data-kcal="${i.kcal}" data-protein="${i.proteinG.toFixed(1)}" data-one="${esc(i.one)}" data-many="${esc(i.many)}" data-n="${i.start}">
                  <span class="lp-food-name">${esc(i.label)}<small>${i.kcal} kcal · ${i.proteinG.toFixed(1)} g protein</small></span>
                  <span class="lp-food-step"><button type="button" data-step="-1" aria-label="One less ${esc(i.one)}">−</button><output aria-label="${esc(i.many)} on the plate">${i.start}</output><button type="button" data-step="1" aria-label="One more ${esc(i.one)}">+</button></span>
                </li>`,
    )
    .join('\n');
}

export function guideLinksHtml(guides: Guide[] = GUIDES): string {
  return guides.map((g) => `            <a href="${g.path}">${esc(g.heading)}</a>`).join('\n');
}

/**
 * A guide as plain HTML inside `#root`, so search engines read it without running scripts. The
 * app replaces it with the same guide as a page when it starts.
 */
export function guideHtml(g: Guide): string {
  const body = g.sections
    .map(
      (s) =>
        `<h2>${esc(s.heading)}</h2>` +
        (s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('') +
        (s.points ? `<ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''),
    )
    .join('');
  return `<main data-static-guide><h1>${esc(g.heading)}</h1><p>${esc(g.intro)}</p>${body}<p><a href="/sign-up">Create free account</a> · <a href="/">${BRAND}</a></p></main>`;
}

/** Fills the markers in index.html's home page (build and dev server alike). */
export function fillLanding(html: string): string {
  const markers: [string, string][] = [
    ['REVIEWS_HERE', reviewsHtml()],
    ['FAQ_HERE', faqHtml()],
    ['THALI_HERE', thaliHtml()],
    ['GUIDES_HERE', guideLinksHtml()],
  ];
  let out = html;
  for (const [marker, value] of markers) {
    const tag = `<!-- ${marker} -->`;
    if (!out.includes(tag)) throw new Error(`index.html is missing ${tag}`);
    out = out.replace(tag, value.trimStart());
  }
  return out;
}

export interface Prices {
  monthly: number;
  quarterly: number;
  yearly: number;
}

/**
 * Pro prices on the public pages, in rupees. The app reads live prices from the server
 * (billing_plans); these must match them, and landing.test.ts checks them against the plans
 * migration and the home page. Change them together with the SQL update.
 */
export const PUBLIC_PRICES: Prices = { monthly: 149, quarterly: 399, yearly: 1499 };
export const COACHING_PRICE = 999;

/**
 * What search engines read about Macrotrophy: the organisation, the site (so "Macrotrophy" and
 * "Macrotrophy" lead here) and the app with its price. No ratings markup: Google does not
 * accept reviews a business shows about itself.
 */
export function structuredData(prices: Prices = PUBLIC_PRICES, faq: Faq[] = FAQ): string {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: BRAND,
      alternateName: ['Overload Gym', 'Overload'],
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/icons/icon-512.png`,
      email: SUPPORT_EMAIL,
      sameAs: [INSTAGRAM_URL],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: BRAND,
      alternateName: ['Macrotrophy workout tracker', 'Overload Gym', 'macrotrophy.in'],
      url: `${SITE_ORIGIN}/`,
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: BRAND,
      alternateName: 'Overload Gym',
      description:
        'Workout tracker and Indian food calorie counter that plans your next week from your training and food: log sets and meals, an AI coach in English and Hinglish, a weekly report, leaderboards, and every number backed by published research.',
      applicationCategory: 'HealthApplication',
      applicationSubCategory: 'Fitness',
      operatingSystem: 'Web, iOS, Android',
      url: `${SITE_ORIGIN}/`,
      image: `${SITE_ORIGIN}/og-image.png`,
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      offers: [
        { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'INR' },
        {
          '@type': 'Offer',
          name: 'Pro monthly',
          price: String(prices.monthly),
          priceCurrency: 'INR',
        },
        {
          '@type': 'Offer',
          name: 'Pro 3 months',
          price: String(prices.quarterly),
          priceCurrency: 'INR',
        },
        {
          '@type': 'Offer',
          name: 'Pro yearly',
          price: String(prices.yearly),
          priceCurrency: 'INR',
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];
  // `<` escaped so nothing inside can close the script tag.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}
