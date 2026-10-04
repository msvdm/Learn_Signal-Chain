import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react'
import type { Direction } from '../utils/nodeGroup'

const ICONS: Record<Direction, ReactNode> = {
  left:  <ArrowLeft size={15} />,
  right: <ArrowRight size={15} />,
  up:    <ArrowUp size={15} />,
  down:  <ArrowDown size={15} />,
}

const ORDER: Direction[] = ['left', 'right', 'up', 'down']

/** ← → ↑ ↓ buttons: which side a copy goes (Duplicate) or an opened chain is added. */
export function DirectionArrows({ labels, onPick, role }: {
  /** Tooltip / accessible name of each arrow */
  labels: Record<Direction, string>
  onPick: (dir: Direction) => void
  role?: 'menuitem'
}) {
  return ORDER.map((dir) => (
    <button
      key={dir}
      role={role}
      title={labels[dir]}
      aria-label={labels[dir]}
      onClick={() => onPick(dir)}
      className="lsc-menu-item"
      style={{
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--lsc-radius-sm)', border: '1px solid var(--lsc-border)',
        background: 'transparent', color: 'var(--lsc-fg)', cursor: 'pointer', padding: 0,
      }}
    >
      {ICONS[dir]}
    </button>
  ))
}
