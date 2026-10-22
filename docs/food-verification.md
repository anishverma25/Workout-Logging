# Food values: cross-check (October 2026)

Every food added in the gym and brands update was checked a second time against an independent
source. Pack labels were compared with the brand's own page or a retailer or nutrition database
listing of the same label. Our own dishes were compared with the Indian Nutrient Databank (INDB)
where it has the dish, and otherwise with a nutrition database entry or a recipe site. A dish is
accepted when its calories per 100 g are within about 20% of the reference: home and street
recipes vary that much. Fried dishes in INDB count all the frying oil as eaten, so they were not
used as references.

Foods built only from USDA ingredients with no cooking (egg whites, chicken breast, brown rice,
quinoa, sweet potato, dates, tuna, skimmed milk, Greek yogurt, brown bread, boiled chana and
rajma, tofu, makhana, shakes, overnight oats, peanut butter toast) are lab values by definition
and were not re-checked one by one.

## Pack labels

| Product | Result | Reference |
| --- | --- | --- |
| ON Gold Standard Whey | Fixed: fat 1 g to 1.5 g a scoop | FatSecret (label) |
| MuscleBlaze Biozyme Performance | Matches | FatSecret |
| Avvatar Whey | Matches | HealthifyMe |
| Myprotein Impact Whey | Fixed: protein 18 g to 19 g, fibre 0.4 g | Myprotein |
| AS-IT-IS Whey 80% | Fixed: scoop 30 g to 35 g as printed (141 kcal, 28 g protein) | HealthKart |
| OZiva plant protein | Matches (139 to 140 kcal, 30 g protein) | HealthKart |
| Plix plant protein | Fixed: carbs back to the label's 5 g | FatSecret |
| MuscleBlaze plant protein | Fixed: 144 kcal, 24 g protein a 36.5 g scoop | MuscleBlaze |
| Yogabar yeast protein | Matches | HealthKart |
| Nutrela soya chunks | Matches within 3% | Retailer label |
| Pintola classic, crunchy, high protein | Match | HealthKart, Bigbasket, FatSecret |
| MyFitness chocolate | Matches | FatSecret |
| Alpino natural | Fixed: 645 kcal, 29 g protein, 52 g fat per 100 g | FatSecret |
| Sundrop | Fixed: 647 kcal, 26.8 g protein, 55 g fat, 7.8 g fibre | Open Food Facts |
| Quaker oats | Fixed: fibre 10 g added | Flipkart label |
| Saffola masala oats | Matches | Open Food Facts |
| Quaker masala oats | Within 3% of the only listing found | Retailer page |
| Kellogg's muesli, Yoga Bar Muesli+, Bagrry's protein, True Elements | Match | FatSecret |
| Yoga Bar nuts and seeds | Replaced by the listed Fruits, Nuts & Seeds muesli (367 kcal) | FatSecret |
| Epigamia Greek natural | Matches | FatSecret |
| Amul High Protein Milk | Matches | Amul |
| Amul Protein Buttermilk | Energy and protein match; carbs and fat not printed online | Amul |
| RiteBite Max Protein Daily | Fixed: fibre 9 g to the printed 4 g | 1mg, HealthKart |
| The Whole Truth Peanut Cocoa | Matches | FatSecret |
| Fortune chana sattu | Matches | FatSecret |
| Parle-G, Haldiram's aloo bhujia, Lay's classic, Maggi | Match within 7% | Open Food Facts, FatSecret, Fitatu |

## Our dishes

