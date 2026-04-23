import { useRef, useCallback } from 'react'
import type { EQBand } from '../../store/signalStore'
import {
  SVG_W, SVG_H, DB_LABELS, FREQ_LABELS,
  freqToX, xToFreq, dbToY, yToDb,
  bellGain, buildCurvePath, BAND_COLORS, DB_MIN, DB_MAX,
} from './eqMath'

interface EQInlineGraphProps {
  bands: EQBand[]
  hpfHz: number
  onBandChange: (index: number, patch: Partial<EQBand>) => void
  height?: number
}

export function EQInlineGraph({ bands, hpfHz, onBandChange, height = 80 }: EQInlineGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingBand = useRef<number | null>(null)

  const curvePath = buildCurvePath(bands, hpfHz)
  const zeroY = dbToY(0)

  const getSVGCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const scaleX = SVG_W / rect.width
    const scaleY = SVG_H / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const handleMouseDown = useCallback((bandIndex: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    draggingBand.current = bandIndex
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingBand.current === null) return
      const { x, y } = getSVGCoords(e)
      const newFreq = Math.max(80, Math.min(12000, xToFreq(x)))
      const newGain = Math.max(DB_MIN, Math.min(DB_MAX, yToDb(y)))
      onBandChange(draggingBand.current, {
        freqHz: Math.round(newFreq),
        gainDb: Math.round(newGain * 2) / 2,
      })
    },
    [getSVGCoords, onBandChange]
  )

  const handleMouseUp = useCallback(() => {
    draggingBand.current = null
  }, [])

  const activeBandInfo = bands
    .map((b, i) => ({ ...b, i }))
    .filter((b) => b.gainDb !== 0 || bellGain(b.freqHz, b.freqHz, b.gainDb) !== 0)

  void activeBandInfo

  return (
    <div className="nodrag rounded-md overflow-hidden" style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Background */}
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="var(--lsc-sunken)" />

        {/* dB grid lines */}
        {DB_LABELS.map((db) => (
          <line
            key={db}
            x1={0} y1={dbToY(db)} x2={SVG_W} y2={dbToY(db)}
            stroke={db === 0 ? 'var(--lsc-fg-fainter)' : 'var(--lsc-border-mute)'}
            strokeWidth={db === 0 ? 1.5 : 1}
          />
        ))}

        {/* Frequency grid lines */}
        {FREQ_LABELS.map(({ freq }) => (
          <line
            key={freq}
            x1={freqToX(freq)} y1={0} x2={freqToX(freq)} y2={SVG_H}
            stroke="var(--lsc-border-mute)"
            strokeWidth={1}
          />
        ))}

        {/* Filled area */}
        <path
          d={`${curvePath} L ${SVG_W},${zeroY} L 0,${zeroY} Z`}
          fill="rgba(154,127,212,0.10)"
        />

        {/* Curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--lsc-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Band handles */}
        {bands.map((band, i) => {
          const cx = freqToX(band.freqHz)
          const cy = dbToY(band.gainDb)
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={9} fill="var(--lsc-sunken)" stroke={BAND_COLORS[i]} strokeWidth={2} />
              <circle
                cx={cx}
                cy={cy}
                r={7}
                fill={BAND_COLORS[i]}
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => handleMouseDown(i, e)}
              />
              <text
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="8"
                fontWeight="700"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
