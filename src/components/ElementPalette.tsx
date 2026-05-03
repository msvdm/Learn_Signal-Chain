import type { ReactNode } from 'react'
import {
  Mic, Guitar, Plug,
  Zap, Activity, Box, ToggleLeft, Radio, Sliders,
  AudioWaveform, ShieldAlert, DoorClosed,
  Merge, Volume2, Link2, Cpu,
  SlidersHorizontal, Gauge, GitBranch, MoveHorizontal,
  ArrowRight, ArrowLeft,
} from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import type { ComplexityLevel } from '../store/signalStore'
import { setActiveDragTypeKey } from '../utils/dragState'
import { useTranslation } from '../i18n/useTranslation'

type ToolMode = 'select' | 'connect'

interface PaletteItem {
  typeKey: string
  icon: ReactNode
  category: 'source' | 'processing' | 'structural' | 'routing' | 'output'
}

const ALL_ITEMS: PaletteItem[] = [
  // Sources
  { typeKey: 'mic',              icon: <Mic size={16} />,              category: 'source' },
  { typeKey: 'line-in',          icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><g transform="rotate(-45 12 12)"><line x1="10.5" y1="22" x2="10.5" y2="20"/><line x1="13.5" y1="22" x2="13.5" y2="20"/><rect x="8.5" y="13" width="7" height="7.5" rx="1.5"/><line x1="10" y1="13" x2="10" y2="11"/><line x1="14" y1="13" x2="14" y2="11"/><line x1="10" y1="11" x2="14" y2="11"/><path d="M10 11 L10 6.5 Q10 4 12 4 Q14 4 14 6.5 L14 11"/><line x1="10" y1="8.5" x2="14" y2="8.5"/></g></svg>, category: 'source' },
  { typeKey: 'instrument',       icon: <Guitar size={16} />,           category: 'source' },
  { typeKey: 'di-box',           icon: <Plug size={16} />,             category: 'source' },
  // Processing
  { typeKey: 'gain',             icon: <Zap size={16} />,              category: 'processing' },
  { typeKey: 'hpf',              icon: <svg width="16" height="11" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 13 C3 1 9 1 12 1 L22 1" /></svg>, category: 'processing' },
  { typeKey: 'eq',               icon: <Activity size={16} />,         category: 'processing' },
  { typeKey: 'comp',             icon: <Box size={16} />,              category: 'processing' },
  { typeKey: 'deesser',          icon: <AudioWaveform size={16} />,    category: 'processing' },
  { typeKey: 'noise-gate',       icon: <DoorClosed size={16} />,       category: 'processing' },
  { typeKey: 'limiter',          icon: <ShieldAlert size={16} />,      category: 'processing' },
  { typeKey: 'amp',              icon: <Radio size={16} />,            category: 'processing' },
  { typeKey: 'graphic-eq',       icon: <Sliders size={16} />,          category: 'processing' },
  // Structural Elements (formerly some of processing)
  { typeKey: 'fader',            icon: <SlidersHorizontal size={16} />, category: 'structural' },
  { typeKey: 'switch',           icon: <ToggleLeft size={16} />,       category: 'structural' },
  { typeKey: 'potentiometer',    icon: <Gauge size={16} />,            category: 'structural' },
  { typeKey: 'relay',            icon: <GitBranch size={16} />,        category: 'structural' },
  { typeKey: 'pan',              icon: <MoveHorizontal size={16} />,   category: 'structural' },
  { typeKey: 'stereo-fader',     icon: <SlidersHorizontal size={16} />, category: 'structural' },
  { typeKey: 'balance',          icon: <MoveHorizontal size={16} />,   category: 'structural' },
  { typeKey: 'adc',              icon: <ArrowRight size={16} />,       category: 'structural' },
  { typeKey: 'dac',              icon: <ArrowLeft size={16} />,        category: 'structural' },
  // Routing
  { typeKey: 'master-bus',       icon: <Merge size={16} />,            category: 'routing' },
  { typeKey: 'mono-bus',         icon: <Merge size={16} />,            category: 'routing' },
  { typeKey: 'stereo-bus',       icon: <Merge size={16} />,            category: 'routing' },
  { typeKey: 'audio-interface',  icon: <Cpu size={16} />,              category: 'routing' },
  // Output
  { typeKey: 'active-speaker',   icon: <Volume2 size={16} />,          category: 'output' },
  { typeKey: 'speaker',          icon: <Volume2 size={16} />,          category: 'output' },
]

const PALETTE_BY_LEVEL: Record<ComplexityLevel, string[]> = {
  beginner: [
    'mic', 'line-in', 'instrument', 'di-box',
    'active-speaker',
    'gain', 'fader',
  ],
  intermediate: [
    'mic', 'line-in', 'instrument', 'di-box',
    'active-speaker',
    'gain', 'fader', 'hpf', 'eq', 'comp',
    'noise-gate', 'limiter', 'deesser',
    'switch', 'relay', 'pan', 'stereo-fader', 'balance',
    'mono-bus', 'stereo-bus', 'audio-interface',
    // master-bus is pre-placed and non-removable in intermediate — not shown in palette
  ],
  advanced: [
    'mic', 'line-in', 'instrument', 'di-box',
    'active-speaker', 'speaker',
    'gain', 'fader', 'hpf', 'eq', 'comp',
    'noise-gate', 'limiter', 'deesser',
    'switch', 'potentiometer', 'relay', 'pan', 'stereo-fader', 'balance',
    'amp', 'graphic-eq',
    'mono-bus', 'stereo-bus', 'audio-interface',
    'adc', 'dac',
    // master-bus is pre-placed and non-removable in advanced — not shown in palette
  ],
}

const CATEGORY_ORDER = ['source', 'processing', 'structural', 'routing', 'output']

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
