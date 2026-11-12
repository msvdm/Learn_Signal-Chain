// Analogue amplification's power stage (Deep dive, D46), pure: the line level the preamp gives
// (preamp.ts: the microphone's ±10 mV made ±1 V) made into an 8 Ω speaker's ±10 V on a ±12 V power
// supply. First its Volume knob, which only turns the line level down (as on the front of a real
// power amplifier); then the voltage, always 10 times bigger; then two transistors that add the
// current: one from the + side to the speaker (it pushes), one from the speaker to the − side (it
// pulls). The classes differ only in the current they let through while nothing plays (`RESTING`).
// It takes whatever the preamp gives: a hotter line level, or the Volume turned up, is cut off a volt
// short of the sides; a line out already clipped stays clipped, however low the Volume. Everything is
// worked out over one cycle of the phase, so the scene's painter only reads tables (`ampCycle`).

import { TAU, clamp } from './wave'
import { IN_PEAK as MIC_PEAK, LINE_GAIN, SAMPLES, preampCycle, timesOf, toAndFro } from './preamp'

/** The power supply's two sides, ± volts */
export const RAIL = 12
/** The speaker, ohms */
export const LOAD = 8
/** The line level it is made for: the preamp's output with its knob at line level, ±1 V at its peak */
export const LINE_PEAK = MIC_PEAK * timesOf(LINE_GAIN)
/** The speaker's voltage at its peak, fed that line level with the Volume full */
export const OUT_PEAK = 10
/** How many times bigger the voltage comes out: 10 V / 1 V (said as × 10, +20 dB) */
export const GAIN = OUT_PEAK / LINE_PEAK
export const GAIN_DB = 20 * Math.log10(GAIN)
/** The speaker's current at that peak */
export const PEAK_CURRENT = OUT_PEAK / LOAD
/** What a transistor's base needs above its emitter before it lets anything through */
export const VBE = 0.6
/** As close to a side as the output comes: the transistor itself keeps about a volt */
export const SWING_MAX = RAIL - 1
/** A microphone preamp's input (a usual 2 kΩ): the microphone's power goes into it */
export const MIC_INPUT_OHMS = 2000

/** The Volume knob's range, dB, in whole dB: off at its bottom, full (0 dB: the line level as it comes) at its top */
export const VOLUME_OFF = -40, VOLUME_FULL = 0
/** A place the Volume knob can be at: whole dB, within its range */
export const volumeOf = (db: number) => Math.round(clamp(db, VOLUME_OFF, VOLUME_FULL))
/** How much of the line level the Volume lets through: none at its bottom */
export const volumeTimes = (db: number) => (db <= VOLUME_OFF ? 0 : Math.pow(10, db / 20))

export type AmpClass = 'a' | 'b' | 'ab'

/**
 * The current through both transistors while nothing plays, amperes. Class A: half the peak
 * current, the least that keeps both open all the way round at line level; class AB a usual 50 mA;
 * B none.
 */
export const RESTING: Record<AmpClass, number> = { a: PEAK_CURRENT / 2, b: 0, ab: 0.05 }

/** What the amplifier should give for a line voltage, the Volume at `volumeDb`: that share of it, 10 times bigger */
export const wantedFor = (line: number, volumeDb = VOLUME_FULL) => GAIN * volumeTimes(volumeDb) * line

/**
 * The speaker's voltage for the voltage wanted. Two transistors in class B open only past VBE —
 * their drive is that much bigger, so the peaks still reach what was wanted — and give nothing in
 * between (the notch); A and AB copy it. None goes past SWING_MAX (the tops cut off: clipping).
 */
export function outputFor(wanted: number, cls: AmpClass): number {
  if (cls !== 'b') return clamp(wanted, -SWING_MAX, SWING_MAX)
  const drive = (wanted * (OUT_PEAK + VBE)) / OUT_PEAK
  return clamp(Math.sign(drive) * Math.max(0, Math.abs(drive) - VBE), -SWING_MAX, SWING_MAX)
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

/** One cycle of the power stage, a point every half degree (SAMPLES + 1 points) */
export interface AmpCycle {
  cls: AmpClass
  /** The Volume knob, dB */
  volumeDb: number
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

/** The cycles made, by the line out they are fed (a preamp's table, itself kept), then by class and Volume — only the last few of each */
const cycles = new WeakMap<Float64Array, Map<string, AmpCycle>>()
const KEPT = 24

/**
 * The power stage over one cycle, in this class, fed `line` (a preamp's output, `preampCycle(…).out`:
 * the clean chip at line level if none is given), its Volume at `volumeDb`.
 */
export function ampCycle(cls: AmpClass, line: Float64Array = preampCycle(LINE_GAIN).out, volumeDb = VOLUME_FULL): AmpCycle {
  const key = `${cls}:${volumeDb}`
  let made = cycles.get(line)
  if (!made) cycles.set(line, (made = new Map()))
  const kept = made.get(key)
  if (kept) return kept
  const n = SAMPLES + 1
  const c: AmpCycle = {
    cls, volumeDb,
    out: new Float64Array(n), wanted: new Float64Array(n),
    upper: new Float64Array(n), lower: new Float64Array(n),
    upperHeat: new Float64Array(n), lowerHeat: new Float64Array(n),
    upperMoved: new Float64Array(n), lowerMoved: new Float64Array(n), speakerMoved: new Float64Array(n),
  }
  const step = TAU / SAMPLES
  for (let i = 0; i < n; i++) {
    const wanted = wantedFor(line[i], volumeDb), out = outputFor(wanted, cls)
    const { upper, lower } = transistorCurrents(out, RESTING[cls])
    c.out[i] = out
    c.wanted[i] = wanted
    c.upper[i] = upper
    c.lower[i] = lower
    c.upperHeat[i] = (RAIL - out) * upper
    c.lowerHeat[i] = (out + RAIL) * lower
  }
  // The charges moved: the currents added up over the cycle (trapezoids)
  let up = 0, low = 0
  for (let i = 1; i < n; i++) {
    up  += ((c.upper[i] + c.upper[i - 1]) / 2) * step
    low += ((c.lower[i] + c.lower[i - 1]) / 2) * step
    c.upperMoved[i] = up
    c.lowerMoved[i] = low
  }
  for (let i = 0; i < n; i++) {
    c.upperMoved[i] = up > 0 ? c.upperMoved[i] / up : 0
    c.lowerMoved[i] = low > 0 ? c.lowerMoved[i] / low : 0
  }
  toAndFro(c.out.map((v) => v / LOAD), c.speakerMoved)
  if (made.size >= KEPT) made.clear()
  made.set(key, c)
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
    microphone: (MIC_PEAK * MIC_PEAK) / 2 / MIC_INPUT_OHMS,
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

/** The harmonics an amplifier added, as a share of the first (THD: their powers added up, against the first's) — none for silence. */
export function distortionOf(harmonics: readonly number[]): number {
  const added = harmonics.slice(1).reduce((sum, h) => sum + h * h, 0)
  return harmonics[0] > 0 ? Math.sqrt(added) / harmonics[0] : 0
}
