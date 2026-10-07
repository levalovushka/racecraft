import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-xl border bg-card', className)}>{children}</section>
}

export function SectionHead({ title, aside, className }: { title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-5 items-center justify-between gap-3', className)}>
      <h2 className="label-caps">{title}</h2>
      {aside && <div className="flex items-center gap-2 text-xs text-muted-foreground">{aside}</div>}
    </div>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-4 min-w-4 items-center justify-center rounded border border-current/25 px-1 text-[0.625rem] font-medium leading-none opacity-70', className)}>
      {children}
    </kbd>
  )
}

/** Small light: red with seconds left, or green */
export function LightChip({ red, left }: { red: boolean; left: number }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tnum',
      red ? 'bg-hot/15 text-hot' : 'bg-ok/12 text-ok')}>
      <span className={cn('size-1.5 rounded-full', red ? 'bg-hot' : 'bg-ok')} />
      {red ? `Красный · ${left.toFixed(0)} с` : 'Зелёный'}
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-semibold tracking-tight', className)}>
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
        <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" />
        <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
        <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity=".25" />
        <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".25" />
      </svg>
      racecraft
    </span>
  )
}
