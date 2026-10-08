import type { ReactNode, CSSProperties } from 'react'
import { Power } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useNodeChrome } from '../../hooks/useNodeChrome'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_REGISTRY, isNodeStereo } from '../../data/nodeRegistry'
import { HEADER_H, PORT_TOP, PORT_GAP, cardMinSize } from '../../utils/layoutHelpers'
import { EdgeTags, PortStack, WireTargetBadge } from './NodeChrome'
import { NODE_LOOK } from './nodeLook'
import { OverviewFace } from './OverviewFace'
import type { OverviewArt } from './OverviewFace'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { MeterStrip, STRIP_W } from '../SignalMeter'
import { SPL_DB } from '../../signal/levels'

// Side padding of the body: the port rings reach 14px into the card, so content starts clear of them
const BODY_PAD_X = 20
// A face-only card's upright meter, zoomed in: on the right of its face, which keeps this much room
// free for it (the card is its registry minSize plus this room, as tall as the minSize)
const FACE_METER_PAD  = '14px 20px 12px'
const FACE_METER_ROOM = STRIP_W + 16

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
  /** Overview: false = no level block, the art takes the whole card. */
  overviewLevel?: boolean
  /**
   * Overview: no card — no frame, no background — like a free-standing control: the art over the
   * meter bar alone, no numbers (Microphone, Line Input, Instrument)
   */
  overviewBare?: boolean
  /**
   * Show only the overview face (its icon) at every zoom: no header, no body. With a level
   * (`overviewLevel`), an upright meter beside it zoomed in — dB SPL where the card meets the air
   * (SPL_DB) — and the level under it zoomed out.
   */
  faceOnly?: boolean
  /**
   * A face-only card that draws its own face, at every zoom, in place of the overview face: over
   * the whole card, in its own pixels, so its lines can meet the ports (the Relay Switch's symbol)
   */
  ownFace?: ReactNode
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
  overviewBare = false,
  faceOnly = false,
  ownFace,
}: NodeWrapperProps) {
  const toggleBypassNode = useSignalStore((s) => s.toggleBypassNode)
  const setNodeStereo    = useSignalStore((s) => s.setNodeStereo)
  const { node, ports, chains, selected, overview, wireTarget, notConnected } = useNodeChrome(nodeId, typeKey)
  const { t }            = useTranslation()

  const isBypassed = node?.bypassed ?? false
  const look       = NODE_LOOK[typeKey]
  const canBypass  = NODE_REGISTRY[typeKey].bypass
  const canStereo  = NODE_REGISTRY[typeKey].stereo === 'optional'
  const { inputs, outputs } = ports
  // A source with nothing on its output says so instead of a level (D11)
  const status     = notConnected ? t.status.notConnected : undefined

  // One size at every level (the registry's minSize), tall enough for the longest stack of ports
  const portRows  = Math.max(inputs.length, outputs.length, 1)
  const minSize   = cardMinSize(typeKey)
  // A face-only card with a level: its meter
  const meter     = faceOnly && overviewLevel
  const minHeight = Math.max(minSize.h, PORT_TOP + (portRows - 1) * PORT_GAP + 24)

  // In overview the controls stay in place, invisible, so the card keeps its exact size
  const hideInOverview: CSSProperties = overview ? { visibility: 'hidden', opacity: 0 } : {}

  // Zoomed out with no card around it (overviewBare): only a selection still draws its ring
  const bare        = overview && overviewBare
  const borderColor = bare && !selected ? 'transparent' : isBypassed ? 'var(--signal-hot)' : selected ? 'var(--lsc-accent)' : 'var(--lsc-border)'
  // Selected: a solid ring, a soft glow and a tinted face — thicker zoomed out, so it still shows
  const ring = overview ? 12 : 4

  return (
    <div
      className={`lsc-node-card select-none ${selected ? 'lsc-selected' : ''} ${className}`}
      style={{
        position: 'relative',
        width: 'max-content',
        minWidth: minSize.w + (meter ? FACE_METER_ROOM : 0),
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        background: selected
          ? 'linear-gradient(var(--lsc-select-tint), var(--lsc-select-tint)), var(--lsc-node-bg)'
          : bare ? 'transparent' : 'var(--lsc-node-bg)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: selected
          ? `0 0 0 ${ring}px var(--lsc-accent), 0 0 0 ${ring * 3}px var(--lsc-select-halo), var(--lsc-shadow-node)`
          : bare ? 'none' : 'var(--lsc-shadow-node)',
        color: 'var(--lsc-fg)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {wireTarget && <WireTargetBadge label={label} />}

      {/* Chain colour stripe — one segment per source feeding this card */}
      {chains.length > 0 && !bare && (
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
      <EdgeTags nodeId={nodeId} overview={overview} notConnected={notConnected && !faceOnly} />

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
                aria-label={isBypassed ? t.nodeControls.turnOn : t.nodeControls.turnOff}
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
      </>}

      {/* A face-only card is its face: zoomed in with its meter on the right, zoomed out with its
          level under it. Not connected: the face says so */}
      {faceOnly && <>
        {/* The face's place; zoomed in, its meter on the right (hidden, its space kept, when not connected) */}
        <div style={{ height: minHeight - 2, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: FACE_METER_PAD, boxSizing: 'border-box' }}>
          {meter && (
            <div className="lsc-fade" style={{ display: 'flex', ...(notConnected ? { visibility: 'hidden' } : {}), ...hideInOverview }}>
              <FaceMeter nodeId={nodeId} typeKey={typeKey} />
            </div>
          )}
        </div>
      </>}

      {/* Overview (zoomed out): name + output level, drawn over the hidden controls, under the ports.
          A face-only card shows its face at every zoom: zoomed in beside its meter, zoomed out with
          its level under it */}
      {ownFace ?? <OverviewFace
        nodeId={nodeId}
        typeKey={typeKey}
        label={label}
        art={overviewArt}
        showLevel={overviewLevel && (!faceOnly || overview)}
        barOnly={overviewBare}
        status={status}
        shown={overview || faceOnly}
        bypassed={isBypassed}
        reserveRight={meter && !overview ? FACE_METER_ROOM : 0}
        spl={SPL_DB[typeKey]}
      />}
    </div>
  )
}

/** A face-only card's upright meter: what it plays or picks up — dB SPL where that is sound in the air. */
function FaceMeter({ nodeId, typeKey }: { nodeId: string; typeKey: TypeKey }) {
  const { t }  = useTranslation()
  const levels = useStereoLevels(nodeId)
  const spl    = SPL_DB[typeKey]
  return (
    <MeterStrip
      {...levels.output}
      label={spl === undefined ? t.meters.output : t.meters.sound}
      nodeId={nodeId} at="out" spl={spl}
    />
  )
}

/** Two-part switch: Mono | Stereo. */
function StereoToggle({ stereo, onChange, labels }: {
  stereo: boolean
  onChange: (stereo: boolean) => void
  labels: [string, string]
}) {
  return (
    <div
      className="nodrag nopan"
      role="radiogroup"
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
