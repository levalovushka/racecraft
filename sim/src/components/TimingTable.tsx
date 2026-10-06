import { cn } from '@/lib/utils'
import type { Driver, Race } from '@/engine/race'
import { stintInfo } from '@/engine/ai'
import { CLASS_COLOR, CLASS_TEXT, ourClass, publicStatus, timingOrder, us } from '@/sim/model'

// Timing in the manner of a live timing screen: by position, intervals updated
// at the line, average over clean laps, colours like F1 (purple = best of the
// race, green = personal best).

interface LapStats {
  cross: number[] // race time at each completed lap
  clean: number[] // laps without a stop: not lap 1, not the pit lap, not the lap after
  avg: number | null
  best: number | null
  last: number | null
  pitLaps: Set<number> // 1-based laps with a stop
}

function lapStats(r: Race, d: Driver): LapStats {
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
    clean,
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

const fmt = (x: number | null) => (x === null ? '' : x.toFixed(2))

function Spark({ laps, pitLaps, center }: { laps: number[]; pitLaps: Set<number>; center: number | null }) {
  const W = 57
  const H = 14
  const N = 12
  const from = Math.max(0, laps.length - N)
  const pts = laps.slice(from)
  if (pts.length < 2 || center === null) return <svg width={W} height={H} />
  const RANGE = 1 // s above / below the driver's own average
  const x = (i: number) => (i / (N - 1)) * W
  const y = (v: number) => H / 2 + (Math.max(-RANGE, Math.min(RANGE, v - center)) / RANGE) * (H / 2 - 1)
  const segs: string[][] = [[]]
  const dots: [number, number][] = []
  pts.forEach((v, i) => {
    const lap = from + i + 1
    if (pitLaps.has(lap)) {
      dots.push([x(i), H / 2])
      segs.push([])
      return
    }
    segs[segs.length - 1].push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  })
  return (
    <svg width={W} height={H} className="shrink-0 overflow-visible">
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="stroke-foreground/10" strokeWidth={1} />
      {segs.filter((s) => s.length > 1).map((s, i) => (
        <polyline key={i} points={s.join(' ')} fill="none" className="stroke-foreground/60" strokeWidth={1} />
      ))}
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.8} className="fill-sky-500" />
      ))}
    </svg>
  )
}

export function TimingTable({ race }: { race: Race }) {
  const stats = new Map(race.drivers.map((d) => [d.id, lapStats(race, d)]))
  const rows = timingOrder(race)
  const bests = [...stats.values()].map((s) => s.best).filter((x): x is number => x !== null)
  const raceBest = bests.length ? Math.min(...bests) : null
  const me = us(race)

  return (
    <div className="text-[13px] tabular-nums">
      <div className="grid grid-cols-[32px_112px_40px_56px_64px_76px_112px_48px_44px_minmax(0,1fr)] gap-x-3 px-2 pb-2 text-muted-foreground">
        <span>P</span>
        <span><span className="mr-1.5 inline-block w-4">#</span>Пилот</span>
        <span>Карт</span>
        <span>Отрыв</span>
        <span>Средний</span>
        <span>Лучший</span>
        <span>Последний круг</span>
        <span>Питы</span>
        <span>Стинт</span>
        <span>Статус</span>
      </div>
      <div className="border-t border-foreground/10">
        {rows.map((d, i) => {
          const s = stats.get(d.id)!
          const gap = i === 0 ? null : interval(s, stats.get(rows[i - 1].id)!, race.t)
          const cur = d.stints[d.stints.length - 1]
          const onKart = Math.max(0, d.lapsDone - cur.start)
          const out = d.pitsDone >= race.settings.pits
          const status = publicStatus(race, d)
          const deadline = !out && d.mode === 'track' && stintInfo(race, d).margin <= 3
          const bestTone = s.best !== null && s.best === raceBest ? 'text-violet-400' : ''
          const lastTone =
            s.last === null || s.pitLaps.has(d.lapTimes.length) ? 'text-muted-foreground'
              : s.last === raceBest ? 'text-violet-400'
              : s.last === s.best ? 'text-emerald-400' : ''
          return (
            <div
              key={d.id}
              className={cn(
                'grid h-[26px] grid-cols-[32px_112px_40px_56px_64px_76px_112px_48px_44px_minmax(0,1fr)] items-center gap-x-3 rounded-md px-2',
                d === me && 'bg-foreground/[0.06]',
              )}
            >
              <span>{i + 1}</span>
              <span className="truncate">
                <span className="mr-1.5 inline-block w-4 text-muted-foreground">{String(d.num).padStart(2, '0')}</span>
                {d.name}
              </span>
              <span>
                <span
                  className="flex size-[18px] items-center justify-center rounded-full text-[10px] font-semibold tracking-tight"
                  style={{ background: CLASS_COLOR[ourClass(race, d.kart)], color: CLASS_TEXT[ourClass(race, d.kart)] }}
                >
                  {race.karts[d.kart].label}
                </span>
              </span>
              <span>{i === 0 ? '—' : gap === null ? '' : `+${fmt(gap)}`}</span>
              <span>{fmt(s.avg)}</span>
              <span className={bestTone}>{fmt(s.best)}</span>
              <span className="flex items-center gap-1">
                <Spark laps={d.lapTimes} pitLaps={s.pitLaps} center={s.avg} />
                <span className={lastTone}>{fmt(s.last)}</span>
              </span>
              <span className={out ? 'text-muted-foreground' : ''}>{d.pitsDone} / {race.settings.pits}</span>
              <span className={deadline ? 'text-rose-500' : ''}>{onKart}</span>
              <span className={cn('truncate', status.tone === 'hot' && 'text-rose-500', status.tone === 'muted' && 'text-muted-foreground')}>
                {status.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
