import type { NodeTypes } from '@xyflow/react'
import type { TypeKey } from '../../data/nodeRegistry'
import { SoundSourceNode }    from './SoundSourceNode'
import { MicNode }            from './MicNode'
import { LineSourceNode }     from './LineSourceNode'
import { InstrumentNode }     from './InstrumentNode'
import { GainNode }           from './GainNode'
import { FaderNode }          from './FaderNode'
import { MasterBusNode }      from './MasterBusNode'
import { AmpNode }            from './AmpNode'
import { SpeakerNode }        from './SpeakerNode'
import { ActiveSpeakerNode }  from './ActiveSpeakerNode'
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
import { GeneratorNode }      from './GeneratorNode'
import { RecorderNode }       from './RecorderNode'

/**
 * What each type is drawn as on the canvas (React Flow's `nodeTypes`). Defined once, outside any
 * component, so React Flow never re-registers them.
 */
export const NODE_COMPONENTS: Record<TypeKey, NodeTypes[string]> = {
  vocal:             SoundSourceNode,
  'drum-kit':        SoundSourceNode,
  acoustic:          SoundSourceNode,
  mic:               MicNode,
  keyboard:          LineSourceNode,
  pc:                InstrumentNode,
  instrument:        InstrumentNode,
  generator:         GeneratorNode,
  'di-box':          DIBoxNode,
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
  hpf:               HpfNode,
  eq:                EQNode,
  comp:              CompressorNode,
  switch:            SwitchNode,
  relay:             RelayNode,
  pan:               PanNode,
  'graphic-eq':      GraphicEQNode,
  speaker:           SpeakerNode,
  'active-speaker':  ActiveSpeakerNode,
  'studio-monitor':  ActiveSpeakerNode,
  headphones:        ActiveSpeakerNode,
  recorder:          RecorderNode,
  broadcast:         RecorderNode,
  adc:               AdcDacNode,
  dac:               AdcDacNode,
}
