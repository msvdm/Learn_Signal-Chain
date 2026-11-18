import { ALIGNMENT_DB } from '../signal/levels'
import { ditherFloorDbfs } from '../signal/formats'
import { TAU, clamp, rad } from './wave'

// Conversion (Deep dive, D46): a line-level sine into an A/D converter and out of a D/A converter,
// as the canvas aligns them (0 dBu = −18 dBFS, so 0 dBFS is a peak of +18 dBu). In order, as a real
// converter does it: the filter before it (anything near or above half the sample rate taken out),
// the clock's moments, the input stopping at full scale (no number is bigger than the biggest), the
// filter after it (inside a real converter: what clipping adds above half the sample rate is taken
// out too), each sample rounded to the nearest step of its bit depth; and back: each number held
// until the next (the steps), then smoothed (an ideal reconstruction, as the DAC's filter does).
// "No filter" is a converter without them: everything is sampled as it is, and folds back.
// Everything is a function of the phase: the tone's, at the window's left edge.

/** Full scale: the voltage of 0 dBFS (a peak of +18 dBu: 0.775 V × 10^(18/20)) */
export const FS_VOLTS = 0.775 * 10 ** (ALIGNMENT_DB / 20)
/** Where the analogue side itself stops: a peak of +20 dBu (the canvas's clip level) */
export const ANALOG_TOP = 0.775 * 10
/** A sine's peak over its average, in dB */
export const SINE_CREST_DB = 20 * Math.log10(Math.SQRT2)

/** The sample rates to pick */
export const RATES = [44100, 48000, 96000] as const
export type Rate = (typeof RATES)[number]
/** How long the picture's windows are: 0.5 ms (24 samples at 48 kHz, one cycle of 2 kHz) */
export const WINDOW_S = 0.0005

/** The tone: its knob, in whole kHz (2 kHz until the Nyquist step) */
export const TONE_MIN = 1000, TONE_MAX = 50000, TONE_START = 2000
/** The level, the sine's average in dBu: line level until the last step; at most a peak of +19 dBu (the analogue side's hot, not clipping) */
export const LEVEL_MIN = -20, LEVEL_MAX = 16, LEVEL_START = 0

/** The converter's own noise (its analogue parts'), rms under full scale: a budget one's, a good one's */
export const OWN_NOISE = { quality: -120, budget: -100 } as const
export type Grade = keyof typeof OWN_NOISE

/**
 * A wobbly clock: each sample taken up to this share of a sample's time early or late (a real one's
 * wobble is around a nanosecond — this is thousands of times bigger, to be seen)
 */
export const JITTER = 0.25

/** How many samples either side the reconstruction reaches (a Lanczos window, as good as ideal here) */
export const RECONSTRUCT_TAPS = 32

export interface Setup {
  rate: Rate
  /** Hz */
  tone: number
  /** The sine's average, dBu */
  level: number
  /** null: not rounded yet (before the bit depth's step) */
  bits: number | null
  grade: Grade
  /** The filters before and inside the converter; false: none (everything folds back) */
  filter: boolean
  jitter: boolean
}

/** A sine's peak in volts at an average of `dbu` */
export const amplitudeOf = (dbu: number) => 0.775 * Math.SQRT2 * 10 ** (dbu / 20)

/**
 * What the converter's filters let through at a frequency: all of it up to 20 kHz (at 44.1 kHz; the
 * same share of the sample rate at the others), nothing from half the sample rate, smoothly between
 */
export function passOf(freq: number, rate: number): number {
  const pass = (20000 / 44100) * rate, stop = rate / 2
  if (freq <= pass) return 1
  if (freq >= stop) return 0
  return 0.5 + 0.5 * Math.cos((Math.PI * (freq - pass)) / (stop - pass))
}

/** The biggest and smallest numbers at a bit depth, in volts: one step short of full scale on top */
export function codeRange(bits: number): { step: number; top: number; bottom: number } {
  const half = 2 ** (bits - 1), step = FS_VOLTS / half
  return { step, top: (half - 1) * step, bottom: -FS_VOLTS }
}

/** A voltage rounded to its bit depth's nearest step (the number it is written as, in volts) */
export function quantize(volts: number, bits: number): number {
  return codeOf(volts, bits) * codeRange(bits).step
}

/** The whole number a voltage is written as (two's complement) */
export function codeOf(volts: number, bits: number): number {
  const half = 2 ** (bits - 1)
  return clamp(Math.round(volts / codeRange(bits).step), -half, half - 1)
}

