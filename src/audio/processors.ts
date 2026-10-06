// What runs in the audio thread (an AudioWorklet) while a chain plays: the dynamics cards —
// Compressor, Noise Gate, Limiter, De-esser — and the meters that measure every card. Web Audio has
// the rest (gains, filters, mixing); these few it has not as we need them (its DynamicsCompressor
// adds a makeup gain of its own and has a soft knee).
//
// Plain functions on blocks of samples, so the tests run them in Bun. The app hands this file's
// text to the AudioWorklet as it is (vite-worklet.ts: `processors.ts?worklet`), so it imports
// nothing.
//
// Levels: a sample of 1.0 is the clip level, +20 dBu (FULL_SCALE_DB, = CLIP_DBU in
// signal/levels.ts) — a dB reading x is the amplitude 10^((x − 20) / 20), dBFS too (0 dBFS: 0.1).

/** The reading (dBu, or dBFS after an ADC) of a sample of 1.0: the clip level. */
export const FULL_SCALE_DB = 20

/** The amplitude of a dB reading. */
export const ampOf = (db: number): number => Math.pow(10, (db - FULL_SCALE_DB) / 20)

/** The dB reading of an amplitude (−∞ for silence). */
export const dbOf = (amp: number): number => (amp > 0 ? 20 * Math.log10(amp) + FULL_SCALE_DB : -Infinity)

/** The dB reading of a mean square (a power). */
const dbOfPower = (power: number): number => (power > 0 ? 10 * Math.log10(power) + FULL_SCALE_DB : -Infinity)

/** How fast a compressor hears the level of the moment (an average over about this long, ms). */
export const COMPRESSOR_HEARS_MS = 3
/** A gate watches the peaks; between two peaks of one wave its watch fades over this long (ms). */
export const GATE_WATCH_MS = 10
/** A limiter catches a peak at once and lets go over this long (it has no time knobs, ms). */
export const LIMITER_RELEASE_MS = 50
/** The De-esser has no time knobs either: it acts and lets go like a quick compressor (ms). */
export const DEESSER_ATTACK_MS = 1
export const DEESSER_RELEASE_MS = 50
/** Above its threshold a De-esser turns its sibilant frequencies (those above its Frequency) down 8:1. */
export const DEESSER_RATIO = 8

/** A dynamics card's settings: its knobs (levels in dB readings, times in ms). */
export type DynamicsSettings =
  | { type: 'comp'; thresholdDb: number; ratio: number; attackMs: number; releaseMs: number; makeupDb: number }
  | { type: 'noise-gate'; thresholdDb: number; rangeDb: number; holdMs: number; attackMs: number; releaseMs: number }
  | { type: 'limiter'; thresholdDb: number; makeupDb: number }
  | { type: 'deesser'; thresholdDb: number; frequencyHz: number }

/**
 * A block of samples through a card: one channel, or two linked (the louder side decides, both get
 * the same gain). `input` may have no channels (nothing arrives): silence.
 */
export type Processor = (input: Float32Array[], output: Float32Array[]) => void

/**
 * How often (in samples) a compressor, gate or de-esser works out its gain; between two, the gain
 * moves in a straight line. A sixth of a millisecond: far quicker than any Attack.
 */
const STEP = 8

/** The share of the way to its target a setting moves in `samples` samples, taking about `ms` (0: at once). */
const shareOf = (ms: number, sampleRate: number, samples = 1) => (ms <= 0 ? 1 : 1 - Math.exp(-1000 * samples / (ms * sampleRate)))

let zeros = new Float32Array(128)

/**
 * A block's channels: the left (or only) one and the right (null: one channel) — nothing arriving
 * is silence — and where to write them (the right null: one channel out; a mono input fills both).
 */
function blockOf(input: Float32Array[], output: Float32Array[]) {
  const length = output[0].length
  if (zeros.length < length) zeros = new Float32Array(length)
  return {
    length,
    l: input[0] ?? zeros,
    r: input.length > 1 ? input[1] : null,
    outL: output[0],
    outR: output.length > 1 ? output[1] : null,
  }
}

/** A gain that moves to a new value in a straight line over STEP samples. */
class Ramp {
  value: number
  private delta = 0
  private left = 0
  constructor(value: number) { this.value = value }
  /** True when it wants its next value (`to`). */
  get due() { return this.left === 0 }
  to(next: number) {
    this.delta = (next - this.value) / STEP
    this.left = STEP
  }
  /** The gain for this sample. */
  next(): number {
    if (this.left > 0) { this.value += this.delta; this.left-- }
    return this.value
  }
}

