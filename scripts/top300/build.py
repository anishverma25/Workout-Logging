"""
Top 300 Indian foods by serving (November 2026).

    python3 scripts/top300/build.py

Reads macrotrophy_top_300_indian_foods_by_serving.xlsx and writes
src/data/library/top300.json: one row per food with its natural serving (1 medium chapati,
1 katori, 1 plate, 1 can) and the numbers for that serving, exactly as the sheet gives them.
The app adds a row only when the library has no food of that name (src/data/library/top300.ts),
so nothing is duplicated and existing foods keep their tested values.
Rows marked "Needs recheck" are left out. "Recipe estimate" rows carry that label.
Needs openpyxl (development only).
"""
import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
SHEET = Path(__file__).with_name('macrotrophy_top_300_indian_foods_by_serving.xlsx')
OUT = ROOT / 'src/data/library/top300.json'

CATEGORY = {
    'Everyday roti, rice & staples': 'bread',
    'Dals, beans & legumes': 'dal',
    'Dairy, eggs & primary proteins': 'dairy',
    'Everyday vegetable sabzis & curries': 'sabzi',
    'Common Indian breakfasts': 'breakfast',
    'Chicken, fish, eggs & meat meals': 'chicken',
    'Regional rice & full meals': 'rice',
    'Common fruits': 'fruit',
    'Vegetables, roots & salads': 'sabzi',
    'Nuts, seeds, fats & pantry additions': 'snack',
    'Gym-focused meals & healthy alternatives': 'snack',
    'Indian street food & snacks': 'snack',
    'Everyday packaged foods & snacks': 'snack',
    'Drinks & familiar Indian desserts': 'sweet',
    'Restaurant, takeaway & fast-food items': 'snack',
}
NONVEG = re.compile(r'chicken|mutton|fish|prawn|keema|meat|tuna|salmon|pork|lamb|beef', re.I)
EGG = re.compile(r'\begg|omelette|bhurji', re.I)
SIZE = re.compile(r'^(small|medium|large|regular|big)\s+', re.I)
NO_PLURAL = {'katori', 'tbsp', 'tsp', 'ml', 'g'}


def piece_name(unit: str) -> list[str]:
    if ' with ' in unit:
        head, tail = unit.split(' with ', 1)
        one, many = piece_name(head)
        return [f'{one} with {tail}', f'{many} with {tail}']
    word = re.split(r'[,(]', unit)[0].strip()
    word = SIZE.sub('', word)
    word = word.split(' ')[0] if word.split(' ')[0] in ('cup', 'tbsp', 'tsp', 'plate', 'bowl', 'glass', 'handful', 'scoop', 'slice', 'pack', 'can', 'bottle', 'piece', 'katori', 'jar', 'sachet') else word
    word = word.lower()
    if word.endswith('ies'):
        one = word[:-3] + 'y'
    elif word.endswith('es') and word[:-2].endswith(('ch', 'sh', 'ss', 'x')):
        one = word[:-2]
    elif word.endswith('s') and not word.endswith('ss') and word not in NO_PLURAL:
        one = word[:-1]
    else:
        one = word
    many = one if one in NO_PLURAL else (one[:-1] + 'ies' if one.endswith('y') and one[-2] not in 'aeiou' else one + ('es' if one.endswith(('ch', 'sh', 's', 'x')) else 's'))
    return [one, many]


def main():
    wb = openpyxl.load_workbook(SHEET, data_only=True)
    out, skipped = [], []
    for r in wb['300 Foods'].iter_rows(min_row=2, values_only=True):
        if not r[3]:
            continue
        name, qty, unit, size, gml, status = r[3], r[5], r[6], r[7], r[8], r[27]
        if status == 'Needs recheck':
            skipped.append(f'{name}: marked Needs recheck in the sheet')
            continue
        kcal, p, c, f, fibre = r[10], r[11], r[12], r[13], r[14]
        if None in (kcal, p, c, f, size, qty) or not qty:
            skipped.append(f'{name}: serving or numbers missing')
            continue
        diet = 'nonveg' if NONVEG.search(name) else 'egg' if EGG.search(name) else 'veg'
        category = CATEGORY.get(r[2], 'snack')
        if gml == 'ml':
            category = 'drink'
        out.append(
            {
                'id': 't300-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'),
                'name': name,
                'category': category,
                'diet': diet,
                # Numbers for one whole serving as the sheet gives it.
                'kcal': kcal,
                'p': p,
                'c': c,
                'f': f,
                'fibre': fibre,
                'servingG': size,
                'unit': gml,
                'qty': qty,
                'piece': piece_name(unit),
                'serving': r[4],
                'estimate': status == 'Recipe estimate',
                'note': r[31],
            }
        )
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Rows: {len(out)}; left out: {len(skipped)}')
    for s in skipped:
        print('  left out: ' + s)


if __name__ == '__main__':
    main()
