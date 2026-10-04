import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useInternalNode, useReactFlow, useStore, useViewport } from '@xyflow/react'
import { X } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import type { Translations } from '../i18n/translations'
import { chainOrder } from '../graph/graph'
import { helpKeyOf } from '../utils/nodeName'
import { nodeDims } from '../utils/layoutHelpers'
import { useGraphSignal } from '../hooks/useGraphSignal'

const WIDTH  = 380
const ARROW  = 12
const MARGIN = 8
const TOOLBAR_CLEARANCE = 72  // keep the anchored node below the floating toolbar

/** Display name for a node type in the help popover. */
function helpTitle(t: Translations, typeKey: string): string {
  const fromNodes = (t.nodes as Record<string, { label?: string } | undefined>)[typeKey]?.label
  return fromNodes ?? t.palette.items[typeKey] ?? typeKey
}

/**
 * Help popover anchored under the node whose "?" was clicked.
 * Previous / Next walk the chain in signal-flow order.
 */
export function HelpPopover() {
  const activeId   = useSignalStore((s) => s.activeTooltipId)
  const typeKey    = useSignalStore((s) => s.activeTooltipTypeKey)
  const nodes      = useSignalStore((s) => s.nodes)
  const edges      = useSignalStore((s) => s.edges)
  const setActive  = useSignalStore((s) => s.setActiveTooltip)
  const setSelected = useSignalStore((s) => s.setSelectedNode)
  const { t, fmt } = useTranslation()
  const { stages } = useGraphSignal()
  const { setViewport, getViewport } = useReactFlow()
  const { x: vx, y: vy, zoom } = useViewport()
  const paneW = useStore((s) => s.width)
  const paneH = useStore((s) => s.height)
  const anchor = useInternalNode(activeId ?? '')

  const scrollRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const hasAnchor = Boolean(anchor)
  // Re-measure when the content changes (another stage, another language)
  useLayoutEffect(() => {
    // Natural height (before any max-height clamp) + the 1px border top and bottom
    if (scrollRef.current) setHeight(scrollRef.current.scrollHeight + 2)
  }, [activeId, typeKey, t, hasAnchor])

  // Bring the stage and its popover into view: once per opened stage, so it never
  // fights the learner's own panning afterwards.
  useEffect(() => {
    if (!anchor || height === 0) return
    const vp    = getViewport()
    const size  = nodeDims(anchor.type ?? '', anchor.measured.width, anchor.measured.height)
    const w     = size.w * vp.zoom
    const h     = size.h * vp.zoom
    const left  = anchor.internals.positionAbsolute.x * vp.zoom + vp.x
    let   top   = anchor.internals.positionAbsolute.y * vp.zoom + vp.y

    let dx = 0
    if (left < MARGIN || left + w > paneW - MARGIN) dx = paneW / 2 - (left + w / 2)

    let dy = 0
    if (top < TOOLBAR_CLEARANCE || top > paneH - MARGIN) dy = TOOLBAR_CLEARANCE - top
    top += dy
    const fitsBelow = top + h + ARROW + height <= paneH - MARGIN
    const fitsAbove = top - ARROW - height >= MARGIN
    if (!fitsBelow && !fitsAbove) {
      dy -= Math.max(0, Math.min(top + h + ARROW + height - (paneH - MARGIN), top - TOOLBAR_CLEARANCE))
    }

    if (dx !== 0 || dy !== 0) setViewport({ ...vp, x: vp.x + dx, y: vp.y + dy }, { duration: 250 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, height])

  // Stages that have help text, in the order the signal flows through them
  // (a Pan fed a stereo wire opens the Balance text)
  const order = useMemo(
    () => chainOrder({ nodes, edges })
      .map((n) => ({ id: n.id, helpKey: helpKeyOf(n, stages[n.id]) }))
      .filter((n) => Boolean(t.theory[n.helpKey])),
    [nodes, edges, stages, t],
  )

  const entry = typeKey ? t.theory[typeKey] : undefined
  if (!activeId || !typeKey || !entry || !anchor) return null

  const idx  = order.findIndex((n) => n.id === activeId)
  const prev = idx > 0 ? order[idx - 1] : undefined
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : undefined

  // Anchor geometry in canvas (screen) pixels
  const size     = nodeDims(anchor.type ?? '', anchor.measured.width, anchor.measured.height)
  const nodeW    = size.w * zoom
  const nodeH    = size.h * zoom
  const nodeLeft = anchor.internals.positionAbsolute.x * zoom + vx
  const nodeTop  = anchor.internals.positionAbsolute.y * zoom + vy
  const centerX  = nodeLeft + nodeW / 2

  const width = Math.min(WIDTH, paneW - MARGIN * 2)
  const left  = Math.max(MARGIN, Math.min(paneW - width - MARGIN, centerX - width / 2))
  const below = nodeTop + nodeH + ARROW
  // Flip above the node when there is no room underneath
  const placeAbove = height > 0 && below + height > paneH - MARGIN && nodeTop - ARROW - height > MARGIN
  const top = placeAbove ? nodeTop - ARROW - height : below
  // On short screens the popover scrolls inside instead of running off the canvas
  const maxHeight = placeAbove ? undefined : Math.max(180, paneH - MARGIN - below)
  const arrowLeft = Math.max(16, Math.min(width - 28, centerX - left - 6))

  function goTo(id: string, key: string) {
    setActive(id, key)
    setSelected(id)
  }

  function close() {
    setActive(null, null)
  }

  return (
    <div
      className="lsc-overlay nodrag nopan nowheel"
      role="dialog"
      aria-labelledby="lsc-help-title"
      style={{
        position: 'absolute', left, top, width, zIndex: 130,
        borderRadius: 12, background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
        boxShadow: 'var(--lsc-shadow-popup)', color: 'var(--lsc-fg)',
        visibility: height > 0 ? 'visible' : 'hidden',
      }}
    >
      {/* Arrow */}
      <span
        style={{
          position: 'absolute', left: arrowLeft, width: 12, height: 12,
          background: 'var(--lsc-header)', transform: 'rotate(45deg)',
          ...(placeAbove
            ? { bottom: -7, borderRight: '1px solid var(--lsc-border)', borderBottom: '1px solid var(--lsc-border)' }
            : { top: -7, borderLeft: '1px solid var(--lsc-border)', borderTop: '1px solid var(--lsc-border)' }),
        }}
      />

      <div ref={scrollRef} style={{ maxHeight, overflowY: 'auto', borderRadius: 12 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 14px 10px', borderBottom: '1px solid var(--lsc-border-soft)',
          }}
        >
          <h3 id="lsc-help-title" style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 700 }}>
            {helpTitle(t, typeKey)}
          </h3>
          {idx >= 0 && (
            <span style={{ fontSize: 12, color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap' }}>
              {fmt(t.tooltip.stepOf, { n: String(idx + 1), total: String(order.length) })}
            </span>
          )}
          <button
            onClick={close}
            title={t.tooltip.close}
            aria-label={t.tooltip.close}
            style={{
              display: 'flex', padding: 2, border: 'none', background: 'transparent',
              color: 'var(--lsc-fg-muted)', cursor: 'pointer', borderRadius: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <section>
            <h4 className="lsc-overline" style={{ margin: 0 }}>{t.tooltip.whatIsThis}</h4>
            <p style={paragraph}>{entry.what}</p>
          </section>
          <section>
            <h4 className="lsc-overline" style={{ margin: 0 }}>{t.tooltip.whyIsItHere}</h4>
            <p style={paragraph}>{entry.why}</p>
          </section>
          <section
            style={{
              borderRadius: 12, background: 'var(--lsc-tip-bg)', border: '1px solid var(--lsc-tip-bd)',
              padding: '10px 12px',
            }}
          >
            <h4 className="lsc-overline" style={{ margin: 0, color: 'var(--lsc-tip-fg)' }}>{t.tooltip.proTip}</h4>
            <p style={{ ...paragraph, color: 'var(--lsc-tip-fg)' }}>{entry.tip}</p>
          </section>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '0 14px 12px' }}>
          <button
            onClick={() => prev && goTo(prev.id, prev.helpKey)}
            disabled={!prev}
            className={prev ? 'lsc-btn-outline' : undefined}
            style={{
              height: 34, padding: '0 12px', borderRadius: 8,
              border: '1px solid var(--lsc-border)', background: 'transparent',
              color: 'var(--lsc-fg)', fontSize: 13, fontWeight: 600,
              cursor: prev ? 'pointer' : 'default', opacity: prev ? 1 : 0.4,
            }}
          >
            {t.tooltip.previous}
          </button>
          <button
            onClick={() => (next ? goTo(next.id, next.helpKey) : close())}
            style={{
              height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
              background: 'var(--lsc-accent)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {next ? fmt(t.tooltip.nextNode, { name: helpTitle(t, next.helpKey) }) : t.tooltip.finishTour}
          </button>
        </div>
      </div>
    </div>
  )
}

const paragraph: CSSProperties = {
  margin: '3px 0 0', fontSize: 13, lineHeight: 1.5, textWrap: 'pretty',
}
