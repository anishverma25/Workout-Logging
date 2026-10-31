import { DRY, group, PLATE, RICE } from './build';

/** Fasting (vrat), festival and temple foods. Vrat foods use no grains, onion or garlic. */
const vrat = group({ category: 'breakfast', meals: 'a', units: DRY });
const fest = group({ category: 'sweet', meals: 'sd', units: ['piece', 'g'] });
const meal = group({ category: 'rice', meals: 'm', units: RICE });
const PCS = (n: number, one: string, many: string) => [n, one, many] as [number, string, string];
const ONE = { nofat: true } as const;

vrat.add('Vrat ke aloo', 'n', 'potato 400, ghee 20, peanuts 15, green-chilli 4', 380, {
  s: 4,
  d: 0.65,
  a: 'vrat aloo; upvas batata bhaji; farali aloo',
});
vrat.add('Kuttu ki puri', 'n', 'kuttu-atta 25, potato 10, oil 7', 'm15', {
  p: PCS(1, 'puri', 'puris'),
  n: 3,
  a: 'kuttu puri; buckwheat puri',
});
vrat.add('Kuttu ka paratha', 'n', 'kuttu-atta 45, potato 30, ghee 8', 'm35', {
  p: PCS(1, 'paratha', 'parathas'),
  a: 'buckwheat paratha',
});
vrat.add('Kuttu ka dosa', 'n', 'kuttu-atta 50, potato 40, ghee 8', 'm45', {
  p: PCS(1, 'dosa', 'dosas'),
  a: 'buckwheat dosa',
});
vrat.add('Kuttu pakora', 'n', 'kuttu-atta 60, potato 100, oil 35', 'm40', {
  p: PCS(10, 'pakora', 'pakoras'),
  n: 4,
  a: 'kuttu pakode',
});
vrat.add('Rajgira paratha', 'n', 'amaranth-grain 45, potato 30, ghee 8', 'm32', {
  p: PCS(1, 'paratha', 'parathas'),
  a: 'amaranth paratha; rajgira thalipeeth',
});
vrat.add('Rajgira puri', 'n', 'amaranth-grain 25, potato 10, oil 7', 'm15', {
  p: PCS(1, 'puri', 'puris'),
  n: 3,
  a: 'rajgira poori',
});
vrat.add('Samak rice', 'n', 'little-millet 100, ghee 5', 330, {
  s: 2,
  u: ['katori', 'g'],
  d: 0.75,
  m: 'm',
  a: 'samvat rice; sama ke chawal; vrat ke chawal; bhagar; varai',
});
vrat.add('Samak khichdi', 'n', 'little-millet 100, potato 80, peanuts 20, ghee 15', 480, {
  s: 2,
  u: ['katori', 'g'],
  d: 0.8,
  a: 'samvat khichdi; bhagar khichdi',
});
vrat.add('Shakarkandi chaat', 'n', 'sweet-potato 250, lemon 10', 240, {
  s: 2,
  a: 'sweet potato chaat; shakarkand chaat',
});
vrat.add(
  'Falahari chaat',
  'n',
  'potato 150, banana 60, apple 60, pomegranate 30, peanuts 15, lemon 5',
  300,
  { s: 2, a: 'vrat fruit chaat; farali chaat' },
);
vrat.add('Vrat ki kadhi', 'n', 'curd 300, kuttu-atta 30, ghee 10', 600, {
  s: 4,
  u: ['katori', 'g'],
  m: 'm',
  a: 'farali kadhi; vrat kadhi',
});
vrat.add('Farali kadhi', 'w', 'curd 300, kuttu-atta 25, ghee 10, sugar 10', 600, {
  s: 4,
  u: ['katori', 'g'],
  m: 'm',
  id: 'farali-kadhi-gujarati',
});
vrat.add('Vrat ka dhokla', 'w', 'little-millet 100, curd 60, oil 10', 'm55', {
  p: PCS(12, 'piece', 'pieces'),
  n: 4,
  a: 'samo dhokla; farali dhokla; sama dhokla',
});
vrat.add('Farali pattice', 'w', 'potato 250, arrowroot 30, coconut 40, peanuts 20, oil 35', 'm50', {
  p: PCS(8, 'pattice', 'pattice'),
  n: 2,
  a: 'farali patties',
});
vrat.add('Farali chevdo', 'w', 'potato 200, peanuts 40, raisins 15, oil 45, sugar 10', 'm3', {
  u: ['g'],
  n: 30,
  a: 'farali chivda; upvas chivda; potato chivda',
});
vrat.add('Lauki halwa', 'n', 'lauki 600, milk 300, sugar 120, ghee 40', 'm48', {
  ...ONE,
  u: ['katori', 'g'],
  n: 0.5,
  id: 'vrat-lauki-halwa',
  a: 'vrat lauki halwa',
});
vrat.add('Rajgira ladoo', 'n', 'amaranth-grain 100, jaggery 80', 'm4', {
  ...ONE,
  p: PCS(10, 'ladoo', 'ladoos'),
  id: 'rajgira-ladoo-vrat',
  a: 'ramdana ladoo; amaranth ladoo',
});

