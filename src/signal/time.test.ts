import { describe, expect, it } from 'bun:test'
import type { EQBand, NodeParamValue, SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { initialParams } from '../data/nodeRegistry'
import type { WireSignal } from './engine'
import { graphSignal } from './engine'
import type { SideLevels } from './levels'
import { CLIP_DBU, READINGS } from './levels'
import { LOOP_MS, SOUND_KINDS, loopOf, peaksAboveOf, soundKindOf } from './sounds'
import { measureChain, startTime } from './time'

// The time engine against the still picture: over a loop, what leaves every card has the still
// picture's peaks, average and noise — exactly, wherever no dynamics card reacts over time. Then
// what only the moving picture shows: Attack, Release and Hold.

// ── Building a chain (as in engine.test.ts) ─────────────────────────────────────

function card(id: string, typeKey: TypeKey, params: Record<string, NodeParamValue> = {}, bypassed = false): SignalNode {
  return { id, typeKey, position: { x: 0, y: 0 }, params: { ...initialParams(typeKey, 'advanced'), ...params }, bypassed }
}

function wire(from: string, to: string): SignalEdge {
  const [source, sourceHandle = 'out'] = from.split(':')
  const [target, targetHandle = 'in'] = to.split(':')
  return { id: `${from} → ${to}`, source, sourceHandle, target, targetHandle }
}

/** Cards wired one after the other. */
function line(...cards: SignalNode[]): [SignalNode[], SignalEdge[]] {
  return [cards, cards.slice(1).map((c, i) => wire(cards[i].id, c.id))]
}

const sides = (w: WireSignal) => [w.l, w.r]

/** dB to two decimals; silence exactly. */
function expectDb(actual: number, expected: number) {
  if (isFinite(expected)) expect(actual).toBeCloseTo(expected, 2)
  else expect(actual).toBe(expected)
}

/** Every card: what leaves it over a loop has the still picture's readings (`readings`: all of them). */
function expectStillPicture(nodes: SignalNode[], edges: SignalEdge[], readings: readonly (keyof SideLevels)[] = READINGS) {
  const still    = graphSignal(nodes, edges).stages
  const measured = measureChain(nodes, edges)
  expect([...measured.keys()].sort()).toEqual(Object.keys(still).sort())
  for (const [id, moving] of measured) {
    const [l, r] = sides(still[id].out)
    expect(moving.kind).toBe(still[id].out.kind)
    for (const k of readings) {
      expectDb(moving.l[k], l[k])
      expectDb(moving.r[k], r[k])
    }
  }
}

// ── The sounds ──────────────────────────────────────────────────────────────────

describe('every sound, over one loop', () => {
  for (const kind of SOUND_KINDS) {
    it(`${kind}: averages 0 dB; its loudest moment, on the first beat, is the still picture's peaks`, () => {
      const { rms, peak } = loopOf(kind)
      const power = rms.reduce((sum, db) => sum + Math.pow(10, db / 10), 0) / LOOP_MS
      expect(10 * Math.log10(power)).toBeCloseTo(0, 6)
      expect(Math.max(...peak)).toBeCloseTo(peaksAboveOf(kind), 6)
      // Every sound peaks on the first beat, so on a bus their peaks meet as the still picture adds them
      expect(peak[0]).toBe(Math.max(...peak))
      // A peak is never below the level of its moment
      expect(rms.some((db, t) => peak[t] < db)).toBe(false)
    })
  }

  it('a voice pauses between phrases and clicks between beats; the others never stop', () => {
    const silentMs = (kind: typeof SOUND_KINDS[number]) => loopOf(kind).rms.filter((db) => !isFinite(db)).length
    expect(silentMs('voice')).toBeGreaterThan(1000)
    expect(silentMs('click')).toBeGreaterThan(3000)
    for (const kind of ['sine', 'noise', 'keys', 'guitar'] as const) expect(silentMs(kind)).toBe(0)
  })

  it('each source plays what the still picture reads: a voice, keys, drums, a guitar, the Generator its Sound', () => {
    expect(soundKindOf(card('m', 'mic'))).toBe('voice')
    expect(soundKindOf(card('m', 'mic', { character: 'percussive' }))).toBe('drums')
    expect(soundKindOf(card('l', 'line-in'))).toBe('keys')
    expect(soundKindOf(card('l', 'line-in', { character: 'percussive' }))).toBe('drums')
    expect(soundKindOf(card('i', 'instrument'))).toBe('guitar')
    expect(soundKindOf(card('g', 'generator', { sound: 'click' }))).toBe('click')
  })
})

// ── The same picture, still and moving ──────────────────────────────────────────

const EQ_BANDS: EQBand[] = [
  { freqHz: 200,  gainDb: 3,  Q: 1.4, type: 'low-shelf' },
  { freqHz: 500,  gainDb: 0,  Q: 1.4, type: 'bell' },
  { freqHz: 1000, gainDb: -2, Q: 1.4, type: 'bell' },
  { freqHz: 8000, gainDb: 2,  Q: 1.4, type: 'high-shelf' },
]

describe('over a loop, every card shows the still picture: peaks, average, noise and hum', () => {
  it('a channel strip: mic → preamp → HPF → EQ → fader → Master Bus → speakers', () => {
    const [nodes, edges] = line(
      card('mic', 'mic'), card('pre', 'gain', { preampDb: 50 }), card('hpf', 'hpf'),
      card('eq', 'eq', { bands: EQ_BANDS }), card('fader', 'fader', { faderDb: -5 }), card('bus', 'master-bus'),
    )
    expectStillPicture([...nodes, card('spkL', 'active-speaker'), card('spkR', 'active-speaker')],
      [...edges, wire('bus:out-l', 'spkL'), wire('bus:out-r', 'spkR')])
  })

  it('the Preamp 30 dB too low, made up later: the hiss on the way', () => {
    expectStillPicture(...line(
      card('mic', 'mic'), card('pre', 'gain', { preampDb: 20 }), card('eq', 'eq', { bands: EQ_BANDS }),
      card('gain', 'gain', { gainDb: 20 }), card('fader', 'fader', { faderDb: 10 }), card('spk', 'active-speaker'),
    ))
  })

  it('a stereo Master Bus: Pan, Balance, a stereo Line Input and the Main Fader', () => {
    // Keys on every channel: different sounds on one bus come close only (below)
    expectStillPicture([
      card('a', 'line-in', { levelDb: -20 }), card('aPan', 'pan'),
      card('b', 'line-in'), card('bPan', 'pan', { panPosition: 0 }),
      card('c', 'line-in', { stereo: true }), card('cBal', 'pan', { panPosition: 75 }),
      card('bus', 'master-bus'), card('main', 'fader', { faderDb: -3 }),
      card('spkL', 'active-speaker'), card('spkR', 'active-speaker'),
    ], [
      wire('a', 'aPan'), wire('aPan', 'bus'), wire('b', 'bPan'), wire('bPan', 'bus'), wire('c', 'cBal'), wire('cBal', 'bus'),
      wire('bus:mix', 'main'), wire('main:out-l', 'spkL'), wire('main:out-r', 'spkR'),
    ])
  })

  it('drums: Percussive on a Microphone and a Line Input', () => {
    expectStillPicture(...line(card('mic', 'mic', { character: 'percussive' }), card('pre', 'gain', { preampDb: 45 }), card('spk', 'active-speaker')))
    expectStillPicture(...line(card('li', 'line-in', { character: 'percussive', stereo: true }), card('fader', 'fader'), card('spk', 'active-speaker')))
  })

  it('a guitar: a DI Box in a ground loop (the hum), a Guitar Amp and a microphone in front of it', () => {
    expectStillPicture([
      card('gtr', 'instrument'), card('di', 'di-box'), card('amp', 'guitar-amp'),
      card('pre', 'gain'), card('fader', 'fader', { faderDb: -10 }), card('spk', 'active-speaker'),
      card('mic', 'mic'), card('micPre', 'gain'),
    ], [
      wire('gtr', 'di'), wire('di:direct', 'amp'), wire('di', 'pre'), wire('pre', 'fader'), wire('fader', 'spk'),
      wire('amp:sound', 'mic'), wire('mic', 'micPre'),
    ])
  })

  it('into the computer and back: ADC → DAC, an amplifier and a passive speaker — and one without an amp', () => {
    const [nodes, edges] = line(
      card('mic', 'mic'), card('pre', 'gain', { preampDb: 50 }), card('adc', 'adc'), card('dac', 'dac'),
      card('amp', 'amp', { gainDb: -6 }), card('spk', 'speaker'),
    )
    expectStillPicture([...nodes, card('alone', 'speaker')], [...edges, wire('dac', 'alone')])
  })

  it('an aux send (Pre / Post), an Aux Bus, a Matrix Bus with its send knobs, a switch turned off', () => {
    expectStillPicture([
      card('li', 'line-in'), card('fader', 'fader', { faderDb: -6 }), card('relay', 'relay'),
      card('send', 'gain', { gainDb: -3 }), card('aux', 'aux-bus'), card('bus', 'master-bus'),
      card('matrix', 'matrix-bus'), card('off', 'switch', { on: false }), card('spk', 'active-speaker'),
    ], [
      wire('li', 'fader'), wire('li', 'relay:in-a'), wire('fader', 'relay:in-b'), wire('relay', 'send'),
      wire('send', 'aux'), wire('fader', 'bus'), wire('aux', 'matrix'), wire('bus:send', 'matrix'),
      wire('matrix:out-l', 'off'), wire('matrix:out-r', 'spk'),
    ])
  })

  it('the Generator: a sine, noise, and clicks just below clipping', () => {
    for (const [sound, levelDb] of [['sine', 10], ['noise', 0], ['click', 0]] as const) {
      expectStillPicture(...line(card('gen', 'generator', { sound, levelDb }), card('fader', 'fader'), card('spk', 'active-speaker')))
    }
  })

  it('two voices into one bus: +6 dB, as the still picture adds them', () => {
    expectStillPicture([
      card('m1', 'mic'), card('p1', 'gain', { preampDb: 50 }), card('m2', 'mic'), card('p2', 'gain', { preampDb: 50 }),
      card('bus', 'master-bus'), card('spk', 'active-speaker'),
    ], [wire('m1', 'p1'), wire('m2', 'p2'), wire('p1', 'bus'), wire('p2', 'bus'), wire('bus:out-l', 'spk')])
  })
})

describe('where the moving picture can only come close', () => {
  it('different sounds on one bus: the peaks meet on the first beat; the average is up to 1 dB lower', () => {
    // The still picture adds averages as if the sounds rose and fell together; they do not quite
    const nodes = [
      card('mic', 'mic'), card('pre', 'gain', { preampDb: 50 }), card('li', 'line-in'),
      card('gtr', 'instrument'), card('di', 'di-box'), card('diPre', 'gain', { preampDb: 40 }),
      card('gen', 'generator', { levelDb: -10 }), card('bus', 'master-bus'),
    ]
    const edges = [
      wire('mic', 'pre'), wire('pre', 'bus'), wire('li', 'bus'), wire('gtr', 'di'), wire('di', 'diPre'),
      wire('diPre', 'bus'), wire('gen', 'bus'),
    ]
    const still  = graphSignal(nodes, edges).stages.bus.out.l
    const moving = measureChain(nodes, edges).get('bus')!.l
    expectDb(moving.peak, still.peak)
    expectDb(moving.noise, still.noise)
    expect(moving.rms).toBeLessThan(still.rms)
    expect(moving.rms).toBeGreaterThan(still.rms - 1)
  })

  it('clipping: the peaks stop at the clip level as in the still picture; the average can only lose', () => {
    // Clicks at +10 dBu: some moments are louder than the clip level itself, and lose power there
    const [nodes, edges] = line(card('gen', 'generator', { sound: 'click', levelDb: 10 }), card('gain', 'gain'), card('spk', 'active-speaker'))
    const still    = graphSignal(nodes, edges).stages
    const measured = measureChain(nodes, edges)
    for (const id of ['gen', 'gain', 'spk']) {
      expectDb(measured.get(id)!.l.peak, CLIP_DBU)
      expectDb(still[id].out.l.peak, CLIP_DBU)
      expect(measured.get(id)!.l.rms).toBeLessThan(still[id].out.l.rms)
    }
  })

  it('a noise gate set between the noise and the music: the noise as in the still picture, the music within 0.1 dB', () => {
    // Opening takes a millisecond (Attack): the first moment of each phrase is a little quieter
    const [nodes, edges] = line(card('mic', 'mic'), card('pre', 'gain', { preampDb: 50 }), card('gate', 'noise-gate'), card('spk', 'active-speaker'))
    expectStillPicture(nodes, edges, ['peak', 'noise', 'hum'])
    const still  = graphSignal(nodes, edges).stages.spk.out.l
    const moving = measureChain(nodes, edges).get('spk')!.l
    expect(Math.abs(moving.rms - still.rms)).toBeLessThan(0.1)
  })

  it('every dynamics card: what you hear when the music stops is the still picture\'s noise', () => {
    const [nodes, edges] = line(
      card('mic', 'mic', { character: 'percussive' }), card('pre', 'gain', { preampDb: 50 }),
      card('comp', 'comp', { thresholdDb: -30, ratio: 4, makeupGainDb: 6 }), card('gate', 'noise-gate', { rangeDb: -40 }),
      card('lim', 'limiter', { thresholdDb: -20, makeupGainDb: 3 }), card('de', 'deesser'), card('spk', 'active-speaker'),
    )
    expectStillPicture(nodes, edges, ['noise', 'hum'])
  })

  it('a steady sine through a compressor: the average as in the still picture', () => {
    const [nodes, edges] = line(card('gen', 'generator', { levelDb: 10 }), card('comp', 'comp', { thresholdDb: -20, ratio: 4 }))
    expectStillPicture(nodes, edges, ['rms', 'noise'])
  })
})

// ── What only the moving picture shows ──────────────────────────────────────────

/** Runs `run` for `ms` milliseconds. */
function play(run: ReturnType<typeof startTime>, ms: number) {
  for (let i = 0; i < ms; i++) run.tick()
}

describe('a compressor over time: Attack and Release', () => {
  // A +10 dBu sine through a switch into a compressor at −20 dBu, 4:1: settled, it turns down 22.5 dB
  const chain = (on: boolean, comp: Record<string, NodeParamValue> = {}) => line(
    card('gen', 'generator', { levelDb: 10 }), card('sw', 'switch', { on }),
    card('comp', 'comp', { thresholdDb: -20, ratio: 4, attackMs: 10, releaseMs: 100, ...comp }),
  )
  const SETTLED = 22.5

  it('settles where its curve says', () => {
    const run = startTime(...chain(true))
    play(run, 1000)
    expect(run.dynamicsOf('comp')!.reductionDb).toBeCloseTo(SETTLED, 1)
  })

  it('Attack: the sound starts, and it takes the Attack time to get most of the way (63 %)', () => {
    const run = startTime(...chain(false))
    play(run, 100)
    expect(run.dynamicsOf('comp')!.reductionDb).toBeCloseTo(0, 6)
    run.update(...chain(true))
    play(run, 10)
    expect(run.dynamicsOf('comp')!.reductionDb).toBeCloseTo(SETTLED * (1 - Math.exp(-1)), 1)
  })

  it('Release: the sound stops, and it lets go over the Release time (to 37 %)', () => {
    const run = startTime(...chain(true))
    play(run, 1000)
    run.update(...chain(false))
    play(run, 100)
    expect(run.dynamicsOf('comp')!.reductionDb).toBeCloseTo(SETTLED * Math.exp(-1), 1)
  })

  it('a slow Attack lets the start of each drum hit through: higher peaks than a quick one', () => {
    const drums = (attackMs: number) => line(
      card('mic', 'mic', { character: 'percussive' }), card('pre', 'gain', { preampDb: 50 }),
      card('comp', 'comp', { thresholdDb: -30, ratio: 4, attackMs }),
    )
    const peakWith = (attackMs: number) => measureChain(...drums(attackMs)).get('comp')!.l.peak
    expect(peakWith(50)).toBeGreaterThan(peakWith(1) + 6)
  })
})

describe('a noise gate over time: Hold, Release and Attack', () => {
  // A sine at 0 dBu (open) or −60 dBu (under the −40 dBu threshold: closed, −80 dB)
  const chain = (levelDb: number) => line(
    card('gen', 'generator', { levelDb }),
    card('gate', 'noise-gate', { thresholdDb: -40, rangeDb: -80, holdMs: 50, attackMs: 1, releaseMs: 100 }),
  )

  it('Hold: the sound drops under the threshold and the gate stays open for the Hold time, then Release closes it', () => {
    const run = startTime(...chain(0))
    play(run, 200)
    expect(run.dynamicsOf('gate')!.open).toBe(true)
    run.update(...chain(-60))
    play(run, 50)
    expect(run.dynamicsOf('gate')).toEqual({ reductionDb: run.dynamicsOf('gate')!.reductionDb, open: true, holdLeftMs: 0 })
    expect(run.dynamicsOf('gate')!.reductionDb).toBeCloseTo(0, 6)
    play(run, 1)
    expect(run.dynamicsOf('gate')!.open).toBe(false)
    play(run, 99)
    expect(run.dynamicsOf('gate')!.reductionDb).toBeCloseTo(80 * (1 - Math.exp(-1)), 1)
  })

  it('Attack: the sound comes back over the threshold and the gate opens within its Attack time', () => {
    const run = startTime(...chain(-60))
    play(run, 2000)
    expect(run.dynamicsOf('gate')!.reductionDb).toBeCloseTo(80, 1)
    run.update(...chain(0))
    play(run, 1)
    expect(run.dynamicsOf('gate')!.reductionDb).toBeCloseTo(80 * Math.exp(-1), 1)
  })
})

describe('a limiter over time', () => {
  it('no peak gets past its ceiling, not even for a millisecond', () => {
    const run = startTime(...line(
      card('mic', 'mic', { character: 'percussive' }), card('pre', 'gain', { preampDb: 55 }),
      card('lim', 'limiter', { thresholdDb: -10, makeupGainDb: 3 }),
    ))
    let loudest = -Infinity
    for (let i = 0; i < LOOP_MS; i++) loudest = Math.max(loudest, run.tick().cards.get('lim')!.out.l.peak)
    expect(loudest).toBeCloseTo(-7, 6)
  })
})

describe('the run itself', () => {
  const [nodes, edges] = line(
    card('mic', 'mic', { character: 'percussive' }), card('pre', 'gain', { preampDb: 50 }),
    card('comp', 'comp'), card('gate', 'noise-gate'), card('spk', 'active-speaker'),
  )
  const levels = (run: ReturnType<typeof startTime>, ms: number) =>
    Array.from({ length: ms }, () => run.tick().cards.get('spk')!.out.l)

  it('plays the same every time', () => {
    expect(levels(startTime(nodes, edges), 1500)).toEqual(levels(startTime(nodes, edges), 1500))
  })

  it('a change to the chain carries on: the same moment of the sound, the dynamics where they were', () => {
    const run = startTime(nodes, edges)
    play(run, 700)
    const before = { ...run.dynamicsOf('comp')! }
    const quieter = nodes.map((n) => (n.id === 'spk' ? card('spk', 'active-speaker', { volumeDb: -10 }) : n))
    run.update(quieter, edges)
    expect(run.t).toBe(700)
    expect(run.dynamicsOf('comp')).toEqual(before)
    // The next millisecond is the 701st of the sound, 10 dB quieter at the speaker
    const next = startTime(nodes, edges)
    play(next, 700)
    expect(run.tick().cards.get('spk')!.out.l.rms).toBeCloseTo(next.tick().cards.get('spk')!.out.l.rms - 10, 6)
  })

  it('a card taken out of the chain is forgotten', () => {
    const run = startTime(nodes, edges)
    play(run, 10)
    run.update(nodes.filter((n) => n.id !== 'comp'), [wire('mic', 'pre'), wire('pre', 'gate'), wire('gate', 'spk')])
    expect(run.dynamicsOf('comp')).toBeUndefined()
    expect(run.dynamicsOf('gate') === undefined).toBe(false)
  })
})
