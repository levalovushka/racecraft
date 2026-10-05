import { gauss, K, rand, shuffle } from './rng'
import { type Track, zoneAt } from './track'
import { aiWantsPit } from './ai'

// ---------------------------------------------------------------- parameters

export interface Settings {
  seed: number
  laps: number // briefing: 30 min -> laps
  minStint: number // M, briefing: 5 min -> laps
  pits: number // mandatory kart changes
  stopTime: number // s from the button press to green
  pitLoss: number // s lost by a stop without waiting (pit lap + next lap - two clean laps)
  ourPace: number // s/lap vs field median, negative = faster
  ourAggr: number // 0..1
  ourName: string
  gridPos: number | null // start conditions: our grid slot (1..10), null = from qualifying
  ourKartClass: number | null // start conditions: class of our race kart (0..3 = A..D), null = from the draw
}

export const DEFAULT_SETTINGS: Settings = {
  seed: 1,
  laps: 60,
  minStint: 10,
  pits: 2,
  stopTime: 25,
  pitLoss: 32,
  ourPace: 0,
  ourAggr: 0.5,
  ourName: 'Мы',
  gridPos: null,
  ourKartClass: null,
}

/** Manager's standing order for the coming pit entry */
export type Order = 'stay' | 'box' | 'boxIfClear'

export const P = {
  dt: 0.05,
  fieldPaceSd: 0.22, // s/lap, spread of driver pace inside a group
  lapSd: 0.18, // s, lap-to-lap noise
  startLoss: 1.5, // s, standing start on lap 1
  gridGap: 0.012, // lap fraction between grid slots
  minGap: 0.25, // s, closest a follower gets before he has to pass
  defendLoss: 0.05, // s/lap lost by a defender under attack
  passLoss: 0.15, // s lost by the overtaken driver
  passK: 0.06, // s, softness of the pass probability curve
  blueFrom: 15, // reg. 12.11
  blueToEnd: 5,
  warm: 0.5, // s, first lap on a kart out of the box
  warmCold: 0.4, // s extra when the kart sat in the box for long
  coldAfter: 420, // s
  toBox: 2.0, // s from pit lane entry to the box
  refMargin: 0.6, // s, release margin assumed in the data calibration
  rivalPerceptionSd: 0.1, // s/lap, how wrong a rival rates a kart
  managerPerceptionSd: 0.05,
  kartRangeMedian: 0.41, // s/lap best - worst kart in a race, quartiles 0.30 / 0.41 / 0.69
  kartRangeSdLow: 0.463,
  kartRangeSdHigh: 0.772,
}

// ---------------------------------------------------------------- state

export type Mode = 'track' | 'laneIn' | 'wait' | 'box' | 'laneOut' | 'done'

export interface Kart {
  id: number
  label: number
  effect: number // s/lap vs median kart (hidden truth)
  boxSince: number // when it was put into the box
}

export interface Stint {
  kart: number
  start: number // laps completed when the stint started counting
  end: number | null
}

export interface Driver {
  id: number
  num: number // front number (transponder)
  name: string
  isUs: boolean
  pace: number // s/lap vs field median
  aggr: number
  perceived: number[] // per kart id: what this driver thinks the kart is worth
  releaseMargin: number
  redTolerance: number
  skipScale: number // 1 for rivals, 0 for the efficient bot
  patience: number // laps of slack below which an equal kart is good enough
  buffer: number // laps kept in hand before the deadline
  // dynamic
  mode: Mode
  u: number // laps completed + tau (time fraction of the lap)
  lapsDone: number
  lapStart: number
  lapT: number // current pace, s per lap
  lapTimes: number[]
  kart: number
  stints: Stint[]
  pitsDone: number
  commit: boolean
  conditional: boolean // committed with "box if nobody goes in ahead": the driver checks at the entry
  attacked: boolean
  stuck: boolean
  trafficLoss: number
  redWait: number
  overtakes: number
  finishTime: number | null
  // pit lane
  laneT0: number
  laneT1: number
  laneFrom: number
  laneTo: number
  pitLapStint: number // stint boundary decided at entry
}

