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
import { Kart } from './KartBadge'
import { StintRibbon } from './StintRibbon'
import { Panel, Wordmark } from './kit'

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
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[76rem] items-center gap-4 px-6">
          <Wordmark />
          <span className="caption">Debrief · seed {race.settings.seed}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="lg" onClick={onAgain}><RotateCcw /> Same seed again</Button>
            <Button size="lg" onClick={onNew}>New race <ArrowRight /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[76rem] flex-col gap-4 px-6 py-6">
        {/* verdict first */}
        <Panel className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] overflow-hidden">
          <div className="p-7">
            <div className="caption">Against the bot on the same seed</div>
            <div className={cn('mt-2 text-[4rem] leading-none font-semibold tracking-tight tnum',
              even ? 'text-foreground' : delta > 0 ? 'text-ok' : 'text-hot')}>
              {even ? '±0' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}`}
              <span className="ml-2 text-2xl font-medium text-muted-foreground">s</span>
            </div>
            <p className="mt-4 max-w-[30rem] text-sm leading-relaxed text-muted-foreground">
              {even ? 'Level with the bot.' : delta > 0 ? 'You beat the bot.' : 'The bot did better.'}{' '}
              Same karts, rivals and noise: the difference is your calls.
            </p>
          </div>
          <div className="grid grid-rows-2 border-l border-background">
            <Result who={name} pos={ours.pos} dsq={ours.dsq} laps={ours.laps} time={ours.time} penalty={ours.penalty} strong />
            <Result who="Bot" pos={bot.outcome.pos} dsq={bot.outcome.dsq} laps={bot.outcome.laps}
              time={results(bot.race).find((x) => x.driver.isUs)!.time} penalty={results(bot.race).find((x) => x.driver.isUs)!.penalty} className="border-t border-background" />
          </div>
        </Panel>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4">
          <Panel className="p-5">
            <h2 className="text-sm font-medium">Where the time went</h2>
            <LossTable rows={[
              ['Karts', ourLoss.karts, botLoss.karts],
              ['Under red', ourLoss.redWait, botLoss.redWait],
              ['Traffic', ourLoss.traffic, botLoss.traffic],
              ['Penalties', ourLoss.penalties, botLoss.penalties],
            ]} name={name} />
          </Panel>
          <Panel className="p-5">
            <div className="flex items-baseline justify-between"><h2 className="text-sm font-medium">Stints</h2><span className="caption">true classes</span></div>
            <div className="mt-4 grid gap-5">
              <StintsRow title={name} rows={stintViews(race)} laps={race.settings.laps} />
              <StintsRow title="Bot" rows={stintViews(bot.race)} laps={race.settings.laps} />
            </div>
          </Panel>
        </div>

        <DecisionsPanel decisions={decisions} race={race} />

        <Panel className="p-5">
          <h2 className="text-sm font-medium">Classification</h2>
          <div className="mt-3 text-sm tnum">
            <div className="grid h-8 grid-cols-[2.5rem_minmax(0,1fr)_4rem_6rem_5rem_minmax(0,1.4fr)] items-center gap-4 px-3 caption">
              <span>Pos</span><span>Driver</span><span className="text-right">Laps</span><span className="text-right">Time</span><span className="text-right">Penalty</span><span>Karts</span>
            </div>
            {results(race).map((x) => (
              <div key={x.driver.id} className={cn('relative grid h-10 grid-cols-[2.5rem_minmax(0,1fr)_4rem_6rem_5rem_minmax(0,1.4fr)] items-center gap-4 rounded-md px-3',
                'border-t', x.driver.isUs && 'font-semibold before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground')}>
                <span>{x.dsq ? 'DSQ' : x.pos}</span>
                <span className="truncate">{x.driver.name}</span>
                <span className="text-right">{x.laps}</span>
                <span className="text-right">{fmtTime(x.time)}</span>
                <span className={cn('text-right', x.penalty > 0 && 'text-hot')}>{x.penalty ? `+${x.penalty} s` : ''}</span>
                <span className="flex gap-1">
                  {stintViews(race, x.driver.id).map((s, i) => <Kart key={i} label={s.label} cls={s.trueClass} />)}
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
          {laps} laps · {fmtTime(time)}
          {penalty > 0 && <span className="text-hot"> · +{penalty} s penalty</span>}
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
        <div className={cn('h-full rounded-full', dim ? 'bg-foreground/35' : 'bg-foreground')}
          style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
      </div>
      <span className={cn('w-14 text-right text-[0.8125rem] tnum', dim && 'text-muted-foreground')}>{fmtS(v)}</span>
    </div>
  )
  return (
    <div className="mt-4 text-sm">
      <div className="grid grid-cols-[6.5rem_1fr_1fr] gap-x-5 pb-2 caption">
        <span />
        <span className="truncate">{name}</span>
        <span>Bot</span>
      </div>
      {rows.map(([k, a, b]) => (
        <div key={k} className="grid h-9 grid-cols-[6.5rem_1fr_1fr] items-center gap-x-5 border-t">
          <span className="text-muted-foreground">{k}</span>
          <Bar v={a} />
          <Bar v={b} dim />
        </div>
      ))}
      <div className="grid h-10 grid-cols-[6.5rem_1fr_1fr] items-center gap-x-5 border-t font-medium tnum">
        <span>Total</span>
        <span className="text-right">{fmtS(total[0])} s</span>
        <span className="text-right text-muted-foreground">{fmtS(total[1])} s</span>
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
        <span className="text-xs text-muted-foreground tnum">karts {fmtS(rows.reduce((a, s) => a + s.cost, 0))} s</span>
      </div>
      <StintRibbon laps={laps} stints={ribbon} />
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {rows.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <Kart size="sm" letter label={s.label} cls={s.trueClass} />
            <span className="text-muted-foreground tnum">
              {s.laps} laps{s.ourClass !== s.trueClass && <> · you rated {CLASS[s.ourClass]}</>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const KIND: Record<DecisionView['kind'], string> = { pit: 'Stopped', hungry: 'Upgrade in box', burning: 'Burning' }

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
  const COLS = 'grid-cols-[3.5rem_8.5rem_4.5rem_4rem_4.5rem_minmax(0,1fr)_minmax(14rem,1.2fr)]'

  return (
    <Panel className="p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">Calls</h2>
        <span className="caption">
          {done < decisions.length
            ? <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> evaluating {done}/{decisions.length}</span>
            : 'each call against the other one: 24 race continuations, then the bot drives'}
        </span>
      </div>
      {decisions.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">Nothing to review: the box never had a better kart and you never stopped.</div>
      ) : (
        <div className="mt-3 text-sm tnum">
          <div className={cn('grid h-8 items-center gap-4 px-3 caption', COLS)}>
            <span>Lap</span><span>Situation</span><span>Kart</span><span className="text-right">Red</span><span className="text-right">Margin</span><span>Call</span><span>Verdict</span>
          </div>
          {decisions.map((v) => {
            const val = values[v.index]
            const ourCls = (k: number) => classOf(v.dec.snapshot.drivers[0].perceived[k])
            return (
              <div key={v.index} className={cn('grid h-11 items-center gap-4 border-t px-3', COLS)}>
                <span>{v.dec.lap}{until.has(v.index) && <span className="text-muted-foreground">–{until.get(v.index)}</span>}</span>
                <span className="text-muted-foreground">{KIND[v.kind]}</span>
                <span className="flex items-center gap-1.5">
                  <Kart label={race.karts[v.ourKart].label} cls={ourCls(v.ourKart)} />
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <Kart label={race.karts[v.offered].label} cls={ourCls(v.offered)} />
                </span>
                <span className={cn('text-right', v.wait > 0.5 ? 'text-hot' : 'text-muted-foreground')}>{v.wait > 0.5 ? `${v.wait.toFixed(0)} s` : '—'}</span>
                <span className="text-right">{v.margin} {Math.abs(v.margin) === 1 ? 'lap' : 'laps'}</span>
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
  if (order === 'box') return 'Box'
  if (order === 'stay') return 'Stay out'
  return commit ? 'Box if clear → stopped' : 'Box if clear → stayed out'
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
        {even ? 'no difference' : diff > 0 ? `right call, +${diff.toFixed(1)} s` : `${commit ? 'stay out' : 'box'} was better, ${diff.toFixed(1)} s`}
      </span>
    </div>
  )
}
