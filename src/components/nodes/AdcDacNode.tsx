import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import type { TypeKey } from '../../data/nodeRegistry'
import { NodeWrapper } from './NodeWrapper'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { levelOf } from '../../signal/engine'
import { useTranslation } from '../../i18n/useTranslation'
import { StableText } from '../controls/StableText'
import { LEVEL_SAMPLE } from '../../utils/readout'

const levelText = (db: number) => (isFinite(db) ? db.toFixed(1) : '−∞')

export function AdcDacNode({ id, type }: CardProps) {
  const { stages }          = useGraphSignal()
  const levels              = useStereoLevels(id)
  const { t }               = useTranslation()

  const typeKey    = type as TypeKey
  const isAdc      = typeKey === 'adc'
  const result     = stages[id]
  const domain     = result?.domain ?? 'analog'
  const warning    = result?.condition

  const inputUnit  = isAdc ? 'dBu' : 'dBFS'
  const outputUnit = isAdc ? 'dBFS' : 'dBu'

  const label = useNodeName(id, typeKey)

  const hasWarning = Boolean(warning)

  return (
    <NodeWrapper
      nodeId={id}
      typeKey={typeKey}
      label={label}
      align="center"
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
          : [['', levels.in, levelOf(result?.out)]] as const
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
            ? t.warnings.adcExpectsAnalog
            : warning === 'dacExpectsDigital'
              ? t.warnings.dacExpectsDigital
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
    </NodeWrapper>
  )
}
