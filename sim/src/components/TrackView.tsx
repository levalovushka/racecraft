import { useRef, useState } from 'react'
import { P, type Driver, type Race } from '@/engine/race'
import { pitXY, xyOfTau } from '@/engine/track'
import { useT } from '@/i18n'
import { CLASS, CLASS_COLOR, CLASS_TEXT, driverXY, ourClass, parkedTargets, SHAPE, TRACK } from '@/sim/model'

const SHIFT_TIME = 1.2 // s of race time for a parked kart to roll one slot forward
const GRID_SIDE = 24 // px either side of the racing line for the two grid columns
const GRID_MERGE = 4 // s of race time for the two columns to file into one line
const SLOT_STEP = TRACK.pit.slots[0] - TRACK.pit.slots[1]
const R = 26
// the blurred racing line ("вкат") is hidden for now: the interface went flat
const SHOW_RESIN = false

function KartDot({ x, y, label, cls, us, onClick, onHover }: { x: number; y: number; label: number; cls: number; us?: boolean; onClick?: () => void; onHover?: (on: boolean) => void }) {
  const t = useT()
  return (
    <g transform={`translate(${x} ${y})`} onClick={onClick} className={onClick ? 'cursor-pointer' : undefined} aria-label={onClick ? t.rerate : undefined}
      onPointerEnter={onHover && (() => onHover(true))} onPointerLeave={onHover && (() => onHover(false))}>
      {onClick && <title>{t.rerate}</title>}
      {us && <circle r={R + 6} fill="none" stroke="white" strokeWidth={3} />}
      <circle r={R} fill={CLASS_COLOR[cls]} />
      <text
        textAnchor="middle"
        dy={10}
        fill={CLASS_TEXT[cls]}
        fontSize={29}
        fontWeight={510}
        letterSpacing={-1.7}
        style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
      >
        {label}
      </text>
    </g>
  )
}

/** What a click on the kart under the pointer does: a ring in the next class colour and an "A → B" chip, drawn last so nothing covers it */
function NextClass({ x, y, cls }: { x: number; y: number; cls: number }) {
  const next = (cls + 1) % 4
  const [w, h] = [150, 60]
  const [left, top, right] = [184, 240, 1434] // SHAPE.viewBox
  const cx = Math.min(Math.max(x, left + w / 2), right - w / 2)
  const cy = y - R - 14 - h > top ? y - R - 14 - h / 2 : y + R + 14 + h / 2
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={R + 4} fill="none" stroke={CLASS_COLOR[next]} strokeWidth={6} />
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={14} fill="#111" stroke="white" strokeOpacity={0.2} />
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={40} fontWeight={600}>
        <tspan fill={CLASS_COLOR[cls]}>{CLASS[cls]}</tspan>
        <tspan fill="white" fillOpacity={0.6}> → </tspan>
        <tspan fill={CLASS_COLOR[next]}>{CLASS[next]}</tspan>
      </text>
    </g>
  )
}

/** Parked karts roll forward smoothly when the first one leaves */
function useParked(race: Race) {
  const pos = useRef(new Map<number, number>())
  const lastT = useRef(race.t)
  const dt = race.t - lastT.current
  lastT.current = race.t
  const targets = parkedTargets(race)
  const next = new Map<number, number>()
  for (const { kart, slot } of targets) {
    const cur = pos.current.get(kart)
    if (cur === undefined || dt < 0) {
      next.set(kart, slot)
      continue
    }
    const step = (SLOT_STEP / SHIFT_TIME) * Math.max(0, dt)
    next.set(kart, Math.abs(slot - cur) <= step ? slot : cur + Math.sign(slot - cur) * step)
  }
  pos.current = next
  return targets.map(({ kart }) => ({ kart, f: next.get(kart)! }))
}

/**
 * Staggered grid: odd slots on one side of the racing line, even on the other,
 * merging into one line in the first seconds. The view mounts on the grid
 * (the race waits for the start lights), so the slot is read off the start gap.
 */
