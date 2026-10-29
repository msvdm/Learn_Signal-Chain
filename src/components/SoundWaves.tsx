import type { CSSProperties } from 'react'
import type { Pt } from '../utils/geometry'
import { pointAlong, routeLength } from '../utils/wirePath'

// Sound in the air, from a Vocal, a Drum Kit, an Acoustic Guitar or a Guitar Amp into a microphone:
// small arcs, like the waves on those cards' icons, travel along the wire to the microphone and
// grow as they go (sound spreads out in the air). The cables between cards are dashes. Each arc
// moves by an SVG animateMotion along the wire's own path, so it follows the corners too.

/** One wave at 100%: an arc bulging the way the sound goes */
const ARC = 'M-3 -8Q4 0 -3 8'
/** The waves are about this far apart (px at 100%) */
const GAP = 24
/**
 * At most this many on one wire (a long one spaces them wider): every moving wave costs the main
 * thread about 1 ms a second (headless Chrome, 2026-10-29: 24 microphones, 264 waves, ~230 ms a
 * second; the same 24 wires as cables ~40)
 */
const MAX_WAVES = 20
/** px a second: as fast as the cables' dashes (index.css signal-flow: 24 px in 0.6 s) */
const SPEED = 40
/** A wave's size leaving the source, and reaching the microphone */
const GROW: readonly [number, number] = [0.6, 1.2]
/** Its opacity along the way: it fades in, and a little out at the microphone */
const FADE_AT = [0, 0.12, 0.8, 1]
const FADE    = [0, 1, 1, 0.25]

/** How many waves a route `length` long holds, about GAP × `size` apart (at least one, at most MAX_WAVES). */
function waveCount(length: number, size: number): number {
  return Math.min(MAX_WAVES, Math.max(1, Math.round(length / (GAP * size))))
}

/** A wave's opacity `t` of the way along (0 … 1): FADE, between its points. */
function fadeAt(t: number): number {
  const i = FADE_AT.findIndex((k) => k >= t)
  if (i <= 0) return FADE[0]
  return FADE[i - 1] + (FADE[i] - FADE[i - 1]) * (t - FADE_AT[i - 1]) / (FADE_AT[i] - FADE_AT[i - 1])
}

interface SoundWavesProps {
  /** The wire as drawn (rounded corners) and its corner points */
  path: string
  route: Pt[]
  color: string | undefined
  /** The waves' size: 1 at 100%, 2 zoomed out (the wires are thicker) */
  size: number
  /** Drawn in place, not moving (Beginner, its sound goes nowhere — D20; a wire being drawn) */
  still?: boolean
  style?: CSSProperties
}

/** The waves along a wire carrying sound in the air. */
export function SoundWaves({ path, route, color, size, still = false, style }: SoundWavesProps) {
  const length = routeLength(route)
  const count  = waveCount(length, size)
  const wave   = <path d={ARC} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
  const look   = { pointerEvents: 'none' as const, ...style }

  if (still) {
    return (
      <g style={look}>
        {Array.from({ length: count }, (_, i) => {
          const t = (i + 0.5) / count
          const p = pointAlong(route, t * length)
          const k = size * (GROW[0] + (GROW[1] - GROW[0]) * t)
          return <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.angle}) scale(${k})`} opacity={fadeAt(t)}>{wave}</g>
        })}
      </g>
    )
  }

  // Every wave goes the whole way in `dur`, each started a share of it earlier than the next
  const dur = `${(length / SPEED).toFixed(2)}s`
  return (
    <g style={look}>
      {Array.from({ length: count }, (_, i) => {
        const begin = `${(-i * length / count / SPEED).toFixed(2)}s`
        return (
          <g key={i}>
            <animateMotion path={path} rotate="auto" dur={dur} begin={begin} repeatCount="indefinite" />
            {/* Hidden until its animation places it (else it shows at the canvas's corner for a frame) */}
            <g opacity={0}>
              <animateTransform attributeName="transform" type="scale" values={`${GROW[0] * size};${GROW[1] * size}`}
                dur={dur} begin={begin} repeatCount="indefinite" />
              <animate attributeName="opacity" values={FADE.join(';')} keyTimes={FADE_AT.join(';')}
                dur={dur} begin={begin} repeatCount="indefinite" />
              {wave}
            </g>
          </g>
        )
      })}
    </g>
  )
}
