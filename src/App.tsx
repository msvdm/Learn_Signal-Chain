import { ReactFlowProvider } from '@xyflow/react'
import { useSignalStore } from './store/signalStore'
import { levels } from './data/levels'
import { LevelSelector } from './components/LevelSelector'
import { GainStagingBanner } from './components/GainStagingBanner'
import { SignalChain } from './components/SignalChain'
import { RotateCcw, Radio } from 'lucide-react'

function App() {
  const level = useSignalStore((s) => s.level)
  const resetToDefaults = useSignalStore((s) => s.resetToDefaults)
  const levelConfig = levels[level]

  const handleReset = () => {
    const ok = window.confirm('Reset all controls to default values?')
    if (ok) resetToDefaults()
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--canvas-bg)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-slate-900 p-1.5">
            <Radio size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Learn Signal Chain</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-none">From microphone to speaker</p>
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
            title="Reset to defaults"
          >
            <RotateCcw size={14} />
          </button>
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
