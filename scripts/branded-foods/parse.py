import pdfplumber, json, re
NUM=re.compile(r"^(–|-|[<≈~>]?\d+(\.\d+)?(–\d+(\.\d+)?)?[†*]?)$")
out=[]; brands=[]
cat=None
b0=None
with pdfplumber.open('branded.pdf') as pdf:
  for pi,page in enumerate(pdf.pages):
    pno=pi+1
    if pno<5: continue
    words=page.extract_words(keep_blank_chars=False,use_text_flow=False,extra_attrs=['size'])
    lines={}
    for w in words:
      key=round(w['top'])
      # merge tops within 2px
      k=next((t for t in lines if abs(t-w['top'])<2.5),None)
      if k is None: k=w['top']; lines[k]=[]
      lines[k].append(w)
    tops=sorted(lines)
    text={t:' '.join(w['text'] for w in sorted(lines[t],key=lambda w:w['x0'])) for t in tops}
    if any('Data-quality log' in text[t] and lines[t][0]['size']>14 for t in tops): 
      print('log starts page',pno); break
    cols=None; brand=None; block=[]
    def flush():
      global out, b0
      if not block: return
      data=[b for b in block if b['data']]
      for d in data: d['cells']={k:[(d['top'],v)] for k,v in d['own'].items() if v}
      for b in block:
        if b['data']: continue
        near=min(data,key=lambda d:abs(d['top']-b['top']))
        for k,v in b['own'].items():
          if v: near['cells'].setdefault(k,[]).append((b['top'],v))
      for d in data:
        c={k:' '.join(v for _,v in sorted(vs)) for k,vs in d['cells'].items()}
        out.append(dict(page=pno,cat=cat,brand=b0,**c))
      block.clear()
    prev=None
    for t in tops:
      ws=sorted(lines[t],key=lambda w:w['x0'])
      tx=text[t]
      prevline=prev; prev=tx
      if t<45 or tx.startswith('P = protein'): continue
      if re.search(r'\d+ products · \d+ brands?$',tx):
        flush(); cat=prevline; continue
      if re.fullmatch(r'\(\d+\)',tx) and brands and brands[-1][1] is None:
        brands[-1][1]=int(tx[1:-1]); continue
      if ws[0]['x0']<42 and ws[0]['size']>=12:
        flush(); b0=re.sub(r'\s*\(\d+\)$','',tx).strip(); m=re.search(r'\((\d+)\)$',tx)
        brands.append([b0,int(m.group(1)) if m else None,cat]); continue
      if tx.startswith('Product Variant'):
        flush()
        xs={w['text']:w['x0'] for w in ws}
        cols=dict(variant=xs['Variant'],serving=324,kcal=xs['kcal'],notes=xs['Notes']); continue
      if tx in('Serving /','basis'): continue
      if not cols: continue
      own={'product':[], 'variant':[], 'mid':[], 'notes':[]}
      for w in ws:
        x=w['x0']
        if x<cols['variant']-3: own['product'].append(w['text'])
        elif x<cols['serving']-3: own['variant'].append(w['text'])
        elif x<cols['notes']-3: own['mid'].append(w['text'])
        else: own['notes'].append(w['text'])
      mid=own['mid']
      isdata=len(mid)>=6 and all(NUM.match(m) for m in mid[-5:])
      rec={'top':t,'data':isdata}
      if isdata:
        rec['own']={'product':' '.join(own['product']),'variant':' '.join(own['variant']),'serving':' '.join(mid[:-5]),'kcal':mid[-5],'p':mid[-4],'c':mid[-3],'f':mid[-2],'sugar':mid[-1],'notes':' '.join(own['notes'])}
      else:
        rec['own']={'product':' '.join(own['product']),'variant':' '.join(own['variant']),'notes':' '.join(own['notes']),'serving':' '.join(mid)}
      block.append(rec)
    flush()
json.dump(out,open('rows.json','w'),indent=1,ensure_ascii=False)
json.dump(brands,open('brands.json','w'),ensure_ascii=False)
print(len(out),'rows;',sum(n for _,n,_ in brands),'expected;',len(brands),'brand headings')
