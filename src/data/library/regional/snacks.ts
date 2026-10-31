import { DRY, group, PLATE } from './build';

/**
 * Snacks, chaat, street food, Indo Chinese starters and restaurant favourites. Deep-fried
 * snacks keep the oil they soak up (about 15 to 25% of their cooked weight); their moisture
 * is the cooked dough's.
 */
const snack = group({ category: 'snack', meals: 's', units: ['piece', 'g'] });
const plate = group({ category: 'snack', meals: 's', units: PLATE });
const PCS = (n: number, one = 'piece', many = 'pieces') =>
  [n, one, many] as [number, string, string];

// Pakoras, bajjis and vadas
snack.add('Onion pakoda', 'a', 'onion 200, besan 80, rice-flour 15, oil 45', 'm25', {
  p: PCS(12, 'pakoda', 'pakodas'),
  n: 4,
  a: 'kanda bhaji; pyaz pakoda; onion bhajiya; vengaya pakoda',
});
snack.add(
  'Mixed veg pakora',
  'a',
  'potato 80, onion 60, cauliflower 60, spinach 30, besan 90, oil 45',
  'm35',
  { p: PCS(14, 'pakora', 'pakoras'), n: 4, a: 'mix pakoda' },
);
snack.add('Palak pakora', 'n', 'spinach 100, besan 80, oil 40', 'm22', {
  p: PCS(14, 'pakora', 'pakoras'),
  n: 4,
  a: 'palak pakoda; spinach fritters',
});
snack.add('Gobi pakora', 'n', 'cauliflower 250, besan 80, oil 45', 'm42', {
  p: PCS(14, 'pakora', 'pakoras'),
  n: 4,
  a: 'gobhi pakoda; cauliflower pakora',
});
snack.add('Aloo bonda', 's', 'potato 250, besan 60, onion 20, oil 35', 'm48', {
  p: PCS(8, 'bonda', 'bondas'),
  n: 2,
  a: 'batata vada; aloo bonda; potato bonda',
});
snack.add('Mysore bonda', 's', 'maida 100, curd 60, rice-flour 20, oil 35', 'm30', {
  p: PCS(10, 'bonda', 'bondas'),
  n: 3,
  a: 'goli baje; mangalore bonda',
});
snack.add('Mangalore bajji', 's', 'maida 100, curd 60, oil 35', 'm30', {
  p: PCS(10, 'bajji', 'bajjis'),
  n: 3,
  id: 'mangalore-goli-bajji',
  a: 'goli bajji',
});
snack.add('Mangalore buns', 's', 'maida 100, banana 60, sugar 15, curd 20, oil 25', 'm25', {
  p: PCS(4, 'bun', 'buns'),
  n: 2,
  a: 'banana buns; mangalore banana puri',
});
snack.add('Raw banana bajji', 's', 'raw-banana 150, besan 60, rice-flour 10, oil 35', 'm40', {
  p: PCS(10, 'bajji', 'bajjis'),
  n: 3,
  a: 'vazhakkai bajji; aratikaya bajji; kacche kele ke pakode',
});
snack.add('Onion bajji', 's', 'onion 150, besan 60, rice-flour 10, oil 35', 'm35', {
  p: PCS(10, 'bajji', 'bajjis'),
  n: 3,
  a: 'vengaya bajji; ulli bajji',
});
snack.add('Parippu vada', 's', 'chana-dal 150, shallots 40, oil 35', 'm28', {
  p: PCS(10, 'vada', 'vadas'),
  n: 2,
  a: 'parippu vadai; dal vada kerala',
});
snack.add('Uzhunnu vada', 's', 'urad-dal 150, onion 20, oil 35', 'm40', {
  p: PCS(9, 'vada', 'vadas'),
  n: 2,
  a: 'uzhunnu vadai; ulundu vada',
});
snack.add('Ulli vada', 's', 'onion 200, maida 40, rice-flour 30, oil 40', 'm30', {
  p: PCS(8, 'vada', 'vadas'),
  n: 2,
  a: 'ulli vadai; onion vada kerala',
});
snack.add('Dal vada', 's', 'chana-dal 120, urad-dal 30, onion 30, oil 35', 'm30', {
  p: PCS(10, 'vada', 'vadas'),
  n: 2,
  a: 'dal vadai',
});
snack.add('Chana dal vada', 's', 'chana-dal 150, onion 30, oil 35', 'm28', {
  p: PCS(10, 'vada', 'vadas'),
  n: 2,
  a: 'chana vada; dal wada',
});
snack.add('Kothimbir vadi', 'w', 'coriander 100, besan 100, oil 30, sesame 5', 'm40', {
  p: PCS(12, 'vadi', 'vadis'),
  n: 3,
  a: 'kothimbir wadi; coriander vadi',
});
snack.add(
  'Alu vadi',
  'w',
  'colocasia-leaves 100, besan 90, jaggery 15, tamarind 6, oil 30',
  'm40',
  { p: PCS(14, 'vadi', 'vadis'), n: 3, a: 'aluvadi; patra fried' },
);
snack.add('Sukhiyan', 's', 'moong-whole 100, jaggery 60, coconut 30, maida 40, oil 30', 'm22', {
  p: PCS(8, 'sukhiyan', 'sukhiyans'),
  n: 2,
  a: 'sukhiyan kerala',
});

