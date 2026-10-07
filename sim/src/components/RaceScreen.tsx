import { useEffect, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { inLane, raceLap, type Order, type Race, type Settings } from '@/engine/race'
import { stintInfo, timeToDecision, timeToPitIn } from '@/engine/ai'
import { useSim } from '@/sim/useSim'
import { contenders, fmtTime, laps, ourClass, projectRejoin, setOurClass, us } from '@/sim/model'
import { fmtLap, timing, virtualOrder } from '@/sim/timing'
import { TrackView } from './TrackView'
import { TimingTable } from './TimingTable'
import { Kart } from './KartBadge'
import { StintRibbon } from './StintRibbon'
import { Panel, Wordmark } from './kit'

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
      <h1 className="sr-only">Race</h1>
      <AppBar race={race} paused={paused} speed={speed} onPause={() => setPaused((p) => !p)} onSpeed={setSpeed} onFinish={() => onFinish(race)} />
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(23rem,28vw,31rem)] gap-3">
        <div className="flex min-h-0 flex-col gap-3">
          <section className="relative min-h-0 flex-1" aria-label="Track">
            <div className="absolute inset-x-[8%] inset-y-[5%]">
              <TrackView race={race} />
            </div>
            <RaceState race={race} />
            <Ticker race={race} />
          </section>
          <Panel className="shrink-0 px-1 pt-1 pb-2">
            <TimingTable race={race} onChange={sim.refresh} />
          </Panel>
        </div>
        <aside className="flex min-h-0 flex-col gap-3">
          <YouPanel race={race} rerate={rerate} />
          <BoxPanel race={race} command={command} rerate={rerate} />
        </aside>
      </main>
    </div>
  )
}

/** Solid glyphs, so the transport controls read like the text beside them */
function PlayIcon() {
  return <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden><path d="M4 2.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L4.9 2.1a.6.6 0 0 0-.9.5Z" fill="currentColor" /></svg>
}
function PauseIcon() {
  return <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden><rect x="3.5" y="2.5" width="3" height="11" rx="0.75" fill="currentColor" /><rect x="9.5" y="2.5" width="3" height="11" rx="0.75" fill="currentColor" /></svg>
}

