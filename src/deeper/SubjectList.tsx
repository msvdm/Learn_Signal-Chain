import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { PALETTE_WIDTH, PALETTE_RAIL_WIDTH, useRail } from '../hooks/usePaletteWidth'
import { SUBJECTS, subjectOf } from './subjects'

// Dive deeper's drawer (D46): the subjects, in the palette's place and look. The teacher picks the
// one to show; below 1280px it is a rail of their icons, as the palette is at tablet width (the
// steps' row then has room for a subject's shapes).

export function SubjectList() {
  const chosen     = subjectOf(useSignalStore((s) => s.deeperSubject)).id
  const setSubject = useSignalStore((s) => s.setDeeperSubject)
  const rail       = useRail()
  const { t }      = useTranslation()

  return (
    <aside
      style={{
        width: rail ? PALETTE_RAIL_WIDTH : PALETTE_WIDTH, flexShrink: 0, height: '100%',
        background: 'var(--lsc-palette-bg)', borderRight: '1px solid var(--lsc-palette-edge)',
        display: 'flex', flexDirection: 'column', alignItems: rail ? 'center' : 'stretch', gap: 8,
        padding: rail ? '12px 0' : '14px 12px', overflowY: 'auto', overflowX: 'hidden', userSelect: 'none',
      }}
    >
      {!rail && (
        <div className="lsc-overline" style={{ padding: '2px 2px 0', flexShrink: 0 }}>{t.deeper.subjectsTitle}</div>
      )}
      {SUBJECTS.map(({ id, icon: Icon }) => {
        const active = id === chosen
        return (
          <button
            key={id}
            onClick={() => setSubject(id)}
            aria-pressed={active}
            aria-label={rail ? t.deeper.subjects[id] : undefined}
            className="lsc-palette-tile"
            style={{
              flexShrink: 0, borderRadius: rail ? 10 : 8, cursor: active ? 'default' : 'pointer',
              background: 'var(--lsc-palette-tile)',
              border: `1px solid ${active ? 'var(--lsc-accent)' : 'var(--lsc-palette-edge)'}`,
              boxShadow: active ? '0 0 0 1px var(--lsc-accent)' : 'none',
              color: 'var(--lsc-fg)', textAlign: 'left',
              ...(rail
                ? { width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }
                : { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', minHeight: 56 }),
            }}
          >
            <span style={{ color: active ? 'var(--lsc-accent-text)' : 'var(--lsc-fg-muted)', display: 'flex', flexShrink: 0 }}>
              <Icon size={18} />
            </span>
            {!rail && <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{t.deeper.subjects[id]}</span>}
          </button>
        )
      })}
    </aside>
  )
}
