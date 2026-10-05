import type { CSSProperties } from 'react'
import type { NodePort as Port, TypeKey } from '../../data/nodeRegistry'
import { availableAt } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'
import { useStage } from '../../hooks/useGraphSignal'
import { formatDb, humStrength } from '../../signal/levels'
import type { SignalDomain } from '../../signal/levels'
import { AUDIBLE_HISS_DB, hissStartsAt } from '../../signal/readings'
import { useReadingsShown } from '../../hooks/useReadingsShown'
import { useTranslation } from '../../i18n/useTranslation'
import { portName } from '../../utils/nodeName'
import { NodePort } from './NodePort'
import { NoiseIcon } from './icons'

// Pieces every element's shell draws around its controls (NodeWrapper, FreeControl; useNodeChrome)

/**
 * The element's inputs down its left edge and outputs down its right, from the first port line.
 * A microphone's input (the sound of a Guitar Amp) is left out at a level without Guitar Amps,
 * unless a wire is on it.
 */
export function PortStack({ nodeId, typeKey, ports }: {
  nodeId: string
  typeKey: TypeKey
  ports: { inputs: Port[]; outputs: Port[] }
}) {
  const { t } = useTranslation()
  const noInputs = useSignalStore((s) =>
    typeKey === 'mic' && !availableAt('guitar-amp', s.complexityLevel) && !s.edges.some((e) => e.target === nodeId))
  return (
    <>
      {!noInputs && ports.inputs.map((port, i) => (
        <NodePort key={port.id} nodeId={nodeId} portId={port.id} type="target" index={i} title={portName(t, typeKey, port.id)} />
      ))}
      {ports.outputs.map((port, i) => (
        <NodePort key={port.id} nodeId={nodeId} portId={port.id} type="source" index={i} title={portName(t, typeKey, port.id)} />
      ))}
    </>
  )
}

/** "{Element} input", above the top left corner, while the wire being drawn can land here. */
export function WireTargetBadge({ label }: { label: string }) {
  const { t, fmt } = useTranslation()
  return (
    <span
      style={{
        position: 'absolute', left: -12, top: -30,
        padding: '4px 8px', borderRadius: 6,
        background: 'var(--lsc-accent)', color: '#fff',
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {fmt(t.connecting.input, { node: label })}
    </span>
  )
}

/**
 * The tags on the bottom edge of an element, side by side: the hum of a DI Box ground loop, on
 * every element it passes through, and — from Intermediate up — "You can hear hiss here" on the
 * element where the hiss becomes audible (signal/readings.ts hissStartsAt).
 */
export function NoiseTags({ nodeId, overview }: { nodeId: string; overview: boolean }) {
  const stage    = useStage(nodeId)
  const detailed = useReadingsShown()
  const hiss     = detailed && stage !== undefined && hissStartsAt(stage)
  if (stage?.hum === undefined && !hiss) return null

  return (
    <div
      style={{
        position: 'absolute', left: '50%', bottom: 0, transform: 'translate(-50%, 50%)', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: overview ? 16 : 6,
      }}
    >
      {stage?.hum !== undefined && <HumTag db={stage.hum} domain={stage.domain} overview={overview} />}
      {hiss && <HissTag overview={overview} />}
    </div>
  )
}

/**
 * "Hum" and its level: solid red, and bigger the stronger the hum has grown (humStrength), so you
 * can follow it getting worse down the chain. Bigger again zoomed out, so it still reads.
 */
function HumTag({ db, domain, overview }: { db: number; domain: SignalDomain; overview: boolean }) {
  const { t } = useTranslation()
  const size  = Math.round((overview ? 28 : 12) * (1 + humStrength(db)))
  return (
    <span title={t.hum.tip} style={{ ...tag, fontSize: size, background: 'var(--signal-clipping)', color: '#fff' }}>
      <svg viewBox="0 0 24 12" width="1.6em" height="0.8em" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <path d="M2 6 C4 1 6 1 8 6 S12 11 14 6 S18 1 20 6 S22 9 22 9" />
      </svg>
      {t.hum.tag} {formatDb(db, domain)}
    </span>
  )
}

/** "You can hear hiss here", in the grey of the noise fog on the meters. */
function HissTag({ overview }: { overview: boolean }) {
  const { t, fmt } = useTranslation()
  const size       = overview ? 28 : 12
  return (
    <span
      title={fmt(t.readings.hissHereTip, { audible: String(AUDIBLE_HISS_DB) })}
      style={{ ...tag, fontSize: size, background: 'var(--lsc-fg-muted)', color: 'var(--lsc-node-bg)' }}
    >
      <NoiseIcon size={Math.round(size * 1.6)} />
      {t.readings.hissHere}
    </span>
  )
}

const tag: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.3em',
  padding: '0.2em 0.6em', borderRadius: 9999,
  fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap',
  boxShadow: 'var(--lsc-shadow-node)',
}
