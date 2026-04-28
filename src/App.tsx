import { useRef, useState, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useSignalStore } from './store/signalStore'
import type { ComplexityLevel } from './store/signalStore'
import { useTranslation } from './i18n/useTranslation'
import { SignalChain } from './components/SignalChain'
import { SignalLevelProfile } from './components/SignalLevelProfile'
import { ElementPalette } from './components/ElementPalette'
import { RotateCcw, Radio, Settings, ChevronUp, ChevronDown } from 'lucide-react'
import type { Lang } from './i18n/translations'

function App() {
  const language = useSignalStore((s) => s.language)
  const complexityLevel = useSignalStore((s) => s.complexityLevel)
  const setComplexityLevel = useSignalStore((s) => s.setComplexityLevel)
  const resetAll = useSignalStore((s) => s.resetAll)
  const setLanguage = useSignalStore((s) => s.setLanguage)
  const { t, fmt } = useTranslation()

  const [showSettings, setShowSettings] = useState(false)
  const [showSignalProfile, setShowSignalProfile] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  const LEVELS: { id: ComplexityLevel; label: string }[] = [
    { id: 'beginner',        label: t.levels.beginner.title },
    { id: 'intermediate',    label: t.levels.intermediate.title },
    { id: 'advanced',        label: t.levels.advanced.title },
    { id: 'routing-madness', label: t.levels['routing-madness'].title },
  ]

  const handleReset = () => {
    const ok = window.confirm(t.app.resetConfirm)
    if (ok) resetAll()
  }

  const handleLevelChange = (level: ComplexityLevel) => {
    if (level === complexityLevel) return
    const ok = window.confirm(fmt(t.levels.switchConfirm, { title: t.levels[level].title }))
    if (ok) {
      setComplexityLevel(level)
    }
  }

  const handleLanguage = (lang: Lang) => {
    setLanguage(lang)
    setShowSettings(false)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    if (showSettings) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--lsc-canvas)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 flex-shrink-0 gap-4"
        style={{ height: 48, background: 'var(--lsc-header)', borderBottom: '1px solid var(--lsc-border)' }}
      >
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="rounded-lg flex items-center justify-center"
            style={{ padding: 6, background: 'var(--signal-good-bg)', color: 'var(--signal-good)' }}
          >
            <Radio size={16} />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none" style={{ color: 'var(--lsc-text)' }}>
              {t.app.title}
            </h1>
            <p className="text-[10px] mt-0.5 leading-none" style={{ color: 'var(--lsc-text)' }}>
              {t.app.tagline}
            </p>
          </div>
        </div>

        {/* Center: Level buttons */}
        <div className="flex items-center gap-1">
          {LEVELS.map(({ id, label }) => {
            const active = complexityLevel === id
            return (
              <button
                key={id}
                onClick={() => handleLevelChange(id)}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
                style={{
                  border: `1px solid ${active ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
                  background: active ? 'var(--lsc-accent-bg)' : 'transparent',
                  color: active ? 'var(--lsc-accent-soft)' : 'var(--lsc-text)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Right: Reset + Settings */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleReset}
            className="rounded-lg flex items-center justify-center transition-colors"
            style={{
              padding: 6,
              border: '1px solid var(--lsc-border)',
              background: 'transparent',
              color: 'var(--lsc-text)',
              cursor: 'pointer',
            }}
            title={t.app.resetButton}
          >
            <RotateCcw size={14} />
          </button>

          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="rounded-lg flex items-center justify-center transition-colors"
              style={{
                padding: 6,
                border: `1px solid ${showSettings ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
                background: showSettings ? 'var(--lsc-accent-bg)' : 'transparent',
                color: showSettings ? 'var(--lsc-accent-soft)' : 'var(--lsc-text)',
                cursor: 'pointer',
              }}
              title={t.app.settings}
            >
              <Settings size={14} />
            </button>

            {showSettings && (
              <div
                className="absolute right-0 top-full mt-2 w-44 rounded-xl border py-1 z-50"
                style={{
                  background: 'var(--lsc-header)',
                  borderColor: 'var(--lsc-border)',
                  boxShadow: 'var(--lsc-shadow-popup)',
                }}
              >
                <p
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--lsc-text)' }}
                >
                  {t.app.settings}
                </p>
                {(['en', 'bg'] as Lang[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLanguage(lang)}
                    className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between"
                    style={{
                      color: language === lang ? 'var(--lsc-text)' : 'var(--lsc-text)',
                      background: language === lang ? 'rgba(0,0,0,0.04)' : 'transparent',
                      fontWeight: language === lang ? 600 : 400,
                    }}
                  >
                    {t.app.languages[lang]}
                    {language === lang && (
                      <span className="text-[10px]" style={{ color: 'var(--lsc-text)' }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main canvas with left palette */}
      <main className="flex-1 overflow-hidden min-h-0 flex flex-row">
        <ElementPalette />
        <ReactFlowProvider>
          <SignalChain />
        </ReactFlowProvider>
      </main>

      {/* Signal level profile drawer */}
      <div
        className="flex-shrink-0 transition-all duration-200 ease-out"
        style={{
          maxHeight: showSignalProfile ? 220 : 36,
          overflow: 'hidden',
          borderTop: '1px solid var(--lsc-border)',
        }}
      >
        {/* Drawer toggle button */}
        <button
          onClick={() => setShowSignalProfile((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-1.5 transition-colors"
          style={{
            background: 'var(--lsc-header)',
            color: 'var(--lsc-text)',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 11 }}>Signal level across the chain</span>
          {showSignalProfile ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {/* Drawer content */}
        <div style={{ padding: '0 0 8px' }}>
          <SignalLevelProfile />
        </div>
      </div>
    </div>
  )
}

export default App
