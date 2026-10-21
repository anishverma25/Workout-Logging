# Writes src/data/library/indbFoods.json from the Indian Nutrient Databank (Vijayakumar et al. 2024).
# Usage: python3 scripts/indb-foods.py <folder with INDB.xlsx, recipes.xlsx, recipes_servingsize.xlsx>
import openpyxl, json, re, sys
R=sys.argv[1].rstrip('/')+'/'
def rows(f):
    wb=openpyxl.load_workbook(R+f,read_only=True); ws=wb.active
    it=ws.iter_rows(values_only=True); h=next(it); return h,[dict(zip(h,r)) for r in it]
_,indb=rows('INDB.xlsx')
_,rec=rows('recipes.xlsx')
_,serv=rows('recipes_servingsize.xlsx')
ings={}
for r in rec: ings.setdefault(r['recipe_code'],[]).append(str(r['food_name'] or '').lower()+' '+str(r['ingredient_name_org'] or '').lower())
units={r['recipe_code']:str(r['servings_unit'] or '').lower() for r in serv}
NONVEG=re.compile(r'chicken|mutton|lamb|goat|beef|pork|fish|prawn|shrimp|crab|meat|keema|kheema|liver|ham\b|bacon|sausage|tuna|salmon|squid|lobster|mackerel|pomfret|sardine|rohu|hilsa')
EGG=re.compile(r'\begg')
JAINX=re.compile(r'onion|garlic|potato|carrot|radish|beet|ginger|sweet potato|yam|colocasia|arbi')
OKFAT=re.compile(r'chutney|powder|masala|ladoo|laddu|halwa|barfi|burfi|nut|butter|ghee|oil|dressing|mayonnaise|chikki|paste|pesto|seeds|coconut|cream|dip|sauce|chocolate|cookies|biscuit|pastry|cake')
out=[]; dropped=[]
for r in indb:
    name=str(r['food_name']).strip()
    lname=name.lower()
    try: kcal,p,c,f,fib=[float(r[k] or 0) for k in ('energy_kcal','protein_g','carb_g','fat_g','fibre_g')]
    except: continue
    if kcal<=0: dropped.append((name,'zero')); continue
    if re.search(r'baghar|tadka\)|powder|\(masala\)| masala\b$',lname) and kcal>250: dropped.append((name,'spice')); continue
    if f>40 and not OKFAT.search(lname): dropped.append((name,'frying oil counted')); continue
    at=4*p+4*max(0,c-fib)+2*fib+9*f
    if abs(at/kcal-1)>0.2: dropped.append((name,'energy mismatch')); continue
    text=' '.join(ings.get(r['food_code'],[]))+' '+lname
    diet='nonveg' if NONVEG.search(text) else 'egg' if EGG.search(text) else 'veg'
    jain= diet=='veg' and not JAINX.search(text)
    u=units.get(r['food_code'],'')
    liquid=re.search(r'glass|cup|tea cup',u) is not None
    out.append([r['food_code'],name,round(kcal,1),round(p,1),round(c,1),round(f,1),round(fib,1),diet,1 if jain else 0,1 if liquid else 0])
print(len(out),'kept',len(dropped),'dropped', file=sys.stderr)
from collections import Counter
print(Counter(d[1] for d in dropped), file=sys.stderr)
json.dump(out, open(sys.argv[2] if len(sys.argv) > 2 else 'src/data/library/indbFoods.json','w'), ensure_ascii=False, separators=(',',':'))
