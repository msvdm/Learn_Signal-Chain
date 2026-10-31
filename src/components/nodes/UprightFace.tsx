import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import { NODE_LOOK } from './nodeLook'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useDetailShown } from '../../hooks/useDetailShown'
import { louder } from '../../signal/levels'
import { MeterBars, STRIP_W } from '../SignalMeter'
import type { MeterAt } from '../meterPaint'
import { Readings } from './BareMeter'
import { Frameless } from './Frameless'
import type { FramelessNote } from './Frameless'

/** Its upright meter beside the icon: a little shorter than the icon, as its picture is */
const METER_H = 200

/**
 * An element with no card around it and one form at every zoom (D30): its icon with its upright
 * meter beside it — L and R bars and their scale — and under its name the Passive Speaker's Peak,
 * RMS, Noise and health word (Readings): Stream / Broadcast's, reading what arrives (`at` 'in'), on
 * its input's side — or what leaves, on its output's (`at` 'out'; the Computer's until it lost its
 * meter — D34). Always stereo: a mono signal on both bars. The meter moves zoomed out too.
 */
export function UprightFace({ id, typeKey, at, note }: {
  id: string
  typeKey: TypeKey
  at: MeterAt
  note?: FramelessNote
}) {
  const detailed = useDetailShown()
  const levels   = useStereoLevels(id)
  const m        = at === 'in' ? levels.input : levels.output
  const r        = m.r ?? (NODE_REGISTRY[typeKey].stereo === 'always' ? m.l : undefined)
  const shown    = detailed
  const meter = (
    <div style={{ height: METER_H, display: 'flex', visibility: shown ? 'visible' : 'hidden' }}>
      <MeterBars l={m.l} r={r} domain={m.domain} nodeId={id} at={at} moving={shown} style={{ flex: 1 }} />
    </div>
  )
  // What it takes in comes before it, on its input's side; what it sends after it
  const beside = { node: meter, width: STRIP_W }
  return (
    <Frameless
      id={id} typeKey={typeKey} Icon={NODE_LOOK[typeKey].icon} note={note}
      {...(at === 'in' ? { before: beside } : { after: beside })}
      footer={() => (
        <div style={{ visibility: shown ? 'visible' : 'hidden' }}>
          <Readings nodeId={id} at={at} domain={m.domain} out={r ? louder(m.l, r) : m.l} health={m.health} />
        </div>
      )}
    />
  )
}
