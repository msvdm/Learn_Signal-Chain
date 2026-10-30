import { createElement } from 'react'
import type { NodeTypes } from '@xyflow/react'
import type { TypeKey } from '../../data/nodeRegistry'
import { SIGNAL_LEVEL, atLeast } from '../../data/levels'
import { useSignalStore } from '../../store/signalStore'
import type { CardProps } from './cardProps'
import { SoundSourceNode }    from './SoundSourceNode'
import { MicNode }            from './MicNode'
import { BareSource, ComputerNode } from './BareSource'
import { BroadcastNode }      from './BroadcastNode'
import { InstrumentNode }     from './InstrumentNode'
import { GainNode }           from './GainNode'
import { FaderNode }          from './FaderNode'
import { MasterBusNode }      from './MasterBusNode'
import { AmpNode }            from './AmpNode'
import { SpeakerNode }        from './SpeakerNode'
import { ActiveSpeakerNode }  from './ActiveSpeakerNode'
import { HeadphonesNode }     from './HeadphonesNode'
import { GuitarAmpNode }      from './GuitarAmpNode'
import { SwitchNode }         from './SwitchNode'
import { CompressorNode }     from './CompressorNode'
import { HpfNode }            from './HpfNode'
import { EQNode }             from './EQNode'
import { GraphicEQNode }      from './GraphicEQNode'
import { DIBoxNode }          from './DIBoxNode'
import { NoiseGateNode }      from './NoiseGateNode'
import { LimiterNode }        from './LimiterNode'
import { PadNode, PhantomNode } from './PadNode'
import { DeesserNode }        from './DeesserNode'
import { RelayNode }          from './RelayNode'
import { PanNode }            from './PanNode'
import { AdcDacNode }         from './AdcDacNode'
import { EncoderNode }          from './EncoderNode'
import { GeneratorNode }      from './GeneratorNode'
import { RecorderNode }       from './RecorderNode'
import { DawNode, InterfaceNode } from './InterfaceNode'
import { BeginnerDevice, BeginnerInput, BeginnerInterface, BeginnerOutput, MixerNode } from './BeginnerFaces'

type Card = NodeTypes[string]

/**
 * Drawn as `beginner` at Beginner — its face there, where no signal is worked out (D20) —, as
 * `card` at the harder levels.
 */
function atBeginner(beginner: Card, card: Card): Card {
  return function ByLevel(props: CardProps) {
    const simple = useSignalStore((s) => !atLeast(s.complexityLevel, SIGNAL_LEVEL))
    return createElement(simple ? beginner : card, props)
  }
}

/**
 * What each type is drawn as on the canvas (React Flow's `nodeTypes`) — at Beginner its face there
 * (BeginnerFaces.tsx). Defined once, outside any component, so React Flow never re-registers them.
 */
export const NODE_COMPONENTS: Record<TypeKey, NodeTypes[string]> = {
  vocal:             atBeginner(BeginnerInput, SoundSourceNode),
  // No card around them from Intermediate, as the Passive Speaker (BareSource.tsx)
  'drum-kit':        atBeginner(BeginnerInput, BareSource),
  acoustic:          atBeginner(BeginnerInput, BareSource),
  mic:               atBeginner(BeginnerInput, MicNode),
  keyboard:          atBeginner(BeginnerInput, BareSource),
  pc:                atBeginner(BeginnerInput, ComputerNode),
  instrument:        atBeginner(BeginnerInput, BareSource),
  generator:         GeneratorNode,
  decoder:           InstrumentNode,
  'di-box':          DIBoxNode,
  // Both amps: the same picture at every level, the power switch working at Beginner too (D27)
  'guitar-amp':      GuitarAmpNode,
  gain:              GainNode,
  amp:               AmpNode,
  fader:             FaderNode,
  'noise-gate':      NoiseGateNode,
  limiter:           LimiterNode,
  pad:               PadNode,
  phantom:           PhantomNode,
  deesser:           DeesserNode,
  'master-bus':      MasterBusNode,
  'aux-bus':         MasterBusNode,
  'matrix-bus':      MasterBusNode,
  'pfl-bus':         MasterBusNode,
  hpf:               HpfNode,
  eq:                EQNode,
  comp:              CompressorNode,
  switch:            SwitchNode,
  relay:             RelayNode,
  pan:               PanNode,
  'graphic-eq':      GraphicEQNode,
  // No card around them, the same at every level (D28): at Beginner they say what they get
  speaker:           SpeakerNode,
  'active-speaker':  ActiveSpeakerNode,
  'studio-monitor':  ActiveSpeakerNode,
  headphones:        HeadphonesNode,
  recorder:          atBeginner(BeginnerOutput, RecorderNode),
  broadcast:         atBeginner(BeginnerOutput, BroadcastNode),
  interface:         atBeginner(BeginnerInterface, InterfaceNode),
  daw:               atBeginner(BeginnerDevice, DawNode),
  adc:               AdcDacNode,
  dac:               AdcDacNode,
  encoder:             EncoderNode,
  // Beginner's devices: the same at any level
  mixer:             MixerNode,
  'stage-box':       BeginnerInput,
}
