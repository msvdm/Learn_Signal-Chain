import { useTranslation } from '../../i18n/useTranslation'
import { StableText } from '../controls/StableText'

/**
 * A Ground Lift switch (D1, D26) — a DI Box's, a Guitar Amp's on its DI Out: its name and an ON /
 * OFF button, which lights up red while there is a hum to fix.
 */
export function GroundLiftButton({ on, hum, onToggle }: { on: boolean; hum: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'var(--lsc-fg)', whiteSpace: 'nowrap' }}>
        {t.nodes['di-box'].groundLift}
      </span>
      <button
        className="nodrag nopan"
        onClick={onToggle}
        style={{
          fontSize: 'var(--node-text-xs)', fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 'var(--lsc-radius-sm)',
          border: `${hum ? 2 : 1}px solid ${hum ? 'var(--signal-clipping)' : on ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
          background: hum ? 'var(--signal-clipping-bg)' : on ? 'var(--lsc-accent-bg)' : 'transparent',
          color: hum ? 'var(--signal-clipping-text)' : on ? 'var(--lsc-accent-soft)' : 'var(--lsc-fg)',
          cursor: 'pointer',
        }}
      >
        <StableText reserve={[t.nodeControls.on, t.nodeControls.off]} align="center">
          {on ? t.nodeControls.on : t.nodeControls.off}
        </StableText>
      </button>
    </div>
  )
}
