import { Fragment, useEffect, useId, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { Cable, ScanEye } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import type { Translations } from '../../i18n/translations'
import { NODE_LOOK } from './nodeLook'
import type { NodeIcon } from './nodeLook'

// "Look inside" (D22, explanation 2): at Intermediate the Audio Interface and the DAW are boxes that
// record and play back; a button on each opens a picture of what is inside — the same parts as the
// desk's cards (their icons), the digital ones greyed in a frame of their own. Read-only: Esc, the
// backdrop or Close shuts it.

type StepName = keyof Translations['inside']['steps']

interface InsideStep {
  icon: NodeIcon
  name: StepName
  /** Inside the computer, as numbers: greyed, in the Digital frame */
  digital?: true
}

/** What is inside each box, in the order the sound goes through it. */
const INSIDE: Record<'interface' | 'daw', readonly InsideStep[]> = {
  interface: [
    { icon: NODE_LOOK.gain.icon,      name: 'preamp' },
    { icon: NODE_LOOK.adc.icon,       name: 'adc' },
    { icon: NODE_LOOK.interface.icon, name: 'usb', digital: true },
    { icon: NODE_LOOK.dac.icon,       name: 'dac' },
    { icon: Cable,                    name: 'lineOut' },
  ],
  daw: [
    { icon: NODE_LOOK.gain.icon,         name: 'trim',   digital: true },
    { icon: NODE_LOOK.hpf.icon,          name: 'hpf',    digital: true },
    { icon: NODE_LOOK.eq.icon,           name: 'eq',     digital: true },
    { icon: NODE_LOOK.comp.icon,         name: 'comp',   digital: true },
    { icon: NODE_LOOK.fader.icon,        name: 'fader',  digital: true },
    { icon: NODE_LOOK['master-bus'].icon, name: 'mixBus', digital: true },
    { icon: NODE_LOOK.fader.icon,        name: 'master', digital: true },
  ],
}

/** A step's icon box (px) */
const BOX = 48
/** Around the steps in the Digital frame (px): the frame's negative margin keeps them in line with the rest */
const FRAME_PAD = 10

/** The steps cut into runs: analogue ones one by one, the digital ones together (one frame). */
function runsOf(steps: readonly InsideStep[]): InsideStep[][] {
  const runs: InsideStep[][] = []
  for (const step of steps) {
    const last = runs.at(-1)
    if (step.digital && last?.[0].digital) last.push(step)
    else runs.push([step])
  }
  return runs
}

/** The button on the card's face, and the picture it opens. */
export function LookInside({ type }: { type: keyof typeof INSIDE }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className="nodrag nopan lsc-btn-outline"
        onClick={() => setOpen(true)}
        style={{
          height: '100%', padding: '0 12px', borderRadius: 8, pointerEvents: 'auto',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          border: '1px solid var(--lsc-border)', background: 'transparent', color: 'var(--lsc-fg)',
          fontSize: 'var(--node-text-xs)', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
        }}
      >
        <ScanEye size={15} />
        {t.inside.button}
      </button>
      {open && <InsideView type={type} onClose={() => setOpen(false)} />}
    </>
  )
}

// The view is drawn in document.body but sits in the card in React's tree: its events must not
// reach the card (a click would select it, a right-click open its menu)
const stop = (e: SyntheticEvent) => e.stopPropagation()

function InsideView({ type, onClose }: { type: keyof typeof INSIDE; onClose: () => void }) {
  const { t }   = useTranslation()
  const titleId = useId()
  const text    = t.inside[type]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    // Capture, so the canvas's Esc (drop the selection) doesn't fire too
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div
      className="lsc-overlay"
      onMouseDown={(e) => { stop(e); if (e.target === e.currentTarget) onClose() }}
      onClick={stop} onDoubleClick={stop} onContextMenu={stop} onPointerDown={stop} onKeyDown={stop}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: 820, maxWidth: '100%', borderRadius: 12,
          background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
          boxShadow: 'var(--lsc-shadow-popup)', color: 'var(--lsc-fg)',
        }}
      >
        <h2 id={titleId} style={{ margin: 0, padding: '16px 20px 0', fontSize: 15, fontWeight: 700 }}>{text.title}</h2>
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center', rowGap: 16,
            padding: `${FRAME_PAD + 1 + 12}px 20px`,
          }}
        >
          {runsOf(INSIDE[type]).map((run, i) => (
            <Fragment key={run[0].name}>
              {i > 0 && <Arrow />}
              {run[0].digital ? <DigitalFrame steps={run} /> : <Step step={run[0]} />}
            </Fragment>
          ))}
        </div>
        <p style={{ margin: 0, padding: '0 20px', fontSize: 13, lineHeight: 1.5, color: 'var(--lsc-fg-muted)', textWrap: 'pretty' }}>
          {text.says}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16 }}>
          <button
            autoFocus
            onClick={onClose}
            className="lsc-btn-outline"
            style={{
              height: 34, padding: '0 14px', borderRadius: 8,
              border: '1px solid var(--lsc-border)', background: 'transparent',
              color: 'var(--lsc-fg)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t.inside.close}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** The digital steps in a dashed frame, its tag on the top edge. */
function DigitalFrame({ steps }: { steps: readonly InsideStep[] }) {
  const { t } = useTranslation()
  return (
    <div
      style={{
        position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center', rowGap: 16,
        padding: FRAME_PAD, margin: `${-FRAME_PAD - 1}px 0`,
        border: '1px dashed var(--lsc-fg-muted)', borderRadius: 12,
      }}
    >
      <span
        className="lsc-overline"
        style={{ position: 'absolute', top: -8, left: 12, padding: '0 6px', lineHeight: '16px', background: 'var(--lsc-header)' }}
      >
        {t.inside.digital}
      </span>
      {steps.map((step, i) => (
        <Fragment key={step.name}>
          {i > 0 && <Arrow />}
          <Step step={step} />
        </Fragment>
      ))}
    </div>
  )
}

/** One part: its card's icon in a box, its name under it (and, for a converter, what it does). */
function Step({ step }: { step: InsideStep }) {
  const { t }  = useTranslation()
  const Icon   = step.icon
  const shade  = step.digital ? 'var(--lsc-fg-muted)' : 'var(--lsc-fg)'
  const does   = (t.inside.does as Partial<Record<StepName, string>>)[step.name]
  return (
    <div style={{ minWidth: 72, maxWidth: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
      <span
        style={{
          width: BOX, height: BOX, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: step.digital ? 'var(--lsc-sunken)' : 'var(--lsc-node-bg)',
          border: '1px solid var(--lsc-border)', color: shade,
        }}
      >
        <Icon size={26} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25, color: shade }}>{t.inside.steps[step.name]}</span>
      {does && <span style={{ fontSize: 11, lineHeight: 1.25, color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap' }}>{does}</span>}
    </div>
  )
}

/** The way on, level with the icon boxes. */
function Arrow() {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden style={{ flexShrink: 0, margin: `${(BOX - 10) / 2}px 2px 0`, color: 'var(--lsc-fg-muted)' }}>
      <path d="M1 5H17M12.5 1L17 5L12.5 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
