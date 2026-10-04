import { useRef, useState, useEffect, Fragment } from 'react'
import type { CSSProperties } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useSignalStore } from './store/signalStore'
import { LEVELS } from './data/levels'
import type { ComplexityLevel } from './data/levels'
import { useTranslation } from './i18n/useTranslation'
import { SignalChain } from './components/SignalChain'
import { ElementPalette } from './components/ElementPalette'
import { ConfirmDialog } from './components/ConfirmDialog'
import { FileMenu } from './components/FileMenu'
import { NoticeToast } from './components/NoticeToast'
import { Radio, Sun, Moon, Globe, Check, Grid3x3, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { Lang } from './i18n/translations'
import { LOCALES } from './i18n/locales/index'
import { useMediaQuery, WIDE_HEADER_QUERY } from './hooks/useMediaQuery'
import { usePaletteWidth } from './hooks/usePaletteWidth'

type PendingConfirm = { kind: 'reset' } | { kind: 'level'; level: ComplexityLevel } | null

const headerBtn: CSSProperties = {
  height: 34, padding: '0 10px', borderRadius: 8,
  border: '1px solid var(--lsc-border)', background: 'transparent',
  color: 'var(--lsc-fg)', fontSize: 13, fontWeight: 500,
  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  whiteSpace: 'nowrap',
}

function App() {
  const language           = useSignalStore((s) => s.language)
  const theme              = useSignalStore((s) => s.theme)
  const complexityLevel    = useSignalStore((s) => s.complexityLevel)
  const setComplexityLevel = useSignalStore((s) => s.setComplexityLevel)
  const resetAll           = useSignalStore((s) => s.resetAll)
  const setLanguage        = useSignalStore((s) => s.setLanguage)
  const setTheme           = useSignalStore((s) => s.setTheme)
  const snapToGrid         = useSignalStore((s) => s.snapToGrid)
  const setSnapToGrid      = useSignalStore((s) => s.setSnapToGrid)
  const paletteOpen        = useSignalStore((s) => s.paletteOpen)
  const setPaletteOpen     = useSignalStore((s) => s.setPaletteOpen)
  const { t, fmt }       = useTranslation()
  const isWideHeader       = useMediaQuery(WIDE_HEADER_QUERY)
  const paletteWidth       = usePaletteWidth()
  const themeLabel         = theme === 'dark' ? t.app.theme.light : t.app.theme.dark

  const [showLanguages, setShowLanguages] = useState(false)
  const [pending, setPending]             = useState<PendingConfirm>(null)
  const languageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (languageRef.current && !languageRef.current.contains(e.target as Node)) {
        setShowLanguages(false)
      }
    }
    if (showLanguages) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showLanguages])

  function handleLevelChange(level: ComplexityLevel) {
    if (level === complexityLevel) return
    setPending({ kind: 'level', level })
  }

  function handleLanguage(lang: Lang) {
    setLanguage(lang)
    setShowLanguages(false)
  }

  function confirmPending() {
    if (pending?.kind === 'reset') resetAll()
    if (pending?.kind === 'level') setComplexityLevel(pending.level)
    setPending(null)
  }

  return (
    // Around the header too: the File menu saves the canvas with each card's real size
    <ReactFlowProvider>
      <div className="flex flex-col h-screen" style={{ background: 'var(--lsc-canvas)', color: 'var(--lsc-fg)' }}>
        {/* Header */}
        <header
          className="flex items-center justify-between flex-shrink-0"
          style={{
            height: 56, padding: '0 16px', gap: 16,
            background: 'var(--lsc-header)', borderBottom: '1px solid var(--lsc-border)',
          }}
        >
          {/* Left: palette toggle, brand — the only group that gives way: the title wraps onto a second line */}
          <div className="flex items-center" style={{ gap: 10 }}>
            <button
              onClick={() => setPaletteOpen(!paletteOpen)}
              title={paletteOpen ? t.palette.hide : t.palette.show}
              aria-label={paletteOpen ? t.palette.hide : t.palette.show}
              aria-expanded={paletteOpen}
              aria-controls="lsc-palette"
              className="lsc-btn-outline flex-shrink-0"
              style={{ ...headerBtn, width: 34, padding: 0, justifyContent: 'center' }}
            >
              {paletteOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
            <div
              className="flex-shrink-0"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--signal-good-bg)', color: 'var(--signal-good)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Radio size={17} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>
                {t.app.title}
              </h1>
              {isWideHeader && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--lsc-fg-muted)' }}>
                  {t.app.tagline}
                </p>
              )}
            </div>
          </div>

          {/* Centre: level stepper */}
          <nav aria-label={t.app.level} className="flex items-center flex-shrink-0" style={{ gap: 6 }}>
            {LEVELS.map((id, i) => {
              const active = complexityLevel === id
              return (
                <Fragment key={id}>
                  {i > 0 && <span style={{ width: 20, height: 1, background: 'var(--lsc-border)' }} />}
                  <button
                    onClick={() => handleLevelChange(id)}
                    aria-current={active ? 'step' : undefined}
                    title={t.levels[id].description}
                    className={active ? undefined : 'lsc-btn-outline'}
                    style={{
                      height: 36, padding: '0 12px', borderRadius: 8,
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: active ? 'default' : 'pointer',
                      border: `1px solid ${active ? 'var(--lsc-accent)' : 'transparent'}`,
                      background: active ? 'var(--lsc-accent-bg)' : 'transparent',
                      color: active ? 'var(--lsc-fg)' : 'var(--lsc-fg-muted)',
                    }}
                  >
                    <span
                      style={{
                        width: 20, height: 20, borderRadius: 9999, fontSize: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: active ? 'none' : '1px solid var(--lsc-border)',
                        background: active ? 'var(--lsc-accent)' : 'transparent',
                        color: active ? '#fff' : 'inherit',
                      }}
                    >
                      {i + 1}
                    </span>
                    {t.levels[id].title}
                  </button>
                </Fragment>
              )
            })}
          </nav>

          {/* Right: file, snap to grid, theme, language */}
          <div className="flex items-center flex-shrink-0" style={{ gap: 6 }}>
            <FileMenu onNew={() => setPending({ kind: 'reset' })} buttonStyle={headerBtn} />

            <button
              role="switch"
              aria-checked={snapToGrid}
              onClick={() => setSnapToGrid(!snapToGrid)}
              title={t.toolbar.snapHint}
              aria-label={t.toolbar.snap}
              className="lsc-btn-outline"
              style={{ ...headerBtn, gap: 8 }}
            >
              <Grid3x3 size={15} />
              {/* Narrower screens: icon + switch only, so the header still fits (the hint says what it does) */}
              {isWideHeader && t.toolbar.snap}
              <span
                style={{
                  position: 'relative', width: 30, height: 18, borderRadius: 9999, flexShrink: 0,
                  background: snapToGrid ? 'var(--lsc-accent)' : 'var(--lsc-sunken)',
                  border: `1px solid ${snapToGrid ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
                  transition: 'background 0.15s',
                }}
              >
                <span
                  style={{
                    position: 'absolute', top: 2, left: snapToGrid ? 14 : 2,
                    width: 12, height: 12, borderRadius: 9999,
                    background: snapToGrid ? '#fff' : 'var(--lsc-fg-muted)',
                    transition: 'left 0.15s',
                  }}
                />
              </span>
            </button>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={t.app.theme.toggle}
              aria-label={themeLabel}
              className="lsc-btn-outline"
              style={isWideHeader ? headerBtn : { ...headerBtn, width: 34, padding: 0, justifyContent: 'center' }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              {/* Narrower screens: the sun / moon alone, like the snap switch */}
              {isWideHeader && themeLabel}
            </button>

            <div className="relative" ref={languageRef}>
              <button
                onClick={() => setShowLanguages((v) => !v)}
                title={t.app.language}
                aria-haspopup="menu"
                aria-expanded={showLanguages}
                className="lsc-btn-outline"
                style={{
                  ...headerBtn,
                  borderColor: showLanguages ? 'var(--lsc-accent)' : 'var(--lsc-border)',
                  background: showLanguages ? 'var(--lsc-accent-bg)' : 'transparent',
                }}
              >
                <Globe size={15} />
                {language.toUpperCase()}
              </button>

              {showLanguages && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50"
                  style={{
                    marginTop: 6, width: 176, padding: 4, borderRadius: 10,
                    background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
                    boxShadow: 'var(--lsc-shadow-popup)',
                  }}
                >
                  {Object.entries(LOCALES).map(([code, locale]) => (
                    <button
                      key={code}
                      role="menuitemradio"
                      aria-checked={language === code}
                      onClick={() => handleLanguage(code as Lang)}
                      className="lsc-btn-outline"
                      style={{
                        width: '100%', height: 34, padding: '0 10px', borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: '1px solid transparent', background: 'transparent',
                        color: 'var(--lsc-fg)', fontSize: 13,
                        fontWeight: language === code ? 600 : 400, cursor: 'pointer',
                      }}
                    >
                      {locale.nativeName}
                      {language === code && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main canvas with left palette */}
        <main
          className="flex-1 overflow-hidden min-h-0 relative"
          style={{ '--lsc-palette-w': `${paletteWidth}px` } as CSSProperties}
        >
          {/* Collapsible: slides over the canvas (the canvas keeps its size and nothing on it moves) */}
          <div
            id="lsc-palette"
            className="lsc-palette-slide"
            style={{
              position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 20,
              width: paletteWidth, overflow: 'hidden',
              visibility: paletteOpen ? 'visible' : 'hidden',
              boxShadow: paletteOpen ? 'var(--lsc-shadow-popup)' : 'none',
            }}
          >
            <ElementPalette />
          </div>
          <SignalChain />
          <NoticeToast />
        </main>

        {pending?.kind === 'reset' && (
          <ConfirmDialog
            title={t.dialog.resetTitle}
            body={t.dialog.resetBody}
            confirmLabel={t.dialog.resetConfirm}
            cancelLabel={t.dialog.cancel}
            onConfirm={confirmPending}
            onCancel={() => setPending(null)}
          />
        )}
        {pending?.kind === 'level' && (
          <ConfirmDialog
            title={fmt(t.dialog.switchTitle, { title: t.levels[pending.level].title })}
            body={t.dialog.switchBody}
            confirmLabel={t.dialog.switchConfirm}
            cancelLabel={t.dialog.cancel}
            onConfirm={confirmPending}
            onCancel={() => setPending(null)}
          />
        )}
      </div>
    </ReactFlowProvider>
  )
}

export default App
