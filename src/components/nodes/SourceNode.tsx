import type { NodeProps, Node } from '@xyflow/react'
import { MicrophoneNode } from './MicrophoneNode'
import { LineInputNode } from './LineInputNode'
import { InstrumentNode } from './InstrumentNode'
import type { ChannelNodeData } from './nodeTypes'

export function SourceNode(props: NodeProps<Node<ChannelNodeData>>) {
  switch (props.data.sourceType) {
    case 'line':       return <LineInputNode {...props} />
    case 'instrument': return <InstrumentNode {...props} />
    case 'mic':
    default:           return <MicrophoneNode {...props} />
  }
}
