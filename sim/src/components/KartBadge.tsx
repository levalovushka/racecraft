import { cn } from '@/lib/utils'
import { CLASS, CLASS_COLOR, CLASS_TEXT } from '@/sim/model'

/** A kart as on the track: its number on a disc of its class colour, then the class letter */
export function Kart({ label, cls, size = 'md', bare, onClick, className }: {
  label: number
  cls: number
  size?: 'md' | 'lg' | 'xl'
  bare?: boolean // no class letter: only where the letter is shown next to it anyway
  onClick?: () => void
  className?: string
}) {
  const body = (
    <>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight tnum leading-none',
          size === 'md' && 'size-[1.375rem] text-[0.6875rem]',
          size === 'lg' && 'size-8 text-sm',
          size === 'xl' && 'size-12 text-xl',
        )}
        style={{ background: CLASS_COLOR[cls], color: CLASS_TEXT[cls] }}
        aria-hidden={!!onClick}
      >
        {label}
      </span>
      {!bare && <span className={cn('font-medium text-muted-foreground', size === 'xl' ? 'text-base' : 'text-xs')} aria-hidden={!!onClick}>{CLASS[cls]}</span>}
    </>
  )
  if (!onClick) return <span className={cn('inline-flex items-center gap-1.5', className)}>{body}</span>
  return (
    <button
      onClick={onClick}
      aria-label={`Kart ${label}, class ${CLASS[cls]}. Change your rating`}
      title="Change your class rating"
      className={cn('-m-1 inline-flex cursor-pointer items-center gap-1.5 rounded-full p-1 pr-2 transition-colors hover:bg-selected', className)}
    >
      {body}
    </button>
  )
}
