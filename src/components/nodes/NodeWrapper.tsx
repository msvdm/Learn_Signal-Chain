import type { ReactNode, CSSProperties } from 'react'
import { Power } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useNodeChrome } from '../../hooks/useNodeChrome'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_REGISTRY, isNodeStereo } from '../../data/nodeRegistry'
import { HEADER_H, cardHeight, cardMinSize } from '../../utils/layoutHelpers'
import { CardFrame } from './CardFrame'
import { NODE_LOOK } from './nodeLook'
import { OverviewFace } from './OverviewFace'
import type { OverviewArt } from './OverviewFace'
import { SPL_DB } from '../../signal/levels'
import { cssVar, textWidth } from '../../utils/fitText'

// Side padding of the body: the port rings reach 14px into the card, so content starts clear of them
const BODY_PAD_X = 20
// The header's title: TITLE_W wide; a name that would take more than two rows there gets just the
// width two rows need, never more than the card has room for (its width less its icon, gaps and On / Off)
const TITLE_W    = 132
const TITLE_ROOM = 100
const TITLE_SIZE = 14      // --node-text-md
const TITLE_SLACK = 2      // a canvas measures a pixel or so off the page

/** How wide a card's title may be: TITLE_W, or for a long name the width two rows need (broken at a space). */
function titleWidth(label: string, cardW: number): number {
  const family = cssVar('--lsc-font-sans')
  const width  = (s: string) => Math.ceil(textWidth(s, family, 600) * TITLE_SIZE) + TITLE_SLACK
  const words  = label.split(' ')
  let twoRows  = width(label)
  for (let k = 1; k < words.length; k++) {
    twoRows = Math.min(twoRows, Math.max(width(words.slice(0, k).join(' ')), width(words.slice(k).join(' '))))
  }
  // Two rows or fewer at the usual width (words fill each row): the usual width
  if (twoRows <= TITLE_W) return TITLE_W
  return Math.min(twoRows, Math.max(TITLE_W, cardW - TITLE_ROOM))
}

interface NodeWrapperProps {
  nodeId: string
  typeKey: TypeKey
  label: string
  children?: ReactNode
  /** Horizontal alignment of the body content. */
  align?: 'stretch' | 'start' | 'center'
  /** Overview (zoomed out): drawn instead of the name, e.g. a big icon. */
  overviewArt?: OverviewArt
  /**
   * Overview: no card — no frame, no background — like a free-standing control: the art over the
   * meter bar alone, no numbers (Microphone, Line Input)
   */
  overviewBare?: boolean
}

/**
 * A full card: its header (icon, title, On / Off), a Mono | Stereo switch where it has one, and its
 * body, in the frame every card shares (CardFrame). Width follows the content (controls, graphs);
 * text wraps to fit. The 56px header keeps the first port line at the same height on every card,
 * so wires between cards stay straight no matter how tall each card is. Zoomed out its name (or
 * art) and the level leaving it are drawn over the hidden controls (OverviewFace). A card that is
 * only its face: FaceCard.
 */
export function NodeWrapper({
  nodeId,
  typeKey,
  label,
  children,
  align = 'stretch',
  overviewArt,
  overviewBare = false,
}: NodeWrapperProps) {
  const toggleBypassNode = useSignalStore((s) => s.toggleBypassNode)
  const setNodeStereo    = useSignalStore((s) => s.setNodeStereo)
  const chrome           = useNodeChrome(nodeId, typeKey)
  const { node, ports, overview, notConnected } = chrome
  const { t }            = useTranslation()

  const isBypassed = node?.bypassed ?? false
  const look       = NODE_LOOK[typeKey]
  const canBypass  = NODE_REGISTRY[typeKey].bypass
  const canStereo  = NODE_REGISTRY[typeKey].stereo === 'optional'
  // One size at every level (the registry's minSize), tall enough for its lowest port
  const minSize    = cardMinSize(typeKey)

  // In overview the controls stay in place, invisible, so the card keeps its exact size
  const hideInOverview: CSSProperties = overview ? { visibility: 'hidden', opacity: 0 } : {}

  return (
    <CardFrame
      nodeId={nodeId} typeKey={typeKey} label={label} chrome={chrome}
      size={{ w: minSize.w, h: cardHeight(typeKey, ports) }}
      bare={overview && overviewBare}
      // A source with nothing on its output says so instead of a level (D11)
      notConnectedTag={notConnected}
    >
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
        {/* Short titles stay on one line (the card grows); long ones wrap — onto two rows at most
            where the card has room (Bulgarian's Допълнителна смесителна шина (Aux)) */}
        <span
          style={{
            flex: '0 1 auto', width: 'max-content', maxWidth: titleWidth(label, minSize.w),
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

      {/* Overview (zoomed out): name + output level, drawn over the hidden controls, under the ports */}
      <OverviewFace
        nodeId={nodeId}
        typeKey={typeKey}
        label={label}
        art={overviewArt}
        barOnly={overviewBare}
        status={notConnected ? t.status.notConnected : undefined}
        shown={overview}
        bypassed={isBypassed}
        spl={SPL_DB[typeKey]}
      />
    </CardFrame>
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
