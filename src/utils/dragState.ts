import type { TypeKey } from '../data/nodeRegistry'

// Shared mutable for the active palette drag type key.
// dataTransfer.getData() returns "" during dragover (browser security), so we track it here.
export let activeDragTypeKey: TypeKey | null = null
export function setActiveDragTypeKey(key: TypeKey | null) { activeDragTypeKey = key }
