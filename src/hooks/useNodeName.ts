import { useSignalStore } from '../store/signalStore'
import type { TypeKey } from '../data/nodeRegistry'
import { useTranslation } from '../i18n/useTranslation'
import { nodeName } from '../utils/nodeName'
import { graphOf } from '../graph/graph'
import { graphSignal } from '../signal/engine'

/** An element's name as its card shows it (nodeName): follows the wiring (Preamp, Main Fader, Balance). */
export function useNodeName(nodeId: string, typeKey: TypeKey): string {
  const { t }  = useTranslation()
  const label  = useSignalStore((s) => graphOf(s).node(nodeId)?.label)
  const role   = useSignalStore((s) => graphSignal(s.nodes, s.edges).stages[nodeId]?.role)
  return nodeName(t, { typeKey, label }, { role })
}
