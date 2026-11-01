import type { CardProps } from './cardProps'
import type { Codec } from '../../data/nodeRegistry'
import { CODECS } from '../../data/nodeRegistry'
import { NodeWrapper } from './NodeWrapper'
import { ConditionLabel } from './conditions'
import { ChoiceButtons } from '../controls/ChoiceButtons'
import { StableText } from '../controls/StableText'
import { useNodeName } from '../../hooks/useNodeName'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { Translations } from '../../i18n/translations'
import { BITRATES } from '../../signal/formats'
import { formatText, kbpsText, smallerText } from '../../utils/formatText'

/** What a side can be: the numbers as they are, or one of the codecs */
type Side = 'pcm' | Codec
const SIDES: readonly Side[] = ['pcm', ...CODECS]

/** Its widest "what into what" lines, squeezing and unpacking: the card keeps their width either way */
const widestLines = (t: Translations) => [
  `${formatText(t, { kind: 'pcm', rate: 44100, bits: 24 })} → ${formatText(t, { kind: 'coded', codec: 'opus', kbps: 320, from: { kind: 'pcm', rate: 44100, bits: 24 } })}`,
  `${formatText(t, { kind: 'coded', codec: 'opus', kbps: 320, from: { kind: 'pcm', rate: 44100, bits: 24 } })} → ${formatText(t, { kind: 'pcm', rate: 44100, bits: 32 })}`,
]

/** A column's buttons: four, one under another (px) */
const COLUMN_H = 4 * 30 + 3 * 6

/**
 * Codec (D41), between the chain and Stream / Broadcast: on the left what it takes in, on the right
 * what it sends out — PCM, MP3, AAC or Opus, one side always PCM. PCM in and a codec out, it squeezes
 * the digital mix into a stream at its bitrate (the buttons under the columns) for Stream /
 * Broadcast; a codec in and PCM out, it unpacks the stream Stream / Broadcast sends, for the listener.
 * A codec chosen on one side sets the other to PCM. Under them what the chosen codec is good for,
 * what it turns into what ("48 kHz · 24-bit → MP3 · 128 kb/s") and, squeezing, how many times smaller.
 * Fed an analog signal it sends nothing, and says so; unpacking another codec's stream too.
 */
export function CodecNode({ id }: CardProps) {
  const p                = useParams(id, 'codec')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const text             = t.nodes.codec
  const stage            = useStage(id)
  const codec            = p('codec')
  const encodes          = p('encodes')
  const inValue: Side    = encodes ? 'pcm' : codec
  const outValue: Side   = encodes ? codec : 'pcm'
  const arrives          = stage?.inFormat
  const sent             = stage?.format
  const choices          = SIDES.map((x) => ({ value: x, label: text.codecs[x], icon: null }))

  /** One side set: a codec there puts PCM on the other side, PCM there the codec */
  const setIn  = (x: Side) => updateNodeParams(id, x === 'pcm' ? { encodes: true } : { codec: x, encodes: false })
  const setOut = (x: Side) => updateNodeParams(id, x === 'pcm' ? { encodes: false } : { codec: x, encodes: true })

  const heading = (word: string) => (
    <div style={{ fontSize: 'var(--node-text-sm)', fontWeight: 700, color: 'var(--lsc-fg-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{word}</div>
  )
  const column = (word: string, value: Side, onChange: (x: Side) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      {heading(word)}
      <ChoiceButtons choices={choices} value={value} onChange={onChange} label={word} columns={1} fontSize={14} style={{ width: '100%', height: COLUMN_H }} />
    </div>
  )

  return (
    <NodeWrapper nodeId={id} typeKey="codec" label={useNodeName(id, 'codec')} align="center" showLevel={false}>
      {/* What comes in on the left, what goes out on the right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'end', gap: 8, width: '100%' }}>
        {column(text.in, inValue, setIn)}
        <div aria-hidden style={{ height: COLUMN_H, display: 'flex', alignItems: 'center', fontSize: 22, fontWeight: 700, color: 'var(--lsc-accent)' }}>→</div>
        {column(text.out, outValue, setOut)}
      </div>
      {/* Squeezing: the stream's size (unpacking, the stream's own: shown below) */}
      <ChoiceButtons
        choices={BITRATES.map((k) => ({ value: String(k), label: kbpsText(t, k), icon: null }))}
        value={String(p('bitrate'))} onChange={(v) => updateNodeParams(id, { bitrate: Number(v) })}
        label={t.formats.bitrate} columns={3} fontSize={13} style={{ width: '100%', height: 32, visibility: encodes ? 'visible' : 'hidden' }}
      />
      <div style={{ fontSize: 'var(--node-text-sm)', color: 'var(--lsc-fg-muted)', textAlign: 'center' }}>
        <StableText reserve={CODECS.map((c) => text.goodFor[c])} align="center">{text.goodFor[codec]}</StableText>
      </div>
      {/* What it turns into what — and, squeezing, how many times smaller */}
      <div style={{ fontSize: 13, fontFamily: 'var(--lsc-font-mono)', textAlign: 'center', color: 'var(--lsc-fg-muted)', lineHeight: 1.4, visibility: arrives && sent ? 'visible' : 'hidden' }}>
        <StableText reserve={widestLines(t)} align="center">{arrives && sent ? `${formatText(t, arrives)} → ${formatText(t, sent)}` : '—'}</StableText>
        <div style={{ fontWeight: 700, color: 'var(--lsc-accent)', visibility: encodes ? 'visible' : 'hidden' }}>
          {arrives && sent && encodes ? smallerText(t, arrives, sent) : '—'}
        </div>
      </div>
      {stage?.condition && <ConditionLabel condition={stage.condition} typeKey="codec" />}
    </NodeWrapper>
  )
}
