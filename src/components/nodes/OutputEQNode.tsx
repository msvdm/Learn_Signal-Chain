import { useRef, useCallback } from 'react'
import { Activity } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import {
  SVG_W, SVG_H, DB_LABELS, FREQ_LABELS,
  freqToX, xToFreq, dbToY, yToDb,
  buildCurvePath, BAND_COLORS, DB_MIN, DB_MAX,
} from '../controls/eqMath'

export function OutputEQNode({ id }: { id: string }) {
  const { masterStages, allInputDb } = useMultiChannelSignal()
  const masterState = useSignalStore((s) => s.masterState)
  const updateOutputEQBand = useSignalStore((s) => s.updateOutputEQBand)
  const { t } = useTranslation()

  const input = allInputDb[id] ?? -Infinity
  const result = masterStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  const svgRef = useRef<SVGSVGElement>(null)
  const draggingBand = useRef<number | null>(null)

  const curvePath = buildCurvePath(masterState.outputEqBands, 20)
  const zeroY = dbToY(0)

  const getSVGCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (SVG_W / rect.width),
      y: (e.clientY - rect.top) * (SVG_H / rect.height),
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingBand.current === null) return
    const { x, y } = getSVGCoords(e)
    updateOutputEQBand(draggingBand.current, {
      freqHz: Math.round(Math.max(80, Math.min(12000, xToFreq(x)))),
      gainDb: Math.round(Math.max(DB_MIN, Math.min(DB_MAX, yToDb(y))) * 2) / 2,
    })
  }, [getSVGCoords, updateOutputEQBand])

  const handleMouseUp = useCallback(() => { draggingBand.current = null }, [])

  return (
    <NodeWrapper nodeId={id} channelId="master" typeKey="output-eq" icon={<Activity size={14} />} label="Master EQ">
      <div className="space-y-2">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        {/* Graphical EQ — full interactive curve, freq+dB axes */}
        <div
          className="nodrag rounded-md overflow-hidden"
          style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            preserveAspectRatio="none"
            className="w-full block"
            style={{ height: 140 }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="var(--lsc-sunken)" />

            {/* dB grid lines + labels */}
            {DB_LABELS.map((db) => (
              <g key={db}>
                <line
                  x1={0} y1={dbToY(db)} x2={SVG_W} y2={dbToY(db)}
                  stroke={db === 0 ? 'var(--lsc-fg-fainter)' : 'var(--lsc-border-mute)'}
                  strokeWidth={db === 0 ? 1.5 : 1}
                />
                <text
                  x={4} y={dbToY(db) - 2}
                  fill="var(--lsc-fg-fainter)"
                  fontSize="7"
                  fontFamily="monospace"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {db > 0 ? `+${db}` : db}
                </text>
              </g>
            ))}

            {/* Freq grid lines + labels */}
            {FREQ_LABELS.map(({ freq, label }) => (
              <g key={freq}>
                <line
                  x1={freqToX(freq)} y1={0} x2={freqToX(freq)} y2={SVG_H}
                  stroke="var(--lsc-border-mute)"
                  strokeWidth={1}
                />
                <text
                  x={freqToX(freq) + 2} y={SVG_H - 3}
                  fill="var(--lsc-fg-fainter)"
                  fontSize="7"
                  fontFamily="monospace"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {label}
                </text>
              </g>
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
            {masterState.outputEqBands.map((band, i) => {
              const cx = freqToX(band.freqHz)
              const cy = dbToY(band.gainDb)
              const gainLabel = band.gainDb >= 0 ? `+${band.gainDb}` : String(band.gainDb)
              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={9} fill="var(--lsc-sunken)" stroke={BAND_COLORS[i]} strokeWidth={2} />
                  <circle
                    cx={cx} cy={cy} r={7}
                    fill={BAND_COLORS[i]}
                    style={{ cursor: 'grab' }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); draggingBand.current = i }}
                  />
                  <text
                    x={cx} y={cy + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize="8" fontWeight="700"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {i + 1}
                  </text>
                  {/* Gain tooltip near handle */}
                  <text
                    x={cx} y={cy - 13}
                    textAnchor="middle"
                    fill={BAND_COLORS[i]} fontSize="7" fontFamily="monospace"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {gainLabel}dB
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
