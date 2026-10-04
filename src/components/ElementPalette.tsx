import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Mic, Guitar, Plug,
  Zap, Activity, Box, ToggleLeft, Radio, Sliders,
  AudioWaveform, ShieldAlert, DoorClosed, Minus,
  Merge, Volume2, Cpu, Search,
  SlidersHorizontal, GitBranch, MoveHorizontal,
  ArrowRight, ArrowLeft,
} from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import type { ComplexityLevel } from '../data/levels'
import { setActiveDragTypeKey } from '../utils/dragState'
import { useTranslation } from '../i18n/useTranslation'
import { useChainEmpty } from '../hooks/useChainEmpty'
import { useMediaQuery, TABLET_QUERY } from '../hooks/useMediaQuery'

type Category = 'source' | 'processing' | 'routing' | 'output'
type Tab = 'all' | Category

interface PaletteItem {
  typeKey: string
  icon: ReactNode
  category: Category
}

const ICON = 18

const ALL_ITEMS: PaletteItem[] = [
  // Sources
  { typeKey: 'mic',              icon: <Mic size={ICON} />,               category: 'source' },
  { typeKey: 'line-in',          icon: <svg viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><g transform="rotate(-45 12 12)"><line x1="10.5" y1="22" x2="10.5" y2="20"/><line x1="13.5" y1="22" x2="13.5" y2="20"/><rect x="8.5" y="13" width="7" height="7.5" rx="1.5"/><line x1="10" y1="13" x2="10" y2="11"/><line x1="14" y1="13" x2="14" y2="11"/><line x1="10" y1="11" x2="14" y2="11"/><path d="M10 11 L10 6.5 Q10 4 12 4 Q14 4 14 6.5 L14 11"/><line x1="10" y1="8.5" x2="14" y2="8.5"/></g></svg>, category: 'source' },
  { typeKey: 'instrument',       icon: <Guitar size={ICON} />,            category: 'source' },
  { typeKey: 'di-box',           icon: <Plug size={ICON} />,              category: 'source' },
  // Processing
  { typeKey: 'gain',             icon: <Zap size={ICON} />,               category: 'processing' },
  { typeKey: 'hpf',              icon: <svg width={ICON} height={Math.round(ICON * 0.7)} viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 13 C3 1 9 1 12 1 L22 1" /></svg>, category: 'processing' },
  { typeKey: 'eq',               icon: <Activity size={ICON} />,          category: 'processing' },
  { typeKey: 'comp',             icon: <Box size={ICON} />,               category: 'processing' },
  { typeKey: 'pad',              icon: <Minus size={ICON} />,             category: 'processing' },
  { typeKey: 'deesser',          icon: <AudioWaveform size={ICON} />,     category: 'processing' },
  { typeKey: 'noise-gate',       icon: <DoorClosed size={ICON} />,        category: 'processing' },
  { typeKey: 'limiter',          icon: <ShieldAlert size={ICON} />,       category: 'processing' },
  { typeKey: 'amp',              icon: <Radio size={ICON} />,             category: 'processing' },
  { typeKey: 'graphic-eq',       icon: <Sliders size={ICON} />,           category: 'processing' },
  // Routing — level controls, switches, panning, conversion, buses
  { typeKey: 'fader',            icon: <SlidersHorizontal size={ICON} />, category: 'routing' },
  { typeKey: 'switch',           icon: <ToggleLeft size={ICON} />,        category: 'routing' },
  { typeKey: 'relay',            icon: <GitBranch size={ICON} />,         category: 'routing' },
  { typeKey: 'pan',              icon: <MoveHorizontal size={ICON} />,    category: 'routing' },
  { typeKey: 'adc',              icon: <ArrowRight size={ICON} />,        category: 'routing' },
  { typeKey: 'dac',              icon: <ArrowLeft size={ICON} />,         category: 'routing' },
  { typeKey: 'master-bus',       icon: <Merge size={ICON} />,             category: 'routing' },
  { typeKey: 'aux-bus',          icon: <Merge size={ICON} />,             category: 'routing' },
  { typeKey: 'matrix-bus',       icon: <Merge size={ICON} />,             category: 'routing' },
  { typeKey: 'audio-interface',  icon: <Cpu size={ICON} />,               category: 'routing' },
  // Output
  { typeKey: 'active-speaker',   icon: <Volume2 size={ICON} />,           category: 'output' },
  { typeKey: 'speaker',          icon: <Volume2 size={ICON} />,           category: 'output' },
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
    'gain', 'fader', 'hpf', 'eq', 'comp', 'pad',
    'noise-gate', 'limiter', 'deesser',
    'switch', 'relay', 'pan',
    'master-bus', 'aux-bus', 'audio-interface',
  ],
  advanced: [
    'mic', 'line-in', 'instrument', 'di-box',
    'active-speaker', 'speaker',
    'gain', 'fader', 'hpf', 'eq', 'comp', 'pad',
    'noise-gate', 'limiter', 'deesser',
    'switch', 'relay', 'pan',
    'amp', 'graphic-eq',
    'master-bus', 'aux-bus', 'matrix-bus', 'audio-interface',
    'adc', 'dac',
  ],
}

const CATEGORY_ORDER: Category[] = ['source', 'processing', 'routing', 'output']

// The first thing to drag onto an empty canvas
const START_ITEM = 'mic'

function onDragStart(e: React.DragEvent, typeKey: string) {
  setActiveDragTypeKey(typeKey)
  e.dataTransfer.setData('application/lsc-node-type', typeKey)
  e.dataTransfer.effectAllowed = 'copy'
}

