import type { ReactNode } from 'react'
import {
  Mic, Cable, Guitar,
  Zap, Filter, Activity, Box, SlidersHorizontal, ToggleLeft, Gauge, Sliders, Radio,
  Merge, Volume2, MonitorSpeaker, Link2,
} from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import type { ComplexityLevel } from '../store/signalStore'
import { setActiveDragTypeKey } from '../utils/dragState'
import { useTranslation } from '../i18n/useTranslation'

type ToolMode = 'select' | 'connect'

interface PaletteItem {
  typeKey: string
  icon: ReactNode
  category: 'source' | 'processing' | 'routing' | 'output'
}

const ALL_ITEMS: PaletteItem[] = [
  // Sources
  { typeKey: 'mic',           icon: <Mic size={16} />,              category: 'source' },
  { typeKey: 'line-in',       icon: <Cable size={16} />,            category: 'source' },
  { typeKey: 'instrument',    icon: <Guitar size={16} />,           category: 'source' },
  // Processing
  { typeKey: 'gain',          icon: <Zap size={16} />,              category: 'processing' },
  { typeKey: 'fader',         icon: <SlidersHorizontal size={16} />, category: 'processing' },
  { typeKey: 'hpf',           icon: <Filter size={16} />,           category: 'processing' },
  { typeKey: 'eq',            icon: <Activity size={16} />,         category: 'processing' },
  { typeKey: 'comp',          icon: <Box size={16} />,              category: 'processing' },
  { typeKey: 'switch',        icon: <ToggleLeft size={16} />,       category: 'processing' },
  { typeKey: 'potentiometer', icon: <Gauge size={16} />,            category: 'processing' },
  { typeKey: 'amp',           icon: <Radio size={16} />,            category: 'processing' },
  { typeKey: 'graphic-eq',    icon: <Sliders size={16} />,          category: 'processing' },
  // Routing
  { typeKey: 'master-bus',    icon: <Merge size={16} />,            category: 'routing' },
  { typeKey: 'bus',           icon: <Merge size={16} />,            category: 'routing' },
  // Output
  { typeKey: 'active-speaker', icon: <MonitorSpeaker size={16} />, category: 'output' },
  { typeKey: 'speaker',        icon: <Volume2 size={16} />,        category: 'output' },
]

const PALETTE_BY_LEVEL: Record<ComplexityLevel, string[]> = {
  beginner:     ['mic', 'line-in', 'instrument', 'active-speaker', 'gain', 'fader'],
  intermediate: ['mic', 'line-in', 'instrument', 'active-speaker', 'gain', 'fader', 'hpf', 'eq', 'comp', 'switch'],
  advanced:     ['mic', 'line-in', 'instrument', 'active-speaker', 'speaker', 'gain', 'fader', 'hpf', 'eq', 'comp', 'switch', 'potentiometer', 'amp', 'graphic-eq', 'master-bus', 'bus'],
}

const CATEGORY_ORDER = ['source', 'processing', 'routing', 'output']

interface ElementPaletteProps {
  toolMode: ToolMode
  onToolModeChange: (mode: ToolMode) => void
}

export function ElementPalette({ toolMode, onToolModeChange }: ElementPaletteProps) {
  const complexityLevel = useSignalStore((s) => s.complexityLevel)
  const { t } = useTranslation()
  const visibleKeys = PALETTE_BY_LEVEL[complexityLevel]
  const visibleItems = ALL_ITEMS.filter((item) => visibleKeys.includes(item.typeKey))
  const isConnect = toolMode === 'connect'

  function onDragStart(e: React.DragEvent, typeKey: string) {
    setActiveDragTypeKey(typeKey)
    e.dataTransfer.setData('application/lsc-node-type', typeKey)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      style={{
        width: 168,
        flexShrink: 0,
        height: '100%',
        background: 'var(--lsc-header)',
        borderRight: '1px solid var(--lsc-border)',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        userSelect: 'none',
      }}
    >
      {/* Connect Tool toggle */}
      <div style={{ padding: '10px 10px 6px' }}>
        <button
          className="nodrag nopan"
          onClick={() => onToolModeChange(isConnect ? 'select' : 'connect')}
          title={t.palette.connectTool}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '6px 10px',
            borderRadius: 'var(--lsc-radius-md)',
            border: `1px solid ${isConnect ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
            background: isConnect ? 'var(--lsc-accent-bg)' : 'transparent',
            color: isConnect ? 'var(--lsc-accent-soft)' : 'var(--lsc-text)',
            fontSize: 12,
            fontWeight: isConnect ? 700 : 500,
            cursor: 'pointer',
            transition: 'background 0.1s, border-color 0.1s, color 0.1s',
          }}
        >
          <Link2 size={13} />
          {t.palette.connectTool}
        </button>
      </div>

      <div style={{
        padding: '4px 12px 6px',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--lsc-text)', opacity: 0.5,
        borderTop: '1px solid var(--lsc-border)',
        marginBottom: 2,
        paddingTop: 8,
      }}>
        {t.palette.elements}
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const items = visibleItems.filter((item) => item.category === cat)
        if (items.length === 0) return null
        return (
          <div key={cat} style={{ marginBottom: 4 }}>
            <div style={{
              padding: '4px 12px 3px',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--lsc-accent)',
            }}>
              {t.palette.categories[cat as keyof typeof t.palette.categories]}
            </div>
            {items.map((item) => (
              <div
                key={item.typeKey}
                draggable
                onDragStart={(e) => onDragStart(e, item.typeKey)}
                onDragEnd={() => setActiveDragTypeKey(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  cursor: 'grab',
                  color: 'var(--lsc-text)',
                  fontSize: 12,
                  borderRadius: 0,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: 'var(--lsc-accent)', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ lineHeight: 1.3 }}>{t.palette.items[item.typeKey] ?? item.typeKey}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
