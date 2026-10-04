import type { Node, NodeProps } from '@xyflow/react'

/** What the canvas hands every element (useFlowElements): a name of its own, from a saved chain. */
export type CardData = { label?: string }

/** The props of every element's component (NODE_COMPONENTS): its id, type and data. */
export type CardProps = NodeProps<Node<CardData>>
