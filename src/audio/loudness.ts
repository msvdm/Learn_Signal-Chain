// Loudness as broadcasters and streaming services measure it (ITU-R BS.1770, EBU R128 — D38): the
// sound weighted the way the ear hears it (K-weighting: a gentle lift of the highs, the lowest bass
// left out), averaged in 400 ms blocks every 100 ms, silent stretches left out (two gates), in LUFS
// (Loudness Units relative to Full Scale: like dBFS, of an average). The render K-weights the signal
// with the browser's own IIR filters (audio/chainAudio.ts); what is left here is pure.

/** K-weighting at 48 kHz, BS.1770's own coefficients: the high shelf (stage 1), then the high-pass (stage 2) */
export const K_WEIGHTING_48K = [
  { feedforward: [1.53512485958697, -2.69169618940638, 1.19839281085285], feedback: [1, -1.69065929318241, 0.73248077421585] },
  { feedforward: [1, -2, 1], feedback: [1, -1.99004745483398, 0.99007225036621] },
] as const

/** A block (s), and how often one starts (s) */
const BLOCK_S = 0.4
const STEP_S  = 0.1
/** Blocks quieter than this are left out (LUFS) … */
const ABSOLUTE_GATE = -70
/** … and those this far under the average of the rest (LU) */
const RELATIVE_GATE = 10

/** A mean square summed over the channels, as LUFS */
const lufsOf = (power: number): number => (power > 0 ? -0.691 + 10 * Math.log10(power) : -Infinity)

/**
 * The integrated loudness of a loop (LUFS): each channel's K-weighted mean square, slice by slice
 * (`sliceS` long each — a stereo signal's two channels, each counted in full). The loop repeats, so
 * the blocks run round its end into its start. −∞ when nothing is louder than the gates.
 */
export function integratedLoudness(channels: readonly Float32Array[], sliceS: number): number {
  const count = channels[0]?.length ?? 0
  const per   = Math.max(1, Math.round(BLOCK_S / sliceS))
  const step  = Math.max(1, Math.round(STEP_S / sliceS))
  if (count === 0) return -Infinity

  const blocks: number[] = []
  for (let start = 0; start < count; start += step) {
    let power = 0
    for (const c of channels) {
      let sum = 0
      for (let i = 0; i < per; i++) sum += c[(start + i) % count]
      power += sum / per
    }
    blocks.push(power)
  }

  const audible = blocks.filter((p) => lufsOf(p) > ABSOLUTE_GATE)
  if (audible.length === 0) return -Infinity
  const mean     = (ps: number[]) => ps.reduce((a, b) => a + b, 0) / ps.length
  const relative = lufsOf(mean(audible)) - RELATIVE_GATE
  const kept     = audible.filter((p) => lufsOf(p) > relative)
  return lufsOf(mean(kept))
}

/** What streaming services play everything at (LUFS): Spotify, YouTube, Apple Music, Tidal — about −14 */
export const STREAMING_LUFS = -14
