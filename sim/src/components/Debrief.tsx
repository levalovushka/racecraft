import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { classOf, results, type Order, type Race } from '@/engine/race'
import {
  interestingDecisions, lossBreakdown, runBot, score, stintViews,
  type DecisionValue, type DecisionView, type StintView,
} from '@/engine/analysis'
import { CLASS, CLASS_COLOR, fmtTime, laps, TRACK } from '@/sim/model'
import { Kart } from './KartBadge'
import { StintRibbon } from './StintRibbon'
import { Panel, Wordmark } from './kit'

const TH = 'h-8 px-3 text-left align-middle font-normal caption'
const TD = 'h-11 border-t px-3 align-middle'

export function Debrief({ race, onAgain, onNew }: { race: Race; onAgain: () => void; onNew: () => void }) {
  const ours = results(race).find((x) => x.driver.isUs)!
  const bot = useMemo(() => runBot(race.settings, TRACK, race.drivers[0].perceived), [race])
  const botRow = results(bot.race).find((x) => x.driver.isUs)!
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
        <div className="mx-auto flex min-h-14 max-w-[76rem] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2">
          <Wordmark />
          <h1 className="caption">Debrief · seed {race.settings.seed}</h1>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="lg" onClick={onAgain}><RotateCcw /> Race again</Button>
            <Button size="lg" onClick={onNew}>Start new race <ArrowRight /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[76rem] flex-col gap-3 px-6 pt-4 pb-8">
        {/* verdict first */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel className="p-7">
            <h2 className="caption">Against the bot on the same seed</h2>
            <div className={cn('mt-3 text-hero font-semibold tnum', even ? 'text-foreground' : delta > 0 ? 'text-ok' : 'text-hot')}>
              {even ? '±0' : fmtS(delta)}
              <span className="ml-2 text-2xl font-medium text-muted-foreground">s</span>
            </div>
            <p className="mt-4 max-w-[30rem] text-sm text-pretty text-muted-foreground">
              {even ? 'Level with the bot.' : delta > 0 ? 'You beat the bot.' : 'The bot did better.'}{' '}
              Same karts, rivals and noise: the difference is your calls.
            </p>
          </Panel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Result who={name} pos={ours.pos} dsq={ours.dsq} laps={ours.laps} time={ours.time} penalty={ours.penalty} strong />
            <Result who="Bot" pos={bot.outcome.pos} dsq={bot.outcome.dsq} laps={bot.outcome.laps} time={botRow.time} penalty={botRow.penalty} />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
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
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-medium">Stints</h2>
              <span className="caption">true classes</span>
            </div>
            <div className="mt-4 grid gap-6">
              <StintsRow title={name} rows={stintViews(race)} laps={race.settings.laps} />
              <StintsRow title="Bot" rows={stintViews(bot.race)} laps={race.settings.laps} />
            </div>
          </Panel>
        </div>

        <DecisionsPanel decisions={decisions} race={race} />

        <Panel className="p-5">
          <h2 className="text-sm font-medium">Classification</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm tnum">
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, 'w-16')}>Pos</th>
                  <th scope="col" className={TH}>Driver</th>
                  <th scope="col" className={cn(TH, 'w-20 text-right')}>Laps</th>
                  <th scope="col" className={cn(TH, 'w-24 text-right')}>Time</th>
                  <th scope="col" className={cn(TH, 'w-24 text-right')}>Penalty</th>
                  <th scope="col" className={cn(TH, 'pl-6')}>Karts</th>
                </tr>
              </thead>
              <tbody>
                {results(race).map((x) => (
                  <tr key={x.driver.id} className={cn(x.driver.isUs && 'font-semibold')} aria-current={x.driver.isUs ? 'true' : undefined}>
                    <td className={cn(TD, 'relative', x.driver.isUs && 'before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground')}>{x.dsq ? 'DSQ' : x.pos}</td>
                    <th scope="row" className={cn(TD, 'text-left', x.driver.isUs ? 'font-semibold' : 'font-normal')}>{x.driver.name}</th>
                    <td className={cn(TD, 'text-right')}>{x.laps}</td>
                    <td className={cn(TD, 'text-right')}>{fmtTime(x.time)}</td>
                    <td className={cn(TD, 'text-right', x.penalty > 0 && 'text-hot')}>{x.penalty ? `+${x.penalty} s` : ''}</td>
                    <td className={cn(TD, 'pl-6')}>
                      <span className="flex gap-3">
                        {stintViews(race, x.driver.id).map((s, i) => <Kart key={i} label={s.label} cls={s.trueClass} />)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  )
}

function Result({ who, pos, dsq, laps: n, time, penalty, strong }: {
  who: string; pos: number; dsq: boolean; laps: number; time: number; penalty: number; strong?: boolean
}) {
  return (
    <Panel className="flex items-center justify-between gap-4 px-7 py-5">
      <div className="min-w-0">
        <h2 className={cn('truncate text-sm', strong ? 'font-medium' : 'text-muted-foreground')}>{who}</h2>
        <div className="mt-1 caption tnum">
          {laps(n)} · {fmtTime(time)}
          {penalty > 0 && <span className="text-hot"> · +{penalty} s penalty</span>}
        </div>
      </div>
      <div className={cn('text-4xl font-semibold tracking-[-0.02em] tnum', !strong && 'text-muted-foreground')}>{dsq ? 'DSQ' : `P${pos}`}</div>
    </Panel>
  )
}

const fmtS = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`

function LossTable({ rows, name }: { rows: [string, number, number][]; name: string }) {
  const max = Math.max(5, ...rows.flatMap(([, a, b]) => [Math.abs(a), Math.abs(b)]))
  const total = rows.reduce((t, [, a, b]) => [t[0] + a, t[1] + b], [0, 0])
  const Bar = ({ v, other }: { v: number; other?: boolean }) => (
    <span className="flex items-center gap-2.5">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" aria-hidden>
        <span className={cn('block h-full rounded-full', other ? 'bg-muted-foreground' : 'bg-foreground')} style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
      </span>
      <span className={cn('w-14 text-right', other && 'text-muted-foreground')}>{fmtS(v)}</span>
    </span>
  )
  return (
    <table className="mt-3 w-full table-fixed text-data tnum">
      <thead>
        <tr>
          <td className="w-24" />
          <th scope="col" className="h-8 pr-5 text-left font-normal caption">{name}</th>
          <th scope="col" className="h-8 text-left font-normal caption">Bot</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, a, b]) => (
          <tr key={k}>
            <th scope="row" className="h-9 border-t text-left font-normal text-muted-foreground">{k}</th>
            <td className="border-t pr-5"><Bar v={a} /></td>
            <td className="border-t"><Bar v={b} other /></td>
          </tr>
        ))}
        <tr className="font-medium">
          <th scope="row" className="h-10 border-t text-left font-medium">Total</th>
          <td className="border-t pr-5 text-right">{fmtS(total[0])} s</td>
          <td className="border-t text-right text-muted-foreground">{fmtS(total[1])} s</td>
        </tr>
      </tbody>
    </table>
  )
}

function StintsRow({ title, rows, laps: total }: { title: string; rows: StintView[]; laps: number }) {
  const ribbon = rows.map((s, i) => {
    const from = rows.slice(0, i).reduce((a, x) => a + x.laps, 0)
    return { from, to: from + s.laps, cls: s.trueClass, label: s.label }
  })
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
        <h3 className="font-medium">{title}</h3>
        <span className="caption tnum">karts {fmtS(rows.reduce((a, s) => a + s.cost, 0))} s</span>
      </div>
      <StintRibbon laps={total} stints={ribbon} />
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {rows.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <Kart label={s.label} cls={s.trueClass} />
            <span className="text-muted-foreground tnum">
              {laps(s.laps)}{s.ourClass !== s.trueClass && (
                <> · you rated it <span className="ml-0.5 inline-block size-2 rounded-full align-middle" style={{ background: CLASS_COLOR[s.ourClass] }} role="img" aria-label={`class ${CLASS[s.ourClass]}`} /></>
              )}
            </span>
          </li>
        ))}
      </ul>
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

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium">Calls</h2>
        <span className="caption" role="status">
          {done < decisions.length
            ? <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden /> Evaluating {done} of {decisions.length}</span>
            : 'Each call against the other one: 24 race continuations, then the bot drives'}
        </span>
      </div>
      {decisions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing to review: the box never had a better kart and you never stopped.</p>
      ) : (
        <div className="mt-3">
          <table className="w-full text-sm tnum">
            <thead>
              <tr>
                <th scope="col" className={TH}>Lap</th>
                <th scope="col" className={TH}>Situation</th>
                <th scope="col" className={TH}>Kart</th>
                <th scope="col" className={cn(TH, 'text-right')}>Red</th>
                <th scope="col" className={cn(TH, 'text-right')}>Margin</th>
                <th scope="col" className={cn(TH, 'pl-6')}>Call</th>
                <th scope="col" className={TH}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((v) => {
                const val = values[v.index]
                const ourCls = (k: number) => classOf(v.dec.snapshot.drivers[0].perceived[k])
                return (
                  <tr key={v.index}>
                    <th scope="row" className={cn(TD, 'text-left font-normal whitespace-nowrap')}>
                      {v.dec.lap}{until.has(v.index) && <span className="text-muted-foreground">–{until.get(v.index)}</span>}
                    </th>
                    <td className={cn(TD, 'text-muted-foreground')}>{KIND[v.kind]}</td>
                    <td className={cn(TD, 'whitespace-nowrap')}>
                      <span className="flex items-center gap-2">
                        <Kart label={race.karts[v.ourKart].label} cls={ourCls(v.ourKart)} />
                        <ArrowRight className="size-3 text-muted-foreground" aria-label="to" />
                        <Kart label={race.karts[v.offered].label} cls={ourCls(v.offered)} />
                      </span>
                    </td>
                    <td className={cn(TD, 'text-right whitespace-nowrap', v.wait > 0.5 ? 'text-hot' : 'text-muted-foreground')}>{v.wait > 0.5 ? `${v.wait.toFixed(0)} s` : '—'}</td>
                    <td className={cn(TD, 'text-right whitespace-nowrap')}>{laps(v.margin)}</td>
                    <td className={cn(TD, 'pl-6 font-medium')}>{orderText(v.dec.order, v.dec.commit)}</td>
                    <td className={TD}>{val ? <Verdict val={val} commit={v.dec.commit} /> : <span className="block h-1.5 w-24 rounded-full bg-track motion-safe:animate-pulse" aria-label="Evaluating" />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
    <span className="flex items-center gap-3">
      <span className="relative h-1.5 w-24 shrink-0 rounded-full bg-track max-lg:hidden" aria-hidden>
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-muted-foreground" />
        {!even && (
          <span className={cn('absolute inset-y-0 rounded-full', diff > 0 ? 'left-1/2 bg-ok' : 'right-1/2 bg-hot')} style={{ width: `${w}%` }} />
        )}
      </span>
      <span className={cn(even ? 'text-muted-foreground' : diff > 0 ? 'text-ok' : 'text-hot')}>
        {even ? 'No difference' : diff > 0 ? `Right call, ${fmtS(diff)} s` : `${commit ? 'Staying out' : 'Boxing'} was better, ${fmtS(diff)} s`}
      </span>
    </span>
  )
}