/**
 * Above the threshold every `ratio` dB in comes out as 1 dB (signal/process.ts `compressor`), at
 * the level of the moment — reached over Attack (turning down) and Release (letting go). Then the
 * makeup gain lifts it all.
 */
function compressor(s: Extract<DynamicsSettings, { type: 'comp' }>, sampleRate: number): Processor {
  const hears   = shareOf(COMPRESSOR_HEARS_MS, sampleRate)
  const attack  = shareOf(s.attackMs, sampleRate, STEP)
  const release = shareOf(s.releaseMs, sampleRate, STEP)
  const slope   = 1 - 1 / s.ratio
  const gain    = new Ramp(Math.pow(10, s.makeupDb / 20))
  let power = 0
  let reduction = 0
  return (input, output) => {
    const { length, l, r, outL, outR } = blockOf(input, output)
    for (let i = 0; i < length; i++) {
      const a = l[i]
      const b = r ? r[i] : a
      power += (Math.max(a * a, b * b) - power) * hears
      if (gain.due) {
        const level  = dbOfPower(power)
        const target = level > s.thresholdDb ? (level - s.thresholdDb) * slope : 0
        reduction += (target - reduction) * (target > reduction ? attack : release)
        gain.to(Math.pow(10, (s.makeupDb - reduction) / 20))
      }
      const g = gain.next()
      outL[i] = a * g
      if (outR) outR[i] = b * g
    }
  }
}

/**
 * Open while its peaks reach the threshold (the start of a note opens it at once) and for Hold
 * after; closed, it turns the signal down by its Range. Opening takes Attack, closing Release.
 * It starts closed.
 */
function noiseGate(s: Extract<DynamicsSettings, { type: 'noise-gate' }>, sampleRate: number): Processor {
  const fade    = Math.exp(-1000 / (GATE_WATCH_MS * sampleRate))
  const attack  = shareOf(s.attackMs, sampleRate, STEP)
  const release = shareOf(s.releaseMs, sampleRate, STEP)
  const holdFor = Math.round(s.holdMs * sampleRate / 1000)
  const watch   = ampOf(s.thresholdDb)
  const gain    = new Ramp(Math.pow(10, s.rangeDb / 20))
  let peak = 0
  let holdLeft = 0
  let open = false
  let gainDb = s.rangeDb
  return (input, output) => {
    const { length, l, r, outL, outR } = blockOf(input, output)
    for (let i = 0; i < length; i++) {
      const a = l[i]
      const b = r ? r[i] : a
      peak = Math.max(Math.abs(a), Math.abs(b), peak * fade)
      const above = peak >= watch
      if (above) holdLeft = holdFor
      else if (holdLeft > 0) holdLeft--
      // Opened by any sample over the threshold since its last step
      open ||= above || holdLeft > 0
      if (gain.due) {
        const target = open ? 0 : s.rangeDb
        gainDb += (target - gainDb) * (target > gainDb ? attack : release)
        gain.to(Math.pow(10, gainDb / 20))
        open = false
      }
      const g = gain.next()
      outL[i] = a * g
      if (outR) outR[i] = b * g
    }
  }
}

/** Nothing gets above the ceiling, not for one sample; it lets go over LIMITER_RELEASE_MS. Then the makeup gain. */
function limiter(s: Extract<DynamicsSettings, { type: 'limiter' }>, sampleRate: number): Processor {
  const release = shareOf(LIMITER_RELEASE_MS, sampleRate)
  const ceiling = ampOf(s.thresholdDb)
  const makeup  = Math.pow(10, s.makeupDb / 20)
  let gain = 1
  return (input, output) => {
    const { length, l, r, outL, outR } = blockOf(input, output)
    for (let i = 0; i < length; i++) {
      const a = l[i]
      const b = r ? r[i] : a
      const loudest = Math.max(Math.abs(a), Math.abs(b))
      const most    = loudest > ceiling ? ceiling / loudest : 1
      gain = most < gain ? most : gain + (most - gain) * release
      outL[i] = a * gain * makeup
      if (outR) outR[i] = b * gain * makeup
    }
  }
}

