import { CURRY, DRY, group } from './build';

/**
 * Vegetable curries and sabzis. Dry sabzis lose about a fifth of their raw weight in the pan
 * and fill a katori loosely (0.65 g per ml, as the curated aloo gobhi); gravies are weighed
 * as the finished pot.
 */
const curry = group({ category: 'sabzi', meals: 'm', units: CURRY });
const dry = group({ category: 'sabzi', meals: 'm', units: DRY });
const L = 0.65;

// North
curry.add('Aloo dum', 'n', 'potato 500, curd 100, onion 80, tomato 120, oil 35, cashews 10', 800, {
  s: 4,
  a: 'dum aloo; punjabi dum aloo; aloo dum curry',
});
curry.add(
  'Dum aloo Banarasi',
  'n',
  'potato 500, tomato 120, curd 60, ghee 25, cashews 15, cream 20',
  780,
  { s: 4, a: 'banarasi dum aloo' },
);
dry.add('Aloo baingan', 'n', 'potato 250, brinjal 300, onion 60, tomato 60, oil 30', 560, {
  s: 4,
  d: L,
  a: 'aloo began; baingan aloo',
});
dry.add('Aloo palak', 'n', 'potato 250, spinach 400, onion 50, garlic 10, oil 25', 520, {
  s: 4,
  d: L,
  a: 'palak aloo; spinach potato',
});
curry.add('Aloo tamatar', 'n', 'potato 400, tomato 250, oil 25, ginger 5', 800, {
  s: 4,
  a: 'aloo tamatar ki sabzi; aloo tamatar rasedar',
});
curry.add('Rasedar aloo', 'n', 'potato 400, tomato 120, oil 20, water 300', 850, {
  s: 4,
  a: 'aloo ka jhol; aloo ki sabzi gravy',
});
dry.add('Kurkuri bhindi', 'n', 'okra 300, besan 30, cornflour 10, oil 40', 260, {
  s: 3,
  d: 0.5,
  a: 'crispy bhindi; kurkuri okra',
});
dry.add('Bhindi do pyaza', 'n', 'okra 300, onion 150, tomato 50, oil 30', 400, {
  s: 3,
  d: L,
  a: 'bhindi do pyaaza; okra do pyaza',
});
dry.add('Bhindi ki sabzi dry', 'n', 'okra 400, onion 60, oil 25', 380, {
  s: 3,
  d: L,
  a: 'sukhi bhindi; bhindi fry',
});
curry.add('Baingan masala', 'n', 'brinjal 400, onion 100, tomato 120, oil 35, peanuts 20', 650, {
  s: 4,
  a: 'baingan ki sabzi; brinjal masala; masala baingan',
});
curry.add('Lauki kofta', 'n', 'lauki 400, besan 60, oil 40, onion 60, tomato 120, cream 20', 800, {
  s: 4,
  a: 'ghiya kofta; dudhi kofta',
});
curry.add(
  'Malai kofta',
  'n',
  'paneer 150, potato 150, maida 15, oil 40, cashews 30, cream 50, tomato 150, onion 60',
  850,
  { s: 4, a: 'malai kofta curry' },
);
dry.add('Tori sabzi', 'n', 'ridge-gourd 500, onion 50, tomato 50, oil 20', 450, {
  s: 4,
  d: L,
  a: 'turai ki sabzi; tori ki sabzi; ridge gourd sabzi',
});
curry.add('Tinda masala', 'n', 'tinda 450, onion 60, tomato 100, oil 25', 560, {
  s: 4,
  a: 'tinde ki sabzi; tinda curry; apple gourd sabzi',
});
dry.add('Karela fry', 'n', 'karela 300, onion 80, oil 30', 280, {
  s: 3,
  d: L,
  a: 'bitter gourd fry',
});
dry.add('Bharwa karela', 'n', 'karela 300, onion 80, besan 15, oil 35', 320, {
  s: 3,
  d: L,
  a: 'stuffed karela; bharwan karela',
});
dry.add('Kathal sabzi', 'n', 'raw-jackfruit 500, onion 80, tomato 80, oil 35', 520, {
  s: 4,
  d: L,
  a: 'kathal ki sabzi; jackfruit sabzi; echor',
});
curry.add(
  'Kathal biryani',
  'n',
  'rice 250, raw-jackfruit 300, onion 120, curd 100, oil 30, ghee 10',
  1150,
  { s: 5, u: ['katori', 'serving', 'g'], d: 0.72, a: 'jackfruit biryani' },
);
dry.add('Gobi masala', 'n', 'cauliflower 500, onion 70, tomato 100, oil 30', 520, {
  s: 4,
  d: L,
  a: 'gobhi masala; cauliflower masala',
});
curry.add(
  'Gobi musallam',
  'n',
  'cauliflower 500, onion 80, tomato 120, curd 60, cashews 20, oil 35, cream 20',
  750,
  { s: 4, a: 'gobhi musallam' },
);
dry.add('Palak sabzi', 'n', 'spinach 600, onion 60, garlic 10, oil 20', 380, {
  s: 4,
  d: L,
  a: 'palak ki sabzi; sookha palak',
});
curry.add(
  'Methi malai matar',
  'n',
  'peas 250, cream 60, cashews 20, onion 60, butter 15, oil 10, milk 80',
  650,
  { s: 4, a: 'methi matar malai' },
);
dry.add('Methi sabzi', 'n', 'methi-leaves 300, potato 150, oil 20, garlic 6', 340, {
  s: 4,
  d: L,
  a: 'aloo methi sukhi; methi ki sabzi; methi bhaji',
});
curry.add('Kadai mushroom', 'n', 'mushroom 400, capsicum 100, onion 100, tomato 150, oil 30', 700, {
  s: 4,
  a: 'kadhai mushroom',
});
curry.add('Mushroom do pyaza', 'n', 'mushroom 400, onion 200, tomato 80, oil 30', 650, {
  s: 4,
  a: 'mushroom do pyaaza',
});
curry.add(
  'Navratan korma',
  'n',
  'carrot 60, beans 60, peas 60, potato 80, cauliflower 60, paneer 60, cashews 25, cream 50, pineapple 40, oil 25',
  800,
  { s: 4, a: 'navratna korma; nav ratan korma' },
);
curry.add(
  'Veg korma',
  'a',
  'carrot 60, beans 60, peas 60, potato 100, coconut 50, cashews 20, onion 50, oil 25',
  800,
  { s: 4, a: 'vegetable korma; veg kurma' },
);
curry.add(
  'Kurma',
  's',
  'potato 100, carrot 60, beans 60, peas 60, coconut 60, cashews 10, onion 50, oil 20',
  800,
  { s: 4, a: 'vegetable kurma; veg kuruma; hotel kurma' },
);
curry.add(
  'Veg kolhapuri',
  'w',
  'carrot 60, beans 60, peas 60, cauliflower 80, potato 80, coconut-dry 20, onion 60, tomato 100, oil 30',
  750,
  { s: 4, a: 'vegetable kolhapuri' },
);
curry.add(
  'Veg handi',
  'n',
  'carrot 60, beans 60, peas 60, cauliflower 80, paneer 60, onion 60, tomato 100, cream 30, oil 25',
  780,
  { s: 4, a: 'vegetable handi; subz handi' },
);
curry.add(
  'Veg makhanwala',
  'n',
  'carrot 60, beans 60, peas 60, cauliflower 80, tomato 200, butter 30, cream 40, cashews 15',
  800,
  { s: 4, a: 'vegetable makhanwala; veg makhani' },
);
curry.add(
  'Veg kadai',
  'n',
  'capsicum 120, carrot 60, beans 60, cauliflower 100, paneer 50, onion 80, tomato 150, oil 30',
  750,
  { s: 4, a: 'kadai vegetable; veg kadhai' },
);
curry.add('Dahi bhindi', 'n', 'okra 300, curd 200, besan 10, oil 25', 520, {
  s: 4,
  a: 'bhindi dahi wali',
});
curry.add('Dahi aloo', 'n', 'potato 400, curd 200, oil 20', 700, {
  s: 4,
  a: 'dahi wale aloo; aloo dahi curry',
});
dry.add('Tindora sabzi', 'n', 'tindora 400, onion 50, oil 20', 380, {
  s: 4,
  d: L,
  a: 'tendli sabzi; kundru ki sabzi; tondli bhaji; dondakaya fry',
});
dry.add('Gawar phali', 'n', 'gawar 350, potato 80, oil 20', 380, {
  s: 4,
  d: L,
  a: 'gawar ki sabzi; guar phali; cluster beans sabzi; gavarfali',
});
dry.add('Sem ki phali', 'n', 'broad-beans 350, potato 80, oil 20', 380, {
  s: 4,
  d: L,
  a: 'sem ki sabzi; broad beans sabzi',
});
dry.add('Cabbage matar', 'n', 'cabbage 400, peas 100, oil 20', 420, {
  s: 4,
  d: L,
  a: 'patta gobhi matar; bandh gobhi matar',
});
dry.add('Carrot beans', 'a', 'carrot 200, beans 200, oil 18, coconut 20', 360, {
  s: 4,
  d: L,
  a: 'gajar beans; carrot beans poriyal',
});
dry.add('Gajar matar', 'n', 'carrot 300, peas 150, oil 20', 400, {
  s: 4,
  d: L,
  a: 'gajar matar ki sabzi',
});
dry.add('Gajar methi', 'n', 'carrot 300, potato 80, oil 20', 340, {
  s: 4,
  d: L,
  a: 'gajar methi ki sabzi',
});
dry.add('Beetroot sabzi', 'a', 'beetroot 400, onion 40, oil 15, coconut 20', 380, {
  s: 4,
  d: L,
  a: 'chukandar ki sabzi; beetroot poriyal',
});
dry.add('Suran sabzi', 'w', 'yam 400, onion 40, oil 25', 380, {
  s: 4,
  d: L,
  a: 'jimikand ki sabzi; yam fry; elephant yam sabzi; senai roast',
});
dry.add('Petha sabzi', 'n', 'pumpkin 500, oil 18, jaggery 10', 420, {
  s: 4,
  d: L,
  a: 'kaddu ki sabzi khatti meethi; sitaphal ki sabzi',
});
dry.add('Parwal sabzi', 'e', 'parwal 400, potato 100, oil 25', 400, {
  s: 4,
  d: L,
  a: 'parwal ki sabzi; potoler torkari; parwal aloo',
});

