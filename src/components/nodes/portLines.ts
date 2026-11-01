import { PORT_GAP, PORT_TOP } from '../../utils/layoutHelpers'
import { PAD } from './overviewLayout'

// A line across a face on one of its port lines, naming what goes in and out there (PortLine,
// InterfaceNode.tsx): where it sits in the face's box.

/** A path line's height (px): centred on its port line */
export const LINE_H = 20

/** Where port line `row` is in a face's art box (it starts PAD below the card's top) */
export const lineTop = (row: number) => PORT_TOP + row * PORT_GAP - PAD - LINE_H / 2
