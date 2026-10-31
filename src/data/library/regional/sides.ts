import { group, SPOON } from './build';

/**
 * Chutneys, podis, raitas, salads, papads and pickles. Pickles keep the oil they are packed in;
 * a tablespoon is the usual helping, a katori for raita and salad.
 */
const spoon = group({ category: 'side', meals: 'm', units: SPOON });
const katori = group({ category: 'side', meals: 'm', units: ['katori', 'g'] });
const piece = group({ category: 'side', meals: 'm', units: ['piece', 'g'] });
const S = { nofat: true } as const;

spoon.add('Mint chutney', 'n', 'mint 50, coriander 50, green-chilli 8, lemon 10, curd 30', 140, {
  ...S,
  a: 'pudina chutney; hari chutney; green chutney',
});
spoon.add('Coriander chutney', 'n', 'coriander 100, green-chilli 8, lemon 10, peanuts 10', 120, {
  ...S,
  a: 'dhaniya chutney; kothamalli chutney',
});
spoon.add('Kothamalli chutney', 's', 'coriander 100, coconut 30, urad-dal 8, oil 5', 140, {
  ...S,
  id: 'kothamalli-chutney-tamil',
});
spoon.add('Imli chutney', 'n', 'tamarind 60, jaggery 80, dates 30, water 150', 250, {
  ...S,
  a: 'saunth; meethi chutney; tamarind chutney; khajur imli chutney',
});
spoon.add('Onion chutney', 's', 'onion 200, oil 15, tamarind 6, urad-dal 8', 200, {
  ...S,
  a: 'vengaya chutney; ulli chutney',
});
spoon.add(
  'Garlic chutney',
  'w',
  'garlic 60, coconut-dry 40, peanuts 20, oil 10, chilli-powder 10',
  135,
  { ...S, a: 'lasun chutney; vada pav chutney' },
);
spoon.add('Lasun chutney', 'w', 'garlic 60, coconut-dry 40, chilli-powder 12, oil 6', 115, {
  ...S,
  id: 'lasun-chutney-dry',
  a: 'sukha lasun chutney; dry garlic chutney',
});
spoon.add('Karvand chutney', 'w', 'raw-mango 100, jaggery 40', 130, { ...S, a: 'karonda chutney' });
spoon.add('Gongura chutney', 's', 'gongura 200, oil 25, green-chilli 10', 200, {
  ...S,
  a: 'gongura pachadi; pulla gongura',
});
spoon.add('Pudina thogayal', 's', 'mint 80, urad-dal 20, coconut 20, tamarind 6, oil 8', 140, {
  ...S,
  a: 'mint thuvaiyal; pudina thuvaiyal',
});
spoon.add('Idli podi', 's', 'urad-dal 60, chana-dal 30, sesame 15, chilli-powder 10', 'm3', {
  ...S,
  u: ['tsp', 'tbsp', 'g'],
  a: 'milagai podi; gunpowder; gun powder; chutney podi',
});
spoon.add(
  'Chutney powder',
  's',
  'chana-dal 50, urad-dal 30, coconut-dry 30, chilli-powder 8, jaggery 8',
  'm4',
  { ...S, u: ['tsp', 'tbsp', 'g'], a: 'chutney pudi; karnataka chutney powder' },
);
spoon.add('Flax seed chutney', 's', 'flaxseed 60, urad-dal 20, chilli-powder 5', 'm4', {
  ...S,
  u: ['tsp', 'tbsp', 'g'],
  a: 'agase chutney pudi',
});
spoon.add('Bhut jolokia pickle', 'e', 'green-chilli 100, mustard-oil 60', 160, {
  ...S,
  a: 'ghost pepper pickle',
});
spoon.add('Lemon pickle', 'a', 'lemon 200, chilli-powder 10, oil 30', 230, {
  ...S,
  a: 'nimbu achar; nimbu ka achar; lime pickle; narthangai',
});
spoon.add(
  'Mixed pickle',
  'n',
  'raw-mango 100, carrot 50, cauliflower 50, mustard-oil 50, chilli-powder 10',
  250,
  { ...S, a: 'mix achar; mixed achaar' },
);
spoon.add('Chilli pickle', 'n', 'green-chilli 150, mustard-oil 50, mustard-seeds 10', 200, {
  ...S,
  a: 'hari mirch ka achar; mirchi pickle',
});
spoon.add('Amla pickle', 'n', 'amla 200, mustard-oil 40, chilli-powder 8', 240, {
  ...S,
  a: 'amla achar; nellikai oorugai',
});
spoon.add('Carrot pickle', 'n', 'carrot 200, mustard-oil 40, mustard-seeds 10', 240, {
  ...S,
  a: 'gajar ka achar',
});
spoon.add('Lotus stem pickle', 'n', 'lotus-stem 200, mustard-oil 40', 230, {
  ...S,
  a: 'kamal kakdi achar; nadru achar',
});
spoon.add('Garlic pickle', 's', 'garlic 200, oil 50, tamarind 15, chilli-powder 10', 250, {
  ...S,
  a: 'poondu oorugai; lehsun achar',
});
spoon.add('Ginger pickle', 's', 'ginger 150, tamarind 30, jaggery 30, oil 20', 200, {
  ...S,
  a: 'inji puli; inji curry',
});
spoon.add('Gongura pickle', 's', 'gongura 200, oil 60, chilli-powder 10', 230, {
  ...S,
  a: 'gongura pachadi pickle',
});
spoon.add('Avakaya', 's', 'raw-mango 300, oil 100, chilli-powder 25, mustard-seeds 25', 430, {
  ...S,
  a: 'avakai; andhra mango pickle',
});
spoon.add('Tomato pickle', 's', 'tomato 300, oil 50, tamarind 15, chilli-powder 10', 280, {
  ...S,
  a: 'tomato pachadi; tamatar achar',
});
spoon.add('Chicken pickle', 's', 'chicken 300, oil 80, chilli-powder 15, vinegar 15', 330, {
  ...S,
  a: 'kodi pachadi; chicken achar',
});
spoon.add('Mutton pickle', 'a', 'mutton 300, oil 80, chilli-powder 15, vinegar 15', 330, {
  ...S,
  a: 'mamsam pachadi; gosht achar',
});
spoon.add('Fish pickle', 's', 'seer-fish 300, oil 80, chilli-powder 15, vinegar 20', 330, {
  ...S,
  a: 'meen achar; fish achaar',
});
spoon.add('Prawn pickle', 's', 'prawns 300, oil 80, chilli-powder 15, vinegar 20', 330, {
  ...S,
  a: 'chemmeen achar; kolambi pickle',
});
spoon.add('Gujarati chhundo', 'w', 'raw-mango 300, sugar 250', 400, {
  ...S,
  a: 'chundo; sweet mango pickle',
});
spoon.add(
  'Methia keri',
  'w',
  'raw-mango 300, mustard-oil 80, methi-seeds 20, chilli-powder 10',
  400,
  { ...S, a: 'methiya keri; methi mango pickle' },
);
spoon.add('Chyawanprash', 'a', 'amla 100, sugar 120, honey 30, ghee 10', 'm25', {
  ...S,
  u: ['tsp', 'tbsp', 'g'],
  a: 'chyavanprash',
});
spoon.add('Mixed fruit jam', 'a', 'sugar 100, apple 40, pineapple 30, papaya 30', 'm32', {
  ...S,
  u: ['tsp', 'tbsp', 'g'],
  a: 'jam; kissan jam style',
});
spoon.add(
  'Schezwan sauce',
  'a',
  'oil 40, garlic 30, chilli-powder 20, soy-sauce 15, sugar 10, vinegar 15',
  'm35',
  { ...S, a: 'schezwan chutney; szechuan sauce' },
);
spoon.add('Green chilli sauce', 'a', 'green-chilli 100, vinegar 40, sugar 15', 'm80', {
  ...S,
  a: 'green chili sauce',
});
spoon.add('Tungrymbai paste', 'e', 'soybean 80, sesame 15', 'm40', {
  ...S,
  a: 'fermented soybean paste',
});

