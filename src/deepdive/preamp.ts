// Analogue amplification's first stage (Deep dive, D46), pure: a mic preamp. The microphone gives
// ±10 mV (a loud singer close to a dynamic microphone: about 105 dB SPL at its ~1.9 mV a pascal),
// between two wires — pin 2 and pin 3 of its XLR, pin 1 the cable's shield at 0 V. A mains cable
// lying across the microphone's puts a hum on the wires; balanced, the same hum on both, so the
// difference between them — the sound — has none. Unbalanced (one wire and the shield), the hum is
// in the sound. The preamp amplifies that difference. Two ways:
//   · the clean chip (as the THAT1510): its two input transistors, steered by pin 2 and pin 3, and a
//     resistor between them, the gain knob — gain = 1 + 10 kΩ ÷ RG, exactly, until the output meets
//     its sides. The ideal amplifier: it adds nothing to the sound.
//   · the transformer input (as on classic desks): a transformer ×10, then one transistor, a
//     resistor pulling it up to the + side, the gain knob as the resistor below it. The transformer
//     bends a little, the transistor more as it is driven harder: new sines in the sound.
// The levels are the canvas's: dBu of the average, clipping judged on the peaks (+20 dBu:
// signal/levels.ts), so the output stops at ±7.75 V, where a peak reaches +20 dBu. Everything is
// worked out over one cycle of the phase, so the scene's painter only reads tables
// (`preampCycle`). The power stage after it is amp.ts.

import { CLIP_DBU } from '../signal/levels'
import { TAU, clamp } from './wave'

/** The power supply's two sides, ± volts */
export const RAIL = 9
/** 0 dBu: an average of 0.775 V */
export const DBU_VOLTS = Math.sqrt(0.6)
/** The microphone's voltage at its peak (±10 mV), between pin 2 and pin 3 */
export const IN_PEAK = 0.01
/**
 * The hum the mains cable puts on each wire: ±2 mV, six times a cycle (the mains' buzz). Far
 * stronger than a real cable picks up, so it can be seen beside the sound.
 */
export const HUM_PEAK = 0.002, HUM_TIMES = 6
/** As far as the output goes: a peak of +20 dBu (the canvas's clip level), 1.25 V short of each side */
export const SWING_MAX = DBU_VOLTS * Math.pow(10, CLIP_DBU / 20)

/** Balanced: a wire for each side of the microphone; unbalanced: one wire, and the shield for the other side */
export type Wiring = 'balanced' | 'unbalanced'
/** The clean chip, or a transformer and one transistor */
export type Input = 'chip' | 'transformer'

/**
 * The gain knob's range, dB, in whole dB: the THAT1510's 0 … +60 (RG from none to 10 Ω). With the
 * microphone's 10 mV it clips from +58
 */
export const GAIN_MIN = 0, GAIN_MAX = 60
/** Line level: the gain the knob starts at (the microphone's −40.8 dBu to −0.8 dBu) */
export const LINE_GAIN = 40
/** A gain the knob can be at: whole dB, within its range */
export const gainOf = (db: number) => Math.round(clamp(db, GAIN_MIN, GAIN_MAX))

/** How many times bigger a gain makes the voltage */
export const timesOf = (gainDb: number) => Math.pow(10, gainDb / 20)

/** The microphone's voltage at phase `r` (radians): +10 mV at 0°, as Magnetic induction's */
export const micAt = (r: number) => IN_PEAK * Math.cos(r)
/** The hum on a wire at phase `r` */
export const humAt = (r: number) => HUM_PEAK * Math.sin(HUM_TIMES * r)

/**
 * The two wires' voltages from 0 V (the shield) at phase `r`. Balanced: the microphone's voltage
 * split between them, pin 3 the other way round, the hum on both. Unbalanced: all of it on pin 2,
 * pin 3 joined to the shield — the hum only on pin 2.
 */
export function pinsAt(r: number, wiring: Wiring): { pin2: number; pin3: number } {
  const mic = micAt(r), hum = humAt(r)
  return wiring === 'balanced' ? { pin2: mic / 2 + hum, pin3: -mic / 2 + hum } : { pin2: mic + hum, pin3: 0 }
}

// ── The clean chip ──────────────────────────────────────────────────────────

/** The chip's own two resistors, 5 kΩ each, that the gain resistor's current runs through */
export const CHIP_OHMS = 10000
/** The current through each input transistor while nothing plays */
export const STAGE_CURRENT = 0.001

/** The gain resistor (RG) a gain needs: 10 kΩ ÷ (times − 1) — none (open) at 0 dB */
export function gainResistor(gainDb: number): number {
  const times = timesOf(gainDb)
  return times <= 1 ? Infinity : CHIP_OHMS / (times - 1)
}

// ── The transformer input ───────────────────────────────────────────────────

/** The transformer: 10 times as many turns on its second coil, so 10 times the voltage — with no power of its own */
export const TURNS = 10
/** Where its core starts to bend: the voltage on its first coil that would take it to the bend's middle (tanh) */
export const CORE_VOLTS = 0.09
/** The resistor pulling the transistor up to the + side; the current through it while nothing plays (1 mA: the output rests at 0 V) */
export const COLLECTOR_OHMS = 9000
/** The transistor's own voltage scale: its current grows e times for every 26 mV more at its base */
export const VT = 0.026

/** The gain knob as the resistor below the transistor: the transistor's gain is the resistor above ÷ (it + the transistor's own 26 Ω) */
export function emitterResistor(gainDb: number): number {
  return Math.max(0, COLLECTOR_OHMS / (timesOf(gainDb) / TURNS) - VT / STAGE_CURRENT)
}

