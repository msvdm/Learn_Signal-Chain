import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Info, Pause, Play } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { useLatestRef } from '../hooks/useLatestRef'
import { useDismiss } from '../hooks/useDismiss'
import { StableText } from '../components/controls/StableText'
import { pressedInside, typingInField } from '../utils/shortcut'
import { cameraFor, wrapPhase } from './wave'
import { subjectOf } from './subjects'
import type { ShapeId, Subject } from './subjects'
import { FLOW, INK } from './scenes/look'
import type { Painter } from './scenes/painter'

// Dive deeper (D46): the fourth button of the level stepper opens it in the canvas's place. The
// teacher picks a subject in the drawer (SubjectList), walks its steps — each adds a part to the
// picture, and the camera steps back to show them all — and plays one cycle of the movement or
// stops it at a phase. Like the meters, the movement never goes through React: one animation loop
// calls the scene's painter and writes the readouts itself.

/** One cycle takes six seconds */
const DEGREES_A_SECOND = 60
/** The phases worth stopping at */
const JUMPS = [0, 90, 180, 270, 360]

/** Whose work a picture uses: the links in its credit (`deeper.credits`, as {name}) */
const CREDIT_LINKS: Record<NonNullable<Subject['credit']>, Record<string, { text: string; href: string }>> = {
  ear: {
    work:    { text: 'Anatomy of the Human Ear', href: 'https://commons.wikimedia.org/wiki/File:Anatomy_of_the_Human_Ear.svg' },
    licence: { text: 'CC BY 2.5', href: 'https://creativecommons.org/licenses/by/2.5/' },
  },
}

