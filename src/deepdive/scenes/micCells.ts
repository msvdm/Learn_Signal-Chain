import type { Box } from '../wave'
import type { MicKind } from '../mics'

// Where Microphone types (Deep dive, D46) puts its four cells — a 2 × 2 grid, a step adding each —
// apart from its scene so the subject's steps can name their boxes.

/** A cell's size, and how far apart they stand */
export const CELL_W = 720, CELL_H = 380
const GAP = 50
/** Where each microphone's cell stands: its top-left corner */
export const CELLS: Record<MicKind, readonly [number, number]> = {
  dynamic:   [0, 0],
  condenser: [CELL_W + GAP, 0],
  ribbon:    [0, CELL_H + GAP],
  piezo:     [CELL_W + GAP, CELL_H + GAP],
}
/** A cell as a step's box (Subject.steps): what the camera shows of it */
export function cellBox(kind: MicKind): Box {
  const [x, y] = CELLS[kind]
  return [x, y, x + CELL_W, y + CELL_H]
}
