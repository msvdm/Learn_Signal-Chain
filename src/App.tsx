import { useRef, useState, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useSignalStore } from './store/signalStore'
import { useTranslation } from './i18n/useTranslation'
import { LevelSelector } from './components/LevelSelector'
import { GainStagingBanner } from './components/GainStagingBanner'
import { SignalChain } from './components/SignalChain'
import { RotateCcw, Radio, Settings } from 'lucide-react'
import type { Lang } from './i18n/translations'

function App() {
  const level = useSignalStore((s) => s.level)
  const language = useSignalStore((s) => s.language)
  const resetToDefaults = useSignalStore((s) => s.resetToDefaults)
  const setLanguage = useSignalStore((s) => s.setLanguage)
  const { t } = useTranslation()

  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  const levelConfig = t.levels[level]

  const handleReset = () => {
    const ok = window.confirm(t.app.resetConfirm)
    if (ok) resetToDefaults()
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
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-slate-900 p-1.5">
            <Radio size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">{t.app.title}</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{t.app.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-center hidden sm:block">
            <p className="text-xs font-semibold text-slate-700">{levelConfig.title}</p>
            <p className="text-[10px] text-slate-400 max-w-xs">{levelConfig.description}</p>
          </div>

          <LevelSelector />

          <button
            onClick={handleReset}
            className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors"
            title={t.app.resetButton}
          >
            <RotateCcw size={14} />
          </button>

          {/* Settings button */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className={`rounded-lg border p-2 transition-colors ${
                showSettings
                  ? 'border-slate-300 text-slate-700 bg-slate-50'
                  : 'border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300'
              }`}
              title={t.app.settings}
            >
              <Settings size={14} />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1 z-50">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  {t.app.settings}
                </p>
                {(['en', 'bg'] as Lang[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLanguage(lang)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                      language === lang
                        ? 'text-slate-900 font-semibold bg-slate-50'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t.app.languages[lang]}
                    {language === lang && (
                      <span className="text-[10px] text-slate-400 font-normal">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Gain staging banner */}
      <GainStagingBanner />

      {/* Main canvas */}
      <main className="flex-1 overflow-hidden">
        <ReactFlowProvider>
          <SignalChain />
        </ReactFlowProvider>
      </main>
    </div>
  )
}

export default App
