import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftRight, Flag, Pause, Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { raceLap, type LogItem, type Order, type Race, type Settings } from '@/engine/race'
import { stintInfo, timeToDecision, timeToPitIn } from '@/engine/ai'
import { useSim } from '@/sim/useSim'
import { ourClass, projectRejoin, publicStatus, setOurClass, timingOrder, us } from '@/sim/model'
import { TrackView } from './TrackView'
import { KartChip, TimingTable } from './TimingTable'

// Layout after Figma 2MRW, node 28:3174: left — controls, track, events and the
// three order tiles; right — timing, the table relative to us and our numbers.

const SPEEDS = [1, 8, 16]

export function RaceScreen({ settings, onFinish, onRestart, onExit }: {
  settings: Settings
  onFinish: (r: Race) => void
  onRestart: () => void
  onExit: () => void
}) {
  const sim = useSim(settings)
  const { race, paused, setPaused, speed, setSpeed, command, refresh } = sim

  const cycleClass = useCallback((kart: number) => {
    setOurClass(race, kart, (ourClass(race, kart) + 1) % 4)
    refresh()
  }, [race, refresh])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const k = e.key.toLowerCase()
      if (k === 'b' || k === 'и') command('box')
      else if (k === 'c' || k === 'с') command('boxIfClear')
      else if (k === 's' || k === 'ы') command('stay')
      else if (k === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (/^[1-3]$/.test(k)) setSpeed(SPEEDS[Number(k) - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [command, setPaused, setSpeed])

  const lap = Math.min(raceLap(race), race.settings.laps)

  return (
    <Stage>
    <div className="flex h-[800px] w-[1440px] gap-4 bg-black p-3 text-[12px] text-white">
      {/* left column */}
      <div className="flex w-[588px] shrink-0 flex-col">
        <div className="flex h-9 items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused((p) => !p)}
              title="Пробел"
              className="flex size-9 items-center justify-center rounded-[4px] bg-white/10 hover:bg-white/15"
            >
              {paused ? <Play className="size-3.5 fill-white" /> : <Pause className="size-3.5 fill-white" />}
            </button>
            <div className="flex h-9 items-center">
              {SPEEDS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  title={`Клавиша ${i + 1}`}
                  className={cn('h-full rounded-[4px] px-3', speed === s ? 'text-white' : 'text-white/40 hover:text-white/70')}
                >
                  {s}Х
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 text-center text-[14px] tabular-nums">
            {lap} <span className="text-white/40">/ {race.settings.laps}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRestart} title="Начать эту раздачу заново" className="flex size-9 items-center justify-center rounded-[4px] text-white/60 hover:text-white">
              <RotateCcw className="size-3.5" />
            </button>
            <button
              onClick={() => (race.finished ? onFinish(race) : onExit())}
              className={cn('flex h-9 items-center gap-1.5 rounded-[4px] px-4', race.finished ? 'bg-white text-black' : 'bg-[#2a1314] text-[#e5484d]')}
            >
              <Flag className="size-3.5" />
              {race.finished ? 'Разбор гонки' : 'Закончить'}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 pt-4 pb-2">
          <TrackView race={race} onKart={cycleClass} />
        </div>
        <EventFeed race={race} />

        <OrderTiles race={race} command={command} />
      </div>

      {/* right column */}
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <TimingTable race={race} onKart={cycleClass} />
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-5">
          <PilotPanel race={race} />
          <StatusTable race={race} />
        </div>
      </div>
    </div>
    </Stage>
  )
}

const W = 1440
const H = 800

/** The race screen is laid out at the design size (1440×800) and scaled to fit the window */
function Stage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(() => fit())
  useEffect(() => {
    const onResize = () => setScale(fit())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <div style={{ width: W * scale, height: H * scale }}>
        <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' }}>{children}</div>
      </div>
    </div>
  )
}

function fit() {
  return Math.min(window.innerWidth / W, window.innerHeight / H)
}

// ---------------------------------------------------------------- events

function EventFeed({ race }: { race: Race }) {
  const items = race.log.filter((it) => it.us).slice(-2)
  return (
    <div className="flex h-[78px] shrink-0 flex-col items-end justify-end gap-[5px] pb-[13px]">
      {items.map((it, i) => (
        <EventPill key={`${it.t}-${i}`} race={race} item={it} />
      ))}
    </div>
  )
}

function EventPill({ race, item }: { race: Race; item: LogItem }) {
  const box = 'flex h-[30px] items-center gap-1.5 rounded-[4px] bg-white/10 px-2 text-[12px] backdrop-blur'
  if (item.kind === 'overtake' && item.driver !== undefined) {
    const d = race.drivers[item.driver]
    return (
      <div className={box}>
        <ArrowLeftRight className="size-3.5 text-white/60" />
        <KartChip race={race} kart={d.kart} />
        <span>{d.name}</span>
        <span className={cn('rounded-full bg-white/10 px-1.5', item.ourGain ? 'text-[#04b630]' : 'text-[#e5484d]')}>
          {item.ourGain ? 'обогнали' : 'обогнал нас'}
        </span>
      </div>
    )
  }
  if (item.kind === 'kart' && item.from !== undefined && item.to !== undefined) {
    return (
      <div className={box}>
        <span>Карт</span>
        <span className="rounded-full bg-white/10 px-1.5 tabular-nums">
          {race.karts[item.from].label} → {race.karts[item.to].label}
        </span>
        {item.text.includes('ждал') && <span className="text-white/60">{item.text.split(', ')[1]}</span>}
      </div>
    )
  }
  return <div className={box}>{item.text}</div>
}

// ---------------------------------------------------------------- orders

const ORDER_TILES: { value: Order; label: string; key: string }[] = [
  { value: 'box', label: 'Бокс', key: 'B' },
  { value: 'boxIfClear', label: 'Бокс, если чисто', key: 'C' },
  { value: 'stay', label: 'Мимо', key: 'S' },
]

function OrderTiles({ race, command }: { race: Race; command: (o: Order) => void }) {
  const me = us(race)
  const done = me.pitsDone >= race.settings.pits || race.flag || me.mode === 'done'
  const inLane = me.mode !== 'track' && me.mode !== 'done'
  const tDec = timeToDecision(race, me)
  const tIn = timeToPitIn(race, me)
  const handed = me.mode === 'track' && tIn < tDec
  const handedOrder: Order = me.commit ? (me.conditional ? 'boxIfClear' : 'box') : 'stay'
  const rejoin = projectRejoin(race)
  const early = !stintInfo(race, me).eligible

  return (
    <div className="grid h-[161px] grid-cols-3 gap-[7px]">
      {ORDER_TILES.map((o) => {
        const selected = race.intent === o.value
        const live = handed ? handedOrder === o.value : selected
        let note = ''
        if (done) note = o.value === 'stay' ? 'Питы сделаны' : ''
        else if (inLane) note = o.value === 'stay' ? '' : 'В питлейне'
        else if (handed && handedOrder === o.value) note = `Пилот получил · въезд ${tIn.toFixed(1)} с`
        else if (selected) note = handed ? `Уйдёт на следующем круге · ${tDec.toFixed(0)} с` : `Пилот получит через ${tDec.toFixed(1)} с`
        return (
          <button
            key={o.value}
            disabled={done || inLane}
            onClick={() => command(o.value)}
            className={cn(
              'flex flex-col items-start justify-between rounded-[4px] px-4 py-3 text-left transition-colors disabled:cursor-not-allowed',
              live ? 'bg-white/[0.22] ring-1 ring-white/60 ring-inset' : selected ? 'bg-white/[0.16] ring-1 ring-white/25 ring-inset' : 'bg-white/10 hover:bg-white/[0.14]',
              (done || inLane) && 'opacity-50',
            )}
          >
            <span className="flex w-full items-baseline justify-between text-[14px]">
              {o.label}
              <kbd className="text-[10px] text-white/30">{o.key}</kbd>
            </span>
            <span className="flex w-full flex-col gap-1 text-[12px]">
              {o.value === 'box' && rejoin && !done && !inLane && (
                <BoxForecast race={race} rejoin={rejoin} />
              )}
              {o.value !== 'stay' && early && !done && !inLane && (
                <span className="text-[#e5484d]/80">Мин. стинт не пройден</span>
              )}
              {note && <span className="text-white/50">{note}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Interim box forecast in the Box tile: kart we get, wait, where we rejoin */
function BoxForecast({ race, rejoin }: { race: Race; rejoin: NonNullable<ReturnType<typeof projectRejoin>> }) {
  const muted = 'text-white/50'
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <KartChip race={race} kart={rejoin.kart} />
        {rejoin.wait > 0.5
          ? <span className="text-[#e5484d]">ждать {rejoin.wait.toFixed(0)} с</span>
          : <span className={muted}>без ожидания</span>}
      </span>
      {rejoin.ahead && (
        <span className={muted}>выезд за {rejoin.ahead.d.name} {rejoin.ahead.gap.toFixed(1)} с</span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------- relative

/** Pit-related state of every driver, in timing order */
function StatusTable({ race }: { race: Race }) {
  const me = us(race)
  const rows = timingOrder(race)
  const COLS = 'grid grid-cols-[136px_52px_40px_minmax(0,1fr)] items-center gap-x-3 px-2.5'
  return (
    <div className="min-h-0 tabular-nums">
      <div className={cn(COLS, 'h-[27px] border-b border-white/10 text-white/40')}>
        <span><span className="mr-1 inline-block w-[17px]">#</span>Пилот</span>
        <span>Питы</span>
        <span>Стинт</span>
        <span>Статус</span>
      </div>
      <div className="pt-1">
        {rows.map((d) => {
          const cur = d.stints[d.stints.length - 1]
          const kartLaps = Math.max(0, d.lapsDone - cur.start)
          const out = d.pitsDone >= race.settings.pits
          const deadline = !out && d.mode === 'track' && stintInfo(race, d).margin <= 3
          const st = publicStatus(race, d)
          const label = st.label === 'Едет мимо' ? '' : st.label
          return (
            <div key={d.id} className={cn(COLS, 'h-[26px] rounded-[4px]', d === me && 'bg-white/[0.08]')}>
              <span className="truncate">
                <span className="mr-1 inline-block w-[17px] text-white/40">{String(d.num).padStart(2, '0')}</span>
                {d.name}
              </span>
              <span className={out ? 'text-white/40' : ''}>{d.pitsDone} / {race.settings.pits}</span>
              <span className={deadline ? 'text-[#e5484d]' : ''}>{kartLaps}</span>
              <span className={cn('truncate', st.tone === 'hot' && 'text-[#e5484d]', st.tone === 'muted' && 'text-white/40')}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- pilot

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
const laps = (n: number) => `${n} ${plural(n, 'круг', 'круга', 'кругов')}`
const PITS_LEFT = ['Все', 'Ещё один', 'Ещё два', 'Ещё три']

function PilotPanel({ race }: { race: Race }) {
  const me = us(race)
  const pos = timingOrder(race).indexOf(me) + 1
  const cur = me.stints[me.stints.length - 1]
  const onKart = Math.max(0, me.lapsDone - cur.start)
  const M = race.settings.minStint
  const left = race.settings.pits - me.pitsDone
  const si = stintInfo(race, me)
  const cells: [string, string, string?][] = [
    ['Позиция', `P${pos}`],
    ['До финиша', laps(Math.max(0, race.settings.laps - me.lapsDone))],
    ['Питы', PITS_LEFT[Math.max(0, left)] ?? `Ещё ${left}`],
    ['Текущий стинт', laps(onKart)],
    ['Минимальный', onKart >= M ? 'Пройден' : laps(M - onKart)],
    ['До пересида', left > 0 ? laps(Math.max(0, si.margin)) : '—', left > 0 && si.margin <= 3 ? 'hot' : undefined],
    ['Под красным', me.redWait < 0.05 ? '0' : `${me.redWait.toFixed(1)} с`],
    ['Трафик', me.trafficLoss < 0.05 ? '0' : `−${me.trafficLoss.toFixed(1)}`],
  ]
  return (
    <div>
      <div className="flex h-[27px] items-center border-b border-white/10 px-2.5 text-white/40">Пилот</div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-4 px-2.5 pt-3.5">
        {cells.map(([k, v, tone]) => (
          <div key={k} className="flex flex-col gap-[3px]">
            <span className="text-white/40">{k}</span>
            <span className={cn('tabular-nums', tone === 'hot' && 'text-[#e5484d]')}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
