import { cn } from '@/lib/utils'
import { CLASS, CLASS_COLOR, CLASS_TEXT } from '@/sim/model'

/** Kart number on its class colour, with the class letter unless `bare` */
export function KartBadge({ label, cls, dim, bare, size = 'md', className }: {
  label: number
  cls: number
  dim?: boolean
  bare?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1 rounded-md font-semibold tnum leading-none',
        size === 'sm' && 'h-[1.125rem] min-w-[1.125rem] px-1 text-[0.6875rem]',
        size === 'md' && 'h-5 min-w-5 px-1.5 text-xs',
        size === 'lg' && 'h-7 min-w-7 rounded-lg px-2 text-sm',
        dim && 'opacity-55',
        className,
      )}
      style={{ background: CLASS_COLOR[cls], color: CLASS_TEXT[cls] }}
    >
      {label}
      {!bare && <span className="font-bold opacity-60">{CLASS[cls]}</span>}
    </span>
  )
}
