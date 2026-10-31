import { CURRY, DRY, group } from './build';

/**
 * Paneer, egg, soy, chicken, mutton, other meat, fish and seafood. Curries are weighed as the
 * finished pot (500 g chicken to about 850 g, as the curated chicken curry). Grilled and fried
 * meat and fish lose about a tenth to a third of their raw weight.
 */
const paneer = group({ category: 'paneer', meals: 'm', units: CURRY });
const egg = group({ category: 'egg', meals: 'm', units: CURRY });
const chicken = group({ category: 'chicken', meals: 'm', units: CURRY });
const meat = group({ category: 'meat', meals: 'm', units: CURRY });
const fish = group({ category: 'fish', meals: 'm', units: CURRY });
const PCS = (n: number, one = 'piece', many = 'pieces') =>
  [n, one, many] as [number, string, string];

// Paneer and soy
paneer.add(
  'Paneer tikka masala',
  'n',
  'paneer 300, onion 100, tomato 200, capsicum 60, curd 50, butter 15, oil 20, cream 30',
  800,
  { s: 4, a: 'paneer tikka gravy' },
);
paneer.add(
  'Paneer handi',
  'n',
  'paneer 300, onion 100, tomato 150, curd 60, cream 30, oil 25',
  750,
  { s: 4, a: 'handi paneer' },
);
paneer.add('Paneer jalfrezi', 'n', 'paneer 300, capsicum 120, onion 100, tomato 100, oil 25', 650, {
  s: 4,
  u: DRY,
  d: 0.75,
  a: 'jalfrezi paneer',
});
paneer.add(
  'Paneer angara',
  'n',
  'paneer 300, onion 100, tomato 150, cream 40, butter 15, oil 20',
  750,
  { s: 4, a: 'angara paneer; smoky paneer' },
);
paneer.add(
  'Paneer pasanda',
  'n',
  'paneer 300, cashews 40, cream 60, onion 60, khoya 20, oil 25',
  750,
  { s: 4, a: 'paneer pasanda gravy' },
);
paneer.add(
  'Paneer in white gravy',
  'n',
  'paneer 300, cashews 40, onion 80, cream 60, curd 50, oil 20',
  750,
  { s: 4, a: 'paneer shahi white gravy; paneer korma white' },
);
paneer.add(
  'Paneer kolhapuri',
  'w',
  'paneer 300, onion 100, tomato 150, coconut-dry 25, oil 30',
  750,
  { s: 4, a: 'kolhapuri paneer' },
);
paneer.add('Paneer curry', 'a', 'paneer 300, onion 100, tomato 150, oil 25', 750, {
  s: 4,
  a: 'paneer masala gravy; paneer ki sabzi',
});
paneer.add('Paneer pakora', 'n', 'paneer 200, besan 60, oil 40', 'm35', {
  p: PCS(10),
  m: 's',
  a: 'paneer pakoda; paneer bhajiya',
});
paneer.add('Paneer cutlet', 'n', 'paneer 150, potato 150, bread 30, oil 30', 'm48', {
  p: PCS(6, 'cutlet', 'cutlets'),
  m: 's',
  a: 'paneer tikki',
});
paneer.add(
  'Paneer manchurian',
  'a',
  'paneer 250, cornflour 30, maida 15, oil 40, capsicum 60, onion 50, soy-sauce 12',
  420,
  { s: 3, u: DRY, d: 0.7, m: 'sd', a: 'manchurian paneer' },
);
paneer.add('Paneer 65', 's', 'paneer 250, cornflour 25, rice-flour 15, curd 30, oil 35', 'm42', {
  s: 3,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'paneer sixty five',
});
paneer.add('Paneer momos', 'a', 'maida 120, paneer 120, onion 40, cabbage 40, oil 6', 'm48', {
  p: PCS(10, 'momo', 'momos'),
  m: 's',
  a: 'paneer dumplings',
});
paneer.add('Paneer sandwich', 'a', 'bread 75, paneer 60, butter 10, onion 15, capsicum 15', 175, {
  p: PCS(1, 'sandwich', 'sandwiches'),
  m: 'bs',
  a: 'paneer grilled sandwich',
});
paneer.add(
  'Paneer burger',
  'a',
  'bread 70, paneer 60, besan 10, oil 10, mayonnaise 10, lettuce 10, tomato 15',
  185,
  { p: PCS(1, 'burger', 'burgers'), m: 's', a: 'paneer patty burger' },
);
paneer.add(
  'Paneer tikka pizza',
  'a',
  'maida 100, mozzarella 60, paneer 60, capsicum 30, onion 25, ketchup 20, oil 10',
  'm40',
  { p: PCS(4, 'slice', 'slices'), m: 'sd', a: 'paneer pizza' },
);
paneer.add(
  'Paneer bhurji sandwich',
  'a',
  'bread 75, paneer 70, onion 20, tomato 20, butter 10',
  190,
  { p: PCS(1, 'sandwich', 'sandwiches'), m: 'bs', a: 'bhurji sandwich' },
);
paneer.add(
  'Cheese chilli toast',
  'a',
  'bread 60, cheese 30, butter 8, capsicum 10, green-chilli 3',
  105,
  { p: PCS(2, 'toast', 'toasts'), m: 'bs', a: 'chilli cheese toast' },
);
paneer.add('Tofu curry', 'a', 'tofu 300, onion 100, tomato 150, oil 20', 700, {
  s: 4,
  a: 'tofu masala',
});
paneer.add('Grilled tofu', 'a', 'tofu 300, oil 10, soy-sauce 10', 270, {
  s: 3,
  u: ['serving', 'g'],
  a: 'tofu steak',
});
paneer.add('Soya chaap', 'n', 'soya-chunks 80, maida 60, atta 20, oil 25, curd 40', 'm52', {
  p: PCS(4, 'stick', 'sticks'),
  m: 'sd',
  a: 'soya chaap tikka',
});
paneer.add(
  'Malai chaap',
  'n',
  'soya-chunks 80, maida 60, atta 20, cream 50, butter 15, curd 40',
  'm52',
  { p: PCS(4, 'stick', 'sticks'), m: 'sd', a: 'malai soya chaap' },
);
paneer.add(
  'Afghani chaap',
  'n',
  'soya-chunks 80, maida 60, atta 20, cream 40, cashews 15, curd 40, butter 10',
  'm52',
  { p: PCS(4, 'stick', 'sticks'), m: 'sd', a: 'afghani soya chaap' },
);
paneer.add('Tandoori chaap', 'n', 'soya-chunks 80, maida 60, atta 20, curd 50, oil 15', 'm52', {
  p: PCS(4, 'stick', 'sticks'),
  m: 'sd',
  a: 'tandoori soya chaap',
});
paneer.add(
  'Soya chaap masala',
  'n',
  'soya-chunks 80, maida 60, atta 20, onion 80, tomato 120, oil 25, cream 20',
  600,
  { s: 3, a: 'chaap masala gravy' },
);

