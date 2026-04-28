import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReactFlow } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'

// Orthogonal elbow path in screen space: horizontal first, then vertical.
function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = x1 + (x2 - x1) / 2
  return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`
}

// Read the screen-space center of the output handle DOM element for a given node.
function getHandleScreenPos(nodeId: string, handleId: string): { x: number; y: number } | null {
  const el = document.querySelector(
    `[data-id="${nodeId}"] [data-handleid="${handleId}"]`
  ) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export function SplitDrawOverlay() {
  const splitDraw           = useSignalStore((s) => s.splitDraw)
  const cancelSplitDraw     = useSignalStore((s) => s.cancelSplitDraw)
  const commitSplitToNode   = useSignalStore((s) => s.commitSplitToNode)
  const commitSplitToCanvas = useSignalStore((s) => s.commitSplitToCanvas)
  const { screenToFlowPosition } = useReactFlow()

  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)
  // Anchor is re-read from DOM on every frame so zoom/pan never de-syncs it.
  const anchorRef = useRef<{ x: number; y: number } | null>(null)
  // Use a render-trigger so the SVG redraws when splitDraw first becomes active.
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!splitDraw) {
      anchorRef.current = null
      setMouse(null)
      return
    }
    // Seed mouse at the anchor position so the line has a valid start immediately.
    const pos = getHandleScreenPos(splitDraw.sourceNodeId, splitDraw.sourceHandle)
    if (pos) {
      anchorRef.current = pos
      setMouse(pos)
    }
    forceRender((n) => n + 1)
  }, [splitDraw])

  useEffect(() => {
    if (!splitDraw) return

    function onMove(e: MouseEvent) {
      // Refresh anchor on every move — it tracks the actual rendered handle regardless of pan/zoom.
      const pos = getHandleScreenPos(splitDraw!.sourceNodeId, splitDraw!.sourceHandle)
      if (pos) anchorRef.current = pos
      setMouse({ x: e.clientX, y: e.clientY })
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cancelSplitDraw()
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [splitDraw, cancelSplitDraw])

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    // Check if the user clicked directly on an input handle of a node.
    const target = document.elementFromPoint(e.clientX, e.clientY)
    const handleEl = target?.closest('[data-handleid]') as HTMLElement | null
    if (handleEl) {
      const handleId  = handleEl.getAttribute('data-handleid') ?? 'in'
      const handlePos = handleEl.getAttribute('data-handlepos')
      const nodeEl    = handleEl.closest('[data-id]') as HTMLElement | null
      const nodeId    = nodeEl?.getAttribute('data-id') ?? ''
      // Only connect to input (target) handles — they sit on the left side.
      if (nodeId && (handlePos === 'left' || handleId === 'in' || handleId.startsWith('in-'))) {
        commitSplitToNode(nodeId, handleId)
        return
      }
    }
    // Drop a conn-point at the clicked canvas position.
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    commitSplitToCanvas(flowPos.x, flowPos.y)
  }

  if (!splitDraw || !mouse) return null
  const anchor = anchorRef.current ?? mouse

  return createPortal(
    <>
      {/* Full-screen click catcher */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 8888, cursor: 'crosshair' }}
        onClick={handleClick}
      />
      {/* Dashed elbow line */}
      <svg
        style={{
          position: 'fixed', inset: 0,
          width: '100vw', height: '100vh',
          pointerEvents: 'none',
          zIndex: 8889,
          overflow: 'visible',
        }}
      >
        <path
          d={elbowPath(anchor.x, anchor.y, mouse.x, mouse.y)}
          fill="none"
          stroke="var(--lsc-accent)"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinecap="round"
        />
        <circle cx={anchor.x} cy={anchor.y} r={5} fill="var(--lsc-accent)" />
        <circle cx={mouse.x} cy={mouse.y} r={4} fill="var(--lsc-accent)" opacity={0.7} />
      </svg>
      {/* Tooltip hint */}
      <div
        style={{
          position: 'fixed',
          left: mouse.x + 14,
          top: mouse.y - 22,
          zIndex: 8890,
          pointerEvents: 'none',
          fontSize: 11,
          color: 'var(--lsc-accent)',
          background: 'var(--lsc-node-bg)',
          border: '1px solid var(--lsc-border)',
          borderRadius: 4,
          padding: '2px 6px',
          whiteSpace: 'nowrap',
        }}
      >
        Click a node input to connect · Click canvas to drop point · Esc to cancel
      </div>
    </>,
    document.body
  )
}
