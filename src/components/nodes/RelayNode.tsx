import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { fitText, cssVar } from '../../utils/fitText'

const NAME_MAX = 96   // as the other cards' names zoomed out
const GAP      = 12   // between the name and the buttons

/**
 * Relay: two inputs (A on top, B below) and one output — the chosen input goes out, the other is
 * cut off. One look at every zoom: its name (half the size it would fit) and the A / B buttons,
 * big enough to click zoomed out.
 */
export function RelayNode({ id }: CardProps) {
  const p                = useParams(id, 'relay')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const label            = useNodeName(id, 'relay')
  const selected         = p('selectedInput')

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="relay"
      label={label}
      faceOnly
      overviewLevel={false}
      overviewArt={(box) => {
        const name = fitText(label, box.w, box.h, {
          family: cssVar('--lsc-font-sans'), weight: 600, letterSpacing: -0.02, lineHeight: 1.1,
          maxSize: NODE_LOOK.relay.nameMax ?? NAME_MAX, maxLines: 2,
        })
        const nameSize = Math.round(name.fontSize / 2)
        const buttonH  = Math.max(40, Math.round(box.h - nameSize * 1.1 * name.lines.length - GAP))
        return (
          <div style={{ width: box.w, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: GAP }}>
            <div
              style={{
                fontSize: nameSize, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1,
                textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--lsc-fg)',
              }}
            >
              {name.lines.map((line) => <div key={line}>{line}</div>)}
            </div>
            {/* The face ignores the pointer; the buttons take it back */}
            <div className="nodrag nopan" style={{ pointerEvents: 'auto', alignSelf: 'stretch', display: 'flex', gap: GAP }}>
              {(['a', 'b'] as const).map((ch) => {
                const on = selected === ch
                return (
                  <button
                    key={ch}
                    aria-pressed={on}
                    onClick={() => updateNodeParams(id, { selectedInput: ch })}
                    style={{
                      flex: 1, height: buttonH, padding: 0,
                      fontSize: Math.round(buttonH * 0.5), fontWeight: 800, lineHeight: 1,
                      borderRadius: 'var(--lsc-radius-lg)',
                      border: `3px solid ${on ? 'var(--signal-good)' : 'var(--lsc-border)'}`,
                      background: on ? 'var(--signal-good-bg)' : 'var(--lsc-sunken)',
                      color: on ? 'var(--signal-good-text)' : 'var(--lsc-fg-muted)',
                      cursor: on ? 'default' : 'pointer',
                      transition: 'background 0.1s, border-color 0.1s, color 0.1s',
                    }}
                  >
                    {ch.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>
        )
      }}
    />
  )
}
