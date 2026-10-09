import type { FitResult } from '../../utils/fitText'
import { fitText } from '../../utils/fitText'
import type { TextWidth } from '../../utils/fitText'

// What a card's zoomed-out face (OverviewFace.tsx) is made of, worked out from the card's size: the
// name as big as it fits, and the level block under it — the meter, its scale, its numbers and the
// health word. Pure: the text is measured by the function it is given (the page's canvas, or a test's).

// All sizes follow the card's measured width W
export const PAD           = 20        // around the name and the level block
export const NAME_GAP      = 12        // between the name area and the level block
export const METER_GAP     = 10        // between the meter's scale and the level row
export const SCALE_GAP     = 4         // between the meter and its scale (−∞, unity, the top — D16)
const SCALE_RATIO          = 0.75      // the scale's numbers, relative to the unit
export const ROW_GAP       = 6         // between the Peak, RMS and Noise rows (from Intermediate)
const LEVEL_SHARE          = 0.5       // the most of the face's height the level block takes
const SIDES_BAR            = 0.7       // stereo: each of the L and R bars, relative to the one mono bar
const SIDES_GAP            = 0.35      // stereo: between them, relative to the mono bar
export const HEALTH_GAP    = 12        // between the level number and the health word
const NAME_MAX             = 96
const NUMBER_MIN           = 24
const BAR_H                = 24        // the meter's bar: one thickness on every card (stereo: SIDES_BAR of it each)
const NUMBER_MAX           = 44
const UNIT_RATIO           = 0.65
const HEALTH_MAX           = 0.75      // health word, relative to the number
const HEALTH_MIN           = 0.55      // below this it moves to its own row
export const NUMBER_SAMPLE = '-00.0'   // widest level reading (formatDb, mono font)

/** A MeterScaleRow's height per px of its labels: the labels and their ticks up to the bar. */
export const SCALE_ROW = 1.3

export interface OverviewInput {
  /** The card's size as React Flow measured it */
  W: number
  H: number
  /** The name (shown when there is no art) */
  label: string
  /** The name's largest font size (its type's NODE_LOOK nameMax; NAME_MAX when none) */
  nameMax?: number
  /** The page's fonts, resolved (canvas cannot read CSS variables) */
  sans: string
  mono: string
  /** The Peak, RMS and Noise rows under the meter (from Intermediate, unless the meter stands alone) */
  rows: boolean
  /** Their names, and every health word */
  rowNames: string[]
  healthWords: string[]
  showLevel: boolean
  /** The level block is the meter alone */
  barOnly: boolean
  /** Two bars, L above R */
  stereo: boolean
  bypassed: boolean
  /** Room kept free on the right (px): a face-only card's upright meter, zoomed in */
  reserveRight: number
  /** The level reads dB SPL */
  spl: boolean
}

export interface OverviewLayout {
  /** The level numbers' size, their unit's, the bars' thickness, the meter's height, the scale's size */
  number: number
  unit: number
  bar: number
  meterH: number
  scale: number
  /** The Peak / RMS / Noise names' width (0 without the rows) */
  labelW: number
  /** The level block's height */
  blockH: number
  /** The health word's size, and whether it takes its own row */
  health: number
  ownRow: boolean
  /** The name's (or the art's) box, and the name as it fits it */
  nameW: number
  nameH: number
  name: FitResult
  /** The Bypassed tag's size */
  tag: number
}

/** The face of a card this big: the level block at most half of it, the name in the rest. */
export function overviewLayout(o: OverviewInput, width: TextWidth): OverviewLayout {
  const { W, H, sans, mono, rows, stereo, barOnly, showLevel } = o
  // Inside the 1px border
  const innerW = W - 2 - PAD * 2 - o.reserveRight

  // From Intermediate a Peak and an RMS row, each with its name in front (as wide as the longer, per px of its size)
  const labelEm = rows ? Math.max(...o.rowNames.map((w) => width(w, sans, 600))) : 0
  // The health word: one size for all four words (the longest fits), so it never resizes the row
  const longest = Math.max(...o.healthWords.map((w) => width(w, sans, 700)))

  /** The level block at a number size: the meter, the rows, the health word beside them or under. */
  const sized = (number: number) => {
    const unit   = Math.round(number * UNIT_RATIO)
    // One thickness on every card, whatever its size
    const meter  = BAR_H
    const bar    = stereo ? Math.round(meter * SIDES_BAR) : meter
    const meterH = stereo ? bar * 2 + Math.round(meter * SIDES_GAP) : meter
    const scale  = Math.round(unit * SCALE_RATIO)
    const labelW = rows ? Math.ceil(labelEm * unit + unit * 0.4) : 0
    const numberW = labelW + width(NUMBER_SAMPLE, mono, 700) * number + unit * 0.25 + width(o.spl ? 'dB SPL' : 'dBu', sans, 600) * unit
    const beside = Math.floor(Math.min(number * HEALTH_MAX, ((innerW - numberW - HEALTH_GAP) * 0.96) / longest))
    const ownRow = beside < number * HEALTH_MIN
    const health = ownRow ? Math.floor(Math.min(number * HEALTH_MAX, (innerW * 0.96) / longest)) : beside
    // The meter, its scale and its numbers (a status, "Not connected", takes the same height)
    const meterBlock = meterH + SCALE_GAP + Math.round(scale * SCALE_ROW)
    const blockH = barOnly ? meterBlock : meterBlock + METER_GAP + number + (rows ? 2 * (ROW_GAP + number) : 0) + (ownRow ? 4 + health : 0)
    return { number, unit, bar, meterH, scale, labelW, ownRow, health, blockH }
  }
  let level = sized(Math.round(Math.min(NUMBER_MAX, Math.max(NUMBER_MIN, W * 0.1))))
  // At most half the face: on a small card the name (or the icon) keeps its room, the numbers get smaller
  while (showLevel && level.number > NUMBER_MIN && level.blockH + NAME_GAP > (H - 2 - PAD * 2) * LEVEL_SHARE) {
    level = sized(level.number - 1)
  }
  const { number, unit, bar, meterH, scale, labelW, ownRow, health, blockH } = level
  const levelH = showLevel ? blockH + NAME_GAP : 0
  const tag    = Math.round(number * 0.5)
  const tagH   = o.bypassed ? tag * 1.4 + 2 + 8 : 0
  const nameH  = H - 2 - PAD * 2 - levelH - tagH
  const name   = fitText(o.label, innerW, nameH, {
    family: sans, weight: 600, letterSpacing: -0.02, lineHeight: 1.1,
    maxSize: o.nameMax ?? NAME_MAX, maxLines: 2,
  }, width)
  return { number, unit, bar, meterH, scale, labelW, blockH, health, ownRow, nameW: innerW, nameH: nameH + tagH, name, tag }
}