// Egg
egg.add('Egg masala', 'a', 'egg 300, onion 120, tomato 120, oil 25', 600, {
  s: 3,
  a: 'anda masala; egg masala dry',
});
egg.add('Egg kheema', 'a', 'egg 300, onion 100, tomato 80, peas 40, oil 20', 480, {
  s: 3,
  u: DRY,
  d: 0.75,
  a: 'anda keema; egg keema',
});
egg.add('Egg dum biryani', 'a', 'rice 250, egg 300, onion 150, curd 100, oil 30, ghee 10', 1150, {
  s: 5,
  u: ['katori', 'serving', 'g'],
  d: 0.72,
  a: 'egg dum biriyani',
});
egg.add('Egg paratha', 'a', 'atta 45, egg 50, onion 10, oil 8', 'm40', {
  p: PCS(1, 'paratha', 'parathas'),
  m: 'bm',
  a: 'anda paratha; egg parantha',
});
egg.add('Egg sandwich', 'a', 'bread 75, egg 100, butter 8, onion 10, mayonnaise 10', 200, {
  p: PCS(1, 'sandwich', 'sandwiches'),
  m: 'bs',
  a: 'boiled egg sandwich; anda sandwich',
});
egg.add('Egg omelette', 'a', 'egg 100, oil 6', 95, {
  p: PCS(1, 'omelette', 'omelettes'),
  m: 'bs',
  a: 'plain omelette two eggs',
});
egg.add('Cheese omelette', 'a', 'egg 100, cheese 20, butter 6', 115, {
  p: PCS(1, 'omelette', 'omelettes'),
  m: 'bs',
  a: 'cheese omlet',
});
egg.add('Half fry egg', 'a', 'egg 50, oil 4', 48, {
  p: PCS(1, 'egg', 'eggs'),
  m: 'bs',
  n: 2,
  a: 'sunny side up; bull eye; half fry',
});
egg.add('Egg cutlet', 'a', 'egg 150, potato 150, bread 25, oil 30', 'm55', {
  p: PCS(6, 'cutlet', 'cutlets'),
  m: 's',
  a: 'egg chop; anda cutlet',
});
egg.add('Scotch egg', 'a', 'egg 50, mutton-mince 50, bread 10, oil 8', 105, {
  p: PCS(1, 'scotch egg', 'scotch eggs'),
  m: 's',
});
egg.add('Egg bhaji', 'a', 'egg 150, onion 100, tomato 60, oil 18', 300, {
  s: 2,
  u: DRY,
  d: 0.75,
  m: 'bm',
  a: 'anda bhaji; egg bhurji pav bhaji',
});
egg.add('Egg pakora', 'n', 'egg 200, besan 60, oil 35', 'm55', {
  p: PCS(8),
  m: 's',
  a: 'anda pakoda; egg bonda',
});
egg.add(
  'Egg chilli',
  'a',
  'egg 300, cornflour 25, oil 35, capsicum 80, onion 60, soy-sauce 12',
  500,
  { s: 3, u: DRY, d: 0.75, m: 'sd', a: 'chilli egg' },
);
egg.add(
  'Egg manchurian',
  'a',
  'egg 300, cornflour 25, maida 15, oil 35, capsicum 50, onion 50, soy-sauce 12',
  500,
  { s: 3, u: DRY, d: 0.75, m: 'sd', a: 'manchurian egg' },
);
egg.add('Egg 65', 's', 'egg 300, cornflour 20, rice-flour 15, oil 35', 'm55', {
  s: 3,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'egg sixty five',
});
egg.add('Dimer dalna', 'e', 'egg 300, potato 200, onion 80, tomato 80, mustard-oil 30', 750, {
  s: 4,
  a: 'dimer dalna bengali; egg potato curry',
});
egg.add('Dimer jhol', 'e', 'egg 300, potato 150, tomato 80, mustard-oil 25', 750, {
  s: 4,
  a: 'egg jhol',
});
egg.add('Dim devil', 'e', 'egg 200, mutton-mince 120, potato 80, bread 30, oil 35', 'm55', {
  p: PCS(4, 'devil', 'devils'),
  m: 's',
  a: 'dimer devil; egg devil; bengali egg chop',
});
egg.add('Egg roast', 's', 'egg 300, onion 250, tomato 100, oil 35', 600, {
  s: 3,
  a: 'mutta roast; kerala egg roast',
});
egg.add('Egg appam', 's', 'rice 100, coconut 30, egg 100, oil 6', 'm55', {
  p: PCS(3, 'appam', 'appams'),
  m: 'b',
  a: 'mutta appam',
});
egg.add('Egg dosa', 's', 'rice 120, urad-dal 30, egg 100, oil 16', 'm50', {
  p: PCS(4, 'dosa', 'dosas'),
  m: 'bs',
  a: 'mutta dosa; egg dosai',
});
egg.add('Egg kari', 's', 'egg 300, coconut 60, onion 100, tomato 80, oil 25', 750, {
  s: 4,
  a: 'egg curry kerala; mutta curry',
});
egg.add('Muttai poriyal', 's', 'egg 150, onion 60, oil 10', 190, {
  s: 2,
  u: DRY,
  d: 0.75,
  m: 'bm',
  a: 'egg poriyal; muttai podimas',
});
egg.add('Muttai kuzhambu', 's', 'egg 300, tamarind 20, shallots 60, coconut 40, oil 25', 750, {
  s: 4,
  a: 'egg kuzhambu',
});
egg.add('Akuri', 'w', 'egg 200, onion 40, tomato 30, butter 12, milk 30', 270, {
  s: 2,
  u: DRY,
  d: 0.8,
  m: 'b',
  a: 'parsi akuri; parsi scrambled eggs',
});
egg.add('Parsi egg on toast', 'w', 'bread 30, egg 50, butter 6, onion 10', 85, {
  p: PCS(1, 'toast', 'toasts'),
  m: 'b',
  a: 'akuri on toast',
});
egg.add('Anda ghotala', 'w', 'egg 200, onion 60, tomato 60, butter 20, cheese 15', 330, {
  s: 2,
  u: DRY,
  d: 0.8,
  m: 'bm',
  a: 'egg ghotala; surti anda ghotala',
});

// Chicken: north and Mughlai
chicken.add(
  'Chicken tikka masala',
  'n',
  'chicken 500, curd 80, onion 120, tomato 200, butter 20, oil 20, cream 40',
  900,
  { s: 4, a: 'chicken tikka gravy' },
);
chicken.add('Chicken kadai', 'n', 'chicken 500, capsicum 100, onion 120, tomato 150, oil 35', 850, {
  s: 4,
  a: 'kadai chicken; kadhai murgh',
});
chicken.add('Chicken do pyaza', 'n', 'chicken 500, onion 250, tomato 100, curd 50, oil 35', 850, {
  s: 4,
  a: 'murgh do pyaza',
});
chicken.add(
  'Chicken jalfrezi',
  'n',
  'chicken 500, capsicum 150, onion 120, tomato 120, oil 30',
  800,
  { s: 4, u: DRY, d: 0.75, a: 'jalfrezi chicken' },
);
chicken.add(
  'Chicken sagwala',
  'n',
  'chicken 500, spinach 400, onion 100, tomato 80, oil 30, cream 20',
  950,
  { s: 4, a: 'palak chicken; saag chicken' },
);
chicken.add(
  'Chicken Lucknowi',
  'n',
  'chicken 500, onion 120, curd 100, cashews 25, cream 30, ghee 30',
  850,
  { s: 4, a: 'lucknowi chicken curry' },
);
chicken.add(
  'Chicken Awadhi',
  'n',
  'chicken 500, onion 100, curd 120, cashews 30, khoya 20, ghee 30',
  850,
  { s: 4, a: 'awadhi murgh korma' },
);
chicken.add(
  'Chicken changezi',
  'n',
  'chicken 500, onion 120, tomato 150, cream 50, butter 25, cashews 20',
  900,
  { s: 4, a: 'changezi chicken' },
);
chicken.add(
  'Murgh musallam',
  'n',
  'chicken 600, egg 100, onion 150, curd 100, cashews 30, ghee 40',
  1000,
  { s: 5, a: 'murg musallam; whole chicken curry' },
);
chicken.add(
  'Chicken malai tikka',
  'n',
  'chicken 500, cream 60, cheese 30, curd 40, cashews 15, butter 10',
  520,
  { p: PCS(12), m: 'sd', a: 'malai tikka; murgh malai tikka; reshmi tikka' },
);
chicken.add('Chicken seekh kebab', 'n', 'chicken 500, onion 60, oil 15, besan 10', 450, {
  p: PCS(8, 'kebab', 'kebabs'),
  m: 'sd',
  a: 'chicken seekh; murgh seekh',
});
chicken.add(
  'Chicken reshmi kebab',
  'n',
  'chicken 500, cream 50, cashews 20, egg 25, butter 10',
  500,
  { p: PCS(10, 'kebab', 'kebabs'), m: 'sd', a: 'reshmi kabab' },
);
chicken.add(
  'Chicken hariyali tikka',
  'n',
  'chicken 500, curd 80, spinach 50, mint 20, coriander 20, oil 15',
  480,
  { p: PCS(12), m: 'sd', a: 'hariyali tikka; green chicken tikka' },
);
chicken.add(
  'Chicken achari tikka',
  'n',
  'chicken 500, curd 80, mustard-oil 20, mustard-seeds 5',
  470,
  { p: PCS(12), m: 'sd', a: 'achari murgh tikka' },
);
chicken.add('Chicken tangdi kebab', 'n', 'chicken-drumstick 600, curd 80, oil 15', 470, {
  p: PCS(6, 'leg', 'legs'),
  m: 'sd',
  a: 'tangdi kabab; murgh tangdi',
});
chicken.add(
  'Chicken drumsticks tandoori',
  'n',
  'chicken-drumstick 600, curd 80, lemon 15, oil 10',
  470,
  { p: PCS(6, 'drumstick', 'drumsticks'), m: 'sd', a: 'tandoori drumsticks; tandoori leg piece' },
);
chicken.add(
  'Chicken bharta',
  'n',
  'chicken 400, egg 50, onion 100, tomato 120, cream 30, butter 15, oil 15',
  650,
  { s: 4, a: 'murgh bharta' },
);
chicken.add('Chicken keema', 'a', 'chicken 500, onion 120, tomato 120, peas 60, oil 25', 700, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'chicken kheema; chicken mince',
});
chicken.add('Chicken liver fry', 'a', 'chicken-liver 400, onion 100, oil 20', 400, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'chicken kaleji',
});
chicken.add('Chicken gizzard', 'a', 'chicken-gizzard 400, onion 100, tomato 80, oil 20', 450, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'chicken pota; gizzard fry',
});
chicken.add(
  'Chicken noodle soup',
  'a',
  'chicken 100, egg-noodles 50, carrot 40, cabbage 40, oil 5',
  800,
  { s: 3, a: 'chicken noodles soup' },
);
chicken.add('Chicken clear soup', 'a', 'chicken 120, carrot 40, cabbage 40, spring-onion 15', 800, {
  s: 3,
  a: 'clear chicken soup',
});
chicken.add(
  'Chicken sweet corn soup',
  'a',
  'chicken 100, sweet-corn 150, cornflour 20, egg 50',
  800,
  { s: 3, a: 'chicken sweetcorn soup' },
);
chicken.add('Kebab roll', 'a', 'maida 60, chicken 80, onion 30, oil 12, egg 25', 'm45', {
  p: PCS(1, 'roll', 'rolls'),
  m: 'sd',
  a: 'chicken kebab roll; kolkata chicken roll',
});
chicken.add(
  'Chicken sandwich',
  'a',
  'bread 75, chicken-breast-cooked 60, mayonnaise 15, butter 5, lettuce 10',
  165,
  { p: PCS(1, 'sandwich', 'sandwiches'), m: 'bs', a: 'chicken mayo sandwich' },
);

