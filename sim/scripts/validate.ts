// Batch run of all-AI races vs Premium data (docs/SIMULATOR.md §8).
// Usage: npx tsx scripts/validate.ts [races=300] [pitLoss=28]
// Data: ../data/races.json from racecraft/timing_parse.py (optional).
import fs from 'node:fs'
import trackJson from '../../tracks/premium-std.json' with { type: 'json' }
import { buildTrack, type TrackJson } from '../src/engine/track'
import { createRace, DEFAULT_SETTINGS, results, runToEnd, penalties } from '../src/engine/race'

interface Sig {
  races: number
  pitLaps: number[]
  intervals: number[]
  excess: number[]
  conveyor: number
  pitsTotal: number
  lapped: number
  drivers: number
  extra: Record<string, number>
}

const empty = (): Sig => ({ races: 0, pitLaps: [], intervals: [], excess: [], conveyor: 0, pitsTotal: 0, lapped: 0, drivers: 0, extra: {} })

function addRace(sig: Sig, pits: { lap: number; t: number; lapTime: number | null }[], laps: number[]) {
  sig.races++
  pits.sort((a, b) => a.t - b.t)
  for (const p of pits) sig.pitLaps.push(p.lap)
  const times = pits.map((p) => p.lapTime).filter((x): x is number => x !== null)
  const mn = Math.min(...times)
  for (const x of times) sig.excess.push(x - mn)
  const iv = pits.slice(1).map((p, i) => p.t - pits[i].t)
  sig.intervals.push(...iv)
  // runs of 3+ pits with steps <= 45 s
  let run = 1
  const inRun = new Array(pits.length).fill(false)
  for (let i = 1; i <= pits.length; i++) {
    if (i < pits.length && iv[i - 1] <= 45) run++
    else {
      if (run >= 3) for (let k = i - run; k < i; k++) inRun[k] = true
      run = 1
    }
  }
  sig.conveyor += inRun.filter(Boolean).length
  sig.pitsTotal += pits.length
  const max = Math.max(...laps)
  sig.lapped += laps.filter((l) => l < max).length
  sig.drivers += laps.length
}

const q = (xs: number[], p: number) => {
  const s = xs.slice().sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

function hist(laps: number[]): string {
  const bins = new Array(20).fill(0)
  for (const l of laps) bins[Math.min(19, Math.floor((l - 1) / 3))]++
  const mx = Math.max(...bins)
  return bins.map((b, i) => `${String(i * 3 + 1).padStart(2)}-${String(i * 3 + 3).padStart(2)} ${'#'.repeat(Math.round((b / mx) * 40))}`).join('\n')
}

function report(name: string, s: Sig) {
  const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(0)}%`
  console.log(`\n=== ${name}: ${s.races} races`)
  console.log(hist(s.pitLaps))
  console.log(`interval between pits: median ${q(s.intervals, 0.5).toFixed(0)} s, <30 s ${pct(s.intervals.filter((x) => x < 30).length, s.intervals.length)}`)
  console.log(`pit lap over race-min: >5 s ${pct(s.excess.filter((x) => x > 5).length, s.excess.length)}, >10 s ${pct(s.excess.filter((x) => x > 10).length, s.excess.length)}`)
  console.log(`pits in conveyor runs (3+, step <= 45 s): ${pct(s.conveyor, s.pitsTotal)}`)
  console.log(`lapped drivers: ${pct(s.lapped, s.drivers)}`)
  for (const [k, v] of Object.entries(s.extra)) console.log(`${k}: ${v.toFixed(2)}`)
}

// ---- data
const dataPath = new URL('../../data/races.json', import.meta.url)
if (fs.existsSync(dataPath)) {
  const races = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as {
    id: string; drivers: { name: string }[]; laps: Record<string, [number | null, boolean][]>
    pits: { lap: number; t: number; driver: string }[]
  }[]
  const sig = empty()
  for (const r of races) {
    if (!r.id.startsWith('premium') || r.pits.length !== 2 * r.drivers.length) continue
    const idx = new Map(r.drivers.map((d, i) => [d.name, i]))
    const pits = r.pits.map((p) => ({ lap: p.lap, t: p.t, lapTime: r.laps[String(p.lap)]?.[idx.get(p.driver) ?? -1]?.[0] ?? null }))
    const laps = r.drivers.map((_, i) => Object.values(r.laps).filter((row) => row[i]?.[0]).length)
    addRace(sig, pits, laps)
  }
  report('DATA Premium', sig)
}

// ---- simulation
const n = Number(process.argv[2] ?? 300)
const pitLoss = Number(process.argv[3] ?? 28)
const track = buildTrack(trackJson as unknown as TrackJson)
const sig = empty()
let waits = 0
let overstint = 0
let stuckShare = 0
let overtakes = 0
let frontToTaken: number[] = []
const t0 = Date.now()
for (let i = 0; i < n; i++) {
  const r = createRace({ ...DEFAULT_SETTINGS, seed: 1000 + i, pitLoss }, track)
  r.ourPolicy = 'bot'
  r.drivers[0].skipScale = 1 // everybody behaves like a rival
  r.recordDecisions = false
  runToEnd(r)
  const pits = r.pits.map((p) => ({ lap: p.lap, t: p.tEnter, lapTime: r.drivers[p.driver].lapTimes[p.lap - 1] ?? null }))
  addRace(sig, pits, r.drivers.map((d) => d.lapsDone))
  for (const d of r.drivers) {
    waits += d.redWait
    if (penalties(r, d) > 0) overstint++
    stuckShare += d.trafficLoss
    overtakes += d.overtakes
  }
  // a top-3 kart (by truth) reaching the front of the box: seconds until taken
  const top = r.karts.slice().sort((a, b) => a.effect - b.effect).slice(0, 3).map((k) => k.id)
  for (let j = 0; j < r.frontLog.length; j++) {
    const f = r.frontLog[j]
    if (!top.includes(f.kart)) continue
    const taken = r.pits.find((p) => p.to === f.kart && p.tPress >= f.t)
    if (taken) frontToTaken.push(taken.tPress - f.t)
  }
  void results
}
sig.extra['red wait per driver, s'] = waits / (n * 10)
sig.extra['drivers with min-stint/overstint penalty, share'] = overstint / (n * 10)
sig.extra['traffic loss per driver, s'] = stuckShare / (n * 10)
sig.extra['overtakes per race'] = overtakes / n
frontToTaken = frontToTaken.filter((x) => x > 0)
sig.extra['top-3 kart at the front -> taken, median s (data 37)'] = q(frontToTaken, 0.5)
report(`SIM pitLoss ${pitLoss}`, sig)
console.log(`\n${n} races in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
