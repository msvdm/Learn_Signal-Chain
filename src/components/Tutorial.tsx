import { Fragment, useEffect, useId, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp, X } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import type { Translations } from '../i18n/translations'
import { LEVELS } from '../data/levels'
import { EXAMPLES, exampleChain } from '../utils/exampleChains'
import type { ExampleKey } from '../utils/exampleChains'
import { MOD } from '../utils/shortcut'

// The ? button in the header and the tutorial it opens (D25): how the app works, and example
// chains to open. It explains the app, never what an element is.

type Section = keyof Translations['tutorial']['sections']
type TextSection = Exclude<Section, 'examples'>

const SECTIONS: Section[] = ['welcome', 'start', 'build', 'levels', 'meters', 'wires', 'save', 'examples']

/** The health words' colours, as the meters draw them */
const HEALTH = [
  ['too-quiet', 'var(--signal-too-quiet)'],
  ['good',      'var(--signal-good)'],
  ['hot',       'var(--signal-hot)'],
  ['clipping',  'var(--signal-clipping)'],
] as const


/** The ? button; the tutorial remembers its page until the app is closed. */
export function TutorialButton({ style }: { style: CSSProperties }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<Section>('welcome')
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t.tutorial.button}
        aria-haspopup="dialog"
        className="lsc-btn-outline"
        style={{ ...style, width: 34, padding: 0, justifyContent: 'center' }}
      >
        <CircleHelp size={16} />
      </button>
      {open && <TutorialView section={section} onSection={setSection} onClose={() => setOpen(false)} />}
    </>
  )
}

function TutorialView({ section, onSection, onClose }: { section: Section; onSection: (s: Section) => void; onClose: () => void }) {
  const { t }   = useTranslation()
  const titleId = useId()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div
      className="lsc-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: 880, maxWidth: '100%', height: 640, maxHeight: '100%',
          display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden',
          background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
          boxShadow: 'var(--lsc-shadow-popup)', color: 'var(--lsc-fg)',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            padding: '14px 16px 12px 20px', borderBottom: '1px solid var(--lsc-border)',
          }}
        >
          <h2 id={titleId} style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 700 }}>{t.tutorial.title}</h2>
          <button
            autoFocus
            onClick={onClose}
            aria-label={t.app.close}
            className="lsc-btn-outline"
            style={{
              display: 'flex', padding: 4, borderRadius: 6, border: '1px solid transparent',
              background: 'transparent', color: 'var(--lsc-fg-muted)', cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <nav
            style={{
              width: 200, flexShrink: 0, padding: 8, overflowY: 'auto',
              borderRight: '1px solid var(--lsc-border)', display: 'flex', flexDirection: 'column', gap: 2,
            }}
          >
            {SECTIONS.map((id) => (
              <button
                key={id}
                onClick={() => onSection(id)}
                aria-current={section === id ? 'page' : undefined}
                className={section === id ? undefined : 'lsc-btn-outline'}
                style={{
                  textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${section === id ? 'var(--lsc-accent)' : 'transparent'}`,
                  background: section === id ? 'var(--lsc-accent-bg)' : 'transparent',
                  color: 'var(--lsc-fg)', fontSize: 13, fontWeight: section === id ? 600 : 500,
                }}
              >
                {t.tutorial.sections[id]}
              </button>
            ))}
          </nav>

          <div key={section} style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '18px 24px 24px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>{t.tutorial.sections[section]}</h3>
            {section === 'examples' ? <Examples onClose={onClose} /> : <TextPage section={section} />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * A page of text: its intro (paragraphs apart by a blank line) and its points, if any (the first
 * chain's steps numbered), with the colour keys where they belong.
 */
function TextPage({ section }: { section: TextSection }) {
  const { t, fmt } = useTranslation()
  const page   = t.tutorial[section]
  const points: readonly string[] = page.points
  const List   = section === 'start' ? 'ol' : 'ul'
  // The colour key goes under the point that introduces it (the one ending in a colon)
  const keyAt  = points.findIndex((p) => p.endsWith(':'))
  return (
    <>
      {page.intro.split('\n\n').map((para) => <p key={para} style={{ ...paragraph, marginBottom: 10 }}>{rich(para)}</p>)}
      {points.length > 0 && <List style={{ margin: '4px 0 0', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {points.map((point, i) => (
          <li key={point} style={{ ...paragraph, paddingLeft: 2 }}>
            {rich(fmt(point, { mod: MOD }))}
            {i === keyAt && section === 'meters' && (
              <ColourKey rows={HEALTH.map(([h, colour]) => [colour, t.health[h], t.tutorial.meters.health[h]])} />
            )}
            {i === keyAt && section === 'wires' && (
              // The wires' colours (D33): the meters' health colours, grey with no signal
              <ColourKey
                rows={[...HEALTH.map(([h, colour]) => [colour, t.health[h]] as const), ['var(--lsc-border)', t.tutorial.wires.none] as const]}
                line
              />
            )}
          </li>
        ))}
      </List>}
    </>
  )
}

/** Swatches: a colour, a name and what it means — a meter's colour as a chip, a wire's as a line. */
function ColourKey({ rows, line = false }: { rows: (readonly [colour: string, name: string, meaning?: string])[]; line?: boolean }) {
  const meanings = rows.some(([, , meaning]) => meaning)
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: meanings ? 'auto auto 1fr' : 'auto 1fr',
        alignItems: 'center', gap: '6px 12px', margin: '8px 0 2px', fontSize: 13, lineHeight: 1.4,
      }}
    >
      {rows.map(([colour, name, meaning]) => (
        <Fragment key={name}>
          <span
            style={line
              ? { width: 28, height: 4, borderRadius: 2, background: colour }
              : { width: 28, height: 14, borderRadius: 3, background: colour }}
          />
          {meanings ? <strong style={{ color: colour }}>{name}</strong> : <span>{name}</span>}
          {meanings && <span style={{ color: 'var(--lsc-fg-muted)' }}>{meaning}</span>}
        </Fragment>
      ))}
    </div>
  )
}

/** The example chains by level, each with its Open button. */
function Examples({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const chains = t.tutorial.examples.chains

  function open(key: ExampleKey) {
    // As File → Open does: onto an empty canvas it loads, otherwise the app asks (ChainOpener)
    useSignalStore.getState().offerChain({ chain: exampleChain(key, chains[key].name), skipped: 0 })
    onClose()
  }

  return (
    <>
      <p style={paragraph}>{t.tutorial.examples.intro}</p>
      {LEVELS.map((level) => (
        <section key={level} style={{ marginTop: 16 }}>
          <h4 className="lsc-overline" style={{ margin: '0 0 6px' }}>{t.levels[level].title}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {EXAMPLES[level].map((key) => (
              <div
                key={key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 10, border: '1px solid var(--lsc-border)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{chains[key].name}</div>
                  <div style={{ ...paragraph, marginTop: 2, color: 'var(--lsc-fg-muted)' }}>{chains[key].about}</div>
                </div>
                <button
                  onClick={() => open(key)}
                  style={{
                    flexShrink: 0, height: 32, padding: '0 14px', borderRadius: 8, border: 'none',
                    background: 'var(--lsc-accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {t.tutorial.examples.open}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

/** Text with **bold** parts (the names of buttons and menus). */
function rich(text: string): ReactNode {
  return text.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))
}

const paragraph: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.55, textWrap: 'pretty' }