// Chicken: south, west, east, Indo Chinese
chicken.add(
  'Chicken Chettinad',
  's',
  'chicken 500, onion 150, tomato 120, coconut 40, oil 35',
  850,
  { s: 4, a: 'chettinad chicken; kozhi chettinad' },
);
chicken.add('Chicken pepper fry', 's', 'chicken 500, onion 120, black-pepper 10, oil 35', 520, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'pepper chicken; milagu kozhi',
});
chicken.add(
  'Chicken kuzhambu',
  's',
  'chicken 500, shallots 100, tomato 120, coconut 50, oil 30',
  900,
  { s: 4, a: 'kozhi kuzhambu' },
);
chicken.add(
  'Naatu kozhi kuzhambu',
  's',
  'country-chicken 500, shallots 100, tomato 100, coconut 40, oil 30',
  900,
  { s: 4, a: 'nattu kozhi curry; country chicken curry' },
);
chicken.add(
  'Country chicken curry',
  's',
  'country-chicken 500, onion 120, tomato 100, oil 30',
  850,
  { s: 4, a: 'desi murgi; natu kodi kura' },
);
chicken.add('Kerala chicken fry', 's', 'chicken 500, oil 40, shallots 50', 450, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'kozhi varuthathu; chicken fry kerala',
});
chicken.add(
  'Kerala chicken curry',
  's',
  'chicken 500, onion 150, tomato 100, coconut-milk 150, oil 30',
  950,
  { s: 4, a: 'nadan kozhi curry' },
);
chicken.add('Gongura chicken', 's', 'chicken 500, gongura 150, onion 120, oil 35', 800, {
  s: 4,
  a: 'gongura kodi',
});
chicken.add('Andhra chicken fry', 's', 'chicken 500, oil 35, chilli-powder 8, onion 60', 480, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'kodi vepudu andhra',
});
chicken.add('Kodi vepudu', 's', 'chicken 500, oil 35, onion 60, chilli-powder 8, cashews 10', 480, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'kodi vepudu; telugu chicken fry',
});
chicken.add('Andhra chicken curry', 's', 'chicken 500, onion 150, tomato 100, oil 35', 850, {
  s: 4,
  a: 'kodi kura',
});
chicken.add('Natu kodi pulusu', 's', 'country-chicken 500, onion 120, tamarind 15, oil 30', 900, {
  s: 4,
  a: 'natu kodi pulusu',
});
chicken.add(
  'Chicken 555',
  's',
  'chicken 500, cornflour 30, egg 25, oil 40, cashews 15, curd 30',
  520,
  { s: 4, u: ['serving', 'g'], m: 'sd', a: 'chicken five five five' },
);
chicken.add('Chicken ghee roast', 's', 'chicken 500, ghee 50, curd 40, tamarind 8', 520, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'mangalorean chicken ghee roast',
});
chicken.add('Chicken sukka', 's', 'chicken 500, coconut 80, onion 100, oil 30', 600, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'kori sukka; chicken sukha',
});
chicken.add('Chicken gassi', 's', 'chicken 500, coconut 100, onion 100, tamarind 8, oil 25', 900, {
  s: 4,
  a: 'kori gassi',
});
chicken.add('Kori rotti', 's', 'chicken 250, coconut 50, oil 15, rice-flour 100', 700, {
  s: 3,
  u: ['serving', 'g'],
  a: 'kori rotti mangalore',
});
chicken.add(
  'Chicken kolhapuri',
  'w',
  'chicken 500, onion 150, coconut-dry 40, tomato 100, oil 35',
  850,
  { s: 4, a: 'kolhapuri chicken' },
);
chicken.add(
  'Kombdi vade',
  'w',
  'chicken 400, onion 120, coconut-dry 30, oil 30, rice-flour 100, urad-dal 20, oil 30',
  900,
  { s: 4, u: ['serving', 'g'], a: 'kombdi vade malvani' },
);
chicken.add('Chicken cafreal', 'w', 'chicken 500, coriander 50, oil 35, lime 15', 520, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'cafreal chicken goan',
});
chicken.add('Chicken xacuti', 'w', 'chicken 500, coconut 100, onion 100, oil 30', 850, {
  s: 4,
  a: 'xacuti; shagoti',
});
chicken.add('Chicken vindaloo', 'w', 'chicken 500, onion 150, vinegar 30, oil 35', 800, {
  s: 4,
  a: 'vindaloo chicken',
});
chicken.add(
  'Chicken sorpotel',
  'w',
  'chicken 500, chicken-liver 100, onion 120, vinegar 30, oil 30',
  850,
  { s: 4, a: 'sorpotel chicken' },
);
chicken.add('Chicken rezala', 'e', 'chicken 500, curd 150, onion 120, cashews 20, ghee 30', 850, {
  s: 4,
  a: 'murgir rezala; rezala',
});
chicken.add(
  'Murgir jhol',
  'e',
  'chicken 500, potato 150, onion 100, tomato 80, mustard-oil 30',
  950,
  { s: 4, a: 'murgir jhol bengali; chicken jhol' },
);
chicken.add('Chicken Hyderabadi', 's', 'chicken 500, onion 120, curd 100, mint 15, oil 35', 850, {
  s: 4,
  a: 'hyderabadi chicken curry',
});
chicken.add(
  'Chicken lollipop',
  'a',
  'chicken-wing 600, cornflour 30, maida 20, egg 25, oil 40',
  520,
  { p: PCS(10, 'lollipop', 'lollipops'), m: 'sd', a: 'chicken lollypop' },
);
chicken.add(
  'Chicken lollipop dry',
  'a',
  'chicken-wing 600, cornflour 30, maida 20, oil 45, soy-sauce 10',
  520,
  { p: PCS(10, 'lollipop', 'lollipops'), m: 'sd', a: 'dry lollipop; drums of heaven' },
);
chicken.add(
  'Chicken schezwan',
  'a',
  'chicken 400, cornflour 25, oil 40, capsicum 60, onion 60, soy-sauce 12, chilli-powder 5',
  520,
  { s: 4, u: DRY, d: 0.75, a: 'schezwan chicken; szechuan chicken' },
);
chicken.add(
  'Chicken kung pao',
  'a',
  'chicken 400, peanuts 40, oil 30, capsicum 60, soy-sauce 15, sugar 8',
  520,
  { s: 4, u: DRY, d: 0.75, a: 'kung pao chicken' },
);
chicken.add(
  'Dragon chicken',
  'a',
  'chicken 400, cornflour 30, oil 45, capsicum 60, cashews 20, soy-sauce 12, sugar 8',
  520,
  { s: 4, u: DRY, d: 0.75, a: 'dragon chicken' },
);
chicken.add(
  'Hot garlic chicken',
  'a',
  'chicken 400, cornflour 25, oil 40, garlic 25, soy-sauce 12',
  520,
  { s: 4, u: DRY, d: 0.75, a: 'chicken hot garlic' },
);
chicken.add(
  'Honey chilli chicken',
  'a',
  'chicken 400, cornflour 30, oil 45, honey 30, sesame 6, soy-sauce 10',
  500,
  { s: 4, u: DRY, d: 0.75, a: 'chilli honey chicken' },
);
chicken.add('Turkey roast', 'a', 'turkey 500, butter 20', 400, {
  s: 4,
  u: ['serving', 'g'],
  a: 'roast turkey',
});

