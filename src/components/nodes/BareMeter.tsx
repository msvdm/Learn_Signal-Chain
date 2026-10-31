import { Fragment } from 'react'
import type { CSSProperties } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import { LiveLevel, MeterBar, MeterScaleRow } from '../SignalMeter'
import type { LiveReading } from '../SignalMeter'
import type { MeterAt, MeterSide } from '../meterPaint'
import { StableText } from '../controls/StableText'
import { useStage } from '../../hooks/useGraphSignal'
import { useDetailShown } from '../../hooks/useDetailShown'
import { useTranslation } from '../../i18n/useTranslation'
import { SILENT_WIRE } from '../../signal/engine'
import { SPL_DB, SPL_SCALE_DB, getHealth, healthColor, louder } from '../../signal/levels'
import type { SideLevels, SignalDomain, SignalHealth } from '../../signal/levels'
import { LEVEL_SAMPLE, levelParts } from '../../utils/readout'
import { zoneTextColor } from '../meterPaint'

/** Its bar's height, the gap between a stereo signal's two, its scale's numbers (px) */
const BAR_H   = 12
const BAR_GAP = 4
const SCALE   = 12
/** A stereo bar's letter (L, R): its room across, its size (px) */
const LETTER_W  = 14
const LETTER_PX = 13
/** Its readings: a number's name, the number, the health word (px — read zoomed out, as the name) */
const NAME_PX   = 14
const NUMBER_PX = 20
const HEALTH_PX = 17

/**
 * A frameless element's meter (D27, D28): a horizontal bar under its drawing, its scale under it —
 * in dB SPL where its sound is in the air (D13: the Guitar Amp, the speakers, the Headphones, the
 * Drum Kit, the Acoustic Instrument), else in dBu (the Hi-Z Instrument; the Keyboard, always
 * stereo: a bar for each side, L over R). From Intermediate, with its peaks, noise and movement
 * (D3); at Beginner its room is kept, unseen, so the element keeps one size. With `readings`, from
 * Intermediate its Peak, RMS and Noise under it — moving with the sound — and the health word
 * (Readings). `hidden`: its room kept, unseen (a source with nothing wired to it — D11).
 */
export function BareMeter({ nodeId, typeKey, width, readings = false, hidden = false }: {
  nodeId: string
  typeKey: TypeKey
  width: number
  readings?: boolean
  hidden?: boolean
}) {
  const detailed = useDetailShown()
  const stage    = useStage(nodeId)
  const wire     = stage?.out ?? SILENT_WIRE
  const spl      = SPL_DB[typeKey]
  // Sound in the air is never digital (a speaker fed numbers is silent, and says so)
  const domain   = spl === undefined ? stage?.domain ?? 'analog' : 'analog'
  // Always stereo: a bar for each side; otherwise one — a stereo signal's louder side (as a card's meter)
  const stereo   = NODE_REGISTRY[typeKey].stereo === 'always'
  const bars: [letter: string, side: SideLevels, which: MeterSide][] = stereo
    ? [['L', wire.l, 'l'], ['R', wire.r, 'r']]
    : [['', wire.kind === 'stereo' ? louder(wire.l, wire.r) : wire.l, 'louder']]
  const whole    = wire.kind === 'stereo' ? louder(wire.l, wire.r) : wire.l
  const letter: CSSProperties = { fontSize: LETTER_PX, fontWeight: 700, lineHeight: 1, color: 'var(--lsc-fg-muted)', fontFamily: 'var(--lsc-font-sans)' }
  return (
    <div style={{ width, margin: '0 auto', visibility: detailed && !hidden ? 'visible' : 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: stereo ? `${LETTER_W}px 1fr` : '1fr', alignItems: 'center', rowGap: BAR_GAP }}>
        {bars.map(([name, side, which]) => (
          <Fragment key={which}>
            {stereo && <span style={letter}>{name}</span>}
            <MeterBar
              db={side.rms} height={BAR_H} domain={domain} shift={spl === undefined ? 0 : spl - SPL_SCALE_DB}
              peak={detailed ? side.peak : undefined} noise={detailed ? side.noise : undefined}
              clipping={getHealth(side.rms, domain, side.peak) === 'clipping'}
              source={detailed ? { nodeId, at: 'out', side: which } : undefined}
            />
          </Fragment>
        ))}
      </div>
      <div style={{ marginTop: 4, marginLeft: stereo ? LETTER_W : 0 }}><MeterScaleRow domain={domain} spl={spl} size={SCALE} /></div>
      {readings && detailed && <Readings nodeId={nodeId} domain={domain} spl={spl} out={whole} health={stage?.health ?? 'too-quiet'} />}
    </div>
  )
}

/**
 * Peak, RMS and Noise side by side (each its name over its number), the unit and the health word
 * under them — a stereo signal's louder side. Read zoomed out too.
 */
export function Readings({ nodeId, at = 'out', domain, spl, out, health }: {
  nodeId: string
  /** Its card's signal it reads: what leaves it (default), or what arrives (Stream / Broadcast) */
  at?: MeterAt
  domain: SignalDomain
  /** In dB SPL: its SPL_DB */
  spl?: number
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
        source={{ nodeId, at, side: 'louder' }} domain={domain} spl={spl} noise={out.noise}
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
        {/* The noise, measured with the music stopped: still, grey (the grey part of the bar) */}
        <div style={cell}>
          <span style={name}>{t.meters.noise}</span>
          <StableText reserve={[LEVEL_SAMPLE]} align="center" style={{ color: zoneTextColor(out.noise, domain, out.noise) }}>
            {levelParts(out.noise, domain, spl)[0]}
          </StableText>
        </div>
      </div>
      <span style={name}>{levelParts(out.rms, domain, spl)[1]}</span>
      {/* The verdict: the widest word's room kept, so a new one never moves anything */}
      <StableText reserve={Object.values(t.health)} align="center" style={{ fontSize: HEALTH_PX, fontWeight: 700, color: healthColor(health) }}>
        {t.health[health]}
      </StableText>
    </div>
  )
}