// Kashmir, Uttarakhand, Himachal
curry.add('Kashmiri dum olav', 'n', 'potato 500, curd 150, mustard-oil 40', 720, {
  s: 4,
  a: 'dum oluv; kashmiri dum aloo',
});
curry.add('Kashmiri rajma', 'n', 'rajma 150, onion 40, tomato 60, mustard-oil 15', 800, {
  s: 4,
  a: 'kashmiri rajmah; bhaderwahi rajma',
});
curry.add('Haak', 'n', 'sarson 500, mustard-oil 20', 450, {
  s: 4,
  a: 'haak saag; kashmiri collard greens',
});
curry.add('Nadru yakhni', 'n', 'lotus-stem 400, curd 250, mustard-oil 25', 650, {
  s: 4,
  a: 'nadur yakhni; lotus stem yakhni',
});
dry.add('Nadru monje', 'n', 'lotus-stem 250, rice-flour 50, oil 40', 260, {
  s: 3,
  d: 0.5,
  m: 's',
  a: 'nadru monji; lotus stem fritters',
});
curry.add('Rogan josh veg', 'n', 'potato 250, paneer 150, curd 120, mustard-oil 30', 650, {
  s: 4,
  a: 'veg rogan josh; paneer rogan josh',
});
curry.add('Chok vangun', 'n', 'brinjal 400, tamarind 25, mustard-oil 35', 500, {
  s: 4,
  a: 'chok wangun; kashmiri sour brinjal',
});
curry.add('Gucchi', 'n', 'mushroom 300, curd 100, ghee 25, onion 40', 450, {
  s: 4,
  a: 'gucchi pulao; morel curry; kashmiri gucchi',
});
dry.add('Pahadi aloo', 'n', 'potato 500, mustard-oil 25, sesame 10', 450, {
  s: 4,
  d: L,
  a: 'pahari aloo; aloo ke gutke',
});
dry.add('Aloo ke gutke', 'n', 'potato 500, mustard-oil 30', 440, {
  s: 4,
  d: L,
  a: 'aloo ke gutke kumaoni',
});
curry.add('Kafuli', 'n', 'spinach 400, rice-flour 30, curd 50, ghee 15', 600, {
  s: 4,
  a: 'kafuli garhwali; palak kafuli',
});
curry.add('Chainsoo', 'n', 'urad-dal 120, ghee 15, onion 20', 650, {
  s: 4,
  a: 'chainsu; kali dal chainsoo',
});
curry.add('Bhatt ki churkani', 'n', 'soybean 120, rice-flour 20, ghee 15', 650, {
  s: 4,
  a: 'bhat ki churdkani; black soybean curry',
});
curry.add('Phaanu', 'n', 'horse-gram 120, spinach 100, oil 15', 650, {
  s: 4,
  a: 'phanu; gahat ka phaanu',
});
curry.add('Madra', 'n', 'kabuli-chana 150, curd 250, ghee 25', 800, {
  s: 4,
  a: 'chana madra; himachali madra',
});
curry.add('Dham', 'n', 'rajma 80, rice 120, curd 150, ghee 25, kabuli-chana 60', 1000, {
  s: 4,
  u: ['serving', 'g'],
  a: 'himachali dham plate',
});
curry.add('Siddu', 'n', 'atta 120, poppy-seeds 10, walnuts 15, ghee 15', 'm40', {
  p: [3, 'siddu', 'siddus'],
  m: 'bs',
  a: 'sidu; himachali siddu',
});
curry.add('Babru', 'n', 'atta 80, maida 20, urad-dal 40, oil 25', 'm25', {
  p: [4, 'babru', 'babrus'],
  m: 'bs',
  a: 'bhatoora babru; himachali kachori',
});

