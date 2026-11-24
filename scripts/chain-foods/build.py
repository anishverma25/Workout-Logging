"""
Chain menus (November 2026): Burger King, Domino's, Pizza Hut, McDonald's and Starbucks India.

    python3 scripts/chain-foods/build.py

Reads the text of each chain's nutrition document in scripts/chain-foods/sources (made with
`pdftotext -layout file.pdf name.txt` from the PDFs listed in DOCS) and writes
src/data/library/chains/rows.json plus a report on stdout.

Rules:
- Values are copied exactly as published, per the chain's own serving. Published calories are
  kept even when they disagree with the macros; those rows get a `conflict` flag and a note.
- "% RDA" rows are never read as nutrients.
- A nutrient the document does not give is null (unknown), never 0.
- Sizes and variants of one product share a `group`, so search shows the product once.
- The McDonald's file is a compilation of the official booklet, not the booklet itself, so its
  rows are `compiled`, never `official`.
Running it again gives the same file.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).with_name('sources')
OUT = ROOT / 'src/data/library/chains/rows.json'
REPLACED_OUT = ROOT / 'src/data/library/chains/replaced.json'

# Foods already in the library that are the same product as a row here: the row takes the old
# id, so favourites, recent foods and usual meals keep working. Logged food keeps its own numbers.
REPLACES = {
    'mcaloo-tikki': "c-mcdonald-s-aloo-tikki-burger",
    'mcveggie': 'c-mcdonald-s-mcveggie-burger',
    'mcspicy-paneer': 'c-mcdonald-s-mcspicy-paneer-burger',
    'mcchicken': 'c-mcdonald-s-mcchicken-burger',
    'mccrispy-chicken': 'c-mcdonald-s-mccrispy-chicken-burger',
    'mcd-veg-surprise': 'c-mcdonald-s-veg-surprise-burger',
    'mcd-pizza-mcpuff': 'c-mcdonald-s-pizza-puff',
    'mcgrill-chicken': 'c-mcdonald-s-chicken-mcgrill-burger',
    'mcd-cold-coffee': 'c-mcdonald-s-cold-coffee-300-ml-serving',
    'dominos-peppy-paneer-slice': 'c-domino-s-peppy-paneer-pizza-regular-new-hand-tossed',
    'dominos-margherita-regular-slice': 'c-domino-s-margherita-pizza-regular-new-hand-tossed',
    'dominos-farmhouse-medium-slice': 'c-domino-s-farmhouse-pizza-medium-new-hand-tossed',
    'dominos-garlic-bread': 'c-domino-s-garlic-bread',
    'dominos-stuffed-garlic-bread': 'c-domino-s-stuffed-garlic-bread',
    'dominos-zingy-parcel-veg': 'c-domino-s-zingy-parcel-veg',
    'bk-crispy-veg': 'c-burger-king-crispy-veg',
    'bk-paneer-royale': 'c-burger-king-paneer-royale-burger',
    'bk-fiery-chicken': 'c-burger-king-fiery-chicken-burger',
    'bk-egg-burger': 'c-burger-king-bk-egg-burger',
    'bk-veg-whopper': 'c-burger-king-crunchy-veg-whopper',
}

DOCS = {
    'Burger King': ('official', 'Burger King India nutrition per serve, 12 February 2026'),
    "Domino's": ('official', "Domino's India nutritional information"),
    'Pizza Hut': ('official', 'Pizza Hut India nutrition and allergen booklet, 2022'),
    "McDonald's": (
        'compiled',
        "McDonald's India (North and East) macros compiled from the official booklet",
    ),
    'Starbucks': ('official', 'Tata Starbucks nutrition guide, food and beverages'),
}

NONVEG = re.compile(
    r'chicken|keema|sausage|pepperoni|murg|mutton|fish|prawn|tuna|ham\b|bacon|salami|meat|'
    r'non[- ]?veg|wings|nugget|lamb|turkey|pork',
    re.I,
)
EGG = re.compile(r'\begg\b', re.I)


def slug(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def num(x):
    x = x.strip().rstrip('*')
    if x in ('', 'NA', 'ND', '-', 'NA*'):
        return None
    try:
        return float(x)
    except ValueError:
        return None


def diet_of(name: str, section: str = '') -> str:
    if NONVEG.search(name):
        return 'nonveg'
    if EGG.search(name):
        return 'egg'
    if re.search(r'\bnon[- ]?veg', f'{name} {section}', re.I):
        return 'nonveg'
    return 'veg'


ROWS = []
REPORT = {'skipped': [], 'conflicts': []}


def add(
    brand,
    name,
    *,
    group,
    dims,
    category,
    diet,
    kcal,
    p,
    c,
    f,
    fibre=None,
    sugar=None,
    basis=None,
    unit=None,
    piece=('serving', 'servings'),
    slices=None,
    serves=None,
):
    """One serving as the chain publishes it."""
    if None in (kcal, p, c, f):
        REPORT['skipped'].append(f'{brand} {name}: calories, protein, carbs or fat not given')
        return
    if basis and unit != 'ml' and (kcal / basis * 100 > 950):
        REPORT['skipped'].append(f'{brand} {name}: {kcal:g} kcal in {basis:g} g cannot be right')
        return
    source, _doc = DOCS[brand]
    flag, note = None, None
    atwater = 4 * p + 4 * c + 9 * f
    if kcal > 40 and abs(atwater - kcal) / kcal > 0.25:
        flag = 'conflict'
        note = (
            f'The chain lists {kcal:g} kcal, but its protein, carbs and fat add up to about '
            f'{round(atwater)} kcal. Calories are kept as published.'
        )
        REPORT['conflicts'].append(f'{brand} {name}: {kcal:g} kcal vs {round(atwater)} from macros')
    if source == 'compiled' and not flag:
        flag = 'check'
        note = "Compiled from McDonald's India's published booklet; check the current menu."
    rid = 'c-' + slug(f'{brand} {name}')
    ROWS.append(
        {
            'id': rid,
            'name': name,
            'brand': brand,
            'group': 'g-' + slug(f'{brand} {group}'),
            'groupName': group,
            'dims': dims,
            'category': category,
            'diet': diet,
            'kcal': round(kcal, 2),
            'p': round(p, 2),
            'c': round(c, 2),
            'f': round(f, 2),
            'fibre': None if fibre is None else round(fibre, 2),
            'sugar': None if sugar is None else round(sugar, 2),
            'basis': basis,
            'unit': unit,
            'piece': list(piece),
            'slices': slices,
            'serves': serves,
            'source': source,
            'flag': flag,
            'note': note,
        }
    )


def fields(line: str):
    return [x for x in re.split(r'\s{2,}', line.strip()) if x]


# ------------------------------------------------------------------------------------------
# Burger King: name, portion g/ml, kcal, carbs, sugar, fat, sat fat, trans, protein, sodium.
# ------------------------------------------------------------------------------------------
BK_DRINK = {'FOUNTAIN DRINKS', 'SHAKES', 'HOT BEVERAGES', 'COLD BEVERAGES'}
BK_SWEET = {'DESSERTS'}
SIZE_WORDS = r'(Small|Regular|Medium|Large|King)'


def bk_group(name: str):
    m = re.match(rf'^(.*?)\s*\(?(\d+)\s*Pcs\)?$', name, re.I)
    if m:
        return m.group(1).strip(), [['Size', f'{m.group(2)} pcs']], ('pack', 'packs')
    m = re.match(rf'^(.*?)\s+{SIZE_WORDS}$', name, re.I)
    if m:
        return m.group(1).strip(' -'), [['Size', m.group(2).title()]], None
    m = re.match(rf'^{SIZE_WORDS}\s+(.*)$', name, re.I)
    if m:
        return m.group(2).strip(), [['Size', m.group(1).title()]], None
    return name, [], None


def parse_bk():
    section = ''
    for line in (SRC / 'bk.txt').read_text().split('\n'):
        f = fields(line)
        if not f:
            continue
        if len(f) == 1 and not re.search(r'\d', f[0]) and len(f[0]) < 30:
            section = f[0].upper()
            continue
        if not re.fullmatch(r'\d+', f[0]) or len(f) < 4:
            continue
        name = f[1]
        vals = ' '.join(f[2:]).split()
        if len(vals) < 9:
            REPORT['skipped'].append(f'Burger King {name}: row not complete in the document')
            continue
        g, kcal, carbs, sugar, fat, _sat, _trans, protein, _na = (num(v) for v in vals[:9])
        drink = section in BK_DRINK
        group, dims, piece = bk_group(name)
        if drink:
            piece = ('cup', 'cups')
        elif piece is None:
            piece = (
                ('burger', 'burgers')
                if 'BURGER' in section
                else ('serving', 'servings')
            )
        add(
            'Burger King',
            name,
            group=group,
            dims=dims,
            category='drink' if drink else 'sweet' if section in BK_SWEET else 'snack',
            diet=diet_of(name, section),
            kcal=kcal,
            p=protein,
            c=carbs,
            f=fat,
            sugar=sugar,
            basis=g,
            unit='ml' if drink else 'g',
            piece=piece,
        )


# ------------------------------------------------------------------------------------------
# Domino's: pizzas per serve (slices) for crust x size, one table per nutrient; sides and
# drinks in their own tables. No weights are published, so pizzas are logged by the slice.
# ------------------------------------------------------------------------------------------
DOM_COLS = [
    ('New Hand Tossed', 'Regular', 4, 1),
    ('New Hand Tossed', 'Medium', 3, 2),
    ('New Hand Tossed', 'Large', 2, 4),
    ('Fresh Pan', 'Regular', 4, 1),
    ('Fresh Pan', 'Medium', 3, 2),
    ('Thin Crust', 'Regular', 4, 1),
    ('Thin Crust', 'Medium', 3, 2),
    ('Cheese Burst', 'Regular', 4, 1),
    ('Cheese Burst', 'Medium', 3, 2),
]
DOM_TABLES = [
    ('Energy (KCal) per serve', 'kcal'),
    ('Protein (g)', 'p'),
    ('Total carbohydrate (g)', 'c'),
    ('Total Sugar (g)', 'sugar'),
    ('Total Fat (g)', 'f'),
]
EXPAND = {'PP V': 'Pasta Pizza Veg', 'PP NV': 'Pasta Pizza Non Veg'}


def parse_dominos():
    lines = (SRC / 'dom.txt').read_text().split('\n')
    pizzas: dict[str, dict] = {}
    current = None
    for line in lines:
        s = line.strip()
        for title, key in DOM_TABLES:
            if s.endswith(title) and 'Pizza Mania' not in line:
                current = key
        if 'Pizza Mania' in line or s.startswith('S.No. Sides'):
            current = None
        if s.startswith('Total Saturated') or s.startswith('Total Trans') or s.startswith('Sodium'):
            current = None
        if not current:
            continue
        m = re.match(r'^\s*(\d+)\s{2,}(.+?)\s{2,}(.*)$', line)
        if not m:
            continue
        vals = m.group(3).split()
        if len(vals) != 9:
            continue
        name = m.group(2).strip()
        for short, full in EXPAND.items():
            name = re.sub(rf'\b{short}$', full, name)
        pizzas.setdefault(name, {})[current] = [num(v) for v in vals]
    for name, t in pizzas.items():
        if set(t) != {k for _, k in DOM_TABLES}:
            REPORT['skipped'].append(f"Domino's {name}: a nutrient table is missing")
            continue
        for i, (crust, size, slices_per_serve, people) in enumerate(DOM_COLS):
            v = {k: t[k][i] for k in t}
            if v['kcal'] is None:
                continue
            whole = slices_per_serve * people
            per = 1 / slices_per_serve
            # "Unthinkable Pizza" is already a pizza: no second "pizza" in its name.
            title = name if name.lower().endswith('pizza') else f'{name} pizza'
            add(
                "Domino's",
                f'{title}, {size.lower()}, {crust.lower()}',
                group=title,
                dims=[['Size', size], ['Crust', crust]],
                category='snack',
                diet=diet_of(name),
                kcal=v['kcal'] * per,
                p=v['p'] * per if v['p'] is not None else None,
                c=v['c'] * per if v['c'] is not None else None,
                f=v['f'] * per if v['f'] is not None else None,
                sugar=v['sugar'] * per if v['sugar'] is not None else None,
                piece=('slice', 'slices'),
                slices=whole,
            )
    # Pizza Mania: one table with every nutrient; HT and PAN, 4 slices a serve.
    in_mania = False
    for line in lines:
        if 'Pizza Mania' in line and 'Protein' in line:
            in_mania = True
            continue
        if in_mania and line.strip().startswith('S.No.') and 'Sides' in line:
            in_mania = False
        if not in_mania:
            continue
        m = re.match(r'^\s*(\d+)\s{2,}(.+?)\s{2,}(.*)$', line)
        if not m:
            continue
        vals = [num(v) for v in m.group(3).split()]
        if len(vals) != 16:
            continue
        name = m.group(2).strip()
        for j, crust in enumerate(('Hand Tossed', 'Pan')):
            kcal, p, c, sugar, f = (vals[j], vals[2 + j], vals[4 + j], vals[6 + j], vals[8 + j])
            if kcal is None:
                continue
            add(
                "Domino's",
                f'Pizza Mania {name}, {crust.lower()}',
                group=f'Pizza Mania {name}',
                dims=[['Crust', crust]],
                category='snack',
                diet=diet_of(name),
                kcal=kcal / 4,
                p=p / 4,
                c=c / 4,
                f=f / 4,
                sugar=sugar / 4,
                piece=('slice', 'slices'),
                slices=4,
            )
    # Sides: the second table, with every nutrient for the whole item.
    in_sides = False
    seen = set()
    for line in lines:
        s = line.strip()
        if s.startswith('S.No.') and 'Sides' in s and 'Protein' in s:
            in_sides = True
            continue
        if in_sides and s.startswith('S.No.'):
            in_sides = False
        if not in_sides:
            continue
        m = re.match(r'^\s*(\d+)\s{2,}(.+?)\s{2,}(.*)$', line)
        if not m:
            continue
        vals = [num(v) for v in m.group(3).split()]
        if len(vals) != 9:
            continue
        name = re.sub(r'\s+', ' ', m.group(2).replace('Non- veg', 'Non-veg')).strip()
        name = {'SGB': 'Stuffed Garlic Bread', 'BMC': 'Butterscotch Mousse Cake'}.get(name, name)
        name = name.replace(' SGB', ' Stuffed Garlic Bread').replace('Jalaepno', 'Jalapeno')
        name = name.replace('Pemium', 'Premium')
        key = (name, tuple(vals))
        if key in seen:
            continue
        seen.add(key)
        serves, kcal, p, c, sugar, f = vals[:6]
        add(
            "Domino's",
            name,
            group=name,
            dims=[],
            category='sweet' if re.search(r'cake|brownie|lava', name, re.I) else 'snack',
            diet=diet_of(name),
            kcal=kcal,
            p=p,
            c=c,
            f=f,
            sugar=sugar,
            piece=('serving', 'servings'),
            serves=int(serves) if serves else None,
        )
    # Drinks: listed per 100 ml in the full table; 350 ml cup.
    REPORT['skipped'].append(
        "Domino's fountain drinks: the full table's fat column does not match the drinks "
        '(Pepsi shows 11 g fat), so they are left out until the chain corrects it'
    )


# ------------------------------------------------------------------------------------------
# Pizza Hut: weight, slices, kcal, %RDA, carbs, protein, fibre, total sugar, added sugar,
# %RDA, fat, %RDA, MUFA, PUFA, sat, %RDA, trans, %RDA, cholesterol, sodium, %RDA (whole item).
# Items without slices skip that column.
# ------------------------------------------------------------------------------------------
PH_SECTIONS = [
    ('Pan', r'^Pan Pizza'),
    ('Thin n Crispy', r'^TnC|Thin'),
    ('Ultimate Cheese', r'Ultimate Cheese'),
    ('Hand Stretched', r'Hand Stretched|Overloaded'),
]
PH_SIZE = re.compile(r'\s*\((Personal|Medium|Large|Regular)\)|\s+(Personal|Medium|Large)\b.*$', re.I)


def parse_pizza_hut():
    seen = set()
    crust = 'Pan'
    for line in (SRC / 'ph.txt').read_text().split('\n'):
        f = fields(line)
        if len(f) == 1 and len(f[0]) < 40:
            for name, pat in PH_SECTIONS:
                if re.search(pat, f[0], re.I):
                    crust = name
        if len(f) < 8:
            continue
        i = 0
        while i < len(f) and not re.fullmatch(r'[\d.]+|ND|NA', f[i]):
            i += 1
        if i == 0 or i > 2:
            continue
        name = re.sub(r'\s+', ' ', ' '.join(f[:i])).strip()
        name = re.sub(r'\s+\d+$', '', name)  # a weight that ran into the name
        row_crust = crust
        if re.search(r'\bTnC\b', name):
            row_crust = 'Thin n Crispy'
            name = re.sub(r'\s*TnC( Pizza)?', '', name).strip()
        toks = []
        for x in f[i:]:
            toks.extend(x.split())
        vals = [t for t in toks if re.fullmatch(r'[\d.]+|ND|NA|-', t)]
        v = [num(t) for t in vals]
        has_slices = len(v) >= 21 and v[1] is not None and v[1] <= 12 and (v[2] or 0) > 40
        if has_slices:
            weight, slices, kcal, _, carbs, protein, fibre, sugar = v[:8]
            fat = v[10]
        elif len(v) >= 20:
            weight, kcal, _, carbs, protein, fibre, sugar = v[:7]
            slices = None
            fat = v[9]
        else:
            REPORT['skipped'].append(f'Pizza Hut {name}: row not complete in the document')
            continue
        if kcal is None:
            REPORT['skipped'].append(f'Pizza Hut {name}: calories not given')
            continue
        key = (name, weight, kcal)
        if key in seen:
            continue
        seen.add(key)
        m = PH_SIZE.search(name)
        size = (m.group(1) or m.group(2)).title() if m else None
        base = PH_SIZE.sub('', name).replace(' Pan Pizza', '').strip()
        base = re.sub(r'\s+(Ultimate Cheese|Hand Stretched)$', '', base)
        base = re.sub(r'\s+Pizza$', '', base)
        pizza = slices is not None
        is_pizza = pizza and not re.search(r'wing|stix|stick|bread|momo|pocket', name, re.I)
        dims = []
        if size:
            dims.append(['Size', size])
        if is_pizza:
            dims.append(['Crust', row_crust])
        per = 1 / slices if is_pizza else 1
        if pizza and not is_pizza:
            dims.append(['Size', f'{int(slices)} pcs'])
        label = ', '.join(
            x for x in (base, size.lower() if size else None, row_crust.lower() if is_pizza else None) if x
        )
        add(
            'Pizza Hut',
            label if is_pizza else (f'{name} ({int(slices)} pcs)' if pizza else name),
            group=base if is_pizza else re.sub(r'\s*\(\d+\s*pc\.?\)', '', name, flags=re.I),
            dims=dims,
            category='snack',
            diet=diet_of(name),
            kcal=kcal * per,
            p=protein * per if protein is not None else None,
            c=carbs * per if carbs is not None else None,
            f=fat * per if fat is not None else None,
            fibre=fibre * per if fibre is not None else None,
            sugar=sugar * per if sugar is not None else None,
            basis=round(weight * per, 1) if weight else None,
            unit='g',
            piece=('pack', 'packs')
            if pizza and not is_pizza
            else (
                ('wing', 'wings')
                if re.search(r'wing', name, re.I)
                else ('stick', 'sticks')
                if re.search(r'stix|stick', name, re.I)
                else ('piece', 'pieces')
                if re.search(r'bread|momo|pocket', name, re.I)
                else ('slice', 'slices')
            )
            if is_pizza
            else ('serving', 'servings'),
            slices=int(slices) if is_pizza else None,
        )


# ------------------------------------------------------------------------------------------
# McDonald's (compiled): category, product, portion, size, kcal, protein, carbs, fat, sodium.
# ------------------------------------------------------------------------------------------
def parse_mcdonalds():
    for line in (SRC / 'mcd.txt').read_text().split('\n'):
        f = fields(line)
        if len(f) < 8 or not re.search(r'\d+\s*(g|ml)$', f[3] if len(f) > 3 else ''):
            continue
        cat, name, portion, size = f[0], f[1], f[2], f[3]
        nums = [num(x) for x in f[4:9]]
        kcal, p, c, fat = nums[:4]
        m = re.match(r'([\d.]+)\s*(g|ml)', size)
        basis, unit = float(m.group(1)), m.group(2)
        drink = unit == 'ml' or re.search(r'beverage|drink|coffee|shake|tea', cat, re.I)
        variant = portion if portion.lower() != 'standard' else None
        add(
            "McDonald's",
            f'{name} ({variant})' if variant else name,
            group=name,
            dims=[['Size', variant]] if variant else [],
            category='drink' if drink else 'sweet' if re.search(r'dessert', cat, re.I) else 'snack',
            diet=diet_of(name),
            kcal=kcal,
            p=p,
            c=c,
            f=fat,
            basis=basis,
            unit='ml' if unit == 'ml' else 'g',
            piece=('cup', 'cups')
            if drink
            else ('burger', 'burgers')
            if re.search(r'burger|muffin', name, re.I)
            else ('serving', 'servings'),
        )


# ------------------------------------------------------------------------------------------
# Starbucks: product, allergens, veg, serving (ml or g), kcal, carbs, total sugar, added
# sugar, fibre, protein, fat, sat fat, trans, cholesterol, sodium. Names that wrap onto two
# lines are joined from the lines around the row.
# ------------------------------------------------------------------------------------------
SB_DIETS = {'Vegetarian', 'Non Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian'}
SB_SIZES = ('Short', 'Tall', 'Grande', 'Venti', 'Trenta')
SB_FOOD = re.compile(
    r'croissant|cake|muffin|sandwich|wrap|puff|pie\b|cookie|loaf|bagel|panini|salad|brownie|'
    r'ice ?cream|icecream|twist|danish|roll\b|bun\b|quiche|tart|pastry|bake in|filling|'
    r'chips|paratha|burger|toast|cheesecake|donut|doughnut|macaron|mousse|bar\b|samosa|kathi',
    re.I,
)
SB_SWEET = re.compile(r'cake|muffin|cookie|brownie|ice ?cream|icecream|tart|donut|macaron|mousse|danish', re.I)
ALLERGEN = re.compile(r'^(NA|Milk|Wheat|Soy|Nut|Egg|Oat|Sesame|Mustard|Celery|Sulphite)([ ,].*)?$')


def text_line(line: str) -> str | None:
    f = fields(line)
    if len(f) != 1 or re.search(r'\d', f[0]) or 'RDA' in f[0] or len(f[0]) > 60:
        return None
    return f[0]


def parse_starbucks():
    lines = (SRC / 'sb.txt').read_text().split('\n')
    seen = set()
    for n, line in enumerate(lines):
        f = fields(line)
        idx = [i for i, x in enumerate(f) if x in SB_DIETS]
        if not idx:
            continue
        i = idx[0]
        nums = f[i + 1 :]
        if len(nums) < 11:
            continue
        name = f[0]
        if i == 0 or ALLERGEN.match(name):
            before = text_line(lines[n - 1]) if n > 0 else None
            after = text_line(lines[n + 1]) if n + 1 < len(lines) else None
            name = ' '.join(x for x in (before, after) if x)
            if not name:
                REPORT['skipped'].append(f'Starbucks row at line {n}: name not readable')
                continue
        name = re.sub(r'\s+', ' ', name).strip()
        # Allergen text that ran into a wrapped name ("... Frappuccino Wheat, Milk, Soy").
        name = re.sub(
            r'\s+(NA|(Wheat|Milk|Soy|Nut|Egg|Oat|Sesame)(,\s*(Wheat|Milk|Soy|Nut|Egg|Oat|Sesame))*)$',
            '',
            name,
        )
        v = [num(x) for x in nums[:11]]
        size, kcal, carbs, sugar, _added, fibre, protein, fat = v[:8]
        key = (name, size, kcal)
        if key in seen:
            continue
        seen.add(key)
        words = name.split(' ')
        cup = next((w for w in words if w in SB_SIZES), None)
        group = ' '.join(w for w in words if w != cup) if cup else name
        drink = not SB_FOOD.search(name)
        add(
            'Starbucks',
            name,
            group=group,
            dims=[['Size', cup]] if cup else [],
            category='drink' if drink else 'sweet' if SB_SWEET.search(name) else 'snack',
            diet='nonveg' if f[i].startswith('Non') else 'veg',
            kcal=kcal,
            p=protein,
            c=carbs,
            f=fat,
            fibre=fibre,
            sugar=sugar,
            basis=size,
            unit='ml' if drink else 'g',
            piece=('cup', 'cups') if drink else ('serving', 'servings'),
        )


def main():
    parse_bk()
    parse_dominos()
    parse_pizza_hut()
    parse_mcdonalds()
    parse_starbucks()
    ids = [r['id'] for r in ROWS]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        # Same product printed twice with different numbers: keep the first, report the rest.
        out, kept = [], {}
        for r in ROWS:
            first = kept.get(r['id'])
            if first is None:
                kept[r['id']] = r
                out.append(r)
                continue
            if r['basis'] and first['basis'] and r['basis'] != first['basis'] and not r['dims']:
                # The same item in another portion: a size of the same product.
                for x in (first, r):
                    if not any(d[0] == 'Portion' for d in x['dims']):
                        x['dims'] = x['dims'] + [['Portion', f"{x['basis']:g} {x['unit'] or 'g'}"]]
                        x['id'] = f"{x['id'].split('~')[0]}~{x['basis']:g}"
                if r['id'] not in kept:
                    kept[r['id']] = r
                    out.append(r)
                    continue
            REPORT['skipped'].append(f'{r["brand"]} {r["name"]}: listed twice, first kept')
        ROWS[:] = out
    OUT.parent.mkdir(parents=True, exist_ok=True)
    by_id = {r['id']: r for r in ROWS}
    replaced = []
    for old, new in REPLACES.items():
        if new not in by_id:
            sys.exit(f'{old}: {new} is not in the documents any more')
        replaced.append({**by_id[new], 'id': old, 'replaces': new})
    taken = set(REPLACES.values())
    rest = [r for r in ROWS if r['id'] not in taken]
    OUT.write_text(json.dumps(rest, ensure_ascii=False, separators=(',', ':')) + '\n')
    REPLACED_OUT.write_text(json.dumps(replaced, ensure_ascii=False, indent=1) + '\n')
    print(f'Replaced {len(replaced)} older chain foods in place (same ids)')
    by_brand = {}
    for r in ROWS:
        by_brand[r['brand']] = by_brand.get(r['brand'], 0) + 1
    groups = len({r['group'] for r in ROWS})
    print(f'Rows: {len(ROWS)} in {groups} products: {by_brand}')
    print(f'Conflicts kept with a flag: {len(REPORT["conflicts"])}')
    for c in REPORT['conflicts']:
        print('  conflict: ' + c)
    print(f'Skipped: {len(REPORT["skipped"])}')
    for s in REPORT['skipped']:
        print('  skipped: ' + s)
    if '--strict' in sys.argv and REPORT['skipped']:
        sys.exit(1)


if __name__ == '__main__':
    main()