/** A number's bits, the biggest first (two's complement: the first is the sign) */
export function bitsOf(code: number, bits: number): boolean[] {
  const word = code < 0 ? code + 2 ** bits : code
  return Array.from({ length: bits }, (_, i) => Math.floor(word / 2 ** (bits - 1 - i)) % 2 === 1)
}

/** The noise under a converter's numbers, dBFS: its bit depth's and its own, added as powers */
export function floorOf(bits: number, grade: Grade): { bits: number; own: number; total: number } {
  const b = ditherFloorDbfs(bits), own = OWN_NOISE[grade]
  return { bits: b, own, total: 10 * Math.log10(10 ** (b / 10) + 10 ** (own / 10)) }
}

/** How early or late the clock takes sample `n`, as a share of a sample's time (the same every time) */
export function jitterOf(n: number): number {
  const u = Math.abs(Math.sin(n * 12.9898 + 78.233) * 43758.5453) % 1
  return (2 * u - 1) * JITTER
}

/** A frequency as heard after sampling: folded back below half the sample rate */
export function foldOf(freq: number, rate: number): number {
  const r = freq % rate
  return r <= rate / 2 ? r : rate - r
}

/** One sine of what the converter writes */
export interface Component {
  /** Hz, as it comes out */
  freq: number
  /** dBFS, its peak */
  db: number
  /** The tone itself; a new sine clipping made; one folded back from above half the sample rate */
  kind: 'tone' | 'distortion' | 'alias'
}

export interface Sample {
  /** When the clock took it (s from the window's left edge) */
  at: number
  /** What the converter got then (volts, after the filter, stopped at full scale) */
  held: number
  /** The number it is written as, in volts */
  value: number
}

export interface Conversion {
  setup: Setup
  /** The sine arriving (volts, peak) */
  amplitude: number
  /** One sample's time, s */
  period: number
  /** What arrives at a moment (s), before the converter's filter */
  arriving: (t: number, deg: number) => number
  /** What reaches the converter's input at a moment, after its filter — not yet stopped at full scale */
  received: (t: number, deg: number) => number
  /** Sample `n` (n / rate from the window's left edge, if the clock is steady) */
  sample: (n: number, deg: number) => Sample
  /** The D/A converter's output at a moment, from the samples (the first one's index `first`) */
  output: (t: number, samples: readonly Sample[], first: number) => number
  /** The sines in the numbers, the loudest first */
  components: Component[]
  /** Whether the input passed full scale (or a few bits' top number) */
  clipped: boolean
  /** The loop's levels: arriving (dBu), written (dBFS) */
  analog: { rms: number; peak: number }
  digital: { rms: number; peak: number }
}

/** Below this a sine is nothing (−160 dBFS) */
const NOTHING = FS_VOLTS * 1e-8
/** A cycle's sines worked out: one cycle in this many points, up to this harmonic */
const POINTS = 2048, HARMONICS = 99
const SIN = Float64Array.from({ length: POINTS }, (_, i) => Math.sin((TAU * i) / POINTS))
const COS = Float64Array.from({ length: POINTS }, (_, i) => Math.cos((TAU * i) / POINTS))

/** A harmonic: its sine and cosine parts, and its size (k = its index + 1) */
interface Harmonic { sin: number; cos: number; size: number }

/** One cycle (POINTS values, from phase 0) as its harmonics, up to HARMONICS */
function seriesOf(cycle: ArrayLike<number>): Harmonic[] {
  const out: Harmonic[] = []
  for (let k = 1; k <= HARMONICS; k++) {
    let s = 0, c = 0
    for (let i = 0; i < POINTS; i++) {
      const j = (k * i) % POINTS
      s += cycle[i] * SIN[j]
      c += cycle[i] * COS[j]
    }
    s = (2 * s) / POINTS; c = (2 * c) / POINTS
    out.push({ sin: s, cos: c, size: Math.hypot(s, c) })
  }
  return out
}

/** A cycle of a function of the phase */
const cycleOf = (f: (theta: number) => number) => Float64Array.from({ length: POINTS }, (_, i) => f((TAU * i) / POINTS))

const lanczos = (x: number) => {
  if (x === 0) return 1
  if (Math.abs(x) >= RECONSTRUCT_TAPS) return 0
  const px = Math.PI * x
  return (RECONSTRUCT_TAPS * Math.sin(px) * Math.sin(px / RECONSTRUCT_TAPS)) / (px * px)
}

const dbOf = (volts: number) => 20 * Math.log10(Math.max(volts, 1e-12) / FS_VOLTS)

