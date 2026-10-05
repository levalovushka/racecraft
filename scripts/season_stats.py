import json, statistics as st, collections
R=[r for r in json.load(open('data/races.json')) if (r['id'].startswith('premium') or r['id'].startswith('drive')) and len(r['pits'])>=6 and len(r['pits'])==2*len(r['drivers'])]
print('races',len(R))
def model(r):
    names=[d['name'] for d in r['drivers']]; idx={n:i for i,n in enumerate(names)}
    nl=max(map(int,r['laps']))
    seq={i:[(1,r['drivers'][i]['kart0'])] for i in range(len(names))}
    pitlaps=collections.defaultdict(set)
    for p in r['pits']:
        i=idx.get(p['driver']); 
        if i is None: return None
        seq[i].append((p['lap']+1,p['to'])); pitlaps[i].add(p['lap'])
    def kart_at(i,l):
        k=None
        for s,kk in seq[i]:
            if l>=s: k=kk
        return k
    obs=[]
    for l,row in r['laps'].items():
        l=int(l)
        if l<=1: continue
        for i,(t,pc) in enumerate(row):
            if t is None or pc or l in pitlaps[i] or (l-1) in pitlaps[i]: continue
            obs.append((i,kart_at(i,l),t))
    # robust filter per driver
    byd=collections.defaultdict(list)
    for i,k,t in obs: byd[i].append(t)
    med={i:st.median(v) for i,v in byd.items()}
    obs=[o for o in obs if o[2]<med[o[0]]*1.04]
    D=collections.defaultdict(float); K=collections.defaultdict(float)
    for _ in range(30):
        s=collections.defaultdict(list)
        for i,k,t in obs: s[i].append(t-K[k])
        D={i:st.mean(v) for i,v in s.items()}
        s=collections.defaultdict(list)
        for i,k,t in obs: s[k].append(t-D[i])
        K={k:st.mean(v) for k,v in s.items()}
        m=st.mean(K.values()); K={k:v-m for k,v in K.items()}
    cnt=collections.Counter(k for _,k,_ in obs)
    return dict(K=K,cnt=cnt,seq=seq,pitlaps=pitlaps,idx=idx,nl=nl)