// Mutton
meat.add(
  'Mutton shami kebab',
  'n',
  'mutton-mince 400, chana-dal 80, egg 50, onion 40, oil 30',
  'm48',
  { p: PCS(10, 'kebab', 'kebabs'), m: 'sd', a: 'shami kabab' },
);
meat.add('Galouti kebab', 'n', 'mutton-mince 400, ghee 30, onion 40, besan 15', 'm48', {
  p: PCS(10, 'kebab', 'kebabs'),
  m: 'sd',
  a: 'galawati kebab; galouti kabab',
});
meat.add('Kakori kebab', 'n', 'mutton-mince 400, ghee 25, onion 40, cashews 15', 'm45', {
  p: PCS(8, 'kebab', 'kebabs'),
  m: 'sd',
  a: 'kakori kabab',
});
meat.add('Burrah kebab', 'n', 'mutton 500, curd 80, oil 15', 400, {
  p: PCS(8),
  m: 'sd',
  a: 'barrah kebab; burra kabab',
});
meat.add('Tandoori mutton', 'n', 'mutton 500, curd 80, oil 15', 400, {
  s: 4,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'mutton tandoori',
});
meat.add('Mutton kadai', 'n', 'mutton 500, capsicum 100, onion 120, tomato 150, oil 35', 850, {
  s: 4,
  a: 'kadai gosht; kadhai mutton',
});
meat.add('Mutton handi', 'n', 'mutton 500, onion 150, tomato 120, curd 100, oil 35, ghee 10', 900, {
  s: 4,
  a: 'handi gosht',
});
meat.add('Mutton saag', 'n', 'mutton 500, spinach 400, onion 100, tomato 80, oil 35', 1000, {
  s: 4,
  a: 'saag gosht; palak gosht',
});
meat.add('Mutton bhuna', 'a', 'mutton 500, onion 200, tomato 120, oil 40', 750, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'bhuna mutton',
});
meat.add('Bhuna gosht', 'n', 'mutton 500, onion 200, tomato 100, curd 50, ghee 20, oil 25', 750, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'gosht bhuna',
});
meat.add('Kaleji masala', 'n', 'goat-liver 400, onion 120, tomato 80, oil 25', 450, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'kaleji fry; mutton liver fry',
});
meat.add('Mutton liver', 'a', 'goat-liver 400, onion 100, oil 20', 400, {
  s: 4,
  u: DRY,
  d: 0.8,
  id: 'mutton-liver-fry',
  a: 'liver fry; eral fry',
});
meat.add('Mutton chops', 'a', 'mutton 600, onion 80, curd 60, oil 30', 520, {
  p: PCS(8, 'chop', 'chops'),
  m: 'm',
  a: 'mutton chaap',
});
meat.add('Keema naan', 'n', 'maida 120, mutton-mince 80, butter 10, onion 15', 'm38', {
  p: PCS(2, 'naan', 'naans'),
  m: 'm',
  a: 'kheema naan',
});
meat.add('Mutton nihari', 'n', 'mutton 600, atta 30, ghee 50, onion 80', 1100, {
  s: 5,
  a: 'nihari; nalli nihari',
});
meat.add('Paya', 'n', 'mutton 200, onion 100, ghee 20, oil 10', 1000, {
  s: 4,
  a: 'paya soup; mutton paya; trotters',
});
meat.add(
  'Haleem',
  's',
  'mutton 400, dalia 150, chana-dal 40, masoor-dal 20, ghee 60, onion 100',
  1400,
  { s: 6, a: 'hyderabadi haleem; mutton haleem' },
);
meat.add(
  'Mutton haleem',
  's',
  'mutton 400, dalia 150, chana-dal 40, ghee 60, onion 100, cashews 20',
  1400,
  { s: 6, id: 'mutton-haleem-rich', a: 'haleem with cashews' },
);
meat.add('Khichda', 's', 'mutton 400, dalia 120, rice 40, chana-dal 50, ghee 50, onion 100', 1400, {
  s: 6,
  a: 'khichra; mutton khichda',
});
meat.add('Mutton dalcha', 's', 'mutton 400, chana-dal 120, lauki 150, tamarind 12, oil 30', 1100, {
  s: 5,
  a: 'dalcha gosht',
});
meat.add('Mutton marag', 's', 'mutton 500, curd 100, cashews 30, cream 30, ghee 25', 1200, {
  s: 5,
  a: 'marag; mutton soup hyderabadi',
});
meat.add('Pathar ka gosht', 's', 'mutton 500, curd 60, oil 25', 420, {
  s: 4,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'patthar ka gosht',
});
meat.add('Mutton pepper fry', 's', 'mutton 500, onion 150, black-pepper 10, oil 35', 550, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'pepper mutton; mutton milagu varuval',
});
meat.add('Mutton chukka', 's', 'mutton 500, shallots 150, oil 35', 520, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'mutton sukka; chukka varuval',
});
meat.add('Mutton kola urundai', 's', 'mutton-mince 300, chana-dal 50, coconut 30, oil 30', 'm48', {
  p: PCS(12, 'urundai', 'urundais'),
  m: 'sd',
  a: 'kola urundai; mutton balls',
});
meat.add('Mutton chops Chettinad', 's', 'mutton 600, onion 120, coconut 30, oil 35', 600, {
  p: PCS(8, 'chop', 'chops'),
  a: 'chettinad mutton chops',
});
meat.add('Mutton kuzhambu', 's', 'mutton 500, shallots 100, tomato 100, coconut 50, oil 30', 1000, {
  s: 4,
  a: 'kari kuzhambu',
});
meat.add('Mutton stew', 's', 'mutton 400, potato 150, carrot 50, coconut-milk 250, oil 15', 1000, {
  s: 4,
  a: 'kerala mutton stew; mutton ishtu',
});
meat.add('Mutton roast Kerala', 's', 'mutton 500, onion 200, coconut 30, oil 40', 650, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'mutton roast; erachi roast',
});
meat.add('Gongura mutton', 's', 'mutton 500, gongura 150, onion 120, oil 35', 850, {
  s: 4,
  a: 'gongura mamsam',
});
meat.add('Mutton vepudu', 's', 'mutton 500, onion 100, oil 35', 520, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'mamsam vepudu',
});
meat.add('Mutton sukka', 's', 'mutton 500, coconut 80, onion 100, oil 30', 620, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'mangalorean mutton sukka',
});
meat.add(
  'Mutton kolhapuri',
  'w',
  'mutton 500, onion 150, coconut-dry 40, tomato 100, oil 35',
  900,
  { s: 4, a: 'kolhapuri mutton' },
);
meat.add('Tambda rassa', 'w', 'mutton 300, coconut-dry 30, onion 80, oil 25', 1000, {
  s: 5,
  a: 'tambda rassa kolhapuri',
});
meat.add('Pandhra rassa', 'w', 'mutton 300, coconut 80, cashews 15, oil 10', 1000, {
  s: 5,
  a: 'pandhra rassa kolhapuri',
});
meat.add('Saoji mutton', 'w', 'mutton 500, onion 120, coconut-dry 30, oil 50', 900, {
  s: 4,
  a: 'saoji mutton nagpur',
});
meat.add('Mutton vindaloo', 'w', 'mutton 500, onion 150, vinegar 30, oil 35', 850, {
  s: 4,
  a: 'vindaloo mutton',
});
meat.add('Mutton xacuti', 'w', 'mutton 500, coconut 100, onion 100, oil 30', 900, {
  s: 4,
  a: 'xacuti mutton',
});
meat.add('Mutton sorpotel', 'w', 'mutton 400, goat-liver 100, onion 120, vinegar 30, oil 30', 850, {
  s: 4,
  a: 'sorpotel mutton',
});
meat.add('Kosha mangsho', 'e', 'mutton 500, onion 200, potato 100, curd 80, mustard-oil 40', 850, {
  s: 4,
  a: 'kosha mangsho; bengali mutton kosha',
});
meat.add('Mutton jhol', 'e', 'mutton 500, potato 150, onion 100, tomato 80, mustard-oil 30', 1000, {
  s: 4,
  a: 'mangshor jhol; pathar mangsho',
});
meat.add('Mutton rezala', 'e', 'mutton 500, curd 150, onion 120, cashews 20, ghee 30', 900, {
  s: 4,
  a: 'rezala mutton',
});
meat.add('Gushtaba', 'n', 'mutton-mince 500, curd 400, ghee 40', 1100, {
  s: 5,
  a: 'goshtaba; kashmiri gushtaba',
});
meat.add('Rista', 'n', 'mutton-mince 500, mustard-oil 30, tomato 80', 1000, {
  s: 5,
  a: 'kashmiri rista',
});
meat.add('Tabak maaz', 'n', 'mutton 600, milk 200, ghee 40', 450, {
  s: 4,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'tabak maz; kashmiri lamb ribs',
});
meat.add('Kashmiri kebab', 'n', 'mutton-mince 400, onion 30, ghee 20', 'm48', {
  p: PCS(8, 'kebab', 'kebabs'),
  m: 'sd',
  a: 'kashmiri seekh',
});
meat.add('Junglee maas', 'w', 'mutton 500, ghee 60', 650, { s: 4, a: 'jungli maas' });
meat.add('Laal maas', 'w', 'mutton 500, onion 120, curd 100, ghee 30, oil 25', 850, {
  s: 4,
  a: 'lal maas; rajasthani red mutton',
});
meat.add(
  'Safed maas',
  'w',
  'mutton 500, curd 150, cashews 30, almonds 15, cream 40, ghee 30',
  900,
  { s: 4, a: 'safed maans; rajasthani white mutton' },
);
meat.add('Sula', 'w', 'mutton 500, curd 60, ghee 15', 400, {
  p: PCS(10),
  m: 'sd',
  a: 'mutton sula; rajasthani sula',
});
meat.add('Mutton champ', 'n', 'mutton 600, curd 80, onion 60, oil 30', 520, {
  p: PCS(8, 'champ', 'champs'),
  a: 'mutton chaap punjabi',
});
meat.add('Chapli kebab', 'n', 'beef-mince 400, onion 80, tomato 60, egg 50, oil 40', 'm48', {
  p: PCS(6, 'kebab', 'kebabs'),
  m: 'sd',
  a: 'peshawari chapli kebab',
});

