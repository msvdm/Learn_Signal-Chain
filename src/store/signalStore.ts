import { create } from 'zustand'
import type { LevelId } from '../data/levels'

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
  masterTrimDb: number
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
  compThresholdDb: -18,
  compRatio: 4,
  compMakeupGainDb: 0,
  faderDb: 0,
  masterTrimDb: 0,
}

interface SignalChainStore {
  level: LevelId
  nodeState: NodeState
  activeTooltipId: string | null
  tourIndex: number
  placedNodeIds: string[]

  setLevel: (level: LevelId) => void
  updateNodeState: (patch: Partial<NodeState>) => void
  updateEQBand: (index: number, patch: Partial<EQBand>) => void
  setActiveTooltip: (id: string | null) => void
  advanceTour: () => void
  addPlacedNode: (id: string) => void
  resetToDefaults: () => void
}

export const useSignalStore = create<SignalChainStore>((set) => ({
  level: 1,
  nodeState: { ...DEFAULT_NODE_STATE },
  activeTooltipId: 'mic',
  tourIndex: 0,
  placedNodeIds: [],

  setLevel: (level) =>
    set({
      level,
      nodeState: { ...DEFAULT_NODE_STATE },
      activeTooltipId: level === 1 ? 'mic' : null,
      tourIndex: 0,
      placedNodeIds: [],
    }),

  updateNodeState: (patch) =>
    set((s) => ({ nodeState: { ...s.nodeState, ...patch } })),

  updateEQBand: (index, patch) =>
    set((s) => {
      const bands = [...s.nodeState.eqBands]
      bands[index] = { ...bands[index], ...patch }
      return { nodeState: { ...s.nodeState, eqBands: bands } }
    }),

  setActiveTooltip: (id) => set({ activeTooltipId: id }),

  advanceTour: () =>
    set((s) => {
      const seq = ['mic', 'preamp', 'eq', 'comp', 'fader', 'master', 'speaker']
      const next = s.tourIndex + 1
      return {
        tourIndex: next,
        activeTooltipId: next < seq.length ? seq[next] : null,
      }
    }),

  addPlacedNode: (id) =>
    set((s) => ({
      placedNodeIds: s.placedNodeIds.includes(id)
        ? s.placedNodeIds
        : [...s.placedNodeIds, id],
    })),

  resetToDefaults: () =>
    set((s) => ({
      nodeState: { ...DEFAULT_NODE_STATE },
      activeTooltipId: s.level === 1 ? 'mic' : null,
      tourIndex: 0,
    })),
}))
