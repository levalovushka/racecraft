import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-panel bg-card', className)}>{children}</section>
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
