"""Build a track config for the simulator from an SVG.

Usage: python3 scripts/build_track.py tracks/premium.svg tracks/premium-std.json

SVG contract (see docs/SIMULATOR.md):
  racing line        closed path, the lap reference (drawn in REVERSE direction for Premium)
  pitlane            filled ribbon; its two straight end edges are where it joins the track
  start/fimish       line across the track (id as exported from Figma)
  overtake zone *    filled shapes over the racing line
  track              filled ribbon, used to cut off the part of the pit lane drawn under it

Output: polyline in race direction starting at the timing line, speed profile,
markers as lap fractions s in [0,1), pit lane centerline.
Absolute scale is unknown, so it is solved so that the lap takes LAP_TIME.
Pit loss is reported twice: from data (PIT_LOSS, used by the engine) and from
a physical estimate on this geometry (braking to the box, standing, accelerating
away, compared with staying on track).
"""
import json, sys
import numpy as np
from svgpathtools import svg2paths, Line

# race / calibration targets (Premium, ГГ 2025-26 data, see docs/MECHANICS.md)
LAP_TIME = 30.0      # s, typical clean lap
PIT_LOSS = 28.0      # s, pit lap + next lap minus two clean laps, no waiting under red
STOP_TIME = 25.0     # s, minimal stop, counted from the button press at the box, reg. 10.9
REACTION = 0.4       # s, from green / manager's go to moving
PIT_OUT_MAX_S = 0.18 # driver rejoins before the first corner (the drawn lane runs into it)
DIRECTION = -1       # standard direction runs against the drawn racing line
DECISION_S = 0.97    # last point to commit to pit entry, lap fraction from the line
BOX_AT = 0.10        # box/light position along the pit lane (traffic light right after entry)

# kart dynamics (rental Sodi SR5 / Rimo Evo6, rough)
A_LAT = 13.0         # m/s^2 lateral grip
A_ACC = 2.8          # m/s^2 acceleration
A_BRK = 8.0          # m/s^2 braking
V_MAX = 18.0         # m/s

N = 1000             # samples per lap


def resample(pts, n, closed):
    seg = np.hypot(*np.diff(np.vstack([pts, pts[:1]]) if closed else pts, axis=0).T)
    cum = np.r_[0, np.cumsum(seg)]
    total = cum[-1]
    u = np.linspace(0, total, n, endpoint=not closed)
    src = np.vstack([pts, pts[:1]]) if closed else pts
    return np.c_[np.interp(u, cum, src[:, 0]), np.interp(u, cum, src[:, 1])], total


def path_points(path, n):
    pts = np.array([[path.point(t).real, path.point(t).imag] for t in np.linspace(0, 1, n * 4)])
    return pts


def radius(pts, k=6):
    """Curvature radius of a closed polyline over a +-k sample chord."""
    a, b, c = np.roll(pts, k, 0), pts, np.roll(pts, -k, 0)
    ab, bc, ca = (np.hypot(*(b - a).T), np.hypot(*(c - b).T), np.hypot(*(a - c).T))
    cross = np.abs((b[:, 0] - a[:, 0]) * (c[:, 1] - a[:, 1]) - (b[:, 1] - a[:, 1]) * (c[:, 0] - a[:, 0]))
    with np.errstate(divide='ignore', invalid='ignore'):
        return np.where(cross > 1e-9, ab * bc * ca / (2 * cross), np.inf)


def speed_profile(r_m, ds_m, v_cap=V_MAX):
    """Closed-loop speed limited by grip, then by acceleration and braking."""
    v = np.minimum(v_cap, np.sqrt(A_LAT * r_m))
    n = len(v)
    for _ in range(3):  # passes around the loop to settle the wrap-around
        for i in range(2 * n):
            j, p = i % n, (i - 1) % n
            v[j] = min(v[j], np.sqrt(v[p] ** 2 + 2 * A_ACC * ds_m))
        for i in range(2 * n, 0, -1):
            j, q = i % n, (i + 1) % n
            v[j] = min(v[j], np.sqrt(v[q] ** 2 + 2 * A_BRK * ds_m))
    return v


def lap_time(r_px, ds_px, scale):
    v = speed_profile(r_px * scale, ds_px * scale)
    return np.sum(ds_px * scale / v), v


def nearest_s(pts, x, y):
    d = np.hypot(pts[:, 0] - x, pts[:, 1] - y)
    i = int(d.argmin())
    return i / len(pts), float(d[i])


