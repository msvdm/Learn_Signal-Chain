import { useStage } from './useGraphSignal'
import { SILENT_WIRE, healthOf, levelOf } from '../signal/engine'

/**
 * Input / output levels (the averages) for a node's meters.
 * Mono: `in` / `out` are the levels, `inR` / `outR` are undefined (one bar each).
 * Stereo (a stereo wire comes in / goes out): `in` / `out` are the left side,
 * `inR` / `outR` the right side (two bars each).
 * `inLevel` is the louder input side — what a linked stereo compressor or gate reacts to.
 * `inHealth` / `outHealth`: clipping when the peaks reach the ceiling, else from the average — the
 * same as the card the signal comes from and the wire between them.
 */
export function useStereoLevels(id: string) {
  const stage    = useStage(id)
  const arriving = stage?.in ?? SILENT_WIRE
  const leaving  = stage?.out ?? SILENT_WIRE
  const stereoIn = arriving.kind === 'stereo'
  const stereo   = leaving.kind === 'stereo'
  const inDomain = stage?.inDomain ?? 'analog'
  return {
    stereo,
    /** Analog (dBu) or digital (dBFS), arriving and leaving — an ADC / DAC changes it */
    inDomain,
    outDomain: stage?.domain ?? 'analog',
    in: arriving.l.rms, inR: stereoIn ? arriving.r.rms : undefined, inLevel: levelOf(arriving),
    out: leaving.l.rms, outR: stereo ? leaving.r.rms : undefined,
    inHealth:  healthOf(arriving, inDomain),
    outHealth: stage?.health ?? 'too-quiet',
  }
}
