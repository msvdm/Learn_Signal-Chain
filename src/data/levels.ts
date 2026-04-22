export type LevelId = 1 | 2 | 3 | 4

export interface LevelConfig {
  id: LevelId
  title: string
  badge: string
  description: string
  visibleNodes: string[]
  interactiveNodes: string[]
  nodesDraggable: boolean
  nodesConnectable: boolean
  showPalette: boolean
  guidedTour: boolean
  tourSequence: string[]
  eqMode: 'static' | 'sliders' | 'curve'
}

const ALL_NODES = ['mic', 'preamp', 'eq', 'comp', 'fader', 'master', 'speaker']

export const levels: Record<LevelId, LevelConfig> = {
  1: {
    id: 1,
    title: 'Watch & Learn',
    badge: 'Level 1',
    description: 'Follow the signal through a complete chain. Click each element to learn what it does.',
    visibleNodes: ALL_NODES,
    interactiveNodes: [],
    nodesDraggable: false,
    nodesConnectable: false,
    showPalette: false,
    guidedTour: true,
    tourSequence: ALL_NODES,
    eqMode: 'static',
  },
  2: {
    id: 2,
    title: 'Adjust',
    badge: 'Level 2',
    description: 'The chain is built. Move the controls and watch the signal change in real time.',
    visibleNodes: ALL_NODES,
    interactiveNodes: ['preamp', 'eq', 'comp', 'fader', 'master'],
    nodesDraggable: false,
    nodesConnectable: false,
    showPalette: false,
    guidedTour: false,
    tourSequence: [],
    eqMode: 'sliders',
  },
  3: {
    id: 3,
    title: 'Build',
    badge: 'Level 3',
    description: 'Drag elements from the palette onto the canvas and connect them in the correct order.',
    visibleNodes: ['mic', 'speaker'],
    interactiveNodes: ['preamp', 'eq', 'comp', 'fader', 'master'],
    nodesDraggable: true,
    nodesConnectable: true,
    showPalette: true,
    guidedTour: false,
    tourSequence: [],
    eqMode: 'sliders',
  },
  4: {
    id: 4,
    title: 'Experiment',
    badge: 'Level 4',
    description: 'Full access. Reorder elements, try unusual configurations, break things and learn why.',
    visibleNodes: ALL_NODES,
    interactiveNodes: ALL_NODES,
    nodesDraggable: true,
    nodesConnectable: true,
    showPalette: true,
    guidedTour: false,
    tourSequence: [],
    eqMode: 'curve',
  },
}

export const PALETTE_NODES = [
  { id: 'preamp', label: 'Preamp / Gain', icon: 'Zap' },
  { id: 'eq', label: 'EQ', icon: 'Activity' },
  { id: 'comp', label: 'Compressor', icon: 'Minimize2' },
  { id: 'fader', label: 'Fader', icon: 'SlidersHorizontal' },
  { id: 'master', label: 'Master Bus', icon: 'Layers' },
]
