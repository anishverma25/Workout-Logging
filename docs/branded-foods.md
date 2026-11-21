# Branded foods (November 2026)

The Branded Food Macro Database (849 products, 49 brand groups, 6 categories) was added to the food library. The source PDF is the owner's; it is read by `scripts/branded-foods/` (`parse.py` reads the tables, `build.py` checks every row, `gen.py` writes `src/data/library/branded/rows.json` and `replaced.ts`).

## Import summary

- Products in the database: 849
- Imported: 825 (one food each, no two with the same name)
- Of these, 53 replace an older label of the same product from the same brand. They keep the old id, so recent foods, usual meals and saved plates still find them; past logs keep the numbers they were logged with.
- Left out: 24, because a value needed for logging is not listed. Nothing was estimated.
- Brands: 53
- Listings that disagree (⚠ in the source): 21. The main value is kept, the other listing is in the note, and the food page asks people to check their pack.
- "Check pack" rows (may be the same product as another): 12. Imported, with the same note on the food page.
- Calories that differ by over 20% from 4/4/9 (marked † in the source): 21. Kept exactly as printed (`printedKcal`).
- Fibre is taken from the notes where the label lists it; otherwise the food page shows a dash, never 0 g.
- Per scoop, per pack, per bar and per 100 g are one food with a serving to choose. Values are stored per 100 g (ml counted as g, as every pack label in the library already was).

## Left out (no value invented)

- MuscleBlaze Yeast Protein Isolate, Cafe Mocha (36g): carbs or fat not listed
- AS-IT-IS ATOM Whey Isolate, Mango Delight (35g): calories or protein not listed
- GNC Select Fermented Yeast Protein, Coffee (35g): calories or protein not listed
- GNC Select Fermented Yeast Protein, Vanilla (35g): calories or protein not listed
- Guru Mann 3 Ingredients Fermented Yeast Protein, Vanilla (33g): calories or protein not listed
- Amul Probiotic High Protein Curd (100g): carbs or fat not listed
- Amul Pure Milk Cheese Block (100g): carbs or fat not listed
- Amul Irish Drink Shot (100 ml): carbs or fat not listed
- Amul High Protein Cubes (38g pack): carbs or fat not listed
- Country Delight High Protein Paneer (180g pack): calories or protein not listed
- Country Delight 10g Protein Taaza Jeera Chaach (100 ml): carbs or fat not listed
- Country Delight 10g Protein Mango Lassi (100 ml): carbs or fat not listed
- Heritage Plain Greek Yogurt (100g): carbs or fat not listed
- Saffola 0% Added Sugar Muesli, Berry Crunch (100g): carbs or fat not listed
- RiteBite RTD Protein Milkshake, Coffee Crush (250 ml): calories or protein not listed
- RiteBite Max Protein Peanut Butter, Choco Creamy (100g): carbs or fat not listed
- SuperYou Protein Wafer Bar (10g protein), Coffee (40g wafer): carbs or fat not listed
- SuperYou Protein Wafer Bar (10g protein), Cookies & Cream (40g wafer): carbs or fat not listed
- SuperYou Power Puffs (8g protein), Pizza Party (33g pack): calories or protein not listed
- SuperYou Power Puffs (13g protein), Chilli Masala (55g pack): carbs or fat not listed
- The Whole Truth Snackbar, Mixed Fruit (35g bar): calories or protein not listed
- Get-A-Way High Protein Ice Cream, Chocolate Brownie Fudge Cup (Cup): serving has no weight (Cup)
- Get-A-Way High Protein Ice Cream, Blueberry Cheesecake Cup (Cup): serving has no weight (Cup)
- Get-A-Way High Protein Ice Cream, Dark Chocolate Cone (Cone): serving has no weight (Cone)

## Replaced older labels (old id, new product)

