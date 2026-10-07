import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { classOf, results, type Order, type Race } from '@/engine/race'
import {
  interestingDecisions, lossBreakdown, runBot, score, stintViews,
  type DecisionValue, type DecisionView, type StintView,
} from '@/engine/analysis'
import { CLASS, fmtTime, TRACK } from '@/sim/model'
import { KartBadge } from './KartBadge'
import { StintRibbon } from './StintRibbon'
import { Panel, SectionHead, Wordmark } from './kit'

export function Debrief({ race, onAgain, onNew }: { race: Race; onAgain: () => void; onNew: () => void }) {
  const ours = results(race).find((x) => x.driver.isUs)!
  const bot = useMemo(() => runBot(race.settings, TRACK, race.drivers[0].perceived), [race])
  const ourScore = score({ total: ours.total, pos: ours.pos, laps: ours.laps, dsq: ours.dsq }, race)
  const botScore = score(bot.outcome, bot.race)
  const delta = botScore - ourScore // > 0: we beat the bot
  const decisions = useMemo(() => interestingDecisions(race), [race])
  const ourLoss = lossBreakdown(race)
  const botLoss = lossBreakdown(bot.race)
  const name = race.drivers[0].name
  const even = Math.abs(delta) < 0.5

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[76rem] items-center gap-4 px-6">
          <Wordmark />
          <span className="text-xs text-muted-foreground">Разбор · раздача <span className="tnum">{race.settings.seed}</span></span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="lg" onClick={onAgain}><RotateCcw /> Ещё раз эту раздачу</Button>
            <Button size="lg" onClick={onNew}>Новая гонка <ArrowRight /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[76rem] flex-col gap-4 px-6 py-6">
        {/* verdict first */}
        <Panel className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] overflow-hidden">
          <div className="p-7">
            <div className="label-caps">Против бота на той же раздаче</div>
            <div className={cn('mt-2 text-[4rem] leading-none font-semibold tracking-tight tnum',
              even ? 'text-foreground' : delta > 0 ? 'text-ok' : 'text-hot')}>
              {even ? '±0' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}`}
              <span className="ml-1.5 text-2xl font-medium text-muted-foreground">с</span>
            </div>
            <p className="mt-4 max-w-[30rem] text-sm leading-relaxed text-muted-foreground">
              {even ? 'Вровень с ботом.' : delta > 0 ? 'Вы проехали раздачу лучше бота.' : 'Бот проехал эту раздачу лучше.'}{' '}
              Карты, соперники и шум одинаковые — разница только от решений. Бот ездит по правилу входа с вашими классами и под красный не встаёт.
            </p>
          </div>
          <div className="grid grid-rows-2 border-l">
            <Result who={name} pos={ours.pos} dsq={ours.dsq} laps={ours.laps} time={ours.time} penalty={ours.penalty} strong />
            <Result who="Бот" pos={bot.outcome.pos} dsq={bot.outcome.dsq} laps={bot.outcome.laps}
              time={results(bot.race).find((x) => x.driver.isUs)!.time} penalty={results(bot.race).find((x) => x.driver.isUs)!.penalty} className="border-t" />
          </div>
        </Panel>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4">
          <Panel className="p-5">
            <SectionHead title="Куда ушло время" aside="против среднего карта и чистой гонки" />
            <LossTable rows={[
              ['Карты', ourLoss.karts, botLoss.karts],
              ['Под красным', ourLoss.redWait, botLoss.redWait],
              ['Трафик', ourLoss.traffic, botLoss.traffic],
              ['Штрафы', ourLoss.penalties, botLoss.penalties],
            ]} name={name} />
          </Panel>
          <Panel className="p-5">
            <SectionHead title="Стинты" aside="истинные классы — открыты после гонки" />
            <div className="mt-4 grid gap-5">
              <StintsRow title={name} rows={stintViews(race)} laps={race.settings.laps} />
              <StintsRow title="Бот" rows={stintViews(bot.race)} laps={race.settings.laps} />
            </div>
          </Panel>
        </div>

        <DecisionsPanel decisions={decisions} race={race} />

        <Panel className="p-5">
          <SectionHead title="Итоговый протокол" />
          <div className="mt-3 text-sm tnum">
            <div className="grid h-8 grid-cols-[2.5rem_minmax(0,1fr)_4rem_6rem_5rem_minmax(0,1.4fr)] items-center gap-4 px-3 label-caps">
              <span>P</span><span>Пилот</span><span className="text-right">Круги</span><span className="text-right">Время</span><span className="text-right">Штраф</span><span>Карты</span>
            </div>
            {results(race).map((x) => (
              <div key={x.driver.id} className={cn('relative grid h-10 grid-cols-[2.5rem_minmax(0,1fr)_4rem_6rem_5rem_minmax(0,1.4fr)] items-center gap-4 rounded-md px-3',
                x.driver.isUs ? 'bg-foreground/[0.07] font-medium before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground' : 'odd:bg-foreground/[0.02]')}>
                <span>{x.dsq ? 'DSQ' : x.pos}</span>
                <span className="truncate">{x.driver.name}</span>
                <span className="text-right">{x.laps}</span>
                <span className="text-right">{fmtTime(x.time)}</span>
                <span className={cn('text-right', x.penalty > 0 && 'text-hot')}>{x.penalty ? `+${x.penalty} с` : ''}</span>
                <span className="flex gap-1">
                  {stintViews(race, x.driver.id).map((s, i) => <KartBadge key={i} label={s.label} cls={s.trueClass} />)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </main>
    </div>
  )
}

function Result({ who, pos, dsq, laps, time, penalty, strong, className }: {
  who: string; pos: number; dsq: boolean; laps: number; time: number; penalty: number; strong?: boolean; className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-7', className)}>
      <div className="min-w-0">
        <div className={cn('truncate text-sm', strong ? 'font-medium' : 'text-muted-foreground')}>{who}</div>
        <div className="mt-1 text-xs text-muted-foreground tnum">
          {laps} кр · {fmtTime(time)}
          {penalty > 0 && <span className="text-hot"> · +{penalty} с штраф</span>}
        </div>
      </div>
      <div className={cn('text-[2.25rem] leading-none font-semibold tracking-tight tnum', !strong && 'text-muted-foreground')}>{dsq ? 'DSQ' : `P${pos}`}</div>
    </div>
  )
}

const fmtS = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`