// Gujarat, Sindh, Konkan, Maharashtra
dry.add('Sev tamatar', 'w', 'tomato 400, besan 40, oil 30, jaggery 10', 450, {
  s: 4,
  d: 0.75,
  a: 'sev tameta; sev tamatar ki sabzi',
});
curry.add('Sev tameta nu shaak', 'w', 'tomato 400, besan 40, oil 30, jaggery 15', 500, {
  s: 4,
  a: 'sev tameta shaak',
});
curry.add(
  'Undhiyu',
  'w',
  'yam 100, sweet-potato 100, potato 80, brinjal 100, val 60, peas 60, raw-banana 60, besan 40, atta 20, coconut 40, oil 60',
  900,
  { s: 5, a: 'undhiyo; surti undhiyu' },
);
dry.add('Ringna batata', 'w', 'brinjal 300, potato 200, oil 25', 450, {
  s: 4,
  d: L,
  a: 'ringan bateta nu shaak; ringna bateta',
});
dry.add(
  'Bharela ringan',
  'w',
  'brinjal 400, peanuts 30, besan 15, sesame 5, jaggery 8, oil 30',
  450,
  { s: 4, d: L, a: 'bharela ringna; stuffed brinjal gujarati' },
);
curry.add('Dudhi chana dal nu shaak', 'w', 'lauki 400, chana-dal 60, oil 18', 650, {
  s: 4,
  a: 'dudhi chana nu shaak',
});
dry.add('Sukhi bhaji', 'w', 'potato 450, oil 25, peanuts 15', 420, {
  s: 4,
  d: L,
  a: 'batata bhaji; aloo bhaji maharashtrian; sukhi aloo',
});
dry.add('Aloo bhaji', 'w', 'potato 450, onion 50, oil 25', 430, {
  s: 4,
  d: L,
  id: 'aloo-bhaji-maharashtra',
  a: 'batatyachi bhaji; puri bhaji sabzi',
});
dry.add('Methi na muthia', 'w', 'atta 100, besan 50, oil 30, sugar 8', 'm35', {
  p: [16, 'muthia', 'muthias'],
  m: 's',
  a: 'methi muthiya',
});
dry.add('Gavarfali sabzi', 'w', 'gawar 350, oil 20, jaggery 5', 360, {
  s: 4,
  d: L,
  a: 'gavar nu shaak; gavar bhaji',
});
curry.add('Sai bhaji', 'w', 'spinach 400, chana-dal 60, tomato 80, potato 60, oil 20', 700, {
  s: 4,
  a: 'sindhi sai bhaji',
});
curry.add('Sindhi koki', 'w', 'atta 120, onion 30, ghee 15', 'm28', {
  p: [3, 'koki', 'kokis'],
  u: ['piece', 'g'],
  m: 'bm',
  a: 'sindhi koki roti',
});
dry.add('Kankoda', 'w', 'karela 300, onion 30, oil 20', 280, {
  s: 3,
  d: L,
  a: 'kantola; spiny gourd sabzi; kakrol bhaja',
});
curry.add('Pithla', 'w', 'besan 100, onion 60, oil 25, garlic 8', 550, {
  s: 4,
  a: 'pitla; pithla bhakri',
});
dry.add('Zunka', 'w', 'besan 120, onion 100, oil 30', 360, {
  s: 4,
  d: 0.7,
  a: 'zunka bhakri; jhunka',
});
dry.add(
  'Bharli vangi',
  'w',
  'brinjal 400, peanuts 40, coconut-dry 20, sesame 8, oil 35, jaggery 10',
  480,
  { s: 4, d: L, a: 'bharleli vangi; stuffed brinjal maharashtrian' },
);
curry.add(
  'Shevgyachya shenga',
  'w',
  'drumstick 300, coconut-dry 20, besan 15, oil 20, jaggery 6',
  600,
  { s: 4, a: 'shevga amti; drumstick curry maharashtrian' },
);
curry.add(
  'Kanda batata rassa',
  'w',
  'potato 300, onion 120, tomato 80, coconut-dry 20, oil 25',
  750,
  { s: 4, a: 'batata rassa; kanda batata rassa bhaji' },
);
curry.add('Mataki chi usal', 'w', 'moth-bean 150, onion 60, coconut-dry 20, oil 20', 750, {
  s: 4,
  a: 'matki usal kolhapuri',
});
curry.add('Patal bhaji', 'w', 'spinach 300, chana-dal 30, peanuts 20, besan 20, oil 15', 650, {
  s: 4,
  a: 'aluchi patal bhaji; ambadi patal bhaji',
});
curry.add('Sabji pav', 'w', 'potato 150, peas 50, tomato 80, butter 15, oil 10, bread 120', 500, {
  s: 2,
  u: ['serving', 'g'],
  m: 'a',
  a: 'usal pav; bhaji pav',
});
dry.add('Tondli fry', 'w', 'tindora 400, oil 25, coconut 20', 380, {
  s: 4,
  d: L,
  a: 'tendli fry; tondli bhaji',
});

