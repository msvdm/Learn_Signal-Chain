import { MousePointer2, Minus } from 'lucide-react'

type ToolMode = 'select' | 'connect'

interface ToolBarProps {
  mode: ToolMode
  onChange: (mode: ToolMode) => void
}

const TOOLS: { mode: ToolMode; icon: React.ReactNode; label: string; key: string }[] = [
  { mode: 'select',  icon: <MousePointer2 size={15} />, label: 'Select (S)',  key: 'S' },
  { mode: 'connect', icon: <Minus size={15} />,         label: 'Connect (C)', key: 'C' },
]

export function ToolBar({ mode, onChange }: ToolBarProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        gap: 4,
        background: 'var(--lsc-node-bg)',
        border: '1px solid var(--lsc-border)',
        borderRadius: 'var(--lsc-radius-lg)',
        padding: 4,
        boxShadow: 'var(--lsc-shadow-node)',
        pointerEvents: 'auto',
      }}
    >
      {TOOLS.map((tool) => {
        const active = mode === tool.mode
        return (
          <button
            key={tool.mode}
            title={tool.label}
            onClick={() => onChange(tool.mode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              borderRadius: 'var(--lsc-radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--lsc-accent-soft)' : 'var(--lsc-text)',
              background: active ? 'var(--lsc-accent-bg)' : 'transparent',
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = 'var(--lsc-sunken)'
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = 'transparent'
            }}
          >
            {tool.icon}
            <span>{tool.mode === 'select' ? 'Select' : 'Connect'}</span>
          </button>
        )
      })}
    </div>
  )
}
