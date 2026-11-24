import type { ComponentType } from 'react'
import { AudioWaveform, Binary, Ear, Mic, Zap, createLucideIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Translations } from '../i18n/translations'
import type { Box } from './wave'
import type { SceneProps } from './scenes/painter'
import { AcousticScene } from './scenes/AcousticScene'
import { TransducerScene } from './scenes/TransducerScene'
import { ComplexScene } from './scenes/ComplexScene'
import { AmplificationScene } from './scenes/AmplificationScene'
import { ConversionControls, ConversionScene } from './scenes/ConversionScene'
import { MicrophonesScene } from './scenes/MicrophonesScene'
import { cellBox } from './scenes/micCells'

// Deep dive's subjects (D46): each a chain of causes and effects the teacher steps through — one
// picture, a step adding a part of it, everything moving with one phase. A new subject: its scene
// (deepdive/scenes/, a picture and its painter), its entry here, and its name and its steps' names
// in the locales (`deepDive.subjects`, `deepDive.steps`).

/**
 * Magnetic induction's icon: a coil — two legs and three loops, one wire (a trochoid: the loops'
 * curve made with cubic Béziers). Its line 1.5 wide, not lucide's 2, so the loops stay open at 18 px
 */
const Coil = createLucideIcon('coil', [['path', { d: 'M1.75 21V10C1.94 8.3 2.37 6.61 2.97 5.4C3.57 4.2 4.33 3.5 5.1 3.5C5.87 3.5 6.63 4.2 7.23 5.4C7.83 6.61 8.26 8.3 8.45 10C8.64 11.7 8.6 13.39 8.38 14.6C8.17 15.8 7.78 16.5 7.4 16.5C7.02 16.5 6.63 15.8 6.42 14.6C6.2 13.39 6.16 11.7 6.35 10C6.54 8.3 6.97 6.61 7.57 5.4C8.17 4.2 8.93 3.5 9.7 3.5C10.47 3.5 11.23 4.2 11.83 5.4C12.43 6.61 12.86 8.3 13.05 10C13.24 11.7 13.2 13.39 12.98 14.6C12.77 15.8 12.38 16.5 12 16.5C11.62 16.5 11.23 15.8 11.02 14.6C10.8 13.39 10.76 11.7 10.95 10C11.14 8.3 11.57 6.61 12.17 5.4C12.77 4.2 13.53 3.5 14.3 3.5C15.07 3.5 15.83 4.2 16.43 5.4C17.03 6.61 17.46 8.3 17.65 10C17.84 11.7 17.8 13.39 17.58 14.6C17.37 15.8 16.98 16.5 16.6 16.5C16.22 16.5 15.83 15.8 15.62 14.6C15.4 13.39 15.36 11.7 15.55 10C15.74 8.3 16.17 6.61 16.77 5.4C17.37 4.2 18.13 3.5 18.9 3.5C19.67 3.5 20.43 4.2 21.03 5.4C21.63 6.61 22.06 8.3 22.25 10V21', strokeWidth: '1.5', key: 'coil' }]])

export type SubjectId = keyof Translations['deepDive']['subjects']
export type StepId    = keyof Translations['deepDive']['steps']
export type ShapeId   = keyof Translations['deepDive']['shapes']

export interface Subject {
  id: SubjectId
  icon: LucideIcon
  /** The picture and what moves in it */
  Scene: ComponentType<SceneProps>
  /**
   * Its steps in order: each one's name and the part of the picture it adds (in the scene's units —
   * the camera shows every part reached so far)
   */
  steps: readonly { id: StepId; box: Box }[]
  /** Whose work the picture uses, said under it (`deepDive.credits`) */
  credit?: keyof Translations['deepDive']['credits']
  /**
   * Shapes the teacher can pick (`deepDive.shapes`): groups of buttons, each shown in the steps' row
   * after the name of its step, and only there. A group's first counts until another is picked at its
   * step; the one picked counts from that step on (the scene gets them: `SceneProps.shapes`)
   */
  shapes?: readonly { step: number; ids: readonly ShapeId[] }[]
  /**
   * The subject's own controls, in one panel two rows high: the `knobs` right of the steps, the
   * `choices` (buttons, in two rows) at its right end, the step's name between them where it fits.
   * With them the picture stands still — no play, no phase — and is a function of them (each shown
   * from the step that uses it)
   */
  Controls?: ComponentType<{ step: number; part: 'knobs' | 'choices' }>
}

