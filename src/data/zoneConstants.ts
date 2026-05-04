// Zone layout constants shared between levels.ts and SignalChain.tsx.
// The master bus is fixed at MASTER_BUS_FLOW_POS in intermediate/advanced.
// Zone dividers sit 50px outside each edge of the master bus card.

export const MASTER_BUS_FLOW_POS = { x: 500, y: 200 }
export const MASTER_BUS_CARD_W   = 208

export const CENTER_LEFT_BOUND   = MASTER_BUS_FLOW_POS.x - 50                         // 450
export const CENTER_RIGHT_BOUND  = MASTER_BUS_FLOW_POS.x + MASTER_BUS_CARD_W + 50    // 758

// Universal minimum clearance between any two nodes, in all directions.
// Replaces the old horizontal-only MIN_GAP = 108.
export const MIN_NODE_GAP = 100

// Classify a flow-coordinate X into its canvas zone.
export function getZone(x: number): 'left' | 'center' | 'right' {
  if (x < CENTER_LEFT_BOUND)  return 'left'
  if (x > CENTER_RIGHT_BOUND) return 'right'
  return 'center'
}
