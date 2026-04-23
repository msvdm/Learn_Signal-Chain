import { useRef, useState, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useSignalStore } from './store/signalStore'
import { useTranslation } from './i18n/useTranslation'
import { JourneyBanner } from './components/JourneyBanner'
import { SignalChain } from './components/SignalChain'
import { SignalLevelProfile } from './components/SignalLevelProfile'
import { RotateCcw, Radio, Settings } from 'lucide-react'
import type { Lang } from './i18n/translations'

function App() {
  const language = useSignalStore((s) => s.language)
  const resetJourney = useSignalStore((s) => s.resetJourney)
  const setLanguage = useSignalStore((s) => s.setLanguage)
  const { t } = useTranslation()

  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  const handleReset = () => {
    const ok = window.confirm(t.app.resetConfirm)
    if (ok) resetJourney()
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
    <div className="flex flex-col h-screen" style={{ background: 'var(--canvas-bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ background: '#16181d', borderColor: 'var(--node-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg p-1.5" style={{ background: 'rgba(74,222,128,0.15)' }}>
            <Radio size={16} style={{ color: 'var(--signal-good)' }} />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
              {t.app.title}
            </h1>
            <p className="text-[10px] mt-0.5 leading-none" style={{ color: 'var(--text-muted)' }}>
              {t.app.tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="rounded-lg border p-2 transition-colors"
            style={{ borderColor: 'var(--node-border)', color: 'var(--text-muted)' }}
            title={t.app.resetButton}
          >
            <RotateCcw size={14} />
          </button>

          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="rounded-lg border p-2 transition-colors"
              style={{
                borderColor: showSettings ? '#6366f1' : 'var(--node-border)',
                color: showSettings ? '#818cf8' : 'var(--text-muted)',
                background: showSettings ? 'rgba(99,102,241,0.1)' : 'transparent',
              }}
              title={t.app.settings}
            >
              <Settings size={14} />
            </button>

            {showSettings && (
              <div
                className="absolute right-0 top-full mt-2 w-44 rounded-xl border py-1 z-50"
                style={{
                  background: '#16181d',
                  borderColor: 'var(--node-border)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                }}
              >
                <p
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t.app.settings}
                </p>
                {(['en', 'bg'] as Lang[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLanguage(lang)}
                    className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between"
                    style={{
                      color: language === lang ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: language === lang ? 'rgba(255,255,255,0.05)' : 'transparent',
                      fontWeight: language === lang ? 600 : 400,
                    }}
                  >
                    {t.app.languages[lang]}
                    {language === lang && (
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Journey goal banner */}
      <JourneyBanner />

      {/* Main canvas */}
      <main className="flex-1 overflow-hidden min-h-0">
        <ReactFlowProvider>
          <SignalChain />
        </ReactFlowProvider>
      </main>

      {/* Signal level profile graph */}
      <SignalLevelProfile />
    </div>
  )
}

export default App
