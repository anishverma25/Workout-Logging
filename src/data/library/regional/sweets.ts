import { group } from './build';

/**
 * Sweets, mithai and desserts. Syrup sweets count the syrup a piece holds, not the whole pan
 * (the curated gulab jamun's method). Chhena is fresh paneer; khoya is IFCT khoa.
 */
const sweet = group({ category: 'sweet', meals: 'sd', units: ['piece', 'g'] });
const bowl = group({ category: 'sweet', meals: 'sd', units: ['katori', 'g'] });
const PCS = (n: number, one: string, many: string) => [n, one, many] as [number, string, string];
const ONE = { nofat: true } as const;

// Ladoos and barfis
sweet.add('Coconut ladoo', 'a', 'coconut-dry 100, condensed-milk 100, ghee 5', 'm8', {
  ...ONE,
  p: PCS(12, 'ladoo', 'ladoos'),
  a: 'nariyal ladoo; narkel naru',
});
sweet.add('Narkel naru', 'e', 'coconut 200, jaggery 100', 'm18', {
  ...ONE,
  p: PCS(14, 'naru', 'narus'),
  a: 'narkol naru; coconut jaggery ladoo',
});
sweet.add(
  'Dry fruit ladoo',
  'a',
  'dates 150, almonds 40, cashews 40, pistachios 20, ghee 5',
  'm12',
  { ...ONE, p: PCS(12, 'ladoo', 'ladoos'), a: 'dates ladoo; khajur ladoo' },
);
sweet.add('Atta ladoo', 'n', 'atta 150, ghee 75, sugar 100, almonds 10', 'm3', {
  ...ONE,
  p: PCS(15, 'ladoo', 'ladoos'),
  a: 'aate ke ladoo; wheat ladoo',
});
sweet.add('Methi ladoo', 'w', 'atta 100, ghee 80, jaggery 100, almonds 20, methi-seeds 10', 'm3', {
  ...ONE,
  p: PCS(14, 'ladoo', 'ladoos'),
  a: 'methi ke ladoo',
});
sweet.add('Gond ladoo', 'w', 'atta 100, ghee 80, jaggery 100, almonds 20, coconut-dry 20', 'm3', {
  ...ONE,
  p: PCS(14, 'ladoo', 'ladoos'),
  a: 'gond ke ladoo; dinkache ladoo; dink ladoo',
});
sweet.add('Churma ladoo', 'w', 'atta 150, ghee 70, sugar 80, almonds 10', 'm4', {
  ...ONE,
  p: PCS(14, 'ladoo', 'ladoos'),
  a: 'churma ke laddu',
});
sweet.add('Rava ladoo', 's', 'sooji 150, ghee 60, sugar 120, coconut 30, cashews 10', 'm6', {
  ...ONE,
  p: PCS(16, 'ladoo', 'ladoos'),
  a: 'sooji ladoo; rava laddu',
});
sweet.add('Peanut ladoo', 'a', 'peanuts 150, jaggery 100, ghee 5', 'm4', {
  ...ONE,
  p: PCS(14, 'ladoo', 'ladoos'),
  a: 'shengdana ladoo; moongphali ladoo',
});
sweet.add('Moong dal ladoo', 'n', 'moong-dal 150, ghee 70, sugar 120', 'm4', {
  ...ONE,
  p: PCS(15, 'ladoo', 'ladoos'),
  a: 'moong ladoo',
});
sweet.add('Bandar laddu', 's', 'besan 150, ghee 70, sugar 150, cashews 10', 'm6', {
  ...ONE,
  p: PCS(16, 'laddu', 'laddus'),
  a: 'bandaru laddu',
});
sweet.add('Sunnundalu', 's', 'urad-dal 150, ghee 60, jaggery 120', 'm4', {
  ...ONE,
  p: PCS(14, 'sunnunda', 'sunnundalu'),
  a: 'sunnundalu andhra; urad dal laddu',
});
sweet.add('Kaju pista roll', 'a', 'cashews 150, pistachios 40, sugar 90, ghee 5', 'm6', {
  ...ONE,
  p: PCS(16, 'roll', 'rolls'),
  a: 'kaju roll',
});
sweet.add('Anjeer barfi', 'a', 'figs-dried 150, almonds 30, cashews 30, ghee 8', 'm18', {
  ...ONE,
  p: PCS(14, 'piece', 'pieces'),
  a: 'anjeer roll; fig roll',
});
sweet.add('Kesar peda', 'a', 'khoya 200, sugar 60, saffron 0.2', 'm25', {
  ...ONE,
  p: PCS(12, 'peda', 'pedas'),
  a: 'kesar pedha; malai peda',
});
sweet.add('Dharwad peda', 's', 'khoya 200, milk 200, sugar 70', 'm15', {
  ...ONE,
  p: PCS(14, 'peda', 'pedas'),
  a: 'dharwad pedha',
});
sweet.add('Lal peda', 'e', 'khoya 200, milk 200, sugar 60', 'm14', {
  ...ONE,
  p: PCS(14, 'peda', 'pedas'),
  a: 'lal pedha; laal peda bihar',
});
sweet.add('Kalakand', 'w', 'milk 1000, sugar 80', 'm28', {
  ...ONE,
  p: PCS(12, 'piece', 'pieces'),
  a: 'kalakand mithai; milk cake soft',
});
sweet.add('Alwar ka mawa', 'w', 'milk 1000, sugar 80, ghee 10', 'm18', {
  ...ONE,
  p: PCS(12, 'piece', 'pieces'),
  a: 'alwar mawa; milk cake; alwar milk cake',
});
sweet.add('Soan papdi', 'n', 'besan 60, maida 60, ghee 60, sugar 150, almonds 5', 'm2', {
  ...ONE,
  p: PCS(16, 'piece', 'pieces'),
  a: 'son papdi; patisa',
});
sweet.add('Patisa', 'n', 'besan 70, maida 50, ghee 60, sugar 150', 'm2', {
  ...ONE,
  p: PCS(16, 'piece', 'pieces'),
  id: 'patisa-sweet',
  a: 'pateesa',
});
sweet.add('Mohanthal', 'w', 'besan 150, ghee 100, sugar 140, khoya 50, almonds 10', 'm6', {
  ...ONE,
  p: PCS(16, 'piece', 'pieces'),
  a: 'mohan thal',
});
sweet.add('Sutarfeni', 'w', 'maida 100, ghee 60, sugar 80, almonds 10', 'm2', {
  ...ONE,
  p: PCS(10, 'piece', 'pieces'),
  a: 'sutar feni; feni',
});
sweet.add('Feeni', 'w', 'maida 100, ghee 70, milk 200, sugar 60', 'm30', {
  ...ONE,
  p: PCS(4, 'feeni', 'feenis'),
  id: 'feeni-rajasthani',
  a: 'pheni; feni with milk',
});
sweet.add('Ghevar', 'w', 'maida 100, ghee 80, sugar 100, milk 50', 'm10', {
  ...ONE,
  p: PCS(4, 'ghevar', 'ghevars'),
  a: 'ghewar; plain ghevar',
});
sweet.add('Malai ghewar', 'w', 'maida 100, ghee 80, sugar 100, khoya 60, cream 50', 'm18', {
  ...ONE,
  p: PCS(4, 'ghevar', 'ghevars'),
  a: 'malai ghevar; rabri ghevar',
});
sweet.add('Mysore pak ghee', 's', 'besan 100, ghee 200, sugar 200', 'm3', {
  ...ONE,
  p: PCS(16, 'piece', 'pieces'),
  id: 'soft-mysore-pak',
  a: 'soft mysore pak; ghee mysore pak; mysorepak',
});
sweet.add('Parwal ki mithai', 'e', 'parwal 200, khoya 150, sugar 120, almonds 10', 'm30', {
  ...ONE,
  p: PCS(12, 'piece', 'pieces'),
  a: 'parwal mithai; potoler mishti',
});
sweet.add('Tilkut', 'e', 'sesame 100, jaggery 100', 'm3', {
  ...ONE,
  p: PCS(12, 'tilkut', 'tilkuts'),
  a: 'tilkut gaya; tilkoot',
});
sweet.add('Khaja', 'e', 'maida 150, ghee 40, oil 40, sugar 120', 'm4', {
  ...ONE,
  p: PCS(12, 'khaja', 'khajas'),
  a: 'silao khaja; kakinada kaja; tapeswaram kaja',
});
sweet.add('Lai', 'e', 'puffed-rice 100, jaggery 100', 'm5', {
  ...ONE,
  p: PCS(10, 'lai', 'lais'),
  a: 'murmura ladoo; ramdana lai; murir moa',
});
sweet.add('Petha', 'n', 'ash-gourd 500, sugar 300', 'm20', {
  ...ONE,
  p: PCS(15, 'piece', 'pieces'),
  a: 'agra petha; angoori petha; kesar petha',
});

