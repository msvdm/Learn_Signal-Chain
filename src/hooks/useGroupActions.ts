import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import { GRID } from '../utils/layoutHelpers'
import type { Pt } from '../utils/layoutHelpers'
import { takeGroup, cloneGroup, groupBox, duplicateOffset, pasteOffset } from '../utils/nodeGroup'
import type { Direction, NodeGroup, Placed } from '../utils/nodeGroup'
import { chainToGroup } from '../utils/chainFile'
import type { ParsedChain } from '../utils/chainFile'
import { useCanvasLayout } from './useCanvasLayout'
import { useChainFile } from './useChainFile'
import { useFitView } from './useFitView'
import { usePaletteWidth } from './usePaletteWidth'

/**
 * What the right-click menus and the keys do with elements — cut, copy, paste, duplicate, remove —
 * and a saved chain added to the canvas. A copy gets new ids (and a source its own chain colour),
 * lands clear of the other cards, is selected and brought on screen.
 */
export function useGroupActions() {
  const layout         = useCanvasLayout()
  const flowStore      = useStoreApi()
  const paletteWidth   = usePaletteWidth()
  const { fitSoon }    = useFitView()
  const { skippedNotice } = useChainFile()
  const { flowToScreenPosition, getZoom } = useReactFlow()

  /** Everything on the canvas, with its real size. */
  function placedNodes(): Placed[] {
    return useSignalStore.getState().nodes.map((n) => ({ position: n.position, size: layout.sizeOf(n) }))
  }

  function groupOf(ids: string[]) {
    const { nodes, edges } = useSignalStore.getState()
    return takeGroup(ids, nodes, edges, layout.sizeOf)
  }

  /**
   * Add a copy of `group` moved by `offset`, select it and bring it on screen (`showAll`: the
   * whole canvas, for a chain added beside everything).
   */
  function placeCopy(group: NodeGroup, offset: Pt, showAll = false) {
    const { nodes, edges, addGroup } = useSignalStore.getState()
    const copy = cloneGroup(group, offset, { nodes, edges })
    addGroup(copy.nodes, copy.edges)
    // Never zoom in
    const maxZoom = Math.min(1, getZoom())
    if (showAll) { fitSoon({ maxZoom }); return }
    // Only move the camera when the copy is (partly) off screen
    const box    = groupBox(group)
    const tl     = flowToScreenPosition({ x: box.left + offset.x, y: box.top + offset.y })
    const br     = flowToScreenPosition({ x: box.right + offset.x, y: box.bottom + offset.y })
    const bounds = flowStore.getState().domNode?.getBoundingClientRect()
    if (bounds && (tl.x < bounds.left + paletteWidth || tl.y < bounds.top || br.x > bounds.right || br.y > bounds.bottom)) {
      const ids = [...group.nodes.map((n) => n.id), ...copy.nodes.map((n) => n.id)]
      fitSoon({ maxZoom, nodes: ids.map((id) => ({ id })) })
    }
  }

  function duplicateNodes(ids: string[], dir: Direction) {
    if (ids.length === 0) return
    const group = groupOf(ids)
    placeCopy(group, duplicateOffset(group, dir, placedNodes()))
  }

  function copyNodes(ids: string[]) {
    if (ids.length > 0) useSignalStore.getState().setClipboard(groupOf(ids))
  }

  function cutNodes(ids: string[]) {
    if (ids.length === 0) return
    copyNodes(ids)
    useSignalStore.getState().removeNodes(ids)
  }

  function removeSelected(ids: string[]) {
    const { removeNode, removeNodes } = useSignalStore.getState()
    if (ids.length === 1) removeNode(ids[0])   // one element: its neighbours are wired together
    else if (ids.length > 1) removeNodes(ids)
  }

  /** Paste the copied elements with their top-left corner at `at` (flow coordinates), or beside where they were. */
  function pasteAt(at: Pt | null) {
    const clip = useSignalStore.getState().clipboard
    if (!clip || clip.nodes.length === 0) return
    const box = groupBox(clip)
    placeCopy(clip, pasteOffset(clip, layout.snap(at ?? { x: box.left + 2 * GRID, y: box.top + 2 * GRID }), placedNodes()))
  }

  /** An opened chain's elements join the canvas with new ids and chain colours, moved by `offsetOf`. */
  function addChain(read: ParsedChain, offsetOf: (group: NodeGroup) => Pt, showAll = false) {
    const { offerChain, raiseLevel } = useSignalStore.getState()
    offerChain(null)
    raiseLevel(read.chain.level)
    const group = chainToGroup(read.chain)
    placeCopy(group, offsetOf(group), showAll)
  }

  /** Right-click → Insert a saved chain here, or a file dropped at `at`: no question asked. */
  function insertChainAt(read: ParsedChain, at: Pt) {
    addChain(read, (group) => pasteOffset(group, layout.snap(at), placedNodes()))
    skippedNotice(read)
  }

  return { placedNodes, duplicateNodes, copyNodes, cutNodes, removeSelected, pasteAt, addChain, insertChainAt }
}
