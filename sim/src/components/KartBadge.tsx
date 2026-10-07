import { cn } from '@/lib/utils'
import { CLASS, CLASS_COLOR, CLASS_TEXT } from '@/sim/model'

/** A kart as on the track: its number on a disc of its class colour. The class is never spelled out */
export function Kart({ label, cls, size = 'md', onClick, className }: {
  label: number
  cls: number
  size?: 'md' | 'lg' | 'xl'
  onClick?: () => void
  className?: string
}) {
  const disc = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight tnum leading-none',
    size === 'md' && 'size-[1.375rem] text-[0.6875rem]',
    size === 'lg' && 'size-8 text-sm',
    size === 'xl' && 'size-12 text-xl',
  )
  const style = { background: CLASS_COLOR[cls], color: CLASS_TEXT[cls] }
  if (!onClick) {
    return <span className={cn(disc, className)} style={style} role="img" aria-label={`Kart ${label}, class ${CLASS[cls]}`}>{label}</span>
  }
  return (
    <button
      onClick={onClick}
      aria-label={`Kart ${label}, class ${CLASS[cls]}. Change your rating`}
      title="Change your class rating"
      className={cn(disc, 'cursor-pointer ring-offset-2 ring-offset-card transition-shadow hover:ring-2 hover:ring-ring', className)}
      style={style}
    >
      {label}
    </button>
  )
}
