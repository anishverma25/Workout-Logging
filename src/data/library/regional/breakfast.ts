import { CURRY, DRY, group, PLATE } from './build';

/** Breakfast and tiffin from every region. Batters are raw grain weights; pieces from the batter. */
const { add, out } = group({ category: 'breakfast', meals: 'bs', units: DRY });

// South: dosa, idli and vada family
add('Set dosa', 's', 'rice 200, urad-dal 40, poha 30, curd 40, oil 15', 'm55', {
  p: [12, 'dosa', 'dosas'],
  n: 3,
  a: 'sponge dosa',
});
add('Neer dosa', 's', 'rice 200, coconut 40, oil 10', 'm62', {
  p: [12, 'dosa', 'dosas'],
  n: 3,
  a: 'neer dose; water dosa',
});
add('Benne dosa', 's', 'rice 200, urad-dal 50, poha 20, butter 40', 'm45', {
  p: [8, 'dosa', 'dosas'],
  n: 2,
  a: 'davangere benne dosa; butter dosa',
});
add(
  'Mysore masala dosa',
  's',
  'rice 120, urad-dal 30, potato 150, onion 40, chilli-powder 3, garlic 5, oil 20, ghee 6, chana-dal 5',
  'm52',
  { p: [4, 'dosa', 'dosas'], a: 'mysore dosa' },
);
add('Ghee roast dosa', 's', 'rice 120, urad-dal 30, ghee 24', 'm40', {
  p: [4, 'dosa', 'dosas'],
  a: 'ghee dosa; nei roast',
});
add(
  'Podi dosa',
  's',
  'rice 120, urad-dal 30, chana-dal 10, urad-dal 5, sesame 4, oil 10, ghee 8',
  'm45',
  { p: [4, 'dosa', 'dosas'], a: 'gunpowder dosa; milagai podi dosa' },
);
add('Ragi dosa', 's', 'ragi 100, rice-flour 30, onion 30, oil 12', 'm55', {
  p: [5, 'dosa', 'dosas'],
  a: 'nachni dosa; finger millet dosa',
});
add('Wheat dosa', 's', 'atta 100, rice-flour 20, onion 20, oil 12', 'm55', {
  p: [5, 'dosa', 'dosas'],
  a: 'godhuma dosa; atta dosa',
});
add('Oats dosa', 's', 'oats 80, rice-flour 30, sooji 20, curd 40, oil 12', 'm55', {
  p: [5, 'dosa', 'dosas'],
  a: 'instant oats dosa',
});
add(
  'Tomato uttapam',
  's',
  'rice 120, urad-dal 30, tomato 60, onion 30, green-chilli 4, oil 16',
  'm55',
  { p: [4, 'uttapam', 'uttapams'], a: 'tomato uthappam' },
);
add('Thatte idli', 's', 'rice 150, urad-dal 50, poha 15', 'm60', {
  p: [5, 'idli', 'idlis'],
  n: 2,
  a: 'plate idli; tatte idli',
});
add(
  'Kanchipuram idli',
  's',
  'rice 150, urad-dal 50, ghee 10, cashews 10, ginger 5, black-pepper 2, cumin 2',
  'm58',
  { p: [10, 'idli', 'idlis'], n: 2, a: 'kancheepuram idli; kovil idli' },
);
add('Podi idli', 's', 'rice 150, urad-dal 50, chana-dal 10, sesame 4, ghee 12, oil 6', 'm55', {
  p: [14, 'idli', 'idlis'],
  n: 4,
  a: 'gunpowder idli; mini podi idli',
});
add(
  'Mini idli sambar',
  's',
  'rice 75, urad-dal 25, toor-dal 25, shallots 30, tomato 30, tamarind 5, oil 6, ghee 5',
  500,
  { s: 2, u: PLATE, a: 'idli sambar bowl; 14 idli' },
);
add(
  'Sambar vada',
  's',
  'urad-dal 100, oil 20, toor-dal 40, shallots 40, tomato 40, tamarind 6, ghee 4',
  600,
  { s: 3, u: PLATE, a: 'sambar vadai; vada sambar' },
);
add('Rasam vada', 's', 'urad-dal 100, oil 20, toor-dal 15, tomato 60, tamarind 8, ghee 4', 600, {
  s: 3,
  u: PLATE,
  a: 'rasam vadai',
});
add('Masala vada', 's', 'chana-dal 150, onion 40, green-chilli 5, ginger 5, oil 35', 'm30', {
  p: [10, 'vada', 'vadas'],
  n: 2,
  a: 'paruppu vadai; chana dal vada; aama vada',
});
add('Keerai vada', 's', 'urad-dal 120, spinach 60, onion 30, oil 30', 'm42', {
  p: [10, 'vada', 'vadas'],
  n: 2,
  a: 'keerai vadai; palak vada',
});
add('Kothu parotta', 's', 'maida 150, oil 30, egg 100, onion 60, tomato 50, chilli-powder 3', 450, {
  s: 2,
  u: PLATE,
  a: 'kothu paratha; kothu porotta',
});
add('Paniyaram', 's', 'rice 120, urad-dal 30, onion 30, oil 18', 'm52', {
  p: [20, 'paniyaram', 'paniyarams'],
  n: 5,
  a: 'kuzhi paniyaram; paddu; guliyappa; appe',
});
add('Ela ada', 's', 'rice-flour 100, coconut 60, jaggery 50, ghee 4', 'm45', {
  p: [6, 'ada', 'adas'],
  a: 'ila ada; elai adai',
});
add('Ragi mudde', 's', 'ragi 100, water 250', 330, {
  p: [2, 'ball', 'balls'],
  a: 'ragi ball; ragi sangati; ragi kali',
});
add('Akki roti', 's', 'rice-flour 100, onion 30, coconut 15, carrot 15, oil 12', 'm38', {
  p: [3, 'roti', 'rotis'],
  a: 'akki rotti; rice roti',
});
add('Ragi roti', 's', 'ragi 100, onion 30, coconut 10, oil 12', 'm38', {
  p: [3, 'roti', 'rotis'],
  a: 'ragi rotti; nachni roti',
});
add(
  'Vangi bath',
  's',
  'rice 200, brinjal 200, oil 30, peanuts 20, chana-dal 10, tamarind 8, coconut-dry 10',
  900,
  { s: 4, u: ['katori', 'serving', 'g'], m: 'a', a: 'vangibath; brinjal rice' },
);
add('Adai', 's', 'rice 80, chana-dal 40, toor-dal 40, urad-dal 20, onion 40, oil 20', 'm48', {
  p: [5, 'adai', 'adais'],
  a: 'adai dosa; adai avial',
});

