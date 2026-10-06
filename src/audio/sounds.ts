import type { GeneratorSound } from '../data/nodeRegistry'
import { PEAKS_ABOVE } from '../signal/process'

// The sounds made in code: the Generator's (a sine, noise, clicks) and the hiss every powered card
// adds — as samples, an average (RMS) of 1. The other sources play loops of real sound
// (audio/loops.ts). Pure: no Web Audio, so the tests run them.

/**
 * One loop: 4 bars at 96 beats a minute. Every loop and every sound made here is this long, so a
 * whole chain repeats itself after LOOP_S and one loop of it is everything it plays
 * (scripts/make-loops.py: LOOP_S).
 */
export const LOOP_S = 10
/** A beat at 96 beats a minute */
const BEAT_S = 60 / 96
/** In a loop's file, a little of its own end before it and of its start after it (scripts/make-loops.py: PAD_S) */
export const PAD_S = 0.25

/** The Generator's tone (Hz): the usual test tone. */
export const SINE_HZ = 1000

/** A small random number generator that always gives the same numbers from the same seed (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random numbers spread like noise is (a bell curve, an average of 0 and an RMS of 1). */
function gaussian(seed: number): () => number {
  const random = seeded(seed)
  return () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
}

const rmsOf = (x: Float32Array) => {
  let sum = 0
  for (const v of x) sum += v * v
  return Math.sqrt(sum / x.length)
}

const peakOf = (x: Float32Array) => {
  let peak = 0
  for (const v of x) peak = Math.max(peak, Math.abs(v))
  return peak
}

/** `x` scaled to an RMS of 1. */
function normalized(x: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> {
  const scale = 1 / rmsOf(x)
  for (let i = 0; i < x.length; i++) x[i] *= scale
  return x
}

/** One loop of noise: white (every frequency alike, like the hiss of a circuit), an RMS of 1. */
export function whiteNoise(sampleRate: number, seed = 1): Float32Array<ArrayBuffer> {
  const next = gaussian(seed)
  return normalized(Float32Array.from({ length: Math.round(LOOP_S * sampleRate) }, next))
}

/**
 * One loop of pink noise (as much in every octave: the test noise of sound engineers), its loudest
 * moments `crestDb` above its average — the very loudest few samples are held at that.
 */
function pinkNoise(sampleRate: number, crestDb: number): Float32Array<ArrayBuffer> {
  const white = whiteNoise(sampleRate, 2026)
  const n = white.length
  const out = new Float32Array(n)
  // Paul Kellet's filter, run over the loop twice so the second time joins up with itself
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const w = white[i]
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.96900 * b2 + w * 0.1538520
      b3 = 0.86650 * b3 + w * 0.3104856
      b4 = 0.55000 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.0168980
      out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
      b6 = w * 0.115926
    }
  }
  // Hold the loudest few at the crest; holding them lowers the average a hair, so again
  for (let round = 0; round < 20; round++) {
    normalized(out)
    const most = Math.pow(10, crestDb / 20)
    if (peakOf(out) <= most * 1.0001) break
    for (let i = 0; i < n; i++) out[i] = Math.max(-most, Math.min(most, out[i]))
  }
  return normalized(out)
}

/** One loop of a steady tone at SINE_HZ: its peaks 3 dB above its average. */
function sineTone(sampleRate: number): Float32Array<ArrayBuffer> {
  const w = 2 * Math.PI * SINE_HZ / sampleRate
  return normalized(Float32Array.from({ length: Math.round(LOOP_S * sampleRate) }, (_, i) => Math.sin(w * i)))
}

/**
 * Clicks like a metronome's: a short beep on every beat, the first of each bar higher and louder,
 * silence between. How long each beep lasts is chosen so that the loudest is `crestDb` above the
 * average.
 */
function clicks(sampleRate: number, crestDb: number): Float32Array<ArrayBuffer> {
  const n = Math.round(LOOP_S * sampleRate)
  const edge = Math.round(0.001 * sampleRate)
  const make = (beepS: number) => {
    const x = new Float32Array(n)
    const length = Math.round(beepS * sampleRate)
    for (let b = 0; b < Math.round(LOOP_S / BEAT_S); b++) {
      const first = b % 4 === 0
      const at = Math.round(b * BEAT_S * sampleRate)
      const w = 2 * Math.PI * (first ? 2500 : 2000) / sampleRate
      for (let i = 0; i < length && at + i < n; i++) {
        // A millisecond to start and to stop, so it does not crackle
        const shape = Math.min(1, i / edge, (length - i) / edge)
        x[at + i] = (first ? 1 : 0.7) * shape * Math.sin(w * i)
      }
    }
    return x
  }
  // A longer beep is a louder average: halve the range until the crest is right
  let short = 0.003, long = 0.3
  let x = make(long)
  for (let i = 0; i < 40; i++) {
    const beep = (short + long) / 2
    x = make(beep)
    const crest = 20 * Math.log10(peakOf(x) / rmsOf(x))
    if (Math.abs(crest - crestDb) < 0.001) break
    if (crest > crestDb) short = beep
    else long = beep
  }
  return normalized(x)
}

const made = new Map<string, Float32Array<ArrayBuffer>>()

/** One loop of what the Generator plays, an RMS of 1 (made the first time it is asked for). */
export function generatorSound(sound: GeneratorSound, sampleRate: number): Float32Array<ArrayBuffer> {
  const key = `${sound}@${sampleRate}`
  let x = made.get(key)
  if (!x) {
    x = sound === 'sine' ? sineTone(sampleRate)
      : sound === 'noise' ? pinkNoise(sampleRate, PEAKS_ABOVE.noise)
      : clicks(sampleRate, PEAKS_ABOVE.click)
    made.set(key, x)
  }
  return x
}
