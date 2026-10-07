import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Dices } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { Settings } from '@/engine/race'
import { cn } from '@/lib/utils'
import { CLASS, CLASS_COLOR, CLASS_TEXT } from '@/sim/model'
import { Kbd, Wordmark } from './kit'
import { TrackOutline } from './TrackView'

const one = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number))

function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-muted p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-8 rounded-md px-2 text-sm font-medium transition-colors',
            value === o.value ? 'bg-foreground/12 text-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Field({ label, value, children, hint }: { label: string; value?: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {value !== undefined && <span className="text-sm text-muted-foreground tnum">{value}</span>}
      </div>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function Ends({ left, right }: { left: string; right: string }) {
  return (
    <div className="-mt-0.5 flex justify-between text-[0.6875rem] text-faint">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  )
}

const RULES: [string, string][] = [
  ['Трасса', 'Премиум, стандарт'],
  ['Дистанция', '60 кругов · 30 мин'],
  ['Смены карта', '2 обязательные'],
  ['Мин. стинт', '10 кругов'],
  ['Стоп', '25 с под красным'],
  ['Пересид', '+10 с за круг'],
]

const ORDERS: [string, string, string][] = [
  ['S', 'Мимо', 'проезжает въезд'],
  ['C', 'Бокс, если чисто', 'заедет, если перед ним никто не въехал'],
  ['B', 'Бокс', 'заедет на ближайшем въезде'],
]

export function Setup({ initial, onStart }: { initial: Settings; onStart: (s: Settings) => void }) {
  const [s, setS] = useState(initial)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }))
  const custom = s.gridPos !== null || s.ourKartClass !== null
  const pace = s.ourPace

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) onStart(s)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s, onStart])

  return (
    <div className="relative min-h-screen overflow-hidden">
      <TrackOutline className="pointer-events-none absolute top-1/2 left-[-6%] h-[125vh] -translate-y-1/2 text-foreground" />
      <div className="relative mx-auto grid min-h-screen max-w-[70rem] grid-cols-[minmax(0,1fr)_27rem] items-center gap-[clamp(2rem,6vw,6rem)] px-[clamp(1.5rem,4vw,4rem)] py-10">
        <div className="max-w-[32rem]">
          <Wordmark />
          <h1 className="mt-8 text-[2.5rem] leading-[1.05] font-semibold tracking-tight">Симулятор менеджера пит-стопов</h1>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
            Полная гонка «Гонщик года» в реальном времени. Вы читаете бокс и соперников и решаете, когда пилоту заезжать.
            После финиша — разбор против бота, который проехал ту же раздачу.
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-x-6 gap-y-4 border-t pt-6">
            {RULES.map(([k, v]) => (
              <div key={k}>
                <dt className="label-caps">{k}</dt>
                <dd className="mt-1 text-sm">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 border-t pt-6">
            <div className="label-caps">Указание пилоту · передаётся в точке решения перед линией</div>
            <ul className="mt-3 grid gap-2">
              {ORDERS.map(([k, name, what]) => (
                <li key={k} className="flex items-center gap-3 text-sm">
                  <Kbd className="h-5 min-w-5 text-[0.6875rem] opacity-90">{k}</Kbd>
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground">— {what}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Kbd>Пробел</Kbd> пауза</span>
              <span className="flex items-center gap-1.5"><Kbd>1</Kbd>–<Kbd>5</Kbd> скорость 1×–16×</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="grid gap-6">
            <Field label="Пилот">
              <Input value={s.ourName} maxLength={24} onChange={(e) => set('ourName', e.target.value)} placeholder="Фамилия" aria-label="Фамилия пилота" className="h-9" />
            </Field>

            <Field label="Темп" value={pace === 0 ? 'как поле' : `${pace < 0 ? '−' : '+'}${Math.abs(pace).toFixed(2)} с/круг`}>
              <Slider min={-0.4} max={0.4} step={0.05} value={[pace]} onValueChange={(v) => set('ourPace', Math.round(one(v) * 100) / 100)} aria-label="Темп пилота" />
              <Ends left="быстрее поля" right="медленнее" />
            </Field>

            <Field label="Агрессия в борьбе" value={s.ourAggr.toFixed(1)}>
              <Slider min={0} max={1} step={0.1} value={[s.ourAggr]} onValueChange={(v) => set('ourAggr', Math.round(one(v) * 10) / 10)} aria-label="Агрессия" />
              <Ends left="сидит за спиной" right="атакует сразу" />
            </Field>

            <Field label="Старт">
              <Segmented
                label="Старт"
                value={custom ? 'custom' : 'draw'}
                options={[{ value: 'draw', label: 'Как выпало' }, { value: 'custom', label: 'Задать' }]}
                onChange={(v) => setS((x) => (v === 'draw' ? { ...x, gridPos: null, ourKartClass: null } : { ...x, gridPos: x.gridPos ?? 10, ourKartClass: x.ourKartClass ?? 2 }))}
              />
              {custom && (
                <div className="mt-1 grid gap-3">
                  <div className="grid gap-1.5">
                    <span className="text-xs text-muted-foreground">Позиция на решётке</span>
                    <div className="grid grid-cols-10 gap-1">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          onClick={() => set('gridPos', p)}
                          className={cn('h-8 rounded-md text-sm tnum transition-colors',
                            s.gridPos === p ? 'bg-foreground font-semibold text-background' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground')}
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
                          className={cn('h-8 rounded-md text-sm font-bold ring-offset-2 ring-offset-card transition-opacity',
                            s.ourKartClass === i ? 'ring-2 ring-foreground' : 'opacity-45 hover:opacity-80')}
                          style={{ background: CLASS_COLOR[i], color: CLASS_TEXT[i] }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Field>

            <Field label="Раздача" hint="Соперники, карты, жеребьёвка и шум кругов. Та же раздача — та же гонка.">
              <div className="flex gap-2">
                <Input type="number" value={s.seed} onChange={(e) => set('seed', Number(e.target.value) || 1)} aria-label="Номер раздачи" className="h-9 tnum" />
                <Button variant="outline" className="h-9" onClick={() => set('seed', Math.floor(Math.random() * 1e6))}>
                  <Dices /> Случайная
                </Button>
              </div>
            </Field>
          </div>

          <Button className="mt-7 h-11 w-full text-[0.9375rem] font-semibold" onClick={() => onStart(s)}>
            Старт гонки <ArrowRight />
            <Kbd className="ml-1 border-background/30">Enter</Kbd>
          </Button>
        </div>
      </div>
    </div>
  )
}
