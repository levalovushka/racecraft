import { cn } from '@/lib/utils'
import { CLASS, CLASS_COLOR, CLASS_TEXT } from '@/sim/model'

export function KartBadge({ label, cls, dim, className }: { label: number; cls: number; dim?: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums', dim && 'opacity-60', className)}
      style={{ background: CLASS_COLOR[cls], color: CLASS_TEXT[cls] }}
    >
      {label}
      <span className="rounded bg-black/20 px-1 text-[10px]">{CLASS[cls]}</span>
    </span>
  )
}