- `on-gold-standard-whey`: Optimum Nutrition Gold Standard 100% Whey, Double Rich Chocolate
- `naturaltein-whey`: Naturaltein Whey Concentrate, Chocolate
- `whole-truth-protein-bar`: The Whole Truth Pro Protein Bar (20g), Peanut Cocoa Pro
- `alpino-natural-peanut-butter`: Alpino Natural Peanut Butter, Smooth
- `amul-kool-flavoured-milk`: Amul Kool Flavoured Milk, Elaichi
- `nutrabay-gold-hydrolyzed-pea-protein`: Nutrabay Gold Hydrolyzed Pea Protein, Rich Chocolate Creme
- `whole-truth-whey-isolate`: The Whole Truth Pure Whey Isolate, Unflavoured
- `pintola-high-protein-peanut-butter`: Pintola High Protein Dark Chocolate Peanut Butter, Crunchy
- `nutrabay-yeast-protein`: Nutrabay Fermented Yeast Protein, Cold Coffee
- `naturaltein-whey-isolate`: Naturaltein Whey Isolate, Chocolate
- `muscleblaze-raw-whey`: MuscleBlaze 100% Clean Raw Whey Concentrate, Unflavoured
- `naturaltein-yeast-protein`: Naturaltein YES Yeast Protein, Aamras
- `bagrrys-protein-muesli`: Bagrry's Whey Protein Muesli, Chocolate & Almonds
- `nakpro-perform-whey`: Nakpro Perform Whey, Unflavoured
- `amul-moti-milk`: Amul Moti UHT Milk
- `amul-cheese-slice`: Amul Processed Cheese Slices
- `amul-whey-protein`: Amul Whey Protein, Unflavoured
- `superyou-yeast-protein`: SuperYou PRO Fermented Yeast Protein, Unflavoured
- `amul-buffalo-milk`: Amul Buffalo Milk
- `yogabar-nuts-seeds-muesli`: Yoga Bar Muesli, Fruits, Nuts & Seeds
- `nutrabay-pea-protein-isolate`: Nutrabay Pure Pea Protein Isolate, Unflavoured
- `nakpro-soy-isolate`: Nakpro Platinum Soy Isolate, Unflavoured
- `frooti`: Frooti, Mango Drink
- `epigamia-greek-yogurt`: Epigamia Greek Yogurt, Natural
- `cadbury-dairy-milk`: Cadbury Dairy Milk, Original
- `amul-whey-protein-chocolate`: Amul Whey Protein, Chocolate
- `amul-t-special-milk`: Amul T-Special Milk
- `amul-slim-n-trim-milk`: Amul Slim N Trim Milk
- `amul-protein-lassi-rose`: Amul High Protein Rose Lassi
- `amul-protein-lassi-plain`: Amul High Protein Plain Lassi
- `amul-protein-buttermilk`: Amul High Protein Buttermilk
- `amul-protein-blueberry-shake`: Amul High Protein Blueberry Shake
- `amul-kool-protein-vanilla`: Amul Kool Protein Milkshake, Vanilla
- `amul-kool-protein-kesar`: Amul Kool Protein Milkshake, Kesar
- `amul-kool-protein-coffee`: Amul Kool Protein Milkshake, Arabica Coffee
- `amul-kool-protein-chocolate`: Amul Kool Protein Milkshake, Chocolate
- `amul-high-protein-paneer`: Amul High Protein Paneer
- `amul-high-protein-milk`: Amul High Protein Milk
- `amul-cow-milk`: Amul Cow Milk
- `amul-gold-milk`: Amul Gold Full Cream Milk, Pouch
- `pintola-crunchy-peanut-butter`: Pintola Classic Peanut Butter, Crunchy
- `muscleblaze-mass-gainer-xxl`: MuscleBlaze Mass Gainer XXL, Chocolate
- `gnc-yeast-protein`: GNC Select Fermented Yeast Protein, Chocolate
- `amul-taaza-toned-milk`: Amul Taaza Toned Milk, Pouch
- `asitis-soy-isolate`: AS-IT-IS ONE Soy Protein Isolate, Unflavoured
- `whole-truth-whey-cocoa`: The Whole Truth Whey Protein (Isolate + Concentrate), Light Cocoa
- `muscleblaze-biozyme-whey`: MuscleBlaze Biozyme Performance Whey, Rich Chocolate
- `saffola-masala-oats`: Saffola Masala Oats, Classic Masala
- `nutrela-soya-chunks`: Nutrela, Soya Chunks
- `amul-shakti-milk`: Amul Shakti Milk
- `ritebite-max-protein-bar`: RiteBite Daily Protein Bar (10g protein), Choco Almond
- `maaza`: Maaza, Original Mango
- `thums-up`: Thums Up, Original

