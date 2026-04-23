import type { SignalChainResult } from '../hooks/useSignalChain'

export interface JourneyStep {
  id: number
  unlocksNodeId: string
  goalLabel: string
  goalCheck: (chain: SignalChainResult) => boolean
}

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 0,
    unlocksNodeId: 'eq',
    goalLabel: 'Get the preamp output into the green zone (−40 to −12 dBu)',
    goalCheck: (chain) => chain.preamp.health === 'good',
  },
  {
    id: 1,
    unlocksNodeId: 'comp',
    goalLabel: 'Shape the EQ without clipping (no red on the EQ stage)',
    goalCheck: (chain) => chain.eq.health !== 'clipping',
  },
  {
    id: 2,
    unlocksNodeId: 'fader',
    goalLabel: 'Compress: keep gain reduction under 6 dB',
    goalCheck: (chain) => chain.comp.gainReductionDb <= 6 && chain.comp.health !== 'too-quiet',
  },
  {
    id: 3,
    unlocksNodeId: 'master',
    goalLabel: 'Set the channel fader to a healthy level (green zone)',
    goalCheck: (chain) => chain.fader.health === 'good',
  },
]

export const CHAIN_ORDER = ['mic', 'preamp', 'eq', 'comp', 'fader', 'master', 'speaker']
