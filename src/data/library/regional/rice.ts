import { group, RICE } from './build';

/**
 * Rice, biryani, pulao, khichdi and noodles. Raw rice weighs about 2.7 times as much once
 * cooked; biryani pots follow the curated chicken biryani (250 g rice to about 1,150 g).
 */
const veg = group({ category: 'rice', meals: 'm', units: RICE });
const chicken = group({ category: 'chicken', meals: 'm', units: RICE });
const meat = group({ category: 'meat', meals: 'm', units: RICE });
const fish = group({ category: 'fish', meals: 'm', units: RICE });
const egg = group({ category: 'egg', meals: 'm', units: RICE });
const D = 0.72;

// South
veg.add('Ghee rice', 's', 'rice 200, ghee 30, onion 50, cashews 10, raisins 5', 600, {
  s: 3,
  d: D,
  a: 'neychoru; nei choru; ghee bhaat',
});
veg.add(
  'Tamarind rice',
  's',
  'rice 200, tamarind 25, oil 30, peanuts 20, chana-dal 10, jaggery 8, sesame 5',
  640,
  { s: 3, d: D, a: 'puliyodarai; pulihora; puli sadam; huli anna' },
);
veg.add('Tomato rice', 's', 'rice 200, tomato 200, onion 60, oil 25, peas 20', 760, {
  s: 3,
  d: D,
  a: 'thakkali sadam; tomato bath; tomato pulao',
});
veg.add(
  'Coconut rice',
  's',
  'rice 200, coconut 80, oil 15, chana-dal 10, urad-dal 5, cashews 10',
  650,
  { s: 3, d: D, a: 'thengai sadam; kobbari annam; kayi anna' },
);
veg.add('Rasam rice', 's', 'rice 150, toor-dal 15, tomato 80, tamarind 8, ghee 8', 750, {
  s: 3,
  d: 0.85,
  a: 'rasam sadam; saaru anna; rasam chawal',
});
veg.add(
  'Sakkarai pongal',
  's',
  'rice 150, moong-dal 40, jaggery 150, ghee 40, cashews 15, raisins 10, milk 100',
  900,
  { s: 5, d: D, nofat: true, a: 'sweet pongal; chakkara pongali' },
);
veg.add(
  'Puliyogare',
  's',
  'rice 200, tamarind 25, oil 30, peanuts 20, chana-dal 10, jaggery 10, coconut-dry 10',
  650,
  { s: 3, d: D, a: 'puliyogre; huli anna' },
);

// West
veg.add(
  'Masale bhat',
  'w',
  'rice 200, brinjal 100, beans 40, oil 25, cashews 10, coconut-dry 10',
  760,
  { s: 3, d: D, a: 'masala bhat; maharashtrian masale bhaat' },
);
veg.add('Ghee bhaat', 'w', 'rice 200, ghee 15', 560, {
  s: 3,
  d: D,
  a: 'toop bhaat; varan bhaat ghee',
});
veg.add('Varan bhat', 'w', 'rice 150, toor-dal 60, ghee 10', 800, {
  s: 3,
  d: 0.8,
  a: 'varan bhaat; dal bhaat',
});
veg.add('Tendli bhat', 'w', 'rice 200, tindora 150, oil 25, cashews 10, coconut-dry 10', 750, {
  s: 3,
  d: D,
  a: 'tondli bhaat; tendli bhaat',
});
veg.add('Vegetable bhat', 'w', 'rice 200, carrot 40, beans 40, peas 40, potato 50, oil 25', 780, {
  s: 3,
  d: D,
  a: 'bhaji bhat; mixed vegetable bhaat',
});
veg.add('Gujarati khichdi', 'w', 'rice 120, toor-dal 60, ghee 15, turmeric 2', 780, {
  s: 3,
  d: 0.85,
  a: 'khichdi kadhi; vaghareli khichdi',
});
veg.add(
  'Tawa pulao',
  'w',
  'rice 200, onion 50, tomato 80, capsicum 50, peas 30, butter 25, oil 10',
  760,
  { s: 3, d: D, a: 'tava pulao; mumbai tawa pulao' },
);

