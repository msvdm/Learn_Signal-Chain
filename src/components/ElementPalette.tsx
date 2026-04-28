import type { ReactNode } from 'react'
import {
  Mic, Cable, Guitar,
  Zap, Filter, Activity, Box, SlidersHorizontal, ToggleLeft, Gauge, Sliders, Radio,
  Merge, Volume2,
} from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import type { ComplexityLevel } from '../store/signalStore'

interface PaletteItem {
  typeKey: string
  label: string
  icon: ReactNode
  category: 'source' | 'processing' | 'routing' | 'output'
}

const ALL_ITEMS: PaletteItem[] = [
  // Sources
  { typeKey: 'mic',          label: 'Microphone',   icon: <Mic size={16} />,              category: 'source' },
  { typeKey: 'line-in',      label: 'Line Input',   icon: <Cable size={16} />,            category: 'source' },
  { typeKey: 'instrument',   label: 'Instrument',   icon: <Guitar size={16} />,           category: 'source' },
  // Processing
  { typeKey: 'gain',         label: 'Preamp / Gain',   icon: <Zap size={16} />,           category: 'processing' },
  { typeKey: 'fader',        label: 'Fader',           icon: <SlidersHorizontal size={16} />, category: 'processing' },
  { typeKey: 'hpf',          label: 'High-Pass Filter',icon: <Filter size={16} />,        category: 'processing' },
  { typeKey: 'eq',           label: 'Parametric EQ',   icon: <Activity size={16} />,      category: 'processing' },
  { typeKey: 'comp',         label: 'Compressor',      icon: <Box size={16} />,           category: 'processing' },
  { typeKey: 'switch',       label: 'Switch',          icon: <ToggleLeft size={16} />,    category: 'processing' },
  { typeKey: 'potentiometer',label: 'Potentiometer',   icon: <Gauge size={16} />,         category: 'processing' },
  { typeKey: 'amp',          label: 'Amplifier',       icon: <Radio size={16} />,         category: 'processing' },
  { typeKey: 'graphic-eq',   label: 'Graphic EQ',      icon: <Sliders size={16} />,       category: 'processing' },
  // Routing
  { typeKey: 'master-bus',   label: 'Master Bus',   icon: <Merge size={16} />,            category: 'routing' },
  { typeKey: 'bus',          label: 'Bus / Aux',    icon: <Merge size={16} />,            category: 'routing' },
  // Output
  { typeKey: 'speaker',      label: 'Speaker',      icon: <Volume2 size={16} />,          category: 'output' },
]

const PALETTE_BY_LEVEL: Record<ComplexityLevel, string[]> = {
  beginner:          ['mic', 'line-in', 'instrument', 'speaker', 'gain', 'fader'],
  intermediate:      ['mic', 'line-in', 'instrument', 'speaker', 'gain', 'fader', 'hpf', 'eq', 'comp', 'switch'],
  advanced:          ['mic', 'line-in', 'instrument', 'speaker', 'gain', 'fader', 'hpf', 'eq', 'comp', 'switch', 'potentiometer', 'amp', 'graphic-eq', 'master-bus', 'bus'],
  'routing-madness': ['mic', 'line-in', 'instrument', 'speaker', 'gain', 'fader', 'hpf', 'eq', 'comp', 'switch', 'potentiometer', 'amp', 'graphic-eq', 'master-bus', 'bus'],
}

const CATEGORY_LABELS: Record<string, string> = {
  source:     'Sources',
  processing: 'Processing',
  routing:    'Routing',
  output:     'Output',
}

const CATEGORY_ORDER = ['source', 'processing', 'routing', 'output']

export function ElementPalette() {
  const complexityLevel = useSignalStore((s) => s.complexityLevel)
  const visibleKeys = PALETTE_BY_LEVEL[complexityLevel]
  const visibleItems = ALL_ITEMS.filter((item) => visibleKeys.includes(item.typeKey))

  function onDragStart(e: React.DragEvent, typeKey: string) {
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
      <div style={{
        padding: '10px 12px 6px',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--lsc-text)', opacity: 0.5,
      }}>
        Elements
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
              {CATEGORY_LABELS[cat]}
            </div>
            {items.map((item) => (
              <div
                key={item.typeKey}
                draggable
                onDragStart={(e) => onDragStart(e, item.typeKey)}
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
                <span style={{ lineHeight: 1.3 }}>{item.label}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
