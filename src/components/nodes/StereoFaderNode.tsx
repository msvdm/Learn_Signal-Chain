import type { NodeProps, Node } from '@xyflow/react'
import { SlidersHorizontal } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { VerticalFader } from '../controls/VerticalFader'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'

interface StereoFaderData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function StereoFaderNode({ id, data }: NodeProps<Node<StereoFaderData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { stages }       = useGraphSignal()

  const faderDb = (node?.params.faderDb as number) ?? 0
  const result  = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const outL    = (result as { outL?: number }).outL ?? result.out
  const outR    = (result as { outR?: number }).outR ?? result.out
  const domain  = (result as { domain?: string }).domain ?? 'analog'
  const unit    = domain === 'digital' ? 'dBFS' : 'dBu'

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="stereo-fader"
      icon={<SlidersHorizontal size={14} />}
      label={data.label ?? 'Stereo Fader'}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Fader control */}
        <VerticalFader
          value={faderDb}
          min={-80}
          max={10}
          step={1}
          formatValue={(v) => (v <= -80 ? '−∞' : `${v >= 0 ? '+' : ''}${v} dB`)}
          onChange={(v) => updateNodeParams(id, { faderDb: v })}
          height={120}
          marks={[
            { db: 10,  label: '+10' },
            { db: 0,   label:  '0'  },
            { db: -20, label: '-20' },
            { db: -40, label: '-40' },
            { db: -80, label: '−∞'  },
          ]}
        />

        {/* L/R output meters */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--lsc-accent)', minWidth: 8 }}>L</span>
            <div style={{ flex: 1 }}>
              <SignalMeter db={outL} health={result.health} label={unit} showValue={false} />
            </div>
            <span style={{ fontSize: 8, fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-text)', minWidth: 32, textAlign: 'right' }}>
              {isFinite(outL) ? outL.toFixed(1) : '−∞'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--lsc-accent)', minWidth: 8 }}>R</span>
            <div style={{ flex: 1 }}>
              <SignalMeter db={outR} health={result.health} label={unit} showValue={false} />
            </div>
            <span style={{ fontSize: 8, fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-text)', minWidth: 32, textAlign: 'right' }}>
              {isFinite(outR) ? outR.toFixed(1) : '−∞'}
            </span>
          </div>
        </div>
      </div>
    </NodeWrapper>
  )
}