def zone_range(pts, zone_path, max_d=40):
    """Lap-fraction interval covered by a zone shape (handles wrap at s=0)."""
    zp = path_points(zone_path, 100)
    hits = sorted({nearest_s(pts, x, y)[0] for x, y in zp if nearest_s(pts, x, y)[1] < max_d})
    gaps = np.diff(hits + [hits[0] + 1])
    k = int(np.argmax(gaps))  # the largest gap is outside the zone
    return [round(hits[(k + 1) % len(hits)], 4), round(hits[k], 4)]


def inside(poly_list, x, y):
    """Even-odd point-in-polygon over several closed polylines (track ribbon with holes)."""
    c = False
    for poly in poly_list:
        px, py = poly[:, 0], poly[:, 1]
        qx, qy = np.roll(px, 1), np.roll(py, 1)
        hit = ((py > y) != (qy > y)) & (x < (qx - px) * (y - py) / np.where(qy != py, qy - py, 1e-9) + px)
        c ^= bool(np.count_nonzero(hit) % 2)
    return c


def pit_centerline(path):
    """Average the two long edges of the ribbon; ends are the two straight Line segments."""
    segs = list(path)
    ends = [i for i, s in enumerate(segs) if isinstance(s, Line) and abs(s.start - s.end) < 220
            and abs(s.start.real - s.end.real) > 1 and abs(s.start.imag - s.end.imag) > 50]
    assert len(ends) == 2, ends
    e0, e1 = ends
    inner = segs[e0 + 1:e1]
    outer = segs[e1 + 1:] + segs[:e0]
    def edge(ss, reverse):
        pts = np.vstack([path_points(s, 50) for s in ss])
        return pts[::-1] if reverse else pts
    a, _ = resample(edge(inner, False), 400, False)
    b, _ = resample(edge(outer, True), 400, False)
    mid = (a + b) / 2
    end_mid = [((segs[e].start + segs[e].end) / 2) for e in ends]
    return mid, [(z.real, z.imag) for z in end_mid]


def run_speed(cap, d):
    """Time along an open path with speed caps, limited by acceleration and braking."""
    v = cap.copy()
    for i in range(1, len(v)):
        v[i] = min(v[i], np.sqrt(v[i - 1] ** 2 + 2 * A_ACC * d[i - 1]))
    for i in range(len(v) - 2, -1, -1):
        v[i] = min(v[i], np.sqrt(v[i + 1] ** 2 + 2 * A_BRK * d[i]))
    return np.sum(d / np.maximum((v[:-1] + v[1:]) / 2, 0.05))


def physical_pit_loss(pts, v, scale, ds_px, lane, i_in, i_out, window=60):
    """Pit path (track -> lane with a stop at the box -> track) minus the same span on track."""
    n = len(pts)
    before = pts[np.arange(i_in - window, i_in + 1) % n]
    after = pts[np.arange(i_out, i_out + window + 1) % n]
    path = np.vstack([before, lane, after])
    d = np.hypot(*np.diff(path, axis=0).T) * scale
    r_lane = np.minimum(radius(np.vstack([lane[:1]] * 3 + [lane] + [lane[-1:]] * 3), 3)[3:-3], 1e9)
    cap = np.r_[v[np.arange(i_in - window, i_in + 1) % n],
                np.minimum(V_MAX, np.sqrt(A_LAT * r_lane * scale)),
                v[np.arange(i_out, i_out + window + 1) % n]]
    cap[len(before) + int(BOX_AT * len(lane))] = 0.0
    t_pit = run_speed(cap, d) + STOP_TIME + REACTION
    idx = np.arange(i_in - window, i_out + window + 1) % n
    t_track = run_speed(v[idx].copy(), np.full(len(idx) - 1, ds_px * scale))
    return float(t_pit - t_track)


