import { Handle, Position } from '@xyflow/react'
import { SlidersHorizontal } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { motion } from 'framer-motion'

const DB_MARKS = [
  { db: 0, label: '0' },
  { db: -10, label: '-10' },
  { db: -20, label: '-20' },
  { db: -40, label: '-40' },
]

export function FaderNode() {
  const { comp, fader } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const { t } = useTranslation()

  // faderDb: -80 to 0. Map to 0% (bottom) to 100% (top)
  const faderPct = ((nodeState.faderDb + 80) / 80) * 100

  return (
    <NodeWrapper nodeId="fader" icon={<SlidersHorizontal size={14} />} label={t.nodes.fader.label}>
      <div className="space-y-3">
        <SignalMeter db={comp.out} health={comp.health} label={t.meters.input} />

        {/* Vertical fader */}
        <div className="nodrag flex items-center justify-center gap-4 py-1">
          {/* Track + cap + hidden input all in the same relative container */}
          <div className="relative h-32 w-8 flex items-center justify-center">
            {/* Track */}
            <div
              className="absolute w-2 h-full rounded-full"
              style={{ background: '#0d0f13', border: '1px solid #2e3341' }}
            />

            {/* dB scale markers */}
            {DB_MARKS.map(({ db, label }) => {
              const pct = ((db + 80) / 80) * 100
              const top = `${100 - pct}%`
              return (
                <div key={db} className="absolute w-full" style={{ top }}>
                  <div
                    className="absolute h-px"
                    style={{
                      width: db === 0 ? 20 : 12,
                      right: db === 0 ? -4 : 0,
                      background: db === 0 ? 'var(--signal-good)' : '#2e3341',
                    }}
                  />
                  <span
                    className="absolute text-[7px] font-mono"
                    style={{ right: 24, top: -4, color: db === 0 ? 'var(--signal-good)' : '#4b5563' }}
                  >
                    {label}
                  </span>
                </div>
              )
            })}

            {/* Fader cap */}
            <motion.div
              className="absolute z-10 rounded-sm pointer-events-none"
              style={{
                width: 28,
                height: 14,
                bottom: `${faderPct}%`,
                marginBottom: -7,
                background: 'linear-gradient(180deg, #3a3d47 0%, #2a2d35 100%)',
                border: '1px solid #4b5563',
                boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              <div
                className="absolute left-1/2 top-1/2 h-px"
                style={{ width: '60%', transform: 'translate(-50%,-50%)', background: '#6b7280' }}
              />
            </motion.div>

            {/* Hidden input — overlaid on the track for interaction */}
            <input
              type="range"
              min={-80}
              max={0}
              step={1}
              value={nodeState.faderDb}
              onChange={(e) => updateNodeState({ faderDb: Number(e.target.value) })}
              className="nodrag absolute inset-0 opacity-0 cursor-ns-resize w-full h-full"
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                appearance: 'slider-vertical' as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                WebkitAppearance: 'slider-vertical' as any,
              }}
            />
          </div>

          {/* Value display */}
          <div className="text-center min-w-[36px]">
            <div className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
              {nodeState.faderDb === 0 ? '0' : nodeState.faderDb} dB
            </div>
            {nodeState.faderDb === 0 && (
              <div className="text-[9px] mt-0.5" style={{ color: 'var(--signal-good)' }}>
                {t.nodes.fader.unity}
              </div>
            )}
          </div>
        </div>

        <SignalMeter db={fader.out} health={fader.health} label={t.meters.output} />
      </div>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