// Bengal and Odisha
sweet.add('Mishti doi', 'e', 'milk 1000, sugar 100', 600, {
  ...ONE,
  u: ['katori', 'g'],
  s: 6,
  a: 'misti doi; sweet curd bengali; mishti dahi',
});
// Cham cham: chhena dumplings cooked in syrup, rolled in khoya; a piece holds its syrup.
sweet.add('Cham cham', 'e', 'paneer 200, maida 10, sugar 150, khoya 40, coconut-dry 5', 'm38', {
  ...ONE,
  p: PCS(10, 'cham cham', 'cham chams'),
  a: 'chum chum; chom chom; chamcham; malai chum chum',
});
sweet.add('Churma', 'w', 'atta 150, ghee 60, sugar 60, almonds 10', 'm5', {
  ...ONE,
  u: ['katori', 'g'],
  n: 0.4,
  d: 0.5,
  a: 'rajasthani churma; churma sweet; meetha churma',
});
sweet.add('Langcha', 'e', 'paneer 150, maida 20, khoya 30, sugar 120, ghee 15', 'm28', {
  ...ONE,
  p: PCS(8, 'langcha', 'langchas'),
  a: 'lyangcha; pantua',
});
sweet.add('Pantua', 'e', 'paneer 150, maida 15, khoya 40, sugar 110, ghee 15', 'm28', {
  ...ONE,
  p: PCS(8, 'pantua', 'pantuas'),
  id: 'pantua-bengali',
  a: 'bengali pantua',
});
sweet.add('Ledikeni', 'e', 'paneer 150, maida 15, sugar 110, ghee 15', 'm28', {
  ...ONE,
  p: PCS(8, 'ledikeni', 'ledikenis'),
  a: 'lady kenny',
});
sweet.add('Rajbhog', 'e', 'paneer 200, sugar 180, almonds 8, saffron 0.1', 'm42', {
  ...ONE,
  p: PCS(8, 'rajbhog', 'rajbhogs'),
  a: 'raj bhog; kesar rasgulla',
});
sweet.add('Rasbari', 'e', 'paneer 150, sugar 120', 'm45', {
  ...ONE,
  p: PCS(14, 'piece', 'pieces'),
  a: 'rasbhari; mini rasgulla',
});
sweet.add('Chanar jalebi', 'e', 'paneer 150, maida 20, sugar 120, ghee 15', 'm25', {
  ...ONE,
  p: PCS(8, 'jalebi', 'jalebis'),
  a: 'chhanar jilipi; chhena jalebi',
});
sweet.add('Nolen gurer sandesh', 'e', 'paneer 200, jaggery 60', 'm38', {
  ...ONE,
  p: PCS(10, 'sandesh', 'sandesh'),
  a: 'nolen gur sandesh; jaggery sandesh',
});
sweet.add('Sitabhog', 'e', 'rice-flour 50, paneer 100, sugar 120, ghee 30', 'm20', {
  n: 0.5,
  u: ['katori', 'g'],
  s: 6,
  nofat: true,
  a: 'sitabhog burdwan',
});
sweet.add('Mihidana', 'e', 'besan 100, rice-flour 30, sugar 120, ghee 40', 'm15', {
  n: 0.5,
  u: ['katori', 'g'],
  s: 6,
  nofat: true,
  a: 'mihidana burdwan',
});
sweet.add('Kheer kadam', 'e', 'paneer 150, khoya 80, sugar 100', 'm35', {
  ...ONE,
  p: PCS(10, 'kheer kadam', 'kheer kadams'),
  a: 'ras kadam; rasakadam',
});
sweet.add(
  'Pati shapta',
  'e',
  'maida 60, rice-flour 30, milk 120, coconut 80, jaggery 60, ghee 8',
  'm38',
  { ...ONE, p: PCS(6, 'patishapta', 'patishaptas'), a: 'patishapta; patisapta' },
);
sweet.add('Bhapa pitha', 'e', 'rice-flour 100, coconut 60, jaggery 60', 'm40', {
  ...ONE,
  p: PCS(6, 'pitha', 'pithas'),
  a: 'bhapa pithe',
});
sweet.add('Dudh puli', 'e', 'rice-flour 100, coconut 60, jaggery 60, milk 400', 650, {
  ...ONE,
  u: ['katori', 'g'],
  s: 5,
  a: 'dudh puli pithe',
});
sweet.add('Puli pitha', 'e', 'rice-flour 100, coconut 60, jaggery 60, oil 20', 'm28', {
  ...ONE,
  p: PCS(10, 'puli', 'pulis'),
  a: 'puli pithe',
});
sweet.add('Gokul pitha', 'e', 'coconut 100, khoya 40, maida 30, oil 25, sugar 100', 'm22', {
  ...ONE,
  p: PCS(8, 'pitha', 'pithas'),
  a: 'gokul pithe',
});
sweet.add('Chhena jhili', 'e', 'paneer 150, maida 15, sugar 120, ghee 20', 'm28', {
  ...ONE,
  p: PCS(8, 'jhili', 'jhilis'),
  a: 'chhena jhilli',
});
sweet.add('Rasabali', 'e', 'paneer 150, maida 10, ghee 15, milk 400, sugar 60', 650, {
  ...ONE,
  u: ['katori', 'g'],
  s: 6,
  a: 'rasabali kendrapara',
});
sweet.add('Khira sagara', 'e', 'paneer 150, milk 500, sugar 80', 650, {
  ...ONE,
  u: ['katori', 'g'],
  s: 6,
  a: 'kheer sagar',
});
sweet.add('Chhena gaja', 'e', 'paneer 150, sooji 20, ghee 20, sugar 100', 'm22', {
  ...ONE,
  p: PCS(8, 'gaja', 'gajas'),
  a: 'chenna gaja',
});
sweet.add('Manda pitha', 'e', 'rice-flour 100, coconut 60, jaggery 60', 'm42', {
  ...ONE,
  p: PCS(6, 'manda', 'mandas'),
  a: 'manda pitha odia',
});
sweet.add('Arisa pitha', 'e', 'rice-flour 100, jaggery 70, sesame 8, oil 30', 'm15', {
  ...ONE,
  p: PCS(8, 'arisa', 'arisas'),
  a: 'arisa pitha odia; anarsa odia',
});
sweet.add('Kakara pitha', 'e', 'sooji 100, coconut 60, jaggery 60, oil 25', 'm22', {
  ...ONE,
  p: PCS(8, 'kakara', 'kakaras'),
  a: 'kakara pitha',
});
sweet.add('Enduri pitha', 'e', 'rice 80, urad-dal 30, coconut 50, jaggery 40', 'm48', {
  ...ONE,
  p: PCS(6, 'enduri', 'enduris'),
  a: 'enduri pitha turmeric leaf',
});

