import { cn } from '@/lib/utils'
import { LIGHTS } from '@/sim/useSim'
import { useT } from '@/i18n'

/**
 * The start gantry over the track: a red light more every second, then all
 * green and the race is on. Fades out by itself a moment after the green.
 */
export function StartLights({ lights }: { lights: number }) {
  const t = useT()
  const green = lights > LIGHTS
  return (
    <div
      // at the top, over the far end of the course: the grid stays in view
      className={cn('pointer-events-none absolute inset-0 flex items-start justify-center bg-background/40 pt-[6%] transition-opacity',
        green && 'opacity-0 delay-700 duration-500')}
      role="status"
      aria-label={t.startLights}
    >
      <span className="sr-only">{green ? t.lightsGo : `${lights} / ${LIGHTS}`}</span>
      <div className="flex gap-3 rounded-2xl bg-black/80 p-3 ring-1 ring-white/10" aria-hidden>
        {Array.from({ length: LIGHTS }, (_, i) => {
          const on = green ? 'bg-ok shadow-[0_0_24px_var(--ok)]' : i < lights ? 'bg-hot shadow-[0_0_24px_var(--hot)]' : 'bg-white/8'
          return (
            <div key={i} className="flex flex-col gap-2 rounded-xl bg-white/5 p-2">
              <span className={cn('size-10 rounded-full transition-colors duration-100', on)} />
              <span className={cn('size-10 rounded-full transition-colors duration-100', on)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
