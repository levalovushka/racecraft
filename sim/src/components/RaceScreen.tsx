import { useEffect, type ReactNode } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { inLane, type Order, type Race, type Settings } from '@/engine/race'
import { stintInfo, timeToDecision, timeToPitIn } from '@/engine/ai'
import { useSim } from '@/sim/useSim'
import { fmtTime, forecast, laneClearAt, ourClass, projectRejoin, setOurClass, us, type Rejoin } from '@/sim/model'
import { fmtLap, timing, virtualOrder } from '@/sim/timing'
import { driverName, eventText, useT } from '@/i18n'
import { TrackView } from './TrackView'
import { TimingTable } from './TimingTable'
import { Kart } from './KartBadge'
import { StintRibbon } from './StintRibbon'
import { StartLights } from './StartLights'
import { Brand, Panel } from './kit'

const SPEEDS = [1, 2, 4, 8, 16]

export function RaceScreen({ settings, onFinish }: { settings: Settings; onFinish: (r: Race) => void }) {
  const t = useT()
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
      <h1 className="sr-only">{t.race}</h1>
      <AppBar race={race} paused={paused} speed={speed} onPause={() => setPaused((p) => !p)} onSpeed={setSpeed} onFinish={() => onFinish(race)} />
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(23rem,28vw,31rem)] gap-3">
        <div className="flex min-h-0 flex-col gap-3">
          <section className="relative min-h-0 flex-1" aria-label={t.track}>
            <div className="absolute inset-x-[8%] inset-y-[4%]">
              <TrackView race={race} onKart={rerate} />
            </div>
            <Ticker race={race} />
            <StartLights lights={sim.lights} />
          </section>
          <Panel className="shrink-0 px-1 pt-1 pb-2">
            <TimingTable race={race} onChange={sim.refresh} />
          </Panel>
        </div>
        <aside className="flex min-h-0 flex-col gap-3">
          <YouPanel race={race} rerate={rerate} />
          <ForecastPanel race={race} />
          <DecisionPanel race={race} command={command} />
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

