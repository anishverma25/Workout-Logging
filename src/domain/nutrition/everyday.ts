/**
 * The everyday picks for the words people type most (November 2026, owner: "keep it simple with
 * simple options and most used options"). Typing "rice" shows steamed rice, basmati, brown rice
 * and the rice dishes people log daily, in that order, before anything else; the long tail is
 * still there behind "Show more". Ids that do not fit the person's diet are skipped.
 *
 * Keep each list short (at most eight) and in the order people eat them. Every id is checked to
 * exist in `everyday.test.ts`.
 */
const RICE = [
  'rice',
  't300-cooked-basmati-rice',
  'brown-rice',
  'jeera-rice',
  'curd-rice',
  'veg-fried-rice',
  'lemon-rice',
  'dal-chawal',
];
const ROTI = [
  'roti',
  'phulka',
  'ghee-roti',
  'tandoori-roti',
  'butter-roti',
  'missi-roti',
  'bajra-roti',
  'makki-roti',
];
const DAL = [
  'dal-tadka',
  'dal-fry',
  'moong-dal',
  'masoor-dal',
  'chana-dal',
  'urad-dal',
  'dal-makhani',
  'dal-chawal',
];
const EGG = [
  'boiled-egg',
  'egg-white',
  't300-plain-omelette',
  'omelette',
  'egg-bhurji',
  'half-fry-egg',
  'egg-curry',
];
const CHICKEN = [
  'chicken-breast',
  'chicken-plain',
  't300-chicken-thigh-cooked',
  'chicken-curry',
  'butter-chicken',
  'chicken-tikka',
  'chicken-biryani',
];
const PANEER = [
  'paneer',
  't300-low-fat-paneer',
  'paneer-bhurji',
  'paneer-tikka',
  'palak-paneer',
  'matar-paneer',
  'kadai-paneer',
  'paneer-butter-masala',
];
const POTATO = [
  'aloo-sabzi',
  'jeera-aloo',
  'aloo-gobhi',
  'aloo-matar',
  'aloo-paratha',
  'aloo-dum',
  'sweet-potato',
];
const MILK = ['milk', 'milk-toned', 'milk-skimmed', 'milk-buffalo'];
const CURD = ['curd', 'greek-yogurt', 'curd-rice'];
const CHAI = ['chai', 'chai-no-sugar', 'masala-chai', 'green-tea', 'black-tea', 'lemon-tea'];
const COFFEE = ['black-coffee', 'filter-coffee', 'cold-coffee', 'cafe-latte'];

export const EVERYDAY: Readonly<Record<string, readonly string[]>> = {
  rice: RICE,
  chawal: RICE,
  'white rice': ['rice', 't300-white-rice-raw', 't300-cooked-basmati-rice'],
  'basmati rice': ['t300-cooked-basmati-rice', 'rice'],
  'brown rice': ['brown-rice'],
  roti: ROTI,
  chapati: ROTI,
  chapatti: ROTI,
  phulka: ROTI,
  dal: DAL,
  daal: DAL,
  dhal: DAL,
  egg: EGG,
  eggs: EGG,
  anda: EGG,
  omelette: ['t300-plain-omelette', 'omelette', 'egg-white-omelette', 'cheese-omelette'],
  chicken: CHICKEN,
  paneer: PANEER,
  milk: MILK,
  doodh: MILK,
  curd: CURD,
  dahi: CURD,
  yogurt: ['curd', 'greek-yogurt'],
  tea: CHAI,
  chai: CHAI,
  coffee: COFFEE,
  oats: ['quaker-oats', 'oats-milk', 'oats-porridge'],
  bread: ['bread-slice', 'brown-bread', 'pav'],
  banana: ['banana'],
  apple: ['apple'],
  potato: POTATO,
  aloo: POTATO,
  rajma: ['rajma', 'rajma-boiled', 'rajma-chawal'],
  chole: ['chole', 'chole-chawal', 'chole-bhature'],
  whey: [
    'protein-shake',
    't300-whey-protein-concentrate-powder',
    't300-whey-protein-isolate-powder',
  ],
};

/** The pinned picks for a query, as a rank (0 first), or undefined when the word has none. */
export function everydayRank(query: string): ReadonlyMap<string, number> | undefined {
  const picks = EVERYDAY[query];
  if (!picks) return undefined;
  return new Map(picks.map((id, i) => [id, i]));
}
