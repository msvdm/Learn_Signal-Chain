import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import type { TypeKey } from '../../data/nodeRegistry'
import { NodeWrapper } from './NodeWrapper'
import { ConditionLabel } from './conditions'
import { useStage } from '../../hooks/useGraphSignal'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { levelOf } from '../../signal/engine'
import { useTranslation } from '../../i18n/useTranslation'
import { StableText } from '../controls/StableText'
import { LEVEL_SAMPLE, levelParts } from '../../utils/readout'
import { ChoiceButtons } from '../controls/ChoiceButtons'
import { useParams } from '../../hooks/useParams'
import { useSignalStore } from '../../store/signalStore'
import { BIT_DEPTHS, SAMPLE_RATES, kbpsOf } from '../../signal/formats'
import { bitsText, formatText, kbpsText, rateText } from '../../utils/formatText'

/** A level's number as the meters print it ("+0.0", "-18.0", "-∞"); the unit is written beside it. */
const levelText = (db: number) => levelParts(db, 'analog')[0]

/**
 * A converter: what goes in and what comes out, in their units. An ADC chooses how it writes the
 * sound as numbers — its sample rate and bit depth (D36) — and says how big the stream is beside
 * "Digital out"; a DAC says the format arriving. Zoomed out its name alone (no level).
 */
export function AdcDacNode({ id, type }: CardProps) {
  const levels              = useStereoLevels(id)
  const { input, output }   = levels
  const { t }               = useTranslation()

  const typeKey    = type as TypeKey
  const isAdc      = typeKey === 'adc'
  const result     = useStage(id)
  const domain     = result?.domain ?? 'analog'
  const warning    = result?.condition

  const inputUnit  = isAdc ? 'dBu' : 'dBFS'
  const outputUnit = isAdc ? 'dBFS' : 'dBu'

  const label = useNodeName(id, typeKey)
  const p                = useParams(id, 'adc')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const f        = t.formats
  const written  = isAdc ? result?.format : undefined
  const arriving = isAdc ? undefined : result?.inFormat

  const hasWarning = Boolean(warning)

  return (
    <NodeWrapper
      nodeId={id}
      typeKey={typeKey}
      label={label}
      align="center"
      showLevel={false}
    >
      {/* Conversion label — the text as big as the card leaves room for */}
      <div
        style={{
          fontSize: 15, fontWeight: 700,
          fontFamily: 'var(--lsc-font-mono)',
          textAlign: 'center',
          color: hasWarning ? 'var(--signal-clipping)' : 'var(--lsc-accent)',
          letterSpacing: '0.04em',
        }}
      >
        {inputUnit} → {outputUnit}
      </div>

      {/* An ADC: how it writes the sound as numbers */}
      {isAdc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <ChoiceButtons
            choices={SAMPLE_RATES.map((r) => ({ value: String(r), label: rateText(t, r), icon: null }))}
            value={String(p('sampleRate'))} onChange={(v) => updateNodeParams(id, { sampleRate: Number(v) })}
            label={f.sampleRate} columns={3} fontSize={13} style={{ height: 32 }}
          />
          <ChoiceButtons
            choices={BIT_DEPTHS.map((b) => ({ value: String(b), label: bitsText(t, b), icon: null }))}
            value={String(p('bitDepth'))} onChange={(v) => updateNodeParams(id, { bitDepth: Number(v) })}
            label={f.bitDepth} columns={2} fontSize={13} style={{ height: 32 }}
          />
        </div>
      )}
      {/* A DAC: the format arriving */}
      {!isAdc && (
        <div style={{ fontSize: 14, fontFamily: 'var(--lsc-font-mono)', textAlign: 'center', color: 'var(--lsc-fg-muted)', visibility: arriving ? 'visible' : 'hidden' }}>
          {arriving ? formatText(t, arriving) : '—'}
        </div>
      )}

      {/* Input → output level display — always shown, numbers keep their widest width */}
      <div
        style={{
          fontSize: 16,
          fontFamily: 'var(--lsc-font-mono)',
          textAlign: 'center',
          color: 'var(--lsc-fg)',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
        }}
      >
        {/* One line per side when stereo: "L  -10.0 dBu → 8.0 dBFS" */}
        {(levels.stereo
          ? [['L ', input.l.rms, output.l.rms], ['R ', input.r?.rms ?? -Infinity, output.r?.rms ?? -Infinity]] as const
          : [['', input.l.rms, levelOf(result?.out)]] as const
        ).map(([side, inDb, outDb]) => (
          <div key={side}>
            {side && <span style={{ fontWeight: 700, color: 'var(--lsc-fg-muted)' }}>{side}</span>}
            <span style={{ color: 'var(--lsc-fg-muted)' }}>
              <StableText reserve={[LEVEL_SAMPLE]} align="end">{levelText(inDb)}</StableText> {inputUnit}
            </span>
            {' → '}
            {/* In the colour of its health, as the port and the wire: red when the converter clips */}
            <span style={{ color: hasWarning ? 'var(--signal-clipping)' : `var(--signal-${levels.outHealth}-text)` }}>
              <StableText reserve={[LEVEL_SAMPLE]} align="end">{levelText(outDb)}</StableText> {outputUnit}
            </span>
          </div>
        ))}
      </div>

      {/* What is wrong: an ADC fed a digital signal, a DAC an analog one */}
      {warning && <ConditionLabel condition={warning} typeKey={typeKey} />}

      {/* Domain indicator */}
      <div
        style={{
          fontSize: 15,
          textAlign: 'center',
          color: domain === 'digital' ? 'var(--lsc-accent)' : 'var(--signal-good)',
          fontWeight: 600,
        }}
      >
        <StableText reserve={[`● ${t.meters.digitalOut}`, `● ${t.meters.analogOut}`]} align="center">
          ● {domain === 'digital' ? t.meters.digitalOut : t.meters.analogOut}
        </StableText>
        {/* How big the stream it writes is */}
        {isAdc && (
          <span style={{ fontFamily: 'var(--lsc-font-mono)', visibility: written ? 'visible' : 'hidden' }}>
            {' · '}<StableText reserve={[kbpsText(t, 4608)]}>{written ? kbpsText(t, kbpsOf(written)) : ''}</StableText>
          </span>
        )}
      </div>
    </NodeWrapper>
  )
}