function LossTable({ rows, name }: { rows: [string, number, number][]; name: string }) {
  const max = Math.max(5, ...rows.flatMap(([, a, b]) => [Math.abs(a), Math.abs(b)]))
  const total = rows.reduce((t, [, a, b]) => [t[0] + a, t[1] + b], [0, 0])
  const Bar = ({ v, dim }: { v: number; dim?: boolean }) => (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
        <div className={cn('h-full rounded-full', v > 0.05 ? 'bg-hot' : v < -0.05 ? 'bg-ok' : 'bg-transparent', dim && 'opacity-45')}
          style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
      </div>
      <span className={cn('w-12 text-right text-[0.8125rem] tnum', dim && 'text-muted-foreground')}>{fmtS(v)}</span>
    </div>
  )
  return (
    <div className="mt-4 text-sm">
      <div className="grid grid-cols-[6.5rem_1fr_1fr] gap-x-5 pb-2 label-caps">
        <span />
        <span className="truncate">{name}</span>
        <span>Бот</span>
      </div>
      {rows.map(([k, a, b]) => (
        <div key={k} className="grid h-9 grid-cols-[6.5rem_1fr_1fr] items-center gap-x-5 border-t">
          <span className="text-muted-foreground">{k}</span>
          <Bar v={a} />
          <Bar v={b} dim />
        </div>
      ))}
      <div className="grid h-10 grid-cols-[6.5rem_1fr_1fr] items-center gap-x-5 border-t font-medium tnum">
        <span>Итого</span>
        <span className="text-right">{fmtS(total[0])} с</span>
        <span className="text-right text-muted-foreground">{fmtS(total[1])} с</span>
      </div>
    </div>
  )
}

