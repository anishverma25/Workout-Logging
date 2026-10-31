import { CUP, GLASS, group } from './build';

/** Tea, coffee, milk drinks, shakes, lassi, juices and sherbets, as made at home or a stall. */
const glass = group({ category: 'drink', meals: 'a', units: GLASS });
const cup = group({ category: 'drink', meals: 'a', units: CUP });
const D = { nofat: true, s: 1 } as const;

cup.add('Elaichi chai', 'a', 'milk 60, tea 90, sugar 6', 140, { ...D, d: 1.02, a: 'cardamom tea' });
cup.add('Kadak chai', 'a', 'milk 50, tea 80, sugar 8', 120, {
  ...D,
  d: 1.02,
  a: 'strong chai; cutting chai',
});
cup.add('Irani chai', 's', 'milk 80, condensed-milk 15, tea 60, sugar 5', 140, {
  ...D,
  d: 1.03,
  a: 'hyderabadi irani chai',
});
cup.add('Kashmiri chai', 'n', 'milk 90, tea 60, sugar 6, almonds 3, pistachios 2', 140, {
  ...D,
  d: 1.02,
  a: 'noon chai; pink tea; sheer chai',
});
cup.add('Noon chai', 'n', 'milk 90, tea 60, butter 3, almonds 2', 140, {
  ...D,
  d: 1.02,
  id: 'noon-chai-salted',
  a: 'salt tea; namkeen chai',
});
cup.add('Sulaimani', 's', 'tea 150, sugar 8, lemon 5', 160, {
  ...D,
  a: 'sulaimani tea; black tea lemon kerala',
});
cup.add('Lemon tea', 'a', 'tea 150, sugar 8, lemon 8', 160, { ...D, a: 'nimbu chai' });
cup.add('Black tea', 'a', 'tea 150, sugar 5', 155, { ...D, a: 'kali chai; liquor tea' });
cup.add('Tulsi tea', 'a', 'tea 150, honey 6', 155, { ...D, a: 'tulsi chai; holy basil tea' });
cup.add('Kadha', 'a', 'water 150, ginger 3, honey 8, black-pepper 0.5', 155, {
  ...D,
  a: 'immunity kadha; kadha ayurvedic',
});
cup.add('Turmeric milk', 'a', 'milk 180, turmeric 2, sugar 6', 185, {
  ...D,
  d: 1.03,
  a: 'haldi doodh; golden milk; haldi wala doodh',
});
glass.add('Rose milk', 's', 'milk 200, sugar 18', 215, { ...D, d: 1.03, a: 'rose milk drink' });
glass.add('Chocolate milkshake', 'a', 'milk 200, choc-ice-cream 40, sugar 10', 250, {
  ...D,
  d: 1.04,
  a: 'chocolate shake',
});
glass.add('Oreo milkshake', 'a', 'milk 200, ice-cream 40, choc-chip-cookie 25, sugar 6', 270, {
  ...D,
  d: 1.04,
  a: 'oreo shake',
});
glass.add('Strawberry milkshake', 'a', 'milk 200, strawberries 60, sugar 15', 275, {
  ...D,
  d: 1.04,
  a: 'strawberry shake',
});
glass.add(
  'Dry fruit milkshake',
  'a',
  'milk 220, almonds 10, cashews 10, dates 20, figs-dried 10',
  270,
  { ...D, d: 1.05, a: 'dry fruit shake' },
);
glass.add('Sharjah shake', 's', 'milk 200, banana 80, ice-cream 30, peanuts 10, sugar 10', 330, {
  ...D,
  d: 1.05,
  a: 'sharjah milkshake kerala',
});
glass.add('Rose lassi', 'n', 'curd 200, sugar 20, water 40', 260, {
  ...D,
  d: 1.04,
  a: 'gulab lassi',
});
glass.add('Banana lassi', 'n', 'curd 180, banana 80, sugar 10', 270, {
  ...D,
  d: 1.05,
  a: 'kela lassi',
});
glass.add('Dry fruit lassi', 'n', 'curd 200, almonds 8, cashews 8, sugar 18', 234, {
  ...D,
  d: 1.05,
  a: 'mewa lassi',
});
glass.add('Jigarthanda', 's', 'milk 200, ice-cream 40, sugar 20, tapioca-pearls 10', 270, {
  ...D,
  d: 1.05,
  a: 'madurai jigarthanda',
});
glass.add('Panakam', 's', 'jaggery 30, water 200, lemon 5, ginger 1', 236, {
  ...D,
  a: 'panagam; paanakam',
});
glass.add('Neer mor', 's', 'curd 60, water 160', 220, { ...D, a: 'spiced buttermilk tamil; mor' });
glass.add('Bael sherbet', 'n', 'bael 100, water 150, sugar 15', 265, {
  ...D,
  a: 'bel sharbat; bel ka sharbat',
});
glass.add('Rose sherbet', 'n', 'sugar 25, water 200', 225, {
  ...D,
  a: 'rose sharbat; gulab sharbat',
});
glass.add('Kokum sherbet', 'w', 'sugar 25, water 200', 225, {
  ...D,
  a: 'kokum sarbat; amsul sherbet',
});
glass.add('Sol kadhi drink', 'w', 'coconut 50, water 200', 250, { ...D, a: 'solkadhi glass' });
glass.add('Watermelon juice', 'a', 'watermelon 260', 200, { ...D, a: 'tarbooz juice' });
glass.add('Amla juice', 'a', 'amla 60, water 140, honey 6', 206, {
  ...D,
  a: 'gooseberry juice; amla ras',
});
glass.add('Aloe vera juice', 'a', 'water 190, sugar 6', 196, { ...D, a: 'aloe juice' });
glass.add('Karela juice', 'a', 'karela 150, water 60', 200, { ...D, a: 'bitter gourd juice' });
glass.add('Lemon soda', 'a', 'lemon 15, sugar 15, water 190', 220, {
  ...D,
  a: 'nimbu soda; fresh lime soda',
});
glass.add('Masala soda', 'a', 'lemon 15, sugar 15, water 190', 220, {
  ...D,
  a: 'masala shikanji soda',
});
glass.add('Goli soda', 's', 'sugar 18, water 200', 218, {
  ...D,
  a: 'banta; kanche wali soda; banta soda',
});
glass.add('Ragi malt', 's', 'ragi 25, milk 150, jaggery 15, water 60', 250, {
  ...D,
  d: 1.04,
  a: 'ragi java; ragi ambli; ragi porridge drink',
});
glass.add('Toddy', 's', 'toddy 250', 250, { ...D, a: 'kallu; palm toddy; tadi' });
glass.add('Butter tea', 'n', 'tea 180, butter 12, milk 30', 220, {
  ...D,
  a: 'gur gur chai; po cha',
});

export const DRINKS = [...glass.out, ...cup.out];
