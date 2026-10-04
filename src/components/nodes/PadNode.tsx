import type { CardProps } from './cardProps'
import { useTranslation } from '../../i18n/useTranslation'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'

export function PadNode({ id }: CardProps) {
  const p                = useParams(id, 'pad')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const engaged = p('engaged')

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="pad"
      label={useNodeName(id, 'pad')}
      align="center"
    >
      <button
        className="nodrag nopan w-full rounded py-1"
        style={{
          fontSize: 'var(--node-text-xs)',
          fontWeight: 700,
          fontFamily: 'var(--lsc-font-mono)',
          background: engaged ? 'var(--signal-hot-bg)' : 'var(--lsc-sunken)',
          border: `1px solid ${engaged ? 'var(--signal-hot)' : 'var(--lsc-border)'}`,
          color: engaged ? 'var(--signal-hot)' : 'var(--lsc-fg)',
          opacity: engaged ? 1 : 0.55,
          cursor: 'pointer',
        }}
        onClick={() => updateNodeParams(id, { engaged: !engaged })}
      >
        {engaged ? t.nodes.pad.on : t.nodes.pad.off}
      </button>
    </NodeWrapper>
  )
}
