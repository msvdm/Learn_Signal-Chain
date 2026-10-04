import { useSignalStore } from '../store/signalStore'
import type { TypeKey } from '../data/nodeRegistry'
import { useTranslation } from '../i18n/useTranslation'
import { nodeName } from '../utils/nodeName'
import { useGraphSignal } from './useGraphSignal'

/** An element's name as its card shows it (nodeName): follows the wiring (Preamp, Main Fader, Balance). */
export function useNodeName(nodeId: string, typeKey: TypeKey): string {
  const { t }  = useTranslation()
  const label  = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId)?.label)
  const stage  = useGraphSignal().stages[nodeId]
  return nodeName(t, { typeKey, label }, stage)
}
