import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FaceCard } from './FaceCard'
import { NODE_LOOK } from './nodeLook'
import { VolumeFace } from './VolumeFace'
import { ConditionNote } from './conditions'
import { useStage, useWire } from '../../hooks/useGraphSignal'
import { useParams } from '../../hooks/useParams'
import { useSignalStore } from '../../store/signalStore'
import { humOf } from '../../signal/engine'
import { outputKey } from '../../graph/graph'
import { AMP_DI_PORT } from '../../data/nodeRegistry'
import { GroundLiftButton } from './GroundLiftButton'

/** The Ground Lift row under its icon and knob (px) */
const LIFT_H = 28

const Icon = NODE_LOOK['guitar-amp'].icon

/**
 * Guitar Amp: fed a guitar (an Instrument, or a DI Box's Direct Out), it plays it in the room. Like
 * the Active Speaker: a big icon and its Volume knob, at every zoom (its meter in dB SPL — D13); fed a
 * digital signal, a note says so (conditions.tsx). Its Sound reaches only a microphone placed in
 * front of it (a wire of sound waves); its DI Out goes to the desk, with a Ground Lift under the knob
 * — lit red while its DI Out hums (D26).
 */
export function GuitarAmpNode({ id }: CardProps) {
  const condition        = useStage(id)?.condition
  const p                = useParams(id, 'guitar-amp')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const hum              = isFinite(humOf(useWire(outputKey(id, AMP_DI_PORT))))
  const lift = (
    <div style={{ height: LIFT_H, display: 'flex', alignItems: 'center', fontSize: 'var(--node-text-sm)' }}>
      <GroundLiftButton on={p('groundLift')} hum={hum} onToggle={() => updateNodeParams(id, { groundLift: !p('groundLift') })} />
    </div>
  )
  return (
    <FaceCard
      nodeId={id}
      typeKey="guitar-amp"
      label={useNodeName(id, 'guitar-amp')}
      art={(box) => {
        const face = (h: number) => (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <VolumeFace nodeId={id} typeKey="guitar-amp" icon={<Icon />} box={{ w: box.w, h: h - LIFT_H }} />
            {lift}
          </div>
        )
        return condition ? <ConditionNote condition={condition} typeKey="guitar-amp" box={box} face={face} /> : face(box.h)
      }}
    />
  )
}
