import type { GeneratorSound, SignalNode } from '../data/nodeRegistry'
import { NODE_REGISTRY, isNodeStereo, param } from '../data/nodeRegistry'
import type { WireKind } from '../graph/queries'
import type { CardPlan, ChainLevels } from '../signal/chain'
import { peakOf } from '../signal/chain'
import type { SignalDomain } from '../signal/levels'
import { HUM_DBU, ceilingOf } from '../signal/levels'
import { DI_DROP_DB, GAIN_OFF_DB, GUITAR_REF_DB, HISS_DBU, NOISE_BELOW, balanceSides, hissDbOf, panSides, soundKindOf } from '../signal/process'
import { GEQ_CENTERS, GEQ_Q } from '../signal/eqMath'
import type { DynamicsSettings } from './processors'
import { DYNAMICS_PROCESSOR, FULL_SCALE_DB, ampOf } from './processors'
import type { Loop, LoopKind } from './loops'
import { LOOP_S } from './sounds'

// A chain as Web Audio nodes, to be measured (audio/measure.ts): every card does to real sound what
// the number engine does to its readings (signal/chain.ts runChain, from the same plan) — gains,
// faders and converters are gains, the filters biquads, Pan / Balance a gain per side, a bus adds up
// what is plugged in, the dynamics are our processors (audio/processors.ts). Every powered card adds
// its own hiss before it does its job; a DI Box in a ground loop a 50 Hz hum. Whatever would pass
// the clip level (+20 dBu, 0 dBFS digital) is cut off there.
//
// Lean on purpose — a render's time is mostly nodes: a signal is the sum of a few node outputs
// (a node's input adds up whatever is connected, so joining two signals costs nothing), and only
// cards whose peaks could come near their ceiling get a clipper.

/** The frequency of a ground loop's hum (the mains: 50 Hz in Europe). */
export const HUM_HZ = 50

/** What a chain plays. */
export interface ChainSounds {
  /** The loops of real sound, by what they play */
  loops: Map<LoopKind, Loop>
  /** The Generator's sounds, an RMS of 1 */
  generator: Map<GeneratorSound, AudioBuffer>
  /** White noise, an RMS of 1, a loop long: every hiss plays it from its own point */
  noise: AudioBuffer
}

/** One output of a node. */
interface Part {
  node: AudioNode
  output: number
}

/** A signal: the sum of a few outputs (none: silence), one channel or two (L, R). */
interface Sig {
  parts: Part[]
  channels: 1 | 2
}

/** What a wire carries: a signal, and what it is (a mono wire, a stereo one, one side of a mix). */
interface Feed extends Sig {
  kind: WireKind
}

/**
 * Where a signal is measured — what arrives at a card, what leaves it; on a De-esser also the
 * sibilant band of each, to see how far it turned that down — and what to measure there.
 */
export interface Tap {
  id: string
  at: 'in' | 'out' | 'band-in' | 'band-out'
  parts: Part[]
}

/** Conditions under which a card sends nothing (signal/process.ts `blocked`; the engine's `needsAmp`). */
const SILENCED = new Set(['domainMixedBus', 'digitalToAmp', 'digitalToSpeaker', 'adcExpectsAnalog', 'dacExpectsDigital', 'needsAmp'])

/** How far past its ceiling a clipper reaches (60 dB): the curve's ceiling is 1 / CLIP_REACH of it. */
const CLIP_REACH = 1000

/** A clipper's curve: 0 up to the ceiling, then how far past it. */
const PAST_CEILING = Float32Array.from({ length: 2 * CLIP_REACH + 1 }, (_, i) => {
  const u = (i - CLIP_REACH) / CLIP_REACH
  return Math.sign(u) * Math.max(0, Math.abs(u) - 1 / CLIP_REACH)
})

/**
 * A card whose peaks the number engine puts within this of its ceiling gets a clipper (dB). Where it
 * knows the sound (gains, faders, buses — the loops' peaks are as it says, to 0.15 dB) a hair;
 * after a filter or a dynamics card a lot: a boost on just the frequencies a sound has, the peaks a
 * slow Attack lets through.
 */
const CLIP_MARGIN_DB = { sure: 1, guessed: 24 }

/** Web Audio's high- and low-pass take their Q in dB: a 2nd-order Butterworth is −3.01 dB (0.707). */
const BUTTERWORTH_Q_DB = 20 * Math.log10(Math.SQRT1_2)

