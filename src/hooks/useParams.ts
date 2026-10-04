import { useSignalStore } from '../store/signalStore'
import { param } from '../data/nodeRegistry'
import type { ParamKey, ParamTypes, TypeKey } from '../data/nodeRegistry'

/**
 * A card's settings: `p('thresholdDb')` is its own value, else its type's default
 * (also for the moment the card is drawn while being removed).
 */
export function useParams(nodeId: string, typeKey: TypeKey) {
  const params = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId)?.params)
  return <K extends ParamKey>(key: K): ParamTypes[K] => param({ typeKey, params: params ?? {} }, key)
}
