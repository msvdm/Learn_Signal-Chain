import { create } from 'zustand'
import { BITS_START, RATE_START, TONE_START } from '../converter'

// A/D and D/A conversion's settings (Deep dive, D46): its controls under the picture write them,
// its picture reads them. Kept while the app is open, not saved.

export interface ConversionSettings {
  /** Hz */
  rate: number
  bits: number
  /** A wobbly clock (its wobble the most: JITTER_MAX) */
  wobbly: boolean
  /** The tone, Hz */
  tone: number
  /** The gain from line level, dB */
  gain: number
}

export const useConversion = create<ConversionSettings & { set: (patch: Partial<ConversionSettings>) => void }>()((set) => ({
  rate: RATE_START, bits: BITS_START, wobbly: false, tone: TONE_START, gain: 0,
  set: (patch) => set(patch),
}))
