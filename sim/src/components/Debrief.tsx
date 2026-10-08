import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { classOf, results, type Order, type Race } from '@/engine/race'
import {
  interestingDecisions, lossBreakdown, runBot, score, stintViews,
  type DecisionValue, type DecisionView, type StintView,
} from '@/engine/analysis'
import { CLASS, CLASS_COLOR, fmtTime, TRACK } from '@/sim/model'
import { driverName, useT, type Dict } from '@/i18n'
import { Kart } from './KartBadge'
import { StintRibbon } from './StintRibbon'
import { Brand, Panel } from './kit'

const TH = 'h-8 px-3 text-left align-middle font-normal caption'
const TD = 'h-11 border-t px-3 align-middle'

export function Debrief({ race, onAgain, onNew }: { race: Race; onAgain: () => void; onNew: () => void }) {
  const t = useT()
  const ours = results(race).find((x) => x.driver.isUs)!
  const bot = useMemo(() => runBot(race.settings, TRACK, race.drivers[0].perceived), [race])
  const botRow = results(bot.race).find((x) => x.driver.isUs)!
  const ourScore = score({ total: ours.total, pos: ours.pos, laps: ours.laps, dsq: ours.dsq }, race)
  const botScore = score(bot.outcome, bot.race)
  const delta = ourScore - botScore // minus = we beat the bot, as in «Куда ушло время»
  const decisions = useMemo(() => interestingDecisions(race), [race])
  const ourLoss = lossBreakdown(race)
  const botLoss = lossBreakdown(bot.race)
  const name = driverName(t, race.drivers[0])
  const even = Math.abs(delta) < 0.05 // shows as 0.0: anything bigger must match the «Итого» difference

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-[76rem] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2">
          <Brand />
          <h1 className="text-sm text-muted-foreground">{t.debrief}</h1>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="lg" onClick={onAgain}><RotateCcw /> {t.raceAgain}</Button>
            <Button size="lg" onClick={onNew}>{t.startNewRace} <ArrowRight /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[76rem] flex-col gap-3 px-6 pt-4 pb-8">
        {/* verdict first */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel className="p-7">
            <h2 className="caption">{t.againstBot}</h2>
            <div className={cn('mt-3 text-hero font-semibold tnum', even ? 'text-foreground' : delta < 0 ? 'text-ok' : 'text-hot')}>
              {even ? '±0' : fmtS(delta)}
              <span className="ml-2 text-2xl font-medium text-muted-foreground">{t.s}</span>
            </div>
            <p className="mt-4 max-w-[30rem] text-sm text-pretty text-muted-foreground">
              {even ? t.level : delta < 0 ? t.beat : t.worse}{' '}{t.sameKarts}
            </p>
          </Panel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Result who={name} pos={ours.pos} dsq={ours.dsq} laps={ours.laps} time={ours.time} penalty={ours.penalty} strong />
            <Result who={t.bot} pos={bot.outcome.pos} dsq={bot.outcome.dsq} laps={bot.outcome.laps} time={botRow.time} penalty={botRow.penalty} />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <Panel className="p-5">
            <h2 className="text-sm font-medium">{t.whereTime}</h2>
            <p className="mt-1 caption text-pretty">{t.whereTimeNote}</p>
            <LossTable rows={[
              [t.loss.karts, ourLoss.karts, botLoss.karts],
              [t.loss.red, ourLoss.redWait, botLoss.redWait],
              [t.loss.traffic, ourLoss.traffic, botLoss.traffic],
              [t.loss.penalties, ourLoss.penalties, botLoss.penalties],
              [t.loss.other, ourLoss.other, botLoss.other],
            ]} name={name} />
            <p className="mt-3 caption text-pretty">{t.otherNote(ours.dsq || bot.outcome.dsq)}</p>
          </Panel>
          <Panel className="p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-medium">{t.stints}</h2>
              <span className="caption">{t.trueClasses}</span>
            </div>
            <div className="mt-4 grid gap-6">
              <StintsRow title={name} rows={stintViews(race)} laps={race.settings.laps} />
              <StintsRow title={t.bot} rows={stintViews(bot.race)} laps={race.settings.laps} />
            </div>
          </Panel>
        </div>

        <DecisionsPanel decisions={decisions} race={race} />

        <Panel className="p-5">
          <h2 className="text-sm font-medium">{t.classification}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm tnum">
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, 'w-16')}>{t.resultCols.pos}</th>
                  <th scope="col" className={TH}>{t.resultCols.driver}</th>
                  <th scope="col" className={cn(TH, 'w-20 text-right')}>{t.resultCols.laps}</th>
                  <th scope="col" className={cn(TH, 'w-24 text-right')}>{t.resultCols.time}</th>
                  <th scope="col" className={cn(TH, 'w-24 text-right')}>{t.resultCols.penalty}</th>
                  <th scope="col" className={cn(TH, 'pl-6')}>{t.resultCols.karts}</th>
                </tr>
              </thead>
              <tbody>
                {results(race).map((x) => (
                  <tr key={x.driver.id} className={cn(x.driver.isUs && 'font-semibold')} aria-current={x.driver.isUs ? 'true' : undefined}>
                    <td className={cn(TD, 'relative', x.driver.isUs && 'before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground')}>{x.dsq ? 'DSQ' : x.pos}</td>
                    <th scope="row" className={cn(TD, 'text-left', x.driver.isUs ? 'font-semibold' : 'font-normal')}>{driverName(t, x.driver)}</th>
                    <td className={cn(TD, 'text-right')}>{x.laps}</td>
                    <td className={cn(TD, 'text-right')}>{fmtTime(x.time)}</td>
                    <td className={cn(TD, 'text-right', x.penalty > 0 && 'text-hot')}>{x.penalty ? `+${x.penalty} ${t.s}` : ''}</td>
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
  const t = useT()
  return (
    <Panel className="flex items-center justify-between gap-4 px-7 py-5">
      <div className="min-w-0">
        <h2 className={cn('truncate text-sm', strong ? 'font-medium' : 'text-muted-foreground')}>{who}</h2>
        <div className="mt-1 caption tnum">
          {t.laps(n)} · {fmtTime(time)}
          {penalty > 0 && <span className="text-hot"> · {t.penaltyNote(penalty)}</span>}
        </div>
      </div>
      <div className={cn('text-4xl font-semibold tracking-[-0.02em] tnum', !strong && 'text-muted-foreground')}>{dsq ? 'DSQ' : `P${pos}`}</div>
    </Panel>
  )
}

const fmtS = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`

/** Rows come rounded to 0.1, so the total is the sum of what is shown. Minus = gained (green), plus = lost (red) */
function LossTable({ rows, name }: { rows: [string, number, number][]; name: string }) {
  const t = useT()
  const max = Math.max(5, ...rows.flatMap(([, a, b]) => [Math.abs(a), Math.abs(b)]))
  // float sums of 0.1 steps drift (−0.1 − 0.2 + 0.3 = −5.6e-17 → «−0.0»): snap back to the 0.1 grid
  const total = rows.reduce((t, [, a, b]) => [t[0] + a, t[1] + b], [0, 0]).map((x) => Math.round(x * 10) / 10 || 0)
  const tone = (v: number) => (Math.abs(v) < 0.05 ? 'text-muted-foreground' : v < 0 ? 'text-ok' : 'text-hot')
  const Bar = ({ v, other }: { v: number; other?: boolean }) => (
    <span className={cn('flex items-center gap-2.5', other && 'opacity-70')}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" aria-hidden>
        <span className={cn('block h-full rounded-full', v < 0 ? 'bg-ok' : 'bg-hot')} style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
      </span>
      <span className={cn('w-14 text-right', tone(v))}>{fmtS(v)}</span>
    </span>
  )
  return (
    <table className="mt-3 w-full table-fixed text-data tnum">
      <thead>
        <tr>
          <td className="w-24" />
          <th scope="col" className="h-8 pr-5 text-left font-normal caption">{name}</th>
          <th scope="col" className="h-8 text-left font-normal caption">{t.bot}</th>
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
          <th scope="row" className="h-10 border-t text-left font-medium">{t.total}</th>
          <td className={cn('border-t pr-5 text-right', tone(total[0]))}>{fmtS(total[0])} {t.s}</td>
          <td className={cn('border-t text-right opacity-70', tone(total[1]))}>{fmtS(total[1])} {t.s}</td>
        </tr>
      </tbody>
    </table>
  )
}

function StintsRow({ title, rows, laps: total }: { title: string; rows: StintView[]; laps: number }) {
  const t = useT()
  const ribbon = rows.map((s, i) => {
    const from = rows.slice(0, i).reduce((a, x) => a + x.laps, 0)
    return { from, to: from + s.laps, cls: s.trueClass, label: s.label }
  })
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
        <h3 className="font-medium">{title}</h3>
        <span className="caption tnum">{t.kartsCost} {fmtS(rows.reduce((a, s) => a + s.cost, 0))} {t.s}</span>
      </div>
      <StintRibbon laps={total} stints={ribbon} />
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {rows.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <Kart label={s.label} cls={s.trueClass} />
            <span className="text-muted-foreground tnum">
              {t.laps(s.laps)}{s.ourClass !== s.trueClass && (
                <> · {t.youRatedIt} <span className="ml-0.5 inline-block size-2 rounded-full align-middle" style={{ background: CLASS_COLOR[s.ourClass] }} role="img" aria-label={t.classN(CLASS[s.ourClass])} /></>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}


/** Every decision is evaluated in the background as soon as the debrief opens */
function DecisionsPanel({ decisions: all, race }: { decisions: DecisionView[]; race: Race }) {
  const t = useT()
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
  const [values, setValues] = useState<Record<number, DecisionValue | 'failed'>>({})
  const [progress, setProgress] = useState<Record<number, number>>({}) // 0..1 per decision
  useEffect(() => {
    // one worker per decision, at most cores − 1 at once
    const queue = [...decisions]
    const live = new Set<Worker>()
    let stopped = false
    const next = () => {
      const v = queue.shift()
      if (!v) return
      const w = new Worker(new URL('../sim/evalWorker.ts', import.meta.url), { type: 'module' })
      live.add(w)
      let settled = false
      const finish = (val: DecisionValue | 'failed') => {
        if (settled) return // onerror and onmessageerror can both fire
        settled = true
        w.terminate()
        live.delete(w)
        if (stopped) return
        setValues((x) => ({ ...x, [v.index]: val }))
        next()
      }
      w.onmessage = (e: MessageEvent<{ id: number; value?: DecisionValue; progress?: { done: number; of: number } }>) => {
        if (stopped) return
        const { value, progress: p } = e.data
        if (value) finish(value)
        else if (p) setProgress((x) => ({ ...x, [v.index]: p.done / p.of }))
      }
      w.onerror = w.onmessageerror = () => finish('failed')
      w.postMessage({ id: v.index, dec: v.dec, n: 24 })
    }
    const slots = Math.max(1, (navigator.hardwareConcurrency || 2) - 1)
    for (let i = 0; i < slots; i++) next()
    return () => {
      stopped = true
      for (const w of live) w.terminate()
    }
  }, [decisions])
  const pending = decisions.filter((v) => !values[v.index]).length
  const pct = Math.floor(100 * decisions.reduce((a, v) => a + (values[v.index] ? 1 : progress[v.index] ?? 0), 0) / Math.max(1, decisions.length))

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium">{t.calls}</h2>
        <span className="caption" role="status">
          {pending > 0
            ? <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden /> {t.evaluating(pct)}</span>
            : decisions.length > 0 && decisions.every((v) => values[v.index] === 'failed') ? t.evalAllFailed : t.callsNote}
        </span>
      </div>
      {decisions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.nothingToReview}</p>
      ) : (
        <div className="mt-3">
          <table className="w-full text-sm tnum">
            <thead>
              <tr>
                <th scope="col" className={TH}>{t.callCols.lap}</th>
                <th scope="col" className={TH}>{t.callCols.situation}</th>
                <th scope="col" className={TH}>{t.callCols.kart}</th>
                <th scope="col" className={cn(TH, 'text-right')}>{t.callCols.red}</th>
                <th scope="col" className={cn(TH, 'text-right')}>{t.callCols.margin}</th>
                <th scope="col" className={cn(TH, 'pl-6')}>{t.callCols.call}</th>
                <th scope="col" className={TH}>{t.callCols.verdict}</th>
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
                    <td className={cn(TD, 'text-muted-foreground')}>{t.kind[v.kind]}</td>
                    <td className={cn(TD, 'whitespace-nowrap')}>
                      <span className="flex items-center gap-2">
                        <Kart label={race.karts[v.ourKart].label} cls={ourCls(v.ourKart)} />
                        <ArrowRight className="size-3 text-muted-foreground" aria-label={t.to} />
                        <Kart label={race.karts[v.offered].label} cls={ourCls(v.offered)} />
                      </span>
                    </td>
                    <td className={cn(TD, 'text-right whitespace-nowrap', v.wait > 0.5 ? 'text-hot' : 'text-muted-foreground')}>{v.wait > 0.5 ? `${v.wait.toFixed(0)} ${t.s}` : '—'}</td>
                    <td className={cn(TD, 'text-right whitespace-nowrap')}>{t.laps(v.margin)}</td>
                    <td className={cn(TD, 'pl-6 font-medium')}>{orderText(t, v.dec.order, v.dec.commit)}</td>
                    <td className={TD}>
                      {val === 'failed' ? <span className="text-muted-foreground">{t.evalFailed}</span>
                        : val ? <Verdict val={val} commit={v.dec.commit} />
                        : (
                          <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-track" role="progressbar" aria-label={t.evaluatingOne} aria-valuenow={Math.round(100 * (progress[v.index] ?? 0))}>
                            <span className="block h-full rounded-full bg-muted-foreground transition-[width]" style={{ width: `${100 * (progress[v.index] ?? 0)}%` }} />
                          </span>
                        )}
                    </td>
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

function orderText(t: Dict, order: Order, commit: boolean) {
  if (order === 'box') return t.callText.box
  if (order === 'stay') return t.callText.stay
  return commit ? t.callText.clearIn : t.callText.clearOut
}

/** Our choice against the other option, minus = our choice gained: the bar spans ±10 s, gain to the left */
function Verdict({ val, commit }: { val: DecisionValue; commit: boolean }) {
  const t = useT()
  const chosen = commit ? val.pit : val.stay
  const other = commit ? val.stay : val.pit
  const diff = chosen.mean - other.mean // minus = our choice was faster
  const se = Math.sqrt(chosen.sd ** 2 / chosen.n + other.sd ** 2 / other.n)
  const even = Math.abs(diff) < Math.max(0.5, 2 * se)
  const w = Math.min(1, Math.abs(diff) / 10) * 50
  return (
    <span className="flex items-center gap-3">
      <span className="relative h-1.5 w-24 shrink-0 rounded-full bg-track max-lg:hidden" aria-hidden>
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-muted-foreground" />
        {!even && (
          <span className={cn('absolute inset-y-0 rounded-full', diff < 0 ? 'right-1/2 bg-ok' : 'left-1/2 bg-hot')} style={{ width: `${w}%` }} />
        )}
      </span>
      <span className={cn(even ? 'text-muted-foreground' : diff < 0 ? 'text-ok' : 'text-hot')}>
        {even ? t.noDifference : diff < 0 ? t.rightCall(fmtS(diff)) : t.betterWas(commit, fmtS(diff))}
      </span>
    </span>
  )
}
