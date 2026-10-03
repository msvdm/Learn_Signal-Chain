import type { CSSProperties, ReactNode } from 'react'
import { StableText } from '../controls/StableText'

// Pieces of the two-column dynamics body (layout: utils/twoColumns.ts)

/** Knobs one under the other, value and label beside each knob. */
export function KnobStack({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
}

/** How much the signal is being turned down: a bar across the column, then the label and the amount. */
export function ReductionReadout({ db, maxDb, label, style }: {
  db: number
  /** Full bar */
  maxDb: number
  label: string
  style?: CSSProperties
}) {
  return (
    <div style={style}>
      <div style={{ height: 6, background: 'var(--lsc-sunken)', borderRadius: 9999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(100, (db / maxDb) * 100)}%`,
            height: '100%',
            background: 'var(--signal-hot)',
            borderRadius: 3,
            transition: 'width 0.1s ease-out',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          fontSize: 'var(--node-text-xs)', lineHeight: '20px',
        }}
      >
        <span style={{ color: 'var(--lsc-fg-muted)' }}>{label}</span>
        <StableText reserve={['−00.0 dB']} align="end" style={{ fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-fg)' }}>
          {db > 0 ? `−${db.toFixed(1)} dB` : '0.0 dB'}
        </StableText>
      </div>
    </div>
  )
}
