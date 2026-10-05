// Keyed randomness: the same (seed, keys...) always gives the same number,
// independent of call order. A different decision by the manager therefore
// does not reshuffle the noise of other drivers (duplicate-style comparison).

function mix(h: number, k: number): number {
  h = Math.imul(h ^ (k | 0), 0x9e3779b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca77)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae3d)
  h ^= h >>> 16
  return h >>> 0
}

export function hash(...keys: number[]): number {
  let h = 0x811c9dc5
  for (const k of keys) h = mix(h, k)
  return mix(h, keys.length)
}

/** Uniform [0, 1) */
export function rand(...keys: number[]): number {
  return hash(...keys) / 4294967296
}

/** Standard normal */
export function gauss(...keys: number[]): number {
  const u = Math.max(rand(...keys, 1), 1e-12)
  const v = rand(...keys, 2)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Deterministic Fisher-Yates shuffle */
export function shuffle<T>(items: T[], ...keys: number[]): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(...keys, i) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Stream ids so that keys of different purposes never collide
export const K = {
  kartSpread: 1,
  kartEffect: 2,
  draw: 3,
  driverPace: 4,
  driverAggr: 5,
  perceive: 6,
  lapNoise: 7,
  qual: 8,
  skip: 9,
  pass: 10,
  release: 11,
  tolerance: 12,
  names: 13,
  numbers: 14,
  labels: 15,
  patience: 16,
} as const
