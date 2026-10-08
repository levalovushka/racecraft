import { cn } from '@/lib/utils'
import { CLASS_COLOR } from '@/sim/model'
import { useT } from '@/i18n'

export interface RibbonStint {
  from: number // laps completed when the stint started counting
  to: number
  cls: number
  label: number
}

/**
 * The race on one line: stints on their kart colour, the current lap, the laps
 * still locked by the minimum stint and the last lap the next stop can start.
 */
export function StintRibbon({ laps, stints, now, locked, deadline, showLabels, className }: {
  laps: number
  stints: RibbonStint[]
  now?: number
  locked?: [number, number] | null
  deadline?: number | null
  showLabels?: boolean
  className?: string
}) {
  const t = useT()
  const x = (l: number) => `${(Math.max(0, Math.min(laps, l)) / laps) * 100}%`
  const w = (a: number, b: number) => `${(Math.max(0, Math.min(laps, b) - Math.max(0, a)) / laps) * 100}%`
  return (
    <div className={cn('relative', className)}>
      <div className="relative h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
        {stints.map((s, i) => (
          <div
            key={i}
            className="absolute inset-y-0 border-r-2 border-card last:border-r-0"
            style={{ left: x(s.from), width: w(s.from, s.to), background: CLASS_COLOR[s.cls] }}
          />
        ))}
        {locked && locked[1] > locked[0] && (
          <div
            className="absolute inset-y-0 opacity-50"
            style={{
              left: x(locked[0]),
              width: w(locked[0], locked[1]),
              backgroundImage: 'repeating-linear-gradient(135deg, var(--muted-foreground) 0 1.5px, transparent 1.5px 5px)',
            }}
          />
        )}
      </div>
      {deadline != null && deadline >= 0 && deadline <= laps && (
        <div className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-hot" style={{ left: x(deadline) }} title={t.lastStopLap(deadline + 1)} />
      )}
      {now != null && (
        <div className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-foreground shadow-[0_0_0_2px_var(--card)]" style={{ left: x(now) }} />
      )}
      {showLabels && (
        <div className="relative mt-1.5 h-4 text-[0.6875rem] text-muted-foreground tnum">
          {stints.map((s, i) => (
            <span key={i} className="absolute truncate pl-0.5" style={{ left: x(s.from), width: w(s.from, s.to) }}>
              {s.label} · {t.laps(Math.round(s.to - s.from))}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
