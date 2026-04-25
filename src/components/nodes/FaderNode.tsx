import type { NodeProps, Node } from '@xyflow/react'
import { SlidersHorizontal } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { motion } from 'framer-motion'
import type { ChannelNodeData } from './nodeTypes'

const DB_MARKS = [
  { db: 10,  label: '+10' },
  { db: 0,   label: '0'   },
  { db: -10, label: '-10' },
  { db: -20, label: '-20' },
  { db: -40, label: '-40' },
]

export function FaderNode({ id, data }: NodeProps<Node<ChannelNodeData>>) {
  const { allStages, allInputDb } = useMultiChannelSignal()
  const channel = useSignalStore((s) => s.channels.find((c) => c.id === data.channelId))
  const updateChannelNodeState = useSignalStore((s) => s.updateChannelNodeState)
  const { t } = useTranslation()

  const nodeState = channel?.nodeState
  const input = allInputDb[id] ?? -Infinity
  const result = allStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  if (!nodeState) return null

  const faderPct = ((nodeState.faderDb + 80) / 90) * 100

  return (
    <NodeWrapper
      nodeId={id}
      channelId={data.channelId}
      typeKey="fader"
      accentColor={data.color}
      icon={<SlidersHorizontal size={14} />}
      label={t.nodes.fader.label}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        {/* Vertical fader */}
        <div className="nodrag flex items-center justify-center gap-4 py-1">
          <div className="relative h-32 w-8 flex items-center justify-center">
            {/* Track */}
            <div
              className="absolute w-2 h-full rounded-full"
              style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
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
                      background: db === 0 ? 'var(--signal-good)' : 'var(--lsc-border)',
                    }}
                  />
                  <span
                    className="absolute text-[7px] font-mono"
                    style={{ right: 24, top: -4, color: db === 0 ? 'var(--signal-good)' : 'var(--lsc-fg-fainter)' }}
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
                background: `linear-gradient(180deg, var(--lsc-track-3) 0%, var(--lsc-track-2) 100%)`,
                border: '1px solid var(--lsc-fg-fainter)',
                boxShadow: 'var(--lsc-shadow-fader)',
              }}
            >
              <div
                className="absolute left-1/2 top-1/2 h-px"
                style={{ width: '60%', transform: 'translate(-50%,-50%)', background: 'var(--lsc-fg-faint)' }}
              />
            </motion.div>

            {/* Hidden input */}
            <input
              type="range"
              min={-80}
              max={10}
              step={1}
              value={nodeState.faderDb}
              onChange={(e) => updateChannelNodeState(data.channelId, { faderDb: Number(e.target.value) })}
              className="nodrag nopan absolute inset-0 opacity-0 cursor-ns-resize w-full h-full"
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
            <div className="text-xs font-mono font-semibold" style={{ color: 'var(--lsc-fg)' }}>
              {nodeState.faderDb === 0 ? '0' : nodeState.faderDb} dB
            </div>
            {nodeState.faderDb === 0 && (
              <div className="text-[9px] mt-0.5" style={{ color: 'var(--signal-good)' }}>
                {t.nodes.fader.unity}
              </div>
            )}
          </div>
        </div>

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
