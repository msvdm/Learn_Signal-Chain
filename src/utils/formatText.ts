import type { Translations } from '../i18n/translations'
import { fmt } from '../i18n/translations'
import type { DigitalFormat, PcmFormat } from '../signal/formats'
import { kbpsOf } from '../signal/formats'

// A digital format in words (D36): "48 kHz · 24-bit", "MP3 · 128 kb/s".

/** A sample rate: "44.1 kHz", "48 kHz" */
export const rateText = (t: Translations, rate: number): string => fmt(t.formats.rate, { n: String(rate / 1000) })

/** A bit depth: "16-bit", "32-bit float" */
export const bitsText = (t: Translations, bits: number): string => (bits === 32 ? t.formats.float : fmt(t.formats.bits, { n: String(bits) }))

/** A size in kilobits a second, whole: "2304 kb/s" */
export const kbpsText = (t: Translations, kbps: number): string => fmt(t.formats.kbps, { n: String(Math.round(kbps)) })

/** What a codec is called on its button (the Codec's words) */
export const codecText = (t: Translations, codec: string): string =>
  t.nodes.codec.codecs[codec as keyof Translations['nodes']['codec']['codecs']] ?? codec.toUpperCase()

/** A format by name: PCM its rate and bits, a packed stream its codec and bitrate. */
export function formatText(t: Translations, f: DigitalFormat): string {
  return f.kind === 'pcm' ? pcmText(t, f) : `${codecText(t, f.codec)} · ${kbpsText(t, f.kbps)}`
}

const pcmText = (t: Translations, f: PcmFormat): string => `${rateText(t, f.rate)} · ${bitsText(t, f.bits)}`

/** How many times smaller packing made it: "18× smaller" (whole) */
export const smallerText = (t: Translations, from: DigitalFormat, to: DigitalFormat): string =>
  fmt(t.formats.smaller, { n: String(Math.round(kbpsOf(from) / kbpsOf(to))) })