// Kerala bakery and fried snacks
snack.add('Banana chips', 's', 'raw-banana 250, oil 45', 'm4', {
  u: ['g'],
  n: 30,
  a: 'kerala banana chips; nendran chips; kaya chips; upperi',
});
snack.add('Kaya varuthathu', 's', 'raw-banana 250, oil 45', 'm4', {
  u: ['g'],
  n: 30,
  a: 'kaya varuthathu; kaya upperi',
});
snack.add('Sarkara upperi', 's', 'raw-banana 200, oil 35, jaggery 50', 'm4', {
  u: ['g'],
  n: 30,
  a: 'sharkara varatti; sweet banana chips',
});
snack.add('Tapioca chips', 's', 'tapioca-root 300, oil 45', 'm4', {
  u: ['g'],
  n: 30,
  a: 'kappa chips; cassava chips',
});
snack.add('Jackfruit chips', 's', 'jackfruit 300, oil 45', 'm4', {
  u: ['g'],
  n: 30,
  a: 'chakka chips; chakka varuthathu',
});
snack.add('Kuzhalappam', 's', 'rice-flour 100, coconut 20, oil 25', 'm4', {
  p: PCS(15, 'kuzhalappam', 'kuzhalappams'),
  n: 3,
  a: 'kuzhal appam',
});
snack.add('Achappam', 's', 'rice-flour 100, egg 25, coconut-milk 60, sugar 15, oil 30', 'm4', {
  p: PCS(18, 'achappam', 'achappams'),
  n: 3,
  a: 'rose cookies; achu murukku',
});
snack.add('Chakka varattiyathu', 's', 'jackfruit 300, jaggery 120, ghee 20', 'm25', {
  u: ['tbsp', 'g'],
  n: 2,
  nofat: true,
  a: 'jackfruit halwa; chakka varatti',
});

