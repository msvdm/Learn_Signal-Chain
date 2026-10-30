import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FaceCard } from './FaceCard'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { FaceNote, WithNote } from './FaceNote'
import { noteLines } from './noteLayout'
import { PortLine } from './InterfaceNode'
import { LINE_H, lineTop } from './portLines'
import { VuMeter } from '../VuMeter'
import { vuMeterHeight } from '../vuLayout'
import { useStage, useWire } from '../../hooks/useGraphSignal'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { outputKey } from '../../graph/graph'
import { levelOf } from '../../signal/engine'

/**
 * The Recorder: an end point that takes the signal in as it arrives — a card with a big icon and its
 * meter, in dBu (what it records: no sound in the air here). (Stream / Broadcast has no card:
 * BroadcastNode.) A signal
 * clipped on its way here says "Bad sound" (`distorted`: the recording keeps the distortion, however
 * green its meter); a hum from a DI Box ground loop shows too. At Advanced the Recorder is a
 * Recorder Track (D23): a line across its face names what it records and its Monitor out, and on an
 * analog signal its meter is a VU meter in its face (VuMeter) — on a digital one dBFS, as any meter.
 */
export function RecorderNode({ id, type }: CardProps) {
  const typeKey = type as 'recorder'
  const Icon    = NODE_LOOK[typeKey].icon
  const stage   = useStage(id)
  const levels  = useStereoLevels(id)
  const { t }   = useTranslation()
  const track   = useSignalStore((s) => s.complexityLevel === 'advanced')
  const zoomed  = useSignalStore((s) => s.overview)
  const sending = isFinite(levelOf(useWire(outputKey(id, 'out'))))
  const vu      = track && stage?.inDomain !== 'digital'

  const note = stage?.distorted ? t.nodes.speaker.distorted
    : stage?.hum !== undefined ? t.nodes.speaker.hum
    : undefined

  return (
    <FaceCard
      nodeId={id}
      typeKey={typeKey}
      label={useNodeName(id, typeKey)}
      meterInFace={vu}
      art={(box) => {
        /** The icon in `area`, a note under it if there is one */
        const iconIn = (area: { w: number; h: number }) => {
          const face = (h: number) => <OverviewIcon icon={<Icon />} box={{ w: area.w, h }} />
          if (!note) return face(area.h)
          return (
            <WithNote
              box={area} lines={noteLines(note, area)} face={face}
              note={<FaceNote box={area} color="var(--signal-clipping-text)">{note}</FaceNote>}
            />
          )
        }
        if (!track || zoomed) return iconIn(box)
        const top  = lineTop(0) + LINE_H
        const rest = box.h - top - (vu ? vuMeterHeight(box.w, levels.input.r !== undefined) + 8 : 0)
        return (
          <div style={{ position: 'relative', width: box.w, height: box.h }}>
            <PortLine row={0} from={t.nodes.recorder.records} to={t.nodes.recorder.monitorOut} lit={[isFinite(levels.inLevel), sending]} arrow />
            <div style={{ position: 'absolute', left: 0, right: 0, top, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
              {iconIn({ w: box.w, h: rest })}
              {vu && <VuMeter l={levels.input.l} r={levels.input.r} nodeId={id} at="in" />}
            </div>
          </div>
        )
      }}
    />
  )
}