// Bengal
dry.add('Aloo posto', 'e', 'potato 400, poppy-seeds 40, mustard-oil 25', 420, {
  s: 4,
  d: L,
  a: 'alu posto; aloo posta',
});
curry.add('Aloor dom', 'e', 'potato 500, tomato 100, curd 50, mustard-oil 30, sugar 8', 750, {
  s: 4,
  a: 'alur dom; bengali aloo dum',
});
dry.add('Begun bhaja', 'e', 'brinjal 300, mustard-oil 40', 230, {
  s: 4,
  d: 0.6,
  a: 'baigun bhaja; fried brinjal slices',
});
dry.add('Begun pora', 'e', 'brinjal 400, onion 30, mustard-oil 12', 300, {
  s: 3,
  d: 0.8,
  a: 'begun pora bengali; baingan bharta bengali',
});
dry.add('Posto bora', 'e', 'poppy-seeds 60, rice-flour 15, mustard-oil 30', 'm20', {
  p: [6, 'bora', 'boras'],
  m: 's',
  a: 'poppy seed fritters',
});
curry.add(
  'Shukto',
  'e',
  'karela 60, raw-banana 80, sweet-potato 80, brinjal 80, drumstick 60, milk 100, mustard-seeds 5, ghee 15, oil 10',
  600,
  { s: 4, a: 'shukto bengali; sukto' },
);
dry.add(
  'Chorchori',
  'e',
  'pumpkin 150, potato 100, brinjal 100, raw-banana 80, mustard-oil 20',
  420,
  { s: 4, d: L, a: 'charchari; mixed veg chorchori' },
);
curry.add(
  'Labra',
  'e',
  'pumpkin 150, potato 100, raw-banana 80, brinjal 80, radish 60, ghee 15, oil 10',
  600,
  { s: 4, a: 'labda; bhog labra' },
);
curry.add(
  'Dhokar dalna',
  'e',
  'chana-dal 120, mustard-oil 40, potato 100, tomato 80, ghee 10',
  650,
  { s: 4, a: 'dhoka dalna' },
);
curry.add(
  'Niramish',
  'e',
  'cauliflower 100, potato 100, peas 60, carrot 50, ghee 15, oil 10',
  450,
  { s: 4, a: 'niramish torkari; niramish alur dom' },
);
curry.add('Echor', 'e', 'raw-jackfruit 400, potato 100, tomato 60, mustard-oil 30', 650, {
  s: 4,
  a: 'echorer dalna; kathal dalna',
});
dry.add(
  'Mochar ghonto',
  'e',
  'banana-flower 400, potato 80, coconut 30, mustard-oil 20, ghee 8',
  450,
  { s: 4, d: L, a: 'mochar ghonto bengali' },
);
dry.add('Thor ghonto', 'e', 'banana-stem 400, coconut 30, mustard-oil 15', 380, {
  s: 4,
  d: L,
  a: 'thor chorchori; banana stem stir fry',
});
dry.add('Alu bhaja', 'e', 'potato 300, mustard-oil 30', 230, {
  s: 3,
  d: 0.55,
  a: 'aloo bhaja; bengali fried potato',
});
dry.add('Kumro bhaja', 'e', 'pumpkin 300, rice-flour 15, mustard-oil 25', 240, {
  s: 3,
  d: 0.6,
  a: 'kumror bhaja; fried pumpkin',
});
curry.add('Lau ghonto', 'e', 'lauki 500, moong-dal 30, milk 60, ghee 12', 550, {
  s: 4,
  a: 'lau ghonto bengali; bottle gourd ghonto',
});
dry.add('Dhonepata', 'e', 'coriander 100, mustard-oil 8', 70, {
  s: 4,
  u: ['tbsp', 'g'],
  d: 0.9,
  a: 'dhone pata bata; coriander leaf paste',
});
curry.add('Potol dolma', 'e', 'parwal 300, paneer 80, raisins 10, mustard-oil 30, tomato 60', 450, {
  s: 4,
  a: 'potoler dolma; stuffed parwal',
});
curry.add('Koraishutir kochuri', 'e', 'maida 100, peas 80, oil 35', 'm25', {
  p: [6, 'kochuri', 'kochuris'],
  m: 'bs',
  a: 'koraishutir kochuri; matar kachori bengali',
});
curry.add('Machher kalia', 'e', 'rohu 400, potato 80, onion 80, curd 50, mustard-oil 35', 700, {
  s: 4,
  u: CURRY,
  a: 'macher kalia; fish kalia',
  id: 'machher-kalia',
});
curry.add('Chhanar dalna', 'e', 'paneer 200, potato 120, tomato 80, ghee 15, oil 15', 600, {
  s: 4,
  a: 'chanar dalna; paneer dalna',
});

