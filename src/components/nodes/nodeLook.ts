import type { ComponentType } from 'react'
import {
  Drum, Mic, KeyboardMusic, Plug,
  Activity, ToggleLeft, Sliders,
  AudioWaveform, Minus, Zap,
  Merge, Volume2, Ear,
  SlidersHorizontal, MoveHorizontal, Headphones, Speaker, CassetteTape, RadioTower, Usb,
  FileMusic, FileArchive,
} from 'lucide-react'
import type { TypeKey } from '../../data/nodeRegistry'
import type { ComplexityLevel } from '../../data/levels'
import { HighPassIcon, GateIcon, CompressorIcon, LimiterIcon, KnobIcon, GuitarIcon, GuitarAmpIcon, AmpIcon, GeneratorIcon, AdcIcon, DacIcon, RelayIcon, VocalIcon, TrumpetIcon, LaptopIcon, DawIcon, MixerIcon, StageBoxIcon } from './icons'

// How each element type looks: its icon (palette tile, card header, a source's or speaker's face)
// and its palette group. Its card is in ./index.ts, what it is in data/nodeRegistry.ts.

/** An icon, `size` px wide. */
export type NodeIcon = ComponentType<{ size?: number }>

/** What each element is in the palette. Not the registry's categories: a DI Box is a source here. */
export const PALETTE_GROUPS = ['source', 'processing', 'routing', 'output'] as const
export type PaletteGroup = typeof PALETTE_GROUPS[number]

/** A palette section: its name (`palette.categories`) and the groups it gathers, in NODE_LOOK's order. */
export interface PaletteSection {
  id: PaletteGroup | 'inputs' | 'devices' | 'outputs'
  groups: readonly PaletteGroup[]
}

// One section per group
const EVERY_GROUP: readonly PaletteSection[] = PALETTE_GROUPS.map((group) => ({ id: group, groups: [group] }))

/**
 * The palette's sections at each level, in the order it shows them. Beginner sees whole devices
 * (D20), so processing and routing are one section there; the harder levels show every group.
 */
export const PALETTE_SECTIONS: Record<ComplexityLevel, readonly PaletteSection[]> = {
  beginner: [
    { id: 'inputs',  groups: ['source'] },
    { id: 'devices', groups: ['processing', 'routing'] },
    { id: 'outputs', groups: ['output'] },
  ],
  intermediate: EVERY_GROUP,
  advanced:     EVERY_GROUP,
}

export interface NodeLook {
  icon: NodeIcon
  group: PaletteGroup
  /** The icon in the card's header, when the usual 16px looks too small */
  headerSize?: number
  /** Overview (zoomed out): the biggest its name may grow, when the usual 96px looks too big */
  nameMax?: number
}

/** Every type's look, in palette order: by what each does, in the order a signal meets them (two columns, row by row). */
export const NODE_LOOK: Record<TypeKey, NodeLook> = {
  // Sources: sounds in the air and the microphone that hears them, lines, guitars
  vocal:             { icon: VocalIcon,         group: 'source' },
  'drum-kit':        { icon: Drum,              group: 'source' },
  acoustic:          { icon: TrumpetIcon,       group: 'source' },
  mic:               { icon: Mic,               group: 'source' },
  keyboard:          { icon: KeyboardMusic,     group: 'source' },
  pc:                { icon: LaptopIcon,        group: 'source' },
  instrument:        { icon: GuitarIcon,        group: 'source' },
  'di-box':          { icon: Plug,              group: 'source' },
  'guitar-amp':      { icon: GuitarAmpIcon,     group: 'source' },
  generator:         { icon: GeneratorIcon,     group: 'source', headerSize: 18 },
  // A stream or a file unpacked into numbers: digital from the start (D23)
  decoder:           { icon: FileMusic,         group: 'source' },
  // Processing — into the digital world after the Preamp, back out at the end; first the 48V a
  // condenser microphone needs
  phantom:           { icon: Zap,               group: 'processing' },
  gain:              { icon: KnobIcon,          group: 'processing' },
  adc:               { icon: AdcIcon,           group: 'processing', headerSize: 20 },
  // "HPF" in capitals looks much bigger than mixed-case names at the same size
  hpf:               { icon: HighPassIcon,      group: 'processing', nameMax: 70 },
  pad:               { icon: Minus,             group: 'processing', headerSize: 18 },
  'noise-gate':      { icon: GateIcon,          group: 'processing' },
  eq:                { icon: Activity,          group: 'processing' },
  comp:              { icon: CompressorIcon,    group: 'processing' },
  limiter:           { icon: LimiterIcon,       group: 'processing' },
  deesser:           { icon: AudioWaveform,     group: 'processing' },
  'graphic-eq':      { icon: Sliders,           group: 'processing' },
  dac:               { icon: DacIcon,           group: 'processing', headerSize: 20 },
  // The digital mix packed for a stream (D23), last before Stream / Broadcast
  encoder:             { icon: FileArchive,       group: 'processing' },
  // Routing — level controls, switches, panning, buses
  fader:             { icon: SlidersHorizontal, group: 'routing' },
  switch:            { icon: ToggleLeft,        group: 'routing' },
  relay:             { icon: RelayIcon,         group: 'routing' },
  pan:               { icon: MoveHorizontal,    group: 'routing' },
  'master-bus':      { icon: Merge,             group: 'routing' },
  'aux-bus':         { icon: Merge,             group: 'routing' },
  'matrix-bus':      { icon: Merge,             group: 'routing' },
  'pfl-bus':         { icon: Ear,               group: 'routing' },
  // Record and play back: the box between the desk and the computer, and the computer's recording program
  // Beginner's devices (D20): on the stage, the desk, then the computer's way in
  'stage-box':       { icon: StageBoxIcon,      group: 'routing' },
  mixer:             { icon: MixerIcon,         group: 'routing' },
  interface:         { icon: Usb,               group: 'routing' },
  daw:               { icon: DawIcon,           group: 'routing' },
  // Output
  'active-speaker':  { icon: Volume2,           group: 'output' },
  speaker:           { icon: Volume2,           group: 'output' },
  amp:               { icon: AmpIcon,           group: 'output' },
  headphones:        { icon: Headphones,        group: 'output' },
  'studio-monitor':  { icon: Speaker,           group: 'output' },
  recorder:          { icon: CassetteTape,      group: 'output' },
  broadcast:         { icon: RadioTower,        group: 'output' },
}