/** In the drawer's order */
export const SUBJECTS: readonly Subject[] = [
  {
    id: 'acoustic',
    icon: Ear,
    Scene: AcousticScene,
    steps: [
      { id: 'string',   box: [15, 38, 215, 312] },
      { id: 'air',      box: [15, 38, 215, 312] },
      { id: 'ear',      box: [15, 35, 1300, 312] },
      { id: 'pendulum', box: [30, 300, 230, 552] },
      { id: 'circle',   box: [230, 325, 460, 510] },
      { id: 'sine',     box: [460, 325, 975, 610] },
    ],
    credit: 'ear',
  },
  {
    id: 'complex',
    icon: AudioWaveform,
    Scene: ComplexScene,
    steps: [
      { id: 'fundamental',      box: [-110, 30, 620, 225] },
      { id: 'secondSine',       box: [-110, 235, 620, 345] },
      { id: 'addingUp',         box: [690, 150, 1365, 590] },
      { id: 'thirdSine',        box: [-110, 355, 620, 420] },
      { id: 'moreSines',        box: [-110, 430, 1370, 850] },
      { id: 'guitar',           box: [690, 150, 1365, 590] },
    ],
    shapes: [{ step: 5, ids: ['sawtooth', 'square', 'triangle', 'sameSize', 'quietFirst'] }],
  },
  {
    id: 'transducer',
    icon: Coil,
    Scene: TransducerScene,
    steps: [
      { id: 'microphone',   box: [35, 560, 540, 800] },
      { id: 'voltage',      box: [300, 590, 925, 810] },
      { id: 'recordHead',   box: [35, 790, 1310, 1110] },
      { id: 'playbackHead', box: [900, 820, 1310, 1138] },
      { id: 'speaker',      box: [1010, 492, 1410, 850] },
    ],
  },
  {
    id: 'microphones',
    icon: Mic,
    Scene: MicrophonesScene,
    steps: [
      { id: 'dynamicMic',   box: cellBox('dynamic') },
      { id: 'condenserMic', box: cellBox('condenser') },
      { id: 'ribbonMic',    box: cellBox('ribbon') },
      { id: 'piezoMic',     box: cellBox('piezo') },
    ],
  },
  {
    id: 'amplification',
    icon: Zap,
    Scene: AmplificationScene,
    steps: [
      { id: 'weakSignal',       box: [90, -50, 650, 530] },
      { id: 'powerSupply',      box: [90, -110, 1290, 530] },
      { id: 'preampChip',       box: [90, -110, 1440, 650] },
      { id: 'pushPull',         box: [90, -110, 2530, 650] },
      { id: 'classes',          box: [90, -110, 2560, 690] },
    ],
    shapes: [
      { step: 5, ids: ['classA', 'classB', 'classD'] },
      { step: 5, ids: ['cleanChip', 'transformer'] },
    ],
  },
  {
    id: 'conversion',
    icon: Binary,
    Scene: ConversionScene,
    steps: [
      { id: 'lineIn',        box: [-40, 20, 830, 560] },
      { id: 'clockSamples',  box: [-40, 20, 2720, 640] },
      { id: 'backToVoltage', box: [-40, 20, 2720, 1200] },
    ],
    Controls: ConversionControls,
  },
]

/** The subject with this id — the first one for an id the app does not know (an older visit's). */
export function subjectOf(id: string): Subject {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0]
}