/** The application: what is loaded and the playback. The race itself lives with the track */
function AppBar({ race, paused, speed, onPause, onSpeed, onFinish }: {
  race: Race
  paused: boolean
  speed: number
  onPause: () => void
  onSpeed: (s: number) => void
  onFinish: () => void
}) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-6 pl-2 text-sm">
      <Wordmark />
      {race.flag ? (
        <Button size="lg" onClick={onFinish} className="h-10 px-4">Open debrief <ArrowRight /></Button>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex" role="group" aria-label="Speed">
            {SPEEDS.map((s, i) => (
              <button
                key={s}
                aria-pressed={speed === s}
                aria-keyshortcuts={String(i + 1)}
                onClick={() => onSpeed(s)}
                title={`Key ${i + 1}`}
                className={cn('h-10 w-11 rounded-md tnum transition-colors',
                  speed === s ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {s}×
              </button>
            ))}
          </div>
          {/* the control reached for most: large, labelled, in the corner */}
          <button
            onClick={onPause}
            aria-keyshortcuts="Space"
            title="Space"
            className={cn('flex h-10 w-[7.5rem] items-center justify-center gap-2 rounded-lg font-semibold transition-[color,background-color,scale] duration-150 ease-out motion-safe:active:scale-[0.96]',
              paused ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-selected')}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      )}
    </header>
  )
}

/** Lap and clock where a broadcast puts them: over the race, not in the app chrome */
function RaceState({ race }: { race: Race }) {
  const n = race.settings.laps
  const lap = Math.min(raceLap(race), n)
  return (
    <div className="absolute top-1 left-2 tnum">
      <div className="text-figure font-medium">
        {race.flag ? 'Chequered flag' : <>Lap {lap} <span className="text-muted-foreground">/ {n}</span></>}
      </div>
      <div className="mt-0.5 caption">{fmtTime(race.t)}</div>
    </div>
  )
}

function Figure({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate caption">{label}</div>
      <div className="mt-1 text-figure font-medium tnum">{value}</div>
    </div>
  )
}

function YouPanel({ race, rerate }: { race: Race; rerate: (kart: number) => void }) {
  const me = us(race)
  const s = race.settings
  const rows = timing(race)
  const i = rows.findIndex((r) => r.d === me)
  const mine = rows[i]
  const si = stintInfo(race, me)
  const cur = me.stints[me.stints.length - 1]
  const onKart = Math.max(0, me.lapsDone - cur.start)
  const out = me.pitsDone >= s.pits
  const latest = s.laps - (s.pits - me.pitsDone) * s.minStint

  // our clean-lap average against the median of everyone else's
  const others = rows.filter((r) => r.d !== me && r.stats.avg !== null).map((r) => r.stats.avg!).sort((a, b) => a - b)
  const field = others.length ? others[Math.floor(others.length / 2)] : null
  const pace = mine.stats.avg !== null && field !== null ? mine.stats.avg - field : null

  let status: string
  let hot = false
  if (me.mode === 'done') status = 'Finished'
  else if (me.mode === 'wait') { status = 'Waiting for green'; hot = true }
  else if (inLane(me)) status = 'In the pit lane'
  else if (out) status = 'All stops done'
  else if (!si.eligible) status = `Min stint · ${laps(s.minStint - si.curLen)} to go`
  else if (si.margin < 0) { status = 'Overstaying · +10 s a lap'; hot = true }
  else if (si.margin <= 2) { status = `Burning · ${laps(si.margin)} left`; hot = true }
  else status = `Window open · ${laps(si.margin)} left`

  const virtual = virtualOrder(race, rows).get(me.id)!
  // two drivers either side; the outer pair only where the screen is tall enough
  const around = [-2, -1, 0, 1, 2].map((k) => ({ k, r: rows[i + k] })).filter((x) => x.r)

  return (
    <Panel className="shrink-0 p-4">
      <h2 className="sr-only">You</h2>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-display font-medium tnum short:text-[2.5rem]">P{mine.pos}</div>
          <div className="mt-2 text-sm text-muted-foreground tnum short:mt-1">
            {me.mode === 'done' || race.flag ? 'Final order' : <><span className="text-foreground">P{virtual}</span> after stops</>}
          </div>
        </div>
        <Kart size="lg" label={race.karts[me.kart].label} cls={ourClass(race, me.kart)} onClick={() => rerate(me.kart)} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 short:mt-3">
        <Figure label="Last lap" value={fmtLap(mine.stats.last) || '—'} />
        <Figure label="Best" value={fmtLap(mine.stats.best) || '—'} />
        <Figure label="Pace vs field" value={pace === null ? '—' : Math.abs(pace) < 0.005 ? 'even' : <>{Math.abs(pace).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{pace < 0 ? 'faster' : 'slower'}</span></>} />
      </div>

      {/* the drivers on either side, as a broadcast battle graphic shows them */}
      <ol className="my-5 border-b text-sm tnum short:my-3" aria-label="Around you">
        {around.map(({ k, r }) => (
          <li key={r.d.id} className={cn('grid h-8 short:h-7 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 border-t',
            Math.abs(k) === 2 && 'short:hidden',
            k === 0 ? 'font-semibold' : 'text-muted-foreground')}>
            <span>{r.pos}</span>
            <span className={cn('truncate', k !== 0 && 'text-foreground')}>{k === 0 ? 'You' : r.d.name}</span>
            <span>
              {k < 0 && <><span className="text-foreground">{fmtLap(gapBetween(rows, i + k, i))}</span> ahead</>}
              {k > 0 && <><span className="text-foreground">{fmtLap(gapBetween(rows, i, i + k))}</span> behind</>}
            </span>
          </li>
        ))}
      </ol>

      <StintRibbon
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
        <span className="text-muted-foreground">{laps(onKart)} on kart · stops {me.pitsDone}/{s.pits}</span>
      </div>
    </Panel>
  )
}

/** Gap at the line from row a to row b further back: the sum of the intervals between them */
function gapBetween(rows: ReturnType<typeof timing>, a: number, b: number): number | null {
  let g = 0
  for (let j = a + 1; j <= b; j++) {
    const x = rows[j].gap
    if (x === null) return null
    g += x
  }
  return g
}

const ORDERS: { value: Order; label: string; key: string }[] = [
  { value: 'stay', label: 'Stay out', key: 'S' },
  { value: 'boxIfClear', label: 'Box if clear', key: 'C' },
  { value: 'box', label: 'Box', key: 'B' },
]
const ORDER_LABEL: Record<Order, string> = { stay: 'stay out', box: 'box', boxIfClear: 'box if clear' }

/**
 * One question, read top to bottom: what is in the box, will it still be there
 * when we get to the entry, what a stop now gives us, and the call.
 */
function BoxPanel({ race, command, rerate }: { race: Race; command: (o: Order) => void; rerate: (kart: number) => void }) {
  const me = us(race)
  const red = race.t < race.greenAt
  const [first, second] = race.box

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

  // who gets to the entry before us and would take the kart
  const cont = contenders(race)
  const before = (locked ? cont : cont.filter((c) => !c.d.isUs && c.tEntry < tIn)).slice(0, 2)
  const anyEligible = race.drivers.some((d) => d.mode === 'track' && d.pitsDone < race.settings.pits && stintInfo(race, d).eligible)

  return (
    <Panel className="flex min-h-0 flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Box</h2>
        <span className={cn('flex items-center gap-2 text-sm tnum', red ? 'text-hot' : 'text-muted-foreground')}>
          <span className={cn('size-2 rounded-full', red ? 'bg-hot' : 'bg-ok')} aria-hidden />
          {red ? `Red · ${Math.ceil(race.greenAt - race.t)} s` : 'Green'}
        </span>
      </div>

      <div className="mt-3 flex items-end gap-5 short:mt-2">
        <div className="grid justify-items-center gap-1.5">
          <Kart size="xl" label={race.karts[first].label} cls={ourClass(race, first)} onClick={() => rerate(first)} />
          <span className="caption">Next</span>
        </div>
        <div className="grid justify-items-center gap-1.5">
          <Kart size="lg" label={race.karts[second].label} cls={ourClass(race, second)} onClick={() => rerate(second)} />
          <span className="caption">Then</span>
        </div>
      </div>

      <div className="mt-6 short:mt-4">
        <h3 className="caption">{locked ? `Next to take ${race.karts[first].label}` : `Before you at the entry`}</h3>
        <ul className="mt-2 grid h-[3.25rem] content-start gap-1.5 text-sm tnum">
          {before.length === 0 ? (
            <li className="text-muted-foreground">
              {race.flag ? 'Box is closed'
                : !anyEligible ? 'Nobody can stop yet'
                : locked ? 'Nobody wants it'
                : `Nobody wants ${race.karts[first].label}`}
            </li>
          ) : before.map((c) => (
            <li key={c.d.id} className="flex items-baseline justify-between gap-3">
              <span className="truncate">{c.d.name}<span className="text-muted-foreground"> {c.hard ? 'takes' : 'may take'} {race.karts[first].label}</span></span>
              <span className="shrink-0 text-muted-foreground">in {c.tEntry.toFixed(1)} s</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 short:mt-3">
        <h3 className="caption">If you box now</h3>
        <div className="mt-2 flex min-h-8 items-center gap-2 text-sm tnum">
          {rejoin && !locked ? (
            <>
              <Kart label={race.karts[me.kart].label} cls={ourClass(race, me.kart)} />
              <ArrowRight className="size-3.5 text-muted-foreground" aria-label="for" />
              <Kart label={race.karts[rejoin.kart].label} cls={ourClass(race, rejoin.kart)} />
              <span className="ml-auto text-right">
                <span className={rejoin.wait > 0.5 ? 'text-hot' : 'text-muted-foreground'}>{rejoin.wait > 0.5 ? `wait ${Math.round(rejoin.wait)} s` : 'no wait'}</span>
                {rejoin.ahead && <span className="text-muted-foreground"> · out behind <span className="text-foreground">{rejoin.ahead.d.name}</span></span>}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">{race.flag ? 'Race is over' : done ? 'All stops done' : 'You are in the pit lane'}</span>
          )}
        </div>
      </div>

      <div className="min-h-3 flex-1" />

      <div className="grid grid-cols-[1fr_1.3fr_1fr] gap-2" role="group" aria-label="Order to the driver">
        {ORDERS.map((o) => {
          const on = race.intent === o.value
          return (
            <button
              key={o.value}
              aria-pressed={on}
              aria-keyshortcuts={o.key}
              title={`Key ${o.key}`}
              disabled={locked}
              onClick={() => command(o.value)}
              className={cn(
                'h-14 short:h-12 rounded-lg text-base font-semibold transition-[color,background-color,scale] duration-150 ease-out disabled:opacity-30 motion-safe:enabled:active:scale-[0.96]',
                on ? (o.value === 'stay' ? 'bg-selected text-foreground' : 'bg-foreground text-background')
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {o.label}
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
            <div className="mt-2 h-0.5 rounded-full bg-track">
              <div className={cn('h-full rounded-full', handed ? 'bg-muted-foreground' : 'bg-foreground')} style={{ width: `${progress * 100}%` }} />
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
    <div className="pointer-events-none absolute bottom-2 left-2 flex max-w-[45%] flex-col gap-1 text-xs" role="log" aria-label="Race events">
      {items.map((it) => (
        <div
          key={`${it.t}-${it.text}`}
          className="flex gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
          style={{ opacity: Math.max(0, 1 - ((race.t - it.t) / EVENT_TTL) ** 3) }}
        >
          <span className="text-muted-foreground tnum">{fmtTime(it.t)}</span>
          <span className={cn('text-pretty', it.us ? 'font-medium text-foreground' : 'text-muted-foreground')}>{it.text}</span>
        </div>
      ))}
    </div>
  )
}
