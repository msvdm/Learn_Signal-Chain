import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FaceCard } from './FaceCard'
import { NODE_LOOK } from './nodeLook'
import { VolumeFace } from './VolumeFace'
import { ConditionNote } from './conditions'
import { useStage } from '../../hooks/useGraphSignal'

const Icon = NODE_LOOK['guitar-amp'].icon

/**
 * Guitar Amp: fed a guitar (an Instrument, or a DI Box's Direct Out), it plays it in the room. Like
 * the Active Speaker: a big icon and its Volume knob, at every zoom (its meter in dB SPL — D13); fed a
 * digital signal, a note says so (conditions.tsx). Its Sound reaches only a microphone placed in
 * front of it (a dotted wire).
 */
export function GuitarAmpNode({ id }: CardProps) {
  const condition = useStage(id)?.condition
  return (
    <FaceCard
      nodeId={id}
      typeKey="guitar-amp"
      label={useNodeName(id, 'guitar-amp')}
      art={(box) => {
        const face = (h: number) => <VolumeFace nodeId={id} typeKey="guitar-amp" icon={<Icon />} box={{ w: box.w, h }} />
        return condition ? <ConditionNote condition={condition} typeKey="guitar-amp" box={box} face={face} /> : face(box.h)
      }}
    />
  )
}
