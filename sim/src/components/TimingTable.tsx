import { cn } from '@/lib/utils'
import type { Race } from '@/engine/race'
import { stintInfo } from '@/engine/ai'
import { ourClass, publicStatus, setOurClass, us } from '@/sim/model'
import { fmtLap, timing } from '@/sim/timing'
import { Kart } from './KartBadge'

const COLS = 'grid-cols-[1.75rem_minmax(8rem,2fr)_2.5rem_minmax(4rem,1fr)_minmax(3.5rem,1fr)_minmax(3.5rem,1fr)_minmax(3.5rem,1fr)_minmax(2.5rem,0.7fr)_minmax(2.5rem,0.7fr)_minmax(7rem,1.6fr)]'

export function TimingTable({ race, onChange }: { race: Race; onChange: () => void }) {
  const rows = timing(race)
  const me = us(race)
  const N = race.settings.pits

  return (
    <div className="text-[0.8125rem] tnum">
      <div className={cn('grid h-8 items-center gap-x-4 px-3 caption', COLS)}>
        <span>Pos</span>
        <span>Driver</span>
        <span title="Your class rating. Click a kart to change it">Kart</span>
        <span className="text-right">Interval</span>
        <span className="text-right">Last</span>
        <span className="text-right">Best</span>
        <span className="text-right">Average</span>
        <span className="text-right">Stint</span>
        <span className="text-right">Stops</span>
        <span className="pl-2">Status</span>
      </div>
      {rows.map(({ d, pos, stats: s, gap }) => {
        const out = d.pitsDone >= N
        const status = publicStatus(race, d)
        const deadline = !out && d.mode === 'track' && stintInfo(race, d).margin <= 3
        const isUs = d === me
        const pitLap = s.last !== null && s.pitLaps.has(d.lapTimes.length)
        return (
          <div
            key={d.id}
            className={cn('relative grid h-[clamp(1.5rem,3.2vh,1.875rem)] items-center gap-x-4 border-t px-3', COLS,
              isUs && 'font-semibold before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground')}
          >
            <span>{pos}</span>
            <span className="flex min-w-0 items-baseline gap-2.5">
              <span className="w-5 shrink-0 text-xs font-normal text-muted-foreground">{d.num}</span>
              <span className="truncate">{d.name}</span>
            </span>
            <span>
              <Kart size="sm" label={race.karts[d.kart].label} cls={ourClass(race, d.kart)}
                onClick={() => { setOurClass(race, d.kart, (ourClass(race, d.kart) + 1) % 4); onChange() }} />
            </span>
            <span className="text-right">{pos === 1 ? <span className="font-normal text-muted-foreground">Leader</span> : gap === null ? '' : `+${fmtLap(gap)}`}</span>
            <span className={cn('text-right', pitLap && 'text-muted-foreground')}>{fmtLap(s.last)}</span>
            <span className="text-right">{fmtLap(s.best)}</span>
            <span className="text-right text-muted-foreground">{fmtLap(s.avg)}</span>
            <span className={cn('text-right', deadline && 'text-hot')}>{Math.max(0, d.lapsDone - d.stints[d.stints.length - 1].start)}</span>
            <span className={cn('text-right', out && 'text-muted-foreground')}>{d.pitsDone}/{N}</span>
            <span className={cn('truncate pl-2 font-normal', status.tone === 'hot' ? 'text-hot' : 'text-muted-foreground')}>{status.label}</span>
          </div>
        )
      })}
    </div>
  )
}