// South and west savouries
snack.add('Mixture', 's', 'besan 80, rice-flour 30, peanuts 20, poha 20, oil 40', 'm3', {
  u: ['g'],
  n: 30,
  a: 'south indian mixture; madras mixture; kerala mixture',
});
snack.add('Kara boondi', 's', 'besan 100, oil 40, peanuts 10', 'm3', {
  u: ['g'],
  n: 30,
  a: 'khara boondi; masala boondi',
});
snack.add('Thattai', 's', 'rice-flour 100, urad-dal 10, chana-dal 10, butter 8, oil 30', 'm3', {
  p: PCS(15, 'thattai', 'thattais'),
  n: 3,
  a: 'nippattu; chekkalu',
});
snack.add('Seedai', 's', 'rice-flour 100, urad-dal 10, coconut 15, butter 8, oil 35', 'm3', {
  u: ['g'],
  n: 30,
  a: 'uppu seedai',
});
snack.add('Medu vada chaat', 's', 'urad-dal 60, oil 15, curd 100, sugar 6, tamarind 6', 220, {
  s: 1,
  u: PLATE,
  a: 'vada chaat',
});
snack.add('Idli fry', 's', 'rice 100, urad-dal 35, oil 25', 'm40', {
  s: 2,
  u: PLATE,
  a: 'fried idli; idli fry masala',
});
snack.add('Idli 65', 's', 'rice 100, urad-dal 35, cornflour 10, oil 30', 'm38', {
  s: 2,
  u: PLATE,
  a: 'idli sixty five',
});
snack.add('Baby corn 65', 's', 'sweet-corn 250, cornflour 30, rice-flour 15, oil 35', 'm55', {
  s: 3,
  u: PLATE,
  a: 'baby corn fry',
});
snack.add('Revdi', 'n', 'sesame 50, sugar 60, jaggery 10', 'm3', {
  u: ['g'],
  n: 20,
  id: 'til-revdi',
  a: 'rewri; revri; til revdi',
});
snack.add('Namak pare', 'n', 'maida 100, ghee 10, oil 25', 'm3', {
  u: ['g'],
  n: 30,
  a: 'namakpare; nimki; namak para',
});
snack.add('Shakarpara', 'n', 'maida 100, sugar 40, ghee 15, oil 25', 'm3', {
  u: ['g'],
  n: 30,
  a: 'shakarpare; shankarpali; shakkarpare',
});
snack.add('Mathri', 'n', 'maida 100, ghee 20, oil 25', 'm3', {
  p: PCS(10, 'mathri', 'mathris'),
  n: 2,
  a: 'mathiya; mathi snack',
});
snack.add('Shankarpali', 'w', 'maida 100, sugar 35, ghee 15, milk 30, oil 25', 'm3', {
  u: ['g'],
  n: 30,
  id: 'shankarpali-sweet',
  a: 'shankarpale; sweet diamond cuts',
});
snack.add('Chorafali', 'w', 'besan 80, urad-dal 20, oil 35', 'm3', {
  u: ['g'],
  n: 30,
  a: 'chorafali gujarati',
});
snack.add('Karanji', 'w', 'maida 100, coconut-dry 50, sugar 50, ghee 15, oil 30', 'm8', {
  p: PCS(10, 'karanji', 'karanjis'),
  n: 2,
  a: 'karanji maharashtrian; nevri',
});
snack.add('Til chikki', 'w', 'sesame 100, jaggery 100, ghee 5', 'm3', {
  p: PCS(10, 'piece', 'pieces'),
  n: 1,
  nofat: true,
  a: 'sesame chikki; tilpatti',
});
snack.add(
  'Dry fruit chikki',
  'w',
  'almonds 40, cashews 40, pistachios 20, jaggery 100, ghee 5',
  'm3',
  { p: PCS(10, 'piece', 'pieces'), n: 1, nofat: true, a: 'dry fruit chikki' },
);
snack.add('Gur til ladoo', 'w', 'sesame 100, jaggery 90, peanuts 20, ghee 5', 'm4', {
  p: PCS(12, 'ladoo', 'ladoos'),
  n: 1,
  nofat: true,
  a: 'tilgul ladoo; til gud ladoo',
});
snack.add('Bhujia sev', 'w', 'besan 100, oil 35', 'm3', {
  u: ['g'],
  n: 30,
  a: 'bikaneri bhujia',
});
snack.add('Ratlami sev', 'w', 'besan 100, oil 35', 'm3', {
  u: ['g'],
  n: 30,
  a: 'ratlami sev namkeen',
});
snack.add('Sev', 'a', 'besan 100, oil 33', 'm3', {
  u: ['g'],
  n: 20,
  id: 'plain-sev',
  a: 'nylon sev; besan sev',
});
snack.add('Chana jor garam', 'a', 'kala-chana 100, oil 10', 'm6', {
  u: ['g'],
  n: 30,
  a: 'chana jor; chana zor garam',
});
snack.add('Chana chur', 'a', 'besan 60, peanuts 25, kabuli-chana 20, oil 35', 'm3', {
  u: ['g'],
  n: 30,
  a: 'chanachur; chana choor',
});
snack.add('Roasted peanuts', 'a', 'peanuts 100', 'm2', {
  u: ['g'],
  n: 30,
  a: 'mungfali; roasted groundnuts; bhuni moongfali',
});
snack.add('Peanut masala', 'a', 'peanuts 100, onion 40, tomato 40, lemon 5', 175, {
  u: DRY,
  n: 0.5,
  d: 0.7,
  a: 'masala peanut; peanut chaat',
});
snack.add('Boiled peanuts', 'a', 'peanuts 100, water 60', 'm40', {
  u: ['g'],
  n: 60,
  a: 'ubli shengdana; sundal peanuts',
});
snack.add('Makhana chaat', 'a', 'lotus-seeds 30, onion 20, tomato 20, ghee 4', 72, {
  u: DRY,
  n: 1,
  d: 0.35,
  a: 'phool makhana chaat',
});