// South
sweet.add('Bombay halwa', 's', 'cornflour 100, sugar 200, ghee 50, cashews 10', 'm20', {
  ...ONE,
  p: PCS(16, 'piece', 'pieces'),
  a: 'kozhikode halwa; karachi halwa; corn flour halwa',
});
sweet.add('Karachi halwa', 's', 'cornflour 100, sugar 220, ghee 40, cashews 15', 'm18', {
  ...ONE,
  p: PCS(16, 'piece', 'pieces'),
  id: 'karachi-halwa-hyd',
});
sweet.add('Tirunelveli halwa', 's', 'atta 100, sugar 200, ghee 120, cashews 10', 'm15', {
  ...ONE,
  u: ['tbsp', 'g'],
  n: 3,
  a: 'iruttukadai halwa; wheat halwa tamil',
});
sweet.add('Wheat halwa', 's', 'atta 100, sugar 180, ghee 100', 'm18', {
  ...ONE,
  u: ['tbsp', 'g'],
  n: 3,
  a: 'godhumai halwa',
});
sweet.add('Akkaravadisal', 's', 'rice 100, moong-dal 20, milk 600, jaggery 120, ghee 40', 900, {
  ...ONE,
  u: ['katori', 'g'],
  s: 6,
  a: 'akkara adisil',
});
sweet.add('Paal kozhukattai', 's', 'rice-flour 100, milk 400, jaggery 80, coconut 30', 650, {
  ...ONE,
  u: ['katori', 'g'],
  s: 5,
  a: 'pal kozhukattai',
});
sweet.add('Kozhukatta', 's', 'rice-flour 100, coconut 60, jaggery 60', 'm42', {
  ...ONE,
  p: PCS(10, 'kozhukatta', 'kozhukattas'),
  a: 'modak south',
});
sweet.add('Adhirasam', 's', 'rice-flour 150, jaggery 120, ghee 10, oil 40', 'm8', {
  ...ONE,
  p: PCS(12, 'adhirasam', 'adhirasams'),
  a: 'athirasam; ariselu; kajjaya',
});
sweet.add('Ariselu', 's', 'rice-flour 150, jaggery 120, sesame 10, oil 40', 'm8', {
  ...ONE,
  p: PCS(12, 'ariselu', 'ariselu'),
  id: 'ariselu-andhra',
});
sweet.add('Kajjikayalu', 's', 'maida 100, coconut-dry 50, sugar 60, oil 35', 'm6', {
  ...ONE,
  p: PCS(10, 'kajjikaya', 'kajjikayalu'),
  a: 'kajjikaya; karanji andhra',
});
sweet.add('Garelu', 's', 'urad-dal 150, jaggery 80, oil 35', 'm35', {
  ...ONE,
  p: PCS(10, 'garelu', 'garelu'),
  a: 'bellam garelu',
});
sweet.add('Appalu', 's', 'rice-flour 120, jaggery 100, ghee 10, oil 35', 'm10', {
  ...ONE,
  p: PCS(12, 'appam', 'appalu'),
  a: 'bellam appalu',
});
sweet.add('Bellam paramannam', 's', 'rice 80, moong-dal 20, milk 400, jaggery 100, ghee 20', 750, {
  ...ONE,
  u: ['katori', 'g'],
  s: 5,
  a: 'paramannam; bellam pongali',
});
sweet.add('Jangiri', 's', 'urad-dal 100, sugar 150, ghee 30', 'm15', {
  ...ONE,
  p: PCS(10, 'jangiri', 'jangiris'),
  a: 'imarti; jhangri; amriti',
});
sweet.add('Badusha', 's', 'maida 150, ghee 40, curd 30, sugar 130, oil 30', 'm8', {
  ...ONE,
  p: PCS(12, 'badusha', 'badushas'),
  a: 'balushahi',
});
sweet.add('Badam halwa', 's', 'almonds 150, sugar 120, ghee 60, milk 100', 'm12', {
  ...ONE,
  u: ['tbsp', 'g'],
  n: 3,
  a: 'almond halwa',
});
sweet.add('Banana halwa', 's', 'plantain-ripe 300, jaggery 150, ghee 50', 'm15', {
  ...ONE,
  u: ['tbsp', 'g'],
  n: 3,
  a: 'nendran halwa; ethakka halwa',
});
sweet.add('Beetroot halwa', 'a', 'beetroot 500, milk 300, sugar 100, ghee 40, cashews 10', 'm40', {
  ...ONE,
  u: ['katori', 'g'],
  n: 0.5,
  a: 'chukandar ka halwa',
});
sweet.add('Dudhi halwa', 'n', 'lauki 600, milk 300, sugar 120, ghee 40, khoya 50', 'm45', {
  ...ONE,
  u: ['katori', 'g'],
  n: 0.5,
  a: 'lauki halwa; ghiya halwa',
});
sweet.add('Atta halwa', 'n', 'atta 100, ghee 80, sugar 100, water 300', 'm30', {
  ...ONE,
  u: ['katori', 'g'],
  n: 0.5,
  a: 'aate ka halwa; kada prasad; karah prasad',
});

