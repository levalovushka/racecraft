import { hash } from './rng'
import { classOf, cloneRace, createRace, P, penalties, results, runToEnd, type Decision, type Race, type Settings } from './race'
import { expectedWait, hunger, queueBefore, ribbon, stintInfo } from './ai'
import type { Track } from './track'

export interface Outcome {
  total: number // finish time + penalties, s
  pos: number
  laps: number
  dsq: boolean
}

function ourOutcome(r: Race): Outcome {
  const row = results(r).find((x) => x.driver.isUs)!
  return { total: row.total, pos: row.pos, laps: row.laps, dsq: row.dsq }
}

/** Same draw, same noise, our driver played by the efficient entry-rule bot with the manager's ratings */
export function runBot(settings: Settings, track: Track, managerPerceived?: number[]): { race: Race; outcome: Outcome } {
  const r = createRace(settings, track)
  r.ourPolicy = 'bot'
  r.recordDecisions = false
  if (managerPerceived) r.drivers[0].perceived = managerPerceived.slice()
  runToEnd(r)
  return { race: r, outcome: ourOutcome(r) }
}

/** Comparable score: time behind the leader's lap count is converted with the reference lap */
export function score(o: Outcome, r: Race): number {
  const lapsShort = r.settings.laps - o.laps
  return o.total + lapsShort * r.track.refLap + (o.dsq ? 600 : 0)
}

export interface OptionValue {
  mean: number // mean comparable score, s (lower is better)
  sd: number
  pos: number // mean finishing position
  n: number
}

export interface DecisionValue {
  pit: OptionValue
  stay: OptionValue
}

/** Monte Carlo from the decision point: both options, our driver then played by the bot; onRun ticks after every continuation */
export function evaluateDecision(dec: Decision, n = 24, onRun?: (done: number, of: number) => void): DecisionValue {
  let done = 0
  const run = (commit: boolean): OptionValue => {
    const xs: number[] = []
    let pos = 0
    for (let k = 0; k < n; k++) {
      const c = cloneRace(dec.snapshot)
      c.ourPolicy = 'bot'
      c.recordDecisions = false
      c.drivers[0].commit = commit
      c.noiseSeed = hash(c.settings.seed, 7777, k)
      c.noiseFrom = dec.lap + 1
      runToEnd(c, P.dt * 2)
      const o = ourOutcome(c)
      xs.push(score(o, c))
      pos += o.pos
      onRun?.(++done, 2 * n)
    }
    const mean = xs.reduce((a, b) => a + b, 0) / n
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1))
    return { mean, sd, pos: pos / n, n }
  }
  return { pit: run(true), stay: run(false) }
}

export interface DecisionView {
  dec: Decision
  index: number
  kind: 'pit' | 'hungry' | 'burning'
  ourKart: number
  offered: number // kart we would get
  gainClasses: number // by the manager's ratings
  margin: number
  wait: number // expected seconds under red if pitting
}

/** Decision points worth a look: we pitted, or the box offered an upgrade, or we were burning */
export function interestingDecisions(r: Race): DecisionView[] {
  const out: DecisionView[] = []
  r.decisions.forEach((dec, index) => {
    const s = dec.snapshot
    const us = s.drivers[0]
    const h = hunger(s, us, us.perceived)
    const si = stintInfo(s, us)
    const queue = queueBefore(s, us)
    const offered = ribbon(s, queue)[queue.length]
    const gain = classOf(us.perceived[us.kart]) - classOf(us.perceived[offered])
    const kind = dec.commit ? 'pit' : h === 'burning' ? 'burning' : h === 'hungry' ? 'hungry' : null
    if (kind) out.push({ dec, index, kind, ourKart: us.kart, offered, gainClasses: gain, margin: si.margin, wait: expectedWait(s, us, queue) })
  })
  return out
}

export interface StintView {
  kart: number
  label: number
  trueClass: number
  ourClass: number
  laps: number
  cost: number // s vs a median kart over the stint (negative = gained)
}

export function stintViews(r: Race, driverId = 0): StintView[] {
  const d = r.drivers[driverId]
  return d.stints.map((s) => {
    const k = r.karts[s.kart]
    const laps = (s.end ?? d.lapsDone) - s.start
    return {
      kart: s.kart,
      label: k.label,
      trueClass: classOf(k.effect),
      ourClass: classOf(r.drivers[0].perceived[s.kart]),
      laps,
      cost: k.effect * laps,
    }
  })
}

const round1 = (x: number) => Math.round(x * 10) / 10

/**
 * Where the time went, s, against a clean race that depends only on the settings and the grid slot,
 * so it is the same for the driver and for the bot: median kart, no traffic, no red, the mandatory pits.
 * Rows come rounded to 0.1 and `other` takes the rest and the rounding, so the rows add up to the shown total
 * and the difference of two totals is the difference of the race scores (±0.1).
 */
export function lossBreakdown(r: Race, driverId = 0) {
  const d = r.drivers[driverId]
  const s = r.settings
  const row = results(r).find((x) => x.driver.id === driverId)!
  const real = score({ total: row.total, pos: row.pos, laps: row.laps, dsq: row.dsq }, r)
  const gridU = createRace(s, r.track).drivers[driverId].u // <= 0: the grid slot sits behind the line
  const clean = (s.laps - gridU) * (r.track.refLap + d.pace) + P.startLoss + s.pits * s.pitLoss
  const named = {
    karts: round1(stintViews(r, driverId).reduce((a, x) => a + x.cost, 0)),
    redWait: round1(d.redWait),
    traffic: round1(d.trafficLoss),
    penalties: round1(penalties(r, d) + (row.dsq ? 600 : 0)), // short stints and, like score(), DSQ for missed stops
  }
  const shown = Object.values(named).reduce((a, x) => a + x, 0)
  // lap noise, passes and defending, warm-up, release from the box; a lapped driver's missing laps at refLap
  return { ...named, other: round1(round1(real - clean) - shown) }
}
