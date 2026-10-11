import type { CSSProperties, ReactNode } from 'react'
import { VolumeX } from 'lucide-react'
import type { CardProps } from './cardProps'
import type { NodePort, TypeKey } from '../../data/nodeRegistry'
import { FROM_PC_PORT, isFlipped } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'
import { useNodeChrome } from '../../hooks/useNodeChrome'
import { useNodeName } from '../../hooks/useNodeName'
import { useTranslation } from '../../i18n/useTranslation'
import type { Translations } from '../../i18n/translations'
import { reachIn, soundAt } from '../../graph/reach'
import type { Verdict } from '../../graph/reach'
import { HEADER_H, cardHeight, cardMinSize } from '../../utils/layoutHelpers'
import type { Size } from '../../utils/geometry'
import { cssVar, textWidth } from '../../utils/fitText'
import { STRIP_W, StillMeter } from '../SignalMeter'
import { CardFrame } from './CardFrame'
import { FACE_METER_ROOM } from './FaceCard'
import { NOTE_LINE, noteLines, noteSize } from './noteLayout'
import { NODE_LOOK } from './nodeLook'
import { OverviewFace, OverviewIcon } from './OverviewFace'
import { MirroredIcons } from './mirroredIcons'
import { PAD } from './overviewLayout'
import { PortLine } from './InterfaceNode'
import { LINE_H, lineTop } from './portLines'
import { InterfaceDrawing, MixerDrawing } from './BeginnerArt'

// Beginner's faces (D20): devices, not their parts — no number engine, no render, no real meters.
// The inputs are their icon and name, with no card around them; the outputs their icon and what
// they get (graph/reach.ts: sound, or why not); the devices their icon, the Mixer and the Audio
// Interface a drawing of the box. The Mixer, the Interface and the DAW have a still meter: lit
// while a sound reaches them. Each face is the same at every zoom but the Interface's: zoomed out
// its name, in capitals.

/** The name under an input's icon: its biggest size zoomed in, and zoomed out (read from afar) */
const NAME_NEAR = 26
const NAME_FAR  = 72
const NAME_GAP  = 8
/** An output's verdict zoomed out: "Sound" or "No sound", this big */
const VERDICT_FAR = 44
/** The Mixer's meter, this many times its usual size, as its drawing (its card's size: the registry) */
const MIXER_SCALE = 3
// A drawn device's name across its top, when it has no port lines (times its scale)
const TITLE_SIZE = 22

/** A face's size: its type's card (minSize, tall enough for its ports), and a still meter's room on the right if it has one. */
function faceSize(typeKey: TypeKey, ports: { inputs: NodePort[]; outputs: NodePort[] }, meter: boolean): Size {
  return { w: cardMinSize(typeKey).w + (meter ? FACE_METER_ROOM : 0), h: cardHeight(typeKey, ports) }
}

/** The biggest font size (at most `max`) at which `text` fits `width` on one line. */
function fitFont(text: string, width: number, max: number, weight = 600): number {
  const w = textWidth(text, cssVar('--lsc-font-sans'), weight)
  return Math.max(10, Math.min(max, Math.floor((width * 0.97) / w)))
}

/** The layer a face is drawn in: the card less PAD all round (`right`: more room kept there). */
const layer = (right = 0): CSSProperties => ({
  position: 'absolute', left: PAD, top: PAD, bottom: PAD, right: PAD + right,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  pointerEvents: 'none',
})

/**
 * An input (a sound, a microphone, a player, a guitar) or the Stage Box: its icon and its name, no
 * card around it, no meter — at every zoom, the name bigger zoomed out. The Vocal is a head, the
 * Microphone has no Dynamic | Condenser.
 */
