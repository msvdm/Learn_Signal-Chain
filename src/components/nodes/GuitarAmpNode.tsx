import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { VolumeFace } from './VolumeFace'

const Icon = NODE_LOOK['guitar-amp'].icon

/**
 * Guitar Amp: fed a guitar (an Instrument, or a DI Box's Direct Out), it plays it in the room. Like
 * the Active Speaker: a big icon and its Volume knob, at every zoom (no level — D11). Its Sound
 * reaches only a microphone placed in front of it (a dotted wire).
 */
export function GuitarAmpNode({ id }: CardProps) {
  return (
    <NodeWrapper
      nodeId={id}
      typeKey="guitar-amp"
      label={useNodeName(id, 'guitar-amp')}
      faceOnly
      overviewArt={(box) => <VolumeFace nodeId={id} typeKey="guitar-amp" icon={<Icon />} box={box} />}
    />
  )
}
