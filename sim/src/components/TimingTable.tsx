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
  const W = 48
  const H = 14
  const N = 12
  const from = Math.max(0, laps.length - N)
  const pts = laps.slice(from)
  if (pts.length < 2 || center === null) return <svg width={W} height={H} className="shrink-0" />
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
        <polyline key={i} points={s.join(' ')} fill="none" className="stroke-foreground/45" strokeWidth={1} strokeLinejoin="round" />
      ))}
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={2} className="fill-foreground" />
      ))}
    </svg>
  )
}

const COLS = 'grid-cols-[1.5rem_minmax(8rem,13rem)_2rem_4.25rem_7.25rem_3.5rem_3.5rem_2.75rem_2.75rem_minmax(6.5rem,1fr)] @min-[1100px]:grid-cols-[1.5rem_11rem_2rem_4.25rem_7.25rem_3.5rem_3.5rem_2.75rem_2.75rem_6.5rem]'

export function TimingTable({ race }: { race: Race }) {
  const stats = new Map(race.drivers.map((d) => [d.id, lapStats(race, d)]))
  const rows = timingOrder(race)
  const bests = [...stats.values()].map((s) => s.best).filter((x): x is number => x !== null)
  const raceBest = bests.length ? Math.min(...bests) : null
  const me = us(race)

  return (
    <div className="text-[0.8125rem] tnum">
      <div className={cn('grid h-7 items-center gap-x-3 px-2 label-caps', COLS)}>
        <span>P</span>
        <span>Пилот</span>
        <span>Карт</span>
        <span className="text-right">Интервал</span>
        <span className="text-right">Последний</span>
        <span className="text-right">Лучший</span>
        <span className="text-right">Средний</span>
        <span className="text-right">Стинт</span>
        <span className="text-center">Питы</span>
        <span>Статус</span>
      </div>
      <div>
        {rows.map((d, i) => {
          const s = stats.get(d.id)!
          const gap = i === 0 ? null : interval(s, stats.get(rows[i - 1].id)!, race.t)
          const cur = d.stints[d.stints.length - 1]
          const onKart = Math.max(0, d.lapsDone - cur.start)
          const out = d.pitsDone >= race.settings.pits
          const status = publicStatus(race, d)
          const deadline = !out && d.mode === 'track' && stintInfo(race, d).margin <= 3
          const bestTone = s.best !== null && s.best === raceBest ? 'text-best' : ''
          const lastTone =
            s.last === null || s.pitLaps.has(d.lapTimes.length) ? 'text-muted-foreground'
              : s.last === raceBest ? 'text-best'
              : s.last === s.best ? 'text-ok' : ''
          const isUs = d === me
          return (
            <div
              key={d.id}
              className={cn(
                'relative grid h-[clamp(1.5rem,3.25vh,1.875rem)] items-center gap-x-3 rounded-md px-2',
                COLS,
                isUs ? 'bg-foreground/[0.08] font-medium before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground' : 'odd:bg-foreground/[0.018]',
              )}
            >
              <span className={isUs ? '' : 'text-muted-foreground'}>{i + 1}</span>
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="w-5 shrink-0 text-[0.6875rem] text-faint">{String(d.num).padStart(2, '0')}</span>
                <span className="truncate">{d.name}</span>
              </span>
              <span>
                <span
                  className="flex size-[1.25rem] items-center justify-center rounded-full text-[0.625rem] font-semibold tracking-tight"
                  style={{ background: CLASS_COLOR[ourClass(race, d.kart)], color: CLASS_TEXT[ourClass(race, d.kart)] }}
                >
                  {race.karts[d.kart].label}
                </span>
              </span>
              <span className="text-right">{i === 0 ? <span className="text-muted-foreground">Лидер</span> : gap === null ? '' : `+${fmt(gap)}`}</span>
              <span className="flex items-center justify-end gap-2">
                <Spark laps={d.lapTimes} pitLaps={s.pitLaps} center={s.avg} />
                <span className={cn('w-[2.75rem] text-right', lastTone)}>{fmt(s.last)}</span>
              </span>
              <span className={cn('text-right', bestTone)}>{fmt(s.best)}</span>
              <span className="text-right text-muted-foreground">{fmt(s.avg)}</span>
              <span className={cn('text-right', deadline && 'font-semibold text-hot')}>{onKart}</span>
              <span className="flex items-center justify-center gap-1" aria-label={`Питы ${d.pitsDone} из ${race.settings.pits}`}>
                {Array.from({ length: race.settings.pits }, (_, k) => (
                  <span key={k} className={cn('size-1.5 rounded-full', k < d.pitsDone ? 'bg-foreground/80' : 'ring-1 ring-foreground/25 ring-inset')} />
                ))}
              </span>
              <span className={cn('truncate text-xs', status.tone === 'hot' ? 'font-semibold text-hot' : status.tone === 'muted' ? 'text-muted-foreground' : 'text-foreground/90')}>
                {status.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