const button: CSSProperties = {
  height: 34, padding: '0 12px', borderRadius: 8,
  border: '1px solid var(--lsc-border)', background: 'transparent',
  color: 'var(--lsc-fg)', fontSize: 13, fontWeight: 500,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
  whiteSpace: 'nowrap', flexShrink: 0,
}
const square: CSSProperties = { ...button, width: 34, padding: 0 }
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }
const caption: CSSProperties = { fontSize: 13, color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap' }

/** `left`: how much of the left side the drawer covers — the picture keeps clear of it. */
export function DeeperView({ left }: { left: number }) {
  const subject = subjectOf(useSignalStore((s) => s.deeperSubject))
  // Another subject starts from its first step, at 0°
  return <Player key={subject.id} subject={subject} left={left} />
}

function Player({ subject, left }: { subject: Subject; left: number }) {
  const { t } = useTranslation()
  const [step, setStep]       = useState(1)
  const [playing, setPlaying] = useState(true)
  const [size, setSize]       = useState<{ w: number; h: number } | null>(null)
  /** The shape picked, if the subject has shapes (the first until another is) */
  const [picked, setPicked]   = useState<ShapeId | undefined>(subject.shapes?.ids[0])
  const count = subject.steps.length
  const shapes = subject.shapes
  const shape = shapes && step === shapes.step ? picked : undefined

  const stage   = useRef<HTMLDivElement>(null)
  const phase   = useRef(0)
  const painter = useRef<Painter | null>(null)
  const stepNow = useLatestRef(step)
  const shapeNow = useLatestRef(shape)
  const degrees = useRef<HTMLSpanElement>(null)
  const slider  = useRef<HTMLInputElement>(null)
  const percent = useRef<HTMLSpanElement>(null)

  /** The picture and the readouts at the phase reached. */
  const paint = useCallback(() => {
    const deg = phase.current, whole = Math.round(deg)
    painter.current?.(deg, stepNow.current, shapeNow.current)
    if (degrees.current) degrees.current.textContent = `${whole}°`
    if (percent.current) percent.current.textContent = String(Math.round(deg / 3.6))
    if (slider.current) slider.current.value = String(whole)
  }, [stepNow, shapeNow])

  const onPainter = useCallback((made: Painter | null) => {
    painter.current = made
    if (made) paint()
  }, [paint])

  // Playing: the phase runs on, a picture a frame (the browser stops asking while the tab is hidden)
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last: number | null = null
    const tick = (now: number) => {
      // A long gap (the tab was hidden, the page was busy) is not caught up: the phase carries on
      if (last !== null) phase.current = (phase.current + (Math.min(now - last, 100) / 1000) * DEGREES_A_SECOND) % 360
      last = now
      paint()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, paint])

  // A step's new parts, a shape's, stand at the phase reached, stopped too
  useEffect(paint, [step, shape, paint])

  // The camera fits the stage, whatever its shape
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** Stop at a phase. */
  function stopAt(deg: number) {
    setPlaying(false)
    phase.current = wrapPhase(deg)
    paint()
  }

  // ← → walk the steps, Space plays and stops — never while typing, on the slider, or in a window
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (typingInField(e) || pressedInside(e, '[role="dialog"], [role="menu"]')) return
      if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, count))
      else if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 1))
      else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [count])

  const camera = size && size.w > 0 && size.h > 0
    ? cameraFor(subject.steps.slice(0, step).map((s) => s.box), size.w, size.h)
    : null
  const name = t.deeper.subjects[subject.id]
  const [beforePercent, afterPercent] = t.deeper.ofCycle.split('{pct}')

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* The picture */}
      <div ref={stage} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <svg role="img" aria-label={name} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <filter id="lsc-dd-cloud" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation={10} /></filter>
            <filter id="lsc-dd-cloud-mask" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation={7} /></filter>
            {([['lsc-dd-arrow', FLOW], ['lsc-dd-arrow-ink', INK]] as const).map(([id, colour]) => (
              <marker key={id} id={id} viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke={colour} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            ))}
          </defs>
          {camera && (
            <g className="lsc-dd-camera" style={{ transform: `translate(${camera.x.toFixed(1)}px, ${camera.y.toFixed(1)}px) scale(${camera.scale.toFixed(3)})` }}>
              <subject.Scene step={step} shape={shape} onPainter={onPainter} />
            </g>
          )}
        </svg>
      </div>

      {/* The controls: the steps, then the phase */}
      <div
        style={{
          flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 16px 12px',
          background: 'var(--lsc-header)', borderTop: '1px solid var(--lsc-border)',
        }}
      >
        <div style={row}>
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            aria-label={t.deeper.back}
            className="lsc-btn-outline"
            style={{ ...square, opacity: step === 1 ? 0.4 : 1 }}
          >
            <ChevronLeft size={16} />
          </button>
          <nav aria-label={t.deeper.stepsLabel} style={{ ...row, gap: 4, flexShrink: 0 }}>
            {subject.steps.map((s, i) => {
              const n = i + 1
              const active = n === step
              return (
                <Fragment key={s.id}>
                  {i > 0 && <span style={{ width: 10, height: 1, background: n <= step ? 'var(--lsc-accent)' : 'var(--lsc-border)' }} />}
                  <button
                    onClick={() => setStep(n)}
                    aria-label={`${n} · ${t.deeper.steps[s.id]}`}
                    aria-current={active ? 'step' : undefined}
                    className={active ? undefined : 'lsc-btn-outline'}
                    style={{
                      width: 30, height: 30, borderRadius: 9999, flexShrink: 0, cursor: active ? 'default' : 'pointer',
                      fontSize: 12, fontWeight: 600,
                      border: `1px solid ${n <= step ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
                      background: active ? 'var(--lsc-accent)' : n < step ? 'var(--lsc-accent-bg)' : 'transparent',
                      color: active ? '#fff' : n < step ? 'var(--lsc-fg)' : 'var(--lsc-fg-muted)',
                    }}
                  >
                    {n}
                  </button>
                </Fragment>
              )
            })}
          </nav>
          <button
            onClick={() => setStep(step + 1)}
            disabled={step === count}
            aria-label={t.deeper.next}
            className="lsc-btn-outline"
            style={{ ...square, opacity: step === count ? 0.4 : 1 }}
          >
            <ChevronRight size={16} />
          </button>
          <StepTitle name={t.deeper.steps[subject.steps[step - 1].id]} />
          {shapes && (
            // The step's shapes, after its name in the same row (a row of their own would take the picture's room)
            <div role="group" aria-label={t.deeper.shape} style={{ ...row, flexShrink: 0, gap: 6 }}>
              {shapes.ids.map((id) => {
                const on = id === shape
                return (
                  <button
                    key={id}
                    // Picked at another step, it is shown at its own
                    onClick={() => {
                      setPicked(id)
                      setStep(shapes.step)
                    }}
                    aria-pressed={on}
                    className="lsc-btn-outline"
                    // Both colours always set: dropping `borderColor` would clear the shorthand's too
                    style={{
                      ...button, height: 30, padding: '0 9px', fontSize: 12,
                      borderColor: on ? 'var(--lsc-accent)' : 'var(--lsc-border)',
                      background: on ? 'var(--lsc-accent-bg)' : 'transparent',
                    }}
                  >
                    {t.deeper.shapes[id]}
                  </button>
                )
              })}
            </div>
          )}
          {subject.credit && <Credit text={t.deeper.credits[subject.credit]} links={CREDIT_LINKS[subject.credit]} label={t.deeper.credit} />}
        </div>

        <div style={row}>
          <button
            onClick={() => setPlaying(!playing)}
            className="lsc-btn-outline"
            style={{ ...button, borderColor: 'var(--lsc-accent)', background: 'var(--lsc-accent-bg)' }}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
            <StableText reserve={[t.deeper.play, t.deeper.pause]}>{playing ? t.deeper.pause : t.deeper.play}</StableText>
          </button>
          <span style={{ ...caption, marginLeft: 6 }}>{t.deeper.phase}</span>
          <span ref={degrees} style={{ width: 52, fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>0°</span>
          <input
            ref={slider}
            type="range"
            min={0}
            max={360}
            step={1}
            defaultValue={0}
            aria-label={t.deeper.phase}
            onChange={(e) => stopAt(Number(e.target.value))}
            className="lsc-dd-slider"
            style={{ flex: 1, minWidth: 120 }}
          />
          <span style={{ ...caption, fontVariantNumeric: 'tabular-nums' }}>
            {beforePercent}
            <span ref={percent} style={{ display: 'inline-block', minWidth: '3ch', textAlign: 'right' }}>0</span>
            {afterPercent}
          </span>
          <span style={{ ...caption, marginLeft: 10 }}>{t.deeper.jump}</span>
          {JUMPS.map((deg) => (
            <button
              key={deg}
              onClick={() => stopAt(deg)}
              className="lsc-btn-outline"
              style={{ ...button, padding: '0 9px', fontVariantNumeric: 'tabular-nums' }}
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const visuallyHidden: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'inset(50%)', whiteSpace: 'nowrap' }

/**
 * The step's name, in the room the row leaves it: whole, or not at all — never cut short (always
 * read out; the step's lit circle says which it is). A hidden copy measures it.
 */
function StepTitle({ name }: { name: string }) {
  const box = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLSpanElement>(null)
  const [fits, setFits] = useState(true)

  useLayoutEffect(() => {
    const el = box.current, copy = measure.current
    if (!el || !copy) return
    const fit = () => setFits(copy.getBoundingClientRect().width <= el.clientWidth)
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [name])

  const text: CSSProperties = { whiteSpace: 'nowrap', fontSize: 15, fontWeight: 600 }
  return (
    <div ref={box} style={{ flex: 1, minWidth: 0, marginLeft: 6, overflow: 'hidden', position: 'relative', ...text }}>
      <span ref={measure} aria-hidden style={{ position: 'absolute', visibility: 'hidden', ...text }}>{name}</span>
      <span aria-live="polite" style={fits ? undefined : visuallyHidden}>{name}</span>
    </div>
  )
}

/** Whose work the picture uses: a small button, its line opening above it. */
function Credit({ text, links, label }: { text: string; links: Record<string, { text: string; href: string }>; label: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, () => setOpen(false), { open, escape: true })
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="lsc-btn-outline"
        style={{ ...button, height: 30, padding: '0 9px', fontSize: 12, color: 'var(--lsc-fg-muted)', borderColor: open ? 'var(--lsc-accent)' : 'transparent' }}
      >
        <Info size={14} />
        {label}
      </button>
      {open && (
        <p
          style={{
            position: 'absolute', right: 0, bottom: '100%', zIndex: 30, margin: '0 0 8px', width: 320, padding: '10px 12px',
            borderRadius: 10, background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
            boxShadow: 'var(--lsc-shadow-popup)', fontSize: 12, lineHeight: 1.45, color: 'var(--lsc-fg-muted)',
          }}
        >
          {text.split(/\{(\w+)\}/).map((part, i) => {
            const link = i % 2 ? links[part] : undefined
            return link
              ? <a key={i} href={link.href} target="_blank" rel="noreferrer" style={{ color: 'var(--lsc-accent-text)', textDecoration: 'underline' }}>{link.text}</a>
              : <Fragment key={i}>{i % 2 ? `{${part}}` : part}</Fragment>
          })}
        </p>
      )}
    </div>
  )
}
