import type { NodeProps, Node } from '@xyflow/react'
import { ShieldAlert } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphLimiterData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function LimiterNode({ id, data }: NodeProps<Node<GraphLimiterData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const ceiling    = (node?.params.thresholdDb as number) ?? -3
  const inputLevel = inputDb[id] ?? -Infinity
  const result     = stages[id]
  const isLimiting = isFinite(inputLevel) && inputLevel > ceiling
  const gainReductionDb = isLimiting ? inputLevel - ceiling : 0

  const unit = (result as { domain?: string })?.domain === 'digital' ? 'dBFS' : 'dBu'

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="limiter"
      icon={<ShieldAlert size={14} />}
      label={data.label ?? t.nodes.limiter?.label ?? 'Limiter'}
      style={{ width: 208 }}
    >
      <div className="space-y-3">
        <div className="flex justify-center">
          <KnobControl
            value={ceiling}
            min={-20}
            max={0}
            label={t.nodes.limiter?.ceiling ?? 'Ceiling'}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color={isLimiting ? 'var(--signal-hot)' : 'var(--signal-good)'}
            size={44}
          />
        </div>

        {/* Brickwall indicator */}
        {isLimiting && (
          <div
            className="flex items-center justify-between"
            style={{
              padding: '3px 6px',
              borderRadius: 'var(--lsc-radius-sm)',
              background: 'var(--signal-hot-bg)',
              border: '1px solid var(--signal-hot)',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--signal-hot)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t.nodes.limiter?.limiting ?? 'Limiting'}
            </span>
            <span style={{ fontSize: 9, fontFamily: 'var(--lsc-font-mono)', color: 'var(--signal-hot)' }}>
              −{gainReductionDb.toFixed(1)} dB
            </span>
          </div>
        )}

        <SignalMeter
          db={inputLevel}
          health={stages[id]?.health ?? 'too-quiet'}
          label={t.meters.input}
        />

        {/* Ceiling line visualization */}
        <div className="relative">
          <SignalMeter
            db={result?.out ?? -Infinity}
            health={result?.health ?? 'too-quiet'}
            label={`${t.meters.output} (max ${ceiling} ${unit})`}
          />
        </div>
      </div>
    </NodeWrapper>
  )
}
