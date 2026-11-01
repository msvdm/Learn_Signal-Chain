import type { NodeProps } from '@xyflow/react'

/**
 * The props of every element's component (NODE_COMPONENTS): its id and type. Its name, settings
 * and signal come from the store (useNodeName, useParams, useGraphSignal), not React Flow's `data`.
 */
export type CardProps = NodeProps
