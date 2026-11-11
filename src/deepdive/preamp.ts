// Mic preamp's maths (Deep dive, D46), pure: one transistor on a ±9 V power supply makes the
// microphone's ±2 mV (Magnetic induction's: +2 mV at 0°) into line level. A small change at its base
// changes the current through it; a resistor above it (COLLECTOR_OHMS) turns the current's changes
// into a voltage — upside down; the gain knob, the resistor under it, sets how much bigger. The levels
// are the canvas's: dBu of the average, clipping judged on the peaks (+20 dBu: signal/levels.ts), so
// the output stops at ±7.75 V, where a peak reaches +20 dBu. Everything is worked out over one cycle
// of the phase, so the scene's painter only reads tables (`preampCycle`).

import { CLIP_DBU } from '../signal/levels'
import { TAU, clamp } from './wave'

/** The power supply's two sides, ± volts */
export const RAIL = 9
/** 0 dBu: an average of 0.775 V */
export const DBU_VOLTS = Math.sqrt(0.6)
/** The microphone's voltage at its peak (±2 mV) */
export const IN_PEAK = 0.002
/** As far as the output goes: a peak of +20 dBu (the canvas's clip level), 1.25 V short of each side */
export const SWING_MAX = DBU_VOLTS * Math.pow(10, CLIP_DBU / 20)
/** The resistor above the transistor: its current's changes × this are the output's voltage */
export const COLLECTOR_OHMS = 9000
/** The current through the transistor while nothing plays: the + side over that resistor, 1 mA */
export const RESTING = RAIL / COLLECTOR_OHMS

/** The gains the knob can be set to, dB: too little, line level, too much, far too much */
export const GAIN_STEPS = { gain10: 10, gain54: 54, gain70: 70, gain80: 80 } as const
export type GainId = keyof typeof GAIN_STEPS
/** Line level: the gain the steps before the knob show (the microphone's −54.8 dBu to −0.8 dBu) */
export const LINE_GAIN: GainId = 'gain54'

const times = (db: number) => Math.pow(10, db / 20)

/** What the transistor should give at phase `r` (radians) with this gain: the input × the gain, upside down */
export function wantedAt(r: number, gainDb: number): number {
  return -times(gainDb) * IN_PEAK * Math.cos(r)
}

/** The output's voltage: the wanted one, but never past ±SWING_MAX (the tops cut off: clipping) */
export function outputAt(r: number, gainDb: number): number {
  return clamp(wantedAt(r, gainDb), -SWING_MAX, SWING_MAX)
}

/** The current through the transistor (amperes) for an output voltage: what the resistor above it lets through from the + side */
export function currentFor(out: number): number {
  return (RAIL - out) / COLLECTOR_OHMS
}

/** Samples a cycle: a point every half degree, the last one (360°) the same as the first */
export const SAMPLES = 720

export interface PreampCycle {
  gainDb: number
  /** The output's voltage, what it should have been, the transistor's current */
  out: Float64Array
  wanted: Float64Array
  current: Float64Array
  /** How far the charges have moved along the transistor's wire since 0°: 0 … 1 at 360° (a share of the cycle's whole) */
  moved: Float64Array
}

const cycles = new Map<number, PreampCycle>()

/** The preamp over one cycle at this gain (made once, then kept). */
export function preampCycle(gainDb: number): PreampCycle {
  const kept = cycles.get(gainDb)
  if (kept) return kept
  const n = SAMPLES + 1, step = TAU / SAMPLES
  const c: PreampCycle = {
    gainDb, out: new Float64Array(n), wanted: new Float64Array(n), current: new Float64Array(n), moved: new Float64Array(n),
  }
  for (let i = 0; i < n; i++) {
    c.out[i] = outputAt(i * step, gainDb)
    c.wanted[i] = wantedAt(i * step, gainDb)
    c.current[i] = currentFor(c.out[i])
  }
  let moved = 0
  for (let i = 1; i < n; i++) {
    moved += ((c.current[i] + c.current[i - 1]) / 2) * step
    c.moved[i] = moved
  }
  for (let i = 0; i < n; i++) c.moved[i] /= moved
  cycles.set(gainDb, c)
  return c
}

/** A level as the canvas reads it, dBu: the average (rms) and the peaks */
export interface Levels { rms: number; peak: number }

const dbu = (volts: number) => 20 * Math.log10(volts / DBU_VOLTS)

/** A table's levels over its cycle (its last point is its first again) */
export function levelsOf(table: Float64Array): Levels {
  let power = 0, peak = 0
  for (let i = 0; i < SAMPLES; i++) {
    power += table[i] * table[i]
    peak = Math.max(peak, Math.abs(table[i]))
  }
  return { rms: dbu(Math.sqrt(power / SAMPLES)), peak: dbu(peak) }
}

/** The microphone's levels: a sine of ±2 mV */
export const MIC_LEVELS: Levels = { rms: dbu(IN_PEAK / Math.SQRT2), peak: dbu(IN_PEAK) }
