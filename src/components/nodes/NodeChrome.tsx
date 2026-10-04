import type { NodePort as Port, TypeKey } from '../../data/nodeRegistry'
import { availableAt } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { formatDb, humStrength } from '../../signal/levels'
import { useTranslation } from '../../i18n/useTranslation'
import { portName } from '../../utils/nodeName'
import { NodePort } from './NodePort'

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
 * "Hum" and its level, on the bottom edge of every element a DI Box ground-loop hum passes through:
 * solid red, and bigger the stronger the hum has grown (humStrength), so you can follow it getting
 * worse down the chain. Bigger again zoomed out, so it still reads.
 */
export function HumTag({ nodeId, overview }: { nodeId: string; overview: boolean }) {
  const { t }      = useTranslation()
  const { stages } = useGraphSignal()
  const stage      = stages[nodeId]
  if (stage?.hum === undefined) return null

  const size = Math.round((overview ? 28 : 12) * (1 + humStrength(stage.hum)))
  return (
    <span
      title={t.hum.tip}
      style={{
        position: 'absolute', left: '50%', bottom: 0, transform: 'translate(-50%, 50%)', zIndex: 2,
        display: 'inline-flex', alignItems: 'center', gap: '0.3em',
        padding: '0.2em 0.6em', borderRadius: 9999,
        background: 'var(--signal-clipping)', color: '#fff',
        fontSize: size, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap',
        boxShadow: 'var(--lsc-shadow-node)',
      }}
    >
      <svg viewBox="0 0 24 12" width="1.6em" height="0.8em" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <path d="M2 6 C4 1 6 1 8 6 S12 11 14 6 S18 1 20 6 S22 9 22 9" />
      </svg>
      {t.hum.tag} {formatDb(stage.hum, stage.domain)}
    </span>
  )
}
