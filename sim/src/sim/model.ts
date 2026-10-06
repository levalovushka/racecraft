// View helpers on top of the engine: positions for drawing, what the manager's
// board would compute (contender, backup, rejoin point), track shapes.
import trackJson from '../../../tracks/premium-std.json'
import svgRaw from '../../../tracks/premium.svg?raw'
import { classOf, inLane, P, type Driver, type Race } from '@/engine/race'
import { buildTrack, pitXY, xyOfTau, type TrackJson } from '@/engine/track'
import { expectedWait, hunger, queueBefore, ribbon, stintInfo, timeToPitIn } from '@/engine/ai'

export const TRACK = buildTrack(trackJson as unknown as TrackJson)

function attr(id: string, name: string, nth = 0): string {
  const re = new RegExp(`id="${id}"[^>]*?\\s${name}="([^"]+)"`, 'g')
  const all = [...svgRaw.matchAll(re)]
  return all[nth]?.[1] ?? ''
}

const lineEl = svgRaw.match(/<line id="start\/fimish" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/)
const lightEl = svgRaw.match(/<rect id="light" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/)
const resinMask = svgRaw.match(/<mask id="resin-mask"[\s\S]*?\sd="([^"]+)"/)

/** Layers of tracks/premium.svg (Figma 2MRW, node 28:3024); racing lines, zones and markers stay invisible */
export const SHAPE = {
  course: attr('full course', 'd'),
  trackOutline: attr('track', 'd'),
  stroke: attr('stroke', 'd'),
  resinMask: resinMask ? resinMask[1] : '',
  resinLine: attr('resin line', 'd'),
  line: lineEl ? lineEl.slice(1, 5).map(Number) : [0, 0, 0, 0],
  light: lightEl ? lightEl.slice(1, 5).map(Number) : [0, 0, 0, 0],
  viewBox: '184 240 1080 1141',
}

/** Class colours and the dark label colour that goes on each */
export const CLASS = ['A', 'B', 'C', 'D']
export const CLASS_COLOR = ['#04b630', '#0090ff', '#e79d13', '#e5484d']
export const CLASS_TEXT = ['#0b2212', '#0f1c2e', '#291800', '#2a1314']

export const us = (r: Race) => r.drivers[0]
export const ourClass = (r: Race, kart: number) => classOf(us(r).perceived[kart])

const CLASS_CENTER = [-0.22, -0.07, 0.07, 0.22]
/** The manager re-rates a kart; the board and the bot use the manager's ratings */
export function setOurClass(r: Race, kart: number, cls: number) {
  us(r).perceived[kart] = CLASS_CENTER[cls]
}

const SLOTS = TRACK.pit.slots
const SLOT_STEP = SLOTS[0] - SLOTS[1] // lane fraction between two parked karts

/** Lane fraction where the k-th waiting driver queues behind the occupied box */
function queueSpot(r: Race, d: Driver): number {
  const occupied = r.drivers.some((o) => o.mode === 'box')
  const waiting = r.drivers.filter((o) => o.mode === 'wait' || o.mode === 'laneIn').sort((a, b) => a.laneT0 - b.laneT0)
  const k = Math.max(0, waiting.indexOf(d))
  return TRACK.pit.boxAt - (k + (occupied ? 1 : 0)) * SLOT_STEP
}

/**
 * Where to draw a driver. In the lane: drives to the third slot (or queues
 * behind it while the box is busy), sits in the first slot's kart for the
 * stop, then drives off along the pit racing line.
 */
export function driverXY(r: Race, d: Driver): [number, number] | null {
  if (d.mode === 'done') return null
  if (d.mode === 'track') return xyOfTau(TRACK, d.u)
  const prog = (a: number, b: number) => Math.min(1, Math.max(0, (r.t - d.laneT0) / Math.max(0.01, d.laneT1 - d.laneT0))) * (b - a) + a
  if (d.mode === 'laneIn') return pitXY(TRACK, prog(0, queueSpot(r, d)))
  if (d.mode === 'wait') return pitXY(TRACK, queueSpot(r, d))
  if (d.mode === 'box') return pitXY(TRACK, SLOTS[0])
  return pitXY(TRACK, prog(SLOTS[0], 1))
}

/**
 * Target slots of the parked karts. While a driver sits in the first kart the
 * other two stand in slots 2 and 3; once he has left they roll forward to 1 and 2.
 */
