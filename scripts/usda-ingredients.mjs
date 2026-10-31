// Builds src/data/library/ingredients.ts from USDA SR28 (public domain).
// Usage: node scripts/usda-ingredients.mjs path/to/ABBREV.txt
// ABBREV.txt is the abbreviated file of the USDA National Nutrient Database for Standard
// Reference, Release 28 (also published in the npm package fda-nutrient-database@1.0.2).
// Values are copied as they are, per 100 g of the food as purchased (raw unless named).
import { readFileSync, writeFileSync } from 'node:fs';

/** Our id, the name shown in the app, the SR28 NDB number. */
const PICK = [
  ['atta', 'Whole wheat flour (atta)', '20080'],
  ['maida', 'Refined wheat flour (maida)', '20081'],
  ['rice', 'Rice, white, raw', '20444'],
  ['poha', 'Flattened rice (poha)', '20444', 'White rice values; poha is pressed rice.'],
  ['rice-flour', 'Rice flour', '20061'],
  ['sooji', 'Semolina (sooji)', '20466'],
  ['besan', 'Gram flour (besan)', '16157'],
  ['sabudana', 'Sago (sabudana)', '20068'],
  ['bajra', 'Pearl millet (bajra)', '20031'],
  ['jowar', 'Sorghum (jowar)', '20067'],
  ['makki-atta', 'Maize flour (makki atta)', '20020'],
  ['kuttu-atta', 'Buckwheat flour (kuttu atta)', '20011'],
  ['oats', 'Oats', '08120'],
  ['vermicelli', 'Vermicelli (seviyan)', '20120', 'Dry wheat pasta values.'],
  ['bread', 'White bread', '18069'],
  ['toor-dal', 'Toor dal (pigeon peas)', '16101'],
  ['chana-dal', 'Chana dal', '16056', 'Chickpea values.'],
  ['kabuli-chana', 'Chickpeas (kabuli chana)', '16056'],
  ['rajma', 'Kidney beans (rajma)', '16032'],
  ['moong-dal', 'Moong dal', '16080'],
  ['urad-dal', 'Urad dal', '16083'],
  ['masoor-dal', 'Masoor dal (lentils)', '16069'],
  ['moong-sprouts', 'Moong sprouts', '11043'],
  ['soya-chunks', 'Soya chunks', '16117', 'Defatted soy flour, what soya chunks are made from.'],
  ['peanuts', 'Peanuts', '16087'],
  ['cashews', 'Cashews', '12087'],
  ['almonds', 'Almonds', '12061'],
  ['raisins', 'Raisins', '09298'],
  ['coconut', 'Coconut, fresh', '12104'],
  ['coconut-dry', 'Coconut, dried', '12108'],
  ['milk', 'Milk, whole (cow)', '01077'],
  ['milk-toned', 'Milk, toned', '01079', '2% fat milk values.'],
  ['milk-buffalo', 'Milk, buffalo', '01108'],
  ['curd', 'Curd (dahi)', '01116'],
  ['paneer', 'Paneer', '01229', 'Queso blanco values: fresh cheese set with acid, as paneer is.'],
  ['ghee', 'Ghee', '01003'],
  ['butter', 'Butter', '01145'],
  ['cream', 'Cream', '01053'],
  ['cheese', 'Cheese', '01009'],
  ['oil', 'Cooking oil', '04669'],
  ['mustard-oil', 'Mustard oil', '04583'],
  ['egg', 'Egg', '01123'],
  ['chicken', 'Chicken', '05011'],
  ['mutton', 'Mutton (goat)', '17168'],
  ['fish', 'Fish (rohu, carp)', '15008'],
  ['prawns', 'Prawns', '15270'],
  ['potato', 'Potato', '11352'],
  ['onion', 'Onion', '11282'],
  ['tomato', 'Tomato', '11529'],
  ['cauliflower', 'Cauliflower', '11135'],
  ['okra', 'Okra (bhindi)', '11278'],
  ['brinjal', 'Brinjal (baingan)', '11209'],
  ['spinach', 'Spinach (palak)', '11457'],
  ['peas', 'Green peas (matar)', '11304'],
  ['carrot', 'Carrot', '11124'],
  ['cabbage', 'Cabbage', '11109'],
  ['capsicum', 'Capsicum', '11333'],
  ['beans', 'French beans', '11052'],
  ['lauki', 'Bottle gourd (lauki)', '11218'],
  ['karela', 'Bitter gourd (karela)', '11024'],
  ['pumpkin', 'Pumpkin', '11422'],
  ['mushroom', 'Mushroom', '11260'],
  ['cucumber', 'Cucumber', '11205'],
  ['garlic', 'Garlic', '11215'],
  ['ginger', 'Ginger', '11216'],
  ['green-chilli', 'Green chilli', '11670'],
  ['coriander', 'Coriander leaves', '11165'],
  ['lemon', 'Lemon juice', '09152'],
  ['sweet-potato', 'Sweet potato', '11507'],
  ['sarson', 'Mustard greens (sarson)', '11270'],
  ['radish', 'Radish (mooli)', '11429'],
  ['corn', 'Sweet corn', '11167'],
  ['beetroot', 'Beetroot', '11080'],
  ['cumin', 'Cumin seeds', '02014'],
  ['turmeric', 'Turmeric', '02043'],
  ['chilli-powder', 'Chilli powder', '02009'],
  ['coriander-powder', 'Coriander powder', '02013'],
  ['methi-seeds', 'Fenugreek seeds', '02019'],
  ['sugar', 'Sugar', '19335'],
  ['jaggery', 'Jaggery', '19334', 'Brown sugar values.'],
  ['tamarind', 'Tamarind', '09322'],
  ['tea', 'Tea, brewed', '14355'],
  ['coffee', 'Coffee, brewed', '14209'],
  ['coffee-powder', 'Instant coffee powder', '14214'],
  ['banana', 'Banana', '09040'],
  ['apple', 'Apple', '09003'],
  ['mango', 'Mango', '09176'],
  ['papaya', 'Papaya', '09226'],
  ['orange', 'Orange', '09200'],
  ['guava', 'Guava', '09139'],
  ['watermelon', 'Watermelon', '09326'],
  ['grapes', 'Grapes', '09132'],
  ['pomegranate', 'Pomegranate', '09286'],
  ['poppy-seeds', 'Poppy seeds (posto, khus khus)', '02033'],
  ['soy-sauce', 'Soy sauce', '16123'],
  ['cornflour', 'Cornflour', '20027'],
  ['milk-powder', 'Milk powder (for khoa)', '01090'],
  ['condensed-milk', 'Condensed milk', '01095'],
  ['puffed-rice', 'Puffed rice (murmura)', '08066'],
  ['peanut-butter', 'Peanut butter', '16098'],
  ['honey', 'Honey', '19296'],
  ['coconut-water', 'Coconut water', '12119'],
  ['cornflakes', 'Cornflakes', '08020'],
  ['mayonnaise', 'Mayonnaise', '04025'],
  ['ketchup', 'Tomato ketchup', '11935'],
  ['spring-onion', 'Spring onion', '11291'],
  ['vinegar', 'Vinegar', '02048'],
  ['coconut-milk', 'Coconut milk', '12117'],
  ['mustard-seeds', 'Mustard seeds', '02024'],
  ['sesame', 'Sesame seeds (til)', '12023'],
  ['parmesan', 'Parmesan cheese', '01032'],
  ['whey', 'Whey protein powder', '14066'],
  ['black-pepper', 'Black pepper', '02030'],
  ['tofu', 'Tofu', '16426'],
  ['egg-white', 'Egg white', '01124'],
  ['chicken-breast-cooked', 'Chicken breast, roasted', '05064'],
  ['brown-rice-cooked', 'Brown rice, cooked', '20037'],
  ['quinoa-cooked', 'Quinoa, cooked', '20137'],
  ['sweet-potato-baked', 'Sweet potato, baked', '11508'],
  ['dates', 'Dates (khajur)', '09087'],
  ['tuna-canned', 'Tuna, canned in water', '15121'],
  ['milk-skimmed', 'Milk, skimmed', '01085'],
  ['greek-yogurt', 'Greek yogurt / hung curd, low fat', '01256'],
  ['brown-bread', 'Brown bread (whole wheat)', '18075'],
  ['chickpeas-boiled', 'Chickpeas, boiled', '16057'],
  ['rajma-boiled', 'Kidney beans, boiled', '16033'],
  ['oats-cooked', 'Oats, cooked in water', '08121'],
  ['lotus-seeds', 'Lotus seeds (makhana), dried', '12013'],
  ['ladyfingers', 'Ladyfinger biscuits', '18423'],
  ['cream-cheese', 'Cream cheese', '01017'],
  ['evaporated-milk', 'Evaporated milk', '01096'],
  ['avocado', 'Avocado', '09037'],
  ['croissant', 'Croissant (butter)', '18239'],
  ['espresso', 'Espresso', '14210'],
  ['waffle', 'Waffle, plain', '18367'],
  ['pancake', 'Pancake, plain', '18293'],
  ['salmon', 'Salmon', '15236'],
  ['nori', 'Seaweed (nori)', '11446'],
  ['mozzarella', 'Mozzarella', '01026'],
  ['puff-pastry', 'Puff pastry, baked', '18211'],
  ['phyllo', 'Phyllo dough', '18338'],
  ['maple-syrup', 'Maple syrup', '19353'],
  ['tapioca-pearls', 'Tapioca pearls, dry', '20068'],
  ['pita', 'Pita bread', '18041'],
  ['hummus', 'Hummus', '16158'],
  ['falafel', 'Falafel', '16138'],
  ['feta', 'Feta', '01019'],
  ['olives', 'Olives', '09193'],
  ['lettuce', 'Lettuce (romaine)', '11251'],
  ['chia', 'Chia seeds', '12006'],
  ['bagel', 'Bagel', '18406'],
  ['dark-chocolate', 'Dark chocolate (60 to 69%)', '19903'],
  ['milk-chocolate', 'Milk chocolate', '19120'],
  ['sponge-cake', 'Sponge cake', '18133'],
  ['strawberries', 'Strawberries', '09316'],
  ['blueberries', 'Blueberries', '09050'],
  ['brownie', 'Brownie', '18151'],
  ['choc-chip-cookie', 'Chocolate chip cookie', '18159'],
  ['glazed-doughnut', 'Glazed doughnut', '18436'],
  ['cheesecake', 'Cheesecake', '18147'],
  ['sushi-rice', 'Short-grain rice, cooked', '20453'],
  ['ice-cream', 'Vanilla ice cream', '19095'],
  ['choc-ice-cream', 'Chocolate ice cream', '19270'],
  ['olive-oil', 'Olive oil', '04053'],
  ['granola', 'Granola', '08037'],
  ['whipped-cream', 'Whipped cream', '01054'],
  ['flour-tortilla', 'Flour tortilla', '18364'],
  ['pasta-cooked', 'Pasta, cooked', '20121'],
  ['sweet-corn', 'Sweet corn', '11170'],
  ['brown-sugar', 'Brown sugar', '19334'],
  ['sourdough', 'Sourdough (English muffin)', '18258'],
  ['multigrain-bread', 'Multigrain bread', '18036'],
  ['pineapple', 'Pineapple', '09266'],
  ['kiwi', 'Kiwi', '09148'],
  ['lychee', 'Lychee', '09164'],
  ['jackfruit', 'Jackfruit', '09144'],
  ['sapota', 'Sapota (chikoo)', '09313', 'Sapodilla values.'],
  ['custard-apple', 'Custard apple (sitaphal)', '09321', 'Sugar-apple (sweetsop) values.'],
  ['soymilk', 'Soy milk', '16120'],
  ['pistachios', 'Pistachios', '12151'],
  ['walnuts', 'Walnuts', '12155'],
  ['flaxseed', 'Flax seeds (alsi)', '12220'],
  ['pumpkin-seeds', 'Pumpkin seeds', '12014'],
  ['sunflower-seeds', 'Sunflower seeds', '12036'],
  ['popcorn', 'Popcorn, air-popped', '19034'],
];

