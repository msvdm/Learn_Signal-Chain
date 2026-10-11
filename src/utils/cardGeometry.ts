// Every node card shares the same header height and port line, so wires between
// cards stay straight no matter how tall each card is.
export const HEADER_H = 56
// First port centre, measured from the card top: just below the header's divider, clear of its
// buttons. The ring is 28px (40px while it shows the unplug ×), so it never touches the line.
export const PORT_TOP = HEADER_H + 24
export const PORT_GAP = 36   // spacing between stacked ports on the same side (rings don't touch)
