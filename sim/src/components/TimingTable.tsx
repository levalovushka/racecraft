import { cn } from '@/lib/utils'
import type { Driver, Race } from '@/engine/race'
import { CLASS_COLOR, CLASS_TEXT, ourClass, timingOrder, us } from '@/sim/model'

// Timing in the manner of a live timing screen: by position, gaps updated at
// the line, average over clean laps, colours like F1 (purple = best of the
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

const COLS = 'grid grid-cols-[28px_124px_40px_80px_124px_68px_68px] items-center gap-x-5 px-2.5'

export function KartChip({ race, kart, onClick }: { race: Race; kart: number; onClick?: () => void }) {
  const c = ourClass(race, kart)
  const cls = 'flex size-[18px] items-center justify-center rounded-full text-[10px] font-medium tracking-[-0.6px]'
  const style = { background: CLASS_COLOR[c], color: CLASS_TEXT[c] }
  if (!onClick) return <span className={cls} style={style}>{race.karts[kart].label}</span>
  return (
    <button type="button" onClick={onClick} title="Сменить класс карта" className={cn(cls, 'transition-transform hover:scale-110')} style={style}>
      {race.karts[kart].label}
    </button>
  )
}

/** Gap to the leader at the line, in seconds, lapped cars included */
function toLeader(me: LapStats, leader: LapStats): number | null {
  const n = me.cross.length
  if (n === 0 || leader.cross.length < n) return null
  return Math.max(0, me.cross[n - 1] - leader.cross[n - 1])
}

export function TimingTable({ race, onKart }: { race: Race; onKart: (kart: number) => void }) {
  const stats = new Map(race.drivers.map((d) => [d.id, lapStats(race, d)]))
  const rows = timingOrder(race)
  const bests = [...stats.values()].map((s) => s.best).filter((x): x is number => x !== null)
  const raceBest = bests.length ? Math.min(...bests) : null
  const me = us(race)
  const leader = stats.get(rows[0].id)!

  return (
    <div className="text-[12px] tabular-nums">
      <div className={cn(COLS, 'h-[27px] border-b border-white/10 text-white/40')}>
        <span>P</span>
        <span><span className="mr-1 inline-block w-[17px]">#</span>Пилот</span>
        <span>Карт</span>
        <span>Лидер</span>
        <span>Последний круг</span>
        <span>Средний</span>
        <span>Лучший</span>
      </div>
      <div className="pt-1">
        {rows.map((d, i) => {
          const s = stats.get(d.id)!
          const gap = i === 0 ? null : toLeader(s, leader)
          const bestTone = s.best !== null && s.best === raceBest ? 'text-[#9a6cff]' : ''
          const lastTone =
            s.last === null || s.pitLaps.has(d.lapTimes.length) ? 'text-white/40'
              : s.last === raceBest ? 'text-[#9a6cff]'
              : s.last === s.best ? 'text-[#04b630]' : ''
          return (
            <div key={d.id} className={cn(COLS, 'h-[26px] rounded-[4px]', d === me && 'bg-white/[0.08]')}>
              <span>{i + 1}</span>
              <span className="truncate">
                <span className="mr-1 inline-block w-[17px] text-white/40">{String(d.num).padStart(2, '0')}</span>
                {d.name}
              </span>
              <span><KartChip race={race} kart={d.kart} onClick={() => onKart(d.kart)} /></span>
              <span>{i === 0 ? '-' : gap === null ? '' : `+${fmt(gap)}`}</span>
              <span className="flex items-center gap-1">
                <span className={cn('w-[34px]', lastTone)}>{fmt(s.last)}</span>
                <Spark laps={d.lapTimes} pitLaps={s.pitLaps} center={s.avg} />
              </span>
              <span>{fmt(s.avg)}</span>
              <span className={bestTone}>{fmt(s.best)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
