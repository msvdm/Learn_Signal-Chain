import type { NodeProps, Node } from '@xyflow/react'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useTranslation } from '../../i18n/useTranslation'
import { StableText } from '../controls/StableText'
import { LEVEL_SAMPLE } from '../../utils/readout'

const levelText = (db: number) => (isFinite(db) ? db.toFixed(1) : '−∞')

interface GraphAdcDacData extends Record<string, unknown> {
  typeKey?: string
  color?: string
  label?: string
}

export function AdcDacNode({ id, data }: NodeProps<Node<GraphAdcDacData>>) {
  const { stages }          = useGraphSignal()
  const levels              = useStereoLevels(id)
  const { t }               = useTranslation()

  const typeKey    = (data.typeKey as string) ?? 'adc'
  const isAdc      = typeKey === 'adc'
  const result     = stages[id]
  const domain     = (result as { domain?: string })?.domain ?? 'analog'
  const warning    = (result as { warning?: string })?.warning

  const inputUnit  = isAdc ? 'dBu' : 'dBFS'
  const outputUnit = isAdc ? 'dBFS' : 'dBu'

  const label = data.label ?? (isAdc
    ? (t.nodes.adc?.label ?? 'ADC')
    : (t.nodes.dac?.label ?? 'DAC'))

  const hasWarning = Boolean(warning)

  return (
    <InlineNode
      nodeId={id}
      typeKey={typeKey}
      icon={isAdc ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
      label={label}
      accentColor={hasWarning ? 'var(--signal-clipping)' : (isAdc ? 'var(--lsc-accent)' : 'var(--signal-good)')}
    >
      {/* Conversion label */}
      <div
        style={{
          fontSize: 'var(--node-text-2xs)', fontWeight: 700,
          fontFamily: 'var(--lsc-font-mono)',
          textAlign: 'center',
          color: hasWarning ? 'var(--signal-clipping)' : 'var(--lsc-accent)',
          letterSpacing: '0.04em',
        }}
      >
        {inputUnit} → {outputUnit}
      </div>

      {/* Input → output level display — always shown, numbers keep their widest width */}
      <div
        style={{
          fontSize: 'var(--node-text-2xs)',
          fontFamily: 'var(--lsc-font-mono)',
          textAlign: 'center',
          color: 'var(--lsc-fg)',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
        }}
      >
        {/* One line per side when stereo: "L  -10.0 dBu → 8.0 dBFS" */}
        {(levels.stereo
          ? [['L ', levels.in, levels.out], ['R ', levels.inR ?? -Infinity, levels.outR ?? -Infinity]] as const
          : [['', levels.in, result?.out ?? -Infinity]] as const
        ).map(([side, inDb, outDb]) => (
          <div key={side}>
            {side && <span style={{ fontWeight: 700, color: 'var(--lsc-fg-muted)' }}>{side}</span>}
            <span style={{ color: 'var(--lsc-fg-muted)' }}>
              <StableText reserve={[LEVEL_SAMPLE]} align="end">{levelText(inDb)}</StableText> {inputUnit}
            </span>
            {' → '}
            <span style={{ color: hasWarning ? 'var(--signal-clipping)' : 'var(--signal-good)' }}>
              <StableText reserve={[LEVEL_SAMPLE]} align="end">{levelText(outDb)}</StableText> {outputUnit}
            </span>
          </div>
        ))}
      </div>

      {/* Warning banner */}
      {hasWarning && (
        <div
          className="lsc-wrap-text"
          style={{
            fontSize: 'var(--node-text-2xs)', fontWeight: 700,
            color: 'var(--signal-clipping)',
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {warning === 'adcExpectsAnalog'
            ? (t.warnings?.adcExpectsAnalog ?? 'Needs analog input')
            : warning === 'dacExpectsDigital'
              ? (t.warnings?.dacExpectsDigital ?? 'Needs digital input')
              : '⚠'}
        </div>
      )}

      {/* Domain indicator */}
      <div
        style={{
          fontSize: 'var(--node-text-2xs)',
          textAlign: 'center',
          color: domain === 'digital' ? 'var(--lsc-accent)' : 'var(--signal-good)',
          fontWeight: 600,
        }}
      >
        <StableText reserve={['● Digital out', '● Analog out']} align="center">
          {domain === 'digital' ? '● Digital out' : '● Analog out'}
        </StableText>
      </div>
    </InlineNode>
  )
}