const rows = new Map();
for (const line of readFileSync(process.argv[2], 'latin1').split(/\r?\n/)) {
  if (!line) continue;
  const f = line.split('^').map((x) => x.replace(/^~|~$/g, ''));
  rows.set(f[0], f);
}
const num = (v) => (v === '' ? 0 : Number(v));
const out = [];
for (const [id, name, ndb, note] of PICK) {
  const f = rows.get(ndb);
  if (!f) throw new Error(`Missing ${ndb}`);
  out.push(
    `  ${JSON.stringify(id)}: { name: ${JSON.stringify(name)}, ndb: '${ndb}', usda: ${JSON.stringify(f[1])}, ` +
      `water: ${num(f[2])}, kcal: ${num(f[3])}, proteinG: ${num(f[4])}, fatG: ${num(f[5])}, carbsG: ${num(f[7])}, fibreG: ${num(f[8])}` +
      (note ? `, note: ${JSON.stringify(note)}` : '') +
      ' },',
  );
}
const ts = `// Generated by scripts/usda-ingredients.mjs from USDA SR28 (public domain). Do not edit by hand.
// U.S. Department of Agriculture, Agricultural Research Service. USDA National Nutrient Database
// for Standard Reference, Release 28. Values per 100 g, raw unless the USDA name says otherwise.
import type { Ingredient } from '@/domain/nutrition/types';

export const INGREDIENTS = {
${out.join('\n')}
  water: { name: 'Water', ndb: '', usda: 'Water', water: 100, kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fibreG: 0 },
} as const satisfies Record<string, Ingredient>;

export type IngredientId = keyof typeof INGREDIENTS;
`;
writeFileSync(new URL('../src/data/library/ingredients.ts', import.meta.url), ts);
console.log(`Wrote ${PICK.length + 1} ingredients`);

