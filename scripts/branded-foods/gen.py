import json,re,unicodedata
new=json.load(open('clean.json'))
skipped=json.load(open('skipped.json'))
# Products the database lists without a value the app needs. The owner asked for them anyway
# (21 Nov 2026), with approximate numbers: each is worked out from the values the source does
# list (energy left after the listed macros) or from a sister product of the same brand, and
# the food page says the numbers are estimated. (kcal, protein, carbs, fat, how)
ESTIMATES={
 'MuscleBlaze Yeast Protein Isolate, Cafe Mocha':(149.76,26,6.49,2.2,'carbs and fat from the Rich Chocolate flavour'),
 'AS-IT-IS ATOM Whey Isolate, Mango Delight':(128.5,30,1,0.5,'calories from its listed macros'),
 'GNC Select Fermented Yeast Protein, Coffee':(140.37,25,6.02,2.03,'calories, carbs and fat from the Chocolate flavour'),
 'GNC Select Fermented Yeast Protein, Vanilla':(140.37,25,6.02,2.03,'calories, carbs and fat from the Chocolate flavour'),
 'Guru Mann 3 Ingredients Fermented Yeast Protein, Vanilla':(119,26.3,2.31,0.5,'calories, carbs and fat from the Cocoa flavour'),
 'Amul Probiotic High Protein Curd':(68,6,10.6,0.1,'carbs from the calories left after protein and fat'),
 'Amul Pure Milk Cheese Block':(311,20,1.5,25,'fat from the calories left after protein and carbs'),
 'Amul Irish Drink Shot':(112,3,15,4.4,'carbs and fat split 60:40 from the calories left after protein'),
 'Amul High Protein Cubes':(150,25,7.5,2.2,'carbs and fat split 60:40 from the calories left after protein'),
 'Country Delight High Protein Paneer':(204,30,4.8,7.2,'calories, carbs and fat in the proportions of other high protein paneer'),
 'Country Delight 10g Protein Taaza Jeera Chaach':(44,4,4.2,1.2,'carbs and fat split 60:40 from the calories left after protein'),
 'Country Delight 10g Protein Mango Lassi':(84,4,10.2,3,'carbs and fat split 60:40 from the calories left after protein'),
 'Heritage Plain Greek Yogurt':(77.4,8,6.8,2,'carbs and fat split 60:40 from the calories left after protein'),
 "Saffola 0% Added Sugar Muesli, Berry Crunch":(405,11.25,67.5,10,'fat from the other Saffola mueslis, carbs from the calories left'),
 'RiteBite RTD Protein Milkshake, Coffee Crush':(171,26,10,3,'calories, carbs and fat typical of a 26 g protein ready-to-drink shake'),
 'RiteBite Max Protein Peanut Butter, Choco Creamy':(608,20,19,50.2,'fat from the calories left after protein and carbs'),
 'SuperYou Protein Wafer Bar (10g protein), Coffee':(177.7,10,13.5,9.3,'carbs from the calories left after protein and fat'),
 'SuperYou Protein Wafer Bar (10g protein), Cookies & Cream':(180.4,10,13.5,9.6,'carbs from the Coffee wafer, fat from the calories left'),
 'SuperYou Power Puffs (8g protein), Pizza Party':(147,8,17.4,5.2,'calories, carbs and fat from the Chilli Masala pack, by weight'),
 'SuperYou Power Puffs (13g protein), Chilli Masala':(245,13,29,8.6,'carbs and fat split 60:40 from the calories left after protein'),
 'The Whole Truth Snackbar, Mixed Fruit':(162.7,4.3,19.7,7.4,'protein from the calories left after carbs and fat'),
}

for x in skipped:
  if x['name'] in ESTIMATES:
    k,p,c,f,how=ESTIMATES[x['name']]
    x.update(kcal=k,p=p,c=c,f=f,flag='estimate',notes=how[0].upper()+how[1:]+'.',calc=False)
    new.append(x)
  elif x['serving'] in ('Cup','Cone'):
    # Per cup or cone as sold; no weight is printed, so they are logged by the cup only.
    x.update(flag=None,servingOnly=True)
    new.append(x)
assert len(new)==849, len(new)
existing={e['id']:e for e in json.load(open('existing.json'))}
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
  if n.get('servingOnly'):
    word=sv.lower()
    row=[None,n['name'],n['brand'],'sweet',n['kcal'],n['p'],n['c'],n['f'],None,n['sugar'],100.0,'g',100.0,[word,word+'s'],None,None,1 if n['calc'] else 0,1]
    fid='b-'+slug(n['name']); used.add(fid); row[0]=fid; rows.append(row); continue
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
  row=[fid,name,n['brand'],category(n,unit),n['kcal'],n['p'],n['c'],n['f'],fb,n['sugar'],amt,unit,piece[0] if piece else None,piece[1] if piece else None,n['flag'],note,1 if n['calc'] else 0,0]
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
