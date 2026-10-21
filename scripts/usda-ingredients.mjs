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