function useGrid(race: Race) {
  const [side] = useState(() => new Map(race.drivers.map((d) => [d.id, Math.round(-d.u / P.gridGap) % 2 ? -1 : 1])))
  return (d: Driver, [x, y]: [number, number]): [number, number] => {
    const k = Math.max(0, 1 - race.t / GRID_MERGE)
    if (d.mode !== 'track' || k === 0) return [x, y]
    const [ax, ay] = xyOfTau(TRACK, d.u + 0.002)
    const len = Math.hypot(ax - x, ay - y) || 1
    const off = side.get(d.id)! * GRID_SIDE * k * k
    return [x - ((ay - y) / len) * off, y + ((ax - x) / len) * off]
  }
}

export function TrackView({ race, onKart }: { race: Race; onKart?: (kart: number) => void }) {
  const t = useT()
  const red = race.t < race.greenAt
  const [lx1, ly1, lx2, ly2] = SHAPE.line
  const [gx, gy, gw, gh] = SHAPE.light
  const parked = useParked(race)
  const grid = useGrid(race)
  const [hover, setHover] = useState<number | null>(null) // kart under the pointer
  const hoverOn = (kart: number) => onKart && ((on: boolean) => setHover(on ? kart : null))
  const cars = race.drivers
    .map((d) => {
      const xy = driverXY(race, d)
      return { d, xy: xy && grid(d, xy) }
    })
    .filter((c) => c.xy)
    .sort((a, b) => Number(a.d.isUs) - Number(b.d.isUs))
  const hoverParked = parked.find((p) => p.kart === hover)
  const hoverXY = hoverParked ? pitXY(TRACK, hoverParked.f) : cars.find((c) => c.d.kart === hover)?.xy

  return (
    <svg viewBox={SHAPE.viewBox} className="h-full w-full select-none" role="img" aria-label={t.track}>
      <defs>
        <mask id="tv-resin-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1578" height="1578" style={{ maskType: 'alpha' }}>
          <path d={SHAPE.resinMask} fillRule="evenodd" fill="#191919" />
        </mask>
        <filter id="tv-resin-blur" x="0" y="0" width="1578" height="1578" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation={32} />
        </filter>
      </defs>

      <path d={SHAPE.course} fillRule="evenodd" fill="#1B1B1B" />
      <path d={SHAPE.trackOutline} fillRule="evenodd" fill="none" stroke="white" strokeOpacity={0.16} strokeDasharray="12 6" />
      {/* "вкат": darker rubbered line, decoration only */}
      {SHOW_RESIN && (
        <g mask="url(#tv-resin-mask)">
          <path d={SHAPE.resinLine} fill="none" stroke="black" strokeOpacity={0.5} strokeWidth={64} filter="url(#tv-resin-blur)" />
        </g>
      )}
      <path d={SHAPE.stroke} fillRule="evenodd" fill="none" stroke="#5A5A5A" />
      <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke="white" strokeDasharray="8 8" />

      {/* traffic light: timer only while red */}
      <g>
        <rect x={gx} y={gy} width={gw} height={gh} rx={gw / 2} fill="white" fillOpacity={0.12} />
        <circle cx={gx + gw / 2} cy={gy + 4 + 15.5} r={15.5} fill={red ? '#e5484d' : 'white'} fillOpacity={red ? 1 : 0.06} />
        <circle cx={gx + gw / 2} cy={gy + gh - 4 - 15.5} r={15.5} fill={red ? 'white' : '#04b630'} fillOpacity={red ? 0.06 : 1} />
        {red && (
          <text x={gx + gw + 14.5} y={gy + gh / 2 + 12} fill="#e5484d" fontSize={34.7} style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>
            {(race.greenAt - race.t).toFixed(2)}
          </text>
        )}
      </g>

      {parked.map(({ kart, f }) => {
        const [x, y] = pitXY(TRACK, f)
        return <KartDot key={`k${kart}`} x={x} y={y} label={race.karts[kart].label} cls={ourClass(race, kart)} onClick={onKart && (() => onKart(kart))} onHover={hoverOn(kart)} />
      })}

      {cars.map(({ d, xy }) => (
        <KartDot key={d.id} x={xy![0]} y={xy![1]} label={race.karts[d.kart].label} cls={ourClass(race, d.kart)} us={d.isUs} onClick={onKart && (() => onKart(d.kart))} onHover={hoverOn(d.kart)} />
      ))}

      {hoverXY && <NextClass x={hoverXY[0]} y={hoverXY[1]} cls={ourClass(race, hover!)} />}
    </svg>
  )
}

