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
// Each converter adds its own noise (its analogue parts'), so what comes out is never what went in.
// "No filter" is a converter without them: everything is sampled as it is, and folds back.
// Everything is a function of the phase: the tone's, at the window's left edge.

/** Full scale: the voltage of 0 dBFS (a peak of +18 dBu: 0.775 V × 10^(18/20)) */
export const FS_VOLTS = 0.775 * 10 ** (ALIGNMENT_DB / 20)
/** Where the analogue side itself stops: a peak of +20 dBu (the canvas's clip level) */
export const ANALOG_TOP = 0.775 * 10
/** A sine's peak over its average, in dB */
export const SINE_CREST_DB = 20 * Math.log10(Math.SQRT2)

/** The sample rates to pick: a telephone's, a voice call's, a CD's, video's, a studio's */
export const RATES = [8000, 16000, 44100, 48000, 96000] as const
export type Rate = number
export const RATE_START = 48000
/** The bit depths to pick, and the first */
export const BIT_DEPTHS = [3, 4, 8, 16, 24] as const
export const BITS_START = 4
/**
 * How long the picture's windows are: two cycles of the tone at 20 Hz (0.1 s) up to three at 20 kHz
 * and above (0.15 ms), evenly on a log scale between — never more than three, the wave drawn big
 * enough to read at every frequency (the user's call, 2026-11-28; it was 0.1 s down to 1 ms, twenty
 * cycles at 20 kHz); to two figures, rounded down so never past three (2 kHz: 1.3 ms)
 */
export function windowOf(tone: number): number {
  const cycles = 2 + Math.log10(Math.min(tone, 20000) / 20) / 3
  const s = cycles / tone, unit = 10 ** (Math.floor(Math.log10(s)) - 1)
  return Math.floor(s / unit + 1e-6) * unit
}

/**
 * The tone: its slider's steps, the third-octave bands (a graphic equalizer's) from 20 Hz, up to
 * 30 kHz (past a CD's and video's half sample rate); 2 kHz until the step that shows them
 */
export const TONES = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
  1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000, 25000, 30000,
] as const
export const TONE_START = 2000
/**
 * The level, the sine's average in dBu (the gain knob, from line level): up to +40, a sine 25 dB past
 * full scale — the line in itself clipped at +20 dBu from +17, the numbers almost a square wave (the
 * user's call, 2026-11-25: "a fully distorted disaster"); down to −130, an average of −148 dBFS: under
 * even 24 bits' noise (the user's call, 2026-11-28 — −20 was far from showing what 24 bits hold)
 */
export const LEVEL_MIN = -130, LEVEL_MAX = 40, LEVEL_START = 0

/**
 * The graphs' zoom (only how they are drawn: every number stays its own): a wave whose peak is some
 * dB under full scale is drawn `DRAWN_SHARE` of them under it, so the gain knob still makes it bigger,
 * only slower, and a quiet one is seen — line level (a peak of +3 dBu, 15 dB under) drawn as +13 dBu's
 * was, 5 dB under (the user's call, 2026-11-28). From full scale up, its real size: the full-scale and
 * +20 dBu lines never move, and a clipped wave meets them where it clips.
 */
export const DRAWN_SHARE = 1 / 3
/** How many times bigger than its real size a wave of this peak (dBu) is drawn */
export function zoomOf(peakDbu: number): number {
  const under = ALIGNMENT_DB - peakDbu
  return under > 0 ? 10 ** ((under * (1 - DRAWN_SHARE)) / 20) : 1
}

/** The converter's own noise (its analogue parts'), rms under full scale: a budget one's, a good one's */
export const OWN_NOISE = { quality: -120, budget: -100 } as const
export type Grade = keyof typeof OWN_NOISE

// ── 32-bit float (step 4) ───────────────────────────────────────────────────
// A recorder sold as "32-bit float" has two A/D converters on every input, at different
// sensitivities: a sensitive one for the quiet detail and a less sensitive one, FLOAT_OFFSET_DB
// below it, whose full scale sits far above anything the input delivers. The recorder joins them
// sample by sample, so no gain has to be set before them (Zoom's F6: "a high-gain path for small
// signals", "a low-gain (or no-gain) path for large signals", "combined at the moment of
// recording" — README's Sources). The number it writes is an IEEE 754 single: 1 sign digit,
// 8 exponent digits and 23 of detail, so it has no ceiling of its own — a sample above 0 dBFS is
// kept as it is, and the 24 digits of detail (23 written, the hidden 1) are always relative to the
// sample itself. What float cannot save: anything already clipped before the converters, and
// playback — a D/A converter still stops at full scale (`playedOf`).