## Flagged listings

- AS-IT-IS ATOM Whey, Double Rich Chocolate: Mixed with water; listing A Listing B: 136 kcal · P 27 · C 4.7 · F 1
- Amul Fresh Paneer: Per 100g; manufacturer spec Instamart listing: 296 kcal · P 20 · C 4.5 · F 22
- Amul Masti Spiced Buttermilk: Per 100 ml; pack size varies Listed as 'Masala Buttermilk', 150 ml pack: 29 kcal · P 1.5 · C 1.8 · F 1.5
- Amul Rose Lassi: Per 100 ml; 200 ml pack 150 ml pack listing: 88 kcal · P 2 · C 14.5 · F 2.1
- Amul Kool Flavoured Milk, Elaichi: Per 100 ml; 200 ml glass bottle 180 ml PET bottle listing: 94 kcal · P 3 · C 13 · F 3
- Milky Mist Greek Yogurt, Natural: Per 100g; 100g cup 225g / 700g pack listings: 89.8 kcal · P 8 · C 9.5 · F 2.2
- Milky Mist Skyr, Plain: Per 100g; BigBasket panel Zepto listing (as 'Skyr High Protein Plain Yogurt'): 101 kcal · P 11 · C 9.5 · F 2.1
- Milky Mist Pizza Mozzarella Cheese: Per 100g; 1 kg pouch Alternate listing (as 'Mozzarella Cheese'): 302 kcal · P 22.3 · C 2.6 · F 22.5
- Epigamia Greek Yogurt, Natural: Per 100g Zepto 85g cup listing, per 85g: 58 kcal · P 6.1 · C 4 · F 1.9
- Epigamia Zero Added Sugar Greek Yogurt, Alphonso Mango: Per 100g; 85g cup Alternate 90g formulation, per 100g (listed as 'No Added Sugar Greek Yogurt'): 85.1 kcal · P 7 · C 8.8 · F 2.4
- Epigamia Plant-based: Unsweetened Almond Beverage: Non-dairy; per 100 ml; BigBasket listing Zepto listing: 24 kcal · P 1 · C 1 · F 1.6
- Country Delight 25g Protein Dahi: Per 100g; pack label Alternate retailer record (as 'High Protein Dahi'): 77 kcal · P 7.5 · C 4.5 · F 3.2
- Country Delight 22g Low Fat High Protein Milk: Per 100 ml; pack label Also covers: Third-party record (as 'Low Fat High Protein Milk'), identical values Instamart panel: 65 kcal · P 5.6 · C 3.6 · F 3.2
- Heritage Processed Cheese Slices: Per 100g; 200g pack 480g pack listing: 308 kcal · P 21 · C 2 · F 24
- Nandini Regular Pouch Curd: Per 100g Older panel (listed as 'Curd'), per 100 ml: 59 kcal · P 3.8 · C 4.3 · F 3.0
- GOAT Life High Protein Oats, Mango Madness: Per 75g sachet (label) Also per 100g (converted from sachet): 420 kcal · P 26.67 · C 68 · F 5.33 Lab test per 100g (Lilaba, 2026): 384.53 kcal · P 27.5 · C 55.11 · F 6.01
- GOAT Life High Protein Oats, Choco-Nut Crunch: Per 75g sachet (label) Also per 100g (converted from sachet): 445.33 kcal · P 26.67 · C 62.67 · F 10.67 Lab test per 100g (Lilaba, 2026): 392 kcal · P 27 · C 53 · F 8
- GOAT Life High Protein Oats, Mocha Marvel: Per 75g sachet (label) Also per 100g (converted from sachet): 412 kcal · P 26.67 · C 62.67 · F 6.67 Lab test per 100g (Lilaba, 2026): 358 kcal · P 27 · C 49 · F 6
- GOAT Life High Protein Oats, Almond Kulfi: Per 75g sachet (label) Also per 100g (converted from sachet): 396 kcal · P 26.67 · C 50.67 · F 10.67 Lab test per 100g (Lilaba, 2026): 368.50 kcal · P 28 · C 45 · F 8.50
- Tropicana Delight, Orange: Per 100 ml; 1 L pack 180 ml tetra listing: 50 kcal · P 0.1 · C 12.4 · F 0 · S 12
- Cadbury Dairy Milk Silk, Original: Per 100g; 60g bar listing 144g bar listing: 537 kcal · P 7.7 · C 56.6 · F 31.3
- Nakpro Platinum Raw Whey Isolate, Unflavoured: Check pack: Same macros as Platinum Whey Isolate (Unflavoured) except sugar, possibly a renamed listing.
- Nakpro Platinum Plus+ Whey Isolate, Flavoured: Check pack: Same macros as Platinum Whey Isolate (Flavoured) except sugar, possibly a renamed listing.
- Nakpro Perform Plus+ Whey Blend, Flavoured: Check pack: Same macros as Perform Whey (Flavoured) except sugar, possibly a renamed listing.
- AS-IT-IS ATOM Whey Protein XL, Double Rich Chocolate: Check pack: Values close to ATOM Whey Double Rich Chocolate, may be the same product under another name.
- Amul Lassi: Per 100 ml; 250 ml pack; flavour not stated in source; Check pack: Flavour not stated; values are close to Rose Lassi, may be the same product.
- Amul Kool Premium Kesar: Per 100 ml; 180 ml pack; Check pack: Close to Kool Flavoured Milk – Kesar (88 kcal), may be the same drink.
- Epigamia Plant-based: Coconut Flavoured Non-Dairy Yogurt: Non-dairy; per 100g; 85g cup; Check pack: Source calls it a separate formulation; values sit close to Coconut Milk Yogurt – Jaggery.
- Heritage Lite / Low Fat Paneer: Per 100g; Check pack: Nearly identical to Nourish+ High Protein Paneer (203 vs 202.6 kcal, same P/C/F), may be the same paneer.
- The Whole Truth Protein Block, Double Cocoa: Fibre 2.3g; 0g added sugar; Check pack: Identical panel to Mini Protein Bar – Double Cocoa, probably the same bar under a newer name.
- The Whole Truth Protein Block, Peanut Cocoa: Fibre 1.4g; 0g added sugar; Check pack: Identical panel to Mini Protein Bar – Peanut Cocoa, probably the same bar under a newer name.
- Tropicana Mixed Fruit: Per 100 ml; 180 ml tetra; Check pack: May be the 180 ml pack of Delight – Mixed Fruit (48 vs 42 kcal).
- Cadbury Dairy Milk Silk, Bubbly: Per 100g; Check pack: Panel is identical to Silk Original, may have been copied from it.

## Search

`src/domain/nutrition/search.ts`:

- Every word must match a word of the name or another name (as before), using a prefix index
  built once per food list, so only foods that can match are scored.
- A brand typed ("amul paneer", "mb biozyme", "twt bar", "coke") ranks that brand first. Brand
  nicknames are in `BRAND_ALIASES` (`branded/index.ts`).
- A plain word ("paneer") ranks the everyday food first; packs come after, and the list shows
  at most four packs until "Show more" (`groupResults`). A brand shows ten, then "Show more".
- A word with a typo matches when nothing else does ("epigamea", "penut"), never for a food
  outside the person's diet.
- Foods the person logs often move up by at most 2 points, less than an exact name adds.
- A shared food with the same name as one in the library is shown once.
- The library lives on the phone (lazy loaded with the long tail), so search makes no server
  calls and no AI calls. Tested at 100,000 foods (`branded.test.ts`).

## Re-running the import

1. Put the PDF next to the scripts as `branded.pdf`, run `python3 parse.py`, `python3 build.py`.
2. Dump the current library to `existing.json` (see `gen.py` header) and run `python3 gen.py`.
3. Check `REPL` in `gen.py` by hand: it lists which old labels a new product replaces.
4. Run `pnpm vitest run src/data/library` before committing.