/** The application: logo, language and playback. The race itself lives with the timing */
function AppBar({ race, paused, speed, onPause, onSpeed, onFinish }: {
  race: Race
  paused: boolean
  speed: number
  onPause: () => void
  onSpeed: (s: number) => void
  onFinish: () => void
}) {
  const t = useT()
  return (
    <header className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-6 pl-2 text-sm">
      <Brand />
      <RaceState race={race} />
      {race.flag ? (
        <Button size="lg" onClick={onFinish} className="h-10 justify-self-end px-4">{t.openDebrief} <ArrowRight /></Button>
      ) : (
        <div className="flex items-center justify-self-end gap-3">
          <div className="flex" role="group" aria-label={t.speed}>
            {SPEEDS.map((s, i) => (
              <button
                key={s}
                aria-pressed={speed === s}
                aria-keyshortcuts={String(i + 1)}
                onClick={() => onSpeed(s)}
                title={t.key(String(i + 1))}
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
            title={t.key('Space')}
            className={cn('flex h-10 w-[7.5rem] items-center justify-center gap-2 rounded-lg font-semibold transition-[color,background-color,scale] duration-150 ease-out motion-safe:active:scale-[0.96]',
              paused ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-selected')}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
            {paused ? t.resume : t.pause}
          </button>
        </div>
      )}
    </header>
  )
}

/** Lap and clock: one line in the middle of the header, the size of everything around it */
function RaceState({ race }: { race: Race }) {
  const t = useT()
  const n = race.settings.laps
  const lap = Math.min(Math.max(1, race.drivers.reduce((m, d) => Math.max(m, d.lapsDone + 1), 0)), n)
  return (
    <div className="flex items-baseline gap-4 tnum">
      <span className="font-semibold">
        {race.flag ? t.flag : <>{t.lap} {lap} <span className="font-normal text-muted-foreground">{t.of} {n}</span></>}
      </span>
      <span className="w-14 text-muted-foreground">{fmtTime(race.t)}</span>
    </div>
  )
}

function Figure({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate caption">{label}</div>
      <div className="mt-1 text-figure font-medium whitespace-nowrap tnum">{value}</div>
    </div>
  )
}

/** Live gap from row a to row b further back: the sum of the intervals between them */
function gapBetween(rows: ReturnType<typeof timing>, a: number, b: number): number | null {
  let g = 0
  for (let j = a + 1; j <= b; j++) {
    const x = rows[j].gap
    if (x === null) return null
    g += x
  }
  return g
}

function YouPanel({ race, rerate }: { race: Race; rerate: (kart: number) => void }) {
  const t = useT()
  const me = us(race)
  const s = race.settings
  const rows = timing(race)
  const i = rows.findIndex((r) => r.d === me)
  const mine = rows[i]
  const si = stintInfo(race, me)
  const cur = me.stints[me.stints.length - 1]
  const out = me.pitsDone >= s.pits
  const latest = s.laps - (s.pits - me.pitsDone) * s.minStint
  const virtual = virtualOrder(race, rows).get(me.id)!
  // two drivers either side; the outer pair only where the screen is tall enough
  const around = [-2, -1, 0, 1, 2].map((k) => ({ k, r: rows[i + k] })).filter((x) => x.r)

  // our clean-lap average against the median of everyone else's
  const others = rows.filter((r) => r.d !== me && r.stats.avg !== null).map((r) => r.stats.avg!).sort((a, b) => a - b)
  const field = others.length ? others[Math.floor(others.length / 2)] : null
  const pace = mine.stats.avg !== null && field !== null ? mine.stats.avg - field : null

  let status: string
  let hot = false
  if (me.mode === 'done') status = t.finished
  else if (me.mode === 'wait') { status = t.waitingGreen; hot = true }
  else if (inLane(me)) status = t.inPitLane
  else if (out) status = t.allStopsDone
  else if (!si.eligible) status = t.minStint(t.laps(s.minStint - si.curLen))
  else if (si.margin < 0) { status = t.overstaying; hot = true }
  else if (si.margin <= 2) { status = t.burning(t.laps(si.margin)); hot = true }
  else status = t.windowOpen(t.laps(si.margin))

  return (
    <Panel className="shrink-0 p-4">
      <h2 className="sr-only">{t.you}</h2>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-display font-medium tnum short:text-[2.5rem]">P{mine.pos}</div>
          <div className="mt-2 text-sm text-muted-foreground tnum short:mt-1" title={me.mode === 'done' || race.flag ? undefined : t.afterStopsHint}>
            {me.mode === 'done' || race.flag ? t.finalOrder : <><span className="text-foreground">P{virtual}</span> {t.afterStops}</>}
          </div>
        </div>
        <Kart size="lg" label={race.karts[me.kart].label} cls={ourClass(race, me.kart)} onClick={() => rerate(me.kart)} />
      </div>

      <div className="mt-5 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-8 short:mt-3">
        <Figure label={t.lastLap} value={fmtLap(mine.stats.last) || '—'} />
        <Figure label={t.best} value={fmtLap(mine.stats.best) || '—'} />
        <Figure label={t.pace} value={pace === null ? '—' : Math.abs(pace) < 0.005 ? t.paceAverage : <>{Math.abs(pace).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{t.perLap} {pace < 0 ? t.faster : t.slower}</span></>} />
      </div>

      {/* the drivers on either side, as a broadcast battle graphic shows them */}
      <ol className="my-5 border-b text-sm tnum short:my-3" aria-label={t.aroundYou}>
        {around.map(({ k, r }) => (
          <li key={r.d.id} className={cn('grid h-8 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 border-t short:h-7',
            Math.abs(k) === 2 && 'short:hidden',
            k === 0 ? 'font-semibold' : 'text-muted-foreground')}>
            <span>{r.pos}</span>
            <span className={cn('truncate', k !== 0 && 'text-foreground')}>{driverName(t, r.d)}</span>
            <span>
              {k < 0 && <><span className="text-foreground">{fmtLap(gapBetween(rows, i + k, i))}</span> {t.ahead}</>}
              {k > 0 && <><span className="text-foreground">{fmtLap(gapBetween(rows, i, i + k))}</span> {t.behind}</>}
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
        <span className="shrink-0 text-muted-foreground">{t.stops} {me.pitsDone}/{s.pits}</span>
      </div>
    </Panel>
  )
}

const ORDERS: { value: Order; key: string }[] = [
  { value: 'stay', key: 'S' },
  { value: 'boxIfClear', key: 'C' },
  { value: 'box', key: 'B' },
]

/** The box light: red with the seconds the next driver waits, or green */
function Light({ race }: { race: Race }) {
  const t = useT()
  const red = race.t < race.greenAt
  return (
    <span className={cn('flex items-center gap-2 text-sm tnum', red ? 'text-hot' : 'text-muted-foreground')} title={t.boxLight}>
      <span className={cn('size-2 rounded-full', red ? 'bg-hot' : 'bg-ok')} aria-hidden />
      {red ? t.pitWait(Math.ceil(race.greenAt - race.t)) : t.pitOpen}
    </span>
  )
}

/** Our next entry, or null when a stop is not ours to call */
function ourEntry(race: Race): number | null {
  const me = us(race)
  if (race.flag || me.mode !== 'track' || me.pitsDone >= race.settings.pits) return null
  return timeToPitIn(race, me)
}

/**
 * The box conveyor without us: every stop still to come, in order, with the
 * kart each driver hands over and the one he takes. Our next entry is a line in
 * the list: whatever is above it decides the kart we get now.
 */
function ForecastPanel({ race }: { race: Race }) {
  const t = useT()
  const me = us(race)
  const label = (k: number) => race.karts[k].label
  const tIn = ourEntry(race)
  const goers = forecast(race)
  const cut = tIn === null ? -1 : goers.findIndex((g) => !g.lane && g.t > tIn)
  const at = cut === -1 && tIn !== null ? goers.length : cut
  const soon = me.lapT || 30

  const rows: ReactNode[] = goers.map((g) => (
    <li key={g.d.id} className={cn('contents', !g.lane && g.t > soon && 'text-muted-foreground')}>
      <span className="text-right text-muted-foreground" title={t.whenHint}>
        {g.lane ? t.nowShort : g.t < soon ? `${Math.round(g.t)} ${t.s}` : t.inLaps(Math.round(g.t / soon))}
      </span>
      <Kart label={label(g.d.kart)} cls={ourClass(race, g.d.kart)} />
      <span className="truncate">{driverName(t, g.d)}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" aria-label={t.takes} />
      <Kart label={label(g.kart)} cls={ourClass(race, g.kart)} />
      {/* burning is an alarm only on this lap; further out it is just where his window ends */}
      <span className={cn('text-right', g.burning && g.t < soon ? 'text-hot' : 'text-muted-foreground')}
        title={g.burning ? (g.t < soon ? t.burningHint : t.deadlineHint) : g.sure ? undefined : t.maybeHint}>
        {g.burning ? (g.t < soon ? t.status.burning.toLowerCase() : t.deadline) : g.sure ? '' : t.maybe}
      </span>
    </li>
  ))
  if (at >= 0) {
    rows.splice(at, 0, (
      <li key="us" className="col-span-6 flex items-center gap-3 py-0.5 text-xs text-foreground tnum">
        <span className="h-px min-w-4 flex-1 bg-foreground/40" />
        <span className="text-center text-balance">{t.yourEntry(Math.round(tIn!))}{at > 0 && ` ${t.goBeforeYou}`}</span>
        <span className="h-px min-w-4 flex-1 bg-foreground/40" />
      </li>
    ))
  }

  return (
    <Panel className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{t.forecast}</h2>
        <Light race={race} />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t.forecastNote}</p>
      {goers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{race.flag ? t.boxClosed : t.noStopsLeft}</p>
      ) : (
        // the list runs on below the fold: fade it out rather than cut a row in half
        <ol className="grid min-h-0 flex-1 auto-rows-min grid-cols-[4rem_auto_minmax(0,1fr)_auto_auto_4rem] items-center gap-x-3 gap-y-2 overflow-hidden text-sm tnum [mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]" aria-label={t.forecastAria}>
          {rows}
        </ol>
      )}
    </Panel>
  )
}

/**
 * The order to the driver, each button with what it leads to on this lap:
 * the kart we get, the wait under red, the penalty, or that we stay out.
 */
function DecisionPanel({ race, command }: { race: Race; command: (o: Order) => void }) {
  const t = useT()
  const me = us(race)
  const label = (k: number) => race.karts[k].label
  const red = race.t < race.greenAt
  const tDec = timeToDecision(race, me)
  const tIn = ourEntry(race)
  const locked = tIn === null
  // between the decision point and the entry the order for this lap is already with the driver
  const handed = me.mode === 'track' && timeToPitIn(race, me) < tDec
  const handedOrder: Order = me.commit ? (me.conditional ? 'boxIfClear' : 'box') : 'stay'
  const progress = handed ? 1 : Math.max(0, Math.min(1, 1 - tDec / (me.lapT || 30)))
  const si = stintInfo(race, me)
  const penalty = !si.eligible ? 10 * (race.settings.minStint - si.curLen) : 0

  const kartWith = (o: Rejoin, extra?: ReactNode) => (
    <>
      <Kart label={label(o.kart)} cls={ourClass(race, o.kart)} />
      <span className={o.wait > 0.5 ? 'text-hot' : undefined}>{o.wait > 0.5 ? t.waitS(Math.round(o.wait)) : t.noWait}</span>
      {penalty > 0 && <span className="text-hot">· {t.penaltyS(penalty)}</span>}
      {extra}
    </>
  )

  // what each order leads to
  const outcome: Partial<Record<Order, ReactNode>> = {}
  let note: ReactNode = null
  if (race.flag) note = t.boxClosed
  else if (me.pitsDone >= race.settings.pits) note = t.allStopsDone
  else if (me.mode === 'laneIn' || me.mode === 'wait') {
    note = <span className="flex items-center gap-2">{t.youTake} <Kart label={label(race.box[0])} cls={ourClass(race, race.box[0])} />
      {red && <span className="text-hot">{t.waitingForGreen(Math.ceil(race.greenAt - race.t))}</span>}</span>
  } else if (me.mode === 'box') note = t.outIn(Math.max(0, Math.ceil(me.laneT1 - race.t)))
  else if (me.mode === 'laneOut') note = t.rejoining
  else if (tIn !== null) {
    const ahead = forecast(race).filter((g) => !g.lane && g.t < tIn)
    const ifBox = projectRejoin(race, ahead.map((g) => g.d))!
    const ifClear = projectRejoin(race)!
    const laneBusy = laneClearAt(race) > race.t + tIn

    // staying out: one lap less in hand, or an overstay
    outcome.stay = si.margin <= 0 ? <span className="text-hot">{t.overstayS(10)}</span>
      : si.margin === 1 ? <span className="text-hot">{t.lastChance}</span>
      : !si.eligible ? t.minStint(t.laps(race.settings.minStint - si.curLen))
      : t.inHand(t.laps(si.margin - 1))
    outcome.box = kartWith(ifBox)
    outcome.boxIfClear = laneBusy ? t.laneBusy
      : ahead.length ? <><Kart label={label(ifClear.kart)} cls={ourClass(race, ifClear.kart)} /><span>{ahead.length > 1 ? t.ifNobodyGoesIn : t.ifStaysOutN(driverName(t, ahead[0].d))}</span></>
      : kartWith(ifClear)
  }

  let timer: ReactNode = null
  if (!locked && !handed) timer = t.driverGetsIn(Math.ceil(tDec))
  else if (!locked && race.intent !== handedOrder) timer = t.changesNextLap
  else if (!locked) timer = <span className="flex items-center gap-1.5"><Check className="size-3.5" aria-hidden />{t.driverHasIt}</span>

  return (
    <Panel className="flex shrink-0 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{t.decision}</h2>
        <span className="text-sm text-muted-foreground tnum">{timer}</span>
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      <div className="flex flex-col gap-1.5" role="group" aria-label={t.orderToDriver}>
        {ORDERS.map((o) => {
          const on = race.intent === o.value
          const filled = on && o.value !== 'stay'
          const withDriver = !locked && handed && handedOrder === o.value
          return (
            <button
              key={o.value}
              aria-pressed={on}
              aria-keyshortcuts={o.key}
              title={t.key(o.key)}
              disabled={locked}
              onClick={() => command(o.value)}
              className={cn(
                'relative grid h-12 grid-cols-[auto_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-lg px-4 text-left transition-[color,background-color,scale] duration-150 ease-out disabled:opacity-30 motion-safe:enabled:active:scale-[0.98] short:h-11',
                on ? (filled ? 'bg-foreground text-background' : 'bg-selected text-foreground')
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
                withDriver && !on && 'ring-1 ring-foreground ring-inset',
              )}
            >
              <span className="text-[0.9375rem] font-semibold">{t.orders[o.value]}</span>
              <span className={cn('flex min-w-0 items-center justify-end gap-2 truncate text-sm tnum',
                filled ? 'text-background/70' : on ? 'text-muted-foreground' : 'text-muted-foreground/80')}>
                {outcome[o.value]}
              </span>
              {/* time to the decision point: the order goes to the driver when the bar is full */}
              {on && !locked && (
                <span className={cn('absolute inset-x-0 bottom-0 h-[3px]', filled ? 'bg-background/15' : 'bg-foreground/15')} aria-hidden>
                  <span className={cn('block h-full', filled ? 'bg-background' : 'bg-foreground')} style={{ width: `${progress * 100}%` }} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

// race seconds an event stays on screen
const EVENT_TTL = 30

function Ticker({ race }: { race: Race }) {
  const t = useT()
  const items = race.log.filter((it) => race.t - it.t < EVENT_TTL).slice(-3)
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 flex max-w-[45%] flex-col gap-1 text-xs" role="log" aria-label={t.raceEvents}>
      {items.map((it) => (
        <div
          key={`${it.t}-${it.text}`}
          className="flex gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
          style={{ opacity: Math.max(0, 1 - ((race.t - it.t) / EVENT_TTL) ** 3) }}
        >
          <span className="text-muted-foreground tnum">{fmtTime(it.t)}</span>
          <span className={cn('text-pretty', it.us ? 'font-medium text-foreground' : 'text-muted-foreground')}>{eventText(t, race, it)}</span>
        </div>
      ))}
    </div>
  )
}