/**
 * How far below the sensitive converter the less sensitive one sits, in dB. Neither Zoom nor Sound
 * Devices publish theirs; 24 dB is the figure in the gain-ranging A/D patent README's Sources cites
 * (a low-gain path at 0 dB, a high-gain path 24 dB above it) — and exactly 4 bits (the user's call,
 * 2026-11-28)
 */
export const FLOAT_OFFSET_DB = 24
/** IEEE 754 single precision: its digits, and the exponent 1.0 is written with */
export const FLOAT_EXP_BITS = 8, FLOAT_MANTISSA_BITS = 23, FLOAT_BIAS = 127
export const FLOAT_BITS = 1 + FLOAT_EXP_BITS + FLOAT_MANTISSA_BITS
/** The loudest the two converters together take, in volts: full scale FLOAT_OFFSET_DB up */
export const FLOAT_TOP = FS_VOLTS * 10 ** (FLOAT_OFFSET_DB / 20)

const FLOAT_VIEW = new DataView(new ArrayBuffer(4))
/** What a 32-bit float keeps of a number: 24 digits of detail, wherever the number sits */
export function toFloat32(x: number): number {
  FLOAT_VIEW.setFloat32(0, x)
  return FLOAT_VIEW.getFloat32(0)
}
/** A number's 32 IEEE 754 digits, the sign first — exactly what the browser stores, nothing faked */
export function floatBitsOf(x: number): boolean[] {
  FLOAT_VIEW.setFloat32(0, x)
  const word = FLOAT_VIEW.getUint32(0)
  return Array.from({ length: FLOAT_BITS }, (_, i) => ((word >>> (FLOAT_BITS - 1 - i)) & 1) === 1)
}
/** Its 8 exponent digits as a whole number: 127 for 1.0 (0 dBFS), one more every 6.02 dB */
export function floatExponentOf(x: number): number {
  FLOAT_VIEW.setFloat32(0, x)
  return (FLOAT_VIEW.getUint32(0) >>> FLOAT_MANTISSA_BITS) & 0xff
}
/** Which of the two converters gives a sample: the sensitive one while it is not at its full scale */
export function converterFor(volts: number): 'sensitive' | 'coarse' {
  return Math.abs(volts) < FS_VOLTS ? 'sensitive' : 'coarse'
}

/**
 * A wobbly clock, at its worst: each sample taken up to this share of a sample's time early or late
 * (a real one's wobble is around a nanosecond — this is thousands of times bigger, to be seen)
 */
export const JITTER_MAX = 0.25

/** How many samples either side the reconstruction reaches (as good as ideal here) */
export const RECONSTRUCT_TAPS = 48

export interface Setup {
  rate: Rate
  /** Hz */
  tone: number
  /** The sine's average, dBu */
  level: number
  /** null: not rounded yet (before the bit depth's step) */
  bits: number | null
  /** Whose own noise the two converters add */
  grade: Grade
  /** The filters before and inside the converter; false: none (everything folds back) */
  filter: boolean
  /** How far the clock wobbles: the most a sample is taken early or late, as a share of a sample's time (0 … JITTER_MAX) */
  jitter: number
  /**
   * 32-bit float (step 4): the two converters instead of one (nothing stops until FLOAT_TOP) and the
   * numbers kept as IEEE singles — `bits` is then ignored
   */
  float?: boolean
  /**
   * Float only: the gain on the numbers, after the converters (dB). It is where the gain knob moves
   * at step 4 — a multiplication, so it can raise a sample above 0 dBFS instead of clipping it
   */
  numberGain?: number
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

/**
 * A number's top digit: the first under the sign that is not a copy of it (0 the sign's row) — how
 * far up the number reaches; those above it only repeat the sign. null for 0 and −1 (the sign alone)
 */
export function topDigitOf(code: number, bits: number): number | null {
  const word = bitsOf(code, bits)
  const r = word.findIndex((on, i) => i > 0 && on !== word[0])
  return r < 0 ? null : r
}

/** The noise under a converter's numbers, dBFS: its bit depth's and its own, added as powers */
export function floorOf(bits: number, grade: Grade): { bits: number; own: number; total: number } {
  const b = ditherFloorDbfs(bits), own = OWN_NOISE[grade]
  return { bits: b, own, total: 10 * Math.log10(10 ** (b / 10) + 10 ** (own / 10)) }
}

/** A number from 0 to 1 for `n`, the same every time */
const hashOf = (n: number) => Math.abs(Math.sin(n * 12.9898 + 78.233) * 43758.5453) % 1

/** How early or late a wobbly clock takes sample `n`: −1 … 1 of its wobble (the same every time) */
export function jitterOf(n: number): number {
  return 2 * hashOf(n) - 1
}

/** Noise for sample `n`, with an rms of 1 (the same every time) */
export function noiseOf(n: number): number {
  const u = Math.max(hashOf(n * 2 + 0.5), 1e-12), v = hashOf(n * 2 + 1.5)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v)
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
  /** What the D/A converter makes of it, with its own noise */
  played: number
}

