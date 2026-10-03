import { useGraphSignal } from './useSignalChain'

/**
 * Input / output levels for a node's meters.
 * Mono: `in` / `out` are the levels, `inR` / `outR` are undefined (one bar each).
 * Stereo (a stereo wire comes in / goes out): `in` / `out` are the left side,
 * `inR` / `outR` the right side (two bars each).
 * `inPeak` is the louder input side — what a linked stereo compressor or gate reacts to.
 */
export function useStereoLevels(id: string) {
  const { stages, inputDb } = useGraphSignal()
  const stage    = stages[id]
  const stereoIn = stage?.stereoIn ?? false
  const stereo   = stage?.stereoOut ?? false

  const inL = stereoIn ? (stage?.inL ?? -Infinity) : (inputDb[id] ?? -Infinity)
  const inR = stereoIn ? (stage?.inR ?? -Infinity) : undefined
  return {
    stereo,
    /** Analog (dBu) or digital (dBFS), arriving and leaving — an ADC / DAC changes it */
    inDomain:  stage?.inDomain ?? stage?.domain ?? 'analog',
    outDomain: stage?.domain ?? 'analog',
    in: inL, inR, inPeak: Math.max(inL, inR ?? -Infinity),
    out:  stereo ? (stage?.outL ?? -Infinity) : (stage?.out ?? -Infinity),
    outR: stereo ? (stage?.outR ?? -Infinity) : undefined,
  }
}
