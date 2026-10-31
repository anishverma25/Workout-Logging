import { CURRY, DRY, group } from './build';

/** Dals, legumes, kadhi and kuzhambu. 150 g of dry dal cooks to about 800 g, as in dal tadka. */
const dal = group({ category: 'dal', meals: 'm', units: CURRY });
const south = group({ category: 'south', meals: 'm', units: CURRY });

dal.add('Moong dal sabut', 'a', 'moong-whole 150, onion 40, tomato 60, oil 12, ginger 5', 850, {
  s: 4,
  a: 'sabut moong; whole moong dal; green moong dal',
});
dal.add('Urad dal', 'n', 'urad-whole 150, onion 40, tomato 60, ghee 15, ginger 5', 850, {
  s: 4,
  a: 'sabut urad; maah di dal',
});
dal.add('Chilka moong dal', 'n', 'moong-dal 150, onion 30, tomato 50, ghee 12', 800, {
  s: 4,
  a: 'chilke wali moong dal; split green moong dal',
});
dal.add('Lauki chana dal', 'n', 'chana-dal 100, lauki 250, onion 40, tomato 50, oil 15', 850, {
  s: 4,
  a: 'lauki chana; ghiya chana dal',
});
dal.add('Tomato dal', 'a', 'toor-dal 150, tomato 150, onion 40, oil 12', 850, {
  s: 4,
  a: 'tamatar dal; tomato pappu; tomato paruppu',
});
dal.add(
  'Dhaba dal',
  'n',
  'urad-whole 80, chana-dal 70, onion 60, tomato 80, ghee 20, butter 10',
  850,
  { s: 4, a: 'dhaba style dal; dal fry dhaba' },
);
dal.add('Dal bukhara', 'n', 'urad-whole 150, rajma 20, tomato 120, butter 30, cream 40', 900, {
  s: 4,
  a: 'bukhara dal; dal makhani bukhara',
});
dal.add('Lasooni dal', 'n', 'toor-dal 120, moong-dal 30, garlic 20, ghee 15, onion 30', 800, {
  s: 4,
  a: 'lasuni dal; garlic dal tadka',
});
dal.add('Jain dal', 'a', 'toor-dal 150, tomato 60, ghee 12', 780, {
  s: 4,
  a: 'dal without onion garlic',
});
dal.add('Pumpkin dal', 'a', 'toor-dal 120, pumpkin 200, oil 12', 850, {
  s: 4,
  a: 'kaddu dal; kumro dal',
});
dal.add('Dal soup', 'a', 'moong-dal 60, tomato 40, ghee 5', 600, {
  s: 3,
  a: 'lentil soup; daal ka soup',
});
dal.add('Moong dal soup', 'a', 'moong-dal 60, carrot 30, ghee 5', 600, {
  s: 3,
  a: 'mung dal soup',
});
dal.add('Sprouted moong curry', 'a', 'moong-sprouts 250, onion 50, tomato 60, oil 12', 600, {
  s: 4,
  a: 'sprouts curry; moong sprouts usal',
});
dal.add('Soya keema', 'a', 'soya-chunks 100, onion 100, tomato 100, peas 50, oil 20', 650, {
  s: 4,
  u: DRY,
  d: 0.75,
  a: 'soya keema matar; vegetarian keema',
});
dal.add('Chana masala dry', 'a', 'kabuli-chana 150, onion 70, tomato 80, oil 20', 550, {
  s: 4,
  u: DRY,
  d: 0.75,
  a: 'dry chana masala; sukha chole; amritsari chana dry',
});
dal.add('Pindi chole', 'n', 'kabuli-chana 150, onion 40, tomato 40, ghee 20, oil 10, tea 20', 650, {
  s: 4,
  a: 'pindi chana; rawalpindi chole',
});
dal.add('Amritsari chole', 'n', 'kabuli-chana 150, onion 80, tomato 100, ghee 15, oil 15', 750, {
  s: 4,
  a: 'amritsari chana; chole amritsari',
});
dal.add(
  'Kala chana ghugni',
  'e',
  'kala-chana 150, onion 60, tomato 60, potato 60, mustard-oil 15',
  750,
  { s: 4, a: 'kala chana curry; black chana curry; kale chane' },
);
dal.add('Matki usal', 'w', 'moth-bean 150, onion 60, tomato 60, coconut-dry 15, oil 18', 750, {
  s: 4,
  a: 'matki chi usal; moth usal; mataki usal',
});
dal.add('Dal kolhapuri', 'w', 'toor-dal 150, onion 50, tomato 50, coconut-dry 15, oil 15', 800, {
  s: 4,
  a: 'kolhapuri dal',
});
dal.add('Amti', 'w', 'toor-dal 150, jaggery 15, tamarind 8, oil 12, coconut 15', 850, {
  s: 4,
  a: 'katachi amti; maharashtrian amti',
});
dal.add('Varan', 'w', 'toor-dal 150, ghee 8', 750, { s: 4, a: 'varan maharashtrian; plain varan' });
dal.add(
  'Gujarati dal',
  'w',
  'toor-dal 150, jaggery 25, tamarind 8, peanuts 15, tomato 50, ghee 12',
  900,
  { s: 4, a: 'khatti meethi dal; gujarati toor dal' },
);
dal.add('Gujarati toor dal', 'w', 'toor-dal 150, jaggery 20, lemon 10, tomato 50, ghee 12', 880, {
  s: 4,
  a: 'gujarati tuver dal',
});
dal.add('Gujarati kadhi', 'w', 'curd 300, besan 30, sugar 15, ghee 10', 650, {
  s: 4,
  a: 'gujarati sweet kadhi; kadhi gujarati',
});
dal.add('Rajasthani kadhi', 'w', 'curd 300, besan 40, ghee 10, oil 5', 650, {
  s: 4,
  a: 'marwari kadhi; rajasthani kadhi',
});
dal.add(
  'Sindhi kadhi',
  'w',
  'besan 50, tomato 150, drumstick 80, potato 80, lauki 80, tamarind 10, oil 20',
  900,
  { s: 4, a: 'sindhi curry' },
);
dal.add('Bihari kadhi bari', 'e', 'curd 300, besan 70, mustard-oil 30', 700, {
  s: 4,
  a: 'kadhi badi; kadhi bari',
});
dal.add('Sol kadhi', 'w', 'coconut 80, water 300, garlic 4', 380, {
  s: 3,
  a: 'solkadhi; kokum kadhi',
});
dal.add('Majjige huli', 's', 'curd 250, ash-gourd 150, coconut 40, chana-dal 10, oil 6', 550, {
  s: 4,
  a: 'majjige huli; mor kuzhambu karnataka',
});
dal.add('Sindhi dal pakwan', 'w', 'chana-dal 120, maida 100, oil 40', 650, {
  s: 3,
  u: ['serving', 'g'],
  m: 'bm',
  a: 'dal pakwan; sindhi dal pakwan',
});
dal.add('Dal pakwan', 'w', 'chana-dal 120, maida 100, oil 40, onion 30', 680, {
  s: 3,
  u: ['serving', 'g'],
  m: 'bm',
  id: 'dal-pakwan-plate',
  a: 'pakwan dal',
});
dal.add('Moong dal khichuri', 'e', 'rice 100, moong-dal 80, ghee 15, peas 30', 750, {
  s: 4,
  a: 'moonger dal khichuri',
});
dal.add('Bengali cholar dal', 'e', 'chana-dal 150, coconut 30, ghee 15, sugar 10, raisins 8', 800, {
  s: 4,
  a: 'cholar dal; chana dal bengali',
});
dal.add('Masoor dal bengali', 'e', 'masoor-dal 150, mustard-oil 12, onion 20', 800, {
  s: 4,
  a: 'mushur dal; musur dal',
});
dal.add('Mug dal', 'e', 'moong-dal 150, ghee 12, ginger 5', 800, {
  s: 4,
  a: 'bhaja muger dal; moong dal bengali',
});
dal.add('Santula', 'e', 'moong-dal 40, papaya 100, potato 80, brinjal 60, pumpkin 80, oil 6', 600, {
  s: 3,
  a: 'odia santula; mixed veg santula',
});
dal.add('Khatta', 'e', 'raw-mango 150, sugar 40, mustard-seeds 2, oil 5', 300, {
  s: 4,
  u: ['tbsp', 'g'],
  m: 'm',
  a: 'odia khatta; mango khatta; ambula khatta',
});
dal.add('Dalcha', 's', 'chana-dal 120, mutton 150, lauki 100, tamarind 10, oil 20', 850, {
  s: 4,
  a: 'hyderabadi dalcha; dalcha gosht',
});
dal.add('Pappu', 's', 'toor-dal 150, tomato 60, ghee 12', 780, {
  s: 4,
  a: 'andhra pappu; tomato pappu; dal andhra',
});
dal.add('Gongura pappu', 's', 'toor-dal 150, gongura 80, oil 15, onion 30', 800, {
  s: 4,
  a: 'gongura dal; pulla gongura pappu',
});
dal.add('Mudda pappu', 's', 'toor-dal 150, ghee 5', 700, { s: 4, a: 'plain pappu; mudha pappu' });
dal.add('Pesara pappu', 's', 'moong-dal 150, tomato 50, oil 10', 780, {
  s: 4,
  a: 'pesarapappu; moong dal andhra',
});
dal.add('Menthi kura', 's', 'toor-dal 100, methi-leaves 150, oil 12', 650, {
  s: 4,
  a: 'menthi kura pappu; methi dal',
});
dal.add('Kollu rasam', 's', 'horse-gram 40, tomato 80, tamarind 8, ghee 5', 650, {
  s: 3,
  a: 'horse gram rasam; ulavalu charu',
});

