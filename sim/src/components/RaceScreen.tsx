import { useEffect } from 'react'
import { ArrowRight, Flag, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { inLane, raceLap, type Order, type Race, type Settings } from '@/engine/race'
import { hunger, stintInfo, timeToDecision, timeToPitIn, type Hunger } from '@/engine/ai'
import { useSim } from '@/sim/useSim'
import { CLASS, contenders, fmtTime, ourClass, projectRejoin, setOurClass, timingOrder, us } from '@/sim/model'
import { TrackView } from './TrackView'
import { TimingTable } from './TimingTable'
import { KartBadge } from './KartBadge'
import { StintRibbon } from './StintRibbon'
import { Kbd, LightChip, Panel, SectionHead, Wordmark } from './kit'

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

  return (
    <div className="flex h-screen min-h-[40rem] flex-col gap-3 p-3">
      <TopBar race={race} paused={paused} speed={speed} onPause={() => setPaused((p) => !p)} onSpeed={setSpeed} onFinish={() => onFinish(race)} />
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(22rem,27vw,30rem)] gap-3">
        <div className="@container flex min-h-0 flex-col gap-3">
          <Panel className="relative min-h-0 flex-1 overflow-hidden bg-background">
            <div className="absolute inset-y-0 left-0 right-[9.5rem] p-4">
              <TrackView race={race} />
            </div>
            <KartsRail race={race} onChange={sim.refresh} />
            <div className="@min-[1100px]:hidden"><EventStream race={race} /></div>
            {paused && !race.finished && (
              <button onClick={() => setPaused(false)} className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground/10 px-3 py-1 text-xs text-foreground backdrop-blur hover:bg-foreground/15">
                <Pause className="size-3" /> Пауза <Kbd>Пробел</Kbd>
              </button>
            )}
          </Panel>
          <div className="flex shrink-0 gap-3">
            <Panel className="min-w-0 flex-1 px-2 pt-2 pb-1.5 @min-[1100px]:flex-none">
              <TimingTable race={race} />
            </Panel>
            <EventLog race={race} />
          </div>
        </div>
        <aside className="flex min-h-0 flex-col gap-3">
          <UsPanel race={race} />
          <BoxPanel race={race} />
          <OrderPanel race={race} command={command} />
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
    <header className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-1">
      <div className="flex min-w-0 items-center gap-3">
        <Wordmark />
        <span className="truncate text-xs text-muted-foreground">Премиум · раздача <span className="tnum">{race.settings.seed}</span></span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-1.5 tnum">
          <span className="text-xs text-muted-foreground">Круг</span>
          <span className="text-lg font-semibold">{lap}</span>
          <span className="text-sm text-muted-foreground">/ {laps}</span>
        </div>
        <div className="h-1 w-[clamp(6rem,12vw,14rem)] overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(Math.min(race.drivers[0].u, laps) / laps) * 100}%` }} />
        </div>
        <span className="w-14 text-sm text-muted-foreground tnum">{fmtTime(race.t)}</span>
        {race.flag && (
          <span className="flex items-center gap-1.5 rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-medium"><Flag className="size-3" /> Финиш</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        {!race.finished && (
          <>
            <Button variant="ghost" size="icon" onClick={onPause} title={paused ? 'Пуск — пробел' : 'Пауза — пробел'} aria-label={paused ? 'Пуск' : 'Пауза'}>
              {paused ? <Play /> : <Pause />}
            </Button>
            <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Скорость">
              {SPEEDS.map((s, i) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={speed === s}
                  onClick={() => onSpeed(s)}
                  title={`Клавиша ${i + 1}`}
                  className={cn('h-7 w-9 rounded-md text-xs font-medium tnum transition-colors',
                    speed === s ? 'bg-foreground/12 text-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  {s}×
                </button>
              ))}
            </div>
          </>
        )}
        {race.flag && (
          <Button size="lg" onClick={onFinish} className="ml-1 px-3.5">
            Разбор гонки <ArrowRight />
          </Button>
        )}
      </div>
    </header>
  )
}

function UsPanel({ race }: { race: Race }) {
  const me = us(race)
  const s = race.settings
  const pos = timingOrder(race).indexOf(me) + 1
  const si = stintInfo(race, me)
  const cur = me.stints[me.stints.length - 1]
  const onKart = Math.max(0, me.lapsDone - cur.start)
  const out = me.pitsDone >= s.pits
  const latest = s.laps - (s.pits - me.pitsDone) * s.minStint
  const last = me.lapTimes.at(-1)

  let status: { text: string; tone: 'ok' | 'warn' | 'hot' | 'muted' }
  if (me.mode === 'done') status = { text: 'Финишировал', tone: 'muted' }
  else if (me.mode === 'wait') status = { text: 'Ждёт зелёный', tone: 'hot' }
  else if (inLane(me)) status = { text: 'В пит-лейне', tone: 'muted' }
  else if (out) status = { text: 'Питы сделаны', tone: 'muted' }
  else if (!si.eligible) status = { text: `Мин. стинт · ещё ${s.minStint - si.curLen} кр`, tone: 'muted' }
  else if (si.margin <= 2) status = { text: si.margin < 0 ? 'Пересид' : `Горим · ${si.margin} кр`, tone: 'hot' }
  else if (si.margin <= 6) status = { text: `До пересида ${si.margin} кр`, tone: 'warn' }
  else status = { text: 'Окно открыто', tone: 'ok' }

  return (
    <Panel className="shrink-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-base font-semibold">{me.name}</span>
            <span className="text-xs text-muted-foreground tnum">#{me.num}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <KartBadge label={race.karts[me.kart].label} cls={ourClass(race, me.kart)} />
            <span className={cn('text-xs font-medium',
              status.tone === 'ok' && 'text-ok', status.tone === 'warn' && 'text-warn', status.tone === 'hot' && 'text-hot', status.tone === 'muted' && 'text-muted-foreground')}>
              {status.text}
            </span>
          </div>
        </div>
        <div className="text-right leading-none">
          <div className="text-[1.75rem] font-semibold tracking-tight tnum">P{pos}</div>
        </div>
      </div>

      <StintRibbon
        className="mt-4"
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

      <dl className="mt-3.5 grid grid-cols-4 gap-2">
        <Stat label="На карте" value={`${onKart}`} unit="кр" />
        <Stat label="Питы" value={`${me.pitsDone}/${s.pits}`} />
        <Stat label="До пересида" value={out ? '—' : `${si.margin}`} unit={out ? undefined : 'кр'}
          tone={out ? undefined : si.margin <= 2 ? 'hot' : si.margin <= 6 ? 'warn' : undefined} />
        <Stat label="Круг" value={last ? last.toFixed(2) : '—'} tone={me.stuck ? 'warn' : undefined} note={me.stuck ? 'в трафике' : undefined} />
      </dl>
    </Panel>
  )
}

function Stat({ label, value, unit, tone, note }: { label: string; value: string; unit?: string; tone?: 'warn' | 'hot'; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[0.6875rem] text-muted-foreground">{note ?? label}</dt>
      <dd className={cn('mt-0.5 text-[0.9375rem] font-medium tnum', tone === 'warn' && 'text-warn', tone === 'hot' && 'text-hot')}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </dd>
    </div>
  )
}

function BoxPanel({ race }: { race: Race }) {
  const red = race.t < race.greenAt
  const first = race.box[0]
  const cont = contenders(race)
  const role = new Map(cont.map((c, i) => [c.d.id, { i, hard: c.hard }]))
  const ROLE = ['Претендент', 'Запасной', 'Третий']
  // everyone who can still take a kart, in the order they reach the pit entry
  const queue = race.flag ? [] : race.drivers
    .filter((d) => d.mode === 'track' && d.pitsDone < race.settings.pits)
    .map((d) => ({ d, tEntry: timeToPitIn(race, d), h: hunger(race, d, us(race).perceived, true) }))
    .sort((a, b) => a.tEntry - b.tEntry)
  const live = queue.some((q) => q.h !== 'locked')
  const HUNGER: Record<Hunger, string> = { burning: 'горит', hungry: 'голодный', full: 'сытый', locked: 'мин. стинт', out: '' }

  return (
    <Panel className="flex min-h-0 flex-1 flex-col p-4">
      <SectionHead title="Бокс" aside={<LightChip red={red} left={race.greenAt - race.t} />} />
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Первый</span>
        <KartBadge size="lg" label={race.karts[first].label} cls={ourClass(race, first)} />
        <span className="ml-3 text-xs text-muted-foreground">второй</span>
        <KartBadge size="lg" label={race.karts[race.box[1]].label} cls={ourClass(race, race.box[1])} dim />
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">У въезда · кто заберёт {race.karts[first].label} [{CLASS[ourClass(race, first)]}]</span>
      </div>
      <div className="relative mt-1.5 min-h-0 flex-1 overflow-hidden">
        {(!live || queue.length === 0) && (
          <div className="flex h-7 items-center rounded-md bg-foreground/[0.03] px-2 text-xs text-muted-foreground">
            {race.flag ? 'Финиш — бокс закрыт' : queue.length === 0 ? 'Все питы сделаны' : 'Никто не может: идёт минимальный стинт'}
          </div>
        )}
        {live && cont.length === 0 && (
          <div className="mb-1 flex h-7 items-center rounded-md bg-foreground/[0.03] px-2 text-xs text-muted-foreground">Карт никому не нужен — бокс мёртвый</div>
        )}
        {live && (
          <ol className="flex flex-col gap-px">
            {queue.map(({ d, tEntry, h }) => {
              const r = role.get(d.id)
              return (
                <li key={d.id} className={cn('grid h-7 shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 text-[0.8125rem]',
                  d.isUs && 'bg-foreground/[0.08] font-medium', !r && !d.isUs && 'text-muted-foreground')}>
                  <span className="text-xs text-muted-foreground tnum">{tEntry.toFixed(1)}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <KartBadge size="sm" label={race.karts[d.kart].label} cls={ourClass(race, d.kart)} bare />
                    <span className="truncate">{d.name}</span>
                  </span>
                  {r ? (
                    <span className={cn('rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold leading-none',
                      r.i === 0 ? 'bg-foreground text-background' : 'bg-foreground/12 text-foreground')}>
                      {ROLE[r.i]}{r.hard ? '' : ' · мягк.'}
                    </span>
                  ) : (
                    <span className={cn('text-[0.6875rem]', h === 'burning' && 'font-semibold text-hot')}>{HUNGER[h]}</span>
                  )}
                </li>
              )
            })}
          </ol>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-card" />
      </div>
    </Panel>
  )
}

/** Map legend: every kart with your class and where it is now; click to re-rate */
function KartsRail({ race, onChange }: { race: Race; onChange: () => void }) {
  const where = (k: number) => {
    if (race.box[0] === k) return 'бокс 1'
    if (race.box[1] === k) return 'бокс 2'
    const d = race.drivers.find((x) => x.kart === k)
    return d ? d.name : ''
  }
  const karts = race.karts.slice().sort((a, b) => a.label - b.label)
  return (
    <div className="absolute top-3 right-3 bottom-3 flex w-[8.5rem] flex-col">
      <div className="label-caps px-1.5" title="Ваша оценка класса. Истинные классы откроются в разборе.">Парк</div>
      <div className="mt-1.5 flex min-h-0 flex-1 flex-col justify-start gap-px overflow-y-auto">
        {karts.map((k) => {
          const ours = race.drivers[0].kart === k.id
          return (
            <button
              key={k.id}
              title={`Карт ${k.label}: клик — сменить класс`}
              className="group flex h-[clamp(1.375rem,2.9vh,1.75rem)] shrink-0 items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-foreground/[0.07]"
              onClick={() => {
                setOurClass(race, k.id, (ourClass(race, k.id) + 1) % 4)
                onChange()
              }}
            >
              <KartBadge size="sm" label={k.label} cls={ourClass(race, k.id)} className="w-[2.375rem]" />
              <span className={cn('truncate text-[0.6875rem]', ours ? 'font-medium text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>{where(k.id)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const ORDERS: { value: Order; label: string; key: string; hint: string }[] = [
  { value: 'stay', label: 'Мимо', key: 'S', hint: 'Пилот проезжает въезд.' },
  { value: 'boxIfClear', label: 'Бокс, если чисто', key: 'C', hint: 'Заедет, если перед ним никто не въедет в пит-лейн. Решает сам у въезда.' },
  { value: 'box', label: 'Бокс', key: 'B', hint: 'Заедет на ближайшем въезде, что бы ни было.' },
]
const ORDER_LABEL: Record<Order, string> = { stay: 'мимо', box: 'бокс', boxIfClear: 'бокс, если чисто' }

function OrderPanel({ race, command }: { race: Race; command: (o: Order) => void }) {
  const me = us(race)
  const tDec = timeToDecision(race, me)
  const tIn = timeToPitIn(race, me)
  const done = me.pitsDone >= race.settings.pits || race.flag
  const lane = me.mode !== 'track' && me.mode !== 'done'
  // between the decision point and the entry the order for this lap is already with the pilot
  const handed = me.mode === 'track' && tIn < tDec
  const handedOrder: Order = me.commit ? (me.conditional ? 'boxIfClear' : 'box') : 'stay'
  const lapT = me.lapT || 30
  const toDecision = handed ? 1 : Math.max(0, Math.min(1, 1 - tDec / lapT))
  const rejoin = projectRejoin(race)
  const locked = done || lane
  const penalty = race.intent !== 'stay' && !locked && !stintInfo(race, me).eligible

  return (
    <Panel className="shrink-0 p-4 ring-1 ring-foreground/10">
      <SectionHead title="Указание пилоту" aside="действует до отмены" />

      {/* what a stop now would give: fixed height so the buttons never move */}
      <div className="mt-2.5 flex h-9 items-center gap-2 rounded-lg bg-foreground/[0.04] px-2.5 text-xs">
        {rejoin && !locked ? (
          <>
            <span className="text-muted-foreground">Бокс сейчас</span>
            <KartBadge size="sm" label={race.karts[rejoin.kart].label} cls={ourClass(race, rejoin.kart)} />
            <span className={cn('tnum', rejoin.wait > 0.5 ? 'text-hot' : 'text-muted-foreground')}>
              {rejoin.wait > 0.5 ? `ждать ${rejoin.wait.toFixed(0)} с` : 'без ожидания'}
            </span>
            {rejoin.ahead && (
              <span className="ml-auto truncate text-muted-foreground tnum">
                выезд за {rejoin.ahead.d.name} <span className="text-foreground">+{rejoin.ahead.gap.toFixed(1)}</span>
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">
            {race.flag ? 'Клетчатый флаг: указания больше не нужны.' : done ? 'Все обязательные питы сделаны.' : 'Пилот в пит-лейне.'}
          </span>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_1.35fr_1fr] gap-1.5" role="radiogroup" aria-label="Указание пилоту">
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
                'relative flex h-[3.25rem] flex-col items-center justify-center gap-1 rounded-lg border text-sm font-semibold leading-none transition-all disabled:opacity-35',
                on
                  ? o.value === 'stay'
                    ? 'border-foreground/30 bg-foreground/10 text-foreground'
                    : 'border-transparent bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
              )}
            >
              {o.label}
              <Kbd>{o.key}</Kbd>
            </button>
          )
        })}
      </div>

      {/* hand-over to the pilot at the decision point */}
      <div className="mt-3 h-[2.375rem]">
        {locked ? (
          <p className="text-xs text-muted-foreground">{ORDERS.find((o) => o.value === race.intent)!.hint}</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              {handed ? (
                <span>
                  Пилот получил <b className="font-semibold">«{ORDER_LABEL[handedOrder]}»</b>
                  <span className="text-muted-foreground">
                    {race.intent !== handedOrder ? ` · «${ORDER_LABEL[race.intent]}» — на следующем круге` : ' · въезд'}
                  </span>
                </span>
              ) : penalty ? (
                <span className="text-hot">Мин. стинт не пройден: +10 с за каждый недостающий круг</span>
              ) : (
                <span className="text-muted-foreground">
                  Передадим <span className="text-foreground">«{ORDER_LABEL[race.intent]}»</span> в точке решения
                </span>
              )}
              <span className="shrink-0 font-medium tnum">{handed ? tIn.toFixed(1) : tDec.toFixed(1)} с</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/10">
              <div
                className={cn('h-full rounded-full', handed ? 'bg-foreground/30' : race.intent === 'stay' ? 'bg-foreground/50' : 'bg-foreground')}
                style={{ width: `${toDecision * 100}%` }}
              />
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}

// race seconds an event stays on the track view before it is gone
const EVENT_TTL = 40

function EventStream({ race }: { race: Race }) {
  const items = race.log.filter((it) => race.t - it.t < EVENT_TTL).slice(-5)
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[min(26rem,45%)] flex-col items-start gap-1 text-xs">
      {items.map((it, i) => {
        const age = (race.t - it.t) / EVENT_TTL
        const rank = (items.length - 1 - i) / 5
        return (
          <div
            key={`${it.t}-${it.text}`}
            className={cn('flex max-w-full items-center gap-2 rounded-md bg-card/80 px-2 py-1 backdrop-blur animate-in fade-in slide-in-from-bottom-1 duration-300',
              it.us && 'text-foreground ring-1 ring-foreground/20')}
            style={{ opacity: Math.max(0, 1 - Math.max(age, rank) ** 2) }}
          >
            <span className="text-muted-foreground tnum">{fmtTime(it.t)}</span>
            <span className={cn('truncate', it.us ? 'font-medium' : 'text-foreground/85')}>{it.text}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Whole race log, newest first: shown beside the timing when there is room */
function EventLog({ race }: { race: Race }) {
  const items = race.log.slice(-60).reverse()
  return (
    <Panel className="relative hidden min-w-0 flex-1 flex-col overflow-hidden p-4 pb-0 @min-[1100px]:flex">
      <SectionHead title="События" />
      <ol className="mt-2 min-h-0 flex-1 overflow-y-auto pb-3 text-[0.8125rem]">
        {items.length === 0 && <li className="text-xs text-muted-foreground">Пока тихо</li>}
        {items.map((it) => (
          <li key={`${it.t}-${it.text}`} className="flex gap-3 py-[0.1875rem] animate-in fade-in duration-300">
            <span className="w-11 shrink-0 text-xs leading-5 text-faint tnum">{fmtTime(it.t)}</span>
            <span className={cn('min-w-0', it.us ? 'font-medium text-foreground' : 'text-muted-foreground')}>{it.text}</span>
          </li>
        ))}
      </ol>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-card" />
    </Panel>
  )
}
