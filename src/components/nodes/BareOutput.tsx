import { useContext } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { FLIPS } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'
import { useNodeName } from '../../hooks/useNodeName'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { useDetailShown } from '../../hooks/useDetailShown'
import { useTranslation } from '../../i18n/useTranslation'
import { reachIn } from '../../graph/reach'
import type { Verdict } from '../../graph/reach'
import type { StageCondition } from '../../signal/process'
import { FreeControl } from './FreeControl'
import { SplMeter } from './SplMeter'
import { MirroredIcons } from './mirroredIcons'
import { conditionNote } from './conditionText'
import { NOTE_ICON_GAP, NOTE_ICON_W, NOTE_LINE, noteSize } from './noteLayout'
import { VERDICT_FAR, VERDICT_TONE, fitFont, verdictText } from './verdicts'

/** Its icon's box (px) */
const FACE = 240
/** Between the icon and what is beside it (the Volume knob) */
const BESIDE_GAP = 16
/** What is beside it: its room across (px) */
const BESIDE_W = 150
/** Its port line, from the drawing's top: on the icon, with a note under it or not */
const PORT_LINE = 100
/** Its name, this many times a free control's (read zoomed out) */
const NAME_SCALE = 1.5
/** A selected icon's glow, each side of its lines (px on the canvas; thicker zoomed out) */
const GLOW = 12
const GLOW_FAR = 24

/** The frameless outputs (D28) */
export type BareOutputType = 'speaker' | 'headphones' | 'active-speaker' | 'studio-monitor'

/** What an icon takes: lucide's icons, or one drawn in their style (a blown speaker) */
export type OutputIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number; style?: CSSProperties; 'aria-hidden'?: boolean }>

/** The icon it shows and its colour (a condition's: crossed out, blown) */
export interface OutputLook {
  Icon: OutputIcon
  color?: string
}

/** A note under its icon: its words, their colour and size (px), a small picture at their start */
interface Note {
  text: string
  color: string
  size: number
  icon?: (size: number) => ReactNode
}

/**
 * An output with no card around it (D28), like the amps (D27): its icon — selected, its own lines
 * turn the accent colour with a soft glow around them — with, from Intermediate, what is `beside`
 * it (the Active Speaker's Volume knob: before it, on its input's side), its name, and its meter in
 * dB SPL under them with its Peak, RMS, Noise and health word (SplMeter: from Intermediate). The
 * same at every zoom. Under the icon what it gets: at Beginner its verdict (graph/reach.ts: sound,
 * or why not); from Intermediate a condition's words (conditionText.tsx), a bad sound or a hum —
 * the element grows downward to make room for it, the icon keeps its size. `look` picks the icon
 * for each case (a speaker crossed out, blown).
 */
export function BareOutput({ id, typeKey, look, beside }: {
  id: string
  typeKey: BareOutputType
  look: (at: { condition?: StageCondition; verdict?: Verdict }) => OutputLook
  /** Beside the icon from Intermediate, a control (its Volume knob) */
  beside?: ReactNode
}) {
  const { t }    = useTranslation()
  const label    = useNodeName(id, typeKey)
  const detailed = useDetailShown()
  const overview = useSignalStore((s) => s.overview)
  const p        = useParams(id, typeKey)
  const flipped  = (FLIPS[typeKey]?.includes('h') ?? false) && p('flipH') === true
  // At Beginner what it gets (no engine there — D20); from Intermediate the engine's stage
  const verdict  = useSignalStore((s) => detailed ? undefined : reachIn(s).verdicts.get(id) ?? 'not-connected')
  const stage    = useStage(id)

  const condition = detailed ? stage?.condition : undefined
  const near      = noteSize({ w: FACE })
  let note: Note | undefined
  if (verdict) {
    const text = verdictText(t, typeKey, verdict, overview)
    note = { text, color: VERDICT_TONE[verdict], size: overview ? fitFont(text, FACE, VERDICT_FAR, 700) : near }
  } else if (condition) {
    note = { ...conditionNote(t, condition, typeKey), size: near }
  } else if (stage?.distorted) {
    // Something before it clips: its meter may be green, but you hear it
    note = { text: t.nodes.speaker.distorted, color: 'var(--signal-clipping-text)', size: near }
  } else if (stage?.hum !== undefined) {
    note = { text: t.nodes.speaker.hum, color: 'var(--signal-clipping-text)', size: near }
  }

  const { Icon, color } = look({ condition, verdict })
  const side  = detailed ? beside : undefined
  // The icon and what is beside it: the note and the meter as wide as them
  const width = side ? FACE + BESIDE_GAP + BESIDE_W : FACE

  return (
    // Flipped horizontally (facing the band), its picture faces the other way
    <MirroredIcons.Provider value={flipped}>
      <FreeControl
        nodeId={id} typeKey={typeKey} label={label} portLine={PORT_LINE} textScale={NAME_SCALE} outline={false}
        footer={<SplMeter nodeId={id} typeKey={typeKey} width={width} readings />}
      >
        <div style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {/* What is beside the icon comes first in the chain: between the input and the icon
              (flipped, the input is on the right, and so is it) */}
          <div style={{ display: 'flex', flexDirection: flipped ? 'row-reverse' : 'row', alignItems: 'center', gap: BESIDE_GAP }}>
            {side && <div className="nodrag nopan" style={{ width: BESIDE_W, display: 'flex', justifyContent: 'center', pointerEvents: 'auto' }}>{side}</div>}
            <SelectableIcon nodeId={id} Icon={Icon} size={FACE} color={color} />
          </div>
          {note && (
            <span style={{ fontSize: note.size, fontWeight: 700, lineHeight: NOTE_LINE, textAlign: 'center', color: note.color, maxWidth: width }}>
              {note.icon && (
                <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: `${NOTE_ICON_GAP}em` }}>
                  {note.icon(Math.round(note.size * NOTE_ICON_W))}
                </span>
              )}
              {note.text}
            </span>
          )}
        </div>
      </FreeControl>
    </MirroredIcons.Provider>
  )
}

/**
 * The icon, `size` px square. Selected, its lines turn the accent colour with the soft glow around
 * them (the same icon drawn under it, its lines thicker) — its own outline, as the amps' (D27).
 */
function SelectableIcon({ nodeId, Icon, size, color = 'var(--lsc-fg)' }: {
  nodeId: string
  Icon: OutputIcon
  size: number
  color?: string
}) {
  const selected = useSignalStore((s) => s.selectedNodeIds.includes(nodeId))
  const overview = useSignalStore((s) => s.overview)
  const mirrored = useContext(MirroredIcons)
  // The icon's lines are 2 of its 24 units: the glow is added each side, in those units
  const glow = (2 * (overview ? GLOW_FAR : GLOW)) / (size / 24)
  return (
    <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'block', ...(mirrored ? { transform: 'scaleX(-1)' } : {}) }}>
      {selected && (
        // One translucent layer (opacity on the whole picture: where its lines cross it is no darker)
        <Icon
          aria-hidden size={size} color="var(--lsc-accent)" strokeWidth={2 + glow}
          style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: 0.35 }}
        />
      )}
      <Icon aria-hidden size={size} color={selected ? 'var(--lsc-accent)' : color} style={{ position: 'absolute', inset: 0 }} />
    </span>
  )
}
