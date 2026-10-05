import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { classOf, results, type Order, type Race } from '@/engine/race'
import {
  interestingDecisions, lossBreakdown, runBot, score, stintViews,
  type DecisionValue, type DecisionView, type StintView,
} from '@/engine/analysis'
import { CLASS, fmtTime, TRACK } from '@/sim/model'
import { KartBadge } from './KartBadge'

export function Debrief({ race, onAgain, onNew }: { race: Race; onAgain: () => void; onNew: () => void }) {
  const ours = results(race).find((x) => x.driver.isUs)!
  const bot = useMemo(() => runBot(race.settings, TRACK, race.drivers[0].perceived), [race])
  const ourScore = score({ total: ours.total, pos: ours.pos, laps: ours.laps, dsq: ours.dsq }, race)
  const botScore = score(bot.outcome, bot.race)
  const delta = botScore - ourScore
  const decisions = useMemo(() => interestingDecisions(race), [race])
  const ourLoss = lossBreakdown(race)
  const botLoss = lossBreakdown(bot.race)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Разбор гонки</h1>
        <span className="font-mono text-sm text-muted-foreground">раздача {race.settings.seed}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onAgain}>Ещё раз эту раздачу</Button>
          <Button onClick={onNew}>Новая гонка</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>{race.drivers[0].name}</CardDescription>
            <CardTitle className="text-3xl">{ours.dsq ? 'DSQ' : `P${ours.pos}`}</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-sm tabular-nums text-muted-foreground">
            {ours.laps} кр · {fmtTime(ours.time)}{ours.penalty > 0 && <span className="text-rose-500"> +{ours.penalty} с штраф</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Бот на той же раздаче</CardDescription>
            <CardTitle className="text-3xl">{bot.outcome.dsq ? 'DSQ' : `P${bot.outcome.pos}`}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Тот же старт, правило входа с вашими классами картов, под красный не встаёт.
          </CardContent>
        </Card>
        <Card className={cn(delta >= 0 ? 'ring-emerald-500/40' : 'ring-rose-500/40')}>
          <CardHeader>
            <CardDescription>Против бота</CardDescription>
            <CardTitle className={cn('text-3xl tabular-nums', delta >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
              {delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)} с
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {delta >= 0 ? 'Вы обыграли бота' : 'Бот проехал эту раздачу лучше'}. Лотерея картов одинаковая — разница от решений.
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card size="sm">
          <CardHeader><CardTitle>Куда ушло время</CardTitle></CardHeader>
          <CardContent>
            <Table className="text-sm">
              <TableHeader>
                <TableRow><TableHead /><TableHead className="text-right">Мы</TableHead><TableHead className="text-right">Бот</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['Карты против среднего', ourLoss.karts, botLoss.karts],
                  ['Ожидание под красным', ourLoss.redWait, botLoss.redWait],
                  ['Трафик', ourLoss.traffic, botLoss.traffic],
                  ['Штрафы', ourLoss.penalties, botLoss.penalties],
                ].map(([k, a, b]) => (
                  <TableRow key={k as string}>
                    <TableCell>{k}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmtS(a as number)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmtS(b as number)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>Стинты</CardTitle><CardDescription>Истинный класс открыт после гонки</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stints title={race.drivers[0].name} rows={stintViews(race)} />
            <Stints title="Бот" rows={stintViews(bot.race)} />
          </CardContent>
        </Card>
      </div>

      <DecisionsCard decisions={decisions} race={race} />

      <Card size="sm">
        <CardHeader><CardTitle>Итоговый протокол</CardTitle></CardHeader>
        <CardContent>
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>P</TableHead><TableHead>#</TableHead><TableHead>Пилот</TableHead>
                <TableHead className="text-right">Круги</TableHead><TableHead className="text-right">Время</TableHead>
                <TableHead className="text-right">Штраф</TableHead><TableHead>Карты</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results(race).map((x) => (
                <TableRow key={x.driver.id} className={cn(x.driver.isUs && 'bg-primary/10 font-semibold')}>
                  <TableCell>{x.dsq ? 'DSQ' : x.pos}</TableCell>
                  <TableCell>{x.driver.num}</TableCell>
                  <TableCell>{x.driver.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.laps}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmtTime(x.time)}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.penalty || ''}</TableCell>
                  <TableCell className="flex gap-1">
                    {stintViews(race, x.driver.id).map((s, i) => <KartBadge key={i} label={s.label} cls={s.trueClass} />)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function fmtS(x: number) {
  return `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)} с`
}

function Stints({ title, rows }: { title: string; rows: StintView[] }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      {rows.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <KartBadge label={s.label} cls={s.trueClass} />
          <span className="text-xs text-muted-foreground">вы: {CLASS[s.ourClass]}</span>
          <span className="ml-auto font-mono text-xs tabular-nums">{s.laps} кр · {fmtS(s.cost)}</span>
        </div>
      ))}
    </div>
  )
}

const KIND: Record<DecisionView['kind'], string> = { pit: 'Заехали', hungry: 'Был апгрейд', burning: 'Горели' }

function DecisionsCard({ decisions, race }: { decisions: DecisionView[]; race: Race }) {
  const [values, setValues] = useState<Record<number, DecisionValue | 'busy'>>({})
  const worker = useRef<Worker | null>(null)
  useEffect(() => {
    const w = new Worker(new URL('../sim/evalWorker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ id: number; value: DecisionValue }>) => {
      setValues((v) => ({ ...v, [e.data.id]: e.data.value }))
    }
    worker.current = w
    return () => w.terminate()
  }, [])
  const evaluate = (v: DecisionView) => {
    setValues((x) => ({ ...x, [v.index]: 'busy' }))
    worker.current?.postMessage({ id: v.index, dec: v.dec, n: 24 })
  }
  const evaluateAll = () => decisions.forEach((v) => !values[v.index] && evaluate(v))

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Решения</CardTitle>
        <CardDescription>
          Моменты, когда вы заехали, когда в боксе был карт лучше вашего или когда вы горели. Оценка — 24 продолжения гонки из этой точки с «боксом» и с «остаёмся»; дальше за нас едет бот.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {decisions.length === 0 ? (
          <div className="text-sm text-muted-foreground">Нечего разбирать.</div>
        ) : (
          <>
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={evaluateAll}>Оценить все</Button>
            </div>
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Круг</TableHead><TableHead>Ситуация</TableHead><TableHead>Наш карт</TableHead><TableHead>Получили бы</TableHead>
                  <TableHead className="text-right">Ожидание</TableHead><TableHead className="text-right">Запас</TableHead>
                  <TableHead>Решение</TableHead><TableHead className="text-right">Бокс</TableHead><TableHead className="text-right">Остаёмся</TableHead><TableHead>Вывод</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisions.map((v) => {
                  const val = values[v.index]
                  const s = v.dec.snapshot
                  const ourCls = (k: number) => classOf(s.drivers[0].perceived[k])
                  return (
                    <TableRow key={v.index}>
                      <TableCell className="tabular-nums">{v.dec.lap}</TableCell>
                      <TableCell>{KIND[v.kind]}</TableCell>
                      <TableCell><KartBadge label={race.karts[v.ourKart].label} cls={ourCls(v.ourKart)} /></TableCell>
                      <TableCell><KartBadge label={race.karts[v.offered].label} cls={ourCls(v.offered)} /></TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{v.wait > 0.5 ? `${v.wait.toFixed(0)} с` : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{v.margin} кр</TableCell>
                      <TableCell className="font-semibold">{orderText(v.dec.order, v.dec.commit)}</TableCell>
                      {val && val !== 'busy' ? (
                        <>
                          <TableCell className="text-right font-mono tabular-nums">{val.pit.mean.toFixed(1)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{val.stay.mean.toFixed(1)}</TableCell>
                          <TableCell><Verdict val={val} commit={v.dec.commit} /></TableCell>
                        </>
                      ) : (
                        <TableCell colSpan={3} className="text-right">
                          {val === 'busy' ? (
                            <Loader2 className="ml-auto size-4 animate-spin" />
                          ) : (
                            <Button size="xs" variant="outline" onClick={() => evaluate(v)}>Оценить</Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function orderText(order: Order, commit: boolean) {
  if (order === 'box') return 'Бокс'
  if (order === 'stay') return 'Мимо'
  return commit ? 'Бокс, если чисто → заехали' : 'Бокс, если чисто → перед нами заехали'
}

function Verdict({ val, commit }: { val: DecisionValue; commit: boolean }) {
  const chosen = commit ? val.pit : val.stay
  const other = commit ? val.stay : val.pit
  const diff = other.mean - chosen.mean // > 0: our choice was faster
  const se = Math.sqrt(chosen.sd ** 2 / chosen.n + other.sd ** 2 / other.n)
  if (Math.abs(diff) < Math.max(0.5, 2 * se)) return <span className="text-muted-foreground">равноценно</span>
  return diff > 0 ? (
    <span className="text-emerald-500">верно, +{diff.toFixed(1)} с</span>
  ) : (
    <span className="text-rose-500">лучше было {commit ? 'остаться' : 'заехать'}, {diff.toFixed(1)} с</span>
  )
}
