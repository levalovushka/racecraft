import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSetLang, useT, type Lang } from '@/i18n'

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

/** The logo with the language switch beside it, on every screen */
export function Brand({ className }: { className?: string }) {
  const t = useT()
  const setLang = useSetLang()
  const LANGS: [Lang, string][] = [['en', 'EN'], ['ru', 'RU']]
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <Wordmark />
      <div className="flex text-xs" role="group" aria-label={t.language}>
        {LANGS.map(([l, label]) => (
          <button
            key={l}
            lang={l}
            aria-pressed={t.lang === l}
            onClick={() => setLang(l)}
            className={cn('h-7 w-8 rounded-md font-medium transition-colors',
              t.lang === l ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
