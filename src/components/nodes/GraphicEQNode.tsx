import type { NodeProps, Node } from '@xyflow/react'
import { Sliders } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

const FREQ_LABELS = ['31', '63', '125', '250', '500', '1k', '2k', '4k', '8k', '16k']
const SLIDER_HEIGHT = 80

interface GraphGraphicEQData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function GraphicEQNode({ id, data }: NodeProps<Node<GraphGraphicEQData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const params = node?.params ?? {}
  const input  = inputDb[id] ?? -Infinity
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  const bandGains = Array.from({ length: 10 }, (_, i) => (params[`b${i}`] as number) ?? 0)

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="graphic-eq"
      icon={<Sliders size={14} />}
      label={data.label ?? t.nodes.graphicEq.label}
      accentColor={data.color}
      style={{ width: 340 }}
    >
      <div className="space-y-2">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <div
          className="nodrag rounded-md p-2"
          style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
        >
          <div className="flex gap-1 items-end">
            {/* dB axis labels */}
            <div className="flex flex-col justify-between pb-5 shrink-0" style={{ height: SLIDER_HEIGHT + 20 }}>
              {['+12', '+6', '0', '−6', '−12'].map((l) => (
                <span key={l} className="text-[7px] font-mono leading-none" style={{ color: 'var(--lsc-fg-fainter)' }}>
                  {l}
                </span>
              ))}
            </div>

            {/* 10-band sliders */}
            <div className="flex flex-1 justify-around">
              {bandGains.map((gain, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="relative flex items-center justify-center nodrag nopan"
                    style={{ width: 20, height: SLIDER_HEIGHT }}
                  >
                    <div
                      className="absolute w-full"
                      style={{ top: '50%', height: 1, background: 'var(--lsc-border)', opacity: 0.5 }}
                    />
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={gain}
                      onChange={(e) => updateNodeParams(id, { [`b${i}`]: Number(e.target.value) })}
                      className="nodrag nopan"
                      style={{
                        writingMode: 'vertical-lr' as React.CSSProperties['writingMode'],
                        direction: 'rtl',
                        width: 20,
                        height: SLIDER_HEIGHT,
                        cursor: 'pointer',
                        accentColor: 'var(--lsc-accent)',
                        appearance: 'slider-vertical' as React.CSSProperties['appearance'],
                      } as React.CSSProperties}
                    />
                  </div>
                  <span className="text-[8px] font-mono leading-none" style={{ color: 'var(--lsc-fg-dim)' }}>
                    {FREQ_LABELS[i]}
                  </span>
                  {gain !== 0 && (
                    <span className="text-[7px] font-mono leading-none" style={{ color: 'var(--lsc-accent)' }}>
                      {gain > 0 ? `+${gain}` : gain}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