// North
veg.add('Paneer pulao', 'n', 'rice 200, paneer 120, onion 50, peas 30, ghee 25', 760, {
  s: 3,
  d: D,
  a: 'paneer pulav',
});
veg.add('Soya pulao', 'a', 'rice 200, soya-chunks 50, onion 50, peas 30, oil 20', 760, {
  s: 3,
  d: D,
  a: 'soya chunks pulao; meal maker rice',
});
veg.add('Mutter pulao', 'n', 'rice 200, peas 100, onion 40, ghee 20, cumin 3', 700, {
  s: 3,
  d: D,
  a: 'matar pulao; peas pulav',
});
veg.add('Methi pulao', 'a', 'rice 200, onion 50, ghee 20, peas 30', 680, {
  s: 3,
  d: D,
  a: 'methi rice; fenugreek pulao',
});
veg.add('Chana dal pulao', 'a', 'rice 180, chana-dal 50, onion 50, ghee 20', 720, {
  s: 3,
  d: D,
  a: 'chana dal rice',
});
veg.add('Moti pulao', 'n', 'rice 200, paneer 80, khoya 30, ghee 30, cashews 10, cream 20', 760, {
  s: 3,
  d: D,
  a: 'moti pulav; pearl pulao',
});
veg.add(
  'Kashmiri pulao',
  'n',
  'rice 200, milk 100, ghee 25, cashews 15, almonds 10, raisins 15, apple 50, pomegranate 30, sugar 10',
  800,
  { s: 3, d: D, a: 'kashmiri pulav; mewa pulao' },
);
veg.add(
  'Tehri',
  'n',
  'rice 200, potato 100, peas 50, cauliflower 60, mustard-oil 25, onion 40',
  820,
  { s: 3, d: D, a: 'tahari; tehari; veg tehri' },
);
veg.add(
  'Vegetable dalia khichdi',
  'n',
  'dalia 100, moong-dal 50, carrot 40, peas 40, ghee 10',
  800,
  { s: 3, d: 0.85, m: 'bm', a: 'vegetable daliya khichdi' },
);
veg.add(
  'Masala khichdi',
  'a',
  'rice 120, moong-dal 60, onion 40, tomato 50, peas 30, ghee 15',
  800,
  { s: 3, d: 0.85, a: 'masala khichdi; vegetable masala khichdi' },
);
veg.add('Bajra khichdi', 'w', 'bajra 100, moong-dal 50, ghee 15', 700, {
  s: 3,
  d: 0.85,
  a: 'bajre ki khichdi',
});
veg.add('Gatte ka pulao', 'w', 'rice 200, besan 60, curd 20, ghee 25, oil 10', 760, {
  s: 3,
  d: D,
  a: 'gatte ki khichdi; gatte pulao',
});
veg.add('Rajma chawal', 'n', 'rice 100, rajma 50, onion 40, tomato 60, oil 12, ghee 3', 600, {
  s: 2,
  d: 0.85,
  a: 'rajma rice; rajma chawal plate',
});
veg.add('Chole chawal', 'n', 'rice 100, kabuli-chana 50, onion 40, tomato 60, oil 12', 600, {
  s: 2,
  d: 0.85,
  a: 'chole rice; chana chawal',
});
veg.add('Kadhi chawal', 'n', 'rice 100, besan 30, curd 150, oil 15', 650, {
  s: 2,
  d: 0.9,
  a: 'kadhi rice; kadhi chawal plate',
});
veg.add('Dal chawal', 'a', 'rice 100, toor-dal 40, ghee 8, tomato 30', 600, {
  s: 2,
  d: 0.85,
  a: 'dal rice; daal chawal',
});
veg.add('Egg curry rice', 'a', 'rice 100, egg 100, onion 40, tomato 60, oil 12', 520, {
  s: 2,
  d: 0.85,
  a: 'anda curry chawal',
});

// East
veg.add(
  'Bengali bhuna khichuri',
  'e',
  'rice 150, moong-dal 80, potato 60, cauliflower 60, peas 30, ghee 25, oil 10',
  900,
  { s: 4, d: 0.85, a: 'bhuna khichuri; bhoger khichuri; khichuri' },
);
fish.add(
  'Machher jhol bhaat',
  'e',
  'rice 100, rohu 100, potato 50, mustard-oil 12, tomato 30',
  600,
  { s: 2, d: 0.85, a: 'maacher jhol bhat; fish curry rice bengal' },
);
veg.add('Pakhala bhata', 'e', 'rice 100, water 400, curd 50', 520, {
  s: 2,
  d: 0.95,
  a: 'pakhala bhaata',
});
fish.add(
  'Fish curry rice',
  'a',
  'rice 100, fish 100, coconut 30, onion 30, tomato 40, oil 12',
  600,
  { s: 2, d: 0.85, a: 'fish thali; meen curry rice; macher jhol bhat' },
);

