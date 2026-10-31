import type { Food } from '../../domain/nutrition/calc';
import type { DietType, Meal, UnitId } from '../../domain/nutrition/types';

/**
 * The long tail of the food library, loaded only when someone opens the food logger:
 * about 1,100 regional recipes and pack labels (`regional/`, calculated like the curated
 * library, so they rank with it), about 8,000 foods from USDA SR28 (public domain, lab values,
 * with household measures) and about 860 Indian dishes from the Indian Nutrient Databank
 * (Vijayakumar et al. 2024, standard recipes), which rank below the curated library.
 */

type UsdaRow = [
  ndb: string,
  name: string,
  group: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fibre: number,
  m1g: number | null,
  m1: string | null,
  m2g: number | null,
  m2: string | null,
];
type IndbRow = [
  code: string,
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fibre: number,
  diet: Exclude<DietType, 'jain'>,
  jain: 0 | 1,
  liquid: 0 | 1,
];

const ALL: Meal[] = ['breakfast', 'lunch', 'snacks', 'dinner'];
/** Meat, poultry, sausages and fish groups. */
const MEAT_GROUPS = new Set(['0500', '0700', '1000', '1300', '1500', '1700']);
const MEAT_WORDS =
  /\b(chicken|beef|pork|ham|bacon|sausage|pepperoni|salami|turkey|lamb|mutton|veal|fish|tuna|salmon|shrimp|prawn|crab|lobster|anchov|sardine|meat|meatball|hot dog|frankfurter|bologna|gelatin|lard|venison|duck|goat|cod|tilapia|clam|oyster|squid|octopus|scallop|mackerel|herring|trout|catfish|pollock|halibut|haddock|beefalo|bison|rabbit|liver|giblets)\b/i;
const EGG_WORDS = /\b(egg|eggs|omelet|omelette|mayonnaise|meringue|custard)\b/i;
const NO_PLURAL = /^(oz|fl|tbsp|tsp|lb|g|ml)$/i;

function usdaDiet(group: string, name: string): Food['diet'] {
  if (MEAT_GROUPS.has(group) || MEAT_WORDS.test(name)) return 'nonveg';
  if (EGG_WORDS.test(name) && !/eggplant|eggnog-flavor|egg-free|egg substitute/i.test(name))
    return 'egg';
  return 'veg';
}

/** "1 cup, chopped" is 140 g: one "cup, chopped" is 140 g. */
function measure(g: number | null, desc: string | null) {
  if (!g || !desc) return null;
  const m = /^\s*(\d+(?:\.\d+)?)(?:\/(\d+))?\s+(.+)$/.exec(desc);
  const qty = m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : 1;
  const label = (m ? m[3]! : desc).replace(/\s+/g, ' ').trim();
  if (!qty || !label || g / qty < 1) return null;
  const [first, ...rest] = label.split(/(?=[ ,(])/);
  const plural =
    first && !NO_PLURAL.test(first) && /^[a-z]+$/i.test(first) && !/s$/i.test(first)
      ? [`${first}s`, ...rest].join('')
      : label;
  return { g: Math.round((g / qty) * 10) / 10, name: [label, plural] as [string, string] };
}

function fromUsda(r: UsdaRow): Food {
  const [ndb, name, group, kcal, proteinG, carbsG, fatG, fibreG, m1g, m1, m2g, m2] = r;
  const piece = measure(m1g, m1) ?? measure(m2g, m2);
  const units: UnitId[] = piece ? ['piece', 'g'] : ['g'];
  return {
    id: `usda-${ndb}`,
    name,
    aliases: [],
    category: 'basic',
    region: 'all',
    meals: ALL,
    diet: usdaDiet(group, name),
    // Root vegetables and onion are not marked in USDA, so none of these count as Jain.
    jain: false,
    per100: { kcal, proteinG, carbsG, fatG, fibreG },
    fatPer100: null,
    units,
    defaultAmount: piece ? 1 : 100,
    density: 1,
    pieceG: piece?.g ?? null,
    pieceName: piece?.name ?? null,
    servingG: null,
    source: 'usda',
    recipe: null,
  };
}

function fromIndb(r: IndbRow): Food {
  const [code, name, kcal, proteinG, carbsG, fatG, fibreG, diet, jain, liquid] = r;
  const alias = /\(([^)]+)\)/.exec(name)?.[1];
  return {
    id: `indb-${code}`,
    name,
    aliases: alias ? [alias] : [],
    category: liquid ? 'drink' : 'side',
    region: 'all',
    meals: ALL,
    diet,
    jain: jain === 1,
    per100: { kcal, proteinG, carbsG, fatG, fibreG },
    fatPer100: null,
    units: liquid ? ['glass', 'g'] : ['katori', 'g'],
    defaultAmount: 1,
    density: 1,
    pieceG: null,
    pieceName: null,
    servingG: null,
    source: 'indb',
    recipe: null,
  };
}

let loaded: Food[] = [];
let loading: Promise<Food[]> | null = null;
const listeners = new Set<() => void>();

/** Starts loading the long tail once; later calls return the same promise. */
export function loadMoreFoods(): Promise<Food[]> {
  loading ??= Promise.all([
    import('./usdaFoods.json'),
    import('./indbFoods.json'),
    import('./regional/index'),
  ]).then(([usda, indb, regional]) => {
    loaded = [
      // Calculated regional recipes and labels first: they rank with the curated library.
      ...regional.REGIONAL_FOODS,
      ...(indb.default as unknown as IndbRow[]).map(fromIndb),
      ...(usda.default as unknown as UsdaRow[]).map(fromUsda),
    ];
    listeners.forEach((l) => l());
    return loaded;
  });
  return loading;
}

export const moreFoodsStore = {
  get: () => loaded,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const __test = { fromUsda, fromIndb, measure, usdaDiet };
