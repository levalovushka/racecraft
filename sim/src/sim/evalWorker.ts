import { evaluateDecision } from '@/engine/analysis'
import type { Decision } from '@/engine/race'

self.onmessage = (e: MessageEvent<{ id: number; dec: Decision; n: number }>) => {
  const { id, dec, n } = e.data
  const value = evaluateDecision(dec, n)
  ;(self as unknown as Worker).postMessage({ id, value })
}
