import type { NodeProps, Node } from '@xyflow/react'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphAdcDacData extends Record<string, unknown> {
  typeKey?: string
  color?: string
  label?: string
}

export function AdcDacNode({ id, data }: NodeProps<Node<GraphAdcDacData>>) {
  const { stages, inputDb } = useGraphSignal()
  const { t }               = useTranslation()

  const typeKey    = (data.typeKey as string) ?? 'adc'
  const isAdc      = typeKey === 'adc'
  const result     = stages[id]
  const inputLevel = inputDb[id] ?? -Infinity
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

      {/* Input → output level display */}
      {isFinite(inputLevel) && (
        <div
          style={{
            fontSize: 'var(--node-text-2xs)',
            fontFamily: 'var(--lsc-font-mono)',
            textAlign: 'center',
            color: 'var(--lsc-text)',
            lineHeight: 1.4,
          }}
        >
          <span style={{ opacity: 0.6 }}>{inputLevel.toFixed(1)} {inputUnit}</span>
          {isFinite(result?.out ?? -Infinity) && (
            <>
              {' → '}
              <span style={{ color: hasWarning ? 'var(--signal-clipping)' : 'var(--signal-good)' }}>
                {result!.out.toFixed(1)} {outputUnit}
              </span>
            </>
          )}
        </div>
      )}

      {/* Warning banner */}
      {hasWarning && (
        <div
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
        {domain === 'digital' ? '● Digital out' : '● Analog out'}
      </div>
    </InlineNode>
  )
}
