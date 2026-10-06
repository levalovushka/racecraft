import { useEffect } from 'react'
import { Pause, Play, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { order, raceLap, type Order, type Race, type Settings } from '@/engine/race'
import { stintInfo, timeToDecision, timeToPitIn } from '@/engine/ai'
import { useSim } from '@/sim/useSim'
import {
  CLASS, contenders, fmtTime, ourClass, projectRejoin, setOurClass, us,
} from '@/sim/model'
import { TrackView } from './TrackView'
import { TimingTable } from './TimingTable'
import { KartBadge } from './KartBadge'

const SPEEDS = [1, 2, 4, 8, 16]

export function RaceScreen({ settings, onFinish }: { settings: Settings; onFinish: (r: Race) => void }) {
  const sim = useSim(settings)
  const { race, paused, setPaused, speed, setSpeed, command } = sim

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
      } else if (/^[1-5]$/.test(k)) setSpeed(SPEEDS[Number(k) - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [command, setPaused, setSpeed])

  const lap = Math.min(raceLap(race), race.settings.laps)

  return (
    <div className="flex h-screen flex-col gap-3 p-3">
      <header className="flex items-center gap-4">
        <div className="text-lg font-semibold tracking-tight">racecraft · Премиум</div>
        <div className="font-mono text-sm tabular-nums text-muted-foreground">
          {fmtTime(race.t)} · круг лидера {lap}/{race.settings.laps}
          {race.flag && <span className="ml-2 text-foreground"><Flag className="inline size-4" /> финиш</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)} title="Пробел">
            {paused ? <Play /> : <Pause />}
            {paused ? 'Пуск' : 'Пауза'}
          </Button>
          <div className="flex rounded-lg border p-0.5">
            {SPEEDS.map((s, i) => (
              <Button key={s} size="xs" variant={speed === s ? 'secondary' : 'ghost'} onClick={() => setSpeed(s)} title={`Клавиша ${i + 1}`}>
                {s}×
              </Button>
            ))}
          </div>
          {race.finished ? (
            <Button size="sm" onClick={() => onFinish(race)}>Разбор гонки</Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => onFinish(race)} disabled={!race.flag}>Разбор</Button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] gap-3">
        <div className="flex min-h-0 flex-col gap-3">
          <Card className="min-h-0 flex-1 py-2">
            <CardContent className="h-full px-2">
              <TrackView race={race} />
            </CardContent>
          </Card>
          <TimingTable race={race} />
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 [&>*]:shrink-0">
          <UsPanel race={race} />
          <OrderPanel race={race} command={command} />
          <BoxPanel race={race} />
          <KartsPanel race={race} onChange={sim.refresh} />
          <LogPanel race={race} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warn' | 'hot' | 'ok' }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('truncate font-mono text-base tabular-nums', tone === 'warn' && 'text-amber-500', tone === 'hot' && 'text-rose-500', tone === 'ok' && 'text-emerald-500')}>
        {value}
      </div>
    </div>
  )
}

function UsPanel({ race }: { race: Race }) {
  const me = us(race)
  const pos = order(race).indexOf(me) + 1
  const si = stintInfo(race, me)
  const cur = me.stints[me.stints.length - 1]
  const onKart = me.lapsDone - cur.start
  const M = race.settings.minStint
  const out = me.pitsDone >= race.settings.pits
  const last = me.lapTimes.at(-1)
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{me.name}</CardTitle>
        <CardAction>
          <KartBadge label={race.karts[me.kart].label} cls={ourClass(race, me.kart)} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-x-4 gap-y-2">
        <Stat label="Позиция" value={`P${pos}`} />
        <Stat label="Круг" value={`${Math.min(me.lapsDone + 1, race.settings.laps)}/${race.settings.laps}`} />
        <Stat label="Последний" value={last ? last.toFixed(2) : '—'} />
        <Stat label="На карте" value={`${onKart} кр`} tone={onKart >= M ? 'ok' : undefined} />
        <Stat label="Питы" value={`${me.pitsDone}/${race.settings.pits}`} />
        <Stat
          label="До дедлайна"
          value={out ? '—' : `${si.margin} кр`}
          tone={out ? undefined : si.margin <= 2 ? 'hot' : si.margin <= 6 ? 'warn' : undefined}
        />
        <Stat label="Мин. стинт" value={onKart >= M || me.mode !== 'track' ? '✓' : `ещё ${M - onKart}`} tone={onKart >= M ? 'ok' : undefined} />
        <Stat label="Под красным" value={`${me.redWait.toFixed(1)} с`} />
        <Stat label="Трафик" value={me.stuck ? 'за спиной' : `${me.trafficLoss.toFixed(1)} с`} tone={me.stuck ? 'warn' : undefined} />
      </CardContent>
    </Card>
  )
}