/** The transformer's second coil for a difference `diff` on its first: 10 times, bending gently near CORE_VOLTS */
export const transformerOut = (diff: number) => TURNS * CORE_VOLTS * Math.tanh(diff / CORE_VOLTS)

/**
 * The transistor's current for a voltage `base` at its base (from where it rests), with `re` below
 * it: base = VT · ln(I / I₀) + (I − I₀) · re — what it takes from its base and from the resistor
 * below, solved (Newton, on ln(I / I₀)).
 */
export function transistorCurrent(base: number, re: number): number {
  let x = 0
  for (let k = 0; k < 40; k++) {
    const e = Math.exp(x)
    const step = (VT * x + STAGE_CURRENT * (e - 1) * re - base) / (VT + STAGE_CURRENT * e * re)
    x -= clamp(step, -2, 2)
    if (Math.abs(step) < 1e-12) break
  }
  return STAGE_CURRENT * Math.exp(x)
}

// ── One cycle ───────────────────────────────────────────────────────────────

/** Samples a cycle: a point every half degree, the last one (360°) the same as the first */
export const SAMPLES = 720

export interface PreampCycle {
  gainDb: number
  wiring: Wiring
  input: Input
  /** The two wires; what the preamp takes (pin 2 − pin 3) */
  pin2: Float64Array
  pin3: Float64Array
  diff: Float64Array
  /** The output's voltage, and what it should have been (the difference × the gain) */
  out: Float64Array
  wanted: Float64Array
  /** The chip: each input transistor's current (pin 2's, pin 3's) and the gain resistor's between them; the transformer: its transistor's (in `currentA`) */
  currentA: Float64Array
  currentB: Float64Array
  gainCurrent: Float64Array
  /** How far the charges have moved down each transistor's wire since 0° (0 … 1 at 360°, a share of the cycle's whole) */
  movedA: Float64Array
  movedB: Float64Array
  /** To and fro through the gain resistor: amperes × radians, its average taken away (0 at 0° and 360°) */
  gainMoved: Float64Array
}

const cycles = new Map<string, PreampCycle>()
const KEPT = 48

/** The preamp over one cycle (made once, then kept: a knob dragged through its range makes many, so only the last few are). */
export function preampCycle(gainDb: number, wiring: Wiring = 'balanced', input: Input = 'chip'): PreampCycle {
  const key = `${gainDb}:${wiring}:${input}`
  const kept = cycles.get(key)
  if (kept) return kept
  const n = SAMPLES + 1, step = TAU / SAMPLES
  const table = () => new Float64Array(n)
  const c: PreampCycle = {
    gainDb, wiring, input,
    pin2: table(), pin3: table(), diff: table(), out: table(), wanted: table(),
    currentA: table(), currentB: table(), gainCurrent: table(), movedA: table(), movedB: table(), gainMoved: table(),
  }
  const times = timesOf(gainDb), re = emitterResistor(gainDb)
  for (let i = 0; i < n; i++) {
    const { pin2, pin3 } = pinsAt(i * step, wiring)
    const diff = pin2 - pin3
    c.pin2[i] = pin2
    c.pin3[i] = pin3
    c.diff[i] = diff
    c.wanted[i] = times * diff
    if (input === 'chip') {
      const out = clamp(times * diff, -SWING_MAX, SWING_MAX)
      // The gain resistor's current runs through the chip's 10 kΩ too: as far as the output goes, no further
      const through = (out - diff) / CHIP_OHMS
      c.out[i] = out
      c.gainCurrent[i] = through
      c.currentA[i] = STAGE_CURRENT + through
      c.currentB[i] = STAGE_CURRENT - through
    } else {
      // The second coil wired so the transistor, which turns what it gets upside down, gives it the right way up
      const current = transistorCurrent(-transformerOut(diff), re)
      c.out[i] = clamp(-(current - STAGE_CURRENT) * COLLECTOR_OHMS, -SWING_MAX, SWING_MAX)
      c.currentA[i] = current
    }
  }
  movedAlong(c.currentA, c.movedA)
  movedAlong(c.currentB, c.movedB)
  toAndFro(c.gainCurrent, c.gainMoved)
  if (cycles.size >= KEPT) cycles.clear()
  cycles.set(key, c)
  return c
}

/** A current added up over the cycle (trapezoids), as a share of the cycle's whole — all 0 for none */
function movedAlong(current: Float64Array, into: Float64Array) {
  const step = TAU / SAMPLES
  let moved = 0
  for (let i = 1; i <= SAMPLES; i++) {
    moved += ((current[i] + current[i - 1]) / 2) * step
    into[i] = moved
  }
  if (moved > 0) for (let i = 0; i <= SAMPLES; i++) into[i] /= moved
}

/** A current with no average, added up over the cycle: to and fro, back where it started at 360° */
export function toAndFro(current: ArrayLike<number>, into: Float64Array) {
  const step = TAU / SAMPLES
  let moved = 0
  into[0] = 0
  for (let i = 1; i <= SAMPLES; i++) {
    moved += ((current[i] + current[i - 1]) / 2) * step
    into[i] = moved
  }
  // A sampled current leaves a trace of an average: taken away
  const drift = moved / SAMPLES
  for (let i = 0; i <= SAMPLES; i++) into[i] -= drift * i
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

/** The microphone's levels: a sine of ±10 mV */
export const MIC_LEVELS: Levels = { rms: dbu(IN_PEAK / Math.SQRT2), peak: dbu(IN_PEAK) }