// Bengal, Kolkata and Bihar
snack.add('Telebhaja', 'e', 'potato 80, onion 60, brinjal 60, besan 80, mustard-oil 45', 'm35', {
  p: PCS(12, 'piece', 'pieces'),
  n: 4,
  a: 'tele bhaja; bengali fritters',
});
snack.add('Beguni', 'e', 'brinjal 200, besan 70, mustard-oil 40', 'm45', {
  p: PCS(10, 'beguni', 'begunis'),
  n: 2,
  a: 'begun bhaja batter',
});
snack.add('Aloor chop', 'e', 'potato 250, besan 60, mustard-oil 35', 'm48', {
  p: PCS(8, 'chop', 'chops'),
  n: 2,
  a: 'alur chop; aloo chop',
});
snack.add('Mochar chop', 'e', 'banana-flower 200, potato 100, bread 25, oil 35', 'm52', {
  p: PCS(8, 'chop', 'chops'),
  n: 2,
  a: 'banana flower chop',
});
snack.add('Egg chop', 'e', 'egg 200, potato 150, bread 30, oil 35', 'm55', {
  p: PCS(4, 'chop', 'chops'),
  n: 1,
  a: 'dimer chop',
});
snack.add('Fish kabiraji', 'e', 'bhetki 300, egg 100, maida 20, oil 40', 'm58', {
  p: PCS(4, 'cutlet', 'cutlets'),
  n: 1,
  a: 'fish kobiraji; fish kaviraji',
});
snack.add('Chicken kabiraji', 'e', 'chicken 300, egg 100, maida 20, oil 40', 'm58', {
  p: PCS(4, 'cutlet', 'cutlets'),
  n: 1,
  a: 'chicken kobiraji; kabiraji cutlet',
});
snack.add('Moghlai paratha', 'e', 'maida 60, egg 50, mutton-mince 30, onion 20, oil 20', 'm42', {
  p: PCS(1, 'paratha', 'parathas'),
  m: 'sd',
  a: 'mughlai paratha; mughlai porota',
});
snack.add('Ghotala', 'e', 'egg 100, kala-chana 50, onion 30, tomato 30, butter 10', 280, {
  s: 1,
  u: PLATE,
  a: 'ghotala kolkata',
});
snack.add('Churmur', 'e', 'maida 25, oil 10, potato 60, kala-chana 20, tamarind 10', 140, {
  s: 1,
  u: PLATE,
  a: 'churmur chaat; papri churmur',
});
snack.add('Aloo kabli', 'e', 'potato 150, dry-peas 25, tamarind 10, onion 15', 230, {
  s: 1,
  u: PLATE,
  a: 'aloo kabuli; alu kabli',
});
snack.add('Ghugni chaat', 'e', 'dry-peas 60, onion 20, tamarind 8, oil 6', 230, {
  s: 1,
  u: PLATE,
  a: 'ghugni chat',
});