/**
 * Turns down only the sibilant frequencies: the signal is split at its Frequency into what is below
 * (a low-pass) and the rest — the two add up to the signal again — and when the rest is over its
 * threshold, the rest alone is turned down 8:1, quickly, and let go quickly. The voice below the
 * Frequency passes untouched.
 */
function deesser(s: Extract<DynamicsSettings, { type: 'deesser' }>, sampleRate: number): Processor {
  const hears   = shareOf(DEESSER_ATTACK_MS, sampleRate)
  const attack  = shareOf(DEESSER_ATTACK_MS, sampleRate, STEP)
  const release = shareOf(DEESSER_RELEASE_MS, sampleRate, STEP)
  const slope   = 1 - 1 / DEESSER_RATIO
  const below   = lowPass(Math.min(s.frequencyHz, 0.45 * sampleRate), sampleRate)
  const left    = new Float64Array(4)
  const right   = new Float64Array(4)
  const gain    = new Ramp(1)
  let power = 0
  let reduction = 0
  return (input, output) => {
    const { length, l, r, outL, outR } = blockOf(input, output)
    for (let i = 0; i < length; i++) {
      const a = l[i]
      const b = r ? r[i] : a
      const lowA = biquad(below, left, a)
      const lowB = r ? biquad(below, right, b) : lowA
      const highA = a - lowA
      const highB = b - lowB
      power += (Math.max(highA * highA, highB * highB) - power) * hears
      if (gain.due) {
        const level  = dbOfPower(power)
        const target = level > s.thresholdDb ? (level - s.thresholdDb) * slope : 0
        reduction += (target - reduction) * (target > reduction ? attack : release)
        gain.to(Math.pow(10, -reduction / 20))
      }
      const g = gain.next()
      outL[i] = lowA + g * highA
      if (outR) outR[i] = lowB + g * highB
    }
  }
}

/** A 2nd-order Butterworth low-pass (the cookbook's, as Web Audio's): b0 b1 b2 a1 a2. */
export function lowPass(hz: number, sampleRate: number): number[] {
  const w = 2 * Math.PI * hz / sampleRate
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2)
  const cos = Math.cos(w)
  const a0 = 1 + alpha
  return [(1 - cos) / 2 / a0, (1 - cos) / a0, (1 - cos) / 2 / a0, -2 * cos / a0, (1 - alpha) / a0]
}

/** One sample through a biquad; `z` keeps the last two inputs and outputs. */
function biquad(k: number[], z: Float64Array, x: number): number {
  const y = k[0] * x + k[1] * z[0] + k[2] * z[1] - k[3] * z[2] - k[4] * z[3]
  z[1] = z[0]; z[0] = x
  z[3] = z[2]; z[2] = y
  return y
}

/** A dynamics card's processor, fresh (it remembers what it heard from one block to the next). */
export function dynamicsProcessor(settings: DynamicsSettings, sampleRate: number): Processor {
  switch (settings.type) {
    case 'comp':       return compressor(settings, sampleRate)
    case 'noise-gate': return noiseGate(settings, sampleRate)
    case 'limiter':    return limiter(settings, sampleRate)
    case 'deesser':    return deesser(settings, sampleRate)
  }
}

// ── Meters ────────────────────────────────────────────────────────────────────

/** What one channel of one meter measured: its loudest sample, its mean square, its hum (amplitudes). */
export interface ChannelReading {
  peak: number
  rms: number
  /** The hum's share (the RMS of its frequency alone); 0 when not asked for */
  hum: number
}

export interface MeterOptions {
  /** How many signals it measures (one input each) */
  inputs: number
  /** The first and the one-after-last frame it measures */
  start: number
  end: number
  /** Measure the hum at this frequency too (a whole number of its waves must fit the stretch) */
  humHz?: number
}

/**
 * Measures many signals at once, over the same stretch of frames: each channel's loudest sample,
 * its average (RMS) and — when asked — its hum, the one frequency of a mains hum (a single bin of a
 * Fourier transform: the hiss around it adds nearly nothing).
 */
export class Meter {
  private readonly peak: Float64Array
  private readonly power: Float64Array
  private readonly re: Float64Array
  private readonly im: Float64Array
  private readonly channels: Uint8Array
  private readonly cos: Float64Array
  private readonly sin: Float64Array
  private readonly options: MeterOptions