export function parkedTargets(r: Race): { kart: number; slot: number }[] {
  const busy = r.drivers.some((o) => o.mode === 'box')
  return r.box.map((kart, i) => ({ kart, slot: SLOTS[i + (busy ? 1 : 0)] }))
}

/** Order as live timing shows it: updated at the line, by laps completed, then by who crossed first */
export function timingOrder(r: Race): Driver[] {
  const cross = new Map(r.drivers.map((d) => [d.id, d.lapTimes.reduce((a, b) => a + b, 0)]))
  return r.drivers.slice().sort((a, b) =>
    b.lapsDone - a.lapsDone || cross.get(a.id)! - cross.get(b.id)! || b.u - a.u)
}

export interface Status {
  label: string
  tone: 'default' | 'muted' | 'hot'
}

/**
 * What the manager can tell about a rival from public data only: stint, laps,
 * the box and his own kart ratings. Rivals' intentions are never shown.
 */
export function publicStatus(r: Race, d: Driver): Status {
  if (d.mode === 'done') return { label: '', tone: 'muted' }
  if (inLane(d)) return { label: 'В питлейне', tone: 'muted' }
  if (d.pitsDone >= r.settings.pits) return { label: '', tone: 'muted' }
  const h = hunger(r, d, us(r).perceived, true)
  if (h === 'burning') return { label: 'Горит', tone: 'hot' }
  if (h === 'locked') return { label: `Ещё ${r.settings.minStint - (d.lapsDone - d.stints[d.stints.length - 1].start)} кр`, tone: 'muted' }
  if (h === 'hungry') return { label: 'Ищет бокс', tone: 'default' }
  return { label: 'Едет мимо', tone: 'muted' }
}

/**
 * Contender and backup for the kart that is first in the box, by the entry rule
 * and the MANAGER's ratings: drivers ordered by the time to the pit entry, keep
 * those who would want this kart.
 */
export function contenders(r: Race): { d: Driver; tEntry: number; hard: boolean }[] {
  const kart = r.box[0]
  const kc = ourClass(r, kart)
  const out: { d: Driver; tEntry: number; hard: boolean }[] = []
  const cand = r.drivers
    .filter((d) => d.mode === 'track' && d.pitsDone < r.settings.pits && !r.flag)
    .map((d) => ({ d, tEntry: timeToPitIn(r, d) }))
    .sort((a, b) => a.tEntry - b.tEntry)
  for (const { d, tEntry } of cand) {
    const si = stintInfo(r, d)
    if (!si.eligible) continue
    const h = hunger(r, d, us(r).perceived, true)
    const gain = ourClass(r, d.kart) - kc
    if (h === 'burning' || gain >= 1) out.push({ d, tEntry, hard: h === 'burning' || gain >= 2 })
    if (out.length >= 3) break
  }
  return out
}

export interface Rejoin {
  wait: number
  kart: number
  queue: number
  ahead: { d: Driver; gap: number } | null
  behind: { d: Driver; gap: number } | null
}

/** If we commit now: which kart, how long under red, and who we come out next to */
export function projectRejoin(r: Race): Rejoin | null {
  const me = us(r)
  if (me.mode !== 'track' || me.pitsDone >= r.settings.pits) return null
  const queue = queueBefore(r, me, true)
  const kart = ribbon(r, queue)[queue.length]
  const wait = expectedWait(r, me, queue)
  const tIn = timeToPitIn(r, me)
  const lane = P.toBox + wait + r.settings.stopTime + me.releaseMargin + r.fromBox
  const dt = tIn + lane
  const myTau = TRACK.tauPitOut
  let ahead: Rejoin['ahead'] = null
  let behind: Rejoin['behind'] = null
  for (const o of r.drivers) {
    if (o === me || o.mode !== 'track') continue
    const tau = (o.u + dt / o.lapT) % 1
    let g = tau - myTau
    if (g > 0.5) g -= 1
    if (g < -0.5) g += 1
    const sec = g * TRACK.refLap
    if (sec >= 0 && (!ahead || sec < ahead.gap)) ahead = { d: o, gap: sec }
    if (sec < 0 && (!behind || sec > behind.gap)) behind = { d: o, gap: sec }
  }
  return { wait, kart, queue: queue.length, ahead, behind }
}

export function fmtTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}