// Odisha, Assam, north east, Himalaya
curry.add(
  'Besara',
  'e',
  'pumpkin 150, potato 100, raw-banana 80, mustard-seeds 15, mustard-oil 20',
  550,
  { s: 4, a: 'besara odia; mixed veg besara' },
);
curry.add('Chhena tarkari', 'e', 'paneer 200, potato 120, tomato 80, oil 20', 600, {
  s: 4,
  a: 'chhena tarkari odia',
});
curry.add('Dahi baigana', 'e', 'brinjal 250, curd 250, oil 25', 520, {
  s: 4,
  a: 'dahi baigan odia',
});
curry.add('Alu potala rasa', 'e', 'parwal 250, potato 150, tomato 60, oil 25', 600, {
  s: 4,
  a: 'aloo potala rasa',
});
dry.add('Kakharu phula bhaja', 'e', 'pumpkin 100, rice-flour 30, mustard-oil 25', 'm40', {
  p: [8, 'piece', 'pieces'],
  m: 's',
  a: 'pumpkin flower fritters',
});
curry.add('Masor tenga', 'e', 'rohu 400, tomato 200, lemon 15, mustard-oil 25', 750, {
  s: 4,
  a: 'masor tenga assamese; fish tenga; maasor tenga',
});
dry.add('Pitika', 'e', 'potato 300, mustard-oil 10, onion 20', 300, {
  s: 3,
  d: 0.8,
  a: 'aloo pitika; alu pitika',
});
curry.add('Bhut jolokia chutney', 'e', 'tomato 150, green-chilli 20, mustard-oil 8', 160, {
  s: 8,
  u: ['tbsp', 'g'],
  d: 1,
  a: 'bhut jolokia pickle chutney',
});
dry.add('Bengena bhaji', 'e', 'brinjal 300, mustard-oil 30', 230, {
  s: 3,
  d: 0.6,
  a: 'bengena bhaja; assamese brinjal fry',
});
curry.add('Eromba', 'e', 'potato 150, beans 100, bamboo-shoot 60, green-chilli 10', 300, {
  s: 3,
  a: 'iromba; manipuri eromba',
});
curry.add('Kangsoi', 'e', 'cabbage 150, potato 100, peas 50, onion 30', 450, {
  s: 3,
  a: 'kangshoi; manipuri stew',
});
curry.add('Bamboo shoot curry', 'e', 'bamboo-shoot 300, potato 100, mustard-oil 15', 450, {
  s: 4,
  a: 'bamboo shoot sabzi',
});
dry.add('Dohneiiong', 'e', 'pork 400, sesame 40, onion 60, oil 15', 450, {
  s: 4,
  d: 0.75,
  a: 'doh neiiong; pork with black sesame',
});
curry.add('Axone', 'e', 'soybean 80, pork 300, tomato 80, oil 10', 500, {
  s: 4,
  a: 'akhuni; axone pork',
});
curry.add('Smoked pork with bamboo shoot', 'e', 'pork 400, bamboo-shoot 150, oil 10', 450, {
  s: 4,
  a: 'naga pork; smoked pork naga',
});
curry.add(
  'Veg thukpa',
  'a',
  'egg-noodles 100, cabbage 60, carrot 40, spinach 40, onion 30, oil 10',
  900,
  { s: 3, a: 'vegetable thukpa' },
);
dry.add('Shapta', 'a', 'beef 300, onion 80, capsicum 60, oil 20', 380, {
  s: 3,
  d: 0.75,
  a: 'shabtak; sha phaley',
});
curry.add('Phagshapa', 'a', 'pork 200, pork-belly 80, radish 200, oil 5', 450, {
  s: 4,
  a: 'phaksha paa; pork with radish',
});
curry.add('Gundruk', 'a', 'spinach 150, tomato 50, potato 50, oil 6', 500, {
  s: 3,
  a: 'gundruk soup; gundruk ko jhol',
});
curry.add('Ema datshi', 'a', 'green-chilli 100, cheese 100, onion 40, tomato 40, butter 10', 350, {
  s: 4,
  a: 'ema datse; bhutanese chilli cheese',
});
curry.add('Sel roti', 'a', 'rice-flour 150, sugar 40, ghee 10, oil 35, milk 60', 'm22', {
  p: [6, 'sel roti', 'sel rotis'],
  u: ['piece', 'g'],
  m: 'bs',
  nofat: false,
  a: 'nepali sel roti',
});
dry.add('Skyu', 'n', 'atta 100, potato 80, carrot 40, onion 30, oil 6', 900, {
  s: 3,
  u: CURRY,
  a: 'ladakhi skyu',
});
dry.add('Chutagi', 'n', 'atta 100, potato 60, spinach 40, oil 6', 900, {
  s: 3,
  u: CURRY,
  a: 'chhutagi; ladakhi pasta soup',
});
dry.add('Khambir', 'n', 'atta 150', 'm38', {
  p: [2, 'khambir', 'khambirs'],
  u: ['piece', 'g'],
  m: 'bm',
  a: 'ladakhi bread',
});
dry.add('Thukpa Ladakhi', 'n', 'egg-noodles 100, mutton 100, onion 40, spinach 40, oil 8', 900, {
  s: 3,
  u: CURRY,
  a: 'ladakhi thukpa',
});

