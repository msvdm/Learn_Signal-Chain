import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import type { LevelId } from '../data/levels'

export function LevelSelector() {
  const currentLevel = useSignalStore((s) => s.level)
  const setLevel = useSignalStore((s) => s.setLevel)
  const { t, fmt } = useTranslation()

  const handleChange = (id: LevelId) => {
    if (id === currentLevel) return
    if (currentLevel > 1) {
      const ok = window.confirm(
        fmt(t.levels.switchConfirm, { title: t.levels[id].title })
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
          {t.levels[id].badge}
        </button>
      ))}
    </div>
  )
}
