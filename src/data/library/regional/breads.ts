import { group } from './build';

/**
 * Breads, rotis, parathas and bakery. Flatbreads use the cooked moisture of USDA chapati and
 * naan (about 34%); fried breads and biscuits lose most of their water.
 */
const bread = group({ category: 'bread', meals: 'm', units: ['piece', 'g'] });
const PCS = (n: number, one: string, many: string) => [n, one, many] as [number, string, string];
const ROTI = PCS(1, 'roti', 'rotis');
const PARATHA = PCS(1, 'paratha', 'parathas');

bread.add('Butter roti', 'n', 'atta 30, butter 5', 'm34', {
  p: ROTI,
  n: 2,
  a: 'butter chapati; tandoori butter roti',
});
bread.add('Tawa roti', 'a', 'atta 35', 'm34', { p: ROTI, n: 2, a: 'tawa chapati; thick roti' });
bread.add('Multigrain roti', 'a', 'atta 20, jowar 5, bajra 5, ragi 5', 'm34', {
  p: ROTI,
  n: 2,
  a: 'multigrain chapati',
});
bread.add('Ragi atta roti', 'a', 'ragi 15, atta 15', 'm34', {
  p: ROTI,
  n: 2,
  a: 'ragi chapati; nachni roti',
});
bread.add('Oats roti', 'a', 'oats 15, atta 15', 'm34', { p: ROTI, n: 2, a: 'oats chapati' });
bread.add('Besan roti', 'n', 'besan 20, atta 15, ghee 3', 'm32', {
  p: ROTI,
  n: 2,
  a: 'besan ki roti',
});
bread.add('Quinoa roti', 'a', 'quinoa-cooked 30, atta 20', 'm36', {
  p: ROTI,
  n: 2,
  a: 'quinoa chapati',
});
bread.add('Rice roti', 's', 'rice-flour 35', 'm38', {
  p: ROTI,
  n: 2,
  a: 'chawal ki roti; ukadpendi roti; tandalachi bhakri',
});
bread.add('Bajri na rotla', 'w', 'bajra 60, ghee 5', 'm36', {
  p: PCS(1, 'rotla', 'rotlas'),
  a: 'bajra rotla; bajre ki roti',
});
bread.add('Sev roti', 'w', 'atta 30, ghee 4, besan 8, oil 3', 'm30', {
  p: ROTI,
  a: 'sev roti gujarati',
});
bread.add('Bajre ka sogra', 'w', 'bajra 60, ghee 10', 'm32', {
  p: PCS(1, 'sogra', 'sogras'),
  a: 'sogra rajasthani',
});
bread.add('Rumali roti', 'n', 'maida 35, atta 10, oil 2', 'm30', {
  p: ROTI,
  n: 2,
  a: 'roomali roti; roomali',
});
bread.add('Khameeri roti', 'n', 'maida 50, curd 10, ghee 4', 'm34', { p: ROTI, a: 'khamiri roti' });
bread.add('Naan', 'n', 'maida 80, curd 10, oil 4', 'm33', {
  p: PCS(1, 'naan', 'naans'),
  id: 'plain-naan',
  a: 'plain naan; tandoori naan',
});
bread.add('Garlic naan', 'n', 'maida 80, curd 10, butter 8, garlic 5', 'm32', {
  p: PCS(1, 'naan', 'naans'),
  a: 'garlic butter naan',
});
bread.add('Cheese naan', 'n', 'maida 80, curd 10, cheese 30, butter 6', 'm32', {
  p: PCS(1, 'naan', 'naans'),
  a: 'cheese stuffed naan',
});
bread.add('Cheese garlic naan', 'n', 'maida 80, curd 10, cheese 30, butter 8, garlic 5', 'm32', {
  p: PCS(1, 'naan', 'naans'),
  a: 'garlic cheese naan',
});
bread.add(
  'Peshawari naan',
  'n',
  'maida 80, curd 10, almonds 8, raisins 10, coconut-dry 8, sugar 5, butter 8',
  'm28',
  { p: PCS(1, 'naan', 'naans'), a: 'peshawari nan; kashmiri naan' },
);
bread.add('Kulcha', 'n', 'maida 70, curd 10, butter 6', 'm33', {
  p: PCS(1, 'kulcha', 'kulchas'),
  a: 'plain kulcha; kulcha bread; matar kulcha bread',
});
bread.add('Mix veg paratha', 'n', 'atta 45, carrot 25, cabbage 25, peas 15, ghee 8', 'm38', {
  p: PARATHA,
  m: 'bm',
  a: 'mixed vegetable paratha',
});
bread.add('Palak paratha', 'n', 'atta 45, spinach 30, ghee 7', 'm34', {
  p: PARATHA,
  m: 'bm',
  a: 'spinach paratha',
});
bread.add('Ajwain paratha', 'n', 'atta 45, ghee 8', 'm28', {
  p: PARATHA,
  m: 'bm',
  a: 'ajwain parantha; lachha ajwain paratha',
});
bread.add('Pudina paratha', 'n', 'atta 45, mint 6, ghee 8', 'm28', {
  p: PARATHA,
  m: 'bm',
  a: 'mint paratha; pudina lachha paratha',
});
bread.add('Chicken paratha', 'a', 'atta 50, chicken 50, onion 10, ghee 8', 'm45', {
  p: PARATHA,
  m: 'bm',
  a: 'chicken stuffed paratha; chicken keema paratha',
});
bread.add('Chapati roll', 'a', 'atta 35, potato 50, onion 15, oil 6', 'm50', {
  p: PCS(1, 'roll', 'rolls'),
  m: 'bs',
  a: 'roti roll; chapati wrap',
});
bread.add('Paratha roll', 'a', 'maida 60, potato 60, onion 15, oil 12', 'm45', {
  p: PCS(1, 'roll', 'rolls'),
  m: 'bs',
  a: 'veg paratha roll; aloo roll',
});
bread.add('Puri', 'n', 'atta 20, oil 6', 'm15', {
  p: PCS(1, 'puri', 'puris'),
  n: 3,
  id: 'plain-puri',
  m: 'bm',
  a: 'poori; plain puri',
});
bread.add('Methi puri', 'w', 'atta 20, besan 3, oil 6', 'm10', {
  p: PCS(1, 'puri', 'puris'),
  n: 4,
  m: 's',
  a: 'methi poori; methi ni puri',
});
bread.add('Masala puri', 'w', 'atta 20, sooji 3, oil 6', 'm10', {
  p: PCS(1, 'puri', 'puris'),
  n: 4,
  m: 's',
  a: 'masala poori; tikhi puri',
});
bread.add('Farsi puri', 'w', 'maida 20, sooji 4, ghee 3, oil 6', 'm5', {
  p: PCS(1, 'puri', 'puris'),
  n: 3,
  m: 's',
  a: 'farsi poori',
});
bread.add('Dal puri', 'e', 'atta 30, chana-dal 15, oil 8', 'm20', {
  p: PCS(1, 'puri', 'puris'),
  n: 2,
  a: 'dal poori; daal puri bihari',
});
bread.add('Kachori', 'n', 'maida 35, moong-dal 12, oil 15', 'm8', {
  p: PCS(1, 'kachori', 'kachoris'),
  id: 'khasta-kachori',
  m: 'bs',
  a: 'khasta kachori; moong dal kachori',
});
bread.add('Dudhi thepla', 'w', 'atta 30, besan 5, lauki 20, oil 5', 'm32', {
  p: PCS(1, 'thepla', 'theplas'),
  n: 2,
  m: 'bs',
  a: 'lauki thepla; dudhi na thepla',
});
bread.add('Wheat parotta', 's', 'atta 70, oil 10', 'm28', {
  p: PCS(1, 'parotta', 'parottas'),
  a: 'godhuma parotta; atta parotta',
});
bread.add('Veechu parotta', 's', 'maida 60, oil 12, egg 25', 'm25', {
  p: PCS(1, 'parotta', 'parottas'),
  a: 'veechu porotta',
});
bread.add('Coin parotta', 's', 'maida 35, oil 8', 'm25', {
  p: PCS(1, 'parotta', 'parottas'),
  n: 3,
  a: 'mini parotta',
});
bread.add(
  'Chilli parotta',
  's',
  'maida 150, oil 35, onion 50, capsicum 40, tomato 40, soy-sauce 8',
  400,
  { s: 2, u: ['serving', 'g'], a: 'chilly parotta' },
);
bread.add('Dosa roti', 's', 'atta 40, rice-flour 10, oil 5', 'm40', { p: ROTI, a: 'dosai roti' });
bread.add('Sheermal', 'n', 'maida 60, milk 20, ghee 12, sugar 6, saffron 0.05', 'm25', {
  p: PCS(1, 'sheermal', 'sheermals'),
  a: 'shirmal; lucknowi sheermal',
});
bread.add('Taftan', 'n', 'maida 70, milk 20, curd 10, ghee 10, egg 10', 'm28', {
  p: PCS(1, 'taftan', 'taftans'),
  a: 'taftan bread',
});
bread.add('Baqarkhani', 'n', 'maida 60, ghee 18, milk 15, sugar 5', 'm12', {
  p: PCS(1, 'baqarkhani', 'baqarkhanis'),
  m: 'bs',
  a: 'bakarkhani; bakharkhani',
});
bread.add('Poli', 'w', 'atta 30, ghee 3', 'm32', {
  p: PCS(1, 'poli', 'polis'),
  n: 2,
  a: 'chapati marathi; ghadichi poli',
});
bread.add('Ghadichi poli', 'w', 'atta 35, oil 4', 'm30', {
  p: PCS(1, 'poli', 'polis'),
  n: 2,
  id: 'ghadichi-poli-layered',
  a: 'layered chapati; tridal poli',
});
bread.add('Dhapate', 'w', 'jowar 30, atta 15, besan 10, onion 15, oil 6', 'm35', {
  p: PCS(1, 'dhapata', 'dhapate'),
  m: 'bm',
  a: 'dhapata; thalipeeth dhapate',
});
bread.add('Brun maska', 'w', 'maida 70, butter 15', 'm22', {
  p: PCS(1, 'brun', 'bruns'),
  m: 'bs',
  a: 'brun pav maska; bun maska irani',
});
bread.add('Pao bhaji pav', 'w', 'bread 40, butter 8', 46, {
  p: PCS(1, 'pav', 'pavs'),
  n: 2,
  m: 'bs',
  a: 'butter pav; buttered pav',
});
bread.add('Irani chai bun', 'w', 'maida 60, sugar 10, butter 8, milk 15, raisins 5', 'm25', {
  p: PCS(1, 'bun', 'buns'),
  m: 'bs',
  a: 'bun; irani bun; sweet bun',
});
bread.add('Milk bread', 'a', 'maida 100, milk 40, sugar 8, butter 8', 'm35', {
  p: PCS(5, 'slice', 'slices'),
  n: 2,
  m: 'bs',
  a: 'milk bread slices',
});
bread.add('Cheese bun', 'a', 'maida 60, cheese 20, butter 8, milk 15', 'm28', {
  p: PCS(1, 'bun', 'buns'),
  m: 's',
  a: 'cheese bun bakery',
});
bread.add('Pizza base', 'a', 'maida 100, oil 6', 'm32', {
  p: PCS(1, 'base', 'bases'),
  m: 'sd',
  a: 'pizza bread base',
});
bread.add('Rusk', 'a', 'maida 70, sugar 12, oil 8', 'm5', {
  p: PCS(7, 'rusk', 'rusks'),
  n: 2,
  m: 'bs',
  a: 'toast rusk; suji rusk; cake rusk',
});
bread.add('Khari biscuit', 'w', 'maida 60, butter 30', 'm4', {
  p: PCS(10, 'khari', 'kharis'),
  n: 3,
  m: 'bs',
  a: 'khari; puff khari',
});
bread.add('Naan khatai', 'n', 'maida 50, besan 10, ghee 35, sugar 35', 'm3', {
  p: PCS(8, 'nankhatai', 'nankhatais'),
  n: 2,
  m: 's',
  a: 'nankhatai; naankhatai',
});
bread.add('Osmania biscuit', 's', 'maida 60, butter 30, sugar 25, milk-powder 5', 'm3', {
  p: PCS(10, 'biscuit', 'biscuits'),
  n: 2,
  m: 's',
  a: 'osmania biscuits; karachi biscuit',
});
bread.add('Jeera biscuit', 'a', 'maida 60, butter 20, sugar 6, cumin 2', 'm3', {
  p: PCS(10, 'biscuit', 'biscuits'),
  n: 3,
  m: 's',
  a: 'jeera cookies; cumin biscuit',
});
bread.add('Digestive biscuit', 'a', 'atta 50, oats 10, oil 18, sugar 14', 'm3', {
  p: PCS(6, 'biscuit', 'biscuits'),
  n: 2,
  m: 's',
  a: 'digestive; wheat biscuit',
});
bread.add('Oats biscuit', 'a', 'oats 40, atta 20, butter 20, sugar 18', 'm3', {
  p: PCS(7, 'biscuit', 'biscuits'),
  n: 2,
  m: 's',
  a: 'oats cookies',
});
bread.add('Cream biscuit', 'a', 'maida 50, sugar 25, oil 15, milk-powder 5', 'm3', {
  p: PCS(9, 'biscuit', 'biscuits'),
  n: 2,
  m: 's',
  a: 'cream biscuits; bourbon style biscuit',
});

export const BREADS = bread.out;
