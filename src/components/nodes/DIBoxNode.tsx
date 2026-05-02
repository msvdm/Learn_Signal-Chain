import type { NodeProps, Node } from '@xyflow/react'
import { Plug } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphDIBoxData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function DIBoxNode({ id, data }: NodeProps<Node<GraphDIBoxData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const result       = stages[id]
  const inputLevel   = inputDb[id] ?? -Infinity
  const groundLift   = (node?.params.groundLift as boolean) ?? false

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="di-box"
      icon={<Plug size={14} />}
      label={data.label ?? t.nodes['di-box']?.label ?? 'DI Box'}
      style={{ width: 208 }}
    >
      <div className="space-y-2">
        {/* Ground lift toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--lsc-text)' }}>
            {t.nodes['di-box']?.groundLift ?? 'Ground Lift'}
          </span>
          <button
            className="nodrag nopan"
            onClick={() => updateNodeParams(id, { groundLift: !groundLift })}
            style={{
              fontSize: 9, fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 'var(--lsc-radius-sm)',
              border: `1px solid ${groundLift ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
              background: groundLift ? 'var(--lsc-accent-bg)' : 'transparent',
              color: groundLift ? 'var(--lsc-accent-soft)' : 'var(--lsc-text)',
              cursor: 'pointer',
            }}
          >
            {groundLift ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Signal flow */}
        <SignalMeter
          db={inputLevel}
          health={result ? (result.out === inputLevel ? result.health : 'too-quiet') : 'too-quiet'}
          label={t.meters.input}
        />

        {/* Two outputs — both carry the same signal level */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--lsc-accent)', fontWeight: 700 }}>
              {t.nodes['di-box']?.xlrOut ?? 'XLR Out'}
            </span>
            <span className="text-[9px] font-mono" style={{ color: 'var(--lsc-text)' }}>
              {isFinite(result?.out ?? -Infinity)
                ? `${(result!.out).toFixed(1)} ${(result as { domain?: string })?.domain === 'digital' ? 'dBFS' : 'dBu'}`
                : '−∞'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--lsc-text)', fontWeight: 600, opacity: 0.7 }}>
              {t.nodes['di-box']?.directOut ?? 'Direct Out'}
            </span>
            <span className="text-[9px] font-mono" style={{ color: 'var(--lsc-text)', opacity: 0.7 }}>
              {isFinite(result?.out ?? -Infinity)
                ? `${(result!.out).toFixed(1)} dBu`
                : '−∞'}
            </span>
          </div>
        </div>

        <div
          className="text-[9px] leading-snug"
          style={{ color: 'var(--lsc-text)', opacity: 0.65, borderTop: '1px solid var(--lsc-border)', paddingTop: 4 }}
        >
          {t.nodes['di-box']?.description ?? 'Converts high-impedance instrument signal to balanced mic-level XLR.'}
        </div>
      </div>
    </NodeWrapper>
  )
}
