import { INK, PART, PART_2 } from './look'

// The dynamic microphone as Magnetic induction draws it (Deep dive, D46), shared with Analogue
// amplification: its magnet, the voice coil on its diaphragm, in its own units (mic.ts: where the
// diaphragm rests, and how the painter moves it).

/** The magnet and the parts that move with the sound: the coil (`coil`) and the diaphragm (`diaphragm`), named for the painter */
export function MicrophoneParts() {
  return (
    <>
      <rect x={746} y={100} width={8} height={46} fill={PART} />
      <rect x={746} y={204} width={8} height={46} fill={PART} />
      <path d="M754 100 H815 Q855 100 855 140 V210 Q855 250 815 250 H754" fill="none" stroke={PART} strokeWidth={8} />
      <rect x={770} y={162} width={81} height={26} fill={PART_2} />
      <g data-p="coil" fill="none" stroke={INK} strokeWidth={1.5}>
        {Array.from({ length: 7 }, (_, i) => <ellipse key={i} cy={175} rx={3} ry={20} />)}
      </g>
      <path data-p="diaphragm" fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    </>
  )
}
