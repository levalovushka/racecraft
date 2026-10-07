import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Dices } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { Settings } from '@/engine/race'
import { cn } from '@/lib/utils'
import { CLASS, CLASS_COLOR } from '@/sim/model'
import { Wordmark } from './kit'

const one = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number))

function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-8 rounded-md px-2 text-sm font-medium transition-colors',
            value === o.value ? 'bg-selected text-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Field({ id, label, value, children, hint }: { id?: string; label: string; value?: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        {id ? <label htmlFor={id} className="text-sm font-medium">{label}</label> : <span className="text-sm font-medium">{label}</span>}
        {value !== undefined && <span className="text-sm text-muted-foreground tnum">{value}</span>}
      </div>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function Ends({ left, right }: { left: string; right: string }) {
  return (
    <div className="-mt-0.5 flex justify-between caption">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  )
}

const RULES = ['60 laps', 'min stint 10', '2 kart changes', '25 s stop']

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
      label="Start"
      value={custom ? 'custom' : 'draw'}
      options={[{ value: 'draw', label: 'Drawn start' }, { value: 'custom', label: 'Set start' }]}
      onChange={(v) => setS((x) => (v === 'draw' ? { ...x, gridPos: null, ourKartClass: null } : { ...x, gridPos: x.gridPos ?? 10, ourKartClass: x.ourKartClass ?? 2 }))}
    />
  )

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-[25rem]">
        <Wordmark className="text-base [&_svg]:size-5" />
        <h1 className="mt-6 text-[2rem] leading-tight font-semibold tracking-[-0.02em]">Pit manager</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">Call the stops. Compare with a bot on the same seed.</p>
        <p className="mt-4 caption">{RULES.join(' · ')}</p>

        <div className="mt-10 grid gap-7">
          <Field id="driver" label="Driver">
            <Input id="driver" value={s.ourName} maxLength={24} onChange={(e) => set('ourName', e.target.value)} placeholder="Petrov" autoComplete="family-name" className="h-9" />
            {startToggle}
            {custom && (
              <div className="mt-1 grid gap-3">
                <div className="grid gap-1.5" role="group" aria-labelledby="grid-label">
                  <span id="grid-label" className="caption">Grid position</span>
                  <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        aria-pressed={s.gridPos === p}
                        onClick={() => set('gridPos', p)}
                        className={cn('h-8 rounded-md text-sm tnum transition-colors',
                          s.gridPos === p ? 'bg-foreground font-semibold text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5" role="group" aria-labelledby="class-label">
                  <span id="class-label" className="caption">Starting kart class</span>
                  <div className="grid grid-cols-4 gap-1">
                    {CLASS.map((c, i) => {
                      const on = s.ourKartClass === i
                      return (
                        <button
                          key={c}
                          aria-pressed={on}
                          aria-label={`Class ${c}`}
                          title={`Class ${c}`}
                          onClick={() => set('ourKartClass', i)}
                          className={cn('flex h-8 items-center justify-center rounded-md transition-colors', on ? 'bg-selected' : 'hover:bg-secondary')}
                        >
                          <span className={cn('size-4 rounded-full transition-opacity', !on && 'opacity-60')} style={{ background: CLASS_COLOR[i] }} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </Field>

          <Field label="Pace" value={pace === 0 ? 'field average' : `${pace < 0 ? '−' : '+'}${Math.abs(pace).toFixed(2)} s/lap`}>
            <Slider min={-0.4} max={0.4} step={0.05} value={[pace]} onValueChange={(v) => set('ourPace', Math.round(one(v) * 100) / 100)} aria-label="Pace" />
            <Ends left="faster" right="slower" />
          </Field>

          <Field label="Aggression" value={s.ourAggr.toFixed(1)}>
            <Slider min={0} max={1} step={0.1} value={[s.ourAggr]} onValueChange={(v) => set('ourAggr', Math.round(one(v) * 10) / 10)} aria-label="Aggression" />
            <Ends left="sits behind" right="attacks at once" />
          </Field>

          <Field id="seed" label="Seed">
            <div className="flex gap-2">
              <Input id="seed" type="number" inputMode="numeric" value={s.seed} onChange={(e) => set('seed', Number(e.target.value) || 1)} className="h-9 tnum" />
              <Button variant="outline" className="h-9" onClick={() => set('seed', Math.floor(Math.random() * 1e6))}>
                <Dices aria-hidden /> Shuffle
              </Button>
            </div>
          </Field>

          <Button className="mt-2 h-11 w-full text-base font-semibold" onClick={() => onStart(s)}>
            Start race <ArrowRight />
          </Button>
        </div>
      </div>
    </main>
  )
}
