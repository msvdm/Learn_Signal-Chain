import { useMemo, useState, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type NodeChange,
  BackgroundVariant,
  SelectionMode,
  useReactFlow,
  useStore,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { NODE_COMPONENTS }      from './nodes'
import { ChainEdge }            from './ChainEdge'
import { ConnectingToast }      from './ConnectingToast'
import { HelpPopover }          from './Tooltip'
import { NodeMenu, CanvasMenu } from './NodeMenu'
import { CanvasTools }          from './CanvasTools'
import { CanvasOverlays }       from './CanvasOverlays'
import { ChainOpener }          from './ChainOpener'

import { useSignalStore }       from '../store/signalStore'
import { useTranslation }       from '../i18n/useTranslation'
import { useChainEmpty }        from '../hooks/useChainEmpty'
import { useChainFile }         from '../hooks/useChainFile'
import { useFitView }           from '../hooks/useFitView'
import { useSwallowClick, useWireDrawing } from '../hooks/useWireDrawing'
import { useCanvasClicks }      from '../hooks/useCanvasClicks'
import { useNodeDrag }          from '../hooks/useNodeDrag'
import { useGroupActions }      from '../hooks/useGroupActions'
import { useCanvasShortcuts }   from '../hooks/useCanvasShortcuts'
import { usePaletteDrop }       from '../hooks/usePaletteDrop'
import { useFlowElements }      from '../hooks/useFlowElements'
import { useStableHandlers }    from '../hooks/useStableHandlers'
import { GRID, nodeDims }       from '../utils/layoutHelpers'
import type { Pt }              from '../utils/geometry'

const edgeTypes = { chain: ChainEdge }

// Handed to React Flow as the same objects on every render: a new one would make it redraw the cards
const NODE_ORIGIN: [number, number] = [0, 0]
const PAN_MIDDLE_BUTTON = [1]
const PRO_OPTIONS = { hideAttribution: false }
const FLOW_STYLE = { background: 'var(--lsc-canvas)' }

// Overview: zoomed out this far, cards show only their name and output level. Two thresholds
// (hysteresis), so a zoom resting near the boundary never flips the cards back and forth.
const OVERVIEW_ENTER_ZOOM = 0.42
const OVERVIEW_LEAVE_ZOOM = 0.5

/**
 * The canvas: React Flow with the app's own wiring, selecting, dragging and dropping (the hooks
 * below), the overlays drawn over it, the right-click menus and the open-chain dialog.
 */
export function SignalChain() {
  const toolMode        = useSignalStore((s) => s.toolMode)
  const leftTool        = useSignalStore((s) => s.leftTool)
  const snapToGrid      = useSignalStore((s) => s.snapToGrid)
  const overview        = useSignalStore((s) => s.overview)
  const capturing       = useSignalStore((s) => s.capturing)
  const hasNodes        = useSignalStore((s) => s.nodes.length > 0)
  const canPaste        = useSignalStore((s) => (s.clipboard?.nodes.length ?? 0) > 0)
  const wiring          = useSignalStore((s) => s.wire !== null)
  // The type of the element the wire is drawn from, for the "Connecting from …" toast
  const wireFromType    = useSignalStore((s) => s.nodes.find((n) => n.id === s.wire?.source.nodeId)?.typeKey)
  const setOverview     = useSignalStore((s) => s.setOverview)
  const setSelection    = useSignalStore((s) => s.setSelection)
  const setSelectedNode = useSignalStore((s) => s.setSelectedNode)
  const zoom            = useStore((s) => s.transform[2])
  const { t }           = useTranslation()
  const chainFile       = useChainFile()
  const chainEmpty      = useChainEmpty()
  const { screenToFlowPosition, setViewport } = useReactFlow()
  const { fitViewOptions } = useFitView()
  // An autosaved canvas is brought on screen once it is measured (a blank one stays at 100%)
  const [startsFilled]  = useState(() => useSignalStore.getState().nodes.length > 0)

  const wrapperRef   = useRef<HTMLDivElement>(null)
  const swallowClick = useSwallowClick()
  const cursor       = useWireDrawing(wrapperRef, swallowClick)
  const clicks       = useCanvasClicks(wrapperRef, swallowClick)
  const drag         = useNodeDrag()
  const actions      = useGroupActions()
  useCanvasShortcuts(wrapperRef, actions)
  const drop         = usePaletteDrop(actions.insertChainAt)
  const flow         = useFlowElements()

  // Right-click menu of an element (Help, Bypass, Cut, Copy, Duplicate, Remove) — `targets` are
  // what its actions apply to: the element, or the whole selection it belongs to
  const [nodeMenu, setNodeMenu]     = useState<{ nodeId: string; targets: string[]; x: number; y: number } | null>(null)
  // Right-click menu of the empty canvas (Paste here, Select everything); `at` in flow coordinates
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number; at: Pt } | null>(null)

  // ── Camera ──────────────────────────────────────────────────────────────────

  // A blank canvas (start, Reset, level change, last node removed) shows 100% zoom
  useEffect(() => {
    if (chainEmpty) setViewport({ x: 0, y: 0, zoom: 1 })
  }, [chainEmpty, setViewport])

  // Cards read only this flag, never the zoom itself, so a wheel tick does not re-render them all
  // (Not while a picture is taken: it shows the cards' controls whatever the zoom)
  useEffect(() => {
    if (capturing) return
    if (!overview && zoom < OVERVIEW_ENTER_ZOOM) setOverview(true)
    else if (overview && zoom > OVERVIEW_LEAVE_ZOOM) setOverview(false)
  }, [zoom, overview, setOverview, capturing])

  // What React Flow calls back, as functions that never change: it passes the node handlers on to
  // every card, and a new function would redraw them all on every change
  const handlers = useStableHandlers({
    onDrop:          drop.onDrop,
    onDragOver:      drop.onDragOver,
    onNodeClick:     clicks.onNodeClick,
    onNodeDragStart: clicks.onNodeDragStart,
    onNodeDrag:      drag.onNodeDrag,
    onNodeDragStop:  drag.onNodeDragStop,
    onPaneClick:     clicks.onPaneClick,
    // Selection from React Flow's box, measured card sizes (a card dropped onto a wire then makes room)
    onNodesChange: (changes: NodeChange[]) => {
      clicks.selectFromBox(changes)
      flow.keepSizes(changes)
      for (const c of changes) {
        if (c.type === 'dimensions' && c.dimensions) drop.onMeasured(c.id, c.dimensions)
      }
    },
    onNodeContextMenu: (e: React.MouseEvent, node: { id: string }) => {
      // (A right-click while drawing a wire never gets here: it only cancels the wire)
      e.preventDefault()
      // Part of a selection: the menu acts on all of it. Otherwise this element becomes the selection.
      const selected = useSignalStore.getState().selectedNodeIds
      const targets  = selected.includes(node.id) ? selected : [node.id]
      if (!selected.includes(node.id)) setSelectedNode(node.id)
      setNodeMenu({ nodeId: node.id, targets, x: e.clientX, y: e.clientY })
    },
    onPaneContextMenu: (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault()
      setCanvasMenu({ x: e.clientX, y: e.clientY, at: screenToFlowPosition({ x: e.clientX, y: e.clientY }) })
    },
  })

  // Zoom control tooltips follow the app language
  const ariaLabelConfig = useMemo(() => ({
    'controls.ariaLabel':         t.toolbar.zoom,
    'controls.zoomIn.ariaLabel':  t.toolbar.zoomIn,
    'controls.zoomOut.ariaLabel': t.toolbar.zoomOut,
    'controls.fitView.ariaLabel': t.toolbar.zoomFit,
  }), [t])

  const ghosts = drop.preview
    ? [{ pos: drop.preview.pos, ...nodeDims(drop.preview.typeKey) }]
    : drag.ghosts

  const wrapperClass = [
    toolMode === 'connect' ? 'lsc-connect-mode' : '',
    wiring ? 'lsc-wiring' : '',
    leftTool === 'remove' ? 'lsc-remove-mode' : '',
    leftTool === 'select' ? 'lsc-select-mode' : '',
  ].join(' ')
  const canEdit = toolMode === 'select' && leftTool !== 'remove'

  return (
    // `isolation`: everything drawn on the canvas stays under the palette that slides over it
    <div ref={wrapperRef} className={wrapperClass} style={{ width: '100%', height: '100%', position: 'relative', isolation: 'isolate' }} onDragLeave={drop.onDragLeave}>
      <ReactFlow
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={NODE_COMPONENTS}
        edgeTypes={edgeTypes}
        nodesDraggable={canEdit}
        nodesConnectable={false}
        elementsSelectable={canEdit}
        // Select tool: dragging empty space draws a selection box (the middle button still pans)
        panOnDrag={toolMode !== 'select' ? false : leftTool === 'select' ? PAN_MIDDLE_BUTTON : true}
        selectionOnDrag={canEdit && leftTool === 'select'}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={null}
        nodeOrigin={NODE_ORIGIN}
        fitView={startsFilled}
        fitViewOptions={fitViewOptions}
        minZoom={0.15}
        maxZoom={2}
        proOptions={PRO_OPTIONS}
        ariaLabelConfig={ariaLabelConfig}
        style={FLOW_STYLE}
        {...handlers}
      >
        {snapToGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={GRID}
            size={2.4}
            color="var(--lsc-grid)"
          />
        )}
        <Controls
          position="bottom-left"
          className="lsc-left-tools"
          orientation="horizontal"
          showInteractive={false}
          fitViewOptions={fitViewOptions}
        />
        <CanvasTools />
      </ReactFlow>

      <CanvasOverlays cursor={cursor} ghosts={ghosts} />

      <HelpPopover />
      {nodeMenu && (
        <NodeMenu
          {...nodeMenu}
          onCut={() => actions.cutNodes(nodeMenu.targets)}
          onCopy={() => actions.copyNodes(nodeMenu.targets)}
          onDuplicate={(dir) => actions.duplicateNodes(nodeMenu.targets, dir)}
          onRemove={() => actions.removeSelected(nodeMenu.targets)}
          onClose={() => setNodeMenu(null)}
        />
      )}
      {canvasMenu && (
        <CanvasMenu
          x={canvasMenu.x}
          y={canvasMenu.y}
          canPaste={canPaste}
          canSelectAll={hasNodes}
          onPaste={() => actions.pasteAt(canvasMenu.at)}
          onSelectAll={() => setSelection(useSignalStore.getState().nodes.map((n) => n.id))}
          onInsertChain={() => {
            const { at } = canvasMenu
            chainFile.pickChain().then((read) => { if (read) actions.insertChainAt(read, at) })
          }}
          onClose={() => setCanvasMenu(null)}
        />
      )}
      <ChainOpener />
      {wiring && <ConnectingToast sourceLabel={wireFromType ? (t.palette.items[wireFromType] ?? wireFromType) : ''} />}
    </div>
  )
}
