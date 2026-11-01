/** The shortcut modifier as people know it: ⌘ on a Mac, Ctrl+ elsewhere. */
export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

/** A key pressed in a text field (the palette search, a name) is typing, not a shortcut. */
export function typingInField(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

/** The key was pressed inside an element matching `selector` (an open menu or dialog, which has keys of its own). */
export function pressedInside(e: KeyboardEvent, selector: string): boolean {
  return e.target instanceof Element && e.target.closest(selector) !== null
}
