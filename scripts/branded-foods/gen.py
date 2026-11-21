import json,re,unicodedata
new=json.load(open('clean.json')); existing={e['id']:e for e in json.load(open('existing.json'))}
REPL={
'on-gold-standard-whey':'Optimum Nutrition Gold Standard 100% Whey, Double Rich Chocolate',
'naturaltein-whey':'Naturaltein Whey Concentrate, Chocolate',
'whole-truth-protein-bar':'The Whole Truth Pro Protein Bar (20g), Peanut Cocoa Pro',
'alpino-natural-peanut-butter':'Alpino Natural Peanut Butter, Smooth',
'amul-kool-flavoured-milk':'Amul Kool Flavoured Milk, Elaichi',
'nutrabay-gold-hydrolyzed-pea-protein':'Nutrabay Gold Hydrolyzed Pea Protein, Rich Chocolate Creme',
'whole-truth-whey-isolate':'The Whole Truth Pure Whey Isolate, Unflavoured',
'pintola-high-protein-peanut-butter':'Pintola High Protein Dark Chocolate Peanut Butter, Crunchy',
'nutrabay-yeast-protein':'Nutrabay Fermented Yeast Protein, Cold Coffee',
'naturaltein-whey-isolate':'Naturaltein Whey Isolate, Chocolate',
'muscleblaze-raw-whey':'MuscleBlaze 100% Clean Raw Whey Concentrate, Unflavoured',
'naturaltein-yeast-protein':'Naturaltein YES Yeast Protein, Aamras',
'bagrrys-protein-muesli':"Bagrry's Whey Protein Muesli, Chocolate & Almonds",
'nakpro-perform-whey':'Nakpro Perform Whey, Unflavoured',
'amul-moti-milk':'Amul Moti UHT Milk',
'amul-cheese-slice':'Amul Processed Cheese Slices',
'amul-whey-protein':'Amul Whey Protein, Unflavoured',
'superyou-yeast-protein':'SuperYou PRO Fermented Yeast Protein, Unflavoured',
'amul-buffalo-milk':'Amul Buffalo Milk',
'yogabar-nuts-seeds-muesli':'Yoga Bar Muesli, Fruits, Nuts & Seeds',
'nutrabay-pea-protein-isolate':'Nutrabay Pure Pea Protein Isolate, Unflavoured',
'nakpro-soy-isolate':'Nakpro Platinum Soy Isolate, Unflavoured',
'frooti':'Frooti, Mango Drink',
'epigamia-greek-yogurt':'Epigamia Greek Yogurt, Natural',
'cadbury-dairy-milk':'Cadbury Dairy Milk, Original',
'amul-whey-protein-chocolate':'Amul Whey Protein, Chocolate',
'amul-t-special-milk':'Amul T-Special Milk',
'amul-slim-n-trim-milk':'Amul Slim N Trim Milk',
'amul-protein-lassi-rose':'Amul High Protein Rose Lassi',
'amul-protein-lassi-plain':'Amul High Protein Plain Lassi',
'amul-protein-buttermilk':'Amul High Protein Buttermilk',
'amul-protein-blueberry-shake':'Amul High Protein Blueberry Shake',
'amul-kool-protein-vanilla':'Amul Kool Protein Milkshake, Vanilla',
'amul-kool-protein-kesar':'Amul Kool Protein Milkshake, Kesar',
'amul-kool-protein-coffee':'Amul Kool Protein Milkshake, Arabica Coffee',
'amul-kool-protein-chocolate':'Amul Kool Protein Milkshake, Chocolate',
'amul-high-protein-paneer':'Amul High Protein Paneer',
'amul-high-protein-milk':'Amul High Protein Milk',
'amul-cow-milk':'Amul Cow Milk',
'amul-gold-milk':'Amul Gold Full Cream Milk, Pouch',
'pintola-crunchy-peanut-butter':'Pintola Classic Peanut Butter, Crunchy',
'muscleblaze-mass-gainer-xxl':'MuscleBlaze Mass Gainer XXL, Chocolate',
'gnc-yeast-protein':'GNC Select Fermented Yeast Protein, Chocolate',
'amul-taaza-toned-milk':'Amul Taaza Toned Milk, Pouch',
'asitis-soy-isolate':'AS-IT-IS ONE Soy Protein Isolate, Unflavoured',
'whole-truth-whey-cocoa':'The Whole Truth Whey Protein (Isolate + Concentrate), Light Cocoa',
'muscleblaze-biozyme-whey':'MuscleBlaze Biozyme Performance Whey, Rich Chocolate',
'saffola-masala-oats':'Saffola Masala Oats, Classic Masala',
'nutrela-soya-chunks':'Nutrela, Soya Chunks',
'amul-shakti-milk':'Amul Shakti Milk',
'ritebite-max-protein-bar':'RiteBite Daily Protein Bar (10g protein), Choco Almond',
'maaza':'Maaza, Original Mango',
'thums-up':'Thums Up, Original',
}
byname={n['name']:n for n in new}
for k,v in REPL.items():
  assert k in existing,k
  assert v in byname,v