// West
add(
  'Indori poha',
  'w',
  'poha 150, onion 40, peas 20, peanuts 15, sugar 6, oil 15, lemon 5, besan 8',
  420,
  { s: 2, a: 'indore poha; jeeravan poha' },
);
add('Thalipeeth', 'w', 'jowar 40, bajra 20, besan 20, rice-flour 20, onion 40, oil 15', 'm35', {
  p: [3, 'thalipeeth', 'thalipeeths'],
  a: 'bhajani thalipeeth',
});
add('Dhirde', 'w', 'atta 50, besan 50, onion 30, tomato 20, oil 12', 'm45', {
  p: [4, 'dhirde', 'dhirdes'],
  a: 'dhirda; ghavan',
});
add('Khandvi', 'w', 'besan 100, curd 100, water 200, oil 10, sesame 4, coconut 10', 380, {
  p: [25, 'roll', 'rolls'],
  n: 6,
  m: 's',
  a: 'suralichi vadi; patuli',
});
add(
  'Patra',
  'w',
  'colocasia-leaves 120, besan 100, jaggery 20, tamarind 8, oil 20, sesame 5',
  'm52',
  { p: [16, 'piece', 'pieces'], n: 4, m: 's', a: 'patrode; alu vadi; patrode; paatra' },
);
add('Fafda', 'w', 'besan 100, oil 30', 'm6', {
  p: [10, 'fafda', 'fafdas'],
  n: 4,
  a: 'fafda gathiya',
});
add('Muthia', 'w', 'atta 60, besan 40, lauki 120, curd 20, oil 18, sugar 5, sesame 4', 'm48', {
  p: [16, 'muthia', 'muthias'],
  n: 4,
  m: 's',
  a: 'muthiya; dudhi muthia; steamed muthia',
});
add(
  'Sev khamani',
  'w',
  'chana-dal 150, oil 15, sugar 10, pomegranate 20, coriander 5, besan 20',
  'm48',
  { s: 3, m: 's', a: 'amiri khaman' },
);
add('Gathiya', 'w', 'besan 100, oil 30', 'm5', {
  u: ['g'],
  n: 30,
  m: 's',
  a: 'ganthiya; bhavnagari gathiya',
});
add('Khichu', 'w', 'rice-flour 100, water 250, oil 10, green-chilli 4, cumin 2', 330, {
  s: 2,
  m: 's',
  a: 'papdi no lot; khichiyu',
});
add(
  'Bombay sandwich',
  'w',
  'bread 75, butter 10, potato 50, cucumber 30, tomato 30, onion 15, beetroot 15, coriander 4',
  230,
  {
    p: [1, 'sandwich', 'sandwiches'],
    m: 'bs',
    a: 'mumbai sandwich; bombay veg sandwich; bombay masala sandwich',
  },
);