// North Indian chaat and street food
snack.add('Hara bhara kabab', 'n', 'spinach 150, peas 100, potato 150, besan 20, oil 30', 'm55', {
  p: PCS(10, 'kabab', 'kababs'),
  n: 3,
  a: 'hara bhara kebab',
});
snack.add(
  'Veg seekh kebab',
  'n',
  'potato 150, carrot 60, beans 60, peas 60, paneer 60, besan 20, oil 20',
  'm55',
  { p: PCS(8, 'seekh', 'seekhs'), n: 2, a: 'vegetable seekh' },
);
snack.add('Dahi kebab', 'n', 'greek-yogurt 200, paneer 50, besan 15, bread 30, oil 30', 'm48', {
  p: PCS(10, 'kebab', 'kebabs'),
  n: 3,
  a: 'dahi ke kabab; dahi kabab',
});
snack.add('Rajma galouti', 'n', 'rajma 120, ghee 25, onion 30, besan 10', 'm55', {
  p: PCS(10, 'kebab', 'kebabs'),
  n: 3,
  a: 'rajma galouti kebab',
});
snack.add('Veg kebab', 'a', 'potato 200, carrot 60, beans 60, peas 60, bread 30, oil 25', 'm58', {
  p: PCS(10, 'kebab', 'kebabs'),
  n: 3,
  a: 'vegetable kebab',
});
snack.add('Beetroot tikki', 'a', 'beetroot 150, potato 150, poha 30, oil 20', 'm60', {
  p: PCS(8, 'tikki', 'tikkis'),
  n: 2,
  a: 'beetroot cutlet',
});
snack.add('Sabudana tikki', 'a', 'sabudana 100, potato 150, peanuts 30, oil 20', 'm50', {
  p: PCS(8, 'tikki', 'tikkis'),
  n: 2,
  a: 'sabudana cutlet',
});
snack.add('Veg cutlet', 'a', 'potato 200, carrot 60, beans 50, peas 50, bread 40, oil 30', 'm55', {
  p: PCS(8, 'cutlet', 'cutlets'),
  n: 2,
  a: 'vegetable cutlet',
});
snack.add(
  'Corn cheese balls',
  'a',
  'sweet-corn 100, potato 100, cheese 50, bread 30, oil 35',
  'm45',
  { p: PCS(12, 'ball', 'balls'), n: 4, a: 'cheese corn balls' },
);
snack.add('Cheese balls', 'a', 'cheese 100, potato 100, maida 20, bread 30, oil 35', 'm40', {
  p: PCS(12, 'ball', 'balls'),
  n: 4,
  a: 'cheese balls fried',
});
snack.add('Cheese sticks', 'a', 'mozzarella 150, maida 25, bread 40, egg 25, oil 30', 'm40', {
  p: PCS(8, 'stick', 'sticks'),
  n: 3,
  a: 'mozzarella sticks',
});
snack.add('Paneer puff', 'a', 'puff-pastry 40, paneer 30, onion 10, oil 2', 76, {
  p: PCS(1, 'puff', 'puffs'),
  a: 'paneer patties; paneer pattice',
});
snack.add('Chicken puff', 'a', 'puff-pastry 40, chicken 35, onion 10, oil 2', 76, {
  p: PCS(1, 'puff', 'puffs'),
  a: 'chicken patties; chicken pattice',
});
snack.add('Veg roll', 'a', 'maida 60, potato 50, cabbage 30, carrot 20, oil 12', 'm45', {
  p: PCS(1, 'roll', 'rolls'),
  a: 'veg frankie; vegetable roll',
});
snack.add('Kathi kebab', 'a', 'maida 60, chicken 80, onion 20, egg 25, oil 12', 'm45', {
  p: PCS(1, 'roll', 'rolls'),
  m: 'sd',
  a: 'kathi kabab roll',
});
snack.add(
  'Shami kebab roll',
  'a',
  'maida 60, mutton-mince 50, chana-dal 10, onion 20, oil 12',
  'm45',
  { p: PCS(1, 'roll', 'rolls'), m: 'sd', a: 'shami roll' },
);
snack.add('Potato wedges', 'a', 'potato 300, oil 20, cornflour 10', 230, {
  u: DRY,
  n: 1,
  d: 0.5,
  a: 'wedges; masala wedges',
});
snack.add('Stuffed potato', 'a', 'potato 300, cheese 40, butter 15, sweet-corn 30', 360, {
  s: 2,
  u: PLATE,
  a: 'baked potato stuffed; loaded potato',
});
snack.add('Masala corn', 'a', 'sweet-corn 150, butter 8, lemon 5', 150, {
  u: DRY,
  n: 1,
  d: 0.7,
  a: 'masala corn cup; corn chaat masala',
});
snack.add('Cheese corn', 'a', 'sweet-corn 150, cheese 25, butter 8', 175, {
  u: DRY,
  n: 1,
  d: 0.7,
  a: 'cheese corn cup',
});
snack.add('Cheese dosa', 's', 'rice 120, urad-dal 30, cheese 60, oil 12, butter 8', 'm45', {
  p: PCS(4, 'dosa', 'dosas'),
  m: 'bs',
  a: 'cheese dosai',
});
snack.add(
  'Pizza dosa',
  's',
  'rice 120, urad-dal 30, mozzarella 60, capsicum 40, onion 30, tomato 30, ketchup 20, oil 12',
  'm50',
  { p: PCS(4, 'dosa', 'dosas'), m: 'bs', a: 'dosa pizza' },
);
snack.add(
  'Schezwan dosa',
  's',
  'rice 120, urad-dal 30, cabbage 40, capsicum 30, egg-noodles 20, oil 20, soy-sauce 5',
  'm50',
  { p: PCS(4, 'dosa', 'dosas'), m: 'bs', a: 'szechuan dosa' },
);
snack.add('Peri peri chicken', 'a', 'chicken 400, oil 20, lemon 15, chilli-powder 8', 300, {
  s: 3,
  u: PLATE,
  m: 'sd',
  a: 'piri piri chicken',
});
snack.add(
  'Chicken tikka sandwich',
  'a',
  'bread 75, chicken 70, curd 15, butter 8, onion 15, mayonnaise 10',
  180,
  { p: PCS(1, 'sandwich', 'sandwiches'), a: 'tikka sandwich' },
);
snack.add(
  'Paneer tikka sandwich',
  'a',
  'bread 75, paneer 60, curd 15, butter 8, capsicum 15, mayonnaise 10',
  175,
  { p: PCS(1, 'sandwich', 'sandwiches'), a: 'paneer tikka grilled sandwich' },
);
snack.add(
  'Veg grilled sandwich',
  'a',
  'bread 75, potato 40, capsicum 15, tomato 20, cucumber 20, cheese 15, butter 10',
  185,
  { p: PCS(1, 'sandwich', 'sandwiches'), a: 'veg grill sandwich' },
);
snack.add('Cheese sandwich', 'a', 'bread 75, cheese 30, butter 8', 112, {
  p: PCS(1, 'sandwich', 'sandwiches'),
  id: 'plain-cheese-sandwich',
  a: 'cheese toast sandwich',
});
snack.add('Jam sandwich', 'a', 'bread 75, sugar 12, strawberries 8, butter 5', 98, {
  p: PCS(1, 'sandwich', 'sandwiches'),
  a: 'bread jam; jam toast',
});
snack.add('Butter bread', 'a', 'bread 50, butter 8', 58, {
  p: PCS(1, 'serving', 'servings'),
  a: 'bread butter; butter toast',
});
snack.add('Peanut butter sandwich', 'a', 'bread 75, peanut-butter 30', 105, {
  p: PCS(1, 'sandwich', 'sandwiches'),
  a: 'pb sandwich',
});
snack.add('Egg chaat', 'n', 'egg 100, onion 20, tomato 20, lemon 5', 140, {
  s: 1,
  u: PLATE,
  a: 'anda chaat',
});
snack.add('Kanji vada', 'w', 'moong-dal 60, oil 15, water 300, mustard-seeds 5', 380, {
  s: 2,
  u: ['glass', 'g'],
  a: 'kanji wada',
});

