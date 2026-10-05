"""Premium: lap time, pit loss and phase shift per stage (ГГ 2024-25 and 2025-26).

Usage: python3 scripts/stage_stats.py   (needs data/races.json from racecraft/timing_parse.py)

Season is told apart by heat id (2025-26 heats are > 90000), stage by the title.
Pit loss = (pit lap - clean lap) + (lap after pit - clean lap).
Phase shift = clean lap - pit loss: a driver who pits from right behind a rival
rejoins this many seconds AHEAD of him on the road (and loss seconds behind in race time).
"""
import json, re, collections, statistics as st

DIRECTION_2526 = {'1': 'std', '3': 'rev', '5': 'std'}


def stage_of(title):
    t = title.replace('PitStop', '').replace('Пит-Стоп', '')
    if 'группа H' in t:
        return '3'
    m = re.search(r'(\d)\s*[A-JА-Яa-z]', t)
    return m.group(1) if m else '?'


def main():
    races = [r for r in json.load(open('data/races.json')) if r['id'].startswith('premium')]
    g = collections.defaultdict(lambda: collections.defaultdict(list))
    for r in races:
        season = '25-26' if int(r['id'].split('-')[1]) > 90000 else '24-25'
        G = g[(season, stage_of(r['title']))]
        G['races'].append(r['id'])
        idx = {d['name']: i for i, d in enumerate(r['drivers'])}
        pits = collections.defaultdict(set)
        for p in r['pits']:
            pits[idx.get(p['driver'])].add(p['lap'])
        clean = []
        for l, row in r['laps'].items():
            l = int(l)
            for i, (t, pc) in enumerate(row):
                if not t or l == 1:
                    continue
                if pc or l in pits[i]:
                    G['pit'].append(t)
                elif l - 1 in pits[i]:
                    G['after'].append(t)
                elif l - 2 not in pits[i]:
                    clean.append(t)
        med = st.median(clean)
        G['clean'] += [t for t in clean if t < med * 1.04]

    print('season stage dir              races  lap    pit-lap  after  loss  loss/lap  phase')
    for k in sorted(g):
        G = g[k]
        lap, pit, after = st.median(G['clean']), st.median(G['pit']), st.median(G['after'])
        loss = pit + after - 2 * lap
        d = DIRECTION_2526.get(k[1], '?') if k[0] == '25-26' else '?'
        print(f'{k[0]}  {k[1]}     {d:16s} {len(G["races"]):3d}   {lap:.2f}  {pit - lap:+6.2f}  {after - lap:+5.2f}  '
              f'{loss:4.1f}  {loss / lap:6.2f}   {lap - loss:+4.1f}')


if __name__ == '__main__':
    main()