export interface PitRecord {
  driver: number
  lap: number // lap with the stop
  tEnter: number
  tPress: number
  from: number
  to: number
  wait: number
  boxAfter: [number, number]
}

export interface Decision {
  t: number
  lap: number
  order: Order
  commit: boolean // what actually happened: did we go in
  snapshot: Race
}

export interface LogItem {
  t: number
  text: string
  us?: boolean
}

export interface Race {
  settings: Settings
  track: Track
  t: number
  karts: Kart[]
  drivers: Driver[]
  box: [number, number]
  greenAt: number
  flag: boolean
  finished: boolean
  pits: PitRecord[]
  frontLog: { t: number; kart: number }[]
  log: LogItem[]
  attempts: Set<string>
  intent: Order // manager's standing order, handed over at the decision point
  ourPolicy: 'manager' | 'bot'
  forceNext: boolean | null // rollouts: forced decision at our next decision point
  decisions: Decision[]
  recordDecisions: boolean
  noiseSeed: number
  noiseFrom: number // laps >= noiseFrom use noiseSeed (rollouts), earlier ones use the seed
  fromBox: number // s from release to rejoin
}

// ---------------------------------------------------------------- setup

const NAMES = [
  'Абрамов', 'Белов', 'Волков', 'Громов', 'Демин', 'Егоров', 'Жуков', 'Зайцев', 'Ильин', 'Карпов',
  'Лебедев', 'Морозов', 'Новиков', 'Орлов', 'Павлов', 'Романов', 'Соколов', 'Титов', 'Уваров', 'Фомин',
]

export const CLASS_CENTER = [-0.22, -0.07, 0.07, 0.22]

export function classOf(effect: number): number {
  if (effect <= -0.15) return 0
  if (effect <= 0) return 1
  if (effect <= 0.15) return 2
  return 3
}
export const CLASS_NAMES = ['A', 'B', 'C', 'D']