// Mumbai
plate.add(
  'Sukha bhel',
  'w',
  'puffed-rice 40, besan 10, oil 5, onion 20, tomato 20, peanuts 10, lemon 5',
  105,
  { s: 1, a: 'dry bhel; sukhi bhel' },
);
plate.add(
  'Cheese pav bhaji',
  'w',
  'potato 120, peas 30, tomato 70, capsicum 25, butter 25, cheese 30, bread 80',
  360,
  { s: 1, a: 'cheese pao bhaji' },
);
plate.add('Ice gola', 'w', 'water 150, sugar 40', 190, {
  s: 1,
  u: ['piece', 'g'],
  p: PCS(1, 'gola', 'golas'),
  a: 'baraf gola; chuski; gola',
});

// Momos
snack.add('Fried momos', 'a', 'maida 120, cabbage 60, carrot 30, onion 30, oil 35', 'm42', {
  p: PCS(10, 'momo', 'momos'),
  n: 6,
  a: 'fried veg momos',
});
snack.add('Kurkure momos', 'a', 'maida 120, cabbage 60, carrot 30, cornflour 30, oil 45', 'm38', {
  p: PCS(10, 'momo', 'momos'),
  n: 6,
  a: 'crispy momos',
});
snack.add('Afghani momos', 'a', 'maida 120, chicken 100, cream 40, cashews 15, butter 15', 'm50', {
  p: PCS(10, 'momo', 'momos'),
  n: 6,
  a: 'afghani chicken momos',
});
snack.add('Pan fried momos', 'a', 'maida 120, cabbage 60, carrot 30, oil 15', 'm50', {
  p: PCS(10, 'momo', 'momos'),
  n: 6,
  a: 'pan fried dumplings',
});
snack.add('Tandoori momos', 'a', 'maida 120, chicken 100, curd 40, oil 15', 'm52', {
  p: PCS(10, 'momo', 'momos'),
  n: 6,
  a: 'tandoori chicken momos',
});