  constructor(options: MeterOptions, sampleRate: number) {
    this.options  = options
    const slots   = options.inputs * 2
    this.peak     = new Float64Array(slots)
    this.power    = new Float64Array(slots)
    this.re       = new Float64Array(slots)
    this.im       = new Float64Array(slots)
    this.channels = new Uint8Array(options.inputs)
    const wave    = options.humHz ? Math.round(sampleRate / options.humHz) : 0
    this.cos      = Float64Array.from({ length: wave }, (_, n) => Math.cos(2 * Math.PI * n / wave))
    this.sin      = Float64Array.from({ length: wave }, (_, n) => Math.sin(2 * Math.PI * n / wave))
  }

  /** A block of every input, its first frame at `frame`. */
  add(frame: number, inputs: Float32Array[][]) {
    const { start, end } = this.options
    const length = inputs.find((input) => input.length > 0)?.[0].length ?? 0
    const from = Math.max(start, frame) - frame
    const to   = Math.min(end, frame + length) - frame
    if (to <= from) return
    const wave = this.cos.length
    const first = wave > 0 ? (frame + from - start) % wave : 0
    for (let n = 0; n < inputs.length; n++) {
      const input = inputs[n]
      this.channels[n] = Math.max(this.channels[n], Math.min(2, input.length))
      for (let c = 0; c < input.length && c < 2; c++) {
        const slot = 2 * n + c
        const data = input[c]
        let peak = this.peak[slot]
        let power = 0
        for (let i = from; i < to; i++) {
          const v = data[i]
          const a = v < 0 ? -v : v
          if (a > peak) peak = a
          power += v * v
        }
        this.peak[slot] = peak
        this.power[slot] += power
        if (wave === 0) continue
        let re = 0
        let im = 0
        for (let i = from, k = first; i < to; i++, k = k + 1 === wave ? 0 : k + 1) {
          re += data[i] * this.cos[k]
          im += data[i] * this.sin[k]
        }
        this.re[slot] += re
        this.im[slot] += im
      }
    }
  }

  /** Each input's channels (none: nothing arrived), as amplitudes. */
  read(): ChannelReading[][] {
    const frames = this.options.end - this.options.start
    return Array.from({ length: this.options.inputs }, (_, n) =>
      Array.from({ length: this.channels[n] }, (_, c) => {
        const slot = 2 * n + c
        return {
          peak: this.peak[slot],
          rms:  Math.sqrt(this.power[slot] / frames),
          hum:  this.cos.length > 0 ? Math.SQRT2 * Math.hypot(this.re[slot], this.im[slot]) / frames : 0,
        }
      }))
  }
}

// ── In the audio thread ─────────────────────────────────────────────────────────

/** The names the app creates its AudioWorkletNodes with. */
export const DYNAMICS_PROCESSOR = 'lsc-dynamics'
export const METER_PROCESSOR = 'lsc-meter'

/** A meter's message when its stretch is over. */
export interface MeterMessage {
  readings: ChannelReading[][]
}

interface WorkletProcessor {
  readonly port: { postMessage(message: unknown): void }
}

declare const registerProcessor: ((name: string, processor: unknown) => void) | undefined
declare const AudioWorkletProcessor: new () => WorkletProcessor
declare const sampleRate: number
declare const currentFrame: number

if (typeof registerProcessor === 'function') {
  registerProcessor(DYNAMICS_PROCESSOR, class extends AudioWorkletProcessor {
    private readonly run: Processor
    constructor(options: { processorOptions: DynamicsSettings }) {
      super()
      this.run = dynamicsProcessor(options.processorOptions, sampleRate)
    }
    process(inputs: Float32Array[][], outputs: Float32Array[][]) {
      this.run(inputs[0], outputs[0])
      return true
    }
  })

  registerProcessor(METER_PROCESSOR, class extends AudioWorkletProcessor {
    private readonly meter: Meter
    private readonly end: number
    private done = false
    constructor(options: { processorOptions: MeterOptions }) {
      super()
      this.meter = new Meter(options.processorOptions, sampleRate)
      this.end = options.processorOptions.end
    }
    process(inputs: Float32Array[][]) {
      if (this.done) return false
      this.meter.add(currentFrame, inputs)
      if (currentFrame + 128 >= this.end) {
        this.done = true
        this.port.postMessage({ readings: this.meter.read() } satisfies MeterMessage)
      }
      return true
    }
  })
}