// Kheer and payasam
bowl.add('Sewai kheer', 'n', 'vermicelli 50, milk 750, sugar 60, ghee 8, almonds 10', 650, {
  ...ONE,
  s: 5,
  a: 'seviyan kheer; semiya payasam',
});
bowl.add(
  'Semiya payasam',
  's',
  'vermicelli 50, milk 700, sugar 70, ghee 10, cashews 10, raisins 10',
  650,
  { ...ONE, s: 5, id: 'semiya-payasam-kerala' },
);
bowl.add('Moong dal payasam', 's', 'moong-dal 80, jaggery 150, coconut-milk 300, ghee 15', 700, {
  ...ONE,
  s: 5,
  a: 'pasi paruppu payasam; cherupayar payasam',
});
bowl.add(
  'Ada pradhaman',
  's',
  'rice-flour 60, jaggery 200, coconut-milk 400, ghee 15, cashews 10',
  750,
  { ...ONE, s: 6, a: 'ada payasam' },
);
bowl.add('Palada payasam', 's', 'rice-flour 50, milk 900, sugar 120, ghee 10', 800, {
  ...ONE,
  s: 6,
  a: 'palada pradhaman',
});
bowl.add('Parippu payasam', 's', 'moong-dal 100, jaggery 180, coconut-milk 400, ghee 15', 800, {
  ...ONE,
  s: 6,
  a: 'parippu pradhaman',
});
bowl.add('Elaneer payasam', 's', 'coconut 100, milk 500, condensed-milk 100', 650, {
  ...ONE,
  s: 5,
  a: 'tender coconut payasam; ilaneer payasam',
});
bowl.add('Payasa', 's', 'rice 50, milk 700, jaggery 100, ghee 10', 700, {
  ...ONE,
  s: 5,
  a: 'akki payasa; karnataka payasa',
});
bowl.add('Sabudana kheer', 'a', 'sabudana 50, milk 700, sugar 70', 650, {
  ...ONE,
  s: 5,
  a: 'sago kheer; javvarisi payasam',
});
bowl.add('Lauki kheer', 'n', 'lauki 250, milk 700, sugar 70', 750, {
  ...ONE,
  s: 5,
  a: 'dudhi kheer',
});
bowl.add('Sweet corn kheer', 'n', 'sweet-corn 150, milk 700, sugar 70', 750, {
  ...ONE,
  s: 5,
  a: 'corn kheer; makai kheer',
});
bowl.add(
  'Sheer khurma',
  'n',
  'vermicelli 50, milk 800, sugar 80, dates 40, almonds 15, cashews 15, ghee 15',
  800,
  { ...ONE, s: 6, a: 'sheer korma; sheer kurma' },
);
bowl.add('Nolen gurer payesh', 'e', 'rice 60, milk 900, jaggery 100', 750, {
  ...ONE,
  s: 6,
  a: 'nolen gur payesh; payesh bhog',
});
bowl.add('Chhanar payesh', 'e', 'paneer 150, milk 600, sugar 80', 650, {
  ...ONE,
  s: 5,
  a: 'chanar payesh',
});
bowl.add('Narali bhat', 'w', 'rice 150, coconut 80, jaggery 120, ghee 20, cashews 10', 600, {
  ...ONE,
  s: 5,
  u: ['katori', 'g'],
  a: 'narali bhaat; coconut sweet rice',
});
bowl.add('Gil e firdaus', 's', 'lauki 150, sabudana 30, milk 700, khoya 40, sugar 70', 750, {
  ...ONE,
  s: 5,
  a: 'gil e firdaus hyderabadi',
});
bowl.add('Qubani ka meetha', 's', 'apricots-dried 200, sugar 80, cream 40', 450, {
  ...ONE,
  s: 5,
  a: 'khubani ka meetha',
});
bowl.add('Shahi tukda', 's', 'bread 100, ghee 40, sugar 60, milk 400, khoya 30', 450, {
  ...ONE,
  s: 5,
  a: 'shahi tukra; shahi toast',
});
bowl.add('Double ka meetha', 's', 'bread 100, ghee 40, sugar 70, milk 400', 420, {
  ...ONE,
  s: 5,
  a: 'double ka meetha hyderabadi',
});
bowl.add('Malai makhan', 'n', 'milk 300, cream 150, sugar 30', 300, {
  n: 0.6,
  ...ONE,
  s: 4,
  a: 'daulat ki chaat; makhan malai; malaiyo',
});
bowl.add('Nimish', 'n', 'milk 300, cream 150, sugar 30', 300, {
  n: 0.6,
  ...ONE,
  s: 4,
  id: 'nimish-lucknow',
  a: 'malaiyo lucknow',
});
bowl.add('Malai toast', 'n', 'bread 40, cream 40, sugar 10', 90, {
  ...ONE,
  s: 1,
  u: ['piece', 'g'],
  p: PCS(1, 'toast', 'toasts'),
  a: 'malai toast lucknow',
});
bowl.add(
  'Fruit custard',
  'a',
  'milk 500, cornflour 25, sugar 60, banana 100, apple 100, grapes 60',
  820,
  { ...ONE, s: 5, a: 'custard fruits' },
);
bowl.add('Gelatin dessert', 'a', 'sugar 90, water 450', 500, {
  ...ONE,
  s: 5,
  a: 'jelly dessert; jelly',
});
bowl.add('Cassata', 'a', 'ice-cream 150, choc-ice-cream 50, sponge-cake 30, cashews 8', 238, {
  n: 0.6,
  ...ONE,
  s: 2,
  a: 'cassata ice cream',
});
bowl.add('Sundae', 'a', 'ice-cream 120, choc-ice-cream 30, cashews 10, sugar 10', 170, {
  n: 0.7,
  ...ONE,
  s: 1,
  a: 'ice cream sundae',
});
bowl.add('Butterscotch ice cream', 'a', 'ice-cream 100, brown-sugar 8, cashews 5', 113, {
  n: 0.6,
  ...ONE,
  s: 1,
  a: 'butterscotch',
});
bowl.add('Kaju kishmish ice cream', 'a', 'ice-cream 100, cashews 8, raisins 8', 116, {
  n: 0.6,
  ...ONE,
  s: 1,
  a: 'kaju draksh ice cream',
});
bowl.add('Pista kulfi', 'n', 'milk 600, sugar 60, pistachios 30, milk-powder 20', 'm60', {
  ...ONE,
  u: ['piece', 'g'],
  p: PCS(6, 'kulfi', 'kulfis'),
  a: 'pistachio kulfi',
});
bowl.add('Mango kulfi', 'n', 'milk 500, sugar 50, mango 150, milk-powder 20', 'm62', {
  ...ONE,
  u: ['piece', 'g'],
  p: PCS(6, 'kulfi', 'kulfis'),
  a: 'aam kulfi',
});
bowl.add(
  'Kesar pista kulfi',
  'n',
  'milk 600, sugar 60, pistachios 25, saffron 0.2, milk-powder 20',
  'm60',
  { ...ONE, u: ['piece', 'g'], p: PCS(6, 'kulfi', 'kulfis'), a: 'kesar kulfi' },
);
bowl.add('Ice cream sandwich', 'a', 'ice-cream 60, choc-chip-cookie 30', 90, {
  ...ONE,
  u: ['piece', 'g'],
  p: PCS(1, 'sandwich', 'sandwiches'),
  a: 'ice cream biscuit',
});

