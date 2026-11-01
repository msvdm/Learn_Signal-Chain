import type { CSSProperties } from 'react'
import type { Pt } from '../utils/geometry'
import { rippleArc, rippleGrowth, ripplesBetween } from '../utils/soundRipples'
import { FLOW_SPEED } from '../utils/wireLook'

// Sound in the air, from a Vocal, a Drum Kit, an Acoustic Instrument or a Guitar Amp into a microphone:
// ripples spread from the source and travel straight to the microphone, with no line
// (utils/soundRipples.ts). The cables between cards are dashes. Each ripple's arc moves by an SVG
// animation of its path.

/** The ripples are about this far apart (px at 100%) */
const GAP = 44
/**
 * At most this many on one connection (a long one spaces them wider): every moving ripple costs
 * the main thread about 1.5 ms a second (headless Chrome, 2026-10-29: 24 microphones, 144 ripples,
 * ~230 ms a second; the same 24 connections as cables ~40)
 */
const MAX_RIPPLES = 8
/** At least this many (a microphone close to its source: ")))", like the waves on the sources' icons) */
const MIN_RIPPLES = 3
/** px a second: as fast as every wire's movement */
const SPEED = FLOW_SPEED
/** A ripple's line (px at 100%) */
const WIDTH = 2.4
/** Its opacity along the way: it fades in, and a little out at the microphone */
const FADE_AT = [0, 0.15, 0.75, 1]
const FADE    = [0, 1, 1, 0.2]

/** A ripple's opacity `t` of the way along (0 … 1): FADE, between its points. */
function fadeAt(t: number): number {
  const i = FADE_AT.findIndex((k) => k >= t)
  if (i <= 0) return FADE[0]
  return FADE[i - 1] + (FADE[i] - FADE[i - 1]) * (t - FADE_AT[i - 1]) / (FADE_AT[i] - FADE_AT[i - 1])
}

interface SoundWavesProps {
  /** The source's port, and the microphone's (or the cursor, while it is being drawn) */
  from: Pt
  to: Pt
  color: string | undefined
  /** The ripples' size: 1 at 100%, 2 zoomed out (the wires are thicker) */
  size: number
  /** Drawn in place, not moving (Beginner, its sound goes nowhere — D20; a connection being drawn) */
  still?: boolean
  style?: CSSProperties
}

/** The ripples of sound in the air, from a source to a microphone. */
export function SoundWaves({ from, to, color, size, still = false, style }: SoundWavesProps) {
  const ripples = ripplesBetween(from, to, size)
  const travel  = ripples.end - ripples.start
  if (travel < 1) return null
  const count = Math.min(MAX_RIPPLES, Math.max(MIN_RIPPLES, Math.round(travel / (GAP * size))))
  const look  = { pointerEvents: 'none' as const, ...style }
  const line  = { fill: 'none', stroke: color, strokeWidth: WIDTH * size, strokeLinecap: 'round' as const }

  if (still) {
    return (
      <g style={look}>
        {Array.from({ length: count }, (_, i) => {
          const t = (i + 0.5) / count
          return <path key={i} d={rippleArc(ripples, ripples.start + t * travel)} opacity={fadeAt(t)} {...line} />
        })}
      </g>
    )
  }

  // Every ripple goes the whole way in `dur`, each started a share of it earlier than the next
  const dur    = `${(travel / SPEED).toFixed(2)}s`
  const leaves = rippleArc(ripples, ripples.start)
  const way    = rippleGrowth(ripples)
  return (
    <g style={look}>
      {Array.from({ length: count }, (_, i) => {
        const begin = `${(-i * travel / count / SPEED).toFixed(2)}s`
        return (
          // Hidden until its animation shows it
          <path key={i} d={leaves} opacity={0} {...line}>
            <animate attributeName="d" values={way.values} keyTimes={way.keyTimes} dur={dur} begin={begin} repeatCount="indefinite" />
            <animate attributeName="opacity" values={FADE.join(';')} keyTimes={FADE_AT.join(';')}
              dur={dur} begin={begin} repeatCount="indefinite" />
          </path>
        )
      })}
    </g>
  )
}
