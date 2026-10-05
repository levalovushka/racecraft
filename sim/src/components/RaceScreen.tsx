import { useEffect } from 'react'
import { Pause, Play, Flag, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { order, raceLap, type Race, type Settings } from '@/engine/race'
import { stintInfo, timeToDecision, timeToPitIn } from '@/engine/ai'
import { useSim } from '@/sim/useSim'
import {
  CLASS, contenders, fmtTime, gapToLeader, ourClass, projectRejoin, setOurClass, statusOf, us,
} from '@/sim/model'
import { TrackView } from './TrackView'
import { KartBadge } from './KartBadge'

const SPEEDS = [1, 2, 4, 8, 16]

export function RaceScreen({ settings, onFinish }: { settings: Settings; onFinish: (r: Race) => void }) {
  const sim = useSim(settings)
  const { race, paused, setPaused, speed, setSpeed, command } = sim

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const k = e.key.toLowerCase()
      if (k === 'b' || k === 'и') command(true)
      else if (k === 's' || k === 'ы' || k === 'o' || k === 'щ') command(false)
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
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          <UsPanel race={race} />
          <DecisionPanel race={race} command={command} />
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
        <CardTitle>Мы · #{me.num}</CardTitle>
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

function DecisionPanel({ race, command }: { race: Race; command: (box: boolean) => void }) {
  const me = us(race)
  const red = race.t < race.greenAt
  const cont = contenders(race)
  const rejoin = projectRejoin(race)
  const tDec = timeToDecision(race, me)
  const tIn = timeToPitIn(race, me)
  const done = me.pitsDone >= race.settings.pits || race.flag
  const committed = me.commit
  const inLane = me.mode !== 'track' && me.mode !== 'done'
  const passedDecision = me.mode === 'track' && tIn < tDec

  let status: string
  if (done) status = 'Все питы сделаны'
  else if (inLane) status = 'Пит-лейн'
  else if (committed) status = `Бокс на этом круге · въезд через ${tIn.toFixed(1)} с`
  else if (race.intent) status = passedDecision ? `«Бокс» на следующем круге · решение через ${tDec.toFixed(1)} с` : `«Бокс» · точка решения через ${tDec.toFixed(1)} с`
  else status = `Остаёмся · точка решения через ${tDec.toFixed(1)} с`

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Решение</CardTitle>
        <CardAction>
          <span className={cn('rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums', red ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500')}>
            {red ? `КРАСНЫЙ ${(race.greenAt - race.t).toFixed(0)} с` : 'ЗЕЛЁНЫЙ'}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Бокс</span>
          <KartBadge label={race.karts[race.box[0]].label} cls={ourClass(race, race.box[0])} />
          <KartBadge label={race.karts[race.box[1]].label} cls={ourClass(race, race.box[1])} dim />
        </div>

        <div className="space-y-1 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Кто заберёт {race.karts[race.box[0]].label} [{CLASS[ourClass(race, race.box[0])]}]
          </div>
          {cont.length === 0 && (
            <div className="text-muted-foreground">
              {race.drivers.some((d) => d.mode === 'track' && d.pitsDone < race.settings.pits && stintInfo(race, d).eligible)
                ? 'Никому не нужен — бокс мёртвый'
                : 'Пока никто не может: минимальный стинт'}
            </div>
          )}
          {cont.map((c, i) => (
            <div key={c.d.id} className={cn('flex items-center justify-between', c.d.isUs && 'font-semibold text-primary')}>
              <span>
                {i === 0 ? 'Претендент' : i === 1 ? 'Запасной' : 'Третий'} · #{c.d.num} {c.d.isUs ? 'МЫ' : c.d.name}
                <span className="ml-1 text-xs text-muted-foreground">{c.d.commit ? 'едет' : c.hard ? 'твёрдый' : 'мягкий'}</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">у въезда через {c.tEntry.toFixed(1)} с</span>
            </div>
          ))}
        </div>

        {rejoin && !done && (
          <div className="rounded-lg bg-muted/50 p-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Если бокс сейчас</span>
              <KartBadge label={race.karts[rejoin.kart].label} cls={ourClass(race, rejoin.kart)} />
            </div>
            <div className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
              {rejoin.queue > 0 && `очередь ${rejoin.queue} · `}
              {rejoin.wait > 0.5 ? <span className="text-rose-500">ждать {rejoin.wait.toFixed(0)} с</span> : 'без ожидания'}
              {' · выезд '}
              {rejoin.ahead ? `за #${rejoin.ahead.d.num} ${rejoin.ahead.gap.toFixed(1)} с` : ''}
              {rejoin.ahead && rejoin.behind ? ', ' : ''}
              {rejoin.behind ? `перед #${rejoin.behind.d.num} ${(-rejoin.behind.gap).toFixed(1)} с` : ''}
            </div>
          </div>
        )}

        <div className="text-sm">{status}</div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" disabled={done || inLane} variant={race.intent ? 'default' : 'outline'} onClick={() => command(true)} className="h-12">
            <Radio /> Бокс, бокс <kbd className="ml-1 text-[10px] opacity-60">B</kbd>
          </Button>
          <Button size="lg" disabled={done || inLane} variant={!race.intent ? 'secondary' : 'outline'} onClick={() => command(false)} className="h-12">
            Остаёмся <kbd className="ml-1 text-[10px] opacity-60">S</kbd>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const TONE: Record<string, string> = {
  muted: 'text-muted-foreground',
  ok: 'text-emerald-500',
  warn: 'text-amber-500',
  hot: 'text-rose-500 font-semibold',
  info: 'text-sky-500',
}

function TimingTable({ race }: { race: Race }) {
  const rows = order(race)
  const leader = rows[0]
  return (
    <Card size="sm" className="py-1">
      <Table className="text-xs [&_td]:py-1 [&_th]:h-7">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">P</TableHead>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Пилот</TableHead>
            <TableHead className="text-right">Круги</TableHead>
            <TableHead className="text-right">Отрыв</TableHead>
            <TableHead className="text-right">Последний</TableHead>
            <TableHead>Карт</TableHead>
            <TableHead className="text-right">На карте</TableHead>
            <TableHead className="text-right">Питы</TableHead>
            <TableHead>Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d, i) => {
            const st = statusOf(race, d)
            const cur = d.stints[d.stints.length - 1]
            return (
              <TableRow key={d.id} className={cn(d.isUs && 'bg-primary/10 font-semibold')}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="tabular-nums">{d.num}</TableCell>
                <TableCell>{d.name}</TableCell>
                <TableCell className="text-right tabular-nums">{d.lapsDone}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{gapToLeader(d, leader)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{d.lapTimes.at(-1)?.toFixed(2) ?? '—'}</TableCell>
                <TableCell><KartBadge label={race.karts[d.kart].label} cls={ourClass(race, d.kart)} /></TableCell>
                <TableCell className="text-right tabular-nums">{Math.max(0, d.lapsDone - cur.start)}</TableCell>
                <TableCell className="text-right tabular-nums">{d.pitsDone}</TableCell>
                <TableCell className={TONE[st.tone]}>{st.label}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
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
    return d ? (d.isUs ? 'мы' : `#${d.num}`) : ''
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
