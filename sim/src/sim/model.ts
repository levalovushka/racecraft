// View helpers on top of the engine: positions for drawing, what the manager's
// board would compute (contender, backup, rejoin point), track shapes.
import trackJson from '../../../tracks/premium-std.json'
import svgRaw from '../../../tracks/premium.svg?raw'
import { classOf, inLane, P, type Driver, type Race } from '@/engine/race'
import { buildTrack, pitXY, sOfTau, xyOfS, xyOfTau, type TrackJson } from '@/engine/track'
import { expectedWait, hunger, queueBefore, ribbon, stintInfo, timeToPitIn } from '@/engine/ai'

export const TRACK = buildTrack(trackJson as unknown as TrackJson)

function attr(id: string, name: string): string {
  const m = svgRaw.match(new RegExp(`id="${id}"[^>]*?\\s${name}="([^"]+)"`))
  return m ? m[1] : ''
}

const lineEl = svgRaw.match(/<line id="start\/fimish" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/)

export const SHAPE = {
  track: attr('track', 'd'),
  pitlane: attr('pitlane', 'd'),
  line: lineEl ? lineEl.slice(1, 5).map(Number) : [0, 0, 0, 0],
  viewBox: (() => {
    const pts = [...TRACK.xy, ...TRACK.pit.xy]
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const m = 90
    const x0 = Math.min(...xs) - m
    const y0 = Math.min(...ys) - m
    const boxBottom = pitXY(TRACK, TRACK.pit.boxAt)[1] + 170 // room for the box drawn under the pit lane
    return `${x0} ${y0} ${Math.max(...xs) - x0 + m} ${Math.max(Math.max(...ys) + m, boxBottom) - y0}`
  })(),
  zones: TRACK.zones.map(([a, b]) => {
    const s0 = sOfTau(TRACK, a)
    let s1 = sOfTau(TRACK, b)
    if (s1 < s0) s1 += 1
    const pts: string[] = []
    for (let s = s0; s <= s1; s += 0.004) pts.push(xyOfS(TRACK, s).join(','))
    return pts.join(' ')
  }),
  decision: xyOfTau(TRACK, TRACK.tauDecision),
  box: pitXY(TRACK, TRACK.pit.boxAt),
}

export const CLASS = ['A', 'B', 'C', 'D']
export const CLASS_COLOR = ['#10b981', '#0ea5e9', '#f59e0b', '#f43f5e']

export const us = (r: Race) => r.drivers[0]
export const ourClass = (r: Race, kart: number) => classOf(us(r).perceived[kart])

const CLASS_CENTER = [-0.22, -0.07, 0.07, 0.22]
/** The manager re-rates a kart; the board and the bot use the manager's ratings */
export function setOurClass(r: Race, kart: number, cls: number) {
  us(r).perceived[kart] = CLASS_CENTER[cls]
}

/** Where to draw a driver */
export function driverXY(r: Race, d: Driver): [number, number] | null {
  if (d.mode === 'done') return null
  if (d.mode === 'track') return xyOfTau(TRACK, d.u)
  const boxAt = TRACK.pit.boxAt
  const prog = (a: number, b: number) => Math.min(1, Math.max(0, (r.t - d.laneT0) / Math.max(0.01, d.laneT1 - d.laneT0))) * (b - a) + a
  if (d.mode === 'laneIn') return pitXY(TRACK, prog(0, boxAt))
  if (d.mode === 'laneOut') return pitXY(TRACK, prog(boxAt, 1))
  // waiting at the light / standing in the box
  const [x, y] = pitXY(TRACK, boxAt)
  return d.mode === 'wait' ? [x + 28, y - 4] : [x, y]
}

export function gapToLeader(d: Driver, leader: Driver): string {
  if (d === leader) return '—'
  const laps = leader.lapsDone - d.lapsDone
  const g = (leader.u - d.u) * TRACK.refLap
  if (laps >= 1 && leader.u - d.u >= 1) return `+${Math.floor(leader.u - d.u)} кр`
  return `+${g.toFixed(1)}`
}

export const HUNGER_LABEL: Record<string, string> = {
  out: 'вне игры',
  locked: 'мин. стинт',
  burning: 'горит',
  hungry: 'голодный',
  full: 'сытый',
}

export function statusOf(r: Race, d: Driver): { label: string; tone: 'muted' | 'warn' | 'hot' | 'info' | 'ok' } {
  if (d.mode === 'done') return { label: 'финиш', tone: 'muted' }
  if (inLane(d)) return { label: d.mode === 'wait' ? 'ждёт зелёный' : 'пит-лейн', tone: 'info' }
  if (d.commit) return { label: 'едет в бокс', tone: 'info' }
  const h = hunger(r, d, us(r).perceived)
  const tone = h === 'burning' ? 'hot' : h === 'hungry' ? 'warn' : h === 'full' ? 'ok' : 'muted'
  return { label: HUNGER_LABEL[h], tone }
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
    const h = hunger(r, d, us(r).perceived)
    const gain = ourClass(r, d.kart) - kc
    if (h === 'burning' || gain >= 1 || d.commit) out.push({ d, tEntry, hard: h === 'burning' || gain >= 2 || d.commit })
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
  const queue = queueBefore(r, me)
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