const ORDERS: { value: Order; label: string; key: string; hint: string }[] = [
  { value: 'stay', label: 'Мимо', key: 'S', hint: 'Пилот проезжает въезд в пит-лейн.' },
  { value: 'boxIfClear', label: 'Бокс, если чисто', key: 'C', hint: 'Пилот заедет, если перед ним никто не въедет в пит-лейн. Решает сам у въезда — позже общей точки решения.' },
  { value: 'box', label: 'Бокс', key: 'B', hint: 'Пилот заедет на ближайшем въезде, что бы ни было.' },
]
const ORDER_LABEL: Record<Order, string> = { stay: 'мимо', box: 'бокс', boxIfClear: 'бокс, если чисто' }

function BoxPanel({ race }: { race: Race }) {
  const me = us(race)
  const red = race.t < race.greenAt
  const cont = contenders(race)
  const rejoin = projectRejoin(race)
  const done = me.pitsDone >= race.settings.pits || race.flag
  const anyEligible = race.drivers.some((d) => d.mode === 'track' && d.pitsDone < race.settings.pits && stintInfo(race, d).eligible)
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Бокс</CardTitle>
        <CardAction>
          <span className={cn('rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums', red ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500')}>
            {red ? `КРАСНЫЙ ${(race.greenAt - race.t).toFixed(0)} с` : 'ЗЕЛЁНЫЙ'}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Первый</span>
          <KartBadge label={race.karts[race.box[0]].label} cls={ourClass(race, race.box[0])} />
          <span className="ml-2 text-muted-foreground">второй</span>
          <KartBadge label={race.karts[race.box[1]].label} cls={ourClass(race, race.box[1])} dim />
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Кто заберёт {race.karts[race.box[0]].label} [{CLASS[ourClass(race, race.box[0])]}]
          </div>
          {cont.length === 0 && (
            <div className="text-muted-foreground">{anyEligible ? 'Никому не нужен — бокс мёртвый' : 'Пока никто не может: минимальный стинт'}</div>
          )}
          {cont.map((c, i) => (
            <div key={c.d.id} className={cn('flex items-center justify-between gap-2', c.d.isUs && 'font-semibold text-primary')}>
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                {i === 0 ? 'Претендент' : i === 1 ? 'Запасной' : 'Третий'}
                <KartBadge label={race.karts[c.d.kart].label} cls={ourClass(race, c.d.kart)} />
                {c.d.name}
                <span className="ml-1 text-xs text-muted-foreground">{c.hard ? 'твёрдый' : 'мягкий'}</span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">въезд через {c.tEntry.toFixed(1)} с</span>
            </div>
          ))}
        </div>
        {rejoin && !done && (
          <div className="rounded-lg bg-muted/50 p-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Если мы заедем на ближайшем въезде</span>
              <KartBadge label={race.karts[rejoin.kart].label} cls={ourClass(race, rejoin.kart)} />
            </div>
            <div className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
              {rejoin.queue > 0 && `очередь ${rejoin.queue} · `}
              {rejoin.wait > 0.5 ? <span className="text-rose-500">ждать {rejoin.wait.toFixed(0)} с</span> : 'без ожидания'}
              {' · выезд '}
              {rejoin.ahead ? `за ${race.karts[rejoin.ahead.d.kart].label} (${rejoin.ahead.d.name}) ${rejoin.ahead.gap.toFixed(1)} с` : ''}
              {rejoin.ahead && rejoin.behind ? ', ' : ''}
              {rejoin.behind ? `перед ${race.karts[rejoin.behind.d.kart].label} (${rejoin.behind.d.name}) ${(-rejoin.behind.gap).toFixed(1)} с` : ''}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OrderPanel({ race, command }: { race: Race; command: (o: Order) => void }) {
  const me = us(race)
  const tDec = timeToDecision(race, me)
  const tIn = timeToPitIn(race, me)
  const done = me.pitsDone >= race.settings.pits || race.flag
  const inLane = me.mode !== 'track' && me.mode !== 'done'
  // between the decision point and the entry the order for this lap is already with the pilot
  const handed = me.mode === 'track' && tIn < tDec
  const handedOrder: Order = me.commit ? (me.conditional ? 'boxIfClear' : 'box') : 'stay'
  const lapT = me.lapT || 30
  const toDecision = handed ? 0 : Math.max(0, Math.min(1, 1 - tDec / lapT))

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Указание пилоту</CardTitle>
        <CardAction className="text-xs text-muted-foreground">действует до отмены</CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {ORDERS.map((o) => (
            <button
              key={o.value}
              disabled={done || inLane}
              onClick={() => command(o.value)}
              className={cn(
                'flex h-14 flex-col items-center justify-center rounded-md px-1 text-sm font-medium leading-tight transition-colors disabled:opacity-40',
                race.intent === o.value
                  ? o.value === 'stay' ? 'bg-background text-foreground shadow-sm' : 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="text-center">{o.label}</span>
              <kbd className="text-[10px] opacity-60">{o.key}</kbd>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{ORDERS.find((o) => o.value === race.intent)!.hint}</p>
        {race.intent !== 'stay' && !done && !inLane && !stintInfo(race, me).eligible && (
          <p className="text-xs text-rose-500">
            Минимальный стинт не пройден: заезд сейчас — штраф +10 с за каждый недостающий круг.
          </p>
        )}

        {done ? (
          <div className="text-sm text-muted-foreground">Все обязательные питы сделаны.</div>
        ) : inLane ? (
          <div className="text-sm">Пилот в пит-лейне.</div>
        ) : handed ? (
          <div className="rounded-lg border border-primary/40 p-2 text-sm">
            <div>
              Пилот уже получил: <b>{ORDER_LABEL[handedOrder]}</b> · въезд через {tIn.toFixed(1)} с
            </div>
            <div className="text-xs text-muted-foreground">
              {race.intent !== handedOrder ? `«${ORDER_LABEL[race.intent]}» уйдёт на следующем круге.` : 'Изменить на этом круге уже нельзя.'}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span>
                Пилот получит «{ORDER_LABEL[race.intent]}»
              </span>
              <span className="font-mono tabular-nums">через {tDec.toFixed(1)} с</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-75" style={{ width: `${toDecision * 100}%` }} />
            </div>
            <div className="text-xs text-muted-foreground">Точка решения — перед последним поворотом к линии.</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LogPanel({ race }: { race: Race }) {
  const items = race.log.slice(-10).reverse()
  return (
    <Card size="sm" className="min-h-0">
      <CardHeader>
        <CardTitle>События</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        {items.length === 0 && <div className="text-muted-foreground">Пока тихо</div>}
        {items.map((it, i) => (
          <div key={i} className={cn('flex gap-2', it.us && 'font-semibold text-primary')}>
            <span className="font-mono tabular-nums text-muted-foreground">{fmtTime(it.t)}</span>
            <span>{it.text}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function KartsPanel({ race, onChange }: { race: Race; onChange: () => void }) {
  const where = (k: number) => {
    if (race.box[0] === k) return 'бокс 1'
    if (race.box[1] === k) return 'бокс 2'
    const d = race.drivers.find((x) => x.kart === k)
    return d ? d.name : ''
  }
  const karts = race.karts.slice().sort((a, b) => a.label - b.label)
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Классы картов</CardTitle>
        <CardAction className="text-xs text-muted-foreground">клик — сменить</CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-1.5">
        {karts.map((k) => (
          <button
            key={k.id}
            className="flex flex-col items-center gap-0.5 rounded-md p-1 hover:bg-muted"
            onClick={() => {
              setOurClass(race, k.id, (ourClass(race, k.id) + 1) % 4)
              onChange()
            }}
          >
            <KartBadge label={k.label} cls={ourClass(race, k.id)} />
            <span className="text-[10px] text-muted-foreground">{where(k.id)}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
