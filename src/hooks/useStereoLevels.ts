import { useGraphSignal } from './useSignalChain'
import { useSignalStore } from '../store/signalStore'
import { isNodeStereo } from '../data/nodeRegistry'

/**
 * Input / output levels for a node's meters.
 * Mono: `in` / `out` are the levels, `inR` / `outR` are undefined (one bar each).
 * Stereo: `in` / `out` are the left side, `inR` / `outR` the right side (two bars each).
 * `inPeak` is the louder input side — what a linked stereo compressor or gate reacts to.
 */
export function useStereoLevels(id: string) {
  const { stages, inputDb } = useGraphSignal()
  const stereo = useSignalStore((s) => {
    const node = s.nodes.find((n) => n.id === id)
    return node ? isNodeStereo(node) : false
  })
  const stage = stages[id]

  if (!stereo) {
    const input = inputDb[id] ?? -Infinity
    return {
      stereo, in: input, inR: undefined, inPeak: input,
      out: stage?.out ?? -Infinity, outR: undefined,
    }
  }
  const inL = stage?.inL ?? -Infinity
  const inR = stage?.inR ?? -Infinity
  return {
    stereo, in: inL, inR, inPeak: Math.max(inL, inR),
    out: stage?.outL ?? -Infinity, outR: stage?.outR ?? -Infinity,
  }
}
