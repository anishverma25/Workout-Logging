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
