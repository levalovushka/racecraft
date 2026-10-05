import type { Race } from '@/engine/race'
import { CLASS, CLASS_COLOR, driverXY, ourClass, SHAPE } from '@/sim/model'

export function TrackView({ race }: { race: Race }) {
  const red = race.t < race.greenAt
  const [bx, by] = SHAPE.box
  const [lx1, ly1, lx2, ly2] = SHAPE.line
  const [dx, dy] = SHAPE.decision
  const cars = race.drivers
    .map((d) => ({ d, xy: driverXY(race, d) }))
    .filter((c) => c.xy)
    .sort((a, b) => Number(a.d.isUs) - Number(b.d.isUs))

  return (
    <svg viewBox={SHAPE.viewBox} className="h-full w-full select-none" role="img" aria-label="Схема трассы">
      <path d={SHAPE.pitlane} className="fill-muted/50" />
      <path d={SHAPE.track} fillRule="evenodd" className="fill-muted" />
      {SHAPE.zones.map((pts, i) => (
        <polyline key={i} points={pts} fill="none" strokeWidth={26} strokeLinecap="round" className="stroke-foreground/5" />
      ))}
      <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} strokeWidth={4} strokeDasharray="10 8" className="stroke-foreground/70" />
      <g transform={`translate(${dx} ${dy})`}>
        <circle r={9} className="fill-primary/80" />
        <text x={16} y={-14} className="fill-muted-foreground text-[32px]">решение</text>
      </g>

      {/* box with the light and the two karts */}
      <g transform={`translate(${bx} ${by})`}>
        <rect x={-46} y={-70} width={92} height={46} rx={10} className="fill-background stroke-border" strokeWidth={2} />
        {race.box.map((k, i) => {
          const c = ourClass(race, k)
          return (
            <g key={i} transform={`translate(${i === 0 ? -22 : 22} -47)`}>
              <circle r={19} fill={CLASS_COLOR[c]} opacity={i === 0 ? 1 : 0.55} />
              <text textAnchor="middle" dy={7} className="fill-white text-[22px] font-semibold">{race.karts[k].label}</text>
            </g>
          )
        })}
        <circle cx={-72} cy={-47} r={15} fill={red ? '#ef4444' : '#22c55e'} />
        <text x={0} y={-82} textAnchor="middle" className="fill-muted-foreground text-[26px]">
          бокс · {CLASS[ourClass(race, race.box[0])]}/{CLASS[ourClass(race, race.box[1])]}
        </text>
      </g>

      {cars.map(({ d, xy }) => {
        const [x, y] = xy!
        const c = ourClass(race, d.kart)
        return (
          <g key={d.id} transform={`translate(${x} ${y})`}>
            {d.isUs && <circle r={36} className="fill-none stroke-primary" strokeWidth={6} />}
            <circle r={d.isUs ? 28 : 24} fill={CLASS_COLOR[c]} className="stroke-background" strokeWidth={4} />
            <text textAnchor="middle" dy={9} className="fill-white text-[26px] font-bold">{d.num}</text>
          </g>
        )
      })}
    </svg>
  )
}
