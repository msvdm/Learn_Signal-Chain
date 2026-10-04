import type { CardProps } from './cardProps'
import { FreeControl } from './FreeControl'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useTranslation } from '../../i18n/useTranslation'

// A free-standing button, big enough to read zoomed out
const BUTTON = 110

/** On = the signal passes, Off = silence. Drawn as one big square On / Off button (no card). */
export function SwitchNode({ id, data }: CardProps) {
  const p                = useParams(id, 'switch')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const isOn = p('on')

  return (
    <FreeControl nodeId={id} typeKey="switch" label={data.label ?? t.palette.items['switch']} portLine={BUTTON / 2}>
      <button
        className="nodrag nopan"
        aria-pressed={isOn}
        onClick={() => updateNodeParams(id, { on: !isOn })}
        style={{
          width: BUTTON, height: BUTTON, borderRadius: 24, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 800, letterSpacing: '0.04em',
          background: isOn ? 'var(--signal-good-bg)' : 'var(--lsc-sunken)',
          border: `3px solid ${isOn ? 'var(--signal-good)' : 'var(--lsc-border)'}`,
          color: isOn ? 'var(--signal-good-text)' : 'var(--lsc-fg-muted)',
          boxShadow: 'var(--lsc-shadow-node)',
          cursor: 'pointer',
          transition: 'background 0.1s, border-color 0.1s, color 0.1s',
        }}
      >
        {isOn ? 'ON' : 'OFF'}
      </button>
    </FreeControl>
  )
}
