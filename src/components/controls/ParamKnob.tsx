import type { ComponentProps } from 'react'
import { KnobControl } from './KnobControl'
import { useParams } from '../../hooks/useParams'
import { useSignalStore } from '../../store/signalStore'
import type { ParamKey, ParamTypes, TypeKey } from '../../data/nodeRegistry'

/** The settings that are always a number: what a knob can turn. */
export type NumberParam = { [K in ParamKey]: ParamTypes[K] extends number ? K : never }[ParamKey]

/**
 * A knob turning one of its card's settings: it shows the setting (its type's default until it is
 * turned) and writes every turn to the store. The rest is KnobControl's (range, label, look). A
 * knob whose writing does more (the Amplifier's channel A, the Gain's two modes) keeps its own.
 */
export function ParamKnob({ nodeId, typeKey, param, ...knob }: {
  nodeId: string
  typeKey: TypeKey
  param: NumberParam
} & Omit<ComponentProps<typeof KnobControl>, 'value' | 'onChange'>) {
  const p                = useParams(nodeId, typeKey)
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  return <KnobControl {...knob} value={p(param)} onChange={(v) => updateNodeParams(nodeId, { [param]: v })} />
}
