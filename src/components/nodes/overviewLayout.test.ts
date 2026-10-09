import { describe, expect, it } from 'bun:test'
import type { OverviewInput } from './overviewLayout'
import { NAME_GAP, PAD, overviewLayout } from './overviewLayout'

// The zoomed-out face's layout, with text measured by a stand-in (no canvas here): every letter
// 0.55 em wide in the sans font, 0.6 in the mono one — close to the page's.
const width = (text: string, family: string) => [...text].length * (family === 'mono' ? 0.6 : 0.55)

/** A full card at Intermediate: its name, its meter with the Peak / RMS / Noise rows, English words. */
const card = (o: Partial<OverviewInput> = {}): OverviewInput => ({
  W: 412, H: 361, label: 'Amplifier', sans: 'sans', mono: 'mono',
  rows: true, rowNames: ['Peak', 'RMS', 'Noise'], healthWords: ['Too Quiet', 'Good', 'Hot', 'Clipping!'],
  showLevel: true, barOnly: false, stereo: false, bypassed: false, reserveRight: 0, spl: false,
  ...o,
})

/** The face's height inside its padding. */
const faceH = (H: number) => H - 2 - PAD * 2

describe('overviewLayout', () => {
  it('a card of today: the level block as big as half the face allows, the name in the rest', () => {
    const l = overviewLayout(card(), width)
    const { number, unit, bar, meterH, scale, labelW, blockH, health, ownRow, tag } = l
    expect({ number, unit, bar, meterH, scale, labelW, blockH, health, ownRow, tag })
      .toEqual({ number: 26, unit: 17, bar: 24, meterH: 24, scale: 13, labelW: 54, blockH: 145, health: 19, ownRow: false, tag: 13 })
    expect(l.nameW).toBe(412 - 2 - PAD * 2)
    expect(l.blockH + NAME_GAP).toBeLessThanOrEqual(faceH(361) / 2)
    expect(l.nameH).toBe(faceH(361) - l.blockH - NAME_GAP)
    expect(l.name).toEqual({ fontSize: 71, lines: ['Amplifier'] })
  })

  it('keeps the level block within half the face: a bigger card gets bigger numbers, never above 44 or below 24', () => {
    const big = overviewLayout(card({ W: 700, H: 700 }), width)
    expect(big.number).toBeGreaterThan(overviewLayout(card(), width).number)
    expect(big.blockH + NAME_GAP).toBeLessThanOrEqual(faceH(700) / 2)
    expect(overviewLayout(card({ W: 1000, H: 1000 }), width).number).toBe(44)
    expect(overviewLayout(card({ H: 120 }), width).number).toBe(24)
  })

  it('stereo: two bars, each 0.7 of the one, a gap between them', () => {
    const l = overviewLayout(card({ stereo: true }), width)
    expect(l.bar).toBe(17)
    expect(l.meterH).toBe(17 * 2 + 8)
  })

  it('the meter alone (barOnly): no numbers under it, a shorter block', () => {
    const alone = overviewLayout(card({ barOnly: true, rows: false }), width)
    expect(alone.blockH).toBeLessThan(overviewLayout(card(), width).blockH)
    expect(alone.labelW).toBe(0)
  })

  it('Beginner (no rows): one number, no row names', () => {
    const l = overviewLayout(card({ rows: false }), width)
    expect(l.labelW).toBe(0)
    expect(l.blockH).toBeLessThan(overviewLayout(card(), width).blockH)
  })

  it('a narrow card puts its health word on its own row', () => {
    expect(overviewLayout(card(), width).ownRow).toBe(false)
    expect(overviewLayout(card({ W: 200 }), width).ownRow).toBe(true)
  })

  it('room kept on the right (a face card zoomed in) narrows the name', () => {
    expect(overviewLayout(card({ reserveRight: 92 }), width).nameW).toBe(412 - 2 - PAD * 2 - 92)
  })

  it('bypassed: the tag takes room from the name, not from the face', () => {
    const on  = overviewLayout(card({ label: 'Compressor' }), width)
    const off = overviewLayout(card({ label: 'Compressor', bypassed: true }), width)
    expect(off.nameH).toBe(on.nameH)
    expect(off.name.fontSize).toBeLessThanOrEqual(on.name.fontSize)
    expect(off.tag).toBe(Math.round(off.number * 0.5))
  })

  it('a long name goes onto two lines when that makes it bigger', () => {
    const l = overviewLayout(card({ label: 'Digital to Analog Converter' }), width)
    expect(l.name.lines.length).toBe(2)
  })

  it('no level block (a face card zoomed in): the art takes the whole face', () => {
    expect(overviewLayout(card({ showLevel: false }), width).nameH).toBe(faceH(361))
  })
})