| Dish | Result | Reference |
| --- | --- | --- |
| Gulab jamun | Fixed: piece 30 g to 40 g, now 151 kcal | HealthifyMe 150 kcal for 45 g |
| Chicken burger | Fixed: less oil and mayonnaise, now 405 kcal (231 per 100 g) | McChicken India 229 per 100 g |
| Pani puri | Fixed: less frying oil, plate of 6 now 271 kcal | FatSecret 25 kcal a puri plus filling |
| Misal | Fixed: more sprouts and the farsan, 244 kcal a serving | Tarla Dalal 289 kcal |
| Chicken 65 | Fixed: half the oil, 213 per 100 g | FatSecret 182 |
| Garlic bread | Fixed: plain breadsticks, less butter | Domino's 272 per 100 g |
| Modak | Fixed: piece 35 g to 48 g | FatSecret 153 a piece, 255 per 100 g |
| Bhel puri | Fixed: sev added, 338 kcal a 136 g serving | FatSecret 349 kcal a serving |
| Chilli paneer | Renamed "(dry)"; the gravy version is lighter | FatSecret gravy 123 |
| Veg burger | Matches (228 per 100 g) | McAloo Tikki 232 |
| Kaju katli | Within 7% | Haldiram's 479 |
| Motichoor ladoo | Matches | FatSecret 473 |
| Dahi vada, sabudana vada, bisi bele bath, veg manchurian, appam | Within 15% | FatSecret |
| Veg noodles, fried rice, cornflakes with milk, cold coffee | Within 15% | INDB |
| Chicken roll | 18% above a chicken tikka roll; kathi rolls use an oily paratha | FatSecret 171 per 100 g |
| Jalebi | Within the range of sources (66 kcal a piece) | Tarla Dalal |
| Momos, kachori, luchi, Kerala parotta, shawarma | Sources disagree widely; ours sit inside the range of common recipes | FatSecret |

Pack labels are now checked in the unit tests with 20% slack instead of 12%: labels round
their figures and count fibre and sugar alcohols at less energy, and the app keeps the label
as printed.

## Protein powders added on 22 October 2026

Each value is from a listing of the printed label (FatSecret India, HealthKart, Open Food Facts,
iHerb or the brand), per scoop as printed.

| Product | Scoop | kcal | Protein | Carbs | Fat |
| --- | --- | --- | --- | --- | --- |
| Naturaltein Whey Concentrate | 30 g | 110 | 21.8 | 2.4 | 1.6 |
| Naturaltein Whey Isolate | 30 g | 119 | 24 | 1.6 | 1.8 |
| The Whole Truth Whey Isolate | 35 g | 132 | 30.4 | 1.1 | 0.7 |
| The Whole Truth Whey Light Cocoa | 35 g | 139 | 24.9 | 6.4 | 1.5 |
| Dymatize Elite 100% Whey | 34.9 g | 130 | 25 | 3 | 1.5 |
| MuscleTech Nitro-Tech Whey Gold | 33 g | 120 | 24 | 2 | 2 |
| Nakpro Perform Whey | 33 g | 126 | 24 | 4.6 | 1.8 |
| BeastLife Whey | 35 g | 135 | 24.3 | 4.2 | 2.4 |
| SuperYou Pro Yeast Protein | 33 g | 134 | 27 | 2.2 | 1.9 |
| Mille Yeast Protein | 38 g | 141 | 25.2 | 5.2 | 2.6 |
| Naturaltein Yeast Protein | per 100 g | 398 | 73.6 | 8.3 | 7.8 |
| Nutrabay Yeast Protein | 36 g | 134 | 25.2 | 6.2 | 1.5 |
| GNC Select Yeast Protein | 35 g | 145 | 25 | 6.2 | 1.7 |
| Cosmix Plant Protein | 38 g | 144 | 23.6 | 10.2 | 0.9 |
| The Whole Truth Plant Protein | 38 g | 150 | 25.4 | 5.3 | 3 |
| Nutrabox Soy Isolate | 37 g | 133 | 30 | 2.8 | 0.2 |
| Nutrabox Vegan Protein | 36 g | 138 | 25 | 3 | 0.5 |
| Ace Blend Intense Plant Protein | 45 g | 172 | 30 | 8.3 | 2.2 |
| Nakpro Soy Isolate | per 100 g | 392 | 90 | 1 | 3.1 |

Partly printed, so energy or carbs are worked out and marked in the code: Cosmix yeast protein
and Plix yeast protein (protein, carbs and fat per 100 g printed), AS-IT-IS soy isolate
(protein, carbs and fat per 35 g printed), Origin Nutrition plant protein (protein from an
independent lab test that matched the label, carbs and fat as labelled), Wellbeing Nutrition
plant protein (energy and protein printed).

Not added because no printed nutrition panel could be found: TrueBasics yeast protein (only
"25 g protein per 37 g"), AS-IT-IS yeast protein, BeastLife yeast protein, Dymatize ISO100
(energy only). Search still finds them through OverloadGPT.

## Cafe, dessert and global foods (22 October 2026)