export interface Conversion {
  setup: Setup
  /** The sine arriving (volts, peak) */
  amplitude: number
  /** One sample's time, s */
  period: number
  /** What arrives at a moment (s), before the converter's filter — stopped at the analogue side's top */
  arriving: (t: number, deg: number) => number
  /** What reaches the converter's input at a moment, after its filter — not yet stopped at full scale (at the analogue side's top) */
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

/** The modified Bessel function I0, as a series */
function besselI0(x: number): number {
  let sum = 1, term = 1
  for (let k = 1; k < 40; k++) {
    term *= (x / (2 * k)) ** 2
    sum += term
    if (term < sum * 1e-16) break
  }
  return sum
}
/** The reconstruction's window: a Kaiser window, its leaks under the converters' own noise */
const KAISER_BETA = 13, KAISER_NORM = besselI0(KAISER_BETA)
/** An ideal reconstruction's sinc, windowed */
const reconstruct = (x: number) => {
  if (x === 0) return 1
  if (Math.abs(x) >= RECONSTRUCT_TAPS) return 0
  const px = Math.PI * x, r = x / RECONSTRUCT_TAPS
  return (Math.sin(px) / px) * (besselI0(KAISER_BETA * Math.sqrt(1 - r * r)) / KAISER_NORM)
}

const dbOf = (volts: number) => 20 * Math.log10(Math.max(volts, 1e-12) / FS_VOLTS)

/**
 * What a D/A converter can play of a number: nothing above full scale, however the number got there.
 * A whole number never passes it, so this only bites in float — the one thing float cannot save
 * (the sound has to be turned down in numbers first: `turnDownOf`)
 */
export const playedOf = (volts: number) => clamp(volts, -FS_VOLTS, FS_VOLTS)

/**
 * How far the numbers must be turned down, in dB, before a D/A converter can play them whole:
 * 0 while the peak is already under full scale
 */
export const turnDownOf = (peakDbfs: number) => Math.max(0, peakDbfs)

export function conversionOf(setup: Setup): Conversion {
  const { rate, tone, level, bits, filter, jitter } = setup
  const float = setup.float === true
  /** The gain on the numbers, after the converters (float only): a multiplication, never a stop */
  const numberGain = float ? 10 ** ((setup.numberGain ?? 0) / 20) : 1
  const amplitude = amplitudeOf(level), period = 1 / rate
  /**
   * Where the input stops. For whole numbers that is the converter: full scale, or a few bits' top
   * number below it. In float the two converters' own full scale (FLOAT_TOP) is above anything the
   * analogue side can deliver, so what stops the wave is the analogue side's own top — the one thing
   * float cannot save, and the reason a clipped float sample is red for what happened before it
   */
  const top = float ? ANALOG_TOP : bits === null ? FS_VOLTS : codeRange(bits).top
  /** Its other side (a whole number's lowest is full scale itself; the analogue side's rails are even) */
  const bottom = float ? -ANALOG_TOP : -FS_VOLTS
  const reaching = filter ? amplitude * passOf(tone, rate) : amplitude
  // Clipped, the sine's harmonics (a few bits' top number one step under full scale cuts its tops unevenly)
  const harmonics = reaching <= top ? [{ sin: reaching, cos: 0, size: reaching }]
    : seriesOf(cycleOf((p) => clamp(reaching * Math.sin(p), bottom, top)))
  /** What the filter after the clipping lets through of each harmonic (k = i + 1) */
  const kept = harmonics.map((h, i) => {
    const pass = filter ? passOf((i + 1) * tone, rate) : 1
    return { sin: h.sin * pass, cos: h.cos * pass, size: h.size * pass }
  })
  const clipped = reaching > top

  /** What the filter after the clipping leaves, at a phase of the tone (its small overs past full scale too) */
  // Each harmonic's sine and cosine from the one before (a window holds thousands of samples, each up
  // to 99 harmonics): sin((k+1)θ) = 2 cos θ · sin kθ − sin((k−1)θ), and the same for the cosine
  const filtered = (theta: number) => {
    const c1 = Math.cos(theta)
    let sum = 0, sinWas = 0, cosWas = 1, sin = Math.sin(theta), cos = c1
    for (let i = 0; i < kept.length; i++) {
      const h = kept[i]
      if (h.size > NOTHING) sum += h.sin * sin + h.cos * cos
      const sinNext = 2 * c1 * sin - sinWas, cosNext = 2 * c1 * cos - cosWas
      sinWas = sin; cosWas = cos; sin = sinNext; cos = cosNext
    }
    return sum
  }
  /** What the converter writes at a phase of the tone: before the bit depth's rounding */
  const writes = (theta: number) => clamp(filter ? filtered(theta) : amplitude * Math.sin(theta), bottom, top)
  const thetaAt = (t: number, deg: number) => TAU * tone * t + rad(deg)

  /**
   * The number a sample is written as: rounded to the bit depth's nearest step, or — in float — kept
   * as an IEEE single (24 digits of detail wherever it sits) and then multiplied by the gain, which
   * is after the converters and so can carry it above full scale instead of stopping it there
   */
  const round = (v: number) => (float ? toFloat32(v / FS_VOLTS) * FS_VOLTS * numberGain : bits === null ? v : quantize(v, bits))
  /** Each converter's own noise, in volts rms */
  const own = FS_VOLTS * 10 ** (OWN_NOISE[setup.grade] / 20)
  const sample = (n: number, deg: number): Sample => {
    const at = (n + jitter * jitterOf(n)) * period
    const held = clamp(writes(thetaAt(at, deg)) + own * noiseOf(n), bottom, top)
    const value = round(held)
    return { at, held, value, played: playedOf(value) + own * noiseOf(n + 0.25) }
  }

  const output = (t: number, samples: readonly Sample[], first: number) => {
    const x = t * rate, from = Math.max(first, Math.floor(x) - RECONSTRUCT_TAPS + 1), to = Math.min(first + samples.length - 1, Math.floor(x) + RECONSTRUCT_TAPS)
    let sum = 0
    for (let n = from; n <= to; n++) sum += samples[n - first].played * reconstruct(x - n)
    return sum
  }

  // The numbers over one cycle of the tone, as written (rounded to the bit depth): their levels as
  // the canvas reads them, and their sines — each where it comes out once sampled (above half the
  // sample rate folded back), those landing together added as powers. With the filter, its sines are
  // those it leaves: the few its small overs make, cut again at full scale, are a chip's own (left out)
  const written = cycleOf((p) => round(writes(p)))
  const step = bits === null || float ? 0 : codeRange(bits).step
  const spectral = filter && clipped && !float ? cycleOf((p) => (step ? Math.round(filtered(p) / step) * step : filtered(p))) : written
  let sq = 0, peak = 0
  for (const v of written) {
    sq += v * v
    peak = Math.max(peak, Math.abs(v))
  }
  // In float the peak is the number's own, above 0 dBFS and all: nothing stopped it there
  const digital = { rms: dbOf(Math.sqrt(sq / POINTS)), peak: clipped && !float ? 0 : dbOf(peak) }
  const byFreq = new Map<number, { power: number; kind: Component['kind'] }>()
  const series = !float && bits === null && (!clipped || filter) ? kept : seriesOf(spectral)
  series.forEach(({ size }, i) => {
    if (size < NOTHING) return
    const k = i + 1, made = k * tone, freq = foldOf(made, rate)
    const kind: Component['kind'] = made > rate / 2 ? 'alias' : k === 1 ? 'tone' : 'distortion'
    const was = byFreq.get(freq)
    byFreq.set(freq, { power: (was?.power ?? 0) + size * size, kind: was?.kind === 'tone' || kind === 'tone' ? 'tone' : was?.kind ?? kind })
  })
  const components = [...byFreq].map(([freq, { power, kind }]) => ({ freq, db: dbOf(Math.sqrt(power)), kind }))
    .sort((a, b) => b.db - a.db)

  // The line in, stopped at the analogue side's top (its rails): past it, its levels are the flat-topped
  // wave's. What the converter writes needs no such stop — full scale is under it, so the wave is cut
  // there anyway (the filter between them left out: what it would take of the line's flat tops is what
  // full scale makes again)
  const line = (v: number) => clamp(v, -ANALOG_TOP, ANALOG_TOP)
  let analog = { rms: level, peak: level + SINE_CREST_DB }
  if (amplitude > ANALOG_TOP) {
    let lineSq = 0
    for (const v of SIN) lineSq += line(amplitude * v) ** 2
    analog = { rms: 20 * Math.log10(Math.sqrt(lineSq / POINTS) / 0.775), peak: 20 * Math.log10(ANALOG_TOP / 0.775) }
  }

  return {
    setup, amplitude, period,
    arriving: (t, deg) => line(amplitude * Math.sin(thetaAt(t, deg))),
    received: (t, deg) => line(reaching * Math.sin(thetaAt(t, deg))),
    sample, output, components, clipped, analog, digital,
  }
}

/** The samples from `first` to `last` at a phase */
export function samplesOf(c: Conversion, deg: number, first: number, last: number): Sample[] {
  const out: Sample[] = []
  for (let n = first; n <= last; n++) out.push(c.sample(n, deg))
  return out
}