// South
dry.add('Gobi fry', 's', 'cauliflower 400, besan 30, rice-flour 20, oil 35', 360, {
  s: 3,
  d: 0.55,
  a: 'cauliflower fry; gobi poriyal',
});
curry.add(
  'Drumstick sambar',
  's',
  'toor-dal 75, drumstick 150, onion 50, tomato 50, tamarind 10, oil 10',
  900,
  { s: 5, a: 'murungakkai sambar' },
);
curry.add('Drumstick curry', 's', 'drumstick 300, onion 60, tomato 80, coconut 40, oil 20', 600, {
  s: 4,
  a: 'murungakkai kuzhambu; munagakaya curry',
});
dry.add('Drumstick leaves', 's', 'drumstick-leaves 250, coconut 30, oil 10, moong-dal 20', 300, {
  s: 4,
  d: L,
  a: 'murungai keerai poriyal; moringa leaves sabzi',
});
dry.add('Beetroot poriyal', 's', 'beetroot 400, coconut 30, oil 12', 370, {
  s: 4,
  d: L,
  a: 'beetroot thoran; beetroot palya',
});
dry.add('Raw banana fry', 's', 'raw-banana 400, oil 30, chilli-powder 3', 330, {
  s: 4,
  d: L,
  a: 'vazhakkai fry; aratikaya vepudu; kachha kela fry',
});
curry.add('Raw banana curry', 's', 'raw-banana 400, onion 50, tomato 60, oil 20', 600, {
  s: 4,
  a: 'kachhe kele ki sabzi; vazhakkai curry',
});
curry.add('Plantain stem curry', 's', 'banana-stem 300, moong-dal 30, curd 100, oil 8', 450, {
  s: 4,
  a: 'vazhaithandu kootu; banana stem kootu',
});
curry.add('Banana flower curry', 's', 'banana-flower 300, chana-dal 30, coconut 30, oil 15', 400, {
  s: 4,
  a: 'vazhaipoo poriyal; banana flower poriyal',
});
dry.add('Yam fry', 's', 'yam 400, rice-flour 15, oil 30', 340, {
  s: 4,
  d: L,
  a: 'senai roast; chena fry; suran fry',
});
curry.add('Kootu curry', 's', 'chana-dal 50, raw-banana 100, yam 100, coconut 50, oil 12', 550, {
  s: 4,
  a: 'koottu curry kerala',
});
curry.add('Tomato curry', 's', 'tomato 400, onion 60, coconut 20, oil 15', 520, {
  s: 4,
  a: 'tomato kura; thakkali kuzhambu',
});
curry.add('Ennai kathirikai', 's', 'brinjal 300, oil 40, tamarind 15, sesame 10, peanuts 15', 450, {
  s: 4,
  a: 'ennai kathirikai kuzhambu; gutti vankaya curry',
});
curry.add('Sorakkai kootu', 's', 'lauki 400, moong-dal 50, coconut 30, oil 6', 600, {
  s: 4,
  a: 'surakkai kootu; bottle gourd kootu',
});
curry.add('Pumpkin kootu', 's', 'pumpkin 400, moong-dal 50, coconut 30, oil 6', 600, {
  s: 4,
  a: 'parangikai kootu',
});
dry.add('Avarakkai poriyal', 's', 'broad-beans 350, coconut 30, oil 10', 340, {
  s: 4,
  d: L,
  a: 'avarai poriyal; flat beans poriyal',
});
dry.add('Vazhakkai podimas', 's', 'raw-banana 350, coconut 30, oil 12', 320, {
  s: 4,
  d: L,
  a: 'raw banana podimas',
});
dry.add('Paruppu usili', 's', 'beans 300, toor-dal 40, chana-dal 30, oil 25', 380, {
  s: 4,
  d: L,
  a: 'beans paruppu usili',
});
curry.add(
  'Chettinad veg',
  's',
  'carrot 80, beans 80, potato 100, peas 60, coconut 40, onion 60, tomato 80, oil 30',
  750,
  { s: 4, a: 'chettinad vegetable curry' },
);
curry.add('Poondu kuzhambu', 's', 'garlic 80, tamarind 25, shallots 40, oil 30', 450, {
  s: 4,
  a: 'poondu kulambu; garlic kuzhambu',
});
curry.add('Vendakkai kuzhambu', 's', 'okra 200, tamarind 25, shallots 40, oil 25', 500, {
  s: 4,
  a: 'vendakkai puli kuzhambu',
});
curry.add('Kathirikkai kuzhambu', 's', 'brinjal 250, tamarind 25, shallots 40, oil 25', 500, {
  s: 4,
  a: 'brinjal kuzhambu',
});
curry.add('Tapioca curry', 's', 'tapioca-root 500, coconut 50, shallots 30, oil 12', 600, {
  s: 4,
  a: 'kappa puzhukku; kappa vevichathu; tapioca mash',
});
curry.add(
  'Kappa and fish curry',
  's',
  'tapioca-root 300, sardine 200, coconut 40, tamarind 10, oil 20',
  700,
  { s: 3, u: ['serving', 'g'], a: 'kappa meen curry; kappa mathi' },
);
curry.add('Chembu', 's', 'colocasia 350, coconut 40, oil 12', 400, {
  s: 4,
  a: 'chembu curry; chepankizhangu; arbi kerala',
});
dry.add('Mezhukkupuratti', 's', 'beans 200, raw-banana 100, oil 20, shallots 30', 300, {
  s: 4,
  d: L,
  a: 'mezhukkupuratti kerala; beans upperi',
});
dry.add('Cheera thoran', 's', 'amaranth-leaves 400, coconut 40, oil 10', 320, {
  s: 4,
  d: L,
  a: 'cheera thoran; red amaranth thoran; thotakura fry',
});
curry.add('Kerala veg curry', 's', 'carrot 80, beans 80, potato 100, coconut 60, oil 15', 600, {
  s: 4,
  a: 'kerala mixed vegetable curry',
});
curry.add('Ulli theeyal', 's', 'shallots 250, coconut 80, tamarind 15, oil 15', 500, {
  s: 4,
  a: 'ulli theeyal kerala; small onion theeyal',
});
curry.add('Theeyal', 's', 'brinjal 150, shallots 100, coconut 80, tamarind 15, oil 15', 520, {
  s: 4,
  a: 'vazhuthananga theeyal; theeyal kerala',
});
curry.add(
  'Kerala veg stew',
  's',
  'potato 150, carrot 60, beans 50, peas 40, coconut-milk 250, oil 10',
  650,
  { s: 4, a: 'ishtu; vegetable stew kerala' },
);
curry.add('Beetroot pachadi', 's', 'beetroot 150, curd 150, coconut 30, oil 4', 330, {
  s: 4,
  a: 'beetroot kichadi',
});
curry.add('Kumbalanga', 's', 'ash-gourd 400, coconut-milk 120, oil 8', 500, {
  s: 4,
  a: 'kumbalanga curry; ash gourd curry',
});
curry.add('Gutti vankaya', 's', 'brinjal 350, peanuts 40, sesame 15, coconut-dry 20, oil 35', 520, {
  s: 4,
  a: 'gutti vankaya kura; stuffed brinjal andhra',
});
curry.add('Vankaya curry', 's', 'brinjal 400, onion 60, tomato 60, oil 25', 550, {
  s: 4,
  a: 'vankaya kura',
});
curry.add('Gongura', 's', 'gongura 300, onion 60, oil 30', 280, {
  s: 6,
  u: ['tbsp', 'g'],
  d: 1,
  a: 'gongura pachadi andhra; gongura chutney curry',
});
curry.add('Tomato pappu', 's', 'toor-dal 150, tomato 150, oil 12', 850, {
  s: 4,
  a: 'tomato pappu andhra',
});
dry.add('Dondakaya fry', 's', 'tindora 400, oil 25, peanuts 15', 380, {
  s: 4,
  d: L,
  a: 'dondakaya vepudu; ivy gourd fry',
});
dry.add('Bendakaya fry', 's', 'okra 400, oil 30, peanuts 15', 360, {
  s: 4,
  d: L,
  a: 'bendakaya vepudu; okra fry andhra',
});
dry.add('Aratikaya vepudu', 's', 'raw-banana 400, oil 30', 330, {
  s: 4,
  d: L,
  a: 'aratikaya fry; raw banana fry andhra',
});
curry.add(
  'Pulusu',
  's',
  'brinjal 100, drumstick 80, onion 60, tamarind 25, jaggery 10, oil 20',
  600,
  { s: 4, a: 'vegetable pulusu; mukkala pulusu' },
);
curry.add('Perugu pachadi', 's', 'curd 250, cucumber 80, onion 20, oil 4', 340, {
  s: 4,
  a: 'perugu pachadi andhra; curd chutney',
});
dry.add('Kosambari', 's', 'moong-dal 60, cucumber 100, carrot 60, coconut 20, lemon 10', 260, {
  s: 3,
  d: 0.75,
  m: 'a',
  a: 'kosambari salad; hesarubele kosambari',
});
dry.add('Palya', 's', 'beans 300, coconut 30, oil 12', 300, {
  s: 4,
  d: L,
  a: 'beans palya; karnataka palya',
});
curry.add('Gojju', 's', 'pineapple 200, tamarind 15, jaggery 30, oil 10', 300, {
  s: 4,
  n: 0.5,
  a: 'pineapple gojju; menasina gojju',
});
curry.add('Bassaru', 's', 'toor-dal 60, spinach 200, coconut 20, oil 8', 650, {
  s: 4,
  a: 'bas saaru; basaaru',
});
curry.add('Huli', 's', 'toor-dal 75, lauki 150, coconut 30, tamarind 10, oil 10', 800, {
  s: 4,
  a: 'tarkari huli; karnataka sambar',
});
curry.add('Menasinakayi', 's', 'green-chilli 80, besan 60, oil 30', 'm40', {
  p: [6, 'bajji', 'bajjis'],
  m: 's',
  a: 'menasinakai bajji; chilli bajji karnataka',
});
curry.add(
  'Badnekai ennegayi',
  's',
  'brinjal 350, peanuts 30, sesame 15, coconut-dry 20, oil 35',
  500,
  { s: 4, a: 'badanekai ennegai; ennegai' },
);
curry.add('Ennegai', 's', 'brinjal 350, peanuts 25, coconut-dry 25, oil 30', 480, {
  s: 4,
  id: 'ennegai-curry',
  a: 'yennegai',
});
curry.add(
  'Bagara baingan',
  's',
  'brinjal 350, peanuts 30, sesame 15, coconut-dry 15, tamarind 10, oil 35',
  520,
  { s: 4, a: 'baghare baingan; bagare baigan' },
);
curry.add(
  'Mirchi ka salan',
  's',
  'green-chilli 150, peanuts 40, sesame 15, coconut-dry 15, tamarind 10, oil 35',
  450,
  { s: 4, a: 'mirchi salan; hyderabadi salan' },
);

// The three Indo Chinese dry dishes
dry.add(
  'Chilli gobi',
  'a',
  'cauliflower 300, cornflour 30, maida 20, oil 40, capsicum 60, soy-sauce 10',
  380,
  { s: 3, d: 0.6, m: 'sd', a: 'gobi chilli; chilli cauliflower' },
);
dry.add(
  'Mushroom manchurian',
  'a',
  'mushroom 300, cornflour 30, maida 20, oil 40, capsicum 40, soy-sauce 10',
  380,
  { s: 3, d: 0.6, m: 'sd', a: 'manchurian mushroom' },
);
dry.add(
  'Chilli mushroom',
  'a',
  'mushroom 300, cornflour 25, oil 35, capsicum 60, onion 50, soy-sauce 10',
  380,
  { s: 3, d: 0.6, m: 'sd', a: 'mushroom chilli dry' },
);

export const VEG = [...curry.out, ...dry.out];
