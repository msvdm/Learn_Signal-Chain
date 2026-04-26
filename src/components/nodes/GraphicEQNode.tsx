import { Sliders } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { useMultiChannelSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

const FREQ_LABELS = ['31', '63', '125', '250', '500', '1k', '2k', '4k', '8k', '16k']
const SLIDER_HEIGHT = 80

export function GraphicEQNode({ id }: { id: string }) {
  const { masterStages, allInputDb } = useMultiChannelSignal()
  const masterState = useSignalStore((s) => s.masterState)
  const updateGraphicEQBand = useSignalStore((s) => s.updateGraphicEQBand)
  const { t } = useTranslation()

  const input = allInputDb[id] ?? -Infinity
  const result = masterStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  const inputHealth = getHealth(input)
  const outputHealth = result.health

  const healthColor = (h: ReturnType<typeof getHealth>) => {
    if (h === 'clipping') return 'var(--signal-clipping)'
    if (h === 'hot') return 'var(--signal-hot)'
    if (h === 'good') return 'var(--signal-good)'
    return 'var(--signal-quiet)'
  }

  return (
    <NodeWrapper
      nodeId={id}
      channelId="master"
      typeKey="graphic-eq"
      icon={<Sliders size={14} />}
      label={t.nodes.graphicEq.label}
      style={{ width: 340 }}
    >
      <div className="space-y-2">
        {/* Input level bar */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] w-8 text-right shrink-0" style={{ color: 'var(--lsc-text)' }}>
            {t.meters.input}
          </span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--lsc-sunken)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(0, Math.min(100, ((input + 60) / 60) * 100))}%`,
                background: healthColor(inputHealth),
              }}
            />
          </div>
          <span className="text-[9px] w-10 shrink-0 font-mono" style={{ color: 'var(--lsc-text)' }}>
            {isFinite(input) ? `${input.toFixed(0)}dB` : '—'}
          </span>
        </div>

        {/* 10-band graphic EQ */}
        <div
          className="nodrag rounded-md p-2"
          style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
        >
          {/* dB markers */}
          <div className="flex justify-end mb-1">
            <div className="flex flex-col justify-between mr-1" style={{ height: SLIDER_HEIGHT }}>
              {['+12', '+6', '0', '-6', '-12'].map((l) => (
                <span key={l} className="text-[7px] font-mono leading-none" style={{ color: 'var(--lsc-text)' }}>
                  {l}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-around gap-1">
            {masterState.graphicEqBands.map((band, i) => {
                return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="relative flex items-center justify-center nodrag nopan"
                    style={{ width: 20, height: SLIDER_HEIGHT }}
                  >
                    {/* Zero line */}
                    <div
                      className="absolute w-full"
                      style={{
                        top: '50%',
                        height: 1,
                        background: 'var(--lsc-border)',
                        opacity: 0.5,
                      }}
                    />
                    {/* Vertical range slider */}
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={band.gainDb}
                      onChange={(e) => updateGraphicEQBand(i, { gainDb: Number(e.target.value) })}
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
                  <span
                    className="text-[8px] font-mono leading-none"
                    style={{ color: 'var(--lsc-text)' }}
                  >
                    {FREQ_LABELS[i]}
                  </span>
                  {band.gainDb !== 0 && (
                    <span
                      className="text-[7px] font-mono leading-none"
                      style={{ color: 'var(--lsc-accent)' }}
                    >
                      {band.gainDb > 0 ? `+${band.gainDb}` : band.gainDb}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Output level bar */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] w-8 text-right shrink-0" style={{ color: 'var(--lsc-text)' }}>
            {t.meters.output}
          </span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--lsc-sunken)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(0, Math.min(100, ((result.out + 60) / 60) * 100))}%`,
                background: healthColor(outputHealth),
              }}
            />
          </div>
          <span className="text-[9px] w-10 shrink-0 font-mono" style={{ color: 'var(--lsc-text)' }}>
            {isFinite(result.out) ? `${result.out.toFixed(0)}dB` : '—'}
          </span>
        </div>
      </div>
    </NodeWrapper>
  )
}
