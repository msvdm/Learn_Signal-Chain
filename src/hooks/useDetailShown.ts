import { useSignalStore } from '../store/signalStore'
import { DETAIL_LEVEL, atLeast } from '../data/levels'

/** Do the meters show the peaks and the noise, move, and give their Peak / RMS / Noise numbers? From Intermediate up. */
export function useDetailShown(): boolean {
  return useSignalStore((s) => atLeast(s.complexityLevel, DETAIL_LEVEL))
}