// Beef, pork, duck and game
meat.add('Beef fry', 's', 'beef 500, coconut 40, onion 120, oil 40', 520, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'beef ularthiyathu; beef dry fry',
});
meat.add('Beef roast', 's', 'beef 500, onion 200, coconut 30, oil 40', 560, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'kerala beef roast',
});
meat.add('Beef curry', 's', 'beef 500, onion 150, tomato 100, coconut-milk 100, oil 30', 900, {
  s: 4,
  a: 'kerala beef curry',
});
meat.add('Beef pepper fry', 's', 'beef 500, onion 120, black-pepper 10, oil 35', 520, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'pepper beef',
});
meat.add('Beef biryani', 's', 'rice 250, beef 400, onion 150, curd 80, oil 35, ghee 10', 1200, {
  s: 5,
  u: ['katori', 'serving', 'g'],
  d: 0.72,
  id: 'beef-biryani-plain',
  a: 'beef dum biryani',
});
meat.add('Beef kebab', 'a', 'beef-mince 400, onion 60, oil 20', 'm50', {
  p: PCS(8, 'kebab', 'kebabs'),
  m: 'sd',
  a: 'beef seekh kebab',
});
meat.add('Beef keema', 'a', 'beef-mince 500, onion 120, tomato 100, peas 50, oil 15', 700, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'beef kheema; beef mince',
});
meat.add(
  'Beef chilli',
  'a',
  'beef 400, cornflour 25, oil 40, capsicum 60, onion 60, soy-sauce 12',
  520,
  { s: 4, u: DRY, d: 0.75, a: 'chilli beef' },
);
meat.add('Pork vindaloo', 'w', 'pork 500, onion 150, vinegar 30, oil 25', 800, {
  s: 4,
  a: 'vindaloo pork; goan pork vindaloo',
});
meat.add('Pork sorpotel', 'w', 'pork 400, goat-liver 100, onion 120, vinegar 30, oil 20', 800, {
  s: 4,
  a: 'sorpotel; goan sorpotel',
});
meat.add('Pork indad', 'w', 'pork 500, onion 120, vinegar 20, oil 20', 750, {
  s: 4,
  a: 'indad; pork indad',
});
meat.add('Pork bafat', 's', 'pork 500, onion 120, vinegar 20, oil 15', 750, {
  s: 4,
  a: 'mangalorean pork bafat',
});
meat.add('Pandi curry', 's', 'pork 500, onion 120, vinegar 20, oil 10', 750, {
  s: 4,
  a: 'kodava pandi curry; coorg pork curry',
});
meat.add('Kodava pandi curry', 's', 'pork 500, pork-belly 80, onion 120, vinegar 20', 780, {
  s: 4,
  a: 'coorg pandi curry',
});
meat.add('Pork curry', 'e', 'pork 500, onion 120, tomato 80, oil 15', 800, {
  s: 4,
  a: 'north east pork curry',
});
meat.add('Pork bamboo shoot', 'e', 'pork 500, bamboo-shoot 200, oil 10', 750, {
  s: 4,
  a: 'pork with bamboo shoot',
});
meat.add('Smoked pork', 'e', 'pork 500, green-chilli 20, ginger 10', 380, {
  s: 4,
  u: ['serving', 'g'],
  a: 'naga smoked pork dry',
});
meat.add(
  'Pork chilli',
  'a',
  'pork 400, cornflour 20, oil 30, capsicum 60, onion 60, soy-sauce 12',
  520,
  { s: 4, u: DRY, d: 0.75, a: 'chilli pork' },
);
meat.add('Pork ribs', 'a', 'pork 600, honey 20, soy-sauce 15, oil 10', 450, {
  s: 4,
  u: ['serving', 'g'],
  a: 'bbq pork ribs',
});
meat.add('Duck roast', 's', 'duck 600, onion 200, coconut-milk 100, oil 30', 750, {
  s: 4,
  a: 'tharavu roast; kerala duck roast',
});
meat.add('Duck curry', 'e', 'duck 600, onion 150, potato 100, coconut 40, mustard-oil 30', 1000, {
  s: 4,
  a: 'haah mangxo; assamese duck curry',
});
meat.add('Quail roast', 's', 'quail 400, onion 120, oil 25', 400, {
  s: 3,
  u: DRY,
  d: 0.8,
  a: 'kaada roast; quail fry',
});
meat.add('Quail fry', 's', 'quail 400, oil 25, chilli-powder 6', 320, {
  s: 3,
  u: ['serving', 'g'],
  a: 'kaadai varuval',
});
meat.add('Rabbit curry', 'a', 'rabbit 500, onion 120, tomato 100, oil 30', 800, {
  s: 4,
  a: 'rabbit masala',
});

