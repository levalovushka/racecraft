import { useEffect, type ReactNode } from 'react'
import { ArrowRight, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { inLane, raceLap, type Order, type Race, type Settings } from '@/engine/race'
import { stintInfo, timeToDecision, timeToPitIn } from '@/engine/ai'
import { useSim } from '@/sim/useSim'
import { contenders, fmtTime, ourClass, projectRejoin, setOurClass, us } from '@/sim/model'
import { fmtLap, timing } from '@/sim/timing'
import { TrackView } from './TrackView'
import { TimingTable } from './TimingTable'
import { Kart } from './KartBadge'
import { StintRibbon } from './StintRibbon'
import { Kbd, Panel, Wordmark } from './kit'

const SPEEDS = [1, 2, 4, 8, 16]

export function RaceScreen({ settings, onFinish }: { settings: Settings; onFinish: (r: Race) => void }) {
  const sim = useSim(settings)
  const { race, paused, setPaused, speed, setSpeed, command } = sim

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'b' || k === 'и') command('box')
      else if (k === 'c' || k === 'с') command('boxIfClear')
      else if (k === 's' || k === 'ы') command('stay')
      else if (k === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (/^[1-5]$/.test(k)) setSpeed(SPEEDS[Number(k) - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [command, setPaused, setSpeed])

  const rerate = (kart: number) => {
    setOurClass(race, kart, (ourClass(race, kart) + 1) % 4)
    sim.refresh()
  }

  return (
    <div className="flex h-screen min-h-[40rem] flex-col gap-3 p-3">
      <TopBar race={race} paused={paused} speed={speed} onPause={() => setPaused((p) => !p)} onSpeed={setSpeed} onFinish={() => onFinish(race)} />
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(23rem,28vw,31rem)] gap-3">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 px-4 pb-2">
              <TrackView race={race} />
            </div>
            <Ticker race={race} />
          </div>
          <Panel className="shrink-0 px-1 pt-1 pb-2">
            <TimingTable race={race} onChange={sim.refresh} />
          </Panel>
        </div>
        <aside className="flex min-h-0 flex-col gap-3">
          <YouPanel race={race} />
          <CallPanel race={race} command={command} rerate={rerate} />
        </aside>
      </main>
    </div>
  )
}

function TopBar({ race, paused, speed, onPause, onSpeed, onFinish }: {
  race: Race
  paused: boolean
  speed: number
  onPause: () => void
  onSpeed: (s: number) => void
  onFinish: () => void
}) {
  const laps = race.settings.laps
  const lap = Math.min(raceLap(race), laps)
  return (
    <header className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-2">
      <div className="flex min-w-0 items-center gap-4">
        <Wordmark />
        <span className="truncate caption">Premium · seed {race.settings.seed}</span>
      </div>
      <div className="flex items-center gap-4 tnum">
        <span className="text-sm text-muted-foreground">Lap <span className="text-base font-semibold text-foreground">{lap}</span> / {laps}</span>
        <div className="h-0.5 w-[clamp(6rem,12vw,14rem)] rounded-full bg-foreground/15">
          <div className="h-full rounded-full bg-foreground" style={{ width: `${(Math.min(race.drivers[0].u, laps) / laps) * 100}%` }} />
        </div>
        <span className="w-24 text-sm text-muted-foreground">
          {race.flag ? 'Flag' : paused && !race.finished ? 'Paused' : fmtTime(race.t)}
        </span>
      </div>
      <div className="flex items-center justify-end gap-1">
        {!race.finished && (
          <>
            <Button variant="ghost" size="icon" onClick={onPause} title="Space" aria-label={paused ? 'Play' : 'Pause'}>
              {paused ? <Play /> : <Pause />}
            </Button>
            <div className="flex" role="radiogroup" aria-label="Speed">
              {SPEEDS.map((s, i) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={speed === s}
                  onClick={() => onSpeed(s)}
                  title={`Key ${i + 1}`}
                  className={cn('h-8 w-9 rounded-md text-xs tnum transition-colors',
                    speed === s ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  {s}×
                </button>
              ))}
            </div>
          </>
        )}
        {race.flag && (
          <Button size="lg" onClick={onFinish} className="ml-2 px-3.5">
            Debrief <ArrowRight />
          </Button>
        )}
      </div>
    </header>
  )
}

function Figure({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: 'hot' }) {
  return (
    <div className="min-w-0">
      <div className="truncate caption">{label}</div>
      <div className={cn('mt-1 text-[1.0625rem] font-medium tnum', tone === 'hot' && 'text-hot')}>{value}</div>
    </div>
  )
}

function YouPanel({ race }: { race: Race }) {
  const me = us(race)
  const s = race.settings
  const rows = timing(race)
  const i = rows.findIndex((r) => r.d === me)
  const mine = rows[i]
  const ahead = rows[i - 1]
  const behind = rows[i + 1]
  const si = stintInfo(race, me)
  const cur = me.stints[me.stints.length - 1]
  const onKart = Math.max(0, me.lapsDone - cur.start)
  const out = me.pitsDone >= s.pits
  const latest = s.laps - (s.pits - me.pitsDone) * s.minStint

  let status: string
  let hot = false
  if (me.mode === 'done') status = 'Finished'
  else if (me.mode === 'wait') { status = 'Waiting for green'; hot = true }
  else if (inLane(me)) status = 'In the pit lane'
  else if (out) status = 'All stops done'
  else if (!si.eligible) status = `Min stint · ${s.minStint - si.curLen} laps to go`
  else if (si.margin < 0) { status = 'Overstaying · +10 s a lap'; hot = true }
  else if (si.margin <= 2) { status = `Burning · ${si.margin} laps left`; hot = true }
  else status = `Window open · ${si.margin} laps left`

  return (
    <Panel className="shrink-0 p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{me.name} <span className="font-normal text-muted-foreground">#{me.num}</span></div>
          <div className="mt-1 text-[3.25rem] leading-none font-medium tracking-tighter tnum">P{mine.pos}</div>
        </div>
        <Kart size="lg" letter label={race.karts[me.kart].label} cls={ourClass(race, me.kart)} />
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3">
        <Figure label="Last lap" value={fmtLap(mine.stats.last) || '—'} />
        <Figure label="Best" value={fmtLap(mine.stats.best) || '—'} />
        <Figure label={ahead ? `↑ ${ahead.d.name}` : 'Ahead'} value={mine.gap === null ? '—' : `${fmtLap(mine.gap)}`} />
        <Figure label={behind ? `↓ ${behind.d.name}` : 'Behind'} value={behind?.gap == null ? '—' : `${fmtLap(behind.gap)}`} />
      </div>

      <StintRibbon
        className="mt-5"
        laps={s.laps}
        stints={me.stints.map((x) => ({
          from: x.start,
          to: x.end ?? (me.mode === 'done' ? me.lapsDone : Math.max(x.start, me.u)),
          cls: ourClass(race, x.kart),
          label: race.karts[x.kart].label,
        }))}
        now={me.mode === 'done' ? undefined : Math.min(me.u, s.laps)}
        locked={!out && !si.eligible ? [cur.start, cur.start + s.minStint] : null}
        deadline={out ? null : latest}
      />
      <div className="mt-2.5 flex justify-between gap-3 text-xs tnum">
        <span className={hot ? 'text-hot' : 'text-muted-foreground'}>{status}</span>
        <span className="text-muted-foreground">{onKart} laps on kart · stops {me.pitsDone}/{s.pits}</span>
      </div>
    </Panel>
  )
}

const ORDERS: { value: Order; label: string; key: string }[] = [
  { value: 'stay', label: 'Stay out', key: 'S' },
  { value: 'boxIfClear', label: 'Box if clear', key: 'C' },
  { value: 'box', label: 'Box', key: 'B' },
]
const ORDER_LABEL: Record<Order, string> = { stay: 'stay out', box: 'box', boxIfClear: 'box if clear' }

/** The box and the call to the driver: what is in it, who takes it, what a stop now gives us, the order */
function CallPanel({ race, command, rerate }: { race: Race; command: (o: Order) => void; rerate: (kart: number) => void }) {
  const me = us(race)
  const red = race.t < race.greenAt
  const [first, second] = race.box
  const cont = contenders(race).slice(0, 2)
  const anyEligible = race.drivers.some((d) => d.mode === 'track' && d.pitsDone < race.settings.pits && stintInfo(race, d).eligible)

  const tDec = timeToDecision(race, me)
  const tIn = timeToPitIn(race, me)
  const done = me.pitsDone >= race.settings.pits || race.flag
  const lane = me.mode !== 'track' && me.mode !== 'done'
  const locked = done || lane
  // between the decision point and the entry the order for this lap is already with the driver
  const handed = me.mode === 'track' && tIn < tDec
  const handedOrder: Order = me.commit ? (me.conditional ? 'boxIfClear' : 'box') : 'stay'
  const progress = handed ? 1 : Math.max(0, Math.min(1, 1 - tDec / (me.lapT || 30)))
  const rejoin = projectRejoin(race)
  const early = race.intent !== 'stay' && !locked && !stintInfo(race, me).eligible

  return (
    <Panel className="flex min-h-0 flex-1 flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Box</span>
        <span className={cn('flex items-center gap-2 text-sm tnum', red ? 'text-hot' : 'text-muted-foreground')}>
          <span className={cn('size-2 rounded-full', red ? 'bg-hot' : 'bg-ok')} />
          {red ? `Red · ${(race.greenAt - race.t).toFixed(0)} s` : 'Green'}
        </span>
      </div>

      <div className="mt-4 flex items-end gap-8">
        <div>
          <Kart size="xl" letter label={race.karts[first].label} cls={ourClass(race, first)} onClick={() => rerate(first)} />
          <div className="mt-2 caption">Next out</div>
        </div>
        <div>
          <Kart size="lg" letter label={race.karts[second].label} cls={ourClass(race, second)} onClick={() => rerate(second)} />
          <div className="mt-2 caption">Then</div>
        </div>
      </div>

      <div className="mt-5 border-t pt-4">
        <div className="caption">Who takes {race.karts[first].label}</div>
        <div className="mt-2 grid h-[3.25rem] content-start gap-1.5 text-sm">
          {cont.length === 0 ? (
            <span className="text-muted-foreground">
              {race.flag ? 'Box is closed' : anyEligible ? 'Nobody wants it' : 'Nobody can stop yet: min stint'}
            </span>
          ) : cont.map((c, i) => (
            <div key={c.d.id} className={cn('flex items-baseline justify-between gap-3', i > 0 && !c.d.isUs && 'text-muted-foreground', c.d.isUs && 'font-semibold')}>
              <span className="truncate">{c.d.isUs ? 'You' : c.d.name}{i === 1 && <span className="font-normal text-muted-foreground"> · if not</span>}</span>
              <span className="shrink-0 tnum">{c.hard ? '' : <span className="text-muted-foreground">maybe · </span>}in {c.tEntry.toFixed(1)} s</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t pt-4">
        <div className="caption">If you box now</div>
        <div className="mt-2 flex h-6 items-center gap-2 text-sm tnum">
          {rejoin && !locked ? (
            <>
              <Kart size="sm" letter label={race.karts[rejoin.kart].label} cls={ourClass(race, rejoin.kart)} />
              <span className={rejoin.wait > 0.5 ? 'text-hot' : 'text-muted-foreground'}>
                {rejoin.wait > 0.5 ? `wait ${rejoin.wait.toFixed(0)} s` : 'no wait'}
              </span>
              {rejoin.ahead && <span className="ml-auto truncate text-muted-foreground">out behind <span className="text-foreground">{rejoin.ahead.d.name}</span></span>}
            </>
          ) : (
            <span className="text-muted-foreground">{race.flag ? 'Race is over' : done ? 'All stops done' : 'In the pit lane'}</span>
          )}
        </div>
      </div>

      <div className="min-h-4 flex-1" />

      <div className="grid grid-cols-[1fr_1.3fr_1fr] gap-2" role="radiogroup" aria-label="Order to the driver">
        {ORDERS.map((o) => {
          const on = race.intent === o.value
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={on}
              disabled={locked}
              onClick={() => command(o.value)}
              className={cn(
                'relative h-14 rounded-xl text-[0.9375rem] font-semibold transition-colors disabled:opacity-30',
                on ? (o.value === 'stay' ? 'bg-foreground/20 text-foreground' : 'bg-foreground text-background')
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {o.label}
              <Kbd className="absolute top-2 right-2.5">{o.key}</Kbd>
            </button>
          )
        })}
      </div>

      <div className="mt-3 h-8">
        {!locked && (
          <>
            <div className="flex justify-between gap-3 text-xs tnum">
              {early ? (
                <span className="text-hot">Min stint not done: +10 s per missing lap</span>
              ) : handed ? (
                <span className="text-muted-foreground">
                  Driver has <span className="text-foreground">{ORDER_LABEL[handedOrder]}</span>
                  {race.intent !== handedOrder && <> · {ORDER_LABEL[race.intent]} next lap</>}
                </span>
              ) : (
                <span className="text-muted-foreground">Driver gets <span className="text-foreground">{ORDER_LABEL[race.intent]}</span> in</span>
              )}
              <span className="text-foreground">{(handed ? tIn : tDec).toFixed(1)} s</span>
            </div>
            <div className="mt-2 h-0.5 rounded-full bg-foreground/15">
              <div className={cn('h-full rounded-full', handed ? 'bg-foreground/40' : 'bg-foreground')} style={{ width: `${progress * 100}%` }} />
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}

// race seconds an event stays on screen
const EVENT_TTL = 30

function Ticker({ race }: { race: Race }) {
  const items = race.log.filter((it) => race.t - it.t < EVENT_TTL).slice(-3)
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 flex max-w-[45%] flex-col gap-1 text-xs">
      {items.map((it) => (
        <div
          key={`${it.t}-${it.text}`}
          className="flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300"
          style={{ opacity: Math.max(0, 1 - ((race.t - it.t) / EVENT_TTL) ** 3) }}
        >
          <span className="text-muted-foreground tnum">{fmtTime(it.t)}</span>
          <span className={cn('truncate', it.us ? 'font-medium text-foreground' : 'text-muted-foreground')}>{it.text}</span>
        </div>
      ))}
    </div>
  )
}
