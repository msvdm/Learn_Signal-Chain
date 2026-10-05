import { useSignalStore } from '../store/signalStore'
import { READINGS_LEVEL, atLeast } from '../data/levels'

/** Do the meters show the peaks and the noise, and the cards their readings? From Intermediate up. */
export function useReadingsShown(): boolean {
  return useSignalStore((s) => atLeast(s.complexityLevel, READINGS_LEVEL))
}
