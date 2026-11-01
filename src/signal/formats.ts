import type { Codec, LinkProtocol } from '../data/nodeRegistry'
import { param } from '../data/nodeRegistry'
import type { CardPlan } from './chain'

// What the numbers on a digital wire are (D36): how a converter turned the sound into numbers — its
// sample rate and bit depth (PCM) — or, after a Codec, the codec and the bitrate it was squeezed
// into. A walk over the plan, like the domains: structural, no levels.

/** How many times a second a converter measures the sound (Hz) */
export const SAMPLE_RATES = [44100, 48000, 96000] as const
/** How finely each measurement is written (bits); 32 is the computer's own: 32-bit float */
export const BIT_DEPTHS = [16, 24] as const
/** How many kilobits a second a Codec squeezes a stereo stream into */
export const BITRATES = [64, 128, 320] as const
export type BitDepth = typeof BIT_DEPTHS[number] | 32

/** Sound as numbers, one per measurement (PCM) */
export interface PcmFormat {
  kind: 'pcm'
  rate: number
  bits: BitDepth
}

/** Numbers packed into a smaller stream (MP3, AAC, Opus), and what was packed */
export interface CodedFormat {
  kind: 'coded'
  codec: Codec
  kbps: number
  from: PcmFormat
}

export type DigitalFormat = PcmFormat | CodedFormat

/** A file played (the DAW's playback below Advanced): packed as MP3 at 128 kb/s from CD sound (44.1 kHz, 16-bit) */
export const FILE_FORMAT: CodedFormat = { kind: 'coded', codec: 'mp3', kbps: 128, from: { kind: 'pcm', rate: 44100, bits: 16 } }

/**
 * What the Computer plays (D40): a WAV file — PCM in a file, the numbers as they are, with a header
 * saying how to read them — at 48 kHz, 24-bit, a recording's usual format. Its Digital output sends
 * these numbers; its Analog output, through its own DAC, the sound.
 */
export const WAV_FORMAT: PcmFormat = { kind: 'pcm', rate: 48000, bits: 24 }

/**
 * How many channels a protocol carries on one cable (D40): AES/EBU (AES3) two, at any rate; AES50 48
 * each way at 44.1 or 48 kHz, 24 at 96 kHz.
 */
export function linkCapacity(protocol: LinkProtocol, rate: number): number {
  if (protocol === 'aes3') return 2
  return rate > 48000 ? 24 : 48
}

/** The most bits a protocol carries per sample: AES/EBU and AES50 24 (a computer's 32-bit float is rounded to it) */
export const LINK_BITS = 24

/** A program unpacking or mixing works in 32-bit float, at the rate it gets */
const inFloat = (rate: number): PcmFormat => ({ kind: 'pcm', rate, bits: 32 })

/**
 * The rate a stream packed at `rate` comes back at: Opus always works at 48 kHz, MP3 at most at
 * 48 kHz (96 kHz is made 48 before packing); AAC keeps it
 */
export function unpackedRate(codec: Codec, rate: number): number {
  return codec === 'opus' ? 48000 : codec === 'mp3' ? Math.min(rate, 48000) : rate
}

/** A stereo PCM stream's size (kilobits a second): rate × bits × 2 channels */
export function pcmKbps(f: PcmFormat): number {
  return (f.rate * f.bits * 2) / 1000
}

/** A format's size (kb/s) */
export const kbpsOf = (f: DigitalFormat): number => (f.kind === 'pcm' ? pcmKbps(f) : f.kbps)

/**
 * The noise floor of a converter writing `bits` bits, dithered (dBFS): its rounding, with the
 * triangular dither that keeps quiet sounds from breaking up, is a hiss at half a step — 16-bit
 * −96.3 dBFS, 24-bit −144.5 (far under any converter's analog noise).
 */
export function ditherFloorDbfs(bits: number): number {
  return 20 * Math.log10(Math.pow(2, -bits))
}

/** Formats by plan key (`in`: what its first wire carries, `out`: what it sends) and by output key. */
export interface Formats {
  cards: Map<string, { in?: DigitalFormat; out?: DigitalFormat }>
  outputs: Map<string, DigitalFormat>
}

/**
 * The format on every digital wire, in signal order. An ADC (an Audio Interface's too) writes its
 * sample rate and bit depth; a Codec squeezes PCM into its codec and bitrate, or unpacks a stream —
 * as a route's job, its file — into 32-bit float at the rate its codec gives back (unpackedRate); the
 * DAW mixes in 32-bit float; a DAC turns it back into sound (none after it); a Digital Interface passes
 * the numbers on, at 24 bits at most; the Computer's Digital output sends its WAV file's; every other card passes
 * on what its first wire carries (none on an analog chain).
 */
export function formatsOf(plans: CardPlan[]): Formats {
  const cards   = new Map<string, { in?: DigitalFormat; out?: DigitalFormat }>()
  const outputs = new Map<string, DigitalFormat>()
  for (const card of plans) {
    const { job } = card
    const first   = card.used[0]
    const inF     = first ? outputs.get(first.key) : undefined
    let out: DigitalFormat | undefined
    switch (job.typeKey) {
      case 'adc':
        out = inF ? undefined : { kind: 'pcm', rate: param(job, 'sampleRate'), bits: param(job, 'bitDepth') as BitDepth }
        break
      case 'dac':
        out = undefined
        break
      // Squeezes PCM into its codec at its bitrate, or unpacks a stream into 32-bit float (D41); as a
      // route's job (the DAW's playback) its file
      case 'codec': {
        if (!card.plays && param(job, 'encodes')) {
          out = inF?.kind === 'pcm' ? { kind: 'coded', codec: param(job, 'codec'), kbps: param(job, 'bitrate'), from: inF } : undefined
          break
        }
        // (a stream of another codec it cannot unpack: nothing — D41)
        const packed = card.plays ? FILE_FORMAT : inF
        const theirs = card.plays || packed?.kind !== 'coded' || packed.codec === param(job, 'codec')
        out = packed?.kind === 'coded' && theirs ? inFloat(unpackedRate(packed.codec, packed.from.rate)) : undefined
        break
      }
      case 'daw':
        out = inF?.kind === 'pcm' ? inFloat(inF.rate) : undefined
        break
      // Packs and unpacks the numbers as they are (D40) — but a protocol carries 24 bits at most
      case 'digital-interface':
        out = inF?.kind === 'pcm' ? { ...inF, bits: Math.min(inF.bits, LINK_BITS) as BitDepth } : undefined
        break
      default:
        out = inF
    }
    // A file played shows the file as what arrives
    const shownIn = job.typeKey === 'codec' && card.plays ? FILE_FORMAT : inF
    cards.set(card.key, { ...(shownIn ? { in: shownIn } : {}), ...(out ? { out } : {}) })
    for (const o of card.outputs) {
      // The Computer's Digital output: the file it plays, as numbers (D40)
      const sent = o.tap === 'digital' ? WAV_FORMAT : out
      if (sent) outputs.set(o.key, sent)
    }
  }
  return { cards, outputs }
}
