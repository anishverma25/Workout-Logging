import type { LabelDef } from '../foods';

/**
 * Pack labels added in round 5 (October 2026), copied from the maker's own product pages
 * (amul.com product information, checked 31 October 2026) or the pack photo on Open Food
 * Facts. Values are [kcal, protein, carbs, fat, fibre]; `perServing` means one pack.
 */
export const REGIONAL_LABELS: LabelDef[] = [
  // Amul protein range (amul.com/products/*-info.php)
  {
    id: 'amul-kool-protein-chocolate',
    name: 'Amul Kool Protein Milkshake, Chocolate',
    aliases: ['amul hp kool chocolate', 'amul protein shake', 'amul kool protein'],
    category: 'drink',
    values: [133, 10, 25, 2.7, 0],
    perServing: 180,
    serving: { g: 180, name: ['bottle', 'bottles'] },
  },
  {
    id: 'amul-kool-protein-coffee',
    name: 'Amul Kool Protein Milkshake, Arabica Coffee',
    aliases: ['amul hp kool coffee', 'amul protein coffee', 'amul kool protein'],
    category: 'drink',
    values: [133, 10, 24.8, 2.7, 0],
    perServing: 180,
    serving: { g: 180, name: ['bottle', 'bottles'] },
  },
  {
    id: 'amul-kool-protein-kesar',
    name: 'Amul Kool Protein Milkshake, Kesar',
    aliases: ['amul hp kool kesar', 'amul protein kesar', 'amul kool protein'],
    category: 'drink',
    values: [133, 10, 25, 2.7, 0],
    perServing: 180,
    serving: { g: 180, name: ['bottle', 'bottles'] },
  },
  // The vanilla page prints 133 kcal and 10 g protein only; its three sister flavours print
  // the same energy and protein with 25 g carbs and 2.7 g fat, used here.
  {
    id: 'amul-kool-protein-vanilla',
    name: 'Amul Kool Protein Milkshake, Vanilla',
    aliases: ['amul hp kool vanilla', 'amul protein vanilla', 'amul kool protein'],
    category: 'drink',
    values: [133, 10, 25, 2.7, 0],
    perServing: 180,
    serving: { g: 180, name: ['bottle', 'bottles'] },
  },
  {
    id: 'amul-protein-lassi-plain',
    name: 'Amul High Protein Plain Lassi',
    aliases: ['amul protein lassi', 'amul hp lassi'],
    category: 'drink',
    values: [107, 15, 12, 1.7, 0],
    perServing: 200,
    serving: { g: 200, name: ['pack', 'packs'] },
  },
  {
    id: 'amul-protein-lassi-rose',
    name: 'Amul High Protein Rose Lassi',
    aliases: ['amul protein rose lassi', 'amul hp rose lassi', 'amul protein lassi'],
    category: 'drink',
    values: [107, 15, 12, 1.7, 0],
    perServing: 200,
    serving: { g: 200, name: ['pack', 'packs'] },
  },
  // The page prints 138 kcal and 20 g protein for the 200 ml bottle, and calls it low fat
  // with no added sugar; the rest of the energy is shown as carbs.
  {
    id: 'amul-protein-blueberry-shake',
    name: 'Amul High Protein Blueberry Shake',
    aliases: ['amul blueberry shake', 'amul protein shake blueberry'],
    category: 'drink',
    values: [138, 20, 14.5, 0, 0],
    perServing: 200,
    serving: { g: 200, name: ['bottle', 'bottles'] },
  },
  {
    id: 'amul-whey-protein',
    name: 'Amul Whey Protein',
    aliases: ['amul whey', 'amul whey plain', 'whey protein'],
    category: 'drink',
    values: [400, 78, 10.8, 5, 0],
    serving: { g: 32, name: ['sachet', 'sachets'] },
  },
  {
    id: 'amul-whey-protein-chocolate',
    name: 'Amul Chocolate Whey Protein',
    aliases: ['amul whey chocolate', 'amul chocolate whey', 'whey protein'],
    category: 'drink',
    values: [383, 74, 10.6, 5, 0],
    serving: { g: 34, name: ['sachet', 'sachets'] },
  },
  {
    id: 'amul-high-protein-paneer',
    name: 'Amul High Protein Paneer',
    aliases: ['amul protein paneer', 'amul hp paneer', 'amul tin paneer high protein'],
    category: 'paneer',
    values: [170, 25, 4, 6, 0],
    amount: 100,
    meals: ['lunch', 'dinner'],
  },
  // News of the launch (foodtechbiz.com, April 2025): 60 g kulfi, 57 kcal, 10 g protein, no
  // added sugar. Only energy and protein are given; the rest of the energy is shown as carbs.
  {
    id: 'amul-high-protein-kulfi',
    name: 'Amul High Protein Mango Kulfi',
    aliases: ['amul protein kulfi', 'amul kulfi protein'],
    category: 'sweet',
    values: [57, 10, 4.25, 0, 0],
    perServing: 60,
    serving: { g: 60, name: ['kulfi', 'kulfis'] },
    meals: ['snacks', 'dinner'],
  },

  // Amul milk (amul.com, per 100 ml, approximate values as printed)
  {
    id: 'amul-gold-milk',
    name: 'Amul Gold Full Cream Milk',
    aliases: ['amul gold', 'full cream milk', 'amul full cream'],
    category: 'dairy',
    values: [86.4, 3.1, 5, 6, 0],
    serving: { g: 200, name: ['glass', 'glasses'] },
  },
  {
    id: 'amul-shakti-milk',
    name: 'Amul Shakti Standardised Milk',
    aliases: ['amul shakti', 'standardised milk'],
    category: 'dairy',
    values: [71, 3, 4.7, 4.5, 0],
    serving: { g: 200, name: ['glass', 'glasses'] },
  },
  {
    id: 'amul-t-special-milk',
    name: 'Amul T-Special Milk',
    aliases: ['amul t special', 'amul tea special', 'tea special milk'],
    category: 'dairy',
    values: [71.3, 3.1, 4.7, 4.5, 0],
    serving: { g: 200, name: ['glass', 'glasses'] },
  },
  {
    id: 'amul-slim-n-trim-milk',
    name: "Amul Slim 'n' Trim Milk",
    aliases: ['amul slim n trim', 'slim and trim', 'double toned milk amul', 'amul skimmed'],
    category: 'dairy',
    values: [45.9, 3.1, 5, 1.5, 0],
    serving: { g: 200, name: ['glass', 'glasses'] },
  },
  {
    id: 'amul-cow-milk',
    name: 'Amul Cow Milk',
    aliases: ['amul cow', 'cow milk'],
    category: 'dairy',
    values: [62, 3.1, 4.7, 3.5, 0],
    serving: { g: 200, name: ['glass', 'glasses'] },
  },
  {
    id: 'amul-deshi-a2-cow-milk',
    name: 'Amul Deshi A2 Cow Milk',
    aliases: ['amul a2', 'a2 cow milk', 'amul deshi'],
    category: 'dairy',
    values: [62, 3, 4.7, 3.5, 0],
    serving: { g: 200, name: ['glass', 'glasses'] },
  },
  {
    id: 'amul-buffalo-milk',
    name: 'Amul Buffalo Milk',
    aliases: ['amul buffalo', 'buffalo milk amul'],
    category: 'dairy',
    values: [91, 3.2, 5, 6.5, 0],
    serving: { g: 200, name: ['glass', 'glasses'] },
  },
  // The Moti page prints 35 kcal next to 3.5 g protein, 5 g carbs and 3 g fat, which add up to
  // about 61 kcal; the energy here is that sum, the macros are as printed.
  {
    id: 'amul-moti-milk',
    name: 'Amul Moti Toned Milk',
    aliases: ['amul moti', 'moti milk', 'long life milk amul'],
    category: 'dairy',
    values: [61, 3.5, 5, 3, 0],
    serving: { g: 200, name: ['glass', 'glasses'] },
  },

  // Open Food Facts, pack photo of barcode 7622201150419 (40 g bar, made in India).
  {
    id: 'cadbury-five-star',
    name: 'Cadbury 5 Star',
    aliases: ['five star', '5 star chocolate', 'fivestar'],
    category: 'sweet',
    values: [525, 7.5, 75, 22.5, 0],
    serving: { g: 40, name: ['bar', 'bars'] },
    meals: ['snacks'],
  },
];
