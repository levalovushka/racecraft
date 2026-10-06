// Track geometry built by scripts/build_track.py.
// Positions on the lap are kept in "time fraction" tau: the share of lap time
// elapsed since the timing line. Every driver uses the same speed profile, so
// tau orders cars on the road exactly like the physical position s does.

export interface TrackJson {
  name: string
  lengthM: number
  markers: { line: number; pitIn: number; pitOut: number; decision: number }
  passZones: [number, number][]
  track: { samples: number; xy: [number, number][]; speed: number[]; timeFrac: number[] }
  pitlane: { xy: [number, number][]; lengthM: number; boxAt: number; slots: number[]; trackBypassTime: number }
  calibration: { lapTime: number }
}

export interface Track {
  name: string
  lengthM: number
  n: number
  xy: [number, number][]
  tauAt: number[] // tau at sample i (s = i / n)
  tauDecision: number
  tauPitIn: number
  tauPitOut: number
  zones: [number, number][] // in tau
  pit: { xy: [number, number][]; cum: number[]; boxAt: number; slots: number[] } // slots[0] is handed out first, arrivals park at boxAt
  /** Lap with the stop counts to the new stint (reg. 10.10): most of it is driven on the new kart */
  pitLapToNew: boolean
  refLap: number
}

export function buildTrack(j: TrackJson): Track {
  const n = j.track.samples
  const tauAt = j.track.timeFrac
  const tauOfS = (s: number) => {
    const x = (((s % 1) + 1) % 1) * n
    const i = Math.floor(x)
    const a = tauAt[i % n]
    const b = i + 1 >= n ? 1 : tauAt[i + 1]
    return a + (b - a) * (x - i)
  }
  const pxy = j.pitlane.xy
  const cum = [0]
  for (let i = 1; i < pxy.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pxy[i][0] - pxy[i - 1][0], pxy[i][1] - pxy[i - 1][1]))
  }
  const m = j.markers
  if (!(m.pitIn < m.pitOut)) throw new Error('pit lane crossing the timing line is not supported yet')
  return {
    name: j.name,
    lengthM: j.lengthM,
    n,
    xy: j.track.xy,
    tauAt,
    tauDecision: tauOfS(m.decision),
    tauPitIn: tauOfS(m.pitIn),
    tauPitOut: tauOfS(m.pitOut),
    zones: j.passZones.map(([a, b]) => [tauOfS(a), tauOfS(b)] as [number, number]),
    pit: { xy: pxy, cum, boxAt: j.pitlane.boxAt, slots: j.pitlane.slots },
    pitLapToNew: m.pitIn < 1 - m.pitOut,
    refLap: j.calibration.lapTime,
  }
}

/** Physical position s for a time fraction tau (binary search in the profile) */
export function sOfTau(t: Track, tau: number): number {
  const x = ((tau % 1) + 1) % 1
  const a = t.tauAt
  let lo = 0
  let hi = t.n - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (a[mid] <= x) lo = mid
    else hi = mid - 1
  }
  const next = lo + 1 >= t.n ? 1 : a[lo + 1]
  const f = next > a[lo] ? (x - a[lo]) / (next - a[lo]) : 0
  return (lo + f) / t.n
}

export function xyOfS(t: Track, s: number): [number, number] {
  const x = (((s % 1) + 1) % 1) * t.n
  const i = Math.floor(x) % t.n
  const k = (i + 1) % t.n
  const f = x - Math.floor(x)
  return [t.xy[i][0] + (t.xy[k][0] - t.xy[i][0]) * f, t.xy[i][1] + (t.xy[k][1] - t.xy[i][1]) * f]
}

export function xyOfTau(t: Track, tau: number): [number, number] {
  return xyOfS(t, sOfTau(t, tau))
}

/** Point on the pit lane at fraction f of its length (0 = entry, 1 = exit) */
export function pitXY(t: Track, f: number): [number, number] {
  const { xy, cum } = t.pit
  const d = Math.min(Math.max(f, 0), 1) * cum[cum.length - 1]
  let i = 1
  while (i < cum.length - 1 && cum[i] < d) i++
  const g = cum[i] > cum[i - 1] ? (d - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0
  return [xy[i - 1][0] + (xy[i][0] - xy[i - 1][0]) * g, xy[i - 1][1] + (xy[i][1] - xy[i - 1][1]) * g]
}

export function zoneAt(t: Track, tau: number): number {
  const x = ((tau % 1) + 1) % 1
  return t.zones.findIndex(([a, b]) => x >= a && x <= b)
}