katori.add('Boondi raita', 'n', 'curd 300, besan 30, oil 15', 360, { ...S, a: 'bundi raita' });
katori.add('Beetroot raita', 'a', 'curd 300, beetroot 80', 380, { ...S, a: 'chukandar raita' });
katori.add('Onion salad', 'a', 'onion 150, lemon 10', 160, {
  ...S,
  a: 'pyaz salad; laccha pyaz; sirka pyaz',
});
katori.add('Sirka pyaz', 'n', 'shallots 150, vinegar 40', 190, {
  ...S,
  id: 'sirka-pyaz-vinegar',
  a: 'vinegar onions; sirke wale pyaz',
});
katori.add('Cucumber salad', 'a', 'cucumber 200, lemon 10', 210, { ...S, a: 'kheera salad' });
katori.add('Tomato onion salad', 'a', 'tomato 100, onion 60, cucumber 50, lemon 10', 220, {
  ...S,
  a: 'salad plate',
});
katori.add('Corn salad', 'a', 'sweet-corn 150, capsicum 30, onion 20, lemon 10, olive-oil 5', 215, {
  ...S,
  a: 'sweet corn salad',
});

piece.add('Papad', 'a', 'urad-dal 12', 'm8', {
  ...S,
  p: [1, 'papad', 'papads'],
  a: 'papadum; appalam; roasted papad',
});
piece.add('Roasted papad', 'a', 'urad-dal 12', 'm6', {
  ...S,
  p: [1, 'papad', 'papads'],
  id: 'papad-roasted',
});
piece.add('Fried papad', 'a', 'urad-dal 12, oil 4', 'm5', {
  p: [1, 'papad', 'papads'],
  a: 'tala papad',
});
piece.add('Masala papad', 'n', 'urad-dal 12, onion 15, tomato 15, oil 4', 'm45', {
  p: [1, 'papad', 'papads'],
  a: 'masala papadum',
});
piece.add('Rice papad', 's', 'rice-flour 10, oil 3', 'm5', {
  p: [1, 'papad', 'papads'],
  a: 'arisi appalam; rice appalam',
});
piece.add('Sabudana papad', 'w', 'sabudana 10, oil 3', 'm5', {
  p: [1, 'papad', 'papads'],
  a: 'sago papad; sabudana chakli papad',
});
piece.add('Vadam', 's', 'rice-flour 8, oil 3', 'm4', {
  p: [1, 'vadam', 'vadams'],
  n: 3,
  a: 'vathal; vadagam; sandige',
});
piece.add('Fryums', 'a', 'sabudana 6, cornflour 2, oil 3', 'm4', {
  p: [1, 'fryum', 'fryums'],
  n: 5,
  a: 'fryms; fryums',
});

export const SIDES = [...spoon.out, ...katori.out, ...piece.out];
