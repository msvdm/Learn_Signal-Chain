import type { CardProps } from './cardProps'
import type { CoderFormat } from '../../data/nodeRegistry'
import { CODER_FORMATS } from '../../data/nodeRegistry'
import { NodeWrapper } from './NodeWrapper'
import { ConditionLabel } from './conditions'
import { ChoiceButtons } from '../controls/ChoiceButtons'
import type { Choice } from '../controls/ChoiceButtons'
import { StableText } from '../controls/StableText'
import { useNodeName } from '../../hooks/useNodeName'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { LEVEL_SAMPLE, levelParts } from '../../utils/readout'

/**
 * Coder (D23): packs the digital mix into a stream's format — MP3, AAC or Opus, chosen with its
 * buttons, a few words under them on what the chosen one is good for — and passes its level on.
 * Its line reads what arrives, in its units, and the format it leaves in. Fed an analog signal it
 * sends nothing and says so in capitals, as a converter does: packing is not converting.
 */
export function CoderNode({ id }: CardProps) {
  const p                = useParams(id, 'coder')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const text             = t.nodes.coder
  const condition        = useStage(id)?.condition
  const { inLevel, inDomain } = useStereoLevels(id)
  const format           = p('format')
  const [value, unit]    = levelParts(inLevel, inDomain)

  const choices: Choice<CoderFormat>[] = CODER_FORMATS.map((f) => ({ value: f, label: text.formats[f], icon: null }))

  return (
    <NodeWrapper nodeId={id} typeKey="coder" label={useNodeName(id, 'coder')} align="center" showLevel={false}>
      <ChoiceButtons
        choices={choices} value={format} onChange={(f) => updateNodeParams(id, { format: f })}
        label={text.format} columns={3} fontSize={14} style={{ width: '100%', height: 38 }}
      />
      <div style={{ fontSize: 'var(--node-text-sm)', color: 'var(--lsc-fg-muted)', textAlign: 'center' }}>
        <StableText reserve={CODER_FORMATS.map((f) => text.goodFor[f])} align="center">{text.goodFor[format]}</StableText>
      </div>
      {/* What arrives, then what leaves: the same level, packed */}
      <div style={{ fontSize: 16, fontFamily: 'var(--lsc-font-mono)', whiteSpace: 'nowrap', textAlign: 'center' }}>
        <span style={{ color: condition ? 'var(--signal-clipping)' : 'var(--lsc-fg-muted)' }}>
          <StableText reserve={[LEVEL_SAMPLE]} align="end">{value}</StableText> {unit}
        </span>
        {' → '}
        <span style={{ fontWeight: 700, color: condition ? 'var(--signal-clipping)' : 'var(--lsc-accent)' }}>{text.formats[format]}</span>
      </div>
      {condition && <ConditionLabel condition={condition} typeKey="coder" />}
    </NodeWrapper>
  )
}
