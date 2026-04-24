import type { ComplexityLevel } from '../store/signalStore'

export const CHAIN_ORDER = ['mic', 'preamp', 'eq', 'comp', 'fader', 'master', 'speaker']

const BEGINNER_NODES = ['mic', 'preamp', 'eq', 'comp', 'speaker']
const FULL_NODES = [...CHAIN_ORDER]

export function getLevelNodes(level: ComplexityLevel): string[] {
  return level === 'beginner' ? BEGINNER_NODES : FULL_NODES
}
