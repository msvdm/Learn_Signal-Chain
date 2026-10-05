import type { ReactNode, CSSProperties } from 'react'
import { Power } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useNodeChrome } from '../../hooks/useNodeChrome'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_REGISTRY, isNodeStereo } from '../../data/nodeRegistry'
import { HEADER_H, PORT_TOP, PORT_GAP, READINGS_MIN_W, cardMinSize } from '../../utils/layoutHelpers'
import { NoiseTags, PortStack, WireTargetBadge } from './NodeChrome'
import { NODE_LOOK } from './nodeLook'
import { OverviewFace } from './OverviewFace'
import type { OverviewArt } from './OverviewFace'
import { SignalReadings } from './Readings'
import { useReadingsShown } from '../../hooks/useReadingsShown'

// Side padding of the body: the port rings reach 14px into the card, so content starts clear of them
const BODY_PAD_X = 20
// Under a face-only card's face: its readings (the face's own padding is above)
const FACE_READINGS_PAD = '0 20px 16px'

interface NodeWrapperProps {
  nodeId: string
  typeKey: TypeKey
  label: string
  children?: ReactNode
  /** Horizontal alignment of the body content. */
  align?: 'stretch' | 'start' | 'center'
  className?: string
  style?: CSSProperties
  /** Overview (zoomed out): drawn instead of the name, e.g. a big icon or the control itself. */
  overviewArt?: OverviewArt
  /** Overview: false = no level block, the art takes the whole card. Also no readings (below). */
  overviewLevel?: boolean
  /** false = no readings at the bottom (a card whose outputs send different signals: the DI Box) */
  readings?: boolean
  /** Show only the overview face (icon + level) at every zoom: no header, no body. */
  faceOnly?: boolean
}

/**
 * The single card shell every node uses.
 * Width follows the content (controls, graphs); text wraps to fit.
 * The 56px header keeps the first port line at the same height on every card,
 * so wires between cards stay straight no matter how tall each card is.
 */
