import type { SignalNode, SignalEdge, NodeParamValue } from '../data/nodeRegistry'
import { NODE_REGISTRY, initialParams } from '../data/nodeRegistry'
import type { ComplexityLevel } from '../store/signalStore'
import type { NodeGroup, Size } from './nodeGroup'
import { nodeDims } from './layoutHelpers'
import { isPng, readPngText } from './pngText'

// A saved chain: the same JSON in a .json file, in the autosave, and — compressed — in a share
// link (#chain=…) and in a saved picture's PNG text chunk.

export const CHAIN_APP     = 'learn-signal-chain'
export const CHAIN_VERSION = 1
/** Keyword of the PNG text chunk that carries the chain */
export const PNG_KEYWORD   = 'lsc-chain'
/** A share link is the app's address + this + the encoded chain */
export const LINK_PREFIX   = '#chain='

const LEVELS: ComplexityLevel[] = ['beginner', 'intermediate', 'advanced']

export interface ChainFile {
  app: typeof CHAIN_APP
  version: number
  name: string
  /** The level it was made at: the Equalizer looks different below Advanced */
  level: ComplexityLevel
  nodes: SignalNode[]
  edges: SignalEdge[]
  /** Each element's size when saved, to place the chain beside others before it is measured */
  sizes: Record<string, Size>
}

/** A chain read back, and how many of its elements this version of the app does not know. */
export interface ParsedChain {
  chain: ChainFile
  skipped: number
}

/** Why a file could not be opened. */
export type ChainError = 'notChain' | 'noChainInPicture'

export function toChainFile(group: NodeGroup, name: string, level: ComplexityLevel): ChainFile {
  return {
    app: CHAIN_APP, version: CHAIN_VERSION, name, level,
    nodes: group.nodes,
    edges: group.edges,
    sizes: Object.fromEntries(Object.entries(group.sizes)
      .map(([id, s]) => [id, { w: Math.round(s.w), h: Math.round(s.h) }])),
  }
}

/** The chain as a group of elements, ready to be placed with `cloneGroup`. */
export function chainToGroup(chain: ChainFile): NodeGroup {
  return {
    nodes:    chain.nodes,
    edges:    chain.edges,
    outEdges: [],
    sizes:    Object.fromEntries(chain.nodes.map((n) => [n.id, chain.sizes[n.id] ?? nodeDims(n.typeKey)])),
  }
}

// ── Reading (anything can be in a file: keep only what the app can show) ─────────────────────

type Obj = Record<string, unknown>
const isObj   = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum   = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr   = (v: unknown): v is string => typeof v === 'string'
const isPoint = (v: unknown): v is { x: number; y: number } => isObj(v) && isNum(v.x) && isNum(v.y)

/** Saved params over the type's defaults: a file from an older version gets the newer knobs. */
function readParams(typeKey: string, level: ComplexityLevel, saved: unknown): Record<string, NodeParamValue> {
  const params = initialParams(typeKey, level)
  if (!isObj(saved)) return params
  for (const [key, value] of Object.entries(saved)) {
    const known = params[key]
    // A value of the wrong kind would break the card — keep the default
    const ok = known === undefined
      ? isNum(value) || isStr(value) || typeof value === 'boolean'
      : Array.isArray(known) ? Array.isArray(value) : typeof value === typeof known
    if (ok) params[key] = value as NodeParamValue
  }
  return params
}