south.add(
  'Arachuvitta sambar',
  's',
  'toor-dal 75, shallots 60, drumstick 60, tomato 50, coconut 30, tamarind 10, oil 12',
  900,
  { s: 5, a: 'arachu vitta sambar' },
);
south.add(
  'Kerala sambar',
  's',
  'toor-dal 75, ash-gourd 60, drumstick 50, carrot 40, coconut 30, tamarind 10, oil 12',
  900,
  { s: 5, a: 'sambar kerala style; varutharacha sambar' },
);
south.add('Mor kuzhambu', 's', 'curd 250, ash-gourd 100, coconut 40, chana-dal 10, oil 6', 550, {
  s: 4,
  a: 'moru curry; majjige pulusu',
});
south.add('Vatha kuzhambu', 's', 'tamarind 30, shallots 40, oil 25, jaggery 5', 400, {
  s: 4,
  n: 0.5,
  a: 'vathal kuzhambu; vatral kuzhambu',
});
south.add('Puli kuzhambu', 's', 'tamarind 25, shallots 60, brinjal 80, oil 20, jaggery 5', 500, {
  s: 4,
  a: 'pulikulambu; puli kulambu',
});
south.add('Kootu', 's', 'moong-dal 60, ash-gourd 150, coconut 40, oil 6', 550, {
  s: 4,
  a: 'mixed veg kootu; poricha kootu',
});
south.add('Parippu', 's', 'moong-dal 150, coconut 40, ghee 10', 800, {
  s: 4,
  a: 'parippu curry; kerala dal; cherupayar parippu',
});
south.add('Olan', 's', 'ash-gourd 250, lobia 30, coconut-milk 150, oil 8', 450, {
  s: 4,
  a: 'kerala olan',
});
south.add('Erissery', 's', 'pumpkin 250, lobia 50, coconut 80, oil 10', 550, {
  s: 4,
  a: 'mathanga erissery; erisheri',
});
south.add('Pachadi', 's', 'cucumber 150, curd 150, coconut 40, oil 4', 340, {
  s: 4,
  a: 'vellarikka pachadi; kerala pachadi',
});
south.add('Pulissery', 's', 'curd 250, raw-banana 80, coconut 40, oil 6', 500, {
  s: 4,
  a: 'moru kachiyathu; pulisseri',
});
south.add('Kalan', 's', 'curd 250, raw-banana 100, yam 100, coconut 50, ghee 6', 600, {
  s: 4,
  a: 'kaalan; kerala kalan',
});
south.add('Sundal', 's', 'kabuli-chana 100, coconut 20, oil 6', 260, {
  s: 3,
  u: DRY,
  m: 's',
  d: 0.75,
  a: 'chana sundal; navratri sundal; kadalai sundal',
});

export const DALS = [...dal.out, ...south.out];