export function NodeWrapper({
  nodeId,
  typeKey,
  label,
  children,
  align = 'stretch',
  className = '',
  style,
  overviewArt,
  overviewLevel = true,
  faceOnly = false,
  readings: withReadings = true,
}: NodeWrapperProps) {
  const toggleBypassNode = useSignalStore((s) => s.toggleBypassNode)
  const setNodeStereo    = useSignalStore((s) => s.setNodeStereo)
  const { node, ports, chains, selected, overview, wireTarget } = useNodeChrome(nodeId, typeKey)
  const { t }            = useTranslation()
  // From Intermediate up, every card that shows a level ends with the readings of what leaves it
  const readings         = useReadingsShown() && overviewLevel && withReadings

  const isBypassed = node?.bypassed ?? false
  const look       = NODE_LOOK[typeKey]
  const canBypass  = NODE_REGISTRY[typeKey].bypass
  const canStereo  = NODE_REGISTRY[typeKey].stereo === 'optional'
  const { inputs, outputs } = ports

  // Tall enough for the longest stack of ports
  const portRows  = Math.max(inputs.length, outputs.length, 1)
  const minSize   = cardMinSize(typeKey)
  const minHeight = Math.max(minSize.h, PORT_TOP + (portRows - 1) * PORT_GAP + 24)

  // In overview the controls stay in place, invisible, so the card keeps its exact size
  const hideInOverview: CSSProperties = overview ? { visibility: 'hidden', opacity: 0 } : {}

  const borderColor = isBypassed ? 'var(--signal-hot)' : selected ? 'var(--lsc-accent)' : 'var(--lsc-border)'
  // Selected: a solid ring, a soft glow and a tinted face — thicker zoomed out, so it still shows
  const ring = overview ? 12 : 4

  return (
    <div
      className={`lsc-node-card select-none ${selected ? 'lsc-selected' : ''} ${className}`}
      // A face-only card shows an icon, not its name: the name appears on hover
      title={faceOnly ? label : undefined}
      style={{
        position: 'relative',
        width: 'max-content',
        minWidth: readings ? Math.max(minSize.w, READINGS_MIN_W) : minSize.w,
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        background: selected
          ? 'linear-gradient(var(--lsc-select-tint), var(--lsc-select-tint)), var(--lsc-node-bg)'
          : 'var(--lsc-node-bg)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: selected
          ? `0 0 0 ${ring}px var(--lsc-accent), 0 0 0 ${ring * 3}px var(--lsc-select-halo), var(--lsc-shadow-node)`
          : 'var(--lsc-shadow-node)',
        color: 'var(--lsc-fg)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {wireTarget && <WireTargetBadge label={label} />}

      {/* Chain colour stripe — one segment per source feeding this card */}
      {chains.length > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 0, left: 10, right: 10, height: 3,
            display: 'flex', borderRadius: '0 0 3px 3px', overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {chains.map((c) => <span key={c} style={{ flex: 1, background: c }} />)}
        </div>
      )}

      <PortStack nodeId={nodeId} typeKey={typeKey} ports={ports} />
      <NoiseTags nodeId={nodeId} overview={overview} />

      {/* Face-only cards (sources, speakers) have no header or body: the face is all they show */}
      {!faceOnly && <>
        {/* Header — fixed height keeps the port line aligned across cards */}
        <div
          className="lsc-fade"
          style={{
            ...hideInOverview,
            position: 'relative',
            minHeight: HEADER_H,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0 10px 0 12px',
            borderBottom: '1px solid var(--lsc-border-soft)',
            flexShrink: 0,
          }}
        >
          <span className="lsc-node-icon" style={{ display: 'flex', flexShrink: 0 }}>
            <look.icon size={look.headerSize ?? 16} />
          </span>
          {/* Short titles stay on one line (the card grows); long ones wrap */}
          <span
            style={{
              flex: '0 1 auto', width: 'max-content', maxWidth: 132,
              fontSize: 'var(--node-text-md)', fontWeight: 600, lineHeight: 1.15,
              padding: '6px 0',
            }}
          >
            {label}
          </span>
          {/* "Bypassed" tag sits on the header's bottom line — it never changes the card's size */}
          {isBypassed && (
            <span
              style={{
                position: 'absolute', left: 12, bottom: 0, transform: 'translateY(50%)', zIndex: 2,
                fontSize: 11, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap',
                padding: '0 6px', borderRadius: 9999,
                background: 'linear-gradient(var(--signal-hot-bg), var(--signal-hot-bg)), var(--lsc-node-bg)',
                color: 'var(--signal-hot)',
                border: '1px solid var(--signal-hot-border)',
                pointerEvents: 'none',
              }}
            >
              {t.nodeControls.bypassedShort}
            </span>
          )}
          <span style={{ flex: 1 }} />
          {/* On/Off (processing elements only) — Help and Remove are in the right-click menu */}
          <div className="nodrag nopan" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {canBypass && (
              <button
                className="lsc-node-btn"
                title={isBypassed ? t.nodeControls.turnOn : t.nodeControls.turnOff}
                aria-pressed={!isBypassed}
                onClick={() => toggleBypassNode(nodeId)}
                style={{
                  ...headerBtn,
                  borderColor: isBypassed ? 'var(--signal-hot-border)' : 'var(--signal-good-border)',
                  background: isBypassed ? 'var(--signal-hot-bg)' : 'var(--signal-good-bg)',
                  color: isBypassed ? 'var(--signal-hot)' : 'var(--signal-good)',
                }}
              >
                <Power size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {/* Mono | Stereo switch — not dimmed by bypass, it changes the wiring */}
        {canStereo && node && (
          <div className="lsc-fade" style={{ padding: `10px ${BODY_PAD_X}px 0`, ...hideInOverview }}>
            <StereoToggle
              stereo={isNodeStereo(node)}
              onChange={(on) => setNodeStereo(nodeId, on)}
              labels={[t.stereo.mono, t.stereo.stereo]}
              hint={t.stereo.toggleHint}
            />
          </div>
        )}

        {/* Body — dimmed when bypassed; centred in cards bigger than their controls */}
        <div
          className="lsc-fade"
          style={{
            flex: 1,
            padding: `10px ${BODY_PAD_X}px 12px`,
            display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center',
            alignItems: align === 'center' ? 'center' : align === 'start' ? 'flex-start' : 'stretch',
            opacity: isBypassed ? 0.5 : 1,
            ...hideInOverview,
          }}
        >
          {children}
        </div>

        {/* The readings of what leaves the card, at its bottom — hidden zoomed out, with the body */}
        {readings && (
          <div
            className="lsc-fade"
            style={{ padding: `0 ${BODY_PAD_X}px 12px`, opacity: isBypassed ? 0.5 : 1, ...hideInOverview }}
          >
            <ReadingsBlock nodeId={nodeId} />
          </div>
        )}
      </>}

      {/* A face-only card keeps its face as it was and takes its readings under it; zoomed out they
          hide and the face fills the whole card */}
      {faceOnly && readings && <>
        <div aria-hidden style={{ height: minHeight - 2, flexShrink: 0 }} />
        <div className="lsc-fade" style={{ padding: FACE_READINGS_PAD, ...hideInOverview }}>
          <ReadingsBlock nodeId={nodeId} />
        </div>
      </>}

      {/* Overview (zoomed out): name + output level, drawn over the hidden controls, under the ports */}
      <OverviewFace
        nodeId={nodeId}
        typeKey={typeKey}
        label={label}
        art={overviewArt}
        showLevel={overviewLevel}
        shown={overview || faceOnly}
        bypassed={isBypassed}
        hasOutput={outputs.length > 0}
        height={faceOnly && readings && !overview ? minHeight : undefined}
      />
    </div>
  )
}

/** The readings under a line across the card. */
function ReadingsBlock({ nodeId }: { nodeId: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--lsc-border-soft)', paddingTop: 8 }}>
      <SignalReadings nodeId={nodeId} />
    </div>
  )
}

/** Two-part switch: Mono | Stereo. */
function StereoToggle({ stereo, onChange, labels, hint }: {
  stereo: boolean
  onChange: (stereo: boolean) => void
  labels: [string, string]
  hint: string
}) {
  return (
    <div
      className="nodrag nopan"
      role="radiogroup"
      title={hint}
      style={{
        display: 'flex', padding: 2, gap: 2,
        borderRadius: 9999, background: 'var(--lsc-sunken)',
        border: '1px solid var(--lsc-border-soft)',
      }}
    >
      {labels.map((text, i) => {
        const active = (i === 1) === stereo
        return (
          <button
            key={text}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(i === 1)}
            style={{
              flex: 1, padding: '2px 10px', borderRadius: 9999, border: 'none',
              fontSize: 11, fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.02em',
              background: active ? 'var(--lsc-accent)' : 'transparent',
              color: active ? '#fff' : 'var(--lsc-fg-muted)',
              cursor: active ? 'default' : 'pointer',
              transition: 'background 0.1s, color 0.1s',
            }}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}

const headerBtn: CSSProperties = {
  width: 22, height: 22, flexShrink: 0, borderRadius: 9999, padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderWidth: 1, borderStyle: 'solid',
  transition: 'background 0.1s, color 0.1s, border-color 0.1s',
}
