import type { ComponentType } from 'react'
import { AudioWaveform, Ear, Speaker, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Translations } from '../i18n/translations'
import type { Box } from './wave'
import type { SceneProps } from './scenes/painter'
import { AcousticScene } from './scenes/AcousticScene'
import { TransducerScene } from './scenes/TransducerScene'
import { ComplexScene } from './scenes/ComplexScene'
import { AmplificationScene } from './scenes/AmplificationScene'

// Deep dive's subjects (D46): each a chain of causes and effects the teacher steps through — one
// picture, a step adding a part of it, everything moving with one phase. A new subject: its scene
// (deepdive/scenes/, a picture and its painter), its entry here, and its name and its steps' names
// in the locales (`deepDive.subjects`, `deepDive.steps`).

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
   * Shapes the teacher can pick at one step (`deepDive.shapes`), buttons in the steps' row in place
   * of the step's name: the first until another is picked
   */
  shapes?: { step: number; ids: readonly ShapeId[] }
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
    shapes: { step: 5, ids: ['sawtooth', 'square', 'triangle', 'sameSize', 'quietFirst'] },
  },
  {
    id: 'transducer',
    icon: Speaker,
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
    id: 'amplification',
    icon: Zap,
    Scene: AmplificationScene,
    steps: [
      { id: 'weakSignal',  box: [120, 205, 345, 410] },
      { id: 'powerSupply', box: [-10, 25, 520, 505] },
      { id: 'transistor',  box: [-10, 25, 610, 505] },
      { id: 'lineLevel',   box: [-10, 25, 875, 505] },
      { id: 'pushPull',    box: [-10, 25, 1325, 510] },
      { id: 'speaker',     box: [-10, 25, 1725, 510] },
      { id: 'classes',     box: [-10, 25, 1725, 745] },
    ],
    shapes: { step: 7, ids: ['classA', 'classB', 'classAB'] },
  },
]

/** The subject with this id — the first one for an id the app does not know (an older visit's). */
export function subjectOf(id: string): Subject {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0]
}
