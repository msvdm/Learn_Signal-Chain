import { useEffect, useMemo } from 'react'
import { useUpdateNodeInternals } from '@xyflow/react'
import type { CardProps } from './cardProps'
import { useTranslation } from '../../i18n/useTranslation'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { SquareButton } from '../controls/SquareButton'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { NodePort } from './NodePort'
import { graphOf } from '../../graph/graph'
import { sidePoints } from '../../graph/freeSides'
import type { SidePoint } from '../../graph/freeSides'
import type { Facing } from '../../data/nodeRegistry'

// A free-standing button, big enough to read zoomed out
const BUTTON = 110

/**
 * On = the signal passes, Off = silence. Drawn as one big square On / Off button (no card, no name:
 * the button says it all). Wired into a PFL Bus it is that channel's PFL button (role 'pfl'): "PFL"
 * on or off, lit solid yellow — it works the same.
 */
export function SwitchNode({ id }: CardProps) {
  const p                = useParams(id, 'switch')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const pfl              = useStage(id)?.role === 'pfl'

  const isOn = p('on')

  return (
    <FreeControl nodeId={id} typeKey="switch" label={useNodeName(id, 'switch')} showName={false} portLine={BUTTON / 2} points={<SwitchPoints id={id} />}>
      <SquareButton on={isOn} tone={pfl ? 'pfl' : 'good'} size={BUTTON} fontSize={32} onClick={() => updateNodeParams(id, { on: !isOn })}>
        {pfl ? t.nodes.pfl.label : isOn ? t.nodeControls.on : t.nodeControls.off}
      </SquareButton>
    </FreeControl>
  )
}

const ALONE = { above: false, below: false }

/**
 * The switch's connection points (graph/freeSides.ts): one on each side while nothing is wired,
 * each taking a wire in or sending one out; only its input and output once both are wired.
 */
function SwitchPoints({ id }: { id: string }) {
  // As one string, so the points are redrawn only when they change
  const key = useSignalStore((s) => {
    const node = graphOf(s).node(id)
    return node ? sidePoints(node, s).map((p) => [p.side, p.id, p.type, p.open ?? ''].join(':')).join(',') : ''
  })
  const points = useMemo(() => (key ? key.split(',') : []).map((k): SidePoint => {
    const [side, pid, type, open] = k.split(':')
    return { side: side as Facing, id: pid, type: type as SidePoint['type'], ...(open ? { open: open as SidePoint['open'] } : {}) }
  }), [key])
  // Points come and go: React Flow reads where they are again, so the wires end at them
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => { updateNodeInternals(id) }, [key, id, updateNodeInternals])
  return (
    <>
      {points.map((p) => (
        <NodePort key={`${p.type}-${p.id}`} nodeId={id} portId={p.id} type={p.type} row={0} near={ALONE} side={p.side} open={p.open} />
      ))}
    </>
  )
}