// Cakes, bakes and fusion
sweet.add('Mawa cake', 'w', 'maida 100, khoya 60, butter 60, sugar 90, egg 50, milk 30', 'm20', {
  ...ONE,
  p: PCS(8, 'slice', 'slices'),
  a: 'parsi mawa cake',
});
sweet.add('Lagan nu custard', 'w', 'milk 600, egg 150, sugar 80, almonds 10', 'm68', {
  ...ONE,
  u: ['katori', 'g'],
  n: 0.5,
  a: 'parsi custard',
});
sweet.add(
  'Plum cake',
  's',
  'maida 100, butter 80, sugar 80, egg 100, raisins 60, cashews 20, figs-dried 20',
  'm22',
  { ...ONE, p: PCS(10, 'slice', 'slices'), a: 'christmas plum cake; kerala plum cake; fruit cake' },
);
sweet.add('Rum cake', 's', 'maida 100, butter 80, sugar 90, egg 100, raisins 50', 'm22', {
  ...ONE,
  p: PCS(10, 'slice', 'slices'),
  a: 'christmas rum cake',
});
sweet.add(
  'Dry fruit cake',
  'a',
  'maida 100, butter 70, sugar 80, egg 100, raisins 40, cashews 20, almonds 20',
  'm22',
  { ...ONE, p: PCS(10, 'slice', 'slices'), a: 'fruit cake' },
);
sweet.add('Chocolate cake', 'a', 'sponge-cake 60, dark-chocolate 15, cream 20, sugar 5', 100, {
  ...ONE,
  p: PCS(1, 'slice', 'slices'),
  id: 'chocolate-cake-slice',
  a: 'chocolate pastry; chocolate truffle slice',
});
sweet.add(
  'Choco lava cake',
  'a',
  'maida 15, dark-chocolate 35, butter 20, sugar 15, egg 25',
  'm22',
  { ...ONE, p: PCS(1, 'cake', 'cakes'), a: 'chocolate lava cake; molten lava cake' },
);
sweet.add('Baked gulab jamun', 'a', 'milk-powder 40, maida 8, ghee 8, sugar 30, water 20', 'm25', {
  ...ONE,
  p: PCS(3, 'jamun', 'jamuns'),
  a: 'baked jamun',
});
sweet.add('Rasmalai cake', 'a', 'sponge-cake 60, cream 25, milk 20, sugar 6, pistachios 4', 115, {
  ...ONE,
  p: PCS(1, 'slice', 'slices'),
  a: 'rasmalai pastry',
});
sweet.add('Gulab jamun cheesecake', 'a', 'cheesecake 90, milk-powder 10, sugar 10', 110, {
  ...ONE,
  p: PCS(1, 'slice', 'slices'),
  a: 'jamun cheesecake',
});
bowl.add('Gulab jamun ice cream', 'a', 'ice-cream 80, milk-powder 15, sugar 15, ghee 3', 110, {
  n: 0.7,
  ...ONE,
  s: 1,
  a: 'gulab jamun with ice cream',
});
sweet.add('Meetha paan', 'a', 'betel-leaf 5, sugar 5, coconut-dry 3, dates 3, raisins 1', 17, {
  ...ONE,
  p: PCS(1, 'paan', 'paans'),
  a: 'sweet paan; banarasi meetha paan',
});
sweet.add('Paan', 'a', 'betel-leaf 5, coconut-dry 1', 6, {
  ...ONE,
  p: PCS(1, 'paan', 'paans'),
  a: 'plain paan; saada paan; banarasi paan',
});
sweet.add('Fire paan', 'a', 'betel-leaf 5, sugar 5, coconut-dry 3, dates 3', 16, {
  ...ONE,
  p: PCS(1, 'paan', 'paans'),
  a: 'aag paan',
});
sweet.add('Gulkand', 'a', 'sugar 100, water 10', 105, {
  ...ONE,
  u: ['tsp', 'tbsp', 'g'],
  n: 1,
  a: 'rose petal jam; gulkand',
});
sweet.add('Kesar pista roll', 'a', 'cashews 100, pistachios 30, sugar 70, saffron 0.1', 'm6', {
  ...ONE,
  p: PCS(12, 'roll', 'rolls'),
  a: 'kesar roll',
});

export const SWEETS = [...sweet.out, ...bowl.out];