export function createRace(settings: Settings, track: Track): Race {
  const seed = settings.seed
  const z = gauss(seed, K.kartSpread)
  const range = Math.min(1.2, Math.max(0.15,
    P.kartRangeMedian * Math.exp(z * (z < 0 ? P.kartRangeSdLow : P.kartRangeSdHigh))))
  const raw = Array.from({ length: 12 }, (_, i) => gauss(seed, K.kartEffect, i))
  const lo = Math.min(...raw)
  const hi = Math.max(...raw)
  const scaled = raw.map((x) => ((x - lo) / (hi - lo)) * range)
  const sorted = scaled.slice().sort((a, b) => a - b)
  const med = (sorted[5] + sorted[6]) / 2
  const labels = shuffle(Array.from({ length: 16 }, (_, i) => i + 1), seed, K.labels).slice(0, 12)
  const karts: Kart[] = scaled.map((e, i) => ({ id: i, label: labels[i], effect: e - med, boxSince: -600 }))

  const nums = shuffle(Array.from({ length: 20 }, (_, i) => i + 1), seed, K.numbers).slice(0, 10)
  const names = shuffle(NAMES, seed, K.names)
  const draw = shuffle(Array.from({ length: 12 }, (_, i) => i), seed, K.draw)
  if (settings.ourKartClass !== null) {
    // start conditions: give us a kart of the wanted class, swapping it with whoever drew it
    const want = settings.ourKartClass
    const dist = (k: Kart) => Math.abs(k.effect - CLASS_CENTER[want])
    const inClass = karts.filter((k) => classOf(k.effect) === want)
    const pick = (inClass.length ? inClass : karts).reduce((a, b) => (dist(b) < dist(a) ? b : a))
    if (!inClass.length) pick.effect = CLASS_CENTER[want] // nothing of that class in this draw: re-rate the closest kart
    const j = draw.indexOf(pick.id)
    ;[draw[0], draw[j]] = [draw[j], draw[0]]
  }

  const drivers: Driver[] = Array.from({ length: 10 }, (_, i) => {
    const isUs = i === 0
    const sd = isUs ? P.managerPerceptionSd : P.rivalPerceptionSd
    return {
      id: i,
      num: nums[i],
      name: isUs ? settings.ourName.trim() || 'Мы' : names[i],
      isUs,
      pace: isUs ? settings.ourPace : P.fieldPaceSd * gauss(seed, K.driverPace, i),
      aggr: isUs ? settings.ourAggr : 0.1 + 0.8 * rand(seed, K.driverAggr, i),
      perceived: karts.map((k) => k.effect + sd * gauss(seed, K.perceive, i, k.id)),
      releaseMargin: isUs ? P.refMargin : 0.3 + 1.2 * rand(seed, K.release, i),
      redTolerance: isUs ? 1.5 : 3 * rand(seed, K.tolerance, i) ** 2,
      skipScale: isUs ? 0 : 1,
      patience: isUs ? 8 : 5 + 25 * rand(seed, K.patience, i),
      buffer: isUs ? 1 : Math.floor(3 * rand(seed, K.patience, i, 1)),
      mode: 'track',
      u: 0,
      lapsDone: 0,
      lapStart: 0,
      lapT: 0,
      lapTimes: [],
      kart: draw[i],
      stints: [{ kart: draw[i], start: 0, end: null }],
      pitsDone: 0,
      commit: false,
      conditional: false,
      attacked: false,
      stuck: false,
      trafficLoss: 0,
      redWait: 0,
      overtakes: 0,
      finishTime: null,
      laneT0: 0,
      laneT1: 0,
      laneFrom: 0,
      laneTo: 0,
      pitLapStint: 0,
    }
  })

  // qualifying on separately drawn karts -> grid
  const qual = drivers.map((d) => ({
    d,
    t: d.pace + karts[Math.floor(rand(seed, K.qual, d.id) * 12)].effect + 0.12 * gauss(seed, K.qual, d.id, 1),
  }))
  qual.sort((a, b) => a.t - b.t)
  if (settings.gridPos !== null) {
    const i = qual.findIndex((q) => q.d.isUs)
    const [me] = qual.splice(i, 1)
    qual.splice(Math.min(Math.max(settings.gridPos, 1), 10) - 1, 0, me)
  }
  qual.forEach(({ d }, pos) => {
    d.u = -(pos + 1) * P.gridGap
  })

  const t = track
  const laneTotal = settings.pitLoss - P.warm + (t.tauPitOut - t.tauPitIn) * t.refLap
  const r: Race = {
    settings,
    track,
    t: 0,
    karts,
    drivers,
    box: [draw[10], draw[11]],
    greenAt: 0,
    flag: false,
    finished: false,
    pits: [],
    frontLog: [{ t: 0, kart: draw[10] }],
    log: [],
    attempts: new Set(),
    intent: 'stay',
    ourPolicy: 'manager',
    forceNext: null,
    decisions: [],
    recordDecisions: true,
    noiseSeed: seed,
    noiseFrom: Infinity,
    fromBox: Math.max(1, laneTotal - P.toBox - settings.stopTime - P.refMargin),
  }
  for (const d of drivers) d.lapT = baseLapT(r, d, 1) + P.startLoss
  return r
}

export function cloneRace(r: Race): Race {
  const { track, decisions, attempts, ...rest } = r
  void decisions
  const c = structuredClone(rest) as Omit<Race, 'track' | 'decisions' | 'attempts'>
  return { ...c, track, decisions: [], attempts: new Set(attempts) }
}

// ---------------------------------------------------------------- helpers

function noiseKey(r: Race, lap: number): number {
  return lap >= r.noiseFrom ? r.noiseSeed : r.settings.seed
}

