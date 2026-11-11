// Analogue amplification's maths (Deep dive, D46), pure: one amplifier from a microphone to an
// 8 Ω speaker on a ±12 V power supply. Its last stage is two transistors, one from the + side to the
// speaker (it pushes), one from the speaker to the − side (it pulls); the classes differ only in the
// current they let through while nothing plays (`RESTING`). Everything is worked out over one cycle
// of the phase, so the scene's painter only reads tables (`ampCycle`).

import { TAU, clamp } from './wave'

/** The power supply's two sides, ± volts */
export const RAIL = 12
/** The speaker, ohms */
export const LOAD = 8
/** The microphone's voltage at its peak, as in Transducer and speaker (±2 mV) */
export const IN_PEAK = 0.002
/** The speaker's voltage at its peak when the amplifier copies it cleanly */
export const OUT_PEAK = 10
/** How many times bigger the voltage comes out: 10 V / 2 mV */
export const GAIN = OUT_PEAK / IN_PEAK
export const GAIN_DB = 20 * Math.log10(GAIN)
/** The speaker's current at the peak */
export const PEAK_CURRENT = OUT_PEAK / LOAD
/** What a transistor's base needs above its emitter before it lets anything through */
export const VBE = 0.6
/** As close to a side as the output comes: the transistor itself keeps about a volt */
export const SWING_MAX = RAIL - 1
/** A microphone preamp's input (a usual 2 kΩ): the microphone's power goes into it */
export const MIC_INPUT_OHMS = 2000

/** `one`: a transistor alone, pushing only (the transistor's step); then the three classes */
export type AmpClass = 'one' | 'a' | 'b' | 'ab'

/**
 * The current through both transistors while nothing plays, amperes. Class A: half the peak
 * current, the least that keeps both open all the way round; class AB a usual 50 mA; one and B none.
 */
export const RESTING: Record<AmpClass, number> = { one: 0, a: PEAK_CURRENT / 2, b: 0, ab: 0.05 }

/** What the last step can show: the amplifier pushed, or class B's notch */
export type Distortion = 'clean' | 'rounded' | 'oneSided' | 'flat' | 'notch'

/** How much harder the input is pushed for rounded and flat tops */
const PUSH: Partial<Record<Distortion, number>> = { rounded: 1.4, flat: 2 }
/** One side bending: the output's square, a share of it — its 2nd harmonic 6 % of the first */
const BEND = 0.12

/** The class the last step's shape is played in: class B for the notch, AB for the rest */
export const classOf = (distortion: Distortion): AmpClass => (distortion === 'notch' ? 'b' : 'ab')

/** What the amplifier should give at phase `r` (radians): the input × the gain (pushed harder for rounded and flat tops) */
export function wantedAt(r: number, distortion: Distortion = 'clean'): number {
  return (PUSH[distortion] ?? 1) * OUT_PEAK * Math.cos(r)
}

/**
 * The speaker's voltage at phase `r` (radians; the microphone's voltage is IN_PEAK × cos r). A
 * transistor alone or two in class B open only past VBE — their drive is that much bigger, so the
 * peaks still reach OUT_PEAK — and give nothing in between (the notch); A and AB copy cleanly.
 */
export function outputAt(r: number, cls: AmpClass, distortion: Distortion = 'clean'): number {
  if (cls === 'one' || cls === 'b') {
    const drive = (OUT_PEAK + VBE) * Math.cos(r)
    const open = Math.max(0, Math.abs(drive) - VBE)
    return cls === 'one' ? (drive > 0 ? open : 0) : Math.sign(drive) * open
  }
  const w = wantedAt(r, distortion)
  switch (distortion) {
    // The transistors' curve bends as they near a side: the tops round off
    case 'rounded':  return SWING_MAX * Math.tanh(w / SWING_MAX)
    // One side bends more than the other (its average taken away: no steady voltage reaches the speaker)
    case 'oneSided': return w - (BEND * (w * w - (OUT_PEAK * OUT_PEAK) / 2)) / OUT_PEAK
    // No further than the sides: flat tops
    case 'flat':     return clamp(w, -SWING_MAX, SWING_MAX)
    default:         return w
  }
}

/**
 * The two transistors' currents (amperes, never below 0) giving the speaker `out` volts: the upper
 * one's from the + side, the lower one's to the − side. Within ±2 × the resting current both are
 * open, sharing the speaker's current; past it the other is shut.
 */
export function transistorCurrents(out: number, resting: number): { upper: number; lower: number } {
  const speaker = out / LOAD
  if (Math.abs(speaker) >= 2 * resting) return { upper: Math.max(speaker, 0), lower: Math.max(-speaker, 0) }
  return { upper: resting + speaker / 2, lower: resting - speaker / 2 }
}

/** Samples a cycle: a point every half degree, the last one (360°) the same as the first */
export const SAMPLES = 720

/** One cycle of the amplifier, a point every half degree (SAMPLES + 1 points) */
export interface AmpCycle {
  cls: AmpClass
  /** The speaker's voltage; what it should have been */
  out: Float64Array
  wanted: Float64Array
  /** The transistors' currents */
  upper: Float64Array
  lower: Float64Array
  /** The heat each transistor gives, watts (the voltage across it × its current) */
  upperHeat: Float64Array
  lowerHeat: Float64Array
  /**
   * How far the charges have moved since 0°, along the upper transistor's wire and the lower one's
   * (0 … 1 at 360°: a share of the cycle's whole), and to and fro on the speaker's (amperes ×
   * radians, its average taken away — 0 at 0° and 360°)
   */
  upperMoved: Float64Array
  lowerMoved: Float64Array
  speakerMoved: Float64Array
}