// North
add('Suji chilla', 'n', 'sooji 60, curd 50, onion 20, tomato 20, oil 10', 'm50', {
  p: [3, 'chilla', 'chillas'],
  a: 'rava chilla; sooji cheela',
});
add('Oats chilla', 'a', 'oats 60, besan 20, onion 20, tomato 20, oil 8', 'm52', {
  p: [3, 'chilla', 'chillas'],
  a: 'oats cheela',
});
add('Stuffed paneer chilla', 'n', 'besan 60, paneer 50, onion 20, tomato 15, oil 10', 'm50', {
  p: [2, 'chilla', 'chillas'],
  a: 'paneer stuffed chilla',
});
add('Moong dal cheela with paneer', 'n', 'moong-dal 60, paneer 50, onion 20, oil 10', 'm52', {
  p: [3, 'cheela', 'cheelas'],
  a: 'moong chilla paneer',
});
add('Poori bhaji', 'n', 'atta 100, oil 30, potato 200, onion 40, tomato 40, oil 12', 520, {
  s: 2,
  u: PLATE,
  m: 'bm',
  a: 'puri bhaji; puri aloo; poori masala',
});
add(
  'Halwa puri',
  'n',
  'atta 70, maida 30, oil 30, sooji 40, ghee 25, sugar 40, kabuli-chana 50',
  520,
  { s: 2, u: PLATE, m: 'bm', a: 'halwa poori; halwa puri chana' },
);
add('Bedmi puri', 'n', 'atta 100, urad-dal 30, oil 32, potato 200, tomato 50, oil 10', 540, {
  s: 2,
  u: PLATE,
  m: 'bm',
  a: 'bedmi poori; bedmi aloo',
});
add('Kachori sabzi', 'n', 'maida 100, moong-dal 30, oil 40, potato 200, tomato 50', 520, {
  s: 2,
  u: PLATE,
  m: 'bm',
  a: 'kachori aloo; khasta kachori sabzi',
});
add('Dahi jalebi', 'n', 'curd 120, maida 25, sugar 35, ghee 9', 190, {
  s: 1,
  u: PLATE,
  m: 'b',
  nofat: true,
  a: 'jalebi dahi',
});
add('Daliya khichdi', 'n', 'dalia 60, moong-dal 30, carrot 30, peas 20, ghee 6', 450, {
  s: 2,
  m: 'bm',
  a: 'dalia khichdi; broken wheat khichdi',
});

