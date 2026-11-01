import type { CardProps } from './cardProps'
import type { ClockSource, Protocol } from '../../data/nodeRegistry'
import { CLOCKS, LINK_WIRES, PROTOCOLS } from '../../data/nodeRegistry'
import { NodeWrapper } from './NodeWrapper'
import { ConditionLabel } from './conditions'
import { ChoiceButtons } from '../controls/ChoiceButtons'
import { StableText } from '../controls/StableText'
import { useNodeName } from '../../hooks/useNodeName'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { linkChannelCount } from '../../graph/queries'
import { partnerOf } from '../../graph/interfaceLink'
import { linkCapacity } from '../../signal/formats'
import { formatText } from '../../utils/formatText'

/** A column's buttons: three, one under another (px) */
const COLUMN_H = 3 * 32 + 2 * 6

/**
 * Digital Interface (D40): on the left what it takes in, on the right what it sends out — PCM,
 * AES/EBU or AES50, one side always PCM: PCM in and a protocol out, it packs its PCM wires into one
 * cable; a protocol in and PCM out, it unpacks such a cable back into its wires (a protocol on one
 * side sets the other to PCM). Under them how many channels the cable carries (of how many it can:
 * red when they do not fit) and the format of the numbers, unchanged; then where its clock comes
 * from: its own (Internal) or the cable's (External). What is wrong with its cable — two clocks,
 * none, two protocols — under that.
 */
export function DigitalInterfaceNode({ id }: CardProps) {
  const p                = useParams(id, 'digital-interface')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t, fmt }       = useTranslation()
  const text             = t.nodes['digital-interface']
  const stage            = useStage(id)
  const protocol         = p('protocol')
  const packs            = p('packs')
  const inValue: Protocol  = packs ? 'pcm' : protocol
  const outValue: Protocol = packs ? protocol : 'pcm'
  // How many channels the cable carries (unpacking: its other end's), and whether it has one
  const channels         = useSignalStore((s) => linkChannelCount(id, s))
  const cabled           = useSignalStore((s) => partnerOf(id, s) !== undefined)
  const format           = stage?.format ?? stage?.inFormat
  const capacity         = linkCapacity(protocol, format?.kind === 'pcm' ? format.rate : 0)
  const tooMany          = packs && channels > capacity

  const count  = (n: number) => packs
    ? fmt(capacity === 1 ? text.channelOf : text.channelsOf, { n: String(n), max: String(capacity) })
    : fmt(n === 1 ? text.channel : text.channels, { n: String(n) })
  // Its widest texts, so the card never changes size (StableText)
  const widest = [fmt(text.channelsOf, { n: String(2 * LINK_WIRES), max: '48' }), fmt(text.channels, { n: String(2 * LINK_WIRES) })]
  const choices = PROTOCOLS.map((x) => ({ value: x, label: text.protocols[x], icon: null }))

  /** One side set: a protocol there puts PCM on the other side, PCM there the protocol */
  const setIn  = (x: Protocol) => updateNodeParams(id, x === 'pcm' ? { packs: true } : { protocol: x, packs: false })
  const setOut = (x: Protocol) => updateNodeParams(id, x === 'pcm' ? { packs: false } : { protocol: x, packs: true })

  const heading = (word: string) => (
    <div style={{ fontSize: 'var(--node-text-sm)', fontWeight: 700, color: 'var(--lsc-fg-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{word}</div>
  )
  const column = (word: string, value: Protocol, onChange: (x: Protocol) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      {heading(word)}
      <ChoiceButtons choices={choices} value={value} onChange={onChange} label={word} columns={1} fontSize={14} style={{ width: '100%', height: COLUMN_H }} />
    </div>
  )

  return (
    <NodeWrapper nodeId={id} typeKey="digital-interface" label={useNodeName(id, 'digital-interface')} align="center" showLevel={false}>
      {/* What comes in on the left, what goes out on the right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'end', gap: 8, width: '100%' }}>
        {column(text.in, inValue, setIn)}
        <div aria-hidden style={{ height: COLUMN_H, display: 'flex', alignItems: 'center', fontSize: 22, fontWeight: 700, color: 'var(--lsc-accent)' }}>→</div>
        {column(text.out, outValue, setOut)}
      </div>
      {/* How many channels, the numbers' format */}
      <div style={{ fontSize: 13, fontFamily: 'var(--lsc-font-mono)', textAlign: 'center', color: 'var(--lsc-fg-muted)', lineHeight: 1.5 }}>
        <div style={{ color: tooMany ? 'var(--signal-clipping-text)' : undefined, fontWeight: tooMany ? 700 : undefined, visibility: packs || cabled ? 'visible' : 'hidden' }}>
          <StableText reserve={widest} align="center">{count(channels)}</StableText>
        </div>
        <div style={{ visibility: format ? 'visible' : 'hidden' }}>{format ? formatText(t, format) : '—'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        {heading(text.clock)}
        <ChoiceButtons
          choices={CLOCKS.map((c): { value: ClockSource; label: string; icon: null } => ({ value: c, label: text.clocks[c], icon: null }))}
          value={p('clock')} onChange={(c) => updateNodeParams(id, { clock: c })}
          label={text.clock} columns={2} fontSize={13} style={{ width: '100%', height: 32 }}
        />
      </div>
      {stage?.condition && <ConditionLabel condition={stage.condition} typeKey="digital-interface" />}
    </NodeWrapper>
  )
}
