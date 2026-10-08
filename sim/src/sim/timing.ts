// Live timing figures: lap times as published at the line, positions and intervals live from the track.
import { distance, order, type Driver, type Race } from '@/engine/race'

export interface LapStats {
  avg: number | null // over clean laps: not lap 1, not the pit lap, not the lap after
  best: number | null
  last: number | null
  pitLaps: Set<number> // 1-based laps with a stop
}

export function lapStats(r: Race, d: Driver): LapStats {
  const pitLaps = new Set(r.pits.filter((p) => p.driver === d.id).map((p) => p.lap))
  const clean = d.lapTimes.filter((_, i) => {
    const lap = i + 1
    return lap > 1 && !pitLaps.has(lap) && !pitLaps.has(lap - 1)
  })
  const nonPit = d.lapTimes.filter((_, i) => i > 0 && !pitLaps.has(i + 1))
  return {
    avg: clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null,
    best: nonPit.length ? Math.min(...nonPit) : null,
    last: d.lapTimes.at(-1) ?? null,
    pitLaps,
  }
}

/**
 * Live gap to the car ahead, in seconds: the distance between them at our own
 * clean pace. Two finishers on the same lap: the gap at the flag.
 */
function interval(r: Race, me: Driver, stats: LapStats, ahead: Driver): number {
  if (me.mode === 'done' && ahead.mode === 'done' && me.lapsDone === ahead.lapsDone) {
    return Math.max(0, me.finishTime! - ahead.finishTime!)
  }
  const pace = stats.avg ?? stats.last ?? r.track.refLap
  return Math.max(0, (distance(r, ahead) - distance(r, me)) * pace)
}

export interface TimingRow {
  d: Driver
  pos: number
  stats: LapStats
  gap: number | null // to the car ahead
}

export function timing(r: Race): TimingRow[] {
  const live = order(r)
  const stats = live.map((d) => lapStats(r, d))
  return live.map((d, i) => ({ d, pos: i + 1, stats: stats[i], gap: i === 0 ? null : interval(r, d, stats[i], live[i - 1]) }))
}

export const fmtLap = (x: number | null) => (x === null ? '' : x.toFixed(2))

/**
 * Virtual position: the order once everyone has made the stops still ahead of
 * them. Each driver's live gap to the leader (the sum of the intervals) plus the
 * pit loss for every stop still to make; a stop counts as made from the lane entry.
 */
// ponytail: while a driver is in the lane his forecast is rough (the loss builds up in the gap until he rejoins); add the lane time left if that matters
export function virtualOrder(r: Race, rows: TimingRow[] = timing(r)): Map<number, number> {
  let behind = 0
  const projected = rows.map(({ d, gap }) => {
    behind += gap ?? 0
    const made = d.pitsDone + (d.mode === 'laneIn' || d.mode === 'wait' ? 1 : 0)
    return { id: d.id, t: behind + Math.max(0, r.settings.pits - made) * r.settings.pitLoss }
  })
  projected.sort((a, b) => a.t - b.t)
  return new Map(projected.map((x, i) => [x.id, i + 1]))
}
