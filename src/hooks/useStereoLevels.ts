import { useGraphSignal } from './useGraphSignal'
import { SILENT_WIRE, levelOf } from '../signal/engine'

/**
 * Input / output levels for a node's meters.
 * Mono: `in` / `out` are the levels, `inR` / `outR` are undefined (one bar each).
 * Stereo (a stereo wire comes in / goes out): `in` / `out` are the left side,
 * `inR` / `outR` the right side (two bars each).
 * `inPeak` is the louder input side — what a linked stereo compressor or gate reacts to.
 */
export function useStereoLevels(id: string) {
  const stage    = useGraphSignal().stages[id]
  const arriving = stage?.in ?? SILENT_WIRE
  const leaving  = stage?.out ?? SILENT_WIRE
  const stereoIn = arriving.kind === 'stereo'
  const stereo   = leaving.kind === 'stereo'
  return {
    stereo,
    /** Analog (dBu) or digital (dBFS), arriving and leaving — an ADC / DAC changes it */
    inDomain:  stage?.inDomain ?? 'analog',
    outDomain: stage?.domain ?? 'analog',
    in: arriving.l, inR: stereoIn ? arriving.r : undefined, inPeak: levelOf(arriving),
    out: leaving.l, outR: stereo ? leaving.r : undefined,
  }
}