function StintsRow({ title, rows, laps }: { title: string; rows: StintView[]; laps: number }) {
  const ribbon = rows.map((s, i) => {
    const from = rows.slice(0, i).reduce((a, x) => a + x.laps, 0)
    return { from, to: from + s.laps, cls: s.trueClass, label: s.label }
  })
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground tnum">карты {fmtS(rows.reduce((a, s) => a + s.cost, 0))} с</span>
      </div>
      <StintRibbon laps={laps} stints={ribbon} />
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {rows.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <KartBadge label={s.label} cls={s.trueClass} />
            <span className="text-muted-foreground tnum">
              {s.laps} кр{s.ourClass !== s.trueClass && <> · вы считали {CLASS[s.ourClass]}</>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const KIND: Record<DecisionView['kind'], string> = { pit: 'Заехали', hungry: 'В боксе апгрейд', burning: 'Горели' }

/** Every decision is evaluated in the background as soon as the debrief opens */
function DecisionsPanel({ decisions: all, race }: { decisions: DecisionView[]; race: Race }) {
  // a run of laps with the same situation and the same call is one decision: show and evaluate its first lap
  const { decisions, until } = useMemo(() => {
    const out: DecisionView[] = []
    const until = new Map<number, number>()
    for (const v of all) {
      const prev = out.at(-1)
      const last = prev && (until.get(prev.index) ?? prev.dec.lap)
      if (prev && v.kind !== 'pit' && v.kind === prev.kind && v.dec.order === prev.dec.order && v.offered === prev.offered && v.dec.lap === last! + 1) {
        until.set(prev.index, v.dec.lap)
      } else out.push(v)
    }
    return { decisions: out, until }
  }, [all])
  const [values, setValues] = useState<Record<number, DecisionValue>>({})
  useEffect(() => {
    if (decisions.length === 0) return
    const w = new Worker(new URL('../sim/evalWorker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ id: number; value: DecisionValue }>) => {
      setValues((v) => ({ ...v, [e.data.id]: e.data.value }))
    }
    for (const v of decisions) w.postMessage({ id: v.index, dec: v.dec, n: 24 })
    return () => w.terminate()
  }, [decisions])
  const done = decisions.filter((v) => values[v.index]).length
  const COLS = 'grid-cols-[3.5rem_8.5rem_6.5rem_4.5rem_4rem_minmax(0,1fr)_minmax(12rem,1.1fr)]'

  return (
    <Panel className="p-5">
      <SectionHead
        title="Решения"
        aside={done < decisions.length
          ? <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> оценка {done}/{decisions.length}</span>
          : '24 продолжения гонки с «боксом» и с «мимо», дальше за нас едет бот'}
      />
      {decisions.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">Нечего разбирать: в боксе ни разу не было карта лучше вашего, и вы не заезжали.</div>
      ) : (
        <div className="mt-3 text-sm tnum">
          <div className={cn('grid h-8 items-center gap-4 px-3 label-caps', COLS)}>
            <span>Круг</span><span>Ситуация</span><span>Карт</span><span className="text-right">Красный</span><span className="text-right">Запас</span><span>Решение</span><span>Оценка</span>
          </div>
          {decisions.map((v) => {
            const val = values[v.index]
            const ourCls = (k: number) => classOf(v.dec.snapshot.drivers[0].perceived[k])
            return (
              <div key={v.index} className={cn('grid h-11 items-center gap-4 border-t px-3', COLS)}>
                <span>{v.dec.lap}{until.has(v.index) && <span className="text-muted-foreground">–{until.get(v.index)}</span>}</span>
                <span className="text-muted-foreground">{KIND[v.kind]}</span>
                <span className="flex items-center gap-1.5">
                  <KartBadge label={race.karts[v.ourKart].label} cls={ourCls(v.ourKart)} />
                  <ArrowRight className="size-3 text-faint" />
                  <KartBadge label={race.karts[v.offered].label} cls={ourCls(v.offered)} />
                </span>
                <span className={cn('text-right', v.wait > 0.5 ? 'text-hot' : 'text-faint')}>{v.wait > 0.5 ? `${v.wait.toFixed(0)} с` : '—'}</span>
                <span className="text-right">{v.margin} кр</span>
                <span className="truncate font-medium">{orderText(v.dec.order, v.dec.commit)}</span>
                {val ? <Verdict val={val} commit={v.dec.commit} /> : <span className="h-1.5 w-24 animate-pulse rounded-full bg-foreground/10" />}
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function orderText(order: Order, commit: boolean) {
  if (order === 'box') return 'Бокс'
  if (order === 'stay') return 'Мимо'
  return commit ? 'Бокс, если чисто → заехали' : 'Бокс, если чисто → проехали'
}

/** Our choice against the other option: the bar spans ±10 s */
function Verdict({ val, commit }: { val: DecisionValue; commit: boolean }) {
  const chosen = commit ? val.pit : val.stay
  const other = commit ? val.stay : val.pit
  const diff = other.mean - chosen.mean // > 0: our choice was faster
  const se = Math.sqrt(chosen.sd ** 2 / chosen.n + other.sd ** 2 / other.n)
  const even = Math.abs(diff) < Math.max(0.5, 2 * se)
  const w = Math.min(1, Math.abs(diff) / 10) * 50
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1.5 w-24 shrink-0 rounded-full bg-foreground/[0.06]">
        <div className="absolute inset-y-[-3px] left-1/2 w-px bg-foreground/25" />
        {!even && (
          <div className={cn('absolute inset-y-0 rounded-full', diff > 0 ? 'left-1/2 bg-ok' : 'right-1/2 bg-hot')} style={{ width: `${w}%` }} />
        )}
      </div>
      <span className={cn('truncate', even ? 'text-muted-foreground' : diff > 0 ? 'text-ok' : 'text-hot')}>
        {even ? 'равноценно' : diff > 0 ? `верно, +${diff.toFixed(1)} с` : `лучше ${commit ? 'мимо' : 'бокс'}, ${diff.toFixed(1)} с`}
      </span>
    </div>
  )
}
