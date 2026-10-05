import { useCallback, useEffect, useRef, useState } from 'react'
import { createRace, P, step, type Order, type Race, type Settings } from '@/engine/race'
import { TRACK } from './model'

/** Runs the race in real time (times `speed`) and re-renders on every animation frame.
 *  Remount the owner (React key) to start a new race. */
export function useSim(settings: Settings) {
  // the race is a mutable simulation object, advanced in place by the loop
  const ref = useRef<Race | null>(null)
  if (ref.current === null) ref.current = createRace(settings, TRACK)
  const race = ref.current
  const [, setFrame] = useState(0)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    const loop = (now: number) => {
      const r = race
      const elapsed = Math.min(0.25, (now - last) / 1000)
      last = now
      if (!paused && !r.finished) {
        acc += elapsed * speed
        let n = 0
        while (acc >= P.dt && n < 4000) {
          step(r)
          acc -= P.dt
          n++
        }
        setFrame((f) => f + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [race, paused, speed])

  const command = useCallback((order: Order) => {
    race.intent = order
    setFrame((f) => f + 1)
  }, [race])

  const refresh = useCallback(() => setFrame((f) => f + 1), [])

  return { race, paused, setPaused, speed, setSpeed, command, refresh }
}
