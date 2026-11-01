import { useSignalStore } from '../store/signalStore'

/** True when the learner has not placed anything on the canvas yet. */
export function useChainEmpty(): boolean {
  return useSignalStore((s) => s.nodes.length === 0)
}