export function baseLapT(r: Race, d: Driver, lap: number): number {
  return r.track.refLap + d.pace + r.karts[d.kart].effect + P.lapSd * gauss(noiseKey(r, lap), K.lapNoise, d.id, lap)
}

const frac = (x: number) => x - Math.floor(x)

export function onTrack(d: Driver) {
  return d.mode === 'track'
}

export function inLane(d: Driver) {
  return d.mode === 'laneIn' || d.mode === 'wait' || d.mode === 'box' || d.mode === 'laneOut'
}

/** Leader's lap count for regulations that depend on the race lap (blue flags) */
export function raceLap(r: Race): number {
  return Math.max(...r.drivers.map((d) => d.lapsDone)) + 1
}

function log(r: Race, text: string, us = false) {
  r.log.push({ t: r.t, text, us })
}

// ---------------------------------------------------------------- step

export function step(r: Race, dt = P.dt) {
  if (r.finished) return
  r.t += dt
  const tr = r.track

  laneStep(r)

  // free movement
  const cars = r.drivers.filter(onTrack)
  const old = new Map<number, number>()
  const cand = new Map<number, number>()
  for (const d of cars) {
    old.set(d.id, d.u)
    cand.set(d.id, d.u + dt / (d.lapT + (d.attacked ? P.defendLoss : 0)))
    d.attacked = false
    d.stuck = false
  }

  // traffic: a follower cannot get closer than minGap unless he passes
  for (let pass = 0; pass < 2; pass++) {
    for (const d of cars) {
      let ahead: Driver | null = null
      let gap = Infinity
      for (const o of cars) {
        if (o === d) continue
        const g = frac(cand.get(o.id)! - cand.get(d.id)!)
        if (g < gap) {
          gap = g
          ahead = o
        }
      }
      if (!ahead) continue
      const gapT = gap * d.lapT
      if (gapT >= P.minGap) continue
      const delta = ahead.lapT - d.lapT // > 0: we are faster
      const zone = zoneAt(tr, cand.get(d.id)!)
      if (pass === 0 && zone >= 0 && delta > 0) {
        const key = `${d.id}-${ahead.id}-${d.lapsDone}-${zone}`
        if (!r.attempts.has(key)) {
          r.attempts.add(key)
          if (rand(noiseKey(r, d.lapsDone), K.pass, d.id, ahead.id, d.lapsDone, zone) < passProb(r, d, ahead, delta)) {
            cand.set(d.id, cand.get(d.id)! + gap + 0.08 / d.lapT)
            cand.set(ahead.id, cand.get(ahead.id)! - P.passLoss / ahead.lapT)
            d.overtakes++
            continue
          }
        }
      }
      const want = cand.get(d.id)!
      const capped = Math.max(old.get(d.id)!, want - (P.minGap / d.lapT - gap))
      d.trafficLoss += (want - capped) * d.lapT
      cand.set(d.id, capped)
      d.stuck = true
      if (delta > 0) ahead.attacked = true
    }
  }

  // events along the lap
  for (const d of cars) {
    const u0 = old.get(d.id)!
    const u1 = cand.get(d.id)!
    d.u = u1
    if (Math.floor(u0 - tr.tauDecision) < Math.floor(u1 - tr.tauDecision)) decide(r, d)
    if (Math.floor(u0) < Math.floor(u1)) crossLine(r, d, u1)
    if (d.mode === 'track' && d.commit && Math.floor(u0 - tr.tauPitIn) < Math.floor(u1 - tr.tauPitIn)) {
      if (d.conditional && r.drivers.some((o) => o.mode === 'laneIn' || o.mode === 'wait')) {
        // "box if nobody goes in ahead": somebody did, the driver stays out
        d.commit = false
        d.conditional = false
        const last = r.decisions.at(-1)
        if (last && last.lap === d.lapsDone) last.commit = false
        if (d.isUs) log(r, 'Перед нами заехали — пилот остался на трассе', true)
      } else {
        enterLane(r, d, Math.floor(u1 - tr.tauPitIn) + tr.tauPitIn)
      }
    }
  }

  if (r.drivers.every((d) => d.mode === 'done')) r.finished = true
  if (r.t > r.settings.laps * r.track.refLap * 1.6) {
    // safety stop: never loop forever
    for (const d of r.drivers) if (d.mode !== 'done') finish(r, d, r.t)
    r.finished = true
  }
}