// The whole of SR28 as searchable foods, loaded only when food logging opens. Long names come
// from FOOD_DES.txt (same folder). Baby foods (0300) and American Indian/Alaska Native foods
// (3500) are left out. Each row: [ndb, name, group, kcal, protein, carbs, fat, fibre,
// grams of measure 1, measure 1, grams of measure 2, measure 2].
const desPath = process.argv[2].replace(/ABBREV\.txt$/, 'FOOD_DES.txt');
const names = new Map();
for (const line of readFileSync(desPath, 'latin1').split(/\r?\n/)) {
  if (!line) continue;
  const f = line.split('^').map((x) => x.replace(/^~|~$/g, ''));
  names.set(f[0], { group: f[1], name: f[2] });
}
const r1 = (v) => Math.round(num(v) * 10) / 10;
const rows2 = [];
for (const [ndb, f] of rows) {
  const d = names.get(ndb);
  if (!d || d.group === '0300' || d.group === '3500') continue;
  if (f[3] === '') continue;
  const n = f.length;
  const m1 = num(f[n - 5]);
  const m2 = num(f[n - 3]);
  rows2.push([
    ndb,
    d.name,
    d.group,
    r1(f[3]),
    r1(f[4]),
    r1(f[7]),
    r1(f[5]),
    r1(f[8]),
    m1 > 0 ? r1(m1) : 0,
    m1 > 0 ? f[n - 4] : '',
    m2 > 0 ? r1(m2) : 0,
    m2 > 0 ? f[n - 2] : '',
  ]);
}
writeFileSync(
  new URL('../src/data/library/usdaFoods.json', import.meta.url),
  JSON.stringify(rows2),
);
console.log(`Wrote ${rows2.length} USDA foods`);