About 50 recipes and 15 single foods (USDA values: cheesecake, brownie, cookie, doughnut,
croissant, ice cream, chocolate, hummus, avocado, granola, berries, pita). Recipes checked
against references:

| Dish | Ours per 100 g | Reference |
| --- | --- | --- |
| Tiramisu | 271 | FatSecret 283 |
| Tres leches | 247 | FatSecret 246 |
| Avocado toast | 213 (158 a slice) | FatSecret 184 (147 a slice) |
| Margherita pizza | 250 | FatSecret 275 |
| Cappuccino | 51 | Starbucks tall 31 (more foam, less milk) |
| Bubble tea | 69 (500 ml cup, 358 kcal) | Shop cups vary from about 300 to 700 kcal |

## Indian chains, street food, drinks and supplements (22 October 2026)

**Chains** (`chain: true` labels, source "chain"): 39 items from McDonald's India, KFC, Domino's,
Burger King and Subway. Each is one serving as the chain publishes it, read through FatSecret
India (which mirrors the chains' own tables; McDonald's values carry the official decimals).
Every item was checked in code: energy within 20% of 4/4/9 on its protein, carbs and fat, and
macros not heavier than the serving. Fibre is not published, so it stays 0. Portions are the
chain's, and outlets vary a little.

Left out because the page showed no weight or the numbers disagreed with themselves: Domino's
Choco Lava Cake (no weight, macros heavier than a plausible cake), Thin Crust Chicken slice (no
weight), Pepsi and Mirinda (two pages gave 43 and 55, 28 and 55 kcal per 100 ml), Xtend BCAA
(0 kcal with 7 g protein), Oreo (only kcal found), McDonald's masala chai (page not reachable).

**Packaged labels** (per 100 g or per pack, FatSecret India): Bournvita 393, Horlicks Classic
Malt 377, Horlicks Protein Plus 370, Protinex Original 350, Complan Chocolate 428, Cerelac 415,
Marie Gold 445, Good Day 512, Dairy Milk 524, KitKat 481, Snickers 491, Kurkure 556,
Haldiram's moong dal 479, Amul cheese slice 311 kcal per 100 g; Thums Up 42, Frooti 65, Maaza 48
(Open Food Facts), Real mixed fruit 56, Amul Kool 89, Amul Taaza 58 kcal per 100 ml. Each
reconciles with its macros within 5%. Bournvita's page is the only source found and is older
than the 2023 reformulation, so treat it as approximate.

**Supplements** (per scoop): pea protein isolate (Nutrabay 40 g 117 kcal 25.3 g protein, Nutrabay
Gold hydrolysed 40 g 135 kcal 25 g, Nakpro 36 g 139 kcal 28.8 g, Myprotein 30 g 107 kcal 23 g),
MuscleBlaze Raw Whey 30 g 118 kcal 24 g, Optimum Nutrition casein 34 g 120 kcal 24 g,
MuscleBlaze micellar casein 35 g 120 kcal 24 g, MuscleBlaze Mass Gainer XXL and High Protein
Gainer per 100 g, MuscleBlaze Creamp creatine 3 g 0 kcal, GNC BCAA 13.25 g 8 kcal.

**Recipes** (from USDA ingredients, in the same way as the other dishes): chole bhature, chole
kulche, Amritsari kulcha, litti chokha, dal baati, dabeli, ragda pattice, sev puri, dahi puri,
papdi chaat, aloo chaat, samosa chaat, bun maska, maska pav, keema pav, egg bhurji pav, egg and
veg puff, bread pakora, roasted corn, masala peanuts, a veg thali, chicken thukpa, idiyappam,
puttu, puran poli, sandesh, Mysore pak, kulfi, rabri, shrikhand, malpua, peda, rasmalai, mutton
keema, sugarcane juice, matcha latte, kombucha, almond and oat milk, khakhra, murukku. Plates
(chole bhature, chaats, thali) are one typical restaurant plate; weights are in the code. These
vary by cook like any home recipe.

**USDA single foods**: kiwi, lychee, jackfruit, sapota, custard apple, pineapple, walnuts,
pistachios, flax, pumpkin and sunflower seeds, popcorn, tender coconut water, soy milk.

Not added (no checkable source): dragon fruit (not in USDA SR28), Starbucks, Electral and ORS
sachets, PediaSure, Boost, pad thai, paella, seitan.