// Indo Chinese and restaurant
snack.add(
  'Veg spring roll',
  'a',
  'maida 60, cabbage 80, carrot 40, egg-noodles 15, oil 30',
  'm40',
  { p: PCS(6, 'roll', 'rolls'), n: 2, a: 'spring rolls veg; spring roll' },
);
snack.add(
  'Chicken spring roll',
  'a',
  'maida 60, chicken 80, cabbage 50, carrot 30, oil 30',
  'm45',
  { p: PCS(6, 'roll', 'rolls'), n: 2, a: 'chicken spring rolls' },
);
plate.add(
  'Baby corn manchurian',
  'a',
  'sweet-corn 250, cornflour 30, maida 20, oil 40, capsicum 50, soy-sauce 10',
  380,
  { s: 3, a: 'babycorn manchurian' },
);
plate.add('Crispy corn', 'a', 'sweet-corn 250, cornflour 40, oil 35, capsicum 30, onion 30', 300, {
  s: 3,
  a: 'crispy corn kernels; salt and pepper corn',
});
plate.add('Honey chilli potato', 'a', 'potato 300, cornflour 40, oil 40, honey 25, sesame 6', 360, {
  s: 3,
  a: 'honey chilli potatoes',
});
plate.add(
  'Chilli potato',
  'a',
  'potato 300, cornflour 40, oil 40, capsicum 50, soy-sauce 10',
  380,
  { s: 3, a: 'chilly potato' },
);
plate.add(
  'Crispy chilli baby corn',
  'a',
  'sweet-corn 250, cornflour 35, oil 40, capsicum 40, soy-sauce 10',
  320,
  { s: 3, a: 'chilli baby corn' },
);
plate.add('Veg lollipop', 'a', 'potato 150, carrot 60, cabbage 60, cornflour 30, oil 35', 'm50', {
  s: 3,
  a: 'vegetable lollipop',
});
plate.add(
  'Chinese bhel',
  'a',
  'egg-noodles 100, oil 30, cabbage 60, carrot 30, capsicum 30, ketchup 20',
  280,
  { s: 2, a: 'chinese bhel puri' },
);
plate.add('Dim sum', 'a', 'maida 100, cabbage 50, prawns 60, oil 6', 'm52', {
  s: 3,
  a: 'dimsum; steamed dumplings',
});
plate.add(
  'Chop suey',
  'a',
  'egg-noodles 100, oil 50, cabbage 60, carrot 40, capsicum 40, cornflour 15, soy-sauce 10',
  450,
  { s: 3, id: 'chopsuey-veg', a: 'chinese chop suey' },
);
plate.add(
  'Veg chowmein',
  'a',
  'egg-noodles 150, cabbage 80, carrot 40, capsicum 40, oil 25, soy-sauce 10',
  600,
  { s: 3, a: 'veg chow mein; street chowmein' },
);
plate.add(
  'Egg noodles',
  'a',
  'egg-noodles 150, egg 100, cabbage 60, carrot 30, oil 25, soy-sauce 10',
  620,
  { s: 3, id: 'egg-hakka-noodles', a: 'egg hakka noodles; egg chowmein' },
);
plate.add(
  'Triple schezwan',
  'a',
  'egg-noodles 80, rice 100, oil 50, cabbage 60, capsicum 40, cornflour 15, soy-sauce 10',
  650,
  { s: 3, id: 'triple-schezwan-plate', a: 'triple szechuan' },
);
plate.add(
  'Schezwan chicken',
  'a',
  'chicken 350, cornflour 25, oil 40, capsicum 60, onion 60, soy-sauce 12',
  450,
  { s: 3, id: 'schezwan-chicken-gravy', a: 'chicken schezwan gravy' },
);
plate.add(
  'Veg manchow soup',
  'a',
  'cabbage 50, carrot 40, beans 30, cornflour 15, egg-noodles 20, oil 15, soy-sauce 10',
  750,
  { s: 3, u: ['katori', 'g'], a: 'manchow soup; veg manchow' },
);
plate.add('Sweet corn chicken soup', 'a', 'chicken 80, sweet-corn 150, cornflour 20, egg 30', 800, {
  s: 3,
  u: ['katori', 'g'],
  id: 'sweet-corn-chicken-soup-plain',
  a: 'chicken corn soup',
});
plate.add('Wonton soup', 'a', 'maida 60, chicken 80, cabbage 40, oil 4', 800, {
  s: 3,
  u: ['katori', 'g'],
  a: 'wanton soup',
});

