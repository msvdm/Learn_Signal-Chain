import type { GeneratorSound } from '../data/nodeRegistry'
import type { SoundKind } from '../signal/process'
import { LOOP_S, PAD_S } from './sounds'
import speech from './loops/speech.mp3'
import singing from './loops/singing.mp3'
import music from './loops/music.mp3'
import drums from './loops/drums.mp3'
import guitar from './loops/guitar.mp3'

// The loops of real sound the sources play (made by scripts/make-loops.py): fetched and decoded the
// first time a chain needs one, then kept.

/** A sound played from a loop of real sound (the Generator's are made in code: audio/sounds.ts). */
export type LoopKind = Exclude<SoundKind, GeneratorSound>

const FILES: Record<LoopKind, string> = { speech, singing, music, drums, guitar }

/** A loop ready to play: its samples (an average of 1 over the loop), and where in them the loop is (s). */
export interface Loop {
  buffer: AudioBuffer
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
  const buffer = await new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(await response.arrayBuffer())
  const data   = buffer.getChannelData(0)
  const from   = Math.round(PAD_S * sampleRate)
  const to     = from + Math.round(LOOP_S * sampleRate)
  let power = 0
  for (let i = from; i < to; i++) power += data[i] * data[i]
  const scale = 1 / Math.sqrt(power / (to - from))
  for (let i = 0; i < data.length; i++) data[i] *= scale
  return { buffer, start: PAD_S, end: PAD_S + LOOP_S }
}
