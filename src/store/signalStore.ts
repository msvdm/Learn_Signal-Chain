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
  compThresholdDb: 0,
  compRatio: 2,
  compMakeupGainDb: 0,
  faderDb: 0,
  masterTrimDb: 0,
}

interface SignalChainStore {
  language: Lang
  nodeState: NodeState
  activeTooltipId: string | null
  complexityLevel: ComplexityLevel

  setLanguage: (lang: Lang) => void
  updateNodeState: (patch: Partial<NodeState>) => void
  updateEQBand: (index: number, patch: Partial<EQBand>) => void
  setActiveTooltip: (id: string | null) => void
  setComplexityLevel: (level: ComplexityLevel) => void
  resetNodeState: () => void
}

export const useSignalStore = create<SignalChainStore>((set) => ({
  language: getInitialLanguage(),
  nodeState: { ...DEFAULT_NODE_STATE },
  activeTooltipId: null,
  complexityLevel: getInitialComplexityLevel(),

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

  setActiveTooltip: (id) => set({ activeTooltipId: id }),

  setComplexityLevel: (level) => {
    localStorage.setItem('lsc-complexity-level', level)
    set({ complexityLevel: level })
  },

  resetNodeState: () =>
    set({
      nodeState: { ...DEFAULT_NODE_STATE },
      activeTooltipId: null,
    }),
}))