// Western, Middle Eastern, Thai and Italian favourites
plate.add(
  'Cheeseburger',
  'a',
  'bread 70, beef-mince 90, cheese 20, lettuce 10, tomato 15, ketchup 10',
  200,
  { s: 1, a: 'cheese burger' },
);
plate.add(
  'Veg club sandwich',
  'a',
  'bread 100, potato 40, cucumber 30, tomato 30, cheese 20, mayonnaise 15, butter 10',
  245,
  { s: 1, a: 'club sandwich veg' },
);
plate.add('Falafel', 'a', 'falafel 100', 100, {
  s: 1,
  u: ['piece', 'g'],
  p: PCS(6, 'falafel', 'falafels'),
  id: 'falafel-pieces',
  a: 'falafel balls',
});
plate.add(
  'Shawarma',
  'a',
  'pita 80, chicken 90, mayonnaise 20, lettuce 15, tomato 15, onion 10, oil 8',
  220,
  {
    s: 1,
    u: ['piece', 'g'],
    p: PCS(1, 'shawarma', 'shawarmas'),
    a: 'chicken shawarma roll; shawarma wrap',
  },
);
plate.add('Mutabbal', 'a', 'brinjal 300, sesame 30, curd 40, olive-oil 15', 340, {
  s: 4,
  u: ['tbsp', 'g'],
  a: 'baba ganoush; moutabal',
});
plate.add('Kebab platter', 'a', 'chicken 300, mutton-mince 150, curd 50, oil 25', 380, {
  s: 2,
  a: 'mixed grill platter',
});
plate.add('Mandi rice', 'a', 'rice 250, chicken 400, onion 80, ghee 30, oil 20', 1150, {
  s: 4,
  u: ['katori', 'serving', 'g'],
  d: 0.72,
  m: 'm',
  a: 'chicken mandi; mandi',
});
plate.add('Kuzhi mandi', 's', 'rice 250, chicken 450, onion 80, ghee 30', 1150, {
  s: 4,
  u: ['katori', 'serving', 'g'],
  d: 0.72,
  m: 'm',
  a: 'kuzhimanthi',
});
plate.add('Arabian rice', 'a', 'rice 250, chicken 300, onion 80, ghee 30', 1050, {
  s: 4,
  u: ['katori', 'serving', 'g'],
  d: 0.72,
  m: 'm',
  a: 'arabic rice',
});
plate.add(
  'Alfaham chicken',
  's',
  'chicken 400, chicken-thigh 100, curd 50, oil 15, lemon 15',
  380,
  { s: 3, m: 'm', a: 'al faham; alfahm' },
);
plate.add('Shawai', 's', 'chicken 400, chicken-thigh 100, oil 12, lemon 15', 360, {
  s: 3,
  m: 'm',
  a: 'chicken shawaya; shawaya',
});
plate.add(
  'Thai green curry',
  'a',
  'chicken 300, coconut-milk 300, beans 60, capsicum 60, oil 15',
  750,
  { s: 4, u: ['katori', 'g'], m: 'm', a: 'green curry chicken' },
);
plate.add(
  'Thai red curry',
  'a',
  'chicken 300, coconut-milk 300, capsicum 60, oil 15, sugar 5',
  750,
  { s: 4, u: ['katori', 'g'], m: 'm', a: 'red curry chicken' },
);
plate.add(
  'Veg Thai curry',
  'a',
  'tofu 150, coconut-milk 300, broccoli 80, capsicum 60, beans 60, oil 12',
  750,
  { s: 4, u: ['katori', 'g'], m: 'm', a: 'thai curry vegetable' },
);
plate.add(
  'Pad thai',
  'a',
  'rice-noodles 150, egg 50, tofu 60, peanuts 25, oil 25, sugar 15, soy-sauce 10',
  600,
  { s: 2, m: 'm', a: 'phad thai' },
);
plate.add('Tom yum soup', 'a', 'prawns 100, mushroom 80, tomato 60, lime 15', 800, {
  s: 3,
  u: ['katori', 'g'],
  m: 'm',
  a: 'tom yum',
});
plate.add(
  'Cheese burst pizza',
  'a',
  'maida 120, mozzarella 90, cheese 40, capsicum 30, onion 30, ketchup 20, oil 10',
  'm40',
  { u: ['piece', 'g'], p: PCS(6, 'slice', 'slices'), n: 3, m: 'sd', a: 'cheese burst' },
);
plate.add('Pepperoni pizza', 'a', 'maida 120, mozzarella 80, bacon 50, ketchup 20, oil 8', 'm40', {
  u: ['piece', 'g'],
  p: PCS(6, 'slice', 'slices'),
  n: 3,
  m: 'sd',
  a: 'pepperoni',
});
plate.add(
  'Pink sauce pasta',
  'a',
  'pasta-cooked 300, tomato 100, cream 50, cheese 20, butter 15',
  470,
  { s: 2, m: 'm', a: 'mix sauce pasta; rosa pasta' },
);
plate.add('Tandoori platter', 'n', 'chicken 400, paneer 100, curd 80, oil 25', 480, {
  s: 2,
  m: 'sd',
  a: 'tandoori mix platter',
});
plate.add('Veg platter', 'n', 'paneer 150, potato 150, mushroom 80, curd 60, oil 25', 420, {
  s: 2,
  m: 'sd',
  a: 'veg kebab platter',
});
plate.add('Non veg platter', 'n', 'chicken 300, mutton-mince 120, fish 100, curd 60, oil 25', 460, {
  s: 2,
  m: 'sd',
  a: 'non veg kebab platter',
});
plate.add(
  'Sizzler',
  'a',
  'rice 60, potato 80, paneer 70, carrot 40, beans 40, butter 12, oil 8',
  420,
  { s: 1, m: 'm', a: 'veg sizzler' },
);
plate.add('Veg steak', 'a', 'paneer 120, potato 150, butter 15, broccoli 60', 330, {
  s: 1,
  m: 'm',
  a: 'cottage cheese steak',
});
plate.add(
  'Tandoori chicken wrap',
  'a',
  'flour-tortilla 70, chicken 80, curd 15, onion 15, mayonnaise 10',
  180,
  { s: 1, u: ['piece', 'g'], p: PCS(1, 'wrap', 'wraps'), a: 'chicken tikka wrap' },
);
plate.add('Protein pancake', 'a', 'oats 40, egg 100, banana 60, whey 15, oil 4', 'm52', {
  s: 1,
  u: ['piece', 'g'],
  p: PCS(3, 'pancake', 'pancakes'),
  n: 3,
  m: 'bs',
  a: 'protein pancakes',
});
plate.add('Oats banana pancake', 'a', 'oats 50, banana 100, egg 50, milk 40, oil 5', 'm55', {
  s: 1,
  u: ['piece', 'g'],
  p: PCS(3, 'pancake', 'pancakes'),
  n: 3,
  m: 'bs',
  a: 'banana oats pancake',
});

export const SNACKS = [...snack.out, ...plate.out];
