import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { getPorts, isMatrixSource, MATRIX_PORT, MULTI_WIRE_TYPES } from '../data/nodeRegistry'
import type { WireSource } from '../store/signalStore'

// Inputs are created at runtime (one per connected channel + one free slot)
export const DYNAMIC_INPUT_TYPES = new Set(['audio-interface'])

type TargetNode = Pick<SignalNode, 'id' | 'typeKey' | 'params'>

/**
 * True when this input port can take one more wire.
 * Bus inputs (Master, Aux) accept any number of wires — just not the same wire twice.
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
  if (MULTI_WIRE_TYPES.has(node.typeKey) || DYNAMIC_INPUT_TYPES.has(node.typeKey)) {
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
  if (DYNAMIC_INPUT_TYPES.has(targetNode.typeKey)) return true
  return getPorts(targetNode).inputs.some((p) => portAcceptsWire(targetNode, p.id, edges, source))
}
