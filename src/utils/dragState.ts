// Shared mutable for the active palette drag type key.
// dataTransfer.getData() returns "" during dragover (browser security), so we track it here.
export let activeDragTypeKey: string | null = null
export function setActiveDragTypeKey(key: string | null) { activeDragTypeKey = key }