fest.add('Pheni', 'n', 'maida 50, ghee 30', 'm2', {
  ...ONE,
  u: ['g'],
  n: 30,
  a: 'feni karwa chauth; sutarfeni pheni',
});
fest.add('Karah prasad', 'n', 'atta 100, ghee 100, sugar 100, water 300', 'm25', {
  ...ONE,
  u: ['tbsp', 'g'],
  n: 3,
  a: 'kada prasad; karah parshad; langar prasad',
});
fest.add('Langar dal', 'n', 'urad-whole 120, chana-dal 30, ghee 15, onion 30, tomato 50', 850, {
  s: 4,
  u: ['katori', 'g'],
  m: 'm',
  a: 'maa chole di dal; langar wali dal',
});
fest.add('Langar kheer', 'n', 'rice 40, milk 800, sugar 70', 700, {
  ...ONE,
  s: 5,
  u: ['katori', 'g'],
  a: 'gurdwara kheer',
});
fest.add('Prasad halwa', 'a', 'sooji 100, ghee 70, sugar 100, water 300', 'm30', {
  ...ONE,
  u: ['tbsp', 'g'],
  n: 3,
  a: 'sooji halwa prasad; satyanarayan sheera',
});
fest.add('Sheera prasad', 'w', 'sooji 100, ghee 60, sugar 100, milk 200, banana 40', 'm32', {
  ...ONE,
  u: ['tbsp', 'g'],
  n: 3,
  a: 'satyanarayan prasad sheera',
});
fest.add('Panchamrit', 'a', 'milk 100, curd 50, ghee 5, honey 10, sugar 10', 175, {
  ...ONE,
  u: ['tbsp', 'g'],
  n: 2,
  a: 'charnamrit; panchamrut',
});
fest.add('Tirupati laddu', 's', 'besan 100, ghee 60, sugar 120, cashews 15, raisins 10', 'm8', {
  ...ONE,
  p: PCS(2, 'laddu', 'laddus'),
  a: 'srivari laddu; tirumala laddu',
});
fest.add('Ugadi pachadi', 's', 'raw-mango 30, jaggery 40, tamarind 15, water 100', 180, {
  ...ONE,
  u: ['tbsp', 'g'],
  n: 2,
  a: 'bevu bella; ugadi chutney',
});
fest.add('Bisi hurigalu', 's', 'peanuts 40, kabuli-chana 40, sesame 20, jaggery 40', 'm3', {
  ...ONE,
  u: ['g'],
  n: 30,
  a: 'ellu bella; sankranti mix',
});
fest.add('Til gud', 'w', 'sesame 100, jaggery 100, peanuts 20', 'm4', {
  ...ONE,
  p: PCS(14, 'tilgul', 'tilgul'),
  a: 'tilgul; til gul',
});
fest.add('Kuswar', 'w', 'maida 100, coconut-dry 30, sugar 40, oil 30', 'm6', {
  ...ONE,
  u: ['g'],
  n: 40,
  a: 'goan christmas sweets',
});
fest.add('Bebinca', 'w', 'maida 60, coconut-milk 300, egg 150, sugar 120, ghee 50', 'm40', {
  ...ONE,
  p: PCS(12, 'slice', 'slices'),
  a: 'bebinka; goan layered cake',
});
fest.add('Dodol', 'w', 'rice-flour 100, coconut-milk 300, jaggery 150', 'm30', {
  ...ONE,
  p: PCS(12, 'piece', 'pieces'),
  a: 'goan dodol',
});
fest.add('Neureos', 'w', 'maida 100, coconut-dry 40, sugar 40, ghee 10, oil 30', 'm6', {
  ...ONE,
  p: PCS(10, 'neuri', 'neureos'),
  a: 'nevri; neuri',
});
fest.add('Perad', 'w', 'guava 400, sugar 200', 'm25', {
  ...ONE,
  p: PCS(14, 'piece', 'pieces'),
  a: 'guava cheese',
});
fest.add('Rose cookies', 'w', 'rice-flour 100, egg 25, coconut-milk 60, sugar 15, oil 30', 'm4', {
  ...ONE,
  p: PCS(18, 'cookie', 'cookies'),
  id: 'rose-cookies-goa',
  a: 'achappam goa',
});
fest.add('Kulkuls', 'w', 'maida 100, coconut-milk 40, egg 25, sugar 30, oil 30', 'm4', {
  ...ONE,
  u: ['g'],
  n: 30,
  a: 'kidiyo; kalkal',
});
fest.add('Vishu katta', 's', 'rice 150, coconut-milk 200, cumin 1', 520, {
  ...ONE,
  s: 4,
  u: ['katori', 'g'],
  m: 'b',
  a: 'vishu kanji; vishukatta',
});
fest.add('Kakinada kaja', 's', 'maida 100, ghee 20, oil 30, sugar 120', 'm12', {
  ...ONE,
  p: PCS(6, 'kaja', 'kajas'),
  a: 'kakinada khaja',
});
fest.add('Tapeswaram kaja', 's', 'maida 100, ghee 35, sugar 110, oil 20', 'm5', {
  ...ONE,
  p: PCS(8, 'kaja', 'kajas'),
  a: 'madatha kaja',
});
fest.add('Sakinalu', 's', 'rice-flour 100, sesame 10, oil 30', 'm4', {
  ...ONE,
  p: PCS(10, 'sakinalu', 'sakinalu'),
  a: 'sakinalu telangana',
});
fest.add('Sarva pindi', 's', 'rice-flour 100, chana-dal 20, peanuts 15, oil 20', 'm30', {
  p: PCS(2, 'sarva pindi', 'sarva pindis'),
  m: 'bs',
  a: 'sarvapindi; ginnappa',
});
fest.add('Jonna rotte', 's', 'jowar 50', 'm34', {
  ...ONE,
  p: PCS(1, 'rotte', 'rottes'),
  m: 'm',
});
fest.add('Sajja rotte', 's', 'bajra 50', 'm34', {
  ...ONE,
  p: PCS(1, 'rotte', 'rottes'),
  m: 'm',
  a: 'bajra roti telangana',
});
fest.add('Lukhmi', 's', 'maida 100, mutton-mince 80, oil 35', 'm25', {
  p: PCS(8, 'lukhmi', 'lukhmis'),
  m: 's',
  a: 'hyderabadi lukhmi',
});
fest.add('Pathiri', 's', 'rice-flour 100', 'm38', {
  ...ONE,
  p: PCS(4, 'pathiri', 'pathiris'),
  m: 'm',
  a: 'ari pathiri; rice pathiri',
});
fest.add('Ney pathiri', 's', 'rice-flour 100, coconut 20, oil 30', 'm20', {
  p: PCS(6, 'pathiri', 'pathiris'),
  m: 'bs',
  a: 'nei pathiri; fried pathiri',
});
fest.add('Pathiri and beef', 's', 'rice-flour 100, beef 150, onion 60, oil 15', 'm45', {
  s: 2,
  u: PLATE,
  m: 'm',
  a: 'pathiri beef curry',
});
fest.add('Kallummakkaya', 's', 'mussels 200, rice-flour 60, coconut 30, oil 25', 'm45', {
  p: PCS(10, 'piece', 'pieces'),
  m: 's',
  a: 'arikadukka; stuffed mussels',
});
fest.add('Abhada', 'e', 'rice 150, ghee 20', 450, {
  ...ONE,
  s: 3,
  u: ['katori', 'g'],
  m: 'm',
  a: 'jagannath abhada; mahaprasad rice',
});
fest.add('Khichdi mahaprasad', 'e', 'rice 100, moong-dal 50, ghee 25', 600, {
  ...ONE,
  s: 3,
  u: ['katori', 'g'],
  m: 'm',
  a: 'jagannath khichdi; adahengu khichdi',
});
fest.add('Khichuri bhog', 'e', 'rice 100, moong-dal 60, ghee 20, peas 30, cauliflower 50', 650, {
  ...ONE,
  s: 3,
  u: ['katori', 'g'],
  m: 'm',
  a: 'bhoger khichuri; durga puja bhog',
});
fest.add('Labra bhog', 'e', 'pumpkin 150, potato 100, brinjal 60, raw-banana 60, ghee 15', 420, {
  ...ONE,
  s: 3,
  u: ['katori', 'g'],
  m: 'm',
  a: 'labra; puja labra',
});
fest.add(
  'Pongal kuzhambu',
  's',
  'pumpkin 80, sweet-potato 60, raw-banana 60, toor-dal 40, tamarind 10, oil 10',
  650,
  { s: 4, u: ['katori', 'g'], m: 'm', a: 'ezhu kari kootu' },
);

meal.add('Natu kodi pulao', 's', 'rice 250, country-chicken 400, onion 100, oil 35', 1150, {
  s: 5,
  d: 0.72,
  a: 'natu kodi pulav; country chicken pulao',
});
meal.add('Ragi sangati', 's', 'ragi 60, rice 40, water 300', 380, {
  s: 2,
  u: ['katori', 'g'],
  a: 'ragi sankati; ragi muddha',
});

export const FESTIVAL = [...vrat.out, ...fest.out, ...meal.out];
