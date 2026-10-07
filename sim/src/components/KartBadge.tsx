import { cn } from '@/lib/utils'
import { CLASS, CLASS_COLOR, CLASS_TEXT } from '@/sim/model'

/** A kart as on the track: its number on a disc of its class colour; `letter` adds the class */
export function Kart({ label, cls, size = 'md', letter, dim, onClick, className }: {
  label: number
  cls: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  letter?: boolean
  dim?: boolean
  onClick?: () => void
  className?: string
}) {
  const disc = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight tnum leading-none',
        size === 'sm' && 'size-[1.125rem] text-[0.5625rem]',
        size === 'md' && 'size-[1.375rem] text-[0.6875rem]',
        size === 'lg' && 'size-8 text-sm',
        size === 'xl' && 'size-12 text-xl',
        dim && 'opacity-50',
      )}
      style={{ background: CLASS_COLOR[cls], color: CLASS_TEXT[cls] }}
    >
      {label}
    </span>
  )
  const body = (
    <>
      {disc}
      {letter && <span className={cn('font-medium text-muted-foreground', size === 'xl' ? 'text-base' : 'text-xs')}>{CLASS[cls]}</span>}
    </>
  )
  if (!onClick) return <span className={cn('inline-flex items-center gap-1.5', className)}>{body}</span>
  return (
    <button
      onClick={onClick}
      title={`Kart ${label}, your class ${CLASS[cls]}. Click to change`}
      className={cn('-m-1 inline-flex items-center gap-1.5 rounded-full p-1 transition-colors hover:bg-foreground/10', className)}
    >
      {body}
    </button>
  )
}
