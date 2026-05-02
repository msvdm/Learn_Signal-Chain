import type { NodeProps, Node } from '@xyflow/react'
import { AudioWaveform } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useSignalChain'
import type { DeesserResult } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphDeesserData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function DeesserNode({ id, data }: NodeProps<Node<GraphDeesserData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const threshold  = (node?.params.thresholdDb as number) ?? -20
  const frequency  = (node?.params.frequencyHz as number) ?? 6000
  const inputLevel = inputDb[id] ?? -Infinity
  const result     = stages[id] as DeesserResult | undefined
  const gr         = result?.gainReductionDb ?? 0
  const isActive   = gr > 0.1

  function formatFreq(hz: number): string {
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}`
  }

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="deesser"
      icon={<AudioWaveform size={14} />}
      label={data.label ?? t.nodes.deesser?.label ?? 'De-esser'}
      style={{ width: 208 }}
    >
      <div className="space-y-3">
        <div className="flex justify-around">
          <KnobControl
            value={threshold}
            min={-60}
            max={0}
            label={t.nodes.deesser?.threshold ?? 'Threshold'}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color={isActive ? 'var(--signal-hot)' : 'var(--signal-good)'}
            size={40}
          />
          <KnobControl
            value={frequency}
            min={2000}
            max={12000}
            step={100}
            label={t.nodes.deesser?.frequency ?? 'Frequency'}
            formatValue={(v) => `${formatFreq(v)} Hz`}
            onChange={(v) => updateNodeParams(id, { frequencyHz: v })}
            color="var(--lsc-accent)"
            size={40}
          />
        </div>

        {/* Gain reduction meter */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px]" style={{ color: 'var(--lsc-text)' }}>
              {t.nodes.deesser?.gainReduction ?? 'Sibilance reduction'}
            </span>
            <span
              className="text-[9px] font-mono"
              style={{ color: isActive ? 'var(--signal-hot)' : 'var(--lsc-text)', fontWeight: isActive ? 700 : 400 }}
            >
              {isActive ? `−${gr.toFixed(1)} dB` : '—'}
            </span>
          </div>
          {/* Simple GR bar */}
          <div
            style={{
              height: 4,
              background: 'var(--lsc-sunken)',
              borderRadius: 2,
              border: '1px solid var(--lsc-border-soft)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (gr / 12) * 100)}%`,
                background: 'var(--signal-hot)',
                borderRadius: 2,
                transition: 'width 0.1s',
              }}
            />
          </div>
        </div>

        <SignalMeter
          db={inputLevel}
          health={stages[id]?.health ?? 'too-quiet'}
          label={t.meters.input}
        />
        <SignalMeter
          db={result?.out ?? -Infinity}
          health={result?.health ?? 'too-quiet'}
          label={t.meters.output}
        />
      </div>
    </NodeWrapper>
  )
}
