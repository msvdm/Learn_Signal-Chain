import type { CSSProperties } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import { useNodeChrome } from '../../hooks/useNodeChrome'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useTranslation } from '../../i18n/useTranslation'
import { cardHeight, cardMinSize } from '../../utils/layoutHelpers'
import { SPL_DB } from '../../signal/levels'
import { MeterStrip, STRIP_W } from '../SignalMeter'
import { CardFrame } from './CardFrame'
import { OverviewFace } from './OverviewFace'
import type { OverviewArt } from './OverviewFace'

// Its upright meter, zoomed in: on the right of its face, which keeps this much room free for it
// (the card is its registry minSize plus this room, as tall as the minSize)
const FACE_METER_PAD  = '14px 20px 12px'
const FACE_METER_ROOM = STRIP_W + 16

/**
 * A card that is only its face, at every zoom (the sounds in the air, the Microphone, the
 * Instrument, Computer, Guitar Amp, the speakers, Headphones, Recorder, Stream / Broadcast, Audio
 * Interface, DAW): no header, no body. Zoomed in its
 * face (`art`) with its upright meter on the right — dB SPL where the card's sound is in the air
 * (SPL_DB, D13) —, zoomed out its face with the level under it. Not connected, its face says so
 * (and its meter keeps its place, unseen).
 */
export function FaceCard({ nodeId, typeKey, label, art, bare = false, meter = true, meterAt = 'out' }: {
  nodeId: string
  typeKey: TypeKey
  label: string
  art: OverviewArt
  /** Zoomed out no card around it, the art over the meter bar alone (the Instrument) */
  bare?: boolean
  /** false: no meter at any zoom, its face alone (the Microphone: the sound before it has one — D21) */
  meter?: boolean
  /** What its meter reads: what leaves it (default), or what arrives (an Audio Interface, a DAW: what it records) */
  meterAt?: 'in' | 'out'
}) {
  const chrome = useNodeChrome(nodeId, typeKey)
  const { node, ports, overview, notConnected } = chrome
  const { t }  = useTranslation()
  const height = cardHeight(typeKey, ports)

  // Zoomed out the meter stays in place, invisible, so the card keeps its exact size
  const hideInOverview: CSSProperties = overview ? { visibility: 'hidden', opacity: 0 } : {}

  return (
    <CardFrame
      nodeId={nodeId} label={label} chrome={chrome}
      size={{ w: cardMinSize(typeKey).w + (meter ? FACE_METER_ROOM : 0), h: height }}
      bare={overview && bare}
    >
      {/* The face's place; zoomed in, its meter on the right (hidden, its space kept, when not connected) */}
      <div style={{ height: height - 2, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: FACE_METER_PAD, boxSizing: 'border-box' }}>
        {meter && (
          <div className="lsc-fade" style={{ display: 'flex', ...(notConnected ? { visibility: 'hidden' } : {}), ...hideInOverview }}>
            <FaceMeter nodeId={nodeId} typeKey={typeKey} at={meterAt} />
          </div>
        )}
      </div>

      {/* Its face: zoomed in beside its meter, zoomed out with its level under it */}
      <OverviewFace
        nodeId={nodeId}
        typeKey={typeKey}
        label={label}
        art={art}
        showLevel={overview && meter}
        barOnly={bare}
        status={notConnected ? t.status.notConnected : undefined}
        shown
        bypassed={node?.bypassed ?? false}
        reserveRight={overview || !meter ? 0 : FACE_METER_ROOM}
        spl={SPL_DB[typeKey]}
        at={meterAt}
      />
    </CardFrame>
  )
}

/**
 * Its upright meter: what it plays or picks up — dB SPL where that is sound in the air; what reaches
 * an end point that takes the signal in (the Recorder, Stream / Broadcast), or a card recording it
 * (`at` 'in').
 */
function FaceMeter({ nodeId, typeKey, at }: { nodeId: string; typeKey: TypeKey; at: 'in' | 'out' }) {
  const { t }  = useTranslation()
  const levels = useStereoLevels(nodeId)
  const spl    = SPL_DB[typeKey]
  const input  = at === 'in' || NODE_REGISTRY[typeKey].category === 'sink'
  return (
    <MeterStrip
      {...(at === 'in' ? levels.input : levels.output)}
      label={spl !== undefined ? t.meters.sound : input ? t.meters.input : t.meters.output}
      nodeId={nodeId} at={at} spl={spl}
    />
  )
}
