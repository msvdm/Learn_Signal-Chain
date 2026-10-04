import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { getHealth } from '../../signal/levels'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { StableText } from '../controls/StableText'
import { LEVEL_SAMPLE } from '../../utils/readout'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'
import { levelOf } from '../../signal/engine'
import { twoColumns } from '../../utils/twoColumns'

export function DIBoxNode({ id }: CardProps) {
  const { stages }          = useGraphSignal()
  const p                = useParams(id, 'di-box')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const result       = stages[id]
  const out          = levelOf(result?.out)
  const levels       = useStereoLevels(id)
  const groundLift   = p('groundLift')

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="di-box"
      label={useNodeName(id, 'di-box')}
    >
      <div style={twoColumns}>
        {/* Signal flow */}
        <SignalMeter
          db={levels.in}
          dbR={levels.inR}
          health={getHealth(levels.inPeak, levels.inDomain)}
          domain={levels.inDomain}
          label={t.meters.input}
        />

        {/* Ground lift toggle */}
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          <span className="text-[var(--node-text-sm)]" style={{ color: 'var(--lsc-fg)' }}>
            {t.nodes['di-box'].groundLift}
          </span>
          <button
            className="nodrag nopan"
            onClick={() => updateNodeParams(id, { groundLift: !groundLift })}
            style={{
              fontSize: 'var(--node-text-xs)', fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 'var(--lsc-radius-sm)',
              border: `1px solid ${groundLift ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
              background: groundLift ? 'var(--lsc-accent-bg)' : 'transparent',
              color: groundLift ? 'var(--lsc-accent-soft)' : 'var(--lsc-fg)',
              cursor: 'pointer',
            }}
          >
            <StableText reserve={['ON', 'OFF']} align="center">{groundLift ? 'ON' : 'OFF'}</StableText>
          </button>
        </div>

        {/* Two outputs — both carry the same signal level */}
        <div className="space-y-1" style={{ gridColumn: '1 / -1' }}>
          <div className="flex items-center justify-between">
            <span className="text-[var(--node-text-xs)] uppercase tracking-wide" style={{ color: 'var(--lsc-accent)', fontWeight: 700 }}>
              {t.nodes['di-box'].xlrOut}
            </span>
            <StableText reserve={[`${LEVEL_SAMPLE} dBFS`]} align="end" className="text-[var(--node-text-xs)] font-mono" style={{ color: 'var(--lsc-fg)' }}>
              {isFinite(out)
                ? `${out.toFixed(1)} ${result?.domain === 'digital' ? 'dBFS' : 'dBu'}`
                : '−∞'}
            </StableText>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--node-text-xs)] uppercase tracking-wide" style={{ color: 'var(--lsc-fg-muted)', fontWeight: 600 }}>
              {t.nodes['di-box'].directOut}
            </span>
            <StableText reserve={[`${LEVEL_SAMPLE} dBu`]} align="end" className="text-[var(--node-text-xs)] font-mono" style={{ color: 'var(--lsc-fg-muted)' }}>
              {isFinite(out)
                ? `${out.toFixed(1)} dBu`
                : '−∞'}
            </StableText>
          </div>
        </div>

        <div
          className="lsc-wrap-text text-[var(--node-text-sm)] leading-snug"
          style={{ gridColumn: '1 / -1', color: 'var(--lsc-fg-muted)', borderTop: '1px solid var(--lsc-border)', paddingTop: 4 }}
        >
          {t.nodes['di-box'].description}
        </div>
      </div>
    </NodeWrapper>
  )
}
