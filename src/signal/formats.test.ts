import { describe, expect, it } from 'bun:test'
import { card, expectCards, line, signalOf, wire } from '../../test/chains'
import { FILE_FORMAT, WAV_FORMAT, ditherFloorDbfs, kbpsOf, pcmKbps, unpackedRate } from './formats'

// What the numbers on a digital wire are (D36), and the round trip to the listeners (D37).

describe('a format (D36)', () => {
  it('is as big as its numbers: rate × bits × 2 channels', () => {
    expect(pcmKbps({ kind: 'pcm', rate: 44100, bits: 16 })).toBe(1411.2)
    expect(pcmKbps({ kind: 'pcm', rate: 48000, bits: 24 })).toBe(2304)
    expect(kbpsOf(FILE_FORMAT)).toBe(128)
  })

  it('comes back from Opus at 48 kHz always, from MP3 at 48 kHz at most; AAC keeps its rate', () => {
    expect(unpackedRate('opus', 44100)).toBe(48000)
    expect(unpackedRate('mp3', 96000)).toBe(48000)
    expect(unpackedRate('mp3', 44100)).toBe(44100)
    expect(unpackedRate('aac', 96000)).toBe(96000)
  })

  it('rounded to 16 bits and dithered, hisses at −96.3 dBFS; at 24 bits at −144.5', () => {
    expect(ditherFloorDbfs(16)).toBeCloseTo(-96.33, 2)
    expect(ditherFloorDbfs(24)).toBeCloseTo(-144.49, 2)
  })
})

describe('the formats along a chain (D36)', () => {
  const result = signalOf([
    line('keys'),
    card('adc', 'adc', { sampleRate: 44100, bitDepth: 16 }),
    card('gain', 'gain'),
    card('cod', 'codec', { codec: 'opus', bitrate: 64 }),
    card('air', 'broadcast'),
    card('dec', 'codec', { codec: 'opus', encodes: false }),
    card('dac', 'dac'),
    card('file', 'pc'),
    card('daw', 'daw'),
    card('idle', 'codec', { encodes: false }),
  ], [
    wire('keys', 'adc'), wire('adc', 'gain'), wire('gain', 'cod'), wire('cod', 'air'), wire('air', 'dec'),
    wire('dec', 'dac'), wire('file:digital', 'daw'),
  ])
  const cd = { kind: 'pcm', rate: 44100, bits: 16 } as const

  it('an analog signal has none', () => {
    expect(result.stages.keys.format).toBeUndefined()
    expect(result.stages.adc.inFormat).toBeUndefined()
  })

  it('an ADC writes its sample rate and bit depth; a card after it passes them on', () => {
    expect(result.stages.adc.format).toEqual(cd)
    expect(result.stages.gain.format).toEqual(cd)
  })

  it('a Codec squeezes them into its codec and bitrate, and Stream / Broadcast sends that', () => {
    const opus = { kind: 'coded', codec: 'opus', kbps: 64, from: cd }
    expect(result.stages.cod.inFormat).toEqual(cd)
    expect(result.stages.cod.format).toEqual(opus)
    expect(result.stages.air.format).toEqual(opus)
  })

  it('a Codec unpacks the stream into 32-bit float at its codec\'s rate (Opus: 48 kHz); after a DAC there is none', () => {
    expect(result.stages.dec.format).toEqual({ kind: 'pcm', rate: 48000, bits: 32 })
    expect(result.stages.dac.inFormat).toEqual({ kind: 'pcm', rate: 48000, bits: 32 })
    expect(result.stages.dac.format).toBeUndefined()
  })

  it('a Codec on its own plays nothing (D41); the DAW mixes in 32-bit float', () => {
    expect(result.stages.idle.format).toBeUndefined()
    expect(result.stages.idle.out.l.rms).toBe(-Infinity)
    expect(result.stages.daw.format).toEqual({ kind: 'pcm', rate: 48000, bits: 32 })
  })

  it('a file played (the DAW\'s playback below Advanced, a Codec\'s job) is an MP3 from CD sound', () => {
    expect(FILE_FORMAT).toEqual({ kind: 'coded', codec: 'mp3', kbps: 128, from: { kind: 'pcm', rate: 44100, bits: 16 } })
  })

  it('a Codec unpacking a stream of another codec is silent, and says so', () => {
    const r = signalOf([card('keys', 'keyboard'), card('adc', 'adc'), card('cod', 'codec'), card('air', 'broadcast'),
      card('dec', 'codec', { codec: 'aac', encodes: false })],
    [wire('keys', 'adc'), wire('adc', 'cod'), wire('cod', 'air'), wire('air', 'dec')])
    expect(r.stages.dec.condition).toBe('otherCodec')
    expect(r.stages.dec.format).toBeUndefined()
    expect(r.stages.dec.out.l.rms).toBe(-Infinity)
  })
})