const cycles = new Map<string, AmpCycle>()

/** The amplifier over one cycle, in this class with this shape (made once, then kept). */
export function ampCycle(cls: AmpClass, distortion: Distortion = 'clean'): AmpCycle {
  const key = `${cls}:${distortion}`
  const kept = cycles.get(key)
  if (kept) return kept
  const n = SAMPLES + 1
  const c: AmpCycle = {
    cls,
    out: new Float64Array(n), wanted: new Float64Array(n),
    upper: new Float64Array(n), lower: new Float64Array(n),
    upperHeat: new Float64Array(n), lowerHeat: new Float64Array(n),
    upperMoved: new Float64Array(n), lowerMoved: new Float64Array(n), speakerMoved: new Float64Array(n),
  }
  const step = TAU / SAMPLES
  for (let i = 0; i < n; i++) {
    const r = i * step, out = outputAt(r, cls, distortion)
    const { upper, lower } = cls === 'one' ? { upper: out / LOAD, lower: 0 } : transistorCurrents(out, RESTING[cls])
    c.out[i] = out
    c.wanted[i] = wantedAt(r, distortion)
    c.upper[i] = upper
    c.lower[i] = lower
    c.upperHeat[i] = (RAIL - out) * upper
    c.lowerHeat[i] = (out + RAIL) * lower
  }
  // The charges moved: the currents added up over the cycle (trapezoids)
  let up = 0, low = 0, spk = 0
  for (let i = 1; i < n; i++) {
    up  += ((c.upper[i] + c.upper[i - 1]) / 2) * step
    low += ((c.lower[i] + c.lower[i - 1]) / 2) * step
    spk += ((c.out[i] + c.out[i - 1]) / 2 / LOAD) * step
    c.upperMoved[i] = up
    c.lowerMoved[i] = low
    c.speakerMoved[i] = spk
  }
  for (let i = 0; i < n; i++) {
    c.upperMoved[i] = up > 0 ? c.upperMoved[i] / up : 0
    c.lowerMoved[i] = low > 0 ? c.lowerMoved[i] / low : 0
  }
  // To and fro: the speaker's current has no average, but a sampled one leaves a trace of it
  const drift = spk / SAMPLES
  for (let i = 0; i < n; i++) c.speakerMoved[i] -= drift * i
  cycles.set(key, c)
  return c
}

/** A table's value at a phase (degrees, 0 … 360), between its samples. */
export function at(table: Float64Array, deg: number): number {
  const x = clamp(deg, 0, 360) * (SAMPLES / 360), i = Math.min(Math.floor(x), SAMPLES - 1), f = x - i
  return table[i] + (table[i + 1] - table[i]) * f
}

/** The average of a table over its cycle (its last point is its first again). */
function mean(table: Float64Array): number {
  let sum = 0
  for (let i = 0; i < SAMPLES; i++) sum += table[i]
  return sum / SAMPLES
}

/** Where the power goes, watts, at the cycle's level — and while nothing plays */
export interface Powers {
  /** From the power supply: both sides' voltage × the current drawn from them */
  supply: number
  /** Into the speaker */
  speaker: number
  /** Lost in the transistors, as heat: what the supply gives and the speaker does not take */
  heat: number
  /** The heat while nothing plays: the resting current through both, from side to side */
  silentHeat: number
  /** The microphone's own power, into the preamp's input */
  microphone: number
}

export function powersOf(c: AmpCycle): Powers {
  const supply = RAIL * (mean(c.upper) + mean(c.lower))
  const speaker = mean(c.out.map((v) => v * v)) / LOAD
  return {
    supply, speaker, heat: supply - speaker,
    silentHeat: 2 * RAIL * RESTING[c.cls],
    microphone: (IN_PEAK * IN_PEAK) / 2 / MIC_INPUT_OHMS,
  }
}

/** The average current through the upper transistor and the lower one over the cycle, amperes */
export function meanCurrents(c: AmpCycle): { upper: number; lower: number } {
  return { upper: mean(c.upper), lower: mean(c.lower) }
}

/**
 * The sines a cycle is made of: how big the 1st to the `count`-th are (volts at their peak) —
 * the output's harmonics, from a Fourier sum over its samples.
 */
export function harmonicsOf(table: Float64Array, count = 10): number[] {
  return Array.from({ length: count }, (_, k) => {
    const h = k + 1
    let re = 0, im = 0
    for (let i = 0; i < SAMPLES; i++) {
      const r = (i * TAU * h) / SAMPLES
      re += table[i] * Math.cos(r)
      im += table[i] * Math.sin(r)
    }
    return (2 / SAMPLES) * Math.hypot(re, im)
  })
}

/** The harmonics an amplifier added, as a share of the first (THD: their powers added up, against the first's). */
export function distortionOf(harmonics: readonly number[]): number {
  const added = harmonics.slice(1).reduce((sum, h) => sum + h * h, 0)
  return Math.sqrt(added) / harmonics[0]
}
