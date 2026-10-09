import type { CSSProperties } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
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
 * A card that is only its face, at every zoom (Instrument, Guitar Amp, Speaker, Active Speaker,
 * Headphones): no header, no body. Zoomed in its face (`art`) with its upright meter on the right —
 * dB SPL where the card meets the air (SPL_DB, D13) —, zoomed out its face with the level under it.
 * Not connected, its face says so (and its meter keeps its place, unseen).
 */
export function FaceCard({ nodeId, typeKey, label, art, bare = false }: {
  nodeId: string
  typeKey: TypeKey
  label: string
  art: OverviewArt
  /** Zoomed out no card around it, the art over the meter bar alone (the Instrument) */
  bare?: boolean
}) {
  const chrome = useNodeChrome(nodeId, typeKey)
  const { node, ports, overview, notConnected } = chrome
  const { t }  = useTranslation()
  const height = cardHeight(typeKey, ports)

  // Zoomed out the meter stays in place, invisible, so the card keeps its exact size
  const hideInOverview: CSSProperties = overview ? { visibility: 'hidden', opacity: 0 } : {}

  return (
    <CardFrame
      nodeId={nodeId} typeKey={typeKey} label={label} chrome={chrome}
      size={{ w: cardMinSize(typeKey).w + FACE_METER_ROOM, h: height }}
      bare={overview && bare}
    >
      {/* The face's place; zoomed in, its meter on the right (hidden, its space kept, when not connected) */}
      <div style={{ height: height - 2, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: FACE_METER_PAD, boxSizing: 'border-box' }}>
        <div className="lsc-fade" style={{ display: 'flex', ...(notConnected ? { visibility: 'hidden' } : {}), ...hideInOverview }}>
          <FaceMeter nodeId={nodeId} typeKey={typeKey} />
        </div>
      </div>

      {/* Its face: zoomed in beside its meter, zoomed out with its level under it */}
      <OverviewFace
        nodeId={nodeId}
        typeKey={typeKey}
        label={label}
        art={art}
        showLevel={overview}
        barOnly={bare}
        status={notConnected ? t.status.notConnected : undefined}
        shown
        bypassed={node?.bypassed ?? false}
        reserveRight={overview ? 0 : FACE_METER_ROOM}
        spl={SPL_DB[typeKey]}
      />
    </CardFrame>
  )
}

/** Its upright meter: what it plays or picks up — dB SPL where that is sound in the air. */
function FaceMeter({ nodeId, typeKey }: { nodeId: string; typeKey: TypeKey }) {
  const { t }  = useTranslation()
  const levels = useStereoLevels(nodeId)
  const spl    = SPL_DB[typeKey]
  return (
    <MeterStrip
      {...levels.output}
      label={spl === undefined ? t.meters.output : t.meters.sound}
      nodeId={nodeId} at="out" spl={spl}
    />
  )
}
