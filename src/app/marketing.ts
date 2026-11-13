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
    a: 'Yes. Workout logging, routines, food logging, your full history and every record are free with no limit. Pro is a paid upgrade for longer trends, Macrotrophy AI and AI food logging.',
  },
  {
    q: 'Does it count calories for Indian food?',
    a: 'Yes. Dishes from every state are worked out from their ingredients, using USDA lab values and the Indian Food Composition Tables. Log by the katori, the plate or the roti. Pack foods use the numbers printed on the pack.',
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
    q: 'What is Macrotrophy AI?',
    a: 'An AI coach inside the app, part of Pro. It explains your progress and food in plain words, in English, Hinglish or Hindi, logs meals from a photo or a sentence, and never makes up numbers of its own.',
  },
  {
    q: 'How do the leaderboards work?',
    a: 'Make a group and share its code, or join the global leaderboard. Points come from finished workouts, hard sets, personal records and protein days, with weekly limits, so effort counts more than how much you already lift.',
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
            <blockquote class="mt-2 font-display text-[1.5rem] leading-[1.25] font-semibold tracking-[-0.02em] text-text-1 tab:text-[2rem]">${esc(first.quote)}</blockquote>
            <figcaption class="mt-7 flex items-center gap-3"><span class="lp-avatar" aria-hidden="true">${esc(first.name[0]!)}</span><span><span class="type-headline block text-text-1">${esc(first.name)}</span><span class="type-caption block text-text-2">Macrotrophy member, moved from Hevy</span></span><span class="ml-auto">${stars(first)}</span></figcaption>
          </figure>
          <div class="lp-reveal mt-10 flex flex-col gap-4">
          ${marqueeRow(rest.slice(0, half), false, '55s')}
          ${marqueeRow(rest.slice(half), true, '60s')}
          </div>`;
}

/** The questions on the home page. */
export function faqHtml(faq: Faq[] = FAQ): string {
  return faq
    .map(
      (f) => `            <div>
              <dt class="type-headline">${esc(f.q)}</dt>
              <dd class="type-body mt-2 text-text-2">${esc(f.a)}</dd>
            </div>`,
    )
    .join('\n');
}

export function guideLinksHtml(guides: Guide[] = GUIDES): string {
  return guides
    .map(
      (g) =>
        `          <a href="${g.path}" class="text-text-2 hover:text-text-1">${esc(g.heading)}</a>`,
    )
    .join('\n');
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
        'Workout tracker and Indian food calorie counter: log sets and meals, track strength and protein, compete with friends, with every number backed by published research.',
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
