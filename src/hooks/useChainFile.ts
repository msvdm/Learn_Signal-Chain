import { useReactFlow } from '@xyflow/react'
import { toBlob } from 'html-to-image'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { takeGroup } from '../utils/nodeGroup'
import { useCanvasLayout } from './useCanvasLayout'
import { cssVar } from '../utils/fitText'
import { addPngText } from '../utils/pngText'
import type { ChainFile, ParsedChain } from '../utils/chainFile'
import {
  PNG_KEYWORD, toChainFile, encodeChain, shareLink, readChainFrom, pickChainFile, downloadBlob, fileNameOf,
} from '../utils/chainFile'

/** Room around the chain in a saved picture */
const PICTURE_PAD = 40
/** The picture's longest side stays under this many pixels (browsers refuse huge canvases) */
const PICTURE_MAX_SIDE = 8000
/** A link longer than this may be cut short by some chat apps */
const LINK_SAFE_LENGTH = 8000

/** Timers, not animation frames: those stop while the tab is in the background */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Wait until `done()` holds (checked every 20 ms), at most `maxMs`. */
async function waitFor(done: () => boolean, maxMs = 1000) {
  for (const start = Date.now(); !done() && Date.now() - start < maxMs;) await wait(20)
}

/** The crossfade between a card's controls and its overview face (`.lsc-fade` in index.css) */
const FADE_MS = 120

/** Anything on the canvas a picture should not show: a selection ring, dimmed chains, overview faces */
const NOT_IN_PICTURE = '.lsc-selected, .lsc-dimmed, .lsc-fade[aria-hidden="false"]'

/**
 * Saving and opening chains: a .json file, a share link, a picture that carries the chain.
 * Problems and results are shown as a notice at the bottom of the screen.
 */
export function useChainFile() {
  const { getNodes, getNodesBounds } = useReactFlow()
  const { t, fmt } = useTranslation()
  const layout     = useCanvasLayout()

  /** Everything on the canvas, with each card's real size. */
  function snapshot(name: string): ChainFile {
    const { nodes, edges, complexityLevel } = useSignalStore.getState()
    const group = takeGroup(nodes.map((n) => n.id), nodes, edges, layout.sizeOf)
    return toChainFile(group, name, complexityLevel)
  }

  function saveFile(name: string) {
    useSignalStore.getState().setChainName(name)
    const json = JSON.stringify(snapshot(name), null, 2)
    downloadBlob(new Blob([json], { type: 'application/json' }), fileNameOf(name, t.file.defaultName, 'json'))
  }

  async function copyShareLink() {
    const { showNotice, chainName } = useSignalStore.getState()
    const link = await shareLink(snapshot(chainName))
    try {
      await navigator.clipboard.writeText(link)
      showNotice(link.length > LINK_SAFE_LENGTH ? t.file.linkLong : t.file.linkCopied)
    } catch {
      showNotice(t.file.linkFailed, true)
    }
  }

  async function savePicture(name: string) {
    const store = useSignalStore.getState()
    if (store.nodes.length === 0) return
    store.setChainName(name)
    const chain     = snapshot(name)
    const selection = store.selectedNodeIds
    const zoomedOut = store.overview
    // Full cards (not the zoomed-out names), no selection ring, nothing dimmed
    store.setSelection([])
    store.setHighlightEdges([])
    store.setCapturing(true)
    try {
      const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
      if (!viewport) return
      // The cards are drawn again (through React Flow, a few frames); then the crossfade ends
      await waitFor(() => !viewport.querySelector(NOT_IN_PICTURE))
      if (zoomedOut) await wait(FADE_MS + 30)
      // Wires routed around the cards may reach past them
      const box  = getNodesBounds(getNodes())
      const pts  = chain.edges.flatMap((e) => e.waypoints ?? [])
      const left = Math.min(box.x, ...pts.map((p) => p.x)) - PICTURE_PAD
      const top  = Math.min(box.y, ...pts.map((p) => p.y)) - PICTURE_PAD
      const w    = Math.max(box.x + box.width, ...pts.map((p) => p.x)) + PICTURE_PAD - left
      const h    = Math.max(box.y + box.height, ...pts.map((p) => p.y)) + PICTURE_PAD - top
      const blob = await toBlob(viewport, {
        backgroundColor: cssVar('--lsc-canvas'),
        width: w, height: h,
        pixelRatio: Math.min(2, PICTURE_MAX_SIDE / Math.max(w, h)),
        style: { width: `${w}px`, height: `${h}px`, transform: `translate(${-left}px, ${-top}px) scale(1)` },
      })
      if (!blob) throw new Error('no picture')
      const png = addPngText(new Uint8Array(await blob.arrayBuffer()), PNG_KEYWORD, await encodeChain(chain))
      downloadBlob(new Blob([png], { type: 'image/png' }), fileNameOf(name, t.file.defaultName, 'png'))
      useSignalStore.getState().showNotice(t.file.pictureSaved)
    } catch {
      useSignalStore.getState().showNotice(t.file.pictureFailed, true)
    } finally {
      const s = useSignalStore.getState()
      s.setCapturing(false)
      s.setSelection(selection.filter((id) => s.nodes.some((n) => n.id === id)))
    }
  }

  /** Read a chain from a file, telling the learner when it is not one (null then). */
  async function readFile(file: File): Promise<ParsedChain | null> {
    const read = await readChainFrom(file)
    if (typeof read !== 'string') return read
    useSignalStore.getState().showNotice(read === 'noChainInPicture' ? t.file.noChainInPicture : t.file.notChain, true)
    return null
  }

  /** Ask for a file and read the chain in it (null if none was picked or it is not a chain). */
  async function pickChain(): Promise<ParsedChain | null> {
    const file = await pickChainFile()
    return file ? readFile(file) : null
  }

  /** File → Open: the chain waits for the learner's choice (replace or add beside). */
  async function openChain() {
    const read = await pickChain()
    if (read) useSignalStore.getState().offerChain(read)
  }

  /** "N elements were left out" after a chain from a newer version of the app was opened. */
  function skippedNotice(read: ParsedChain) {
    if (read.skipped > 0) {
      useSignalStore.getState().showNotice(fmt(t.file.skipped, { count: String(read.skipped) }), true)
    }
  }

  return { saveFile, copyShareLink, savePicture, readFile, pickChain, openChain, skippedNotice }
}
