import json,re,collections,unicodedata
rows=json.load(open('rows.json'))
BRANDS={
 'MuscleBlaze':('MuscleBlaze',['mb','muscle blaze']),
 'Naturaltein':('Naturaltein',['natural tein']),
 'Beast Life':('Beast Life',['beastlife']),
 'Avvatar':('Avvatar',['avatar','avvtar']),
 'Nakpro':('Nakpro',['nak pro']),
 'FuelOne':('FuelOne',['fuel one']),
 'Optimum Nutrition (ON)':('Optimum Nutrition',['on','optimum']),
 'The Whole Truth':('The Whole Truth',['twt','whole truth']),
 'TrueBasics':('TrueBasics',['true basics']),
 'SuperYou':('SuperYou',['super you']),
 "Only What's Needed (OWN)":("Only What's Needed",['own','only whats needed']),
 'AS-IT-IS ATOM':('AS-IT-IS',['asitis','as it is']),
 'Nutrabay':('Nutrabay',['nutra bay']),
 'GNC':('GNC',[]),
 'Guru Mann Nutrition':('Guru Mann',['gurumann','gmn']),
 'Amul':('Amul',[]),
 'Milky Mist':('Milky Mist',['milkymist']),
 'Epigamia':('Epigamia',[]),
 'Country Delight':('Country Delight',['countrydelight','cd']),
 'Heritage':('Heritage',[]),
 'Nandini':('Nandini',[]),
 'Yoga Bar':('Yoga Bar',['yogabar']),
 'Pintola':('Pintola',[]),
 'Alpino':('Alpino',[]),
 'MyPB':('MyPB',['my pb']),
 "Doctor's Choice":("Doctor's Choice",['doctors choice']),
 'GOAT Life':('GOAT Life',['goatlife']),
 "Bagrry's":("Bagrry's",['bagrys','bagrry']),
 'Saffola':('Saffola',[]),
 'RiteBite Max Protein':('RiteBite',['rite bite','max protein']),
 'Phab':('Phab',[]),
 'Get-A-Way':('Get-A-Way',['getaway','get a way']),
 'Go Zero':('Go Zero',['gozero']),
 'Amul Chocolates':('Amul',[]),
 'Dabur Real':('Dabur',['real juice']),
 'Tropicana':('Tropicana',[]),
 'Cadbury Dairy Milk':('Cadbury',['dairy milk']),
 'Nestlé KitKat':('Nestlé',['nestle']),
 'Nutrabay (Oats)':('Nutrabay',[]),
 'MillD':('MillD',['mill d']),
}
MULTI_PREFIX=[('TrueBasics',''),('Nakpro',''),('Naturaltein',''),('Nutrabay',''),('AS-IT-IS',''),
  ('Coca-Cola',''),('Thums Up',''),('Sprite',''),('Pepsi',''),('7UP',''),('Mountain Dew',''),('Frooti',''),('Maaza',''),('Slice',''),
  ('Red Bull',''),('Sting Energy',''),('Monster Energy',''),('Nutrela',''),('Fortune',''),('Saffola',''),('Pro Nature','')]
CAT_KIND={'Protein Powders (Whey, Yeast, Plant & Soy)':'powder','Dairy Products':'dairy','Oats, Muesli, Peanut Butter & More':'pantry',
 'Protein Bars, Wafers & Chips':'bar','Protein Ice Cream':'icecream','Others (Chocolates, Beverages & More)':'other'}
def num(v):
  if v in('–','-',''): return None
  v=v.replace('†','').replace('*','').lstrip('<≈~>')
  if '–' in v: return float(v.split('–')[1])
  return float(v)
def clean(s): return re.sub(r'\s+',' ',(s or '').replace('⚠','')).strip()
out=[];skipped=[]
for r in rows:
  g=r['brand']; prod=clean(r['product']); var=clean(r['variant'])
  if var in('—','-'): var=''
  if g in BRANDS: brand,al=BRANDS[g]
  else:
    brand=next((b for b,_ in MULTI_PREFIX if prod.startswith(b)),None); al=[]
    if not brand: raise SystemExit('no brand '+prod)
  name=prod if prod.lower().startswith(brand.lower()) or (brand=='Cadbury' and False) else f'{brand} {prod}'
  if g=='Dabur Real': name='Dabur '+prod
  if var: name=f'{name}, {var}'
  kcal,p,c,f,s=(num(r[k]) for k in('kcal','p','c','f','sugar'))
  notes=clean(r.get('notes',''))
  rec=dict(name=name,brand=brand,group=g,cat=r['cat'],kind=CAT_KIND[r['cat']],serving=r['serving'],kcal=kcal,p=p,c=c,f=f,sugar=s,notes=notes,
    flag=('conflict' if '⚠' in (r['product']+r.get('notes','')) else 'check' if 'Check pack' in notes else None),
    calc='†' in r['kcal'], approx=any(x in r[k] for k in('kcal','p','c','f') for x in '≈~'),page=r['page'])
  why=None
  if kcal is None or p is None: why='calories or protein not listed'
  elif c is None or f is None: why='carbs or fat not listed'
  elif not re.match(r'^\d',r['serving']): why='serving has no weight ('+r['serving']+')'
  if why: rec['skip']=why; skipped.append(rec)
  else: out.append(rec)
json.dump(out,open('clean.json','w'),indent=1,ensure_ascii=False)
json.dump(skipped,open('skipped.json','w'),indent=1,ensure_ascii=False)
print(len(out),'kept',len(skipped),'skipped')
print(collections.Counter(s['skip'] for s in skipped))
names=collections.Counter(o['name'].lower() for o in out)
print('dupe names',[n for n,c in names.items() if c>1])
