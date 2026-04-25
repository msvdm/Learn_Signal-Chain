import type { SourceType } from '../../store/signalStore'

// Data passed via React Flow node.data to all channel nodes.
// Must extend Record<string, unknown> to satisfy React Flow's Node<T> constraint.
export interface ChannelNodeData extends Record<string, unknown> {
  channelId: string
  typeKey: string
  color: string
  label?: string
  sourceType?: SourceType
}

// Data passed to master-section nodes
export interface MasterNodeData extends Record<string, unknown> {
  channelId: 'master'
}