// D37: what Stream / Broadcast sends, through a Codec unpacking and a DAC, is heard — the level kept
describe('the round trip: Stream / Broadcast → Codec → DAC', () => {
  expectCards(signalOf([
    card('keys', 'keyboard'),
    card('adc', 'adc'),
    card('cod', 'codec'),
    card('air', 'broadcast'),
    card('dec', 'codec', { encodes: false }),
    card('dac', 'dac'),
  ], [
    wire('keys', 'adc'), wire('adc', 'cod'), wire('cod', 'air'), wire('air', 'dec'), wire('dec', 'dac'),
  ]), {
    keys: { out: [-10, -10], health: 'good' },
    adc: { in: [-10, -10], out: [-28, -28], health: 'good', domain: 'digital' },
    cod: { in: [-28, -28], out: [-28, -28], health: 'good', domain: 'digital', inDomain: 'digital' },
    air: { in: [-28, -28], out: [-28, -28], health: 'good', domain: 'digital', inDomain: 'digital' },
    dec: { in: [-28, -28], out: [-28, -28], health: 'good', domain: 'digital', inDomain: 'digital' },
    dac: { in: [-28, -28], out: [-10, -10], health: 'good', domain: 'analog', inDomain: 'digital' },
  })
})

// D40: a Digital Interface packs PCM wires into one cable and unpacks them, the numbers unchanged;
// its two ends need one clock between them
describe('a Digital Interface\'s cable (D40)', () => {
  const chain = (pack: Record<string, string> = {}, unpack: Record<string, string> = {}, rates = [48000, 48000]) => signalOf([
    line('a'), card('adcA', 'adc', { sampleRate: rates[0] }),
    card('keys', 'keyboard'), card('adcK', 'adc', { sampleRate: rates[1] }),
    card('pack', 'digital-interface', { protocol: 'aes50', ...pack }),
    card('unpack', 'digital-interface', { packs: false, clock: 'external', ...unpack }),
    card('daw', 'daw'),
  ], [
    wire('a', 'adcA'), wire('keys', 'adcK'),
    wire('adcA', 'pack:in'), wire('adcK', 'pack:in2'),
    wire('pack:link', 'unpack:link'),
    wire('unpack:out', 'daw'), wire('unpack:out2', 'daw'),
  ])

  it('each channel comes out as it went in: its level, its kind, its format', () => {
    const r = chain()
    expect(r.wires.get('unpack:out')).toEqual(r.wires.get('adcA:out'))
    expect(r.wires.get('unpack:out2')).toEqual(r.wires.get('adcK:out'))
    expect(r.wires.get('unpack:out2')?.kind).toBe('stereo')
    expect(r.stages.unpack.format).toEqual({ kind: 'pcm', rate: 48000, bits: 24 })
    expect(r.stages.unpack.condition).toBeUndefined()
  })


  it('both on their own clock: both warn of clicks and dropouts — the signal still passes', () => {
    const r = chain({}, { clock: 'internal' })
    expect(r.stages.pack.condition).toBe('twoClocks')
    expect(r.stages.unpack.condition).toBe('twoClocks')
    expect(r.wires.get('unpack:out')).toEqual(r.wires.get('adcA:out'))
  })

  it('both waiting for the other\'s clock: both warn', () => {
    const r = chain({ clock: 'external' })
    expect(r.stages.pack.condition).toBe('noClock')
    expect(r.stages.unpack.condition).toBe('noClock')
  })

  it('wires at different sample rates: one cable runs at one rate — silent', () => {
    const r = chain({}, {}, [48000, 96000])
    expect(r.stages.pack.condition).toBe('mixedRates')
    expect(r.wires.get('unpack:out')?.l.rms).toBe(-Infinity)
  })

  it('AES/EBU carries two channels: a mono wire fits, the stereo one after it does not', () => {
    const r = chain({ protocol: 'aes3' }, { protocol: 'aes3' })
    expect(r.wires.get('unpack:out')).toEqual(r.wires.get('adcA:out'))
    expect(r.wires.get('unpack:out2')?.l.rms).toBe(-Infinity)
  })

  it('its two ends set to different protocols: silent, and both say so', () => {
    const r = chain({ protocol: 'aes3' })
    expect(r.stages.pack.condition).toBe('otherProtocol')
    expect(r.stages.unpack.condition).toBe('otherProtocol')
    expect(r.wires.get('unpack:out')?.l.rms).toBe(-Infinity)
  })

  it('fed an analog signal, it sends nothing', () => {
    const r = signalOf([line('a'), card('pack', 'digital-interface')], [wire('a', 'pack:in')])
    expect(r.stages.pack.condition).toBe('interfaceNeedsDigital')
  })

  it('a computer\'s 32-bit float leaves as 24-bit: what the protocols carry', () => {
    const r = signalOf([card('file', 'pc'), card('daw', 'daw'), card('pack', 'digital-interface')],
      [wire('file:digital', 'daw'), wire('daw', 'pack:in')])
    expect(r.stages.pack.inFormat).toEqual({ kind: 'pcm', rate: 48000, bits: 32 })
    expect(r.stages.pack.format).toEqual({ kind: 'pcm', rate: 48000, bits: 24 })
  })
})

describe('the Computer\'s Digital output (D40)', () => {
  const r = signalOf([card('pc', 'pc'), card('daw', 'daw'), card('dac', 'dac')], [wire('pc:digital', 'daw'), wire('pc', 'dac')])

  it('sends its WAV file as numbers: 18 dB under its analog output, in dBFS', () => {
    expect(r.wires.get('pc:out')?.l.rms).toBe(0)
    expect(r.wires.get('pc:digital')?.l.rms).toBe(-18)
    expect(r.stages.pc.outDomains?.digital).toBe('digital')
    expect(r.stages.daw.inFormat).toEqual(WAV_FORMAT)
    expect(r.stages.daw.inDomain).toBe('digital')
  })

  it('its analog output is analog: a DAC fed it says so', () => {
    expect(r.stages.dac.condition).toBe('dacExpectsDigital')
  })
})
