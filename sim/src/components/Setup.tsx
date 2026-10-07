import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Dices } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { Settings } from '@/engine/race'
import { cn } from '@/lib/utils'
import { CLASS, CLASS_COLOR, CLASS_TEXT } from '@/sim/model'
import { Wordmark } from './kit'

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

const RULES = ['Премиум', '60 кругов', 'мин. стинт 10', '2 смены', 'стоп 25 с']

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

  const startToggle = (
    <Segmented
      label="Старт"
      value={custom ? 'custom' : 'draw'}
      options={[{ value: 'draw', label: 'Старт как выпал' }, { value: 'custom', label: 'Задать старт' }]}
      onChange={(v) => setS((x) => (v === 'draw' ? { ...x, gridPos: null, ourKartClass: null } : { ...x, gridPos: x.gridPos ?? 10, ourKartClass: x.ourKartClass ?? 2 }))}
    />
  )

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-[27rem]">
        <Wordmark className="text-base [&_svg]:size-5" />
        <h1 className="mt-6 text-[2rem] leading-tight font-semibold tracking-tight">Симулятор менеджера</h1>
        <p className="mt-2 text-sm text-muted-foreground">Разбор после финиша — против бота на той же раздаче.</p>
        <p className="mt-4 text-xs text-faint">{RULES.join(' · ')}</p>

        <div className="mt-6 grid gap-6 rounded-2xl border bg-card p-6">
          <div className="grid gap-2">
            <Input value={s.ourName} maxLength={24} onChange={(e) => set('ourName', e.target.value)} placeholder="Фамилия пилота" aria-label="Фамилия пилота" className="h-9" />
            {startToggle}
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
                          s.gridPos === p ? 'bg-foreground font-semibold text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">Класс стартового карта</span>
                  <div className="grid grid-cols-4 gap-1">
                    {CLASS.map((c, i) => {
                      const on = s.ourKartClass === i
                      return (
                        <button
                          key={c}
                          onClick={() => set('ourKartClass', i)}
                          className={cn('flex h-8 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors',
                            !on && 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                          style={on ? { background: CLASS_COLOR[i], color: CLASS_TEXT[i] } : undefined}
                        >
                          {!on && <span className="size-2 rounded-full" style={{ background: CLASS_COLOR[i] }} />}
                          {c}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Field label="Темп" value={pace === 0 ? 'как поле' : `${pace < 0 ? '−' : '+'}${Math.abs(pace).toFixed(2)} с/круг`}>
            <Slider min={-0.4} max={0.4} step={0.05} value={[pace]} onValueChange={(v) => set('ourPace', Math.round(one(v) * 100) / 100)} aria-label="Темп пилота" />
            <Ends left="быстрее поля" right="медленнее" />
          </Field>

          <Field label="Агрессия в борьбе" value={s.ourAggr.toFixed(1)}>
            <Slider min={0} max={1} step={0.1} value={[s.ourAggr]} onValueChange={(v) => set('ourAggr', Math.round(one(v) * 10) / 10)} aria-label="Агрессия" />
            <Ends left="сидит за спиной" right="атакует сразу" />
          </Field>

          <Field label="Раздача">
            <div className="flex gap-2">
              <Input type="number" value={s.seed} onChange={(e) => set('seed', Number(e.target.value) || 1)} aria-label="Номер раздачи" className="h-9 tnum" />
              <Button variant="outline" className="h-9" onClick={() => set('seed', Math.floor(Math.random() * 1e6))}>
                <Dices /> Случайная
              </Button>
            </div>
          </Field>

          <Button className="h-11 w-full text-[0.9375rem] font-semibold" onClick={() => onStart(s)}>
            Старт гонки <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