/** Cards the number engine cannot follow closely: a filter or a dynamics card, and everything after one. */
function unsure(plans: CardPlan[]): Set<string> {
  const ids = new Set<string>()
  const guess = new Set(['eq', 'graphic-eq', 'hpf'])
  for (const card of plans) {
    const own = guess.has(card.node.typeKey) || Boolean(NODE_REGISTRY[card.node.typeKey].linked)
    if ((own && !card.node.bypassed) || card.used.some((u) => ids.has(u.from.slice(0, u.from.lastIndexOf(':'))))) ids.add(card.node.id)
  }
  return ids
}

/**
 * The chain built into `ctx`, from the number engine's plan and its still picture (each card's
 * domain and condition, the kinds of signal, roughly how loud the peaks are). `music` false: the
 * sources play only their noise — what you hear when the music stops. The taps: what leaves every
 * card, and what arrives where it is more than the one wire before it.
 */
export function buildChain(ctx: BaseAudioContext, plans: CardPlan[], still: ChainLevels, sounds: ChainSounds, music: boolean): Tap[] {
  const taps: Tap[] = []
  const wires = new Map<string, Feed>()
  const guessed = unsure(plans)
  let noises = 0

  const silence = (channels: 1 | 2): Sig => ({ parts: [], channels })

  /** A node with all of `x` connected to its input. */
  const into = <N extends AudioNode>(x: Sig, node: N): N => {
    for (const p of x.parts) p.node.connect(node, p.output)
    return node
  }

  const one = (node: AudioNode, channels: 1 | 2, output = 0): Sig => ({ parts: [{ node, output }], channels })

  /** `db` louder (−∞: silent), one channel or two (a mono signal arriving fills both). */
  const gainNode = (db: number, channels: 1 | 2) => new GainNode(ctx, {
    gain: isFinite(db) ? Math.pow(10, db / 20) : 0,
    channelCount: channels, channelCountMode: 'explicit', channelInterpretation: 'speakers',
  })
  const gain = (db: number, x: Sig, channels = x.channels): Sig =>
    x.parts.length === 0 || !isFinite(db) ? silence(channels)
      : db === 0 && channels === x.channels ? x
      : one(into(x, gainNode(db, channels)), channels)

  /** Signals added together. */
  const plus = (...xs: Sig[]): Sig => ({ parts: xs.flatMap((x) => x.parts), channels: xs[0].channels })

  /** A buffer played over and over from `offset`, between `start` and `end`. */
  const playing = (buffer: AudioBuffer, start = 0, end = buffer.duration, offset = start): Sig => {
    const source = new AudioBufferSourceNode(ctx, { buffer, loop: true, loopStart: start, loopEnd: end })
    source.start(0, offset)
    return one(source, 1)
  }

  /** A signal of an RMS of 1 played at the reading `db`. */
  const atLevel = (db: number, x: Sig) => gain(db - FULL_SCALE_DB, x)

  /** A hiss at `db`, one channel or each side its own — every one from its own point of the noise. */
  const hiss = (db: number, channels: 1 | 2): Sig => {
    // Points far apart in the noise do not move together: the hisses add up as powers
    const once = () => atLevel(db, playing(sounds.noise, 0, sounds.noise.duration, ((noises++ * 0.6180339887) % 1) * LOOP_S))
    return channels === 1 ? once() : twoSides(once(), once())
  }

  /** Two channels from a left and a right one. */
  const twoSides = (left: Sig, right: Sig): Sig => {
    const merge = new ChannelMergerNode(ctx, { numberOfInputs: 2 })
    for (const p of left.parts) p.node.connect(merge, p.output, 0)
    for (const p of right.parts) p.node.connect(merge, p.output, 1)
    return one(merge, 2)
  }

  /** Each side of a two-channel signal through its own nodes. */
  const sideBySide = (x: Sig, left: (l: Sig) => Sig, right: (r: Sig) => Sig): Sig => {
    const split = into(x, new ChannelSplitterNode(ctx, { numberOfOutputs: 2 }))
    return twoSides(left(one(split, 1, 0)), right(one(split, 1, 1)))
  }

  /**
   * Nothing above the ceiling: `x` less how far it goes past it. A wave shaper gives the past-it
   * part — exactly 0 up to the ceiling, so what stays under it passes to the last bit (a shaper's
   * own sums are rounded, which would lose a −128 dBu hiss).
   */
  const clipped = (x: Sig, domain: SignalDomain): Sig => {
    if (x.parts.length === 0) return x
    const ceiling = ampOf(ceilingOf(domain))
    const shaper = new WaveShaperNode(ctx, { curve: PAST_CEILING, channelCount: x.channels, channelCountMode: 'explicit' })
    into(gain(-20 * Math.log10(ceiling * CLIP_REACH), x), shaper)
    const past = new GainNode(ctx, { gain: -ceiling * CLIP_REACH, channelCount: x.channels, channelCountMode: 'explicit' })
    shaper.connect(past)
    return plus(x, one(past, x.channels))
  }

  /** Clipped where it could come near its ceiling. */
  const clippedIfNear = (x: Sig, card: CardPlan, domain: SignalDomain): Sig => {
    const peak = peakOf(still.cards.get(card.node.id)?.out)
    const margin = CLIP_MARGIN_DB[guessed.has(card.node.id) ? 'guessed' : 'sure']
    return peak >= ceilingOf(domain) - margin ? clipped(x, domain) : x
  }

  /** Everything plugged into a card added up: one channel (a stereo wire folded in), or two sides. */
  const arriving = (card: CardPlan, channels: 1 | 2): Sig => {
    const all: Sig[] = []
    for (const u of card.used) {
      const feed = wires.get(u.from)
      if (!feed) continue
      // A Matrix Bus's send knob
      const sent: Feed = u.sendDb === 0 ? feed : { ...gain(u.sendDb, feed), kind: feed.kind }
      if (channels === 1 && sent.channels === 2) {
        // Folded into one: L + R (the speakers' down-mix is half of that)
        all.push(gain(20 * Math.log10(2), sent, 1))
      } else if (channels === 2 && (sent.kind === 'left' || sent.kind === 'right')) {
        // One side of a mix lands on its side only
        all.push(sent.kind === 'left' ? twoSides(sent, silence(1)) : twoSides(silence(1), sent))
      } else if (channels === 2 && sent.channels === 1) {
        // A mono wire on two sides lands on both (the speakers' up-mix)
        all.push(gain(0, sent, 2))
      } else {
        all.push(sent)
      }
    }
    return { parts: all.flatMap((x) => x.parts), channels }
  }

  /** What arrives at a card is the one wire before it as it is: measured there already. */
  const sameAsWire = (card: CardPlan, channels: 1 | 2) => {
    if (card.used.length !== 1 || card.used[0].sendDb !== 0) return false
    const feed = wires.get(card.used[0].from)
    return !feed || (feed.channels === channels && (channels === 1 || feed.kind === 'stereo'))
  }

  for (const card of plans) {
    const { node } = card
    const levels = still.cards.get(node.id)
    if (!levels) continue
    let inSig = silence(1)
    let outSig = silence(1)

    if (card.mode === 'needs-amp') {
      inSig = arriving(card, 1)
    } else if (card.mode === 'pan') {
      // Mono in → the Pan knob spreads it over L / R (equal power); stereo in → the Balance knob
      const balance = card.followKind === 'stereo'
      const position = param(node, 'panPosition')
      const sides = node.bypassed && (balance || card.fed) ? { l: 0, r: 0 }
        : balance ? balanceSides(position, 0, 0) : panSides(position, 0)
      inSig = arriving(card, balance ? 2 : 1)
      outSig = balance
        ? sideBySide(inSig, (l) => gain(sides.l, l), (r) => gain(sides.r, r))
        : twoSides(gain(sides.l, inSig), gain(sides.r, inSig))
    } else if (card.mode === 'source') {
      outSig = clippedIfNear(source(card), card, 'analog')
      // Line In set to Stereo: the same on both sides
      if (isNodeStereo(node)) outSig = gain(0, outSig, 2)
    } else {
      // One channel, or both sides: a stereo signal through a follow card, a stereo bus (linked
      // dynamics hear both and give both the same gain)
      const channels: 1 | 2 = card.mode === 'mono' ? 1 : 2
      inSig = arriving(card, channels)
      if (levels.condition !== undefined && SILENCED.has(levels.condition)) {
        outSig = silence(channels)
      } else if (node.bypassed && card.fed) {
        // Passed on as it is, with no hiss of its own (a bus still adds its wires up)
        outSig = clippedIfNear(inSig, card, levels.inDomain)
      } else {
        const own = hissDbOf(node, { domain: levels.inDomain, preamp: card.preamp, fed: card.fed })
        let out = processed(card, isFinite(own) ? plus(inSig, hiss(own, channels)) : inSig)
        // The DAC's analog side hisses like any powered card
        if (node.typeKey === 'dac' && card.fed) out = plus(out, hiss(HISS_DBU, channels))
        outSig = clippedIfNear(out, card, levels.domain)
      }
    }

    // A DI Box in a ground loop: a hum on its XLR Out — from there on it is part of the noise
    if (card.groundLoop && outSig.parts.length > 0) {
      const mains = new OscillatorNode(ctx, { frequency: HUM_HZ })
      mains.start(0)
      // An oscillator swings ±1: its RMS is 1/√2
      outSig = plus(outSig, gain(20 * Math.log10(ampOf(HUM_DBU) * Math.SQRT2), one(mains, 1), outSig.channels))
    }

    // A source's input is what it hears, not what it works on: the engine shows none
    if (card.mode !== 'source' && !sameAsWire(card, inSig.channels)) taps.push({ id: node.id, at: 'in', parts: inSig.parts })
    taps.push({ id: node.id, at: 'out', parts: outSig.parts })
    if (node.typeKey === 'deesser' && !node.bypassed) {
      // Its sibilant band: what arrives less what is below its Frequency — leaving, what leaves
      // less that same part (it passes untouched)
      const below = minusBelow(inSig, Math.min(param(node, 'frequencyHz'), 0.45 * ctx.sampleRate))
      taps.push({ id: node.id, at: 'band-in', parts: plus(inSig, below).parts }, { id: node.id, at: 'band-out', parts: plus(outSig, below).parts })
    }

    for (const o of card.outputs) {
      // A DI Box's Direct Out passes on what arrives
      wires.set(o.key, onPort(o.direct ? inSig : outSig, o.kind))
    }
  }
  return taps

  /** What a source sends: its sound at its level, and its own noise. A Microphone fed a Guitar Amp hears the amp. */
  function source(card: CardPlan): Sig {
    const { node } = card
    const level = node.typeKey === 'mic' ? param(node, 'sensitivityDb') : param(node, 'levelDb')
    const noise = hiss(level - NOISE_BELOW[node.typeKey as keyof typeof NOISE_BELOW], 1)
    if (!card.plays) return plus(gain(level - GUITAR_REF_DB, arriving(card, 1)), noise)
    if (!music) return noise
    const kind = soundKindOf(node)
    let sound: Sig
    if (kind === 'sine' || kind === 'noise' || kind === 'click') {
      sound = playing(sounds.generator.get(kind)!)
    } else {
      const loop = sounds.loops.get(kind)!
      sound = playing(loop.buffer, loop.start, loop.end)
    }
    return plus(atLevel(level, sound), noise)
  }

  /** What a card does to what it works on (its own hiss in). */
  function processed(card: CardPlan, x: Sig): Sig {
    const { node } = card
    switch (node.typeKey) {
      case 'gain': {
        if (card.preamp) return gain(param(node, 'preampDb'), x)
        const db = param(node, 'gainDb')
        return gain(db <= GAIN_OFF_DB ? -Infinity : db, x)
      }
      case 'amp': {
        // Only turns down; in stereo each side has its own volume (the Right follows the Left until turned)
        const volume = (db: number) => (Math.min(db, 0) <= GAIN_OFF_DB ? -Infinity : Math.min(db, 0))
        const left = volume(param(node, 'gainDb'))
        const right = volume(param(node, 'gainDbR') ?? param(node, 'gainDb'))
        if (x.channels === 1 || left === right) return gain(left, x)
        return sideBySide(x, (l) => gain(left, l), (r) => gain(right, r))
      }
      case 'hpf':
        return filtered(x, [{ type: 'highpass', frequency: param(node, 'cutoffHz'), Q: BUTTERWORTH_Q_DB }])
      case 'eq':
        return filtered(x, param(node, 'bands').filter((b) => b.gainDb !== 0).map((b) => ({
          type: b.type === 'low-shelf' ? 'lowshelf' : b.type === 'high-shelf' ? 'highshelf' : 'peaking',
          frequency: b.freqHz, gain: b.gainDb, Q: b.Q ?? 1.4,
        })))
      case 'graphic-eq': {
        const bands = (right: boolean): BiquadFilterOptions[] => GEQ_CENTERS.flatMap((hz, i) => {
          const left = param(node, `b${i}`)
          const db = right ? (param(node, `r${i}`) ?? left) : left
          return db === 0 ? [] : [{ type: 'peaking', frequency: hz, gain: db, Q: GEQ_Q }]
        })
        const sameSides = GEQ_CENTERS.every((_, i) => param(node, `r${i}`) === undefined || param(node, `r${i}`) === param(node, `b${i}`))
        if (x.channels === 1 || sameSides) return filtered(x, bands(false))
        return sideBySide(x, (l) => filtered(l, bands(false)), (r) => filtered(r, bands(true)))
      }
      case 'comp':
      case 'noise-gate':
      case 'limiter':
      case 'deesser':    return dynamics(x, settingsOf(node))
      case 'pad':        return param(node, 'engaged') ? gain(-20, x) : x
      case 'fader':      return gain(param(node, 'faderDb'), x)
      case 'switch':     return param(node, 'on') ? x : silence(x.channels)
      case 'adc':        return gain(-param(node, 'alignmentDb'), x)
      case 'dac':        return gain(param(node, 'alignmentDb'), x)
      case 'master-bus':
      case 'aux-bus':
      case 'matrix-bus': return gain(param(node, 'faderDb'), x)
      case 'speaker':    return gain(param(node, 'outputTrimDb'), x)
      case 'active-speaker':
      case 'guitar-amp': return gain(param(node, 'volumeDb'), x)
      case 'di-box':     return gain(-DI_DROP_DB, x)
      default:           return x
    }
  }

  /** Minus what is below `hz` in a signal: a De-esser's split (audio/processors.ts) — the rest is its sibilant band. */
  function minusBelow(x: Sig, hz: number): Sig {
    if (x.parts.length === 0) return x
    const below = filtered(x, [{ type: 'lowpass', frequency: hz, Q: BUTTERWORTH_Q_DB }])
    const minus = new GainNode(ctx, { gain: -1, channelCount: x.channels, channelCountMode: 'explicit' })
    for (const p of below.parts) p.node.connect(minus, p.output)
    return one(minus, x.channels)
  }

  function filtered(x: Sig, filters: BiquadFilterOptions[]): Sig {
    if (x.parts.length === 0) return x
    return filters.reduce((from, options) => one(into(from, new BiquadFilterNode(ctx, options)), x.channels), x)
  }

  function dynamics(x: Sig, settings: DynamicsSettings): Sig {
    // Nothing arriving still runs it: a gate closes, a compressor lets go
    return one(into(x, new AudioWorkletNode(ctx, DYNAMICS_PROCESSOR, {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [x.channels],
      channelCount: x.channels, channelCountMode: 'explicit', channelInterpretation: 'discrete',
      processorOptions: settings,
    })), x.channels)
  }

  /** What an output that carries `kind` sends of the card's signal (as signal/chain.ts onPort does). */
  function onPort(x: Sig, kind: WireKind): Feed {
    if (kind === 'stereo') return { ...gain(0, x, 2), kind }
    if (x.channels === 1) return { ...x, kind }
    // One side of a two-sided signal
    const split = into(x, new ChannelSplitterNode(ctx, { numberOfOutputs: 2 }))
    return { ...one(split, 1, kind === 'right' ? 1 : 0), kind }
  }
}

/** A dynamics card's knobs, as its processor takes them. */
export function settingsOf(node: SignalNode): DynamicsSettings {
  switch (node.typeKey) {
    case 'noise-gate':
      return {
        type: 'noise-gate', thresholdDb: param(node, 'thresholdDb'), rangeDb: param(node, 'rangeDb'),
        holdMs: param(node, 'holdMs'), attackMs: param(node, 'attackMs'), releaseMs: param(node, 'releaseMs'),
      }
    case 'limiter':
      return { type: 'limiter', thresholdDb: param(node, 'thresholdDb'), makeupDb: param(node, 'makeupGainDb') }
    case 'deesser':
      return { type: 'deesser', thresholdDb: param(node, 'thresholdDb'), frequencyHz: param(node, 'frequencyHz') }
    default:
      return {
        type: 'comp', thresholdDb: param(node, 'thresholdDb'), ratio: param(node, 'ratio'),
        attackMs: param(node, 'attackMs'), releaseMs: param(node, 'releaseMs'), makeupDb: param(node, 'makeupGainDb'),
      }
  }
}
