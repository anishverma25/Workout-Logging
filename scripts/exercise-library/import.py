"""
Imports the exercise muscle-targeting sheet into the app (November 2026).

    python3 scripts/exercise-library/import.py

Reads both workbooks beside this script (the 165-exercise sheet, then the 42 researched
additions) and writes src/data/library/targeting.json. Safe to run again: the output depends
only on the sheets. It also checks the sheet against the library
in src/data/library/exercises.ts and prints a reconciliation report:

- every sheet row must match exactly one library exercise by name (case and punctuation
  ignored) and the same equipment; the sheet's Existing / Proposed label is checked, never
  trusted;
- rows that match nothing, match twice, or disagree on equipment are listed as ambiguous and
  the script exits with an error instead of guessing.

Needs openpyxl (development only).
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).parent
SHEETS = [
    HERE / 'Exercise_Muscle_Targeting_165_Exercises_Final.xlsx',
    HERE / 'Macrotrophy_42_Additional_Exercises_Researched.xlsx',
]
OUT = ROOT / 'src/data/library/targeting.json'
LIBRARY = ROOT / 'src/data/library/exercises.ts'

# Rows the sheet proposes as new that are the same movement as a library exercise. They are not
# added (no duplicates) and are listed in the report for the owner to decide.
SAME_AS_EXISTING = {
    'Seated hip abduction machine': 'Hip abduction machine',
    'Single-arm cuffed cable lateral raise': 'Cable lateral raise',
    'Single-arm overhead cable triceps extension': 'One-arm cable triceps extension',
    # The 42 additions (24 Nov 2026): the library already loads these with a plate or harness,
    # and the side-on single-arm cable fly is the Bayesian rear-delt fly. Their search words are
    # added to the existing exercise.
    'Weighted Neck Flexion': 'Neck flexion',
    'Weighted Neck Extension': 'Neck extension',
    'Single-Arm Cable Rear Delt Fly': 'Bayesian cable rear-delt fly',
}

# Sheet names shown differently in the app.
RENAMED = {'Bilateral Cable Rear Delt Fly': 'Cable rear delt fly'}

# The second sheet names equipment in words; the library's equipment for each.
EQUIPMENT = {
    'smith machine': 'machine',
    'bodyweight + external load': 'bodyweight',
    'dumbbell / calf machine': 'dumbbell',
    'assisted dip machine': 'machine',
    'wrist roller': 'other',
    'weight plates': 'other',
    'machine / dumbbell': 'machine',
    'tibialis machine / tib bar': 'other',
    'manual resistance / plate / harness': 'other',
    'plate / neck harness': 'other',
    'neck harness / plate': 'other',
}

# Studies the second sheet cites that the app already lists (by its own id).
KNOWN_SOURCES = {
    'Muyor et al., 2022': 'muyor2022',
    'Kinoshita et al., 2023': 'kinoshita2023',
    'Schoenfeld et al., 2013': 'schoenfeld2013',
    'Youdas et al., 2010': 'youdas2010',
}

# The sheet's default note for exercises with nothing specific to say: not shown in the app.
GENERIC_TECHNIQUE = 'Assumes a conventional, controlled version'

CONFIDENCE = {'Moderate': 'moderate', 'Low–moderate': 'low-moderate', 'Low': 'low'}
LATERALITY = {'Bilateral': 'bilateral', 'Unilateral': 'unilateral', 'Both': 'both'}


def norm(s: str) -> str:
    return re.sub(r'[^a-z0-9]', '', s.lower())


def library():
    src = LIBRARY.read_text()
    out = []
    for m in re.finditer(
        r"key: '([^']+)',\s*name: (?:'([^']*)'|\"([^\"]*)\"),(.*?)instructions:", src, re.S
    ):
        key, name = m.group(1), m.group(2) or m.group(3)
        eq = re.search(r"equipment: '(\w+)'", m.group(4))
        out.append({'key': key, 'name': name, 'equipment': eq.group(1) if eq else None})
    return out


def citation(sid: str, r) -> dict:
    """A source row of the second sheet as an app citation, linked by its URL."""
    title_text, url = r[1], r[2]
    m = re.match(r'^(.+?),\s*(\d{4})\.\s*(.+)$', title_text)
    if m:
        authors, year, title = m.group(1), int(m.group(2)), m.group(3)
    else:
        head, _, rest = title_text.partition(', ')
        authors, year, title = head.strip(), None, rest.strip()
    if not title:
        # No author given: the description is the title, under the site it lives on.
        authors, title = 'PubMed' if 'pubmed' in url else url.split('/')[2], title_text
    title = title[0].upper() + title[1:]
    # The sheet gives a short description, not the paper's title: it stands in for the journal.
    out = {'id': sid, 'authors': authors, 'title': title, 'journal': title, 'url': url, 'openAccess': True}
    if year:
        out['year'] = year
    return out


def read_sheet(path: Path, muscle_key: dict, citations: dict):
    wb = openpyxl.load_workbook(path, data_only=True)
    for r in wb['Muscle key'].iter_rows(min_row=2, values_only=True):
        if r[0]:
            muscle_key[r[0]] = r[1]
    second = 'Logging & Search' in wb.sheetnames
    aliases = {}
    source_ids = {}
    if second:
        for r in wb['Logging & Search'].iter_rows(min_row=2, values_only=True):
            if r[0] and r[2]:
                aliases[r[0]] = [a.strip() for a in r[2].split(';') if a.strip()]
        for r in wb['Sources'].iter_rows(min_row=2, values_only=True):
            if not r[0]:
                continue
            known = next((v for k, v in KNOWN_SOURCES.items() if r[1].startswith(k)), None)
            if known:
                source_ids[r[0]] = known
            else:
                sid = 'add42-' + r[0].lower()
                source_ids[r[0]] = sid
                citations[sid] = citation(sid, r)

    rows = []
    for r in wb['Exercises'].iter_rows(min_row=2, values_only=True):
        if not r[0]:
            continue
        regions = []
        for i in range(9):
            name, share = r[10 + 2 * i], r[11 + 2 * i]
            if name:
                if name not in muscle_key:
                    sys.exit(f'{r[0]}: muscle "{name}" is not in the Muscle key')
                regions.append({'region': name, 'share': int(share)})
        total = sum(x['share'] for x in regions)
        if total != 100 or any(x['share'] % 5 for x in regions):
            sys.exit(f'{r[0]}: shares add up to {total} or are not in 5% steps')
        if r[8] not in CONFIDENCE or r[29] not in LATERALITY:
            sys.exit(f'{r[0]}: unknown confidence "{r[8]}" or laterality "{r[29]}"')
        # The second sheet's technique notes repeat the instructions, so only the first's.
        technique = (
            r[9] if not second and r[9] and not r[9].startswith(GENERIC_TECHNIQUE) else None
        )
        rows.append(
            {
                'name': r[0],
                'match': RENAMED.get(r[0], r[0]),
                'equipment': EQUIPMENT.get(r[6], r[6]),
                'status': 'New' if second else r[7],
                'confidence': CONFIDENCE[r[8]],
                'technique': technique,
                'laterality': LATERALITY[r[29]],
                'regions': sorted(regions, key=lambda x: -x['share']),
                'aliases': aliases.get(r[0], []),
                'sources': (
                    [source_ids[x.strip()] for x in (r[32] or '').split(';') if x.strip()]
                    if second
                    else None
                ),
            }
        )
    return rows


def main():
    muscle_key, citations, rows = {}, {}, []
    for path in SHEETS:
        rows += read_sheet(path, muscle_key, citations)

    lib = library()
    by_name = {}
    for e in lib:
        by_name.setdefault(norm(e['name']), []).append(e)
    problems, existing, added, skipped = [], 0, 0, []
    kept = []
    extra_aliases = {}
    for row in rows:
        if row['name'] in SAME_AS_EXISTING:
            same = by_name.get(norm(SAME_AS_EXISTING[row['name']]), [])
            if len(same) != 1:
                problems.append(f'{row["name"]}: "{SAME_AS_EXISTING[row["name"]]}" is not one library exercise')
                continue
            extra_aliases[same[0]['key']] = [row['name'].lower(), *row['aliases']]
            skipped.append(f'{row["name"]}: same movement as "{SAME_AS_EXISTING[row["name"]]}", not added')
            continue
        kept.append(row)
        hits = by_name.get(norm(row['match']), [])
        if len(hits) != 1:
            problems.append(f'{row["name"]}: matches {len(hits)} library exercises')
            continue
        e = hits[0]
        if e['equipment'] != row['equipment']:
            problems.append(f'{row["name"]}: library {e["equipment"]}, sheet {row["equipment"]}')
        row['key'] = e['key']
        if row['status'] == 'Existing':
            existing += 1
        else:
            added += 1
    rows = kept
    matched = {r.get('key') for r in rows}
    missing = [e['name'] for e in lib if e['key'] not in matched]

    print(f'Sheet rows: {len(rows) + len(skipped)}')
    print(f'Library exercises: {len(lib)}, not in the sheet: {missing or "none"}')
    print(f'Imported: {existing} existing updated, {added} new')
    for line in skipped:
        print('Flagged: ' + line)
    if problems:
        print('Ambiguous, not imported:')
        for p in problems:
            print('  ' + p)
        sys.exit(1)
    # Only what the app uses: the key, the muscle groups, shares, confidence, laterality and a
    # technique note when it says something specific.
    app_rows = []
    for row in rows:
        out = {k: row[k] for k in ('key', 'confidence', 'technique', 'laterality', 'regions')}
        if row['sources'] is not None:
            out['sources'] = row['sources']
        app_rows.append(out)
    # Search words: the second sheet's aliases (the exercise's own name already matches).
    aliases = {row['key']: row['aliases'] for row in rows if row['aliases']}
    for key, words in extra_aliases.items():
        aliases[key] = sorted({*aliases.get(key, []), *words})
    OUT.write_text(
        json.dumps(
            {
                'muscles': muscle_key,
                'exercises': app_rows,
                'aliases': aliases,
                'citations': list(citations.values()),
            },
            ensure_ascii=False,
            separators=(',', ':'),
        )
        + '\n'
    )
    print(f'Wrote {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
