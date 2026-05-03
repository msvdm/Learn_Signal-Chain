// Zone layout constants shared between levels.ts and SignalChain.tsx.
// The master bus is fixed at MASTER_BUS_FLOW_POS in intermediate/advanced.
// Zone dividers sit 120px outside the master bus card (208px wide).

export const MASTER_BUS_FLOW_POS = { x: 500, y: 200 }
export const MASTER_BUS_CARD_W   = 208
export const CENTER_LEFT_BOUND   = MASTER_BUS_FLOW_POS.x - 50            // 450
export const CENTER_RIGHT_BOUND  = MASTER_BUS_FLOW_POS.x + MASTER_BUS_CARD_W + 50   // 758