// Punjab and Bihar
add('Mooli paratha', 'n', 'atta 45, radish 70, green-chilli 2, ghee 8', 105, {
  p: [1, 'paratha', 'parathas'],
  m: 'bm',
  a: 'mooli parantha; radish paratha',
});
add('Pyaaz paratha', 'n', 'atta 45, onion 45, green-chilli 2, ghee 8', 90, {
  p: [1, 'paratha', 'parathas'],
  m: 'bm',
  a: 'onion paratha; pyaz parantha',
});
add('Missi roti', 'n', 'besan 25, atta 20, onion 10, ghee 4', 'm32', {
  p: [1, 'roti', 'rotis'],
  m: 'm',
  a: 'missi rotti',
});
add('Sattu paratha', 'e', 'atta 45, chana-dal 35, onion 10, mustard-oil 5, ghee 6', 'm28', {
  p: [1, 'paratha', 'parathas'],
  m: 'bm',
  a: 'sattu parantha; sattu bhara paratha',
});
add('Thekua', 'e', 'atta 100, jaggery 40, ghee 20, coconut-dry 10, oil 15', 'm8', {
  p: [8, 'thekua', 'thekuas'],
  m: 's',
  a: 'khajuria; thekwa',
});
add('Chura dahi', 'e', 'poha 60, curd 150, jaggery 20', 230, {
  s: 1,
  u: PLATE,
  m: 'b',
  a: 'chuda dahi; dahi chura; chira doi',
});
add('Dal pitha', 'e', 'rice-flour 100, chana-dal 50, oil 6', 'm55', {
  p: [8, 'pitha', 'pithas'],
  n: 3,
  a: 'dal peetha; dal ki dulhan',
});

// Rajasthan
add('Mirchi vada', 'w', 'besan 60, potato 100, green-chilli 60, oil 30', 'm42', {
  p: [4, 'mirchi vada', 'mirchi vadas'],
  m: 's',
  a: 'mirchi bada; jodhpuri mirchi vada',
});
add('Mawa kachori', 'w', 'maida 60, khoya 40, ghee 25, sugar 40, cashews 5', 'm12', {
  p: [3, 'kachori', 'kachoris'],
  m: 's',
  a: 'mawa kachori jodhpur',
});

