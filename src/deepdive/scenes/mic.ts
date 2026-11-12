// The dynamic microphone as Magnetic induction draws it (Deep dive, D46; its parts: micParts.tsx),
// shared with Analogue amplification. Drawn in its own units — the diaphragm rests at x = MIC_FACE,
// its middle at y = MIC_MIDDLE — so a scene places it with a translate; the painter moves the
// diaphragm and the coil.

export const MIC_FACE = 746, MIC_MIDDLE = 175

/** The diaphragm and its coil `u` (the drawing's units) from where they rest */
export function moveMicrophone(diaphragm: SVGElement, coil: SVGElement[], u: number) {
  const f = (n: number) => n.toFixed(1)
  diaphragm.setAttribute('d',
    `M746 112 Q${f(734 + u / 2)} 128 ${f(744 + u)} 146 Q${f(704 + u)} 175 ${f(744 + u)} 204 Q${f(734 + u / 2)} 222 746 238`)
  coil.forEach((turn, i) => turn.setAttribute('cx', f(748 + u + i * 5)))
}