def main(svg, out):
    paths, attrs = svg2paths(svg)
    P = {a.get('id'): p for p, a in zip(paths, attrs)}

    raw = path_points(P['racing line'], N)
    pts, _ = resample(raw, N, True)
    if DIRECTION < 0:
        pts = pts[::-1]
    # rotate so that sample 0 is the timing line crossing
    fl = P['start/fimish']
    lx = (fl.start.real + fl.end.real) / 2
    ly0, ly1 = sorted([fl.start.imag, fl.end.imag])
    cand = [i for i in range(N) if abs(pts[i, 0] - lx) < 6 and ly0 <= pts[i, 1] <= ly1]
    i0 = min(cand, key=lambda i: abs(pts[i, 0] - lx))
    pts = np.roll(pts, -i0, 0)

    ds_px = np.hypot(*np.diff(np.vstack([pts, pts[:1]]), axis=0).T).mean()
    r_px = radius(pts)

    lo, hi = 0.01, 1.0  # metres per px
    for _ in range(60):
        mid = (lo + hi) / 2
        t, _ = lap_time(r_px, ds_px, mid)
        lo, hi = (mid, hi) if t < LAP_TIME else (lo, mid)
    scale = (lo + hi) / 2
    t, v = lap_time(r_px, ds_px, scale)
    dt = ds_px * scale / v
    t_frac = np.r_[0, np.cumsum(dt)[:-1]] / dt.sum()

    pit_mid, pit_ends = pit_centerline(P['pitlane'])
    s_ends = [nearest_s(pts, *e)[0] for e in pit_ends]
    s_in, s_out = sorted(s_ends)  # entry is right after the line, exit later in the lap
    if nearest_s(pts, *pit_ends[0])[0] != s_in:
        pit_mid, pit_ends = pit_mid[::-1], pit_ends[::-1]
    # the ribbon is drawn partly under the track: keep only the part off the track
    ribbon = [path_points(sp, 200) for sp in P['track'].continuous_subpaths()]
    off = [i for i, (x, y) in enumerate(pit_mid) if not inside(ribbon, x, y)]
    pit_mid = pit_mid[off[0]:off[-1] + 1]
    if nearest_s(pts, *pit_mid[0])[0] > nearest_s(pts, *pit_mid[-1])[0]:
        pit_mid = pit_mid[::-1]
    k_out = next(k for k, (x, y) in enumerate(pit_mid) if nearest_s(pts, x, y)[0] >= PIT_OUT_MAX_S)
    pit_mid = pit_mid[:k_out + 1]
    s_in = nearest_s(pts, *pit_mid[0])[0]
    s_out = nearest_s(pts, *pit_mid[-1])[0]
    pit_len_px = np.hypot(*np.diff(pit_mid, axis=0).T).sum()

    # time on track between pit entry and exit
    i_in, i_out = int(s_in * N), int(s_out * N)
    t_bypass = dt[i_in:i_out].sum()
    L = pit_len_px * scale
    lane_time = PIT_LOSS + t_bypass  # entry to exit when not waiting under red (data)
    loss_phys = physical_pit_loss(pts, v, scale, ds_px, pit_mid, i_in, i_out)
    zones = sorted(zone_range(pts, p) for k, p in P.items() if k and k.startswith('overtake zone'))

    cfg = {
        'name': 'Пит-Стоп Премиум',
        'direction': 'std',
        'source': svg,
        'calibration': {
            'lapTime': LAP_TIME, 'pitLoss': PIT_LOSS, 'stopTime': STOP_TIME,
            'aLat': A_LAT, 'aAcc': A_ACC, 'aBrk': A_BRK, 'vMax': V_MAX,
        },
        'scaleMPerPx': round(scale, 5),
        'lengthM': round(N * ds_px * scale, 1),
        'markers': {
            'line': 0.0,
            'pitIn': round(s_in, 4),
            'pitOut': round(s_out, 4),
            'decision': DECISION_S,
        },
        'passZones': zones,
        'track': {
            'samples': N,
            'xy': [[round(x, 1), round(y, 1)] for x, y in pts],
            'speed': [round(x, 2) for x in v],
            'timeFrac': [round(x, 5) for x in t_frac],
        },
        'pitlane': {
            'xy': [[round(x, 1), round(y, 1)] for x, y in pit_mid[::4]],
            'lengthM': round(L, 1),
            'boxAt': BOX_AT,
            'laneTime': round(float(lane_time), 2),
            'trackBypassTime': round(float(t_bypass), 2),
            'pitLossData': PIT_LOSS,
            'pitLossPhys': round(loss_phys, 2),
        },
    }
    json.dump(cfg, open(out, 'w'), ensure_ascii=False)
    print(f'scale {scale:.4f} m/px, lap length {cfg["lengthM"]} m, lap {t:.2f} s')
    print(f'speed min {v.min()*3.6:.0f} km/h, max {v.max()*3.6:.0f} km/h, mean {cfg["lengthM"]/t*3.6:.0f} km/h')
    print(f'pit in {s_in:.3f}, out {s_out:.3f}; lane {L:.0f} m, bypassed track {t_bypass:.2f} s')
    print(f'pit loss: data {PIT_LOSS} s (used), physical estimate {loss_phys:.1f} s '
          f'(stop {STOP_TIME} + reaction {REACTION} + braking/acceleration and lane vs track)')
    print('pass zones', zones)


if __name__ == '__main__':
    main(*sys.argv[1:3])
