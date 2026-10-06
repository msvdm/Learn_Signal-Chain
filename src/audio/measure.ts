import type { GeneratorSound } from '../data/nodeRegistry'
import { NODE_REGISTRY, param } from '../data/nodeRegistry'
import type { WireKind } from '../graph/queries'
import type { CardPlan, ChainLevels, WireSignal } from '../signal/chain'
import { contextOf, levelOf, onPort } from '../signal/chain'
import type { SideLevels } from '../signal/levels'
import { louder } from '../signal/levels'
import type { MeasuredStage } from '../signal/measured'
import { soundKindOf, withOwnHiss } from '../signal/process'
import type { ChainSounds, Tap } from './chainAudio'
import { HUM_HZ, buildChain } from './chainAudio'
import type { LoopKind } from './loops'
import { loopOf } from './loops'
import type { ChannelReading, MeterMessage, MeterOptions } from './processors'
import { DEESSER_ATTACK_MS, DEESSER_RELEASE_MS, LIMITER_RELEASE_MS, METER_PROCESSOR, dbOf } from './processors'
import processors from './processors.ts?worklet'
import { LOOP_S, generatorSound, whiteNoise } from './sounds'

// Measuring a chain on real sound: it is played into an OfflineAudioContext — off the main thread,
// faster than real time, silent — twice at once: with the music, and with the music stopped (what
// you hear then is its noise). After the dynamics have settled, one loop of the music is measured
// at every card: what arrives and what leaves — the loudest peak and the average; of the quiet, a
// stretch long enough for its noise and hum (the noise is steady: it needs no whole loop).

/** The rate the chains are played at to be measured (the loops are made at it: no resampling). */
export const MEASURE_RATE = 48000

/** How long the noise is measured (s): steady noise reads to about 0.02 dB in this long; 100 waves of a hum. */
const QUIET_S = 2

/** What a render measured: every card and every output. */
export interface Measurement {
  stages: Map<string, MeasuredStage>
  wires: Map<string, WireSignal>
}

let processorsUrl: string | undefined
/** The processors' code as a file the AudioWorklet can load (made once; the one-file copy has no other file). */
const processorsModule = () => (processorsUrl ??= URL.createObjectURL(new Blob([processors], { type: 'text/javascript' })))

let noise: AudioBuffer | undefined
const generator = new Map<GeneratorSound, AudioBuffer>()

/** Samples as a one-channel buffer. */
function bufferOf(samples: Float32Array<ArrayBuffer>): AudioBuffer {
  const buffer = new AudioBuffer({ length: samples.length, sampleRate: MEASURE_RATE, numberOfChannels: 1 })
  buffer.copyToChannel(samples, 0)
  return buffer
}

/** The sounds the sources of `plans` play (the loops fetched and decoded the first time). */
async function soundsOf(plans: CardPlan[]): Promise<ChainSounds> {
  const loops = new Map<LoopKind, Awaited<ReturnType<typeof loopOf>>>()
  const waiting: Promise<void>[] = []
  for (const card of plans) {
    if (!card.plays) continue
    const kind = soundKindOf(card.node)
    if (kind === 'sine' || kind === 'noise' || kind === 'click') {
      if (!generator.has(kind)) generator.set(kind, bufferOf(generatorSound(kind, MEASURE_RATE)))
    } else if (!loops.has(kind)) {
      waiting.push(loopOf(kind, MEASURE_RATE).then((loop) => { loops.set(kind, loop) }))
    }
  }
  await Promise.all(waiting)
  noise ??= bufferOf(whiteNoise(MEASURE_RATE))
  return { loops, generator, noise }
}

/** How long a dynamics card takes to forget where it started (s): seven times its slowest time, and a gate's Hold. */
function settleOf(card: CardPlan): number {
  const { node } = card
  if (!NODE_REGISTRY[node.typeKey].linked || node.bypassed) return 0
  switch (node.typeKey) {
    case 'comp':       return 7 * Math.max(param(node, 'attackMs'), param(node, 'releaseMs')) / 1000
    case 'noise-gate': return (param(node, 'holdMs') + 7 * Math.max(param(node, 'attackMs'), param(node, 'releaseMs'))) / 1000
    case 'limiter':    return 7 * LIMITER_RELEASE_MS / 1000
    default:           return 7 * Math.max(DEESSER_ATTACK_MS, DEESSER_RELEASE_MS) / 1000
  }
}

/**
 * Played before the loop is measured (s): every dynamics card settles into it — one after another
 * along a chain they add up, side by side they do not — at most one loop; the filters a moment.
 */
function settleSecondsOf(plans: CardPlan[]): number {
  const settled = new Map<string, number>()
  let longest = 0
  for (const card of plans) {
    const before = Math.max(0, ...card.used.map((u) => settled.get(u.from.slice(0, u.from.lastIndexOf(':'))) ?? 0))
    const mine = before + settleOf(card)
    settled.set(card.node.id, mine)
    longest = Math.max(longest, mine)
  }
  return 0.05 + Math.min(LOOP_S, longest)
}

/**
 * One render: the chain into an OfflineAudioContext, every tap into one meter (`hum`: it measures
 * the hum too — only where a ground loop is, and only with the music stopped).
 */
