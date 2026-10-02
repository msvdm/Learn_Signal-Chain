import { useSignalStore } from '../store/signalStore'
import { MASTER_BUS_DEFAULT_ID } from '../data/levels'

/**
 * True when the learner has not placed anything yet. The fixed Master Bus that
 * Intermediate / Advanced start with does not count.
 */
export function useChainEmpty(): boolean {
  return useSignalStore((s) => s.nodes.every((n) => n.id === MASTER_BUS_DEFAULT_ID))
}
