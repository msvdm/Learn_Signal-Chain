import { useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import type { EQBand } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import {
  SVG_W, SVG_H, DB_MIN, DB_MAX,
  FREQ_LABELS, DB_LABELS, BAND_COLORS,
  freqToX, xToFreq, dbToY, yToDb, buildCurvePath,
} from './controls/eqMath'

interface EQCurveProps {
  bands: EQBand[]
  hpfHz: number
  onBandChange: (index: number, patch: Partial<EQBand>) => void
  onHpfChange: (hz: number) => void
  onClose: () => void
}

export function EQCurve({ bands, hpfHz, onBandChange, onClose }: EQCurveProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingBand = useRef<number | null>(null)
  const { t } = useTranslation()

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[640px] max-w-[95vw]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t.eqCurve.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t.eqCurve.subtitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full cursor-crosshair"
          style={{ height: 200, borderRadius: 'var(--lsc-radius-md)', border: '1px solid var(--lsc-border)', background: 'var(--lsc-sunken)' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Grid lines — dB */}
          {DB_LABELS.map((db) => (
            <line
              key={db}
              x1={0}
              y1={dbToY(db)}
              x2={SVG_W}
              y2={dbToY(db)}
              stroke={db === 0 ? 'var(--lsc-fg-fainter)' : 'var(--lsc-border-mute)'}
              strokeWidth={db === 0 ? 1.5 : 1}
            />
          ))}

          {/* Grid lines — frequency */}
          {FREQ_LABELS.map(({ freq }) => (
            <line
              key={freq}
              x1={freqToX(freq)}
              y1={0}
              x2={freqToX(freq)}
              y2={SVG_H}
              stroke="var(--lsc-border-mute)"
              strokeWidth={1}
            />
          ))}

          {/* Filled area under/over the curve */}
          <path
            d={`${curvePath} L ${SVG_W},${zeroY} L 0,${zeroY} Z`}
            fill="rgba(154,127,212,0.08)"
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
                <circle cx={cx} cy={cy} r={8} fill="white" stroke={BAND_COLORS[i]} strokeWidth={2} />
                <circle
                  cx={cx}
                  cy={cy}
                  r={6}
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
                  fontSize="7"
                  fontWeight="700"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {i + 1}
                </text>
              </g>
            )
          })}

          {/* dB labels */}
          {DB_LABELS.map((db) => (
            <text
              key={db}
              x={4}
              y={dbToY(db) - 2}
              fill="var(--lsc-fg-fainter)"
              fontSize="9"
              fontFamily="monospace"
            >
              {db > 0 ? `+${db}` : db}
            </text>
          ))}
        </svg>

        {/* Frequency labels */}
        <div className="relative mt-1" style={{ paddingLeft: 0 }}>
          <svg viewBox={`0 0 ${SVG_W} 16`} className="w-full" style={{ height: 16 }}>
            {FREQ_LABELS.map(({ freq, label }) => (
              <text
                key={freq}
                x={freqToX(freq)}
                y={12}
                textAnchor="middle"
                fill="var(--lsc-fg-fainter)"
                fontSize="9"
                fontFamily="monospace"
              >
                {label}
              </text>
            ))}
          </svg>
        </div>

        {/* Band info */}
        <div className="mt-4 flex gap-3">
          {bands.map((band, i) => (
            <div key={i} className="flex-1 rounded-lg border p-2" style={{ borderColor: BAND_COLORS[i] + '40' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BAND_COLORS[i] }} />
                <span className="text-[10px] font-semibold text-slate-600">{t.eqCurve.band} {i + 1}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-700">
                {band.freqHz >= 1000 ? `${(band.freqHz / 1000).toFixed(1)}k` : band.freqHz} Hz
                <span className="ml-2 text-slate-500">
                  {band.gainDb >= 0 ? '+' : ''}{band.gainDb.toFixed(1)} dB
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