function passProb(r: Race, d: Driver, ahead: Driver, delta: number): number {
  const lap = raceLap(r)
  const blue = lap >= P.blueFrom && lap <= r.settings.laps - P.blueToEnd
  if (blue && d.u - ahead.u > 0.5) return 0.95 // lapped driver must let the leader through within a lap
  let p = 1 / (1 + Math.exp(-(delta - (0.35 - 0.3 * d.aggr)) / P.passK))
  if (ahead.stints.length > 1 && ahead.lapsDone === ahead.stints[ahead.stints.length - 1].start) {
    p = Math.min(1, p + 0.25) // cold kart just out of the pit lane
  }
  return p
}

function decide(r: Race, d: Driver) {
  d.conditional = false
  if (r.flag || d.pitsDone >= r.settings.pits) {
    d.commit = false
    return
  }
  if (d.isUs && r.forceNext !== null) {
    d.commit = r.forceNext
    r.forceNext = null
    return
  }
  if (d.isUs && r.ourPolicy === 'manager') {
    const order = r.intent
    if (r.recordDecisions) {
      // lap = laps completed when the pit lane entry comes (it lies just after the line)
      r.decisions.push({ t: r.t, lap: d.lapsDone + 1, order, commit: order !== 'stay', snapshot: cloneRace(r) })
    }
    d.commit = order !== 'stay'
    d.conditional = order === 'boxIfClear'
    return
  }
  d.commit = aiWantsPit(r, d)
}

function crossLine(r: Race, d: Driver, u1: number) {
  const n = Math.floor(u1)
  if (n < 1) return // start line passage at the start
  const tCross = r.t - frac(u1) * d.lapT
  d.lapTimes.push(tCross - d.lapStart)
  d.lapStart = tCross
  d.lapsDone = n
  if (r.flag) {
    finish(r, d, tCross)
    return
  }
  if (n >= r.settings.laps) {
    r.flag = true
    log(r, `Клетчатый флаг: ${d.name}`)
    finish(r, d, tCross)
    return
  }
  d.lapT = baseLapT(r, d, n + 1)
}

function finish(_r: Race, d: Driver, t: number) {
  d.mode = 'done'
  d.finishTime = t
  d.stints[d.stints.length - 1].end = d.lapsDone
}

function enterLane(r: Race, d: Driver, u: number) {
  d.u = u
  d.mode = 'laneIn'
  d.commit = false
  d.conditional = false
  d.laneT0 = r.t
  d.laneT1 = r.t + P.toBox
  d.laneFrom = 0
  d.laneTo = r.track.pit.boxAt
  d.pitLapStint = r.track.pitLapToNew ? d.lapsDone : d.lapsDone + 1
  if (d.isUs) {
    r.intent = 'stay'
    log(r, `${d.name}: въехали в пит-лейн`, true)
  }
}

