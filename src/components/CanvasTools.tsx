import { useId } from 'react'
import type { ReactNode } from 'react'
import { Panel } from '@xyflow/react'
import { Hand, SquareDashed, Eraser, Undo2, Redo2 } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import type { LeftTool } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { MOD } from '../utils/shortcut'

/**
 * One row right of the zoom controls: what a left-click on the canvas does — Drag (move
 * elements, pan), Select (pick several, box-select), Remove (click an element or wire) —
 * then Undo / Redo. Icons only; the name shows as soon as the pointer is on a button.
 */
export function CanvasTools() {
  const leftTool    = useSignalStore((s) => s.leftTool)
  const setLeftTool = useSignalStore((s) => s.setLeftTool)
  const canUndo     = useSignalStore((s) => s.past.length > 0)
  const canRedo     = useSignalStore((s) => s.future.length > 0)
  const undo        = useSignalStore((s) => s.undo)
  const redo        = useSignalStore((s) => s.redo)
  const { t }       = useTranslation()

  const tools: { id: LeftTool; icon: ReactNode; label: string; hint: string }[] = [
    { id: 'drag',   icon: <Hand size={16} />,         label: t.tools.drag,   hint: t.tools.dragHint },
    { id: 'select', icon: <SquareDashed size={16} />, label: t.tools.select, hint: t.tools.selectHint },
    { id: 'remove', icon: <Eraser size={16} />,       label: t.tools.remove, hint: t.tools.removeHint },
  ]

  return (
    <Panel position="bottom-left" className="lsc-left-tools lsc-canvas-tools">
      <div className="lsc-tool-bar">
        <div role="radiogroup" aria-label={t.tools.label} style={{ display: 'flex' }}>
          {tools.map((tool) => {
            const active = leftTool === tool.id
            return (
              <ToolButton
                key={tool.id}
                role="radio"
                aria-checked={active}
                label={tool.label}
                hint={tool.hint}
                onClick={() => setLeftTool(tool.id)}
                className={`${active ? 'lsc-tool-active' : ''}${tool.id === 'remove' ? ' lsc-tool-remove' : ''}`}
              >
                {tool.icon}
              </ToolButton>
            )
          })}
        </div>
        <div className="lsc-tool-divider" aria-hidden />
        <ToolButton label={t.tools.undo} hint={t.tools.undoHint} shortcut={`${MOD}Z`} disabled={!canUndo} onClick={undo}>
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton label={t.tools.redo} hint={t.tools.redoHint} shortcut={`${MOD}Shift+Z`} disabled={!canRedo} onClick={redo}>
          <Redo2 size={16} />
        </ToolButton>
      </div>
    </Panel>
  )
}

/** An icon button whose name, a line of help and its shortcut pop up above it on hover / focus. */
function ToolButton({ label, hint, shortcut, className = '', children, ...rest }: {
  label: string
  hint: string
  shortcut?: string
  className?: string
  children: ReactNode
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>) {
  const tipId = useId()
  return (
    <button {...rest} aria-label={label} aria-describedby={tipId} className={`lsc-tool-button ${className}`}>
      {children}
      <span id={tipId} role="tooltip" className="lsc-tool-tip">
        <strong>{label}</strong>
        {shortcut && <span className="lsc-tool-tip-key">{shortcut}</span>}
        <span className="lsc-tool-tip-hint">{hint}</span>
      </span>
    </button>
  )
}
