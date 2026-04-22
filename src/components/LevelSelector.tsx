import { useSignalStore } from '../store/signalStore'
import { levels } from '../data/levels'
import type { LevelId } from '../data/levels'

export function LevelSelector() {
  const currentLevel = useSignalStore((s) => s.level)
  const setLevel = useSignalStore((s) => s.setLevel)

  const handleChange = (id: LevelId) => {
    if (id === currentLevel) return
    if (currentLevel > 1) {
      const ok = window.confirm(
        `Switch to ${levels[id].title}? This will reset all controls to defaults.`
      )
      if (!ok) return
    }
    setLevel(id)
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
      {([1, 2, 3, 4] as LevelId[]).map((id) => (
        <button
          key={id}
          onClick={() => handleChange(id)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
            currentLevel === id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {levels[id].badge}
        </button>
      ))}
    </div>
  )
}
