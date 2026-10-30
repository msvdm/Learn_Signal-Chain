import type { CSSProperties } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import { LiveLevel, MeterBar, MeterScaleRow } from '../SignalMeter'
import type { LiveReading } from '../SignalMeter'
import { StableText } from '../controls/StableText'
import { useStage } from '../../hooks/useGraphSignal'
import { useDetailShown } from '../../hooks/useDetailShown'
import { useTranslation } from '../../i18n/useTranslation'
import { SILENT_WIRE } from '../../signal/engine'
import { SPL_DB, SPL_SCALE_DB, getHealth, healthColor, louder } from '../../signal/levels'
import type { SignalHealth } from '../../signal/levels'
import { LEVEL_SAMPLE, levelParts } from '../../utils/readout'
import { zoneTextColor } from '../meterPaint'

/** Its bar's height, its scale's numbers (px) */
const BAR_H = 12
const SCALE = 12
/** Its readings: a number's name, the number, the health word (px — read zoomed out, as the name) */
const NAME_PX   = 14
const NUMBER_PX = 20
const HEALTH_PX = 17

/**
 * A frameless element's meter (D27): one horizontal bar in dB SPL (D13) under its drawing, its
 * scale under it — the Guitar Amp, the Passive Speaker, the Headphones, the Active Speaker. From
 * Intermediate, with its peaks, noise and movement (D3); at Beginner its room is kept, unseen, so
 * the element keeps one size. With `readings` (the speakers and Headphones, D28), from Intermediate
 * its Peak, RMS and Noise under it — moving with the sound — and the health word.
 */
export function SplMeter({ nodeId, typeKey, width, readings = false }: {
  nodeId: string
  typeKey: TypeKey
  width: number
  readings?: boolean
}) {
  const detailed = useDetailShown()
  const stage    = useStage(nodeId)
  const wire     = stage?.out ?? SILENT_WIRE
  // A stereo signal's numbers: its louder side (as a card's meter)
  const out      = wire.kind === 'stereo' ? louder(wire.l, wire.r) : wire.l
  const spl      = SPL_DB[typeKey]!
  return (
    <div style={{ width, margin: '0 auto', visibility: detailed ? 'visible' : 'hidden' }}>
      <MeterBar
        db={out.rms} height={BAR_H} domain="analog" shift={spl - SPL_SCALE_DB}
        peak={detailed ? out.peak : undefined} noise={detailed ? out.noise : undefined}
        clipping={getHealth(out.rms, 'analog', out.peak) === 'clipping'}
        source={detailed ? { nodeId, at: 'out', side: 'louder' } : undefined}
      />
      <div style={{ marginTop: 4 }}><MeterScaleRow domain="analog" spl={spl} size={SCALE} /></div>
      {readings && detailed && <Readings nodeId={nodeId} spl={spl} out={out} health={stage?.health ?? 'too-quiet'} />}
    </div>
  )
}

/** Peak, RMS and Noise side by side (each its name over its number), the unit and the health word under them. */
function Readings({ nodeId, spl, out, health }: {
  nodeId: string
  spl: number
  out: { peak: number; rms: number; noise: number }
  health: SignalHealth
}) {
  const { t } = useTranslation()
  const name: CSSProperties = { fontSize: NAME_PX, color: 'var(--lsc-fg-muted)', fontFamily: 'var(--lsc-font-sans)', fontWeight: 400, lineHeight: 1.2 }
  const cell: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center' }
  const moving = (label: string, which: LiveReading) => (
    <div style={cell}>
      <span style={name}>{label}</span>
      <LiveLevel
        db={which === 'hold' ? out.peak : out.rms} reading={which}
        source={{ nodeId, at: 'out', side: 'louder' }} domain="analog" spl={spl} noise={out.noise}
      />
    </div>
  )
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        alignSelf: 'stretch', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        fontFamily: 'var(--lsc-font-mono)', fontSize: NUMBER_PX, fontWeight: 700, lineHeight: 1.15,
      }}>
        {moving(t.meters.peak, 'hold')}
        {moving(t.meters.rms, 'rms')}
        {/* The noise, measured with the music stopped: still, blue (the blue part of the bar) */}
        <div style={cell}>
          <span style={name}>{t.meters.noise}</span>
          <StableText reserve={[LEVEL_SAMPLE]} align="center" style={{ color: zoneTextColor(out.noise, 'analog', out.noise) }}>
            {levelParts(out.noise, 'analog', spl)[0]}
          </StableText>
        </div>
      </div>
      <span style={name}>{levelParts(out.rms, 'analog', spl)[1]}</span>
      {/* The verdict: the widest word's room kept, so a new one never moves anything */}
      <StableText reserve={Object.values(t.health)} align="center" style={{ fontSize: HEALTH_PX, fontWeight: 700, color: healthColor(health) }}>
        {t.health[health]}
      </StableText>
    </div>
  )
}