// Indo Chinese
veg.add(
  'Schezwan fried rice',
  'a',
  'rice 200, carrot 40, capsicum 40, cabbage 40, oil 35, garlic 10, chilli-powder 4, soy-sauce 10',
  720,
  { s: 3, d: D, a: 'szechuan fried rice; schezwan rice' },
);
veg.add(
  'Burnt garlic fried rice',
  'a',
  'rice 200, garlic 25, carrot 30, beans 30, oil 35, soy-sauce 8',
  690,
  { s: 3, d: D, a: 'burnt garlic rice' },
);
veg.add(
  'Triple schezwan rice',
  'a',
  'rice 150, egg-noodles 60, oil 50, cabbage 50, capsicum 40, carrot 30, cornflour 15, soy-sauce 10, garlic 8',
  750,
  { s: 3, d: D, a: 'triple schezwan; triple szechuan rice' },
);
veg.add(
  'Mixed vegetable fried rice',
  'a',
  'rice 200, carrot 40, beans 40, cabbage 40, capsicum 30, corn 20, oil 30, soy-sauce 10',
  740,
  { s: 3, d: D, a: 'mix veg fried rice' },
);
veg.add(
  'Paneer fried rice',
  'a',
  'rice 200, paneer 100, carrot 30, capsicum 30, oil 30, soy-sauce 10',
  740,
  { s: 3, d: D, a: 'paneer rice chinese' },
);
veg.add(
  'Schezwan noodles',
  'a',
  'egg-noodles 150, cabbage 60, carrot 40, capsicum 40, oil 35, garlic 10, chilli-powder 4, soy-sauce 10',
  610,
  { s: 3, d: 0.6, a: 'szechuan noodles' },
);
veg.add(
  'Singapore noodles',
  'a',
  'rice-noodles 150, cabbage 60, carrot 40, capsicum 40, oil 30, soy-sauce 8',
  620,
  { s: 3, d: 0.6, a: 'singapore rice noodles' },
);
veg.add(
  'Chilli garlic noodles',
  'a',
  'egg-noodles 150, garlic 20, capsicum 40, spring-onion 20, oil 35, soy-sauce 10',
  580,
  { s: 3, d: 0.6, a: 'chilli garlic hakka noodles' },
);
veg.add(
  'American chop suey',
  'a',
  'egg-noodles 120, oil 60, cabbage 60, carrot 40, capsicum 40, ketchup 50, sugar 10, cornflour 15',
  520,
  { s: 3, d: 0.6, a: 'american chopsuey; chopsuey' },
);

