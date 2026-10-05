import type { ComponentType } from 'react'
import {
  Mic, Guitar, Plug,
  Activity, ToggleLeft, Radio, Sliders,
  AudioWaveform, Minus,
  Merge, Volume2,
  SlidersHorizontal, GitBranch, MoveHorizontal,
  ArrowRight, ArrowLeft,
} from 'lucide-react'
import type { TypeKey } from '../../data/nodeRegistry'
import { HighPassIcon, JackPlugIcon, GateIcon, CompressorIcon, LimiterIcon, KnobIcon, GuitarAmpIcon, GeneratorIcon } from './icons'

// How each element type looks: its icon (palette tile, card header, a source's or speaker's face)
// and its palette group. Its card is in ./index.ts, what it is in data/nodeRegistry.ts.

/** An icon, `size` px wide. */
export type NodeIcon = ComponentType<{ size?: number }>

/** The palette's groups, in the order it shows them. Not the registry's categories: a DI Box is a source here. */
export const PALETTE_GROUPS = ['source', 'processing', 'routing', 'output'] as const
export type PaletteGroup = typeof PALETTE_GROUPS[number]

export interface NodeLook {
  icon: NodeIcon
  group: PaletteGroup
  /** The icon in the card's header, when the usual 16px looks too small */
  headerSize?: number
  /** Overview (zoomed out): the biggest its name may grow, when the usual 96px looks too big */
  nameMax?: number
}

/** Every type's look, in palette order. */
export const NODE_LOOK: Record<TypeKey, NodeLook> = {
  // Sources
  mic:               { icon: Mic,               group: 'source' },
  'line-in':         { icon: JackPlugIcon,      group: 'source', headerSize: 20 },
  instrument:        { icon: Guitar,            group: 'source' },
  'di-box':          { icon: Plug,              group: 'source' },
  'guitar-amp':      { icon: GuitarAmpIcon,     group: 'source' },
  generator:         { icon: GeneratorIcon,     group: 'source', headerSize: 18 },
  // Processing
  gain:              { icon: KnobIcon,          group: 'processing' },
  // "HPF" in capitals looks much bigger than mixed-case names at the same size
  hpf:               { icon: HighPassIcon,      group: 'processing', nameMax: 70 },
  eq:                { icon: Activity,          group: 'processing' },
  comp:              { icon: CompressorIcon,    group: 'processing' },
  pad:               { icon: Minus,             group: 'processing', headerSize: 18 },
  deesser:           { icon: AudioWaveform,     group: 'processing' },
  'noise-gate':      { icon: GateIcon,          group: 'processing' },
  limiter:           { icon: LimiterIcon,       group: 'processing' },
  amp:               { icon: Radio,             group: 'processing' },
  'graphic-eq':      { icon: Sliders,           group: 'processing' },
  // Routing — level controls, switches, panning, conversion, buses
  fader:             { icon: SlidersHorizontal, group: 'routing' },
  switch:            { icon: ToggleLeft,        group: 'routing' },
  relay:             { icon: GitBranch,         group: 'routing' },
  pan:               { icon: MoveHorizontal,    group: 'routing' },
  adc:               { icon: ArrowRight,        group: 'routing', headerSize: 20 },
  dac:               { icon: ArrowLeft,         group: 'routing', headerSize: 20 },
  'master-bus':      { icon: Merge,             group: 'routing' },
  'aux-bus':         { icon: Merge,             group: 'routing' },
  'matrix-bus':      { icon: Merge,             group: 'routing' },
  // Output
  'active-speaker':  { icon: Volume2,           group: 'output' },
  speaker:           { icon: Volume2,           group: 'output' },
}
