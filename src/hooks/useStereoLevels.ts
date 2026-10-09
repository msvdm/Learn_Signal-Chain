import { useStage } from './useGraphSignal'
import { SILENT_WIRE, healthOf, levelOf } from '../signal/engine'
import type { WireSignal } from '../signal/engine'
import type { SideLevels, SignalDomain, SignalHealth } from '../signal/levels'

/** What a SignalMeter shows: one channel (`l`), or both sides of a stereo signal (`l` + `r`). */
export interface MeterSignal {
  l: SideLevels
  r?: SideLevels
  health: SignalHealth
  domain: SignalDomain
}

const meterOf = (w: WireSignal, health: SignalHealth, domain: SignalDomain): MeterSignal =>
  ({ l: w.l, r: w.kind === 'stereo' ? w.r : undefined, health, domain })

/**
 * What a card's meters show, arriving and leaving.
 * `input` / `output`: everything a SignalMeter shows — each side's readings (peak, average, noise;
 * `r` only for a stereo signal: two bars), its health and domain (`<SignalMeter {...levels.output} />`).
 * `inLevel` is the louder input side — what a linked stereo compressor or gate reacts to.
 * `outHealth`: the card's verdict on what leaves it (clipping when the peaks reach the ceiling, else
 * from the average) — the same as the wire leaving it.
 */
export function useStereoLevels(id: string) {
  const stage    = useStage(id)
  const arriving = stage?.in ?? SILENT_WIRE
  const leaving  = stage?.out ?? SILENT_WIRE
  const stereo   = leaving.kind === 'stereo'
  const inDomain  = stage?.inDomain ?? 'analog'
  const outDomain = stage?.domain ?? 'analog'
  const inHealth  = healthOf(arriving, inDomain)
  const outHealth = stage?.health ?? 'too-quiet'
  return {
    stereo,
    /** Analog (dBu) or digital (dBFS), arriving and leaving — an ADC / DAC changes it */
    inDomain,
    outDomain,
    inLevel: levelOf(arriving),
    outHealth,
    input:  meterOf(arriving, inHealth, inDomain),
    output: meterOf(leaving, outHealth, outDomain),
  }
}