spreads=[];stint_rows=[];waits=[];pitlap_hist=collections.Counter();adv=[];stamp=[]
for r in R:
    m=model(r)
    if not m: print('skip',r['id']); continue
    K={k:v for k,v in m['K'].items() if m['cnt'][k]>=8}
    if len(K)<5: continue
    vals=sorted(K.values()); spreads.append((r['id'],st.pstdev(vals),vals[-1]-vals[0],vals[1]-vals[0] if len(vals)>1 else 0))
    # pit lap time (row value at pit lap)
    names=[d['name'] for d in r['drivers']]
    pl=[]
    for p in r['pits']:
        i=m['idx'][p['driver']]; t=r['laps'][str(p['lap'])][i][0] if str(p['lap']) in r['laps'] else None
        if t: pl.append((p,t))
    mn=min(t for _,t in pl)
    for p,t in pl: waits.append(t-mn); pitlap_hist[p['lap']*60//m['nl']]+=1
    # stint length vs kart effect (adverse selection: what drivers drop and when)
    for i,s in m['seq'].items():
        ends=[x[0]-1 for x in s[1:]]+[m['nl']]
        for (st0,k),e in zip(s,ends):
            if k in K: stint_rows.append((e-st0+1,K[k],st0==1, e==m['nl']))
    # box quality: front kart vs fleet
    rank={k:sorted(K,key=K.get).index(k) for k in K}  # 0 = fastest
    prev=None
    for j,p in enumerate(r['pits']):
        got=p['to']
        if got in K: adv.append(('taken_from_box',rank[got]/(len(K)-1)))
        if p['frm'] in K: adv.append(('dropped',rank[p['frm']]/(len(K)-1)))
    # stampede: when a top-3 kart is deposited, how many pits / seconds until taken, and pits in the 60s after it reached front
    top3=set(sorted(K,key=K.get)[:3])
    for j,p in enumerate(r['pits']):
        if p['frm'] in top3:
            for jj in range(j+1,len(r['pits'])):
                if r['pits'][jj]['to']==p['frm']:
                    q=r['pits'][jj]; front_t=r['pits'][j+1]['t'] if j+1<len(r['pits']) else None
                    # pits within 60s after the one that took it
                    crowd=sum(1 for x in r['pits'][jj+1:] if x['t']-q['t']<=60)
                    stamp.append(dict(race=r['id'],wait_pits=jj-j,wait_s=q['t']-p['t'],front_to_taken=(q['t']-front_t) if front_t else None,lap=p['lap'],crowd=crowd))
                    break
            else: stamp.append(dict(race=r['id'],wait_pits=None,lap=p['lap']))
print('\nKART SPREAD per race (s/lap): median SD %.3f, median range %.3f, median gap best-2nd %.3f'%(st.median(x[1] for x in spreads),st.median(x[2] for x in spreads),st.median(x[3] for x in spreads)))
print('range quantiles', [round(x,2) for x in st.quantiles([x[2] for x in spreads],n=4)])
w=sorted(waits); print('\nPIT LAP excess over race-min (s): quantiles',[round(x,1) for x in st.quantiles(w,n=10)], ' share >5s %.0f%%, >10s %.0f%%'%(100*sum(x>5 for x in w)/len(w),100*sum(x>10 for x in w)/len(w)))
print('\nPIT TIMING by race-progress (60ths):'); 
for b in range(0,60,3): print('%2d-%2d %s'%(b,b+2,'#'*sum(pitlap_hist[x] for x in range(b,b+3))))
# stint length vs kart effect
mid=[x for x in stint_rows if not x[3]]
for lo,hi in [(1,11),(12,15),(16,22),(23,30),(31,60)]:
    v=[x[1] for x in stint_rows if lo<=x[0]<=hi and not x[3]]
    if v: print('stint %2d-%2d laps (not final): n=%3d mean kart effect %+.3f'%(lo,hi,len(v),st.mean(v)))
for lab in ('taken_from_box','dropped'):
    v=[x[1] for x in adv if x[0]==lab]; print(lab,'mean rank pct (0=fastest) %.2f n=%d'%(st.mean(v),len(v)))
ok=[s for s in stamp if s.get('wait_pits')]
print('\nTOP-3 KART DEPOSITED: n=%d, never taken %d'%(len(stamp),len(stamp)-len(ok)))
print(' pits until taken:',collections.Counter(s['wait_pits'] for s in ok))
print(' seconds deposit->taken median %.0f, quantiles %s'%(st.median(s['wait_s'] for s in ok),[round(x) for x in st.quantiles([s['wait_s'] for s in ok],n=4)]))
ft=[s['front_to_taken'] for s in ok if s['front_to_taken'] is not None and s['wait_pits']>=2]
print(' seconds from reaching front -> taken: median %.0f, q %s'%(st.median(ft),[round(x) for x in st.quantiles(ft,n=4)]))
print('\n--- extra ---')
# stampede: pits within 45s after a top-3 kart becomes front vs baseline pits per 45s
crowd=[];base=[]
for r in R:
    m=model(r)
    if not m: continue
    K={k:v for k,v in m['K'].items() if m['cnt'][k]>=8}
    if len(K)<5: continue
    top3=set(sorted(K,key=K.get)[:3]); P=r['pits']
    for j in range(len(P)-1):
        front=P[j]['box'][-1] if P[j]['box'] else None
        n=sum(1 for x in P[j+1:] if x['t']-P[j]['t']<=45)
        (crowd if front in top3 else base).append(n)
print('pits in 45s after previous pit: front=top3 mean %.2f (n=%d) vs other %.2f (n=%d)'%(st.mean(crowd),len(crowd),st.mean(base),len(base)))
