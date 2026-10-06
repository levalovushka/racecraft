import { K, rand } from './rng'
import { classOf, inLane, P, type Driver, type Race } from './race'

// Entry rule (docs/GLOSSARY.md): a driver goes in if the kart he will get is at
// least a class better than his own by HIS rating and the minimum stint is done,
// or if he is burning (no laps left to wait). He does not queue under red beyond
// a small personal tolerance. Rivals sometimes skip a good kart.

export interface StintInfo {
  lapNo: number // lap being completed at the next decision point
  newStart: number // where the next stint would start if pitting now
  curLen: number // laps on the current kart if pitting now
  eligible: boolean // minimum stint done
  margin: number // laps the driver can still wait before overstaying
  lapsOnNew: number // max laps on the kart taken now
}

export function stintInfo(r: Race, d: Driver): StintInfo {
  const s = r.settings
  const lapNo = d.lapsDone + 1
  const newStart = r.track.pitLapToNew ? lapNo : lapNo + 1
  const cur = d.stints[d.stints.length - 1]
  const curLen = newStart - cur.start
  const stintsAfter = s.pits - d.pitsDone
  const latest = s.laps - stintsAfter * s.minStint
  const margin = latest - newStart
  const lapsOnNew = stintsAfter > 1 ? s.laps - newStart - (stintsAfter - 1) * s.minStint : s.laps - newStart
  return { lapNo, newStart, curLen, eligible: curLen >= s.minStint, margin, lapsOnNew }
}

/** Time until the driver reaches the pit lane entry (0 if not on track) */
export function timeToPitIn(r: Race, d: Driver): number {
  if (d.mode !== 'track') return Infinity
  const x = d.u - Math.floor(d.u)
  let f = r.track.tauPitIn - x
  if (f <= 0) f += 1
  return f * d.lapT
}

/** Time until the driver passes his decision point */
export function timeToDecision(r: Race, d: Driver): number {
  if (d.mode !== 'track') return Infinity
  const x = d.u - Math.floor(d.u)
  let f = r.track.tauDecision - x
  if (f <= 0) f += 1
  return f * d.lapT
}

/**
 * Drivers who will press the button before `d` would: in the lane, or committed
 * and nearer the entry. `publicOnly` drops the committed ones: rivals' decisions
 * are not visible to the manager until they actually turn into the pit lane.
 */
export function queueBefore(r: Race, d: Driver | null, publicOnly = false): Driver[] {
  const mine = d ? timeToPitIn(r, d) : Infinity
  const lane = r.drivers
    .filter((o) => o !== d && (o.mode === 'laneIn' || o.mode === 'wait'))
    .sort((a, b) => a.laneT0 - b.laneT0)
  const committed = r.drivers
    .filter((o) => !publicOnly && o !== d && o.mode === 'track' && o.commit && timeToPitIn(r, o) < mine)
    .sort((a, b) => timeToPitIn(r, a) - timeToPitIn(r, b))
  return [...lane, ...committed]
}

/** Karts in the order they will be handed out: first, second, then karts of the queue */
export function ribbon(r: Race, queue: Driver[]): number[] {
  return [r.box[0], r.box[1], ...queue.map((q) => q.kart)]
}

/** Seconds a driver would stand at the red light if he commits now */
export function expectedWait(r: Race, d: Driver, queue: Driver[]): number {
  const arrive = r.t + timeToPitIn(r, d) + P.toBox
  let green = r.greenAt
  for (let i = 0; i < queue.length; i++) green = Math.max(green, r.t) + r.settings.stopTime
  return Math.max(0, green - arrive)
}

/**
 * Laps of slack left once the box jam at the deadline is accounted for: every
 * driver who must stop no later than us needs a box cycle (~25 s, under a lap).
 */
export function urgency(r: Race, d: Driver, si: StintInfo): number {
  let rivals = 0
  for (const o of r.drivers) {
    if (o === d || o.mode === 'done' || o.pitsDone >= r.settings.pits) continue
    if (o.mode === 'laneIn' || o.mode === 'wait') {
      rivals++
      continue
    }
    if (o.mode !== 'track') continue
    if (stintInfo(r, o).margin <= si.margin + 1) rivals++
  }
  const cycleLaps = r.settings.stopTime / r.track.refLap
  return si.margin - Math.ceil(rivals * cycleLaps)
}

export type Hunger = 'out' | 'locked' | 'burning' | 'hungry' | 'full'

export function rate(perceived: number[], kart: number): number {
  return classOf(perceived[kart])
}

export function hunger(r: Race, d: Driver, perceived: number[], publicOnly = false): Hunger {
  if (d.pitsDone >= r.settings.pits) return 'out'
  if (inLane(d)) return 'out'
  const si = stintInfo(r, d)
  const queue = queueBefore(r, d, publicOnly)
  if (si.eligible && urgency(r, d, si) <= 1) return 'burning'
  if (!si.eligible) return 'locked'
  const kart = ribbon(r, queue)[queue.length]
  return rate(perceived, d.kart) - rate(perceived, kart) >= 1 ? 'hungry' : 'full'
}

export function aiWantsPit(r: Race, d: Driver): boolean {
  if (d.pitsDone >= r.settings.pits) return false
  const si = stintInfo(r, d)
  if (!si.eligible) return false
  const queue = queueBefore(r, d)
  const urg = urgency(r, d, si)
  if (urg <= 1 + d.buffer) {
    // burning: take whatever comes, but with laps in hand go round once more rather than sit under red
    return si.margin <= 1 + d.buffer || expectedWait(r, d, queue) <= d.redTolerance + 3
  }
  const kart = ribbon(r, queue)[queue.length]
  const gain = rate(d.perceived, d.kart) - rate(d.perceived, kart)
  // the closer the jam at the deadline, the less a driver asks of the kart
  const need = urg > d.patience ? 1 : urg > 3 ? 0 : -1
  if (gain < need) return false
  if (expectedWait(r, d, queue) > d.redTolerance + (urg <= 3 ? 3 : 0)) return false
  const pSkip = d.skipScale * (gain >= 2 ? 0.05 : gain === 1 ? 0.2 : 0.35)
  return rand(r.noiseFrom <= si.lapNo ? r.noiseSeed : r.settings.seed, K.skip, d.id, si.lapNo) >= pSkip
}
