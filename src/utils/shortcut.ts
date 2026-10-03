/** The shortcut modifier as people know it: ⌘ on a Mac, Ctrl+ elsewhere. */
export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
