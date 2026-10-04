import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { MATRIX_PORT, isBus } from '../data/nodeRegistry'
import { getPorts, isMatrixSource } from '../graph/queries'
import type { WireSource } from '../store/signalStore'

type TargetNode = Pick<SignalNode, 'id' | 'typeKey' | 'params'>

/**
 * True when this input port can take one more wire.
 * Bus inputs (Master, Aux, Matrix) accept any number of wires — just not the same wire twice.
 * Every other input takes one wire.
 */
export function portAcceptsWire(
  node: TargetNode,
  handleId: string,
  edges: SignalEdge[],
  source?: WireSource,
): boolean {
  if (source && node.id === source.nodeId) return false
  const onPort = edges.filter((e) => e.target === node.id && e.targetHandle === handleId)
  if (isBus(node.typeKey)) {
    return !source || !onPort.some((e) => e.source === source.nodeId && e.sourceHandle === source.handleId)
  }
  return onPort.length === 0
}

/**
 * True when a wire from `source` may end on at least one input of `targetNode`.
 * A Matrix Bus takes mixes only, after their fader (isMatrixSource); a Matrix send feeds only Matrix Buses.
 */
export function nodeAcceptsWire(
  targetNode: TargetNode,
  source: WireSource,
  edges: SignalEdge[],
  nodes: SignalNode[],
): boolean {
  if (targetNode.id === source.nodeId) return false
  const toMatrix = targetNode.typeKey === 'matrix-bus'
  if (toMatrix && !isMatrixSource(source.nodeId, source.handleId, { nodes, edges })) return false
  if (!toMatrix && source.handleId === MATRIX_PORT) return false
  return getPorts(targetNode).inputs.some((p) => portAcceptsWire(targetNode, p.id, edges, source))
}
