import { useState } from 'react'
import { Dices } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { Settings } from '@/engine/race'
import { cn } from '@/lib/utils'

const one = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number))

export function Setup({ initial, onStart }: { initial: Settings; onStart: (s: Settings) => void }) {
  const [s, setS] = useState(initial)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }))
  const pace = s.ourPace
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-xl">Симулятор менеджера</CardTitle>
          <CardDescription>
            Гонщик года · Премиум, стандартное направление · {s.laps} кругов, мин. стинт {s.minStint}, {s.pits} смены карта, пит {s.stopTime} с.
            Вы командуете своим пилотом: «Бокс, бокс» или «Остаёмся». Пилот выполняет команду на ближайшей точке решения перед линией.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="seed">Раздача</Label>
            <div className="flex gap-2">
              <Input id="seed" type="number" value={s.seed} onChange={(e) => set('seed', Number(e.target.value) || 1)} className="font-mono" />
              <Button variant="outline" onClick={() => set('seed', Math.floor(Math.random() * 1e6))}>
                <Dices /> Случайная
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Жеребьёвка картов, соперники и шум кругов. Та же раздача — та же гонка: её же потом проедет бот для сравнения.
            </p>
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

          <div className="grid gap-2">
            <Label>Сколько стоит пит</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 28, title: '28 с', sub: 'по данным прошлых сезонов' },
                { v: 32, title: '32 с', sub: 'по геометрии новой конфигурации' },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => set('pitLoss', o.v)}
                  className={cn('rounded-lg border p-3 text-left transition-colors hover:bg-muted', s.pitLoss === o.v && 'border-primary bg-muted')}
                >
                  <div className="font-mono font-semibold">{o.title}</div>
                  <div className="text-xs text-muted-foreground">{o.sub}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              При 28 с после пита выезжаешь примерно на 2 с впереди того, за кем ехал, при 32 с — на 2 с позади.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button size="lg" onClick={() => onStart(s)}>Старт</Button>
          <p className="text-center text-xs text-muted-foreground">
            Клавиши: <kbd>B</kbd> бокс · <kbd>S</kbd> остаёмся · <kbd>Пробел</kbd> пауза · <kbd>1–5</kbd> скорость 1×–16×
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