export function BeginnerInput({ id, type }: CardProps) {
  const typeKey = type as TypeKey
  const chrome  = useNodeChrome(id, typeKey)
  const label   = useNodeName(id, typeKey)
  const size    = faceSize(typeKey, chrome.ports, false)
  const Icon    = NODE_LOOK[typeKey].icon
  const w       = size.w - 2 * PAD
  const font    = fitFont(label, w, chrome.overview ? NAME_FAR : NAME_NEAR)
  return (
    <CardFrame nodeId={id} label={label} chrome={chrome} size={size} bare>
      <div style={{ ...layer(), gap: NAME_GAP }}>
        <OverviewIcon icon={<Icon />} box={{ w, h: size.h - 2 * PAD - Math.ceil(font * 1.2) - NAME_GAP }} />
        <span style={{ fontSize: font, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{label}</span>
      </div>
    </CardFrame>
  )
}

/** The colour of what an end point gets. */
const VERDICT_TONE: Record<Verdict, string> = {
  sound:           'var(--signal-good-text)',
  'not-connected': 'var(--lsc-fg-muted)',
  'no-source':     'var(--lsc-fg-muted)',
  'needs-amp':     'var(--signal-hot-text)',
}

/** What an end point says it gets: zoomed in why there is no sound, zoomed out only whether there is. */
function verdictText(t: Translations, typeKey: TypeKey, verdict: Verdict, far: boolean): string {
  if (verdict === 'sound') return typeKey === 'recorder' ? t.beginner.recording : typeKey === 'broadcast' ? t.beginner.onAir : t.beginner.sound
  if (far) return t.beginner.noSound
  return verdict === 'needs-amp' ? t.nodes.speaker.needsAmp : verdict === 'no-source' ? t.beginner.noSource : t.beginner.notConnected
}

/**
 * An output (a speaker, Headphones, a Recorder, Stream / Broadcast): its icon and, under it, what
 * it gets — sound, or why not (graph/reach.ts). A passive speaker with no Amplifier before it is
 * crossed out. No meter.
 */
export function BeginnerOutput({ id, type }: CardProps) {
  const typeKey = type as TypeKey
  const chrome  = useNodeChrome(id, typeKey)
  const label   = useNodeName(id, typeKey)
  const { t }   = useTranslation()
  const verdict = useSignalStore((s) => reachIn(s).verdicts.get(id) ?? 'not-connected')
  const size    = faceSize(typeKey, chrome.ports, false)
  const box     = { w: size.w - 2 * PAD, h: size.h - 2 * PAD }
  const text    = verdictText(t, typeKey, verdict, chrome.overview)
  const font    = chrome.overview ? fitFont(text, box.w, VERDICT_FAR, 700) : noteSize(box)
  const lines   = noteLines(text, box, 0, font)
  const tone    = VERDICT_TONE[verdict]
  const Icon    = verdict === 'needs-amp' ? VolumeX : NODE_LOOK[typeKey].icon
  return (
    // Flipped horizontally (a speaker facing the band), its picture faces the other way
    <MirroredIcons.Provider value={chrome.node !== undefined && isFlipped(chrome.node, 'h')}>
      <CardFrame nodeId={id} label={label} chrome={chrome} size={size}>
        <div style={{ ...layer(), gap: 6 }}>
          <OverviewIcon
            icon={<Icon />} box={{ w: box.w, h: box.h - font * NOTE_LINE * lines - 6 }}
            color={verdict === 'needs-amp' ? tone : undefined}
          />
          <span style={{ fontSize: font, fontWeight: 700, lineHeight: NOTE_LINE, textAlign: 'center', color: tone, maxWidth: box.w }}>{text}</span>
        </div>
      </CardFrame>
    </MirroredIcons.Provider>
  )
}

/**
 * A device shown as its icon: the Amplifier (no knob), the DAW — the DAW with a
 * still meter in dBFS beside it, lit while a sound reaches it (zoomed out its icon alone).
 */
export function BeginnerDevice({ id, type }: CardProps) {
  const typeKey = type as TypeKey
  const chrome  = useNodeChrome(id, typeKey)
  const label   = useNodeName(id, typeKey)
  const { t }   = useTranslation()
  const meter   = typeKey === 'daw'
  const lit     = useSignalStore((s) => meter && soundAt(reachIn(s), id, 'in'))
  const size    = faceSize(typeKey, chrome.ports, meter)
  const room    = meter && !chrome.overview ? FACE_METER_ROOM : 0
  const Icon    = NODE_LOOK[typeKey].icon
  return (
    <CardFrame nodeId={id} label={label} chrome={chrome} size={size}>
      <div style={layer(room)}>
        <OverviewIcon icon={<Icon />} box={{ w: size.w - 2 * PAD - room, h: size.h - 2 * PAD }} />
      </div>
      {meter && (
        <div style={{ position: 'absolute', top: 14, bottom: 12, right: 20, display: 'flex', ...(chrome.overview ? { visibility: 'hidden' } : {}) }}>
          <StillMeter lit={lit} domain="digital" label={t.meters.input} />
        </div>
      )}
    </CardFrame>
  )
}

/**
 * A device drawn as the box it is (the Mixer, Beginner's Audio Interface): its title, a line on
 * each port line naming what goes in and out there — or, with no `lines`, its name big across the
 * top instead —, its drawing, and a still meter in dBu (lit while a sound reaches what it reads) —
 * the title and meter `scale` times their usual size. Zoomed out its name alone, in capitals
 * (`nameFar`), or the same as zoomed in.
 */
function DrawnDevice({ id, typeKey, meterAt, wide, scale = 1, nameFar, lines, drawing }: {
  id: string
  typeKey: TypeKey
  /** The input its meter reads (undefined: any) */
  meterAt?: string
  /** Its card is as wide as its type's minSize (the Mixer); else a meter's room is added (a face card's size) */
  wide: boolean
  scale?: number
  nameFar: boolean
  lines?: ReactNode
  drawing: (box: { w: number; h: number }) => ReactNode
}) {
  const chrome = useNodeChrome(id, typeKey)
  const label  = useNodeName(id, typeKey)
  const { t }  = useTranslation()
  const lit    = useSignalStore((s) => soundAt(reachIn(s), id, meterAt))
  const size   = faceSize(typeKey, chrome.ports, !wide)
  const Icon   = NODE_LOOK[typeKey].icon
  // Under its two port lines: the drawing, and the meter on its right
  const top    = PAD + lineTop(1) + LINE_H + 10
  const art    = { w: size.w - 2 * PAD - FACE_METER_ROOM * scale, h: size.h - top - PAD }
  const far    = nameFar && chrome.overview
  const hidden: CSSProperties = far ? { visibility: 'hidden' } : {}
  return (
    <CardFrame nodeId={id} label={label} chrome={chrome} size={size}>
      {lines ? (<>
        <div
          style={{
            ...hidden, height: HEADER_H, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
            padding: '0 10px 0 12px', borderBottom: '1px solid var(--lsc-border-soft)',
          }}
        >
          <span className="lsc-node-icon" style={{ display: 'flex' }}><Icon size={16} /></span>
          <span style={{ fontSize: 'var(--node-text-md)', fontWeight: 600 }}>{label}</span>
        </div>
        {/* Not drawn zoomed out: an arrow sets its own visibility */}
        {!far && (
          <div style={{ position: 'absolute', left: PAD, right: PAD, top: PAD, height: lineTop(1) + LINE_H, pointerEvents: 'none' }}>
            {lines}
          </div>
        )}
      </>) : (
        <div
          style={{
            ...hidden, position: 'absolute', left: PAD, right: PAD, top: 0, height: top,
            display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: TITLE_SIZE * scale, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>{label}</span>
        </div>
      )}
      <div style={{ ...hidden, position: 'absolute', left: PAD, right: PAD, top, bottom: PAD, display: 'flex', gap: 16 * scale, pointerEvents: 'none' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lsc-fg)' }}>{drawing(art)}</div>
        {/* The meter as it always is, made `scale` times bigger (text and all) */}
        <div style={{ width: STRIP_W * scale, flexShrink: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: STRIP_W, height: `${100 / scale}%`, display: 'flex', transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            <StillMeter lit={lit} domain="analog" label={t.meters[meterAt ? 'input' : 'output']} />
          </div>
        </div>
      </div>
      {nameFar && (
        <OverviewFace
          nodeId={id} typeKey={typeKey} label={label.toLocaleUpperCase()} showLevel={false}
          shown={chrome.overview} bypassed={false}
        />
      )}
    </CardFrame>
  )
}

/**
 * The Mixer (Beginner): the whole desk in one box — any number of wires in, its mix out of Main
 * (the upper output) and Monitor. Drawn big (the user's call, 2026-10-11: three times the size), the
 * same at every zoom; its name, "Mixing desk", big across the top — no port lines (the user's call:
 * too small to read). Its meter reads its mix: lit while a sound reaches it.
 */
export function MixerNode({ id }: CardProps) {
  return (
    <DrawnDevice
      id={id} typeKey="mixer" wide scale={MIXER_SCALE} nameFar={false}
      drawing={(box) => <MixerDrawing box={box} />}
    />
  )
}

/**
 * Beginner's Audio Interface: the box drawn, its two paths named almost as at Intermediate (Inputs
 * → To computer: at Beginner a mic or a guitar goes in too; From computer → Line out), its meter
 * reading what it records.
 */
export function BeginnerInterface({ id }: CardProps) {
  const { t }     = useTranslation()
  const text      = t.nodes.interface
  const recording = useSignalStore((s) => soundAt(reachIn(s), id, 'in'))
  const playing   = useSignalStore((s) => soundAt(reachIn(s), id, FROM_PC_PORT))
  return (
    <DrawnDevice
      id={id} typeKey="interface" meterAt="in" wide={false} nameFar
      lines={<>
        <PortLine row={0} from={t.beginner.inputs} to={text.toComputer} lit={[recording, recording]} arrow />
        <PortLine row={1} from={text.fromComputer} to={text.lineOut} lit={[playing, playing]} arrow />
      </>}
      drawing={(box) => <InterfaceDrawing box={box} />}
    />
  )
}
