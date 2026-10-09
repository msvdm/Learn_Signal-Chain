import { useSignalStore } from '../store/signalStore'
import { param } from '../data/nodeRegistry'
import { graphOf } from '../graph/graph'
import type { ParamKey, ParamTypes, SignalNode, TypeKey } from '../data/nodeRegistry'

/**
 * A card's settings as the pure helpers take them (`param`, signal/gains.ts): its type and its
 * params — none yet for the moment the card is drawn while being removed.
 */
export function useSettings(nodeId: string, typeKey: TypeKey): Pick<SignalNode, 'typeKey' | 'params'> {
  const params = useSignalStore((s) => graphOf(s).node(nodeId)?.params)
  return { typeKey, params: params ?? {} }
}

/**
 * A card's settings: `p('thresholdDb')` is its own value, else its type's default
 * (also for the moment the card is drawn while being removed).
 */
export function useParams(nodeId: string, typeKey: TypeKey) {
  const settings = useSettings(nodeId, typeKey)
  return <K extends ParamKey>(key: K): ParamTypes[K] => param(settings, key)
}
