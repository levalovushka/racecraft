import { cn } from '@/lib/utils'
import type { Race } from '@/engine/race'
import { stintInfo } from '@/engine/ai'
import { ourClass, publicStatus, setOurClass, us } from '@/sim/model'
import { fmtLap, timing } from '@/sim/timing'
import { Kart } from './KartBadge'
import { driverName, useT, type Dict } from '@/i18n'
import type { Status } from '@/sim/model'

// column widths: position, driver, kart, interval, last, best, average, stint, stops, status
const COLS = ['2.25rem', '18%', '3.5rem', '10%', '9%', '9%', '9%', '8%', '6%', 'auto']
const TH = 'h-8 px-2 text-left align-middle font-normal caption'
const TD = 'h-[clamp(1.5rem,3.2vh,1.875rem)] border-t px-2 align-middle'

export function TimingTable({ race, onChange }: { race: Race; onChange: () => void }) {
  const t = useT()
  const rows = timing(race)
  const me = us(race)
  const N = race.settings.pits

  return (
    <table className="w-full table-fixed text-data tnum">
      <caption className="sr-only">{t.liveTiming}</caption>
      <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
      <thead>
        <tr>
          <th scope="col" className={cn(TH, 'pl-3')}>{t.cols.pos}</th>
          <th scope="col" className={TH}>{t.cols.driver}</th>
          <th scope="col" className={TH} title={t.kartHint}>{t.cols.kart}</th>
          <th scope="col" className={cn(TH, 'text-right')}>{t.cols.interval}</th>
          <th scope="col" className={cn(TH, 'text-right')}>{t.cols.last}</th>
          <th scope="col" className={cn(TH, 'text-right')}>{t.cols.best}</th>
          <th scope="col" className={cn(TH, 'text-right')}>{t.cols.avg}</th>
          <th scope="col" className={cn(TH, 'text-right')} title={t.stintHint}>{t.cols.stint}</th>
          <th scope="col" className={cn(TH, 'text-right')}>{t.cols.stops}</th>
          <th scope="col" className={cn(TH, 'pl-5')}>{t.cols.status}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ d, pos, stats: s, gap }) => {
          const out = d.pitsDone >= N
          const status = publicStatus(race, d)
          const deadline = !out && d.mode === 'track' && stintInfo(race, d).margin <= 3
          const isUs = d === me
          const pitLap = s.last !== null && s.pitLaps.has(d.lapTimes.length)
          return (
            <tr key={d.id} className={cn(isUs && 'font-semibold')} aria-current={isUs ? 'true' : undefined}>
              <td className={cn(TD, 'relative pl-3', isUs && 'before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground')}>{pos}</td>
              <th scope="row" className={cn(TD, 'text-left', isUs ? 'font-semibold' : 'font-normal')}>
                <span className="block truncate" title={driverName(t, d)}>{driverName(t, d)}</span>
              </th>
              <td className={TD}>
                <Kart label={race.karts[d.kart].label} cls={ourClass(race, d.kart)}
                  onClick={() => { setOurClass(race, d.kart, (ourClass(race, d.kart) + 1) % 4); onChange() }} />
              </td>
              <td className={cn(TD, 'text-right')}>{pos === 1 ? <span className="font-normal text-muted-foreground">{t.leader}</span> : gap === null ? '' : `+${fmtLap(gap)}`}</td>
              <td className={cn(TD, 'text-right', pitLap && 'text-muted-foreground')}>{fmtLap(s.last)}</td>
              <td className={cn(TD, 'text-right')}>{fmtLap(s.best)}</td>
              <td className={cn(TD, 'text-right text-muted-foreground')}>{fmtLap(s.avg)}</td>
              <td className={cn(TD, 'text-right', deadline && 'text-hot')}>{Math.max(0, d.lapsDone - d.stints[d.stints.length - 1].start)}</td>
              <td className={cn(TD, 'text-right', out && 'text-muted-foreground')}>{d.pitsDone}/{N}</td>
              <td title={statusText(t, status)} className={cn(TD, 'truncate pl-5 font-normal', status.kind === 'burning' ? 'text-hot' : 'text-muted-foreground')}>{statusText(t, status)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function statusText(t: Dict, s: Status): string {
  switch (s.kind) {
    case 'pit': return t.status.pit
    case 'burning': return t.status.burning
    case 'toMin': return t.status.toMin(t.laps(s.laps))
    case 'hungry': return t.status.hungry
    default: return ''
  }
}
