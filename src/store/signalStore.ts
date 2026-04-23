import { create } from 'zustand'
import type { Lang } from '../i18n/translations'

function getInitialLanguage(): Lang {
  const stored = localStorage.getItem('lsc-language')
  if (stored === 'en' || stored === 'bg') return stored
  return navigator.language.startsWith('bg') ? 'bg' : 'en'
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
  compThresholdDb: 0,   // neutral by default (no compression until unlocked)
  compRatio: 2,
  compMakeupGainDb: 0,
  faderDb: 0,
  masterTrimDb: 0,
}

const JOURNEY_UNLOCK_ORDER = ['eq', 'comp', 'fader', 'master']
const INITIAL_UNLOCKED = ['mic', 'preamp', 'speaker']

interface SignalChainStore {
  language: Lang
  nodeState: NodeState
  activeTooltipId: string | null

  // Journey progression
  journeyStep: number
  unlockedNodes: string[]

  setLanguage: (lang: Lang) => void
  updateNodeState: (patch: Partial<NodeState>) => void
  updateEQBand: (index: number, patch: Partial<EQBand>) => void
  setActiveTooltip: (id: string | null) => void
  unlockNextNode: () => void
  resetJourney: () => void
}

export const useSignalStore = create<SignalChainStore>((set) => ({
  language: getInitialLanguage(),
  nodeState: { ...DEFAULT_NODE_STATE },
  activeTooltipId: null,
  journeyStep: 0,
  unlockedNodes: [...INITIAL_UNLOCKED],

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

  unlockNextNode: () =>
    set((s) => {
      const nextId = JOURNEY_UNLOCK_ORDER[s.journeyStep]
      if (!nextId) return s
      const unlockedNodes = s.unlockedNodes.includes(nextId)
        ? s.unlockedNodes
        : [
            ...s.unlockedNodes.filter((n) => n !== 'speaker'),
            nextId,
            'speaker',
          ]
      return { journeyStep: s.journeyStep + 1, unlockedNodes }
    }),

  resetJourney: () =>
    set({
      journeyStep: 0,
      unlockedNodes: [...INITIAL_UNLOCKED],
      nodeState: { ...DEFAULT_NODE_STATE },
      activeTooltipId: null,
    }),
}))
