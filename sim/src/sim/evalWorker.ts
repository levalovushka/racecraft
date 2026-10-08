import { evaluateDecision } from '@/engine/analysis'
import type { Decision } from '@/engine/race'

/** In: {id, dec, n}. Out: {id, progress: {done, of}} after every continuation, then {id, value} */
self.onmessage = (e: MessageEvent<{ id: number; dec: Decision; n: number }>) => {
  const { id, dec, n } = e.data
  const post = (msg: object) => (self as unknown as Worker).postMessage({ id, ...msg })
  post({ value: evaluateDecision(dec, n, (done, of) => post({ progress: { done, of } })) })
}