/** A chain from parsed JSON, or null if it is not one. Elements of unknown types are left out. */
export function parseChainFile(data: unknown): ParsedChain | null {
  if (!isObj(data) || data.app !== CHAIN_APP || !Array.isArray(data.nodes)) return null
  const level = LEVELS.find((l) => l === data.level) ?? 'advanced'

  const nodes: SignalNode[] = []
  let skipped = 0
  for (const n of data.nodes) {
    if (!isObj(n) || !isStr(n.id) || !isStr(n.typeKey) || !isPoint(n.position) ||
        !NODE_REGISTRY[n.typeKey] || nodes.some((m) => m.id === n.id)) {
      skipped++
      continue
    }
    nodes.push({
      id: n.id,
      typeKey: n.typeKey,
      position: { x: n.position.x, y: n.position.y },
      params: readParams(n.typeKey, level, n.params),
      bypassed: n.bypassed === true,
      ...(isStr(n.label) ? { label: n.label } : {}),
      ...(isStr(n.color) ? { color: n.color } : {}),
    })
  }

  const ids   = new Set(nodes.map((n) => n.id))
  const edges: SignalEdge[] = []
  for (const e of Array.isArray(data.edges) ? data.edges : []) {
    if (!isObj(e) || !isStr(e.id) || !isStr(e.source) || !isStr(e.target) ||
        !isStr(e.sourceHandle) || !isStr(e.targetHandle) ||
        !ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue
    edges.push({
      id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle,
      ...(Array.isArray(e.waypoints) && e.waypoints.every(isPoint)
        ? { waypoints: e.waypoints.map((p) => ({ x: p.x, y: p.y })) }
        : {}),
    })
  }

  const sizes: Record<string, Size> = {}
  if (isObj(data.sizes)) {
    for (const [id, s] of Object.entries(data.sizes)) {
      if (ids.has(id) && isObj(s) && isNum(s.w) && isNum(s.h) && s.w > 0 && s.h > 0) sizes[id] = { w: s.w, h: s.h }
    }
  }

  const name = isStr(data.name) ? data.name.slice(0, 100) : ''
  return { chain: { app: CHAIN_APP, version: CHAIN_VERSION, name, level, nodes, edges, sizes }, skipped }
}

// ── Compressed text (share link, PNG chunk) ───────────────────────────────────────────────────

async function pipe(bytes: Uint8Array<ArrayBuffer>, through: CompressionStream | DecompressionStream) {
  const stream = new Blob([bytes]).stream().pipeThrough(through)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0))
}

/** The chain as short URL-safe text: deflated JSON in base64url. */
export async function encodeChain(chain: ChainFile): Promise<string> {
  return toBase64Url(await pipe(new TextEncoder().encode(JSON.stringify(chain)), new CompressionStream('deflate-raw')))
}

/** The chain back from `encodeChain` text (null if it is cut short or not a chain). */
export async function decodeChain(text: string): Promise<ParsedChain | null> {
  try {
    const json = new TextDecoder().decode(await pipe(fromBase64Url(text.trim()), new DecompressionStream('deflate-raw')))
    return parseChainFile(JSON.parse(json))
  } catch {
    return null
  }
}

/** The chain in a share link's address, or null when it has none / it is broken. */
export async function readLink(hash: string): Promise<ParsedChain | 'broken' | null> {
  if (!hash.startsWith(LINK_PREFIX)) return null
  return (await decodeChain(decodeURIComponent(hash.slice(LINK_PREFIX.length)))) ?? 'broken'
}

/** A share link that opens this app with the chain. */
export async function shareLink(chain: ChainFile): Promise<string> {
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}${LINK_PREFIX}${await encodeChain(chain)}`
}

/** A chain from a saved .json file or a picture saved by this app. */
export async function readChainFrom(file: File): Promise<ParsedChain | ChainError> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (isPng(bytes)) {
    const text = readPngText(bytes, PNG_KEYWORD)
    if (text === null) return 'noChainInPicture'
    return (await decodeChain(text)) ?? 'notChain'
  }
  try {
    return parseChainFile(JSON.parse(new TextDecoder().decode(bytes))) ?? 'notChain'
  } catch {
    return 'notChain'
  }
}

// ── Files ─────────────────────────────────────────────────────────────────────────────────────

/** A file name from the chain's name (characters no system allows are dropped). */
export function fileNameOf(name: string, fallback: string, ext: 'json' | 'png'): string {
  const clean = [...name].map((ch) => (ch < ' ' || '\\/:*?"<>|'.includes(ch) ? ' ' : ch)).join('')
    .replace(/\s+/g, ' ').trim()
  return `${clean || fallback}.${ext}`
}

/** Hand the browser a file to save (usually into Downloads). */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Ask for a .json or .png file (null if the learner closes the picker). */
export function pickChainFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input  = document.createElement('input')
    input.type   = 'file'
    input.accept = '.json,.png,application/json,image/png'
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
