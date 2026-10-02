import { Fragment } from 'react'
import type { CSSProperties } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { Grid3x3 } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { ChannelRow } from '../SignalMeter'
import { useSignalStore } from '../../store/signalStore'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useTranslation } from '../../i18n/useTranslation'
import { MATRIX_INPUTS, MATRIX_OUTPUTS, matrixParam } from '../../data/nodeRegistry'
import { nodeName, sideLetter } from '../../utils/nodeName'
import { formatPotDb } from '../../utils/readout'

interface GraphMatrixData extends Record<string, unknown> {
  color?: string
  label?: string
}

/**
 * Makes new mixes from finished mixes: one row per input, one knob per output.
 * Each knob sets how much of that input goes to that output; each output is one channel.
 */
export function MatrixNode({ id, data }: NodeProps<Node<GraphMatrixData>>) {
  const { stages, portSignal, wires } = useGraphSignal()
  const nodes            = useSignalStore((s) => s.nodes)
  const edges            = useSignalStore((s) => s.edges)
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t, fmt }       = useTranslation()

  const node = nodes.find((n) => n.id === id)
  const tm   = t.nodes.matrix

  /** What is plugged into input `n` ("Master Bus · L"), or null when nothing is. */
  function sourceOf(n: number): string | null {
    const edge = edges.find((e) => e.target === id && e.targetHandle === `in-${n}`)
    if (!edge) return null
    const from = nodes.find((x) => x.id === edge.source)
    const side = sideLetter(wires.get(`${edge.source}:${edge.sourceHandle}`)?.kind)
    return nodeName(t, from, from && stages[from.id]) + (side ? ` · ${side}` : '')
  }

  const small: CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--lsc-fg-muted)' }

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="matrix"
      icon={<Grid3x3 size={16} />}
      label={data.label ?? tm.label}
    >
      <div
        className="nodrag nopan"
        style={{
          display: 'grid', gridTemplateColumns: `112px repeat(${MATRIX_OUTPUTS.length}, auto)`,
          columnGap: 12, rowGap: 6, alignItems: 'center', justifyItems: 'center',
        }}
      >
        <span />
        {MATRIX_OUTPUTS.map((o) => (
          <span key={o} style={small}>{fmt(tm.output, { n: String(o) })}</span>
        ))}

        {MATRIX_INPUTS.map((i) => {
          const source = sourceOf(i)
          return (
            <Fragment key={i}>
              {/* Fixed width: plugging something in never resizes the card */}
              <span style={{ justifySelf: 'start', width: 112, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span style={{ ...small, color: 'var(--lsc-fg)' }}>{fmt(tm.input, { n: String(i) })}</span>
                <span style={{ fontSize: 11, overflowWrap: 'anywhere', color: source ? 'var(--lsc-fg)' : 'var(--lsc-fg-dim)' }}>
                  {source ?? tm.empty}
                </span>
              </span>
              {MATRIX_OUTPUTS.map((o) => (
                <KnobControl
                  key={o}
                  value={(node?.params[matrixParam(i, o)] as number) ?? 75}
                  min={0}
                  max={100}
                  step={0.5}
                  label=""
                  formatValue={formatPotDb}
                  onChange={(v) => updateNodeParams(id, { [matrixParam(i, o)]: v })}
                  color="var(--lsc-accent)"
                  size={36}
                />
              ))}
            </Fragment>
          )
        })}
      </div>

      {/* One meter per output */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 'var(--node-text-sm)', color: 'var(--lsc-fg-muted)' }}>{t.meters.output}</span>
        {MATRIX_OUTPUTS.map((o) => (
          <ChannelRow key={o} ch={String(o)} db={portSignal.get(`${id}:out-${o}`) ?? -Infinity} />
        ))}
      </div>
    </NodeWrapper>
  )
}
