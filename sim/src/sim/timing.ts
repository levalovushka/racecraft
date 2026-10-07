// Live timing figures, as a timing screen shows them: updated at the line.
import type { Driver, Race } from '@/engine/race'
import { timingOrder } from './model'

export interface LapStats {
  cross: number[] // race time at each completed lap
  avg: number | null // over clean laps: not lap 1, not the pit lap, not the lap after
  best: number | null
  last: number | null
  pitLaps: Set<number> // 1-based laps with a stop
}

export function lapStats(r: Race, d: Driver): LapStats {
  const pitLaps = new Set(r.pits.filter((p) => p.driver === d.id).map((p) => p.lap))
  const cross: number[] = []
  let t = 0
  for (const x of d.lapTimes) cross.push((t += x))
  const clean = d.lapTimes.filter((_, i) => {
    const lap = i + 1
    return lap > 1 && !pitLaps.has(lap) && !pitLaps.has(lap - 1)
  })
  const nonPit = d.lapTimes.filter((_, i) => i > 0 && !pitLaps.has(i + 1))
  return {
    cross,
    avg: clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null,
    best: nonPit.length ? Math.min(...nonPit) : null,
    last: d.lapTimes.at(-1) ?? null,
    pitLaps,
  }
}

/**
 * Gap to the car ahead at the line, in seconds, lapped cars included. If the car
 * ahead has already crossed the line once more than we have (we are in the pit
 * lane, or simply slower), the gap is at least the time since that crossing.
 */
function interval(me: LapStats, ahead: LapStats | null, now: number): number | null {
  if (!ahead) return null
  const n = me.cross.length
  if (n === 0 || ahead.cross.length < n) return null
  const atLine = me.cross[n - 1] - ahead.cross[n - 1]
  if (ahead.cross.length > n) return Math.max(atLine, now - ahead.cross[n])
  return Math.max(0, atLine)
}

export interface TimingRow {
  d: Driver
  pos: number
  stats: LapStats
  gap: number | null // to the car ahead
}

export function timing(r: Race): TimingRow[] {
  const order = timingOrder(r)
  const stats = order.map((d) => lapStats(r, d))
  return order.map((d, i) => ({ d, pos: i + 1, stats: stats[i], gap: i === 0 ? null : interval(stats[i], stats[i - 1], r.t) }))
}

export const fmtLap = (x: number | null) => (x === null ? '' : x.toFixed(2))