function onDragEnd() {
  setActiveDragTypeKey(null)
}

export function ElementPalette() {
  const complexityLevel = useSignalStore((s) => s.complexityLevel)
  const chainEmpty      = useChainEmpty()
  const isTablet        = useMediaQuery(TABLET_QUERY)
  const { t }           = useTranslation()
  const [tab, setTab]     = useState<Tab>('all')
  const [query, setQuery] = useState('')

  const visibleKeys  = PALETTE_BY_LEVEL[complexityLevel]
  const nameOf       = (typeKey: string) => t.palette.items[typeKey] ?? typeKey
  const visibleItems = ALL_ITEMS.filter((item) => visibleKeys.includes(item.typeKey))

  // ── Tablet: icon rail ──────────────────────────────────────────────────────
  if (isTablet) {
    return (
      <aside
        style={{
          width: 64, flexShrink: 0, height: '100%',
          background: 'var(--lsc-header)', borderRight: '1px solid var(--lsc-border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          padding: '12px 0', overflowY: 'auto', userSelect: 'none',
        }}
      >
        {visibleItems.map((item) => {
          const start = chainEmpty && item.typeKey === START_ITEM
          return (
            <div
              key={item.typeKey}
              draggable
              onDragStart={(e) => onDragStart(e, item.typeKey)}
              onDragEnd={onDragEnd}
              title={nameOf(item.typeKey)}
              className="lsc-palette-tile"
              style={{
                width: 44, height: 44, flexShrink: 0, borderRadius: 10,
                background: 'var(--lsc-node-bg)',
                border: `1px solid ${start ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
                color: start ? 'var(--lsc-accent)' : 'var(--lsc-fg-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'grab',
              }}
            >
              {item.icon}
            </div>
          )
        })}
      </aside>
    )
  }

  // ── Desktop: search, tabs, tile grid ───────────────────────────────────────
  const q = query.trim().toLowerCase()
  const matching = visibleItems.filter((item) =>
    (tab === 'all' || item.category === tab) &&
    // The type key too, so "eq" finds the Equalizer in any language
    (q === '' || nameOf(item.typeKey).toLowerCase().includes(q) || item.typeKey.includes(q)),
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: t.palette.all },
    ...CATEGORY_ORDER.map((c) => ({ id: c, label: t.palette.categories[c] })),
  ]

  return (
    <aside
      style={{
        width: 240, flexShrink: 0, height: '100%',
        background: 'var(--lsc-header)', borderRight: '1px solid var(--lsc-border)',
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: '14px 12px', overflowY: 'auto', overflowX: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Search */}
      <label
        style={{
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          height: 36, padding: '0 10px', borderRadius: 8,
          background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)',
          color: 'var(--lsc-fg-muted)',
        }}
      >
        <Search size={15} style={{ flexShrink: 0 }} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.palette.search}
          aria-label={t.palette.search}
          className="lsc-search-input"
          style={{
            flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--lsc-fg)', fontSize: 13, fontFamily: 'inherit',
          }}
        />
      </label>

      {/* Category tabs */}
      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
        {tabs.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              style={{
                padding: '5px 10px', borderRadius: 9999,
                border: `1px solid ${active ? 'var(--lsc-fg)' : 'var(--lsc-border)'}`,
                background: active ? 'var(--lsc-fg)' : 'transparent',
                color: active ? 'var(--lsc-header)' : 'var(--lsc-fg-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Groups */}
      {CATEGORY_ORDER.map((cat) => {
        const items = matching.filter((item) => item.category === cat)
        if (items.length === 0) return null
        return (
          <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <div
              style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--lsc-fg-muted)', padding: '2px 2px 0',
              }}
            >
              {t.palette.categories[cat]}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {items.map((item) => {
                const start = chainEmpty && item.typeKey === START_ITEM
                return (
                  <div
                    key={item.typeKey}
                    draggable
                    onDragStart={(e) => onDragStart(e, item.typeKey)}
                    onDragEnd={onDragEnd}
                    className="lsc-palette-tile"
                    style={{
                      position: 'relative',
                      display: 'flex', flexDirection: 'column', gap: 6,
                      padding: '9px 10px', borderRadius: 8,
                      background: 'var(--lsc-node-bg)',
                      border: `1px solid ${start ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
                      color: 'var(--lsc-fg)', cursor: 'grab',
                    }}
                  >
                    <span style={{ color: 'var(--lsc-fg-muted)', display: 'flex', height: ICON, alignItems: 'center' }}>
                      {item.icon}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25, hyphens: 'auto', overflowWrap: 'break-word' }}>
                      {nameOf(item.typeKey)}
                    </span>
                    {start && (
                      // Sits on the top border like a tag, so longer translations never cover the icon
                      <span
                        style={{
                          position: 'absolute', top: -8, right: 6, lineHeight: 1.3,
                          padding: '2px 6px', borderRadius: 9999,
                          background: 'var(--lsc-accent)', color: '#fff',
                          fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                        }}
                      >
                        {t.palette.startHere}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {matching.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--lsc-fg-muted)', margin: 0, padding: '0 2px' }}>
          {t.palette.noResults}
        </p>
      )}

      {/* Help and Remove live in the right-click menu, which nothing else shows */}
      <p
        style={{
          marginTop: 'auto', marginBottom: 0, padding: '10px 2px 0', flexShrink: 0,
          borderTop: '1px solid var(--lsc-border-soft)',
          fontSize: 12, lineHeight: 1.4, color: 'var(--lsc-fg-muted)',
        }}
      >
        {t.palette.rightClickTip}
      </p>
    </aside>
  )
}
