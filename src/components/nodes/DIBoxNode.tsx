import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { MeterSides } from './MeterSides'
import { useStage, useWire } from '../../hooks/useGraphSignal'
import { formatDb } from '../../signal/levels'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { StableText } from '../controls/StableText'
import { LEVEL_SAMPLE } from '../../utils/readout'
import { useParams } from '../../hooks/useParams'
import { levelOf } from '../../signal/engine'
import { DI_DIRECT_PORT } from '../../data/nodeRegistry'
import { outputKey } from '../../graph/graph'

/** Its controls and the two outputs' levels and what they are for, between its meter and its outputs */
const MIDDLE_W = 300

/**
 * DI Box: its XLR Out brings a guitar down to mic level for a Preamp, its Direct Out passes it on
 * unchanged for a guitar amp. In a ground loop (Direct Out on a Guitar Amp, XLR Out on the desk,
 * Ground Lift off) it says "Hum!" where its description was, and the Ground Lift button lights up.
 */
export function DIBoxNode({ id }: CardProps) {
  const p                 = useParams(id, 'di-box')
  const updateNodeParams  = useSignalStore((s) => s.updateNodeParams)
  const { t }             = useTranslation()

  const text       = t.nodes['di-box']
  const groundLift = p('groundLift')
  const hum        = useStage(id)?.hum !== undefined
  const xlr        = levelOf(useWire(outputKey(id, 'out')))
  const direct     = levelOf(useWire(outputKey(id, DI_DIRECT_PORT)))

  const output = (name: string, db: number, what: string, main: boolean) => (
    <div>
      <div className="flex items-center justify-between">
        <span
          className="text-[var(--node-text-xs)] uppercase tracking-wide"
          style={{ color: main ? 'var(--lsc-accent)' : 'var(--lsc-fg-muted)', fontWeight: 700 }}
        >
          {name}
        </span>
        <StableText reserve={[`${LEVEL_SAMPLE} dBu`]} align="end" className="text-[var(--node-text-xs)] font-mono" style={{ color: 'var(--lsc-fg)' }}>
          {formatDb(db, 'analog')}
        </StableText>
      </div>
      <div className="text-[var(--node-text-xs)]" style={{ color: 'var(--lsc-fg-muted)' }}>{what}</div>
    </div>
  )

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="di-box"
      label={useNodeName(id, 'di-box')}
    >
      {/* What arrives on the left; its two outputs, at their own levels, in the middle */}
      <MeterSides nodeId={id} output={false}>
        <div style={{ width: MIDDLE_W, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Ground lift: lights up while there is a hum to fix */}
          <div className="flex items-center justify-between" style={{ gap: 8 }}>
            <span className="text-[var(--node-text-sm)]" style={{ color: 'var(--lsc-fg)' }}>
              {text.groundLift}
            </span>
            <button
              className="nodrag nopan"
              onClick={() => updateNodeParams(id, { groundLift: !groundLift })}
              style={{
                fontSize: 'var(--node-text-xs)', fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--lsc-radius-sm)',
                border: `${hum ? 2 : 1}px solid ${hum ? 'var(--signal-clipping)' : groundLift ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
                background: hum ? 'var(--signal-clipping-bg)' : groundLift ? 'var(--lsc-accent-bg)' : 'transparent',
                color: hum ? 'var(--signal-clipping-text)' : groundLift ? 'var(--lsc-accent-soft)' : 'var(--lsc-fg)',
                cursor: 'pointer',
              }}
            >
              <StableText reserve={[t.nodeControls.on, t.nodeControls.off]} align="center">
                {groundLift ? t.nodeControls.on : t.nodeControls.off}
              </StableText>
            </button>
          </div>

          {output(text.xlrOut, xlr, text.micLevel, true)}
          {output(text.directOut, direct, text.instrumentLevel, false)}

          {/* The description, or the hum note in its place: both keep their space, so the card never resizes */}
          <div style={{ display: 'grid', borderTop: '1px solid var(--lsc-border)', paddingTop: 4 }}>
            <div
              className="lsc-wrap-text text-[var(--node-text-sm)] leading-snug"
              style={{ gridArea: '1 / 1', color: 'var(--lsc-fg-muted)', visibility: hum ? 'hidden' : 'visible' }}
            >
              {text.description}
            </div>
            <div
              className="lsc-wrap-text text-[var(--node-text-sm)] leading-snug"
              style={{ gridArea: '1 / 1', color: 'var(--signal-clipping-text)', fontWeight: 700, visibility: hum ? 'visible' : 'hidden' }}
            >
              {text.hum}
            </div>
          </div>
        </div>
      </MeterSides>
    </NodeWrapper>
  )
}
