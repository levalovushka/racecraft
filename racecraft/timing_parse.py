import re, json, glob, os
def t2s(x):
    x=x.strip()
    if not x: return None
    if ':' in x:
        m,s=x.split(':'); return int(m)*60+float(s)
    try: return float(x)
    except: return None
def hms(x):
    h,m,s=map(int,x.split(':')); return h*3600+m*60+s
def parse(path):
    s=open(path).read()
    title=re.search(r'<title>(.*?)</title>',s,re.S).group(1).strip()
    thead=s[s.find('<thead>'):s.find('</thead>')]
    names=re.findall(r'<a href="/tracks/\w+/drivers/(\d+)">([^<]*)</a>',thead)
    karts=re.findall(r'<span class="badge bg-secondary kart">(\d+)</span>',thead)
    n=len(karts); names=names[:n]
    tb=s[s.find('<tbody>'):s.find('</tbody>')]
    laps={}
    for row in re.findall(r'<tr>\s*<th scope="row">(\d+)</th>(.*?)</tr>',tb,re.S):
        ln=int(row[0])
        cells=re.findall(r'<td nowrap class="text-center ?([^"]*)">\s*([0-9:.]*)',row[1])
        laps[ln]=[(t2s(t), 'pitstop' in c) for c,t in cells]
    pits=[]
    ph=s.find('id="pitsHistory"')
    if ph>0:
        body=s[ph:]
        for r in re.findall(r'<tr>\s*<th scope="row">(\d+)</th>\s*<td>([\d:]+)</td>\s*<td>([^<]*)</td>(.*?)</tr>',body,re.S):
            ks=re.findall(r'kart">(\d+)<',r[3])
            pits.append(dict(lap=int(r[0]),t=hms(r[1]),driver=r[2].strip(),frm=int(ks[0]),to=int(ks[1]),box=[int(k) for k in ks[2:]]))
    return dict(id=os.path.basename(path)[:-5],title=title,drivers=[{'id':int(i),'name':nm.strip(),'kart0':int(k)} for (i,nm),k in zip(names,karts)],laps=laps,pits=pits)
if __name__=='__main__':
    out=[]
    for p in sorted(glob.glob('data/heats/*.html')):
        try:
            r=parse(p); out.append(r)
        except Exception as e: print('ERR',p,e)
    json.dump(out,open('data/races.json','w'),ensure_ascii=False)
    for r in out[:100]:
        print(r['id'],len(r['drivers']),len(r['laps']),len(r['pits']),r['title'][:50])