function laneStep(r: Race) {
  const s = r.settings
  const waiting: Driver[] = []
  for (const d of r.drivers) {
    if (d.mode === 'laneIn' && r.t >= d.laneT1) {
      d.mode = 'wait'
      d.laneT0 = d.laneT1 // arrival time
    }
    if (d.mode === 'wait') waiting.push(d)
    if (d.mode === 'box' && r.t >= d.laneT1) {
      d.mode = 'laneOut'
      d.laneT0 = r.t
      d.laneT1 = r.t + r.fromBox
      d.laneFrom = r.track.pit.boxAt
      d.laneTo = 1
    }
    if (d.mode === 'laneOut' && r.t >= d.laneT1) rejoin(r, d)
  }
  waiting.sort((a, b) => a.laneT0 - b.laneT0)
  const first = waiting[0]
  if (first && r.t >= r.greenAt) {
    // press the button: take the first kart, ours goes in as the second
    const d = first
    const arrived = d.laneT0
    const wait = r.t - arrived
    d.redWait += wait
    const from = d.kart
    const to = r.box[0]
    r.box = [r.box[1], from]
    r.karts[from].boxSince = r.t
    r.greenAt = r.t + s.stopTime
    r.frontLog.push({ t: r.t, kart: r.box[0] })
    d.stints[d.stints.length - 1].end = d.pitLapStint
    d.stints.push({ kart: to, start: d.pitLapStint, end: null })
    d.kart = to
    d.pitsDone++
    d.mode = 'box'
    d.laneT0 = r.t
    d.laneT1 = r.t + s.stopTime + d.releaseMargin
    r.pits.push({
      driver: d.id, lap: d.lapsDone + 1, tEnter: arrived - P.toBox, tPress: r.t,
      from, to, wait, boxAfter: [r.box[0], r.box[1]],
    })
    const k = (id: number) => r.karts[id].label
    log(r, `${d.name}: карт ${k(from)} → ${k(to)}${wait > 0.5 ? `, ждал ${wait.toFixed(1)} с` : ''}`, d.isUs)
  }
}

function rejoin(r: Race, d: Driver) {
  const tr = r.track
  d.mode = 'track'
  d.u = Math.floor(d.u) + tr.tauPitOut
  const press = r.pits.filter((p) => p.driver === d.id).at(-1)!
  // the taken kart's boxSince still holds when it was put into the box
  const idle = press.tPress - r.karts[d.kart].boxSince
  const warm = P.warm + (idle > P.coldAfter ? P.warmCold : 0)
  d.lapT = baseLapT(r, d, d.lapsDone + 1) + warm / Math.max(0.2, 1 - tr.tauPitOut)
}

// ---------------------------------------------------------------- views

export interface Result {
  driver: Driver
  laps: number
  time: number
  penalty: number
  total: number
  dsq: boolean
  pos: number
}

export function penalties(r: Race, d: Driver): number {
  let pen = 0
  for (const st of d.stints) {
    const end = st.end ?? d.lapsDone
    const len = end - st.start
    if (len < r.settings.minStint) pen += 10 * (r.settings.minStint - len)
  }
  return pen
}

export function results(r: Race): Result[] {
  const rows = r.drivers.map((d) => {
    const penalty = penalties(r, d)
    const time = d.finishTime ?? r.t
    return { driver: d, laps: d.lapsDone, time, penalty, total: time + penalty, dsq: d.pitsDone < r.settings.pits, pos: 0 }
  })
  rows.sort((a, b) => Number(a.dsq) - Number(b.dsq) || b.laps - a.laps || a.total - b.total)
  rows.forEach((x, i) => (x.pos = i + 1))
  return rows
}

/** Running order: by distance covered; drivers in the pit lane keep the distance they had at entry */
export function order(r: Race): Driver[] {
  return r.drivers.slice().sort((a, b) => {
    if (a.mode === 'done' && b.mode === 'done') return (a.finishTime ?? 0) - (b.finishTime ?? 0)
    if (a.mode === 'done' || b.mode === 'done') {
      // finished drivers ahead of those who still run the same lap count
      const la = a.lapsDone
      const lb = b.lapsDone
      if (la !== lb) return lb - la
      return a.mode === 'done' ? -1 : 1
    }
    return b.u - a.u
  })
}

export function runToEnd(r: Race, dt = P.dt) {
  while (!r.finished) step(r, dt)
  return r
}