// East and north east
add('Kochuri', 'e', 'maida 100, urad-dal 30, oil 35', 'm20', {
  p: [6, 'kochuri', 'kochuris'],
  n: 3,
  a: 'hing kochuri; kachauri',
});
add('Radhaballavi', 'e', 'maida 100, urad-dal 40, ghee 8, oil 30', 'm22', {
  p: [6, 'radhaballavi', 'radhaballavis'],
  n: 3,
  a: 'radhaballabhi; radhaballavi aloo dum',
});
add(
  'Ghugni',
  'e',
  'dry-peas 120, potato 60, onion 40, tomato 40, mustard-oil 15, coconut 10',
  600,
  { s: 3, u: CURRY, m: 'a', a: 'ghugni chaat; matar ghugni' },
);
add(
  'Chirer pulao',
  'e',
  'poha 150, peas 30, potato 40, cashews 10, raisins 8, ghee 15, sugar 8',
  360,
  { s: 2, a: 'chire pulao; chirer polao' },
);
add('Muri ghonto', 'e', 'rohu 120, rice 40, potato 60, onion 40, mustard-oil 20', 500, {
  s: 3,
  u: CURRY,
  m: 'm',
  a: 'murighonto; fish head with rice',
});
add('Pantha bhat', 'e', 'rice 100, water 400, onion 20, green-chilli 4, mustard-oil 4', 500, {
  s: 2,
  u: DRY,
  m: 'm',
  a: 'panta bhat; poita bhat',
});
add('Pakhala', 'e', 'rice 100, water 400, curd 60, cumin 2', 520, {
  s: 2,
  u: DRY,
  m: 'm',
  a: 'pakhala bhata; pakhala bhaata; pakhal',
});
add('Chakuli pitha', 'e', 'rice 100, urad-dal 40, oil 10', 'm55', {
  p: [6, 'chakuli', 'chakulis'],
  n: 3,
  a: 'chakuli; chakuli peetha',
});
add(
  'Dahi bara aloo dum',
  'e',
  'urad-dal 80, oil 22, curd 150, potato 120, kabuli-chana 30, sugar 6',
  520,
  { s: 2, u: PLATE, m: 'bs', a: 'dahibara aludum; cuttack dahi bara' },
);
add('Jadoh', 'e', 'rice 150, pork 150, onion 40, ginger 10, oil 15, turmeric 3', 650, {
  s: 3,
  u: ['katori', 'serving', 'g'],
  m: 'm',
  a: 'jadoh pork rice; ja doh',
});
add('Tungrymbai', 'e', 'soybean 120, onion 40, sesame 15, pork 60, oil 10', 360, {
  s: 3,
  u: CURRY,
  n: 0.5,
  m: 'm',
  a: 'fermented soybean chutney meghalaya',
});
add('Khar', 'e', 'raw-papaya 200, moong-dal 30, mustard-oil 10, ginger 5', 400, {
  s: 3,
  u: CURRY,
  m: 'm',
  a: 'kol khar; omita khar',
});
add('Chira doi', 'e', 'poha 60, curd 120, jaggery 20, banana 50', 250, {
  s: 1,
  u: PLATE,
  m: 'b',
  a: 'chira doi gur; jolpan',
});
add('Singju', 'e', 'cabbage 80, lotus-stem 40, onion 20, besan 15, sesame 6, green-chilli 4', 160, {
  s: 1,
  u: DRY,
  m: 's',
  a: 'singju manipuri salad',
});
add('Chamthong', 'e', 'cabbage 80, peas 40, potato 50, spinach 40, onion 20, oil 3', 400, {
  s: 2,
  u: CURRY,
  m: 'm',
  a: 'kangshoi; manipuri vegetable stew',
});

// Everyday
add('Bread omelette', 'a', 'bread 50, egg 100, onion 20, butter 8, oil 4', 175, {
  p: [1, 'bread omelette', 'bread omelettes'],
  a: 'bread omlet; omelette sandwich',
});
add(
  'Masala omelette',
  'a',
  'egg 100, onion 25, tomato 20, green-chilli 3, coriander 2, oil 6',
  145,
  { p: [1, 'omelette', 'omelettes'], a: 'masala omlet; desi omelette; masala anda' },
);
add('Aloo sandwich', 'a', 'bread 75, potato 70, butter 8, green-chilli 2, onion 10', 160, {
  p: [1, 'sandwich', 'sandwiches'],
  a: 'potato sandwich; aloo toast sandwich',
});
add('Masala toast', 'a', 'bread 75, butter 12, potato 60, onion 15, tomato 15', 170, {
  p: [1, 'toast', 'toasts'],
  a: 'masala toast sandwich; bombay masala toast',
});
add('Oats porridge', 'a', 'oats 40, milk-toned 200, sugar 6', 230, {
  s: 1,
  u: ['katori', 'g'],
  m: 'b',
  a: 'oats with milk; oatmeal; oats kheer',
});
add('Bun parotta', 's', 'maida 120, oil 25, sugar 3', 'm28', {
  p: [3, 'bun parotta', 'bun parottas'],
  m: 'm',
  a: 'madurai bun parotta',
});

export const BREAKFAST = out;
