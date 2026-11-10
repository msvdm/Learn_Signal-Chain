import type { ComponentType } from 'react'
import { AudioWaveform, Ear, Speaker } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Translations } from '../i18n/translations'
import type { Box } from './wave'
import type { SceneProps } from './scenes/painter'
import { AcousticScene } from './scenes/AcousticScene'
import { TransducerScene } from './scenes/TransducerScene'
import { ComplexScene } from './scenes/ComplexScene'

// Dive deeper's subjects (D46): each a chain of causes and effects the teacher steps through — one
// picture, a step adding a part of it, everything moving with one phase. A new subject: its scene
// (deeper/scenes/, a picture and its painter), its entry here, and its name and its steps' names
// in the locales (`deeper.subjects`, `deeper.steps`).

export type SubjectId = keyof Translations['deeper']['subjects']
export type StepId    = keyof Translations['deeper']['steps']

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
  /** Whose work the picture uses, said under it (`deeper.credits`) */
  credit?: keyof Translations['deeper']['credits']
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
      { id: 'moreSines',        box: [-110, 430, 620, 830] },
      { id: 'complexInAir',     box: [600, 620, 1370, 850] },
      { id: 'guitar',           box: [690, 150, 1365, 590] },
    ],
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
]

/** The subject with this id — the first one for an id the app does not know (an older visit's). */
export function subjectOf(id: string): Subject {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0]
}