async function render(plans: CardPlan[], still: ChainLevels, sounds: ChainSounds, music: boolean, hum: boolean, start: number, end: number) {
  const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: end + 128, sampleRate: MEASURE_RATE })
  await ctx.audioWorklet.addModule(processorsModule())
  const taps = buildChain(ctx, plans, still, sounds, music)
  const options: MeterOptions = { inputs: taps.length, start, end, ...(hum ? { humHz: HUM_HZ } : {}) }
  const meter = new AudioWorkletNode(ctx, METER_PROCESSOR, {
    numberOfInputs: taps.length, numberOfOutputs: 1, outputChannelCount: [1],
    channelCount: 2, channelCountMode: 'max', channelInterpretation: 'discrete',
    processorOptions: options,
  })
  taps.forEach((t, i) => { for (const p of t.parts) p.node.connect(meter, p.output, i) })
  // Connected to the end of the graph, so it is played
  meter.connect(ctx.destination)
  const message = new Promise<MeterMessage>((resolve) => { meter.port.onmessage = (e) => resolve(e.data as MeterMessage) })
  await ctx.startRendering()
  return { taps, readings: (await message).readings }
}

/** A measured signal: the peaks and the average from the music, the noise and the hum from the quiet. */
function signalOf(music: ChannelReading[], quiet: ChannelReading[], like: WireSignal): WireSignal {
  const side = (c: 0 | 1, still: SideLevels): SideLevels => {
    const m = music[c] ?? music[0]
    const q = quiet[c] ?? quiet[0]
    return {
      peak:  m ? dbOf(m.peak) : -Infinity,
      rms:   m ? dbOf(m.rms) : -Infinity,
      noise: q ? dbOf(q.rms) : -Infinity,
      // Only where a ground loop's hum reaches (the hiss has a share of every frequency, a tiny one)
      hum:   q && isFinite(still.hum) ? dbOf(q.hum) : -Infinity,
    }
  }
  const l = side(0, like.l)
  return { kind: like.kind, l, r: like.kind === 'mono' ? l : side(1, like.r) }
}

/** A wire's signal as a card takes it: one channel (one side of a mix: that side), or both sides. */
function asKind(w: WireSignal, kind: WireKind): WireSignal {
  if (kind !== 'mono') return { kind, l: w.l, r: w.r }
  const side = w.kind === 'right' ? w.r : w.l
  return { kind, l: side, r: side }
}

/** A dynamics card's makeup gain: it lifts everything after turning it down. */
const makeupOf = (card: CardPlan) =>
  card.node.typeKey === 'comp' || card.node.typeKey === 'limiter' ? param(card.node, 'makeupGainDb') : 0

/**
 * The chain measured on real sound: what arrives at and leaves every card in `plans`, and what each
 * output sends. `still` is the number engine's picture of the same plans (each card's domain and
 * condition, and the kinds of signal).
 */
export async function measureChain(plans: CardPlan[], still: ChainLevels): Promise<Measurement> {
  const stages = new Map<string, MeasuredStage>()
  const wires  = new Map<string, WireSignal>()
  if (plans.length === 0) return { stages, wires }

  const sounds = await soundsOf(plans)
  const start  = Math.round(settleSecondsOf(plans) * MEASURE_RATE)
  const hum    = plans.some((p) => p.groundLoop)
  const [music, quiet] = await Promise.all([
    render(plans, still, sounds, true, false, start, start + Math.round(LOOP_S * MEASURE_RATE)),
    render(plans, still, sounds, false, hum, start, start + Math.round(QUIET_S * MEASURE_RATE)),
  ])

  const readingsAt = new Map<string, { music: ChannelReading[]; quiet: ChannelReading[] }>()
  music.taps.forEach((t: Tap, i) => readingsAt.set(`${t.id}/${t.at}`, { music: music.readings[i], quiet: quiet.readings[i] }))

  for (const card of plans) {
    const { node } = card
    const levels = still.cards.get(node.id)
    if (!levels) continue
    const at = (where: Tap['at'], like: WireSignal) => {
      const r = readingsAt.get(`${node.id}/${where}`)
      return r ? signalOf(r.music, r.quiet, like) : undefined
    }
    // What arrives was measured on the one wire before it, unless the card adds wires up (or folds
    // a stereo wire into one, or spreads a mono one over two sides)
    const wire   = card.used.length === 1 ? wires.get(card.used[0].from) : undefined
    const inSig  = card.mode === 'source' ? levels.in
      : at('in', levels.in) ?? (wire ? asKind(wire, levels.in.kind) : signalOf([], [], levels.in))
    const outSig = at('out', levels.out) ?? signalOf([], [], levels.out)
    const stage: MeasuredStage = { in: inSig, out: outSig }
    // A dynamics card at work: how far it turned the average down (a De-esser: its sibilant band);
    // what its curve worked on
    if (NODE_REGISTRY[node.typeKey].linked && !node.bypassed) {
      const bandIn  = at('band-in', levels.in)
      const bandOut = at('band-out', levels.out)
      stage.gainReductionDb = Math.max(0, bandIn && bandOut
        ? levelOf(bandIn) - levelOf(bandOut)
        : levelOf(inSig) + makeupOf(card) - levelOf(outSig))
      stage.curveIn = withOwnHiss(node, louder(inSig.l, inSig.r), contextOf(card, levels.inDomain, levels.mixedDomains, null))
    }
    stages.set(node.id, stage)
    for (const o of card.outputs) wires.set(o.key, onPort(o.kind, o.direct ? inSig : outSig))
  }
  return { stages, wires }
}