assert len(set(REPL.values()))==len(REPL)
oldfor={v:k for k,v in REPL.items()}
used=set(existing)
def slug(s):
  s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
  s=re.sub(r'[^a-z0-9]+','-',s).strip('-'); return s[:60].rstrip('-')
PIECE={'bar':('bar','bars'),'pack':('pack','packs'),'wafer':('wafer','wafers'),'can':('can','cans'),'cookie':('cookie','cookies'),'cup':('cup','cups'),'sachet':('sachet','sachets')}
def category(n,unit):
  nm=n['name'].lower(); k=n['kind']
  if k=='bar' or re.search(r'\b(bar|wafer|minis|cookie|chips|bites|crisps|puffs)\b',nm): return 'snack'
  if re.search(r'plant protein|yeast protein|pea protein|soy protein',nm): return 'drink'
  if k=='icecream': return 'sweet'
  if unit=='ml' or k=='powder' or re.search(r'whey|isolate|protein powder|gainer|\b(lassi|buttermilk|milkshake|shake|chaas)\b',nm): return 'drink'
  if 'paneer' in nm: return 'paneer'
  if k=='dairy': return 'dairy'
  if re.search(r'oats|muesli|granola|flakes|cereal',nm): return 'breakfast'
  if k=='other' and re.search(r'chocolate|kitkat|dairy milk|silk',nm): return 'sweet'
  return 'basic'
def fibre(notes):
  m=re.search(r'fib(?:re|er)\s*(?:[:=]\s*)?(\d+(?:\.\d+)?)\s*g',notes,re.I); return float(m.group(1)) if m else None
rows=[];repl_rows=[]
for n in new:
  sv=n['serving'].strip()
  m=re.match(r'^(\d+(?:\.\d+)?)\s*(g|ml)\b\s*(.*)$',sv)
  amt=float(m.group(1)); unit=m.group(2); suffix=m.group(3).strip().lower()
  piece=None
  if suffix:
    key=suffix.split()[-1]; nm=PIECE.get(key,(suffix,suffix+'s')); piece=(amt,list(nm))
  elif amt!=100:
    if n['kind']=='powder' or re.search(r'whey|protein powder|gainer|isolate|concentrate',n['name'],re.I): piece=(amt,['scoop','scoops'])
    elif unit=='ml': piece=(amt,['pack','packs'])
    else: piece=(amt,['serving','servings'])
  else:
    pm=re.search(r'(\d+(?:\.\d+)?)\s?(g|ml)\s+(glass bottle|PET bottle|bottle|pack|cup|bar|tetra|can|pouch|sachet|tub)\b',n['notes'],re.I)
    if pm and float(pm.group(1))!=100 and 5<=float(pm.group(1))<=1000:
      word=pm.group(3).lower().split()[-1]; word={'tetra':'pack'}.get(word,word)
      piece=(float(pm.group(1)),[word,word+'s' if not word.endswith('ch') else word+'es'])
  if not piece and re.search(r'(peanut|almond|cashew|nut) (butter|spread)|\bspread\b',n['name'],re.I) and unit=='g':
    # A label serving is about one tablespoon (16 g) for nut butters; the numbers stay per 100 g.
    piece=(16.0,['tablespoon','tablespoons'])
  name=n['name']
  oid=oldfor.get(name)
  if oid: fid=oid
  else:
    fid='b-'+slug(name); base=fid;i=2
    while fid in used: fid=f'{base}-{i}';i+=1
  used.add(fid)
  fb=fibre(n['notes'])
  note=n['notes'] if n['flag'] else None
  row=[fid,name,n['brand'],category(n,unit),n['kcal'],n['p'],n['c'],n['f'],fb,n['sugar'],amt,unit,piece[0] if piece else None,piece[1] if piece else None,n['flag'],note,1 if n['calc'] else 0]
  (repl_rows if oid else rows).append(row)
import os
D='/home/claude/wl-r2/src/data/library/branded'
os.makedirs(D,exist_ok=True)
with open(D+'/rows.json','w') as f:
  f.write('[\n'+',\n'.join(json.dumps(r,ensure_ascii=False,separators=(',',':')) for r in rows)+'\n]\n')
with open(D+'/replaced.ts','w') as f:
  f.write("// Generated by scripts/branded-foods.py from the Branded Food Macro Database (November 2026).\n// Products that replace an older label of the same product: they keep the old id, so recent\n// foods and usual meals still find them, and they stay in the main bundle like before.\nimport type { BrandedRow } from './types';\n\nexport const REPLACED_ROWS: BrandedRow[] = [\n")
  for r in repl_rows: f.write('  '+json.dumps(r,ensure_ascii=False)+',\n')
  f.write('];\n\nexport const REPLACED_IDS = new Set(REPLACED_ROWS.map((r) => r[0]));\n')
json.dump({'kept':len(rows)+len(repl_rows),'replaced':len(repl_rows)},open('summary.json','w'))
print(len(rows),'lazy',len(repl_rows),'replaced')
