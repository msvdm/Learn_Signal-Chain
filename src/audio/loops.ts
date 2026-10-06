import type { GeneratorSound } from '../data/nodeRegistry'
import type { SoundKind } from '../signal/process'
import { LOOP_S, PAD_S } from './sounds'
import speech from './loops/speech.mp3'
import singing from './loops/singing.mp3'
import music from './loops/music.mp3'
import drums from './loops/drums.mp3'
import guitar from './loops/guitar.mp3'

// The loops of real sound the sources play (made by scripts/make-loops.py): fetched and decoded the
// first time a chain needs one, then kept. A file may be mono or stereo: a Line In set to Stereo
// plays a stereo file's left and right; everything else plays one channel (its two sides mixed).

/** A sound played from a loop of real sound (the Generator's are made in code: audio/sounds.ts). */
export type LoopKind = Exclude<SoundKind, GeneratorSound>

const FILES: Record<LoopKind, string> = { speech, singing, music, drums, guitar }

/** A loop ready to play: its samples (an average of 1 over the loop), and where in them the loop is (s). */
export interface Loop {
  /** One channel: a stereo file's left and right mixed */
  mono: AudioBuffer
  /** A stereo file's left and right as they are, their average together 1 (none: a mono file) */
  stereo?: AudioBuffer
  start: number
  end: number
}

const loaded = new Map<string, Promise<Loop>>()

/** A loop at `sampleRate`, its average (RMS) set to exactly 1 over the loop — as this browser decodes it. */
export function loopOf(kind: LoopKind, sampleRate: number): Promise<Loop> {
  const key = `${kind}@${sampleRate}`
  let loop = loaded.get(key)
  if (!loop) {
    loop = decode(kind, sampleRate)
    // A failed fetch can be tried again later
    loop.catch(() => loaded.delete(key))
    loaded.set(key, loop)
  }
  return loop
}

async function decode(kind: LoopKind, sampleRate: number): Promise<Loop> {
  const response = await fetch(FILES[kind])
  if (!response.ok) throw new Error(`loop ${kind}: ${response.status}`)
  // Decoded with as many channels as the file has
  const decoded = await new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(await response.arrayBuffer())
  const from    = Math.round(PAD_S * sampleRate)
  const to      = from + Math.round(LOOP_S * sampleRate)
  const loop    = { start: PAD_S, end: PAD_S + LOOP_S }
  const left    = decoded.getChannelData(0)
  if (decoded.numberOfChannels === 1) {
    toAverageOfOne([left], from, to)
    return { mono: decoded, ...loop }
  }

  const right  = decoded.getChannelData(1)
  const length = decoded.length
  const mono   = new AudioBuffer({ numberOfChannels: 1, length, sampleRate })
  const mixed  = mono.getChannelData(0)
  for (let i = 0; i < length; i++) mixed[i] = (left[i] + right[i]) / 2
  toAverageOfOne([mixed], from, to)
  const stereo = new AudioBuffer({ numberOfChannels: 2, length, sampleRate })
  stereo.copyToChannel(left, 0)
  stereo.copyToChannel(right, 1)
  toAverageOfOne([stereo.getChannelData(0), stereo.getChannelData(1)], from, to)
  return { mono, stereo, ...loop }
}

/** The channels scaled alike, so that their average (RMS) together over samples `from` … `to` is 1. */
function toAverageOfOne(channels: Float32Array[], from: number, to: number) {
  let power = 0
  for (const c of channels) for (let i = from; i < to; i++) power += c[i] * c[i]
  const scale = 1 / Math.sqrt(power / ((to - from) * channels.length))
  for (const c of channels) for (let i = 0; i < c.length; i++) c[i] *= scale
}