// Fish and seafood
fish.add('Meen moilee', 's', 'seer-fish 500, coconut-milk 250, onion 100, oil 20', 850, {
  s: 4,
  a: 'fish molee; meen molee',
});
fish.add('Fish moilee', 's', 'pomfret 500, coconut-milk 250, onion 100, oil 20', 850, {
  s: 4,
  id: 'fish-moilee-pomfret',
  a: 'fish molly',
});
fish.add('Fish stew', 's', 'seer-fish 400, potato 100, coconut-milk 250, oil 15', 850, {
  s: 4,
  a: 'kerala fish stew; meen ishtu',
});
fish.add('Meen pollichathu', 's', 'karimeen 400, onion 80, tomato 60, oil 25', 450, {
  p: PCS(2, 'fish', 'fish'),
  a: 'karimeen pollichathu; fish in banana leaf',
});
fish.add('Karimeen fry', 's', 'karimeen 400, oil 30, chilli-powder 6', 350, {
  p: PCS(2, 'fish', 'fish'),
  a: 'pearl spot fry',
});
fish.add('Meen fry', 's', 'seer-fish 400, oil 30, chilli-powder 6', 350, {
  p: PCS(6),
  a: 'meen varuthathu; kerala fish fry',
});
fish.add('Sardine fry', 's', 'sardine 400, oil 25, chilli-powder 6', 340, {
  p: PCS(8, 'fish', 'fish'),
  a: 'mathi fry; chaala fry',
});
fish.add('Mathi curry', 's', 'sardine 500, tamarind 15, shallots 60, oil 25', 800, {
  s: 4,
  a: 'sardine curry; mathi mulakittathu; chaala curry',
});
fish.add('Ayala curry', 's', 'mackerel 500, coconut 80, tamarind 12, oil 20', 850, {
  s: 4,
  a: 'mackerel curry; ayala meen curry; bangude gassi',
});
fish.add('Ayala fry', 's', 'mackerel 400, oil 25, chilli-powder 6', 340, {
  p: PCS(4, 'fish', 'fish'),
  a: 'mackerel fry; ayala porichathu',
});
fish.add('Netholi fry', 's', 'anchovy 300, rice-flour 20, oil 30', 270, {
  s: 3,
  u: ['serving', 'g'],
  a: 'anchovy fry; kozhuva fry; nethili fry',
});
fish.add('Nethili fry', 's', 'anchovy 300, rice-flour 25, oil 35', 280, {
  s: 3,
  u: ['serving', 'g'],
  id: 'nethili-fry-tamil',
  a: 'nethili meen fry',
});
fish.add('Choora fry', 's', 'tuna-fresh 400, oil 25, chilli-powder 6', 340, {
  p: PCS(6),
  a: 'choora meen fry; tuna fry',
});
fish.add('Tuna curry', 's', 'tuna-fresh 500, coconut 80, tamarind 10, oil 20', 850, {
  s: 4,
  a: 'choora curry',
});
fish.add('Kingfish fry', 's', 'seer-fish 400, oil 25, rice-flour 15', 340, {
  p: PCS(6),
  a: 'neymeen fry; surmai fry',
});
fish.add('Kera fish', 's', 'tuna-fresh 400, onion 80, oil 25', 380, {
  s: 3,
  u: DRY,
  d: 0.8,
  a: 'kera meen',
});
fish.add('Chemmeen roast', 's', 'prawns 400, onion 150, coconut 30, oil 30', 450, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'prawns roast kerala',
});
fish.add('Chemmeen curry', 's', 'prawns 400, coconut 100, tamarind 10, oil 20', 750, {
  s: 4,
  a: 'prawn curry kerala; konju curry',
});
fish.add(
  'Chemmeen theeyal',
  's',
  'prawns 350, coconut 100, shallots 60, tamarind 10, oil 20',
  700,
  { s: 4, a: 'prawn theeyal' },
);
fish.add('Chemmeen fry', 's', 'prawns 400, oil 25, chilli-powder 6', 330, {
  s: 4,
  u: ['serving', 'g'],
  a: 'prawn fry; chemmeen porichathu; jhinga fry',
});
fish.add('Prawn fry', 'a', 'prawns 400, oil 30, rice-flour 15', 340, {
  s: 4,
  u: ['serving', 'g'],
  id: 'prawn-fry-plain',
  a: 'prawns fry; kolambi fry',
});
fish.add('Prawn tempura', 'a', 'prawns 300, maida 60, cornflour 20, oil 45', 'm45', {
  p: PCS(12, 'prawn', 'prawns'),
  m: 'sd',
  a: 'tempura prawns',
});
fish.add('Crab roast', 's', 'crab 500, onion 150, oil 30', 500, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'njandu roast',
});
fish.add('Crab masala', 'a', 'crab 500, onion 120, tomato 100, oil 30', 700, {
  s: 4,
  a: 'kekda masala; nandu masala',
});
fish.add('Crab curry', 'a', 'crab 500, coconut 80, onion 100, oil 25', 800, {
  s: 4,
  a: 'nandu kuzhambu; kekda curry',
});
fish.add('Squid roast', 's', 'squid 400, onion 150, oil 30', 450, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'koonthal roast; kanava roast',
});
fish.add('Squid fry', 's', 'squid 400, rice-flour 20, oil 30', 360, {
  s: 4,
  u: ['serving', 'g'],
  a: 'calamari fry',
});
fish.add('Calamari', 'a', 'squid 300, maida 50, egg 25, oil 45', 'm55', {
  s: 3,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'fried calamari rings',
});
fish.add('Mussel fry', 's', 'mussels 300, oil 25, rice-flour 15', 260, {
  s: 3,
  u: ['serving', 'g'],
  a: 'kallummakkaya fry; kallumakkaya; kadukka fry',
});
fish.add('Lobster masala', 'a', 'lobster 500, onion 120, tomato 100, butter 20, oil 15', 700, {
  s: 4,
  a: 'lobster curry',
});
fish.add('Oyster fry', 'a', 'oyster 300, rice-flour 25, oil 25', 260, {
  s: 3,
  u: ['serving', 'g'],
  a: 'muringa fry',
});
fish.add('Clam sukka', 's', 'clams 400, coconut 80, onion 60, oil 20', 420, {
  s: 4,
  u: DRY,
  d: 0.8,
  a: 'tisryo sukke; clams sukka; kakka irachi',
});
fish.add('Tisryo', 'w', 'clams 400, coconut 100, onion 60, oil 15', 600, {
  s: 4,
  a: 'tisrya; goan clams',
});
fish.add('Kane fry', 's', 'mullet 400, rice-flour 25, oil 30', 360, {
  p: PCS(6),
  a: 'ladyfish fry; kane rava fry',
});
fish.add('Rawa fried fish', 'w', 'pomfret 400, sooji 40, oil 35', 380, {
  p: PCS(4),
  a: 'rava fish fry; rava fry pomfret',
});
fish.add('Bangude fry', 's', 'mackerel 400, oil 25, chilli-powder 6', 340, {
  p: PCS(4, 'fish', 'fish'),
  a: 'bangude masala fry',
});
fish.add('Bangude pulimunchi', 's', 'mackerel 500, tamarind 20, oil 20', 750, {
  s: 4,
  a: 'pulimunchi',
});
fish.add('Anjal fry', 's', 'seer-fish 400, oil 25, rice-flour 15', 340, {
  p: PCS(6),
  a: 'anjal tawa fry',
});
fish.add('Tilapia fry', 'a', 'tilapia 400, oil 25, chilli-powder 6', 340, {
  p: PCS(4),
  a: 'tilapia masala fry',
});
fish.add('Basa fry', 'a', 'basa 400, oil 25, rice-flour 15', 350, {
  p: PCS(4),
  a: 'basa fish fry; pangas fry',
});
fish.add('Salmon fry', 'a', 'salmon 400, oil 20', 340, { p: PCS(4), a: 'pan fried salmon' });
fish.add('Rawas fry', 'w', 'catla 400, oil 25, rice-flour 15', 350, {
  p: PCS(4),
  a: 'indian salmon fry; rawas tawa fry',
});
fish.add('Rawas curry', 'w', 'catla 500, coconut 80, oil 20', 850, {
  s: 4,
  a: 'rawas curry; indian salmon curry',
});
fish.add('Halwa fish fry', 'w', 'pomfret 400, rice-flour 25, oil 30', 360, {
  p: PCS(4),
  a: 'black pomfret fry; halwa fish',
});
fish.add('Mandeli fry', 'w', 'anchovy 300, rice-flour 25, oil 30', 270, {
  s: 3,
  u: ['serving', 'g'],
  a: 'mandeli rava fry',
});
fish.add('Dry fish curry', 'a', 'bombay-duck 150, onion 120, tomato 100, oil 25', 450, {
  s: 4,
  a: 'sukha bombil curry; karuvadu kuzhambu',
});
fish.add('Fish finger', 'a', 'basa 300, bread 40, egg 50, maida 20, oil 40', 'm55', {
  p: PCS(12, 'finger', 'fingers'),
  m: 's',
  a: 'fish fingers',
});
fish.add('Fish and chips', 'a', 'basa 200, maida 50, oil 40, potato 250', 380, {
  s: 2,
  u: ['serving', 'g'],
  m: 'm',
  a: 'fish n chips',
});
fish.add('Fish cutlet', 'a', 'fish 250, potato 150, bread 30, egg 25, oil 30', 'm55', {
  p: PCS(8, 'cutlet', 'cutlets'),
  m: 's',
  a: 'meen cutlet; fish chop',
});
fish.add('Fish roll', 'a', 'maida 100, fish 150, potato 60, oil 30', 'm45', {
  p: PCS(4, 'roll', 'rolls'),
  m: 's',
  a: 'fish roll kolkata',
});
fish.add('Fish kebab', 'a', 'fish 400, besan 20, curd 40, oil 15', 360, {
  p: PCS(8, 'kebab', 'kebabs'),
  m: 'sd',
  a: 'fish tikka; machli tikka',
});
fish.add('Fish salad', 'a', 'fish 120, lettuce 60, cucumber 50, tomato 40, olive-oil 8', 260, {
  s: 1,
  u: ['serving', 'g'],
  a: 'grilled fish salad',
});
fish.add('Tuna salad', 'a', 'tuna-canned 100, lettuce 60, cucumber 50, mayonnaise 15', 220, {
  s: 1,
  u: ['serving', 'g'],
  a: 'tuna mayo salad',
});
fish.add('Tuna sandwich', 'a', 'bread 75, tuna-canned 70, mayonnaise 15, lettuce 10', 170, {
  p: PCS(1, 'sandwich', 'sandwiches'),
  m: 'bs',
  a: 'tuna mayo sandwich',
});
fish.add('Fish soup', 'a', 'fish 150, onion 30, tomato 40, oil 5', 700, { s: 3, a: 'meen soup' });
fish.add(
  'Shorshe ilish',
  'e',
  'hilsa 500, mustard-seeds 30, mustard-oil 25, green-chilli 10',
  650,
  { s: 4, a: 'sorshe ilish; ilish bhapa; hilsa in mustard' },
);
fish.add('Ilish bhaja', 'e', 'hilsa 400, mustard-oil 25', 340, {
  p: PCS(4),
  a: 'hilsa fry; ilish maach bhaja',
});
fish.add('Ilish paturi', 'e', 'hilsa 400, mustard-seeds 20, coconut 30, mustard-oil 15', 430, {
  p: PCS(4),
  a: 'hilsa paturi',
});
fish.add('Hilsa curry', 'e', 'hilsa 500, potato 100, tomato 60, mustard-oil 20', 800, {
  s: 4,
  a: 'ilish jhol; ilish macher jhol',
});
fish.add('Shorshe maach', 'e', 'rohu 500, mustard-seeds 30, mustard-oil 25', 650, {
  s: 4,
  a: 'macher shorshe; fish in mustard gravy',
});
fish.add('Bhapa maach', 'e', 'bhetki 400, mustard-seeds 25, coconut 30, mustard-oil 15', 450, {
  p: PCS(4),
  a: 'bhapa mach; steamed mustard fish',
});
fish.add('Maach bhaja', 'e', 'rohu 400, mustard-oil 25', 340, {
  p: PCS(4),
  a: 'macher bhaja; bengali fish fry',
});
fish.add('Rohu curry', 'e', 'rohu 500, potato 100, tomato 80, mustard-oil 25', 850, {
  s: 4,
  a: 'rui macher jhol; rohu fish curry',
});
fish.add('Rui macher kalia', 'e', 'rohu 500, onion 100, curd 50, potato 80, mustard-oil 35', 800, {
  s: 4,
  a: 'rui kalia; kalia',
});
fish.add('Katla curry', 'e', 'catla 500, potato 100, tomato 80, mustard-oil 25', 850, {
  s: 4,
  a: 'katla macher jhol; catla curry',
});
fish.add('Katla fry', 'e', 'catla 400, mustard-oil 25', 340, { p: PCS(4), a: 'catla fry' });
fish.add('Bhetki fry', 'e', 'bhetki 400, bread 40, egg 50, oil 35', 'm62', {
  p: PCS(6),
  m: 'sd',
  a: 'bhetki fish fry; kolkata fish fry; fish fry kolkata',
});
fish.add('Bhetki paturi', 'e', 'bhetki 400, mustard-seeds 20, coconut 30, mustard-oil 15', 430, {
  p: PCS(4),
  a: 'bhetki paturi; fish paturi',
});
fish.add(
  'Chingri malai curry',
  'e',
  'prawns 400, coconut-milk 200, onion 60, ghee 15, oil 15',
  650,
  { s: 4, a: 'chingri malaikari; prawn malai curry' },
);
fish.add('Chingri bhapa', 'e', 'prawns 400, mustard-seeds 25, coconut 40, mustard-oil 15', 450, {
  s: 4,
  a: 'bhapa chingri; steamed prawns mustard',
});
fish.add('Daab chingri', 'e', 'prawns 400, coconut 150, coconut-milk 100, mustard-oil 15', 650, {
  s: 4,
  a: 'daab chingdi; prawn in tender coconut',
});
fish.add('Pabda jhal', 'e', 'catfish 400, mustard-seeds 15, mustard-oil 20, tomato 50', 600, {
  s: 4,
  a: 'pabda macher jhal',
});
fish.add('Tangra macher jhol', 'e', 'catfish 400, potato 80, mustard-oil 20, tomato 60', 700, {
  s: 4,
  a: 'tengra macher jhol; tengra',
});
fish.add('Koi maach', 'e', 'catfish 400, mustard-seeds 15, mustard-oil 25', 550, {
  s: 4,
  a: 'koi macher tel koi; climbing perch curry',
});
fish.add('Magur jhol', 'e', 'catfish 400, potato 80, mustard-oil 20', 700, {
  s: 4,
  a: 'magur macher jhol',
});
fish.add('Parshe maach', 'e', 'mullet 400, mustard-oil 20, tomato 50', 650, {
  s: 4,
  a: 'parshe macher jhal; mullet curry',
});
fish.add('Fish head curry', 'e', 'rohu 400, moong-dal 50, potato 60, mustard-oil 25', 800, {
  s: 4,
  a: 'muri ghonto style fish head; macher matha',
});
fish.add('Machha besara', 'e', 'rohu 500, mustard-seeds 25, mustard-oil 25', 650, {
  s: 4,
  a: 'machha besara odia',
});
fish.add('Machha tarkari', 'e', 'rohu 500, potato 100, tomato 80, mustard-oil 25', 850, {
  s: 4,
  a: 'machha jhola; odia fish curry',
});
fish.add('Chingudi malai', 'e', 'prawns 400, coconut-milk 200, onion 60, oil 15', 650, {
  s: 4,
  a: 'chingudi malai curry',
});
fish.add('Chingudi tarkari', 'e', 'prawns 400, potato 100, tomato 80, oil 20', 700, {
  s: 4,
  a: 'chingudi jhola; prawn curry odia',
});
fish.add('Fish tenga', 'e', 'rohu 400, tomato 200, lime 10, mustard-oil 20', 750, {
  s: 4,
  a: 'maasor tenga',
});
fish.add('Pitika fish', 'e', 'rohu 250, onion 40, mustard-oil 10', 260, {
  s: 3,
  u: DRY,
  d: 0.8,
  a: 'maas pitika; smoked fish mash',
});
fish.add('Ngari', 'e', 'anchovy 100, green-chilli 20, onion 30', 140, {
  s: 4,
  u: ['tbsp', 'g'],
  a: 'fermented fish manipur; ngari chutney',
});
fish.add('Iromba', 'e', 'anchovy 60, potato 150, beans 100, green-chilli 10', 300, {
  s: 3,
  a: 'eromba fish',
});
fish.add('Surmai curry', 'w', 'seer-fish 500, coconut 80, onion 80, oil 20', 850, {
  s: 4,
  a: 'surmai fish curry; kingfish curry; vanjaram curry',
});
fish.add('Surmai fry', 'w', 'seer-fish 400, oil 25, sooji 20', 350, {
  p: PCS(6),
  a: 'surmai tawa fry; vanjaram fry; kingfish tawa fry',
});
fish.add('Vanjaram fry', 's', 'seer-fish 400, oil 25, chilli-powder 6', 340, {
  p: PCS(6),
  id: 'vanjaram-fry-tamil',
  a: 'vanjaram meen varuval',
});
fish.add(
  'Vanjaram curry',
  's',
  'seer-fish 500, tamarind 15, shallots 60, coconut 50, oil 20',
  850,
  { s: 4, id: 'vanjaram-kuzhambu', a: 'vanjaram kuzhambu' },
);
fish.add('Pomfret fry', 'w', 'pomfret 400, oil 25, chilli-powder 6', 340, {
  p: PCS(4),
  a: 'paplet fry; pomfret masala fry',
});
fish.add('Pomfret tawa fry', 'w', 'pomfret 400, oil 25, sooji 20', 350, {
  p: PCS(4),
  a: 'paplet rava fry',
});
fish.add('Pomfret curry', 'w', 'pomfret 500, coconut 80, onion 80, oil 20', 850, {
  s: 4,
  a: 'paplet curry',
});
fish.add('Bombil fry', 'w', 'bombay-duck 400, sooji 30, oil 30', 300, {
  p: PCS(8, 'bombil', 'bombils'),
  a: 'bombay duck fry; bombil rava fry',
});
fish.add('Bombil curry', 'w', 'bombay-duck 500, coconut 80, onion 60, oil 20', 850, {
  s: 4,
  a: 'bombay duck curry',
});
fish.add('Sukha bombil', 'w', 'bombay-duck 150, onion 100, oil 20', 250, {
  s: 3,
  u: DRY,
  d: 0.8,
  a: 'dried bombil fry; sukat bombil',
});
fish.add('Sukat', 'w', 'prawns-small 150, onion 100, oil 20', 260, {
  s: 3,
  u: DRY,
  d: 0.8,
  a: 'sukat chutney; dried prawns',
});
fish.add('Bangda curry', 'w', 'mackerel 500, coconut 80, tamarind 10, oil 20', 850, {
  s: 4,
  a: 'bangda fish curry; malvani bangda',
});
fish.add('Bangda fry', 'w', 'mackerel 400, oil 25, sooji 20', 350, {
  p: PCS(4, 'fish', 'fish'),
  a: 'bangda rava fry',
});
fish.add('Kolambi fry', 'w', 'prawns 400, sooji 25, oil 30', 360, {
  s: 4,
  u: ['serving', 'g'],
  a: 'kolambi rava fry',
});
fish.add('Kolambi bhaat', 'w', 'rice 200, prawns 250, onion 80, coconut-dry 20, oil 25', 900, {
  s: 4,
  u: ['katori', 'serving', 'g'],
  d: 0.72,
  a: 'prawn pulao maharashtrian',
});
fish.add('Fish koliwada', 'w', 'basa 400, besan 40, cornflour 15, oil 40', 'm55', {
  s: 4,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'koliwada fish fry',
});
fish.add('Prawn koliwada', 'w', 'prawns 400, besan 40, cornflour 15, oil 40', 'm55', {
  s: 4,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'koliwada prawns',
});
fish.add('Prawn balchao', 'w', 'prawns 400, onion 150, vinegar 40, oil 40, sugar 10', 500, {
  s: 6,
  u: DRY,
  d: 0.85,
  a: 'balchao',
});
fish.add('Prawn xacuti', 'w', 'prawns 400, coconut 100, onion 100, oil 25', 750, {
  s: 4,
  a: 'xacuti prawns',
});
fish.add('Prawn caldine', 'w', 'prawns 400, coconut-milk 200, onion 80, oil 15', 700, {
  s: 4,
  a: 'caldine prawns',
});
fish.add('Prawn curry Goan', 'w', 'prawns 400, coconut 100, onion 60, tamarind 10, oil 15', 750, {
  s: 4,
  a: 'goan prawn curry; sungta hooman',
});
fish.add('Goan fish curry', 'w', 'pomfret 500, coconut 100, tamarind 10, oil 15', 850, {
  s: 4,
  a: 'xitt kodi; goan fish curry rice',
});
fish.add('Fish recheado', 'w', 'mackerel 400, vinegar 20, onion 40, oil 25', 380, {
  p: PCS(4, 'fish', 'fish'),
  a: 'recheado masala fish; bangda recheado',
});
fish.add('Goan fish fry', 'w', 'mackerel 400, sooji 25, oil 30', 360, {
  p: PCS(4, 'fish', 'fish'),
  a: 'goan rava fish fry',
});
fish.add('Ambot tik', 'w', 'red-snapper 500, tamarind 20, onion 80, oil 20', 800, {
  s: 4,
  a: 'ambot tik goan',
});
fish.add('Fish caldin', 'w', 'pomfret 500, coconut-milk 200, onion 80, oil 15', 850, {
  s: 4,
  a: 'caldin fish; caldeen',
});
fish.add('Karuvadu fry', 's', 'bombay-duck 150, onion 60, oil 25', 200, {
  s: 3,
  u: DRY,
  d: 0.8,
  a: 'dry fish fry tamil',
});
fish.add('Meen kuzhambu', 's', 'seer-fish 500, tamarind 20, shallots 60, oil 25', 850, {
  s: 4,
  a: 'fish kuzhambu; meen kulambu',
});
fish.add('Meen varuval', 's', 'seer-fish 400, oil 25, chilli-powder 6', 340, {
  p: PCS(6),
  a: 'fish varuval',
});
fish.add(
  'Chettinad fish curry',
  's',
  'seer-fish 500, onion 100, tomato 100, tamarind 12, oil 25',
  850,
  { s: 4, a: 'chettinad meen kuzhambu' },
);
fish.add('Chettinad prawn', 's', 'prawns 400, onion 120, tomato 80, coconut 30, oil 30', 600, {
  s: 4,
  a: 'chettinad prawn masala',
});
fish.add('Eral thokku', 's', 'prawns 400, onion 120, tomato 100, oil 30', 500, {
  s: 4,
  u: DRY,
  d: 0.85,
  a: 'prawn thokku',
});
fish.add('Fish pulusu', 's', 'rohu 500, tamarind 20, onion 80, oil 25', 850, {
  s: 4,
  a: 'chepala pulusu; fish tamarind curry',
});
fish.add('Chepala pulusu', 's', 'rohu 500, tamarind 25, onion 80, tomato 60, oil 30', 900, {
  s: 4,
  id: 'chepala-pulusu-andhra',
  a: 'andhra chepala pulusu',
});
fish.add('Chepa vepudu', 's', 'rohu 400, oil 25, chilli-powder 6', 340, {
  p: PCS(4),
  a: 'andhra fish fry',
});
fish.add('Royyala vepudu', 's', 'prawns 400, onion 60, oil 30', 360, {
  s: 4,
  u: DRY,
  d: 0.85,
  a: 'prawns fry andhra',
});
fish.add('Royyala iguru', 's', 'prawns 400, onion 120, tomato 80, oil 30', 500, {
  s: 4,
  u: DRY,
  d: 0.85,
  a: 'prawn iguru',
});
fish.add('Konaseema fish', 's', 'rohu 500, tamarind 20, onion 80, oil 30', 850, {
  s: 4,
  a: 'konaseema chepala pulusu',
});
fish.add('Pulasa pulusu', 's', 'hilsa 500, tamarind 25, onion 80, oil 20', 850, {
  s: 4,
  a: 'pulasa fish curry',
});
fish.add('Apollo fish', 's', 'basa 400, cornflour 30, egg 25, curd 30, oil 40', 'm55', {
  s: 4,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'apollo fish hyderabadi',
});
fish.add('Fish Hyderabadi', 's', 'seer-fish 500, onion 100, curd 60, tamarind 10, oil 25', 850, {
  s: 4,
  a: 'hyderabadi fish curry; machli ka salan',
});
fish.add('Fish 65', 's', 'basa 400, cornflour 25, rice-flour 15, curd 30, oil 35', 'm55', {
  s: 4,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'fish sixty five',
});
fish.add('Prawn 65', 's', 'prawns 400, cornflour 25, rice-flour 15, curd 30, oil 35', 'm55', {
  s: 4,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'prawns 65',
});
fish.add(
  'Chilli fish',
  'a',
  'basa 400, cornflour 30, oil 40, capsicum 60, onion 60, soy-sauce 12',
  520,
  { s: 4, u: DRY, d: 0.75, m: 'sd', a: 'fish chilli' },
);
fish.add(
  'Fish manchurian',
  'a',
  'basa 400, cornflour 30, maida 15, oil 40, capsicum 50, soy-sauce 12',
  520,
  { s: 4, u: DRY, d: 0.75, m: 'sd', a: 'manchurian fish' },
);
fish.add(
  'Fish in hot garlic sauce',
  'a',
  'basa 400, cornflour 25, oil 35, garlic 25, soy-sauce 12',
  600,
  { s: 4, a: 'fish hot garlic; fish in garlic sauce' },
);
fish.add(
  'Chilli prawns',
  'a',
  'prawns 400, cornflour 25, oil 35, capsicum 60, onion 60, soy-sauce 12',
  520,
  { s: 4, u: DRY, d: 0.75, m: 'sd', a: 'prawns chilli' },
);
fish.add('Amritsari fish', 'n', 'basa 400, besan 50, oil 40, lemon 10', 'm55', {
  s: 4,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'amritsari machli',
});
fish.add('Fish pakora', 'n', 'basa 400, besan 60, oil 40', 'm55', {
  s: 4,
  u: ['serving', 'g'],
  m: 'sd',
  a: 'machli pakoda; fish pakoda',
});
fish.add('Patra ni machhi', 'w', 'pomfret 400, coconut 60, coriander 30, mint 10, oil 10', 450, {
  p: PCS(4),
  a: 'patrani machi; parsi steamed fish',
});

export const PROTEIN = [...paneer.out, ...egg.out, ...chicken.out, ...meat.out, ...fish.out];