export function conversionOf(setup: Setup): Conversion {
  const { rate, tone, level, bits, filter, jitter } = setup
  const amplitude = amplitudeOf(level), period = 1 / rate
  /** Where the input stops: full scale, or a few bits' top number below it */
  const top = bits === null ? FS_VOLTS : codeRange(bits).top
  const reaching = filter ? amplitude * passOf(tone, rate) : amplitude
  // Clipped, the sine's harmonics (a few bits' top number one step under full scale cuts its tops unevenly)
  const harmonics = reaching <= top ? [{ sin: reaching, cos: 0, size: reaching }]
    : seriesOf(cycleOf((p) => clamp(reaching * Math.sin(p), -FS_VOLTS, top)))
  /** What the filter after the clipping lets through of each harmonic (k = i + 1) */
  const kept = harmonics.map((h, i) => {
    const pass = filter ? passOf((i + 1) * tone, rate) : 1
    return { sin: h.sin * pass, cos: h.cos * pass, size: h.size * pass }
  })
  const clipped = reaching > top

  /** What the filter after the clipping leaves, at a phase of the tone (its small overs past full scale too) */
  const filtered = (theta: number) => {
    let sum = 0
    for (let i = 0; i < kept.length; i++) {
      const h = kept[i]
      if (h.size > NOTHING) sum += h.sin * Math.sin((i + 1) * theta) + h.cos * Math.cos((i + 1) * theta)
    }
    return sum
  }
  /** What the converter writes at a phase of the tone: before the bit depth's rounding */
  const writes = (theta: number) => clamp(filter ? filtered(theta) : amplitude * Math.sin(theta), -FS_VOLTS, top)
  const thetaAt = (t: number, deg: number) => TAU * tone * t + rad(deg)

  const sample = (n: number, deg: number): Sample => {
    const at = (n + (jitter ? jitterOf(n) : 0)) * period
    const held = writes(thetaAt(at, deg))
    return { at, held, value: bits === null ? held : quantize(held, bits) }
  }

  const output = (t: number, samples: readonly Sample[], first: number) => {
    const x = t * rate, from = Math.max(first, Math.floor(x) - RECONSTRUCT_TAPS + 1), to = Math.min(first + samples.length - 1, Math.floor(x) + RECONSTRUCT_TAPS)
    let sum = 0
    for (let n = from; n <= to; n++) sum += samples[n - first].value * lanczos(x - n)
    return sum
  }

  // The numbers over one cycle of the tone, as written (rounded to the bit depth): their levels as
  // the canvas reads them, and their sines — each where it comes out once sampled (above half the
  // sample rate folded back), those landing together added as powers. With the filter, its sines are
  // those it leaves: the few its small overs make, cut again at full scale, are a chip's own (left out)
  const round = (v: number) => (bits === null ? v : quantize(v, bits))
  const written = cycleOf((p) => round(writes(p)))
  const step = bits === null ? 0 : codeRange(bits).step
  const spectral = filter && clipped ? cycleOf((p) => (step ? Math.round(filtered(p) / step) * step : filtered(p))) : written
  let sq = 0, peak = 0
  for (const v of written) {
    sq += v * v
    peak = Math.max(peak, Math.abs(v))
  }
  const digital = { rms: dbOf(Math.sqrt(sq / POINTS)), peak: clipped ? 0 : dbOf(peak) }
  const byFreq = new Map<number, { power: number; kind: Component['kind'] }>()
  const series = bits === null && (!clipped || filter) ? kept : seriesOf(spectral)
  series.forEach(({ size }, i) => {
    if (size < NOTHING) return
    const k = i + 1, made = k * tone, freq = foldOf(made, rate)
    const kind: Component['kind'] = made > rate / 2 ? 'alias' : k === 1 ? 'tone' : 'distortion'
    const was = byFreq.get(freq)
    byFreq.set(freq, { power: (was?.power ?? 0) + size * size, kind: was?.kind === 'tone' || kind === 'tone' ? 'tone' : was?.kind ?? kind })
  })
  const components = [...byFreq].map(([freq, { power, kind }]) => ({ freq, db: dbOf(Math.sqrt(power)), kind }))
    .sort((a, b) => b.db - a.db)

  return {
    setup, amplitude, period,
    arriving: (t, deg) => amplitude * Math.sin(thetaAt(t, deg)),
    received: (t, deg) => reaching * Math.sin(thetaAt(t, deg)),
    sample, output, components, clipped,
    analog: { rms: level, peak: level + SINE_CREST_DB },
    digital,
  }
}

/** The samples from `first` to `last` at a phase */
export function samplesOf(c: Conversion, deg: number, first: number, last: number): Sample[] {
  const out: Sample[] = []
  for (let n = first; n <= last; n++) out.push(c.sample(n, deg))
  return out
}
