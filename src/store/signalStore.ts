import { create } from 'zustand'
import type { Lang } from '../i18n/translations'

export type ComplexityLevel = 'beginner' | 'intermediate' | 'advanced' | 'routing-madness'

function getInitialLanguage(): Lang {
  const stored = localStorage.getItem('lsc-language')
  if (stored === 'en' || stored === 'bg') return stored
  return navigator.language.startsWith('bg') ? 'bg' : 'en'
}

function getInitialComplexityLevel(): ComplexityLevel {
  const stored = localStorage.getItem('lsc-complexity-level')
  if (stored === 'beginner' || stored === 'intermediate' ||
      stored === 'advanced' || stored === 'routing-madness') return stored
  return 'beginner'
}

function defaultChainOrder(_level: ComplexityLevel): string[] {
  return ['mic', 'preamp', 'fader', 'master-bus', 'master-fader']
}

export interface EQBand {
  freqHz: number
  gainDb: number
}

export interface NodeState {
  micSensitivityDb: number
  preampGainDb: number
  eqHpfHz: number
  eqBands: EQBand[]
  compThresholdDb: number
  compRatio: 2 | 4 | 8 | 100
  compMakeupGainDb: number
  faderDb: number
  masterFaderDb: number
  outputGainDb: number
  outputEqBands: EQBand[]
}

export interface Send {
  id: string
  fromNodeId: string
  busType: 'aux' | 'fx' | 'pfl'
  faderDb: number
  busPosition: { x: number; y: number }
}

interface PlacingSend {
  fromNodeId: string
  busType: Send['busType']
}

export const DEFAULT_NODE_STATE: NodeState = {
  micSensitivityDb: -60,
  preampGainDb: 40,
  eqHpfHz: 80,
  eqBands: [
    { freqHz: 200, gainDb: 0 },
    { freqHz: 1000, gainDb: 0 },
    { freqHz: 8000, gainDb: 0 },
  ],
  compThresholdDb: 0,
  compRatio: 2,
  compMakeupGainDb: 0,
  faderDb: 0,
  masterFaderDb: 0,
  outputGainDb: 0,
  outputEqBands: [
    { freqHz: 200, gainDb: 0 },
    { freqHz: 1000, gainDb: 0 },
    { freqHz: 8000, gainDb: 0 },
  ],
}

const PROTECTED_NODES = new Set(['mic', 'preamp', 'fader', 'master-bus', 'master-fader'])

interface SignalChainStore {
  language: Lang
  nodeState: NodeState
  activeTooltipId: string | null
  complexityLevel: ComplexityLevel
  chainOrder: string[]
  bypassedNodes: Set<string>
  sends: Send[]
  placingSend: PlacingSend | null

  setLanguage: (lang: Lang) => void
  updateNodeState: (patch: Partial<NodeState>) => void
  updateEQBand: (index: number, patch: Partial<EQBand>) => void
  updateOutputEQBand: (index: number, patch: Partial<EQBand>) => void
  setActiveTooltip: (id: string | null) => void
  setComplexityLevel: (level: ComplexityLevel) => void
  resetNodeState: () => void
  insertNode: (nodeId: string, afterNodeId: string) => void
  removeNode: (nodeId: string) => void
  toggleBypassNode: (nodeId: string) => void
  startPlacingSend: (fromNodeId: string, busType: Send['busType']) => void
  placeSend: (canvasPos: { x: number; y: number }) => void
  cancelSend: () => void
  updateBusFader: (sendId: string, faderDb: number) => void
  updateBusPosition: (sendId: string, position: { x: number; y: number }) => void
  removeSend: (sendId: string) => void
}

export const useSignalStore = create<SignalChainStore>((set) => ({
  language: getInitialLanguage(),
  nodeState: { ...DEFAULT_NODE_STATE },
  activeTooltipId: null,
  complexityLevel: getInitialComplexityLevel(),
  chainOrder: defaultChainOrder(getInitialComplexityLevel()),
  bypassedNodes: new Set<string>(),
  sends: [],
  placingSend: null,

  setLanguage: (lang) => {
    localStorage.setItem('lsc-language', lang)
    set({ language: lang })
  },

  updateNodeState: (patch) =>
    set((s) => ({ nodeState: { ...s.nodeState, ...patch } })),

  updateEQBand: (index, patch) =>
    set((s) => {
      const bands = [...s.nodeState.eqBands]
      bands[index] = { ...bands[index], ...patch }
      return { nodeState: { ...s.nodeState, eqBands: bands } }
    }),

  updateOutputEQBand: (index, patch) =>
    set((s) => {
      const bands = [...s.nodeState.outputEqBands]
      bands[index] = { ...bands[index], ...patch }
      return { nodeState: { ...s.nodeState, outputEqBands: bands } }
    }),

  setActiveTooltip: (id) => set({ activeTooltipId: id }),

  setComplexityLevel: (level) => {
    localStorage.setItem('lsc-complexity-level', level)
    set({
      complexityLevel: level,
      chainOrder: defaultChainOrder(level),
      bypassedNodes: new Set<string>(),
      sends: [],
      placingSend: null,
      nodeState: { ...DEFAULT_NODE_STATE },
      activeTooltipId: null,
    })
  },

  resetNodeState: () =>
    set((s) => ({
      nodeState: { ...DEFAULT_NODE_STATE },
      activeTooltipId: null,
      chainOrder: defaultChainOrder(s.complexityLevel),
      bypassedNodes: new Set<string>(),
      sends: [],
      placingSend: null,
    })),

  insertNode: (nodeId, afterNodeId) =>
    set((s) => {
      if (s.chainOrder.includes(nodeId)) return {}
      const idx = s.chainOrder.indexOf(afterNodeId)
      if (idx === -1) return {}
      const next = [...s.chainOrder]
      next.splice(idx + 1, 0, nodeId)
      return { chainOrder: next }
    }),

  removeNode: (nodeId) =>
    set((s) => {
      if (PROTECTED_NODES.has(nodeId)) return {}
      const next = s.chainOrder.filter((id) => id !== nodeId)
      const nextBypassed = new Set(s.bypassedNodes)
      nextBypassed.delete(nodeId)
      return { chainOrder: next, bypassedNodes: nextBypassed }
    }),

  toggleBypassNode: (nodeId) =>
    set((s) => {
      if (PROTECTED_NODES.has(nodeId)) return {}
      const next = new Set(s.bypassedNodes)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return { bypassedNodes: next }
    }),

  startPlacingSend: (fromNodeId, busType) =>
    set({ placingSend: { fromNodeId, busType } }),

  placeSend: (canvasPos) =>
    set((s) => {
      if (!s.placingSend) return {}
      const send: Send = {
        id: `send-${Date.now()}`,
        fromNodeId: s.placingSend.fromNodeId,
        busType: s.placingSend.busType,
        faderDb: 0,
        busPosition: canvasPos,
      }
      return { sends: [...s.sends, send], placingSend: null }
    }),

  cancelSend: () => set({ placingSend: null }),

  updateBusFader: (sendId, faderDb) =>
    set((s) => ({
      sends: s.sends.map((send) =>
        send.id === sendId ? { ...send, faderDb } : send
      ),
    })),

  updateBusPosition: (sendId, position) =>
    set((s) => ({
      sends: s.sends.map((send) =>
        send.id === sendId ? { ...send, busPosition: position } : send
      ),
    })),

  removeSend: (sendId) =>
    set((s) => ({ sends: s.sends.filter((send) => send.id !== sendId) })),
}))