// Biryani by region
chicken.add(
  'Hyderabadi chicken dum biryani',
  's',
  'rice 250, chicken 400, onion 150, curd 120, ghee 25, oil 25, mint 10',
  1200,
  { s: 5, d: D, a: 'hyderabadi biryani; kacchi biryani chicken; chicken dum biryani' },
);
meat.add(
  'Hyderabadi mutton biryani',
  's',
  'rice 250, mutton 400, onion 150, curd 120, ghee 25, oil 25, mint 10',
  1200,
  { s: 5, d: D, a: 'kacche gosht ki biryani; hyderabadi gosht biryani; mutton dum biryani' },
);
veg.add(
  'Hyderabadi veg biryani',
  's',
  'rice 250, carrot 60, beans 60, peas 50, potato 80, cauliflower 60, onion 120, curd 100, ghee 20, oil 20',
  1150,
  { s: 5, d: D, a: 'veg dum biryani; hyderabadi subz biryani' },
);
chicken.add(
  'Lucknowi biryani',
  'n',
  'rice 250, chicken 380, onion 120, curd 100, ghee 30, milk 50',
  1150,
  { s: 5, d: D, a: 'awadhi biryani; lucknow biryani' },
);
chicken.add(
  'Kolkata biryani',
  'e',
  'rice 250, chicken 320, potato 200, egg 50, onion 100, curd 80, ghee 25, oil 20',
  1250,
  { s: 5, d: D, a: 'calcutta biryani; kolkata chicken biryani with aloo' },
);
chicken.add(
  'Ambur biryani',
  's',
  'rice 250, chicken 400, onion 120, tomato 100, curd 80, oil 40',
  1200,
  { s: 5, d: D, a: 'ambur star biryani' },
);
meat.add(
  'Dindigul biryani',
  's',
  'rice 250, mutton 400, onion 120, tomato 80, curd 80, ghee 20, oil 25',
  1200,
  { s: 5, d: D, a: 'dindigul thalappakatti biryani; seeraga samba biryani' },
);
chicken.add(
  'Thalassery biryani',
  's',
  'rice 250, chicken 400, onion 200, tomato 60, ghee 40, cashews 15, raisins 10, curd 60',
  1250,
  { s: 5, d: D, a: 'malabar biryani; thalassery chicken biryani' },
);
meat.add(
  'Kerala beef biryani',
  's',
  'rice 250, beef 400, onion 150, tomato 80, ghee 25, oil 25, curd 60',
  1200,
  { s: 5, d: D, a: 'beef biryani; malabar beef biryani' },
);
chicken.add(
  'Sindhi biryani',
  'w',
  'rice 250, chicken 400, potato 150, onion 150, tomato 120, curd 100, oil 45',
  1300,
  { s: 5, d: D, a: 'sindhi chicken biryani' },
);
chicken.add(
  'Bombay biryani',
  'w',
  'rice 250, chicken 380, potato 150, onion 150, tomato 100, curd 80, oil 40, raisins 10',
  1300,
  { s: 5, d: D, a: 'mumbai biryani' },
);
chicken.add(
  'Donne biryani',
  's',
  'rice 250, chicken 400, onion 100, curd 80, mint 25, coriander 25, oil 30, ghee 15',
  1200,
  { s: 5, d: D, a: 'donne biriyani; bangalore military biryani' },
);
chicken.add(
  'Bhatkali biryani',
  's',
  'rice 250, chicken 400, onion 200, tomato 120, curd 80, oil 45, mint 15',
  1300,
  { s: 5, d: D, a: 'bhatkal biryani' },
);
egg.add(
  'Egg biryani',
  'a',
  'rice 250, egg 300, onion 150, curd 100, tomato 60, oil 30, ghee 10',
  1150,
  { s: 5, d: D, a: 'anda biryani; egg dum biryani; muttai biryani' },
);
veg.add(
  'Paneer biryani',
  'a',
  'rice 250, paneer 250, onion 150, curd 100, tomato 60, oil 25, ghee 10',
  1150,
  { s: 5, d: D, a: 'paneer dum biryani' },
);
fish.add(
  'Prawn biryani',
  's',
  'rice 250, prawns 350, onion 150, tomato 80, curd 80, oil 35',
  1150,
  { s: 5, d: D, a: 'prawns biryani; chemmeen biryani; eral biryani' },
);
fish.add(
  'Fish biryani',
  's',
  'rice 250, seer-fish 350, onion 150, tomato 80, curd 80, oil 40',
  1150,
  { s: 5, d: D, a: 'meen biryani; fish dum biryani' },
);
veg.add(
  'Mushroom biryani',
  'a',
  'rice 250, mushroom 250, onion 150, curd 100, tomato 60, oil 30, ghee 10',
  1100,
  { s: 5, d: D, a: 'mushroom dum biryani' },
);
veg.add(
  'Soya biryani',
  'a',
  'rice 250, soya-chunks 80, onion 150, curd 100, tomato 60, oil 30',
  1150,
  { s: 5, d: D, a: 'soya chunks biryani; meal maker biryani' },
);
meat.add('Yakhni pulao', 'n', 'rice 250, mutton 400, onion 100, curd 80, ghee 35', 1250, {
  s: 5,
  d: D,
  a: 'mutton yakhni pulao; yakhni pulav',
});
chicken.add(
  'Chicken pulao',
  'a',
  'rice 250, chicken 350, onion 100, tomato 60, oil 30, ghee 10',
  1150,
  { s: 5, d: D, a: 'chicken pulav' },
);
meat.add('Mutton pulao', 'a', 'rice 250, mutton 350, onion 100, tomato 60, oil 30, ghee 10', 1150, {
  s: 5,
  d: D,
  a: 'mutton pulav; gosht pulao',
});
egg.add('Egg pulao', 'a', 'rice 200, egg 200, onion 60, peas 30, oil 25', 820, {
  s: 4,
  d: D,
  a: 'anda pulao',
});

export const RICE_DISHES = [...veg.out, ...chicken.out, ...meat.out, ...fish.out, ...egg.out];
