import type { NodePort as Port, TypeKey } from '../../data/nodeRegistry'
import { useTranslation } from '../../i18n/useTranslation'
import { portName } from '../../utils/nodeName'
import { NodePort } from './NodePort'

// Pieces every element's shell draws around its controls (NodeWrapper, FreeControl; useNodeChrome)

/** The element's inputs down its left edge and outputs down its right, from the first port line. */
export function PortStack({ nodeId, typeKey, ports }: {
  nodeId: string
  typeKey: TypeKey
  ports: { inputs: Port[]; outputs: Port[] }
}) {
  const { t } = useTranslation()
  return (
    <>
      {ports.inputs.map((port, i) => (
        <NodePort key={port.id} nodeId={nodeId} portId={port.id} type="target" index={i} title={portName(t, typeKey, port.id)} />
      ))}
      {ports.outputs.map((port, i) => (
        <NodePort key={port.id} nodeId={nodeId} portId={port.id} type="source" index={i} title={portName(t, typeKey, port.id)} />
      ))}
    </>
  )
}

/** "{Element} input", above the top left corner, while the wire being drawn can land here. */
export function WireTargetBadge({ label }: { label: string }) {
  const { t, fmt } = useTranslation()
  return (
    <span
      style={{
        position: 'absolute', left: -12, top: -30,
        padding: '4px 8px', borderRadius: 6,
        background: 'var(--lsc-accent)', color: '#fff',
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {fmt(t.connecting.input, { node: label })}
    </span>
  )
}
