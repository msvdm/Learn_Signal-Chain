import type { ReactNode } from 'react'
import { MeterStrip } from '../SignalMeter'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useTranslation } from '../../i18n/useTranslation'

/** Between a meter and the card's controls (px) */
export const METER_GAP = 14

/**
 * A card's body with its meters at its sides, as the signal flows through it — what arrives on the
 * left, what leaves on the right, like a DAW plug-in's In and Out meters. They take the body's
 * height; `input` / `output` false leaves one out (a DI Box shows its two outputs as levels).
 */
export function MeterSides({ nodeId, input = true, output = true, spl, outputLabel, hideOutput = false, children }: {
  nodeId: string
  input?: boolean
  output?: boolean
  /** What leaves is sound in the air: its meter reads dB SPL (its card's SPL_DB) */
  spl?: number
  /** The output meter's name, when not Output (or Sound in dB SPL) */
  outputLabel?: string
  /** The output meter keeps its place, unseen (a source not connected — D11) */
  hideOutput?: boolean
  children: ReactNode
}) {
  const levels = useStereoLevels(nodeId)
  const { t }  = useTranslation()
  return (
    // As tall as the card's body: the meters take its whole height
    <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: METER_GAP }}>
      {input && <MeterStrip {...levels.input} label={t.meters.input} nodeId={nodeId} at="in" />}
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {children}
      </div>
      {output && (
        <div style={{ display: 'flex', ...(hideOutput ? { visibility: 'hidden' } : {}) }}>
          <MeterStrip {...levels.output} label={outputLabel ?? (spl === undefined ? t.meters.output : t.meters.sound)} nodeId={nodeId} at="out" spl={spl} />
        </div>
      )}
    </div>
  )
}
