import { useState } from 'react'
import { Dices } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { Settings } from '@/engine/race'
import { cn } from '@/lib/utils'
import { CLASS, CLASS_COLOR } from '@/sim/model'

const one = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number))

function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn('rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
            value === o.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Setup({ initial, onStart }: { initial: Settings; onStart: (s: Settings) => void }) {
  const [s, setS] = useState(initial)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }))
  const custom = s.gridPos !== null || s.ourKartClass !== null
  const pace = s.ourPace

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-xl">Симулятор менеджера</CardTitle>
          <CardDescription>
            Гонщик года · Премиум, стандартное направление · {s.laps} кругов, мин. стинт {s.minStint}, {s.pits} смены карта.
            Вы ведёте своего пилота: даёте ему указание на круг — мимо, бокс или бокс, если перед ним никто не заезжает.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="name">Фамилия пилота</Label>
            <Input id="name" value={s.ourName} maxLength={24} onChange={(e) => set('ourName', e.target.value)} placeholder="Мы" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="seed">Раздача</Label>
            <div className="flex gap-2">
              <Input id="seed" type="number" value={s.seed} onChange={(e) => set('seed', Number(e.target.value) || 1)} className="font-mono" />
              <Button variant="outline" onClick={() => set('seed', Math.floor(Math.random() * 1e6))}>
                <Dices /> Случайная
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Соперники, карты, жеребьёвка и шум кругов. Та же раздача — та же гонка: её же проедет бот для сравнения.
            </p>
          </div>

          <div className="grid gap-3">
            <Label>Наш старт</Label>
            <Segmented
              value={custom ? 'custom' : 'draw'}
              options={[{ value: 'draw', label: 'Как выпало' }, { value: 'custom', label: 'Задать' }]}
              onChange={(v) => setS((x) => (v === 'draw' ? { ...x, gridPos: null, ourKartClass: null } : { ...x, gridPos: x.gridPos ?? 10, ourKartClass: x.ourKartClass ?? 2 }))}
            />
            {custom && (
              <div className="grid gap-3 rounded-lg border p-3">
                <div className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">Позиция на старте</span>
                  <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => set('gridPos', p)}
                        className={cn('rounded-md border py-1.5 font-mono text-sm tabular-nums transition-colors',
                          s.gridPos === p ? 'border-foreground bg-foreground font-semibold text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">Класс стартового карта</span>
                  <div className="grid grid-cols-4 gap-1">
                    {CLASS.map((c, i) => (
                      <button
                        key={c}
                        onClick={() => set('ourKartClass', i)}
                        className={cn('rounded-md border-2 py-1.5 text-sm font-semibold text-white transition-opacity',
                          s.ourKartClass === i ? 'border-foreground' : 'border-transparent opacity-50 hover:opacity-80')}
                        style={{ background: CLASS_COLOR[i] }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Остальное — по раздаче. Это не отменяет её, а только ставит нас в нужное положение: бот на разборе стартует так же.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <div className="flex justify-between">
              <Label>Темп нашего пилота</Label>
              <span className="font-mono text-sm tabular-nums">
                {pace === 0 ? 'как поле' : `${pace < 0 ? 'быстрее' : 'медленнее'} на ${Math.abs(pace).toFixed(2)} с/круг`}
              </span>
            </div>
            <Slider min={-0.4} max={0.4} step={0.05} value={[pace]} onValueChange={(v) => set('ourPace', Math.round(one(v) * 100) / 100)} />
          </div>

          <div className="grid gap-3">
            <div className="flex justify-between">
              <Label>Агрессивность в борьбе</Label>
              <span className="font-mono text-sm tabular-nums">{s.ourAggr.toFixed(1)}</span>
            </div>
            <Slider min={0} max={1} step={0.1} value={[s.ourAggr]} onValueChange={(v) => set('ourAggr', Math.round(one(v) * 10) / 10)} />
            <p className="text-xs text-muted-foreground">Как быстро пилот проходит соперника, если догнал его. 0 — сидит за спиной, 1 — идёт в атаку сразу.</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button size="lg" className="w-full" onClick={() => onStart(s)}>Старт</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
