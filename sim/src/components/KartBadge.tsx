import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { CLASS, CLASS_COLOR, CLASS_TEXT } from '@/sim/model'
import { useT } from '@/i18n'

/** A kart as on the track: its number on a disc of its class colour. The class is never spelled out */
export function Kart({ label, cls, size = 'md', onClick, className }: {
  label: number
  cls: number
  size?: 'md' | 'lg' | 'xl'
  onClick?: () => void
  className?: string
}) {
  const t = useT()
  const disc = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight tnum leading-none',
    size === 'md' && 'size-[1.375rem] text-[0.6875rem]',
    size === 'lg' && 'size-8 text-sm',
    size === 'xl' && 'size-12 text-xl',
  )
  const style = { background: CLASS_COLOR[cls], color: CLASS_TEXT[cls] }
  if (!onClick) {
    return <span className={cn(disc, className)} style={style} role="img" aria-label={t.kartAria(label, CLASS[cls])}>{label}</span>
  }
  // hover shows at once what a click does: a ring in the next class colour and an "A → B" chip
  const next = (cls + 1) % 4
  return (
    <button
      onClick={onClick}
      aria-label={`${t.kartAria(label, CLASS[cls])}. ${t.rerate}`}
      title={t.rerate}
      className={cn(disc, 'group relative cursor-pointer ring-offset-2 ring-offset-card outline-none hover:ring-2 hover:ring-(--next) focus-visible:ring-2 focus-visible:ring-(--next)', className)}
      style={{ ...style, '--next': CLASS_COLOR[next] } as CSSProperties}
    >
      {label}
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-full z-10 mr-1.5 hidden -translate-y-1/2 rounded-md border bg-popover px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap group-hover:block group-focus-visible:block">
        <span style={{ color: CLASS_COLOR[cls] }}>{CLASS[cls]}</span>
        <span className="text-muted-foreground"> → </span>
        <span style={{ color: CLASS_COLOR[next] }}>{CLASS[next]}</span>
      </span>
    </button>
  )
}
