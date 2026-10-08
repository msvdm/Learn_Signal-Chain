import { useState } from 'react'
import { Search } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import type { TypeKey } from '../data/nodeRegistry'
import { availableAt } from '../data/nodeRegistry'
import { NODE_LOOK, PALETTE_GROUPS } from './nodes/nodeLook'
import type { PaletteGroup } from './nodes/nodeLook'
import { setActiveDragTypeKey } from '../utils/dragState'
import { useTranslation } from '../i18n/useTranslation'
import { useChainEmpty } from '../hooks/useChainEmpty'
import { useMediaQuery, TABLET_QUERY } from '../hooks/useMediaQuery'
import { PALETTE_WIDTH, PALETTE_RAIL_WIDTH } from '../hooks/usePaletteWidth'
import { cssVar, textWidth } from '../utils/fitText'

type Tab = 'all' | PaletteGroup

const ICON = 18

// Every tile the same size: its icon, then its name — on one or two lines at the usual size, or a
// long name (a Bulgarian one) on up to three in smaller letters; never a taller tile
const PAD_X     = 12
const GRID_GAP  = 6
const TILE_PAD  = '9px 10px'
const NAME_SIZE = 12
const NAME_MIN  = 9
const NAME_W    = ((PALETTE_WIDTH - 2 * PAD_X - GRID_GAP) / 2 - 2 * 10 - 2) * 0.96
const NAME_H    = 33
const TILE_H    = 2 * 9 + ICON + 6 + NAME_H + 2
/** Line height: two lines at the usual size, three tighter */
const lineHeightOf = (lines: number) => (lines > 2 ? 1.1 : 1.25)

/** A tile's name: its lines, filled the way a browser wraps them, at the largest size that fits. */
function tileName(text: string): { lines: string[]; size: number } {
  const family = cssVar('--lsc-font-sans')
  const words  = text.split(' ')
  for (let size = NAME_SIZE; ; size -= 0.5) {
    const width = (s: string) => textWidth(s, family, 600) * size
    const lines: string[] = []
    for (const word of words) {
      const last = lines[lines.length - 1]
      if (last !== undefined && width(`${last} ${word}`) <= NAME_W) lines[lines.length - 1] = `${last} ${word}`
      else lines.push(word)
    }
    const fits = lines.length * size * lineHeightOf(lines.length) <= NAME_H && lines.every((l) => width(l) <= NAME_W)
    if (fits || size <= NAME_MIN) return { lines, size }
  }
}

// Every type, in palette order (NODE_LOOK's order)
const ALL_ITEMS = (Object.keys(NODE_LOOK) as TypeKey[]).map((typeKey) => ({ typeKey, ...NODE_LOOK[typeKey] }))

// The first thing to drag onto an empty canvas
const START_ITEM = 'mic'

function onDragStart(e: React.DragEvent, typeKey: TypeKey) {
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

  const nameOf       = (typeKey: TypeKey) => t.palette.items[typeKey] ?? typeKey
  const visibleItems = ALL_ITEMS.filter((item) => availableAt(item.typeKey, complexityLevel))

  // ── Tablet: icon rail ──────────────────────────────────────────────────────
  if (isTablet) {
    return (
      <aside
        style={{
          width: PALETTE_RAIL_WIDTH, flexShrink: 0, height: '100%',
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
              aria-label={nameOf(item.typeKey)}
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
              <item.icon size={ICON} />
            </div>
          )
        })}
      </aside>
    )
  }

  // ── Desktop: search, tabs, tile grid ───────────────────────────────────────
  const q = query.trim().toLowerCase()
  const matching = visibleItems.filter((item) =>
    (tab === 'all' || item.group === tab) &&
    // The type key too, so "eq" finds the Equalizer in any language
    (q === '' || nameOf(item.typeKey).toLowerCase().includes(q) || item.typeKey.includes(q)),
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: t.palette.all },
    ...PALETTE_GROUPS.map((g) => ({ id: g, label: t.palette.categories[g] })),
  ]

  return (
    <aside
      style={{
        width: PALETTE_WIDTH, flexShrink: 0, height: '100%',
        background: 'var(--lsc-header)', borderRight: '1px solid var(--lsc-border)',
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: `14px ${PAD_X}px`, overflowY: 'auto', overflowX: 'hidden',
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
      {PALETTE_GROUPS.map((cat) => {
        const items = matching.filter((item) => item.group === cat)
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
            {/* Two equal columns, whatever the names (a long word never widens one) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: GRID_GAP }}>
              {items.map((item) => {
                const start = chainEmpty && item.typeKey === START_ITEM
                const name  = tileName(nameOf(item.typeKey))
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
                      height: TILE_H, padding: TILE_PAD, borderRadius: 8,
                      background: 'var(--lsc-node-bg)',
                      border: `1px solid ${start ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
                      color: 'var(--lsc-fg)', cursor: 'grab',
                    }}
                  >
                    <span style={{ color: 'var(--lsc-fg-muted)', display: 'flex', height: ICON, alignItems: 'center' }}>
                      <item.icon size={ICON} />
                    </span>
                    <span style={{ fontSize: name.size, fontWeight: 600, lineHeight: lineHeightOf(name.lines.length), whiteSpace: 'nowrap' }}>
                      {name.lines.map((line) => <span key={line} style={{ display: 'block' }}>{line}</span>)}
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
