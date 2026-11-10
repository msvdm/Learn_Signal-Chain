import type { ReactNode, SVGProps } from 'react'
import { AIR, CLOUD, CLOUD_MASK, FLOW, PART } from './look'

// A Dive deeper scene's building blocks (D46): a step's group (it fades in when its step is
// reached), a name on the picture, a cloud of air.

/**
 * What a step adds to the picture: there from step `n` on (up to `until`, if it leaves again),
 * fading in and out.
 */
export function Step({ n, until, step, children }: { n: number; until?: number; step: number; children: ReactNode }) {
  const off = step < n || (until !== undefined && step > until)
  return <g className="lsc-dd-step" data-off={off || undefined}>{children}</g>
}

/** A name on the picture; `flow`: in the colour of what travels. */
export function Label({ at, anchor = 'start', flow = false, children }: {
  at: [x: number, y: number]
  anchor?: 'start' | 'middle' | 'end'
  flow?: boolean
  children: ReactNode
}) {
  return (
    <text className="lsc-dd-label" x={at[0]} y={at[1]} textAnchor={anchor} style={flow ? { fill: FLOW } : undefined}>
      {children}
    </text>
  )
}

/** A thin dashed line from a name to its part. */
export function Leader(props: SVGProps<SVGLineElement>) {
  return <line stroke={PART} strokeWidth={0.75} strokeDasharray="3 3" {...props} />
}

/**
 * A cloud of air: a soft haze, and the mask that fades its particles out at its edge (give the
 * particles' group `mask="url(#id)"`).
 */
export function Air({ id, x, y, w, h, r, haze = true }: {
  id: string; x: number; y: number; w: number; h: number; r: number; haze?: boolean
}) {
  return (
    <>
      <mask id={id} maskUnits="userSpaceOnUse" x={x - 66} y={y - 66} width={w + 132} height={h + 132}>
        <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} rx={r} fill="#fff" filter={CLOUD_MASK} />
      </mask>
      {haze && <AirHaze x={x} y={y} w={w} h={h} r={r} />}
    </>
  )
}

export function AirHaze({ x, y, w, h, r }: { x: number; y: number; w: number; h: number; r: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill={AIR} opacity={0.16} filter={CLOUD} />
}
