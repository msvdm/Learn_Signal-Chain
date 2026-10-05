import type { NodeTypes } from '@xyflow/react'
import type { TypeKey } from '../../data/nodeRegistry'
import { MicNode }            from './MicNode'
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
import { PadNode }            from './PadNode'
import { DeesserNode }        from './DeesserNode'
import { RelayNode }          from './RelayNode'
import { PanNode }            from './PanNode'
import { AdcDacNode }         from './AdcDacNode'
import { GeneratorNode }      from './GeneratorNode'

/**
 * What each type is drawn as on the canvas (React Flow's `nodeTypes`). Defined once, outside any
 * component, so React Flow never re-registers them.
 */
export const NODE_COMPONENTS: Record<TypeKey, NodeTypes[string]> = {
  mic:               MicNode,
  'line-in':         MicNode,
  instrument:        MicNode,
  generator:         GeneratorNode,
  'di-box':          DIBoxNode,
  'guitar-amp':      GuitarAmpNode,
  gain:              GainNode,
  amp:               AmpNode,
  fader:             FaderNode,
  'noise-gate':      NoiseGateNode,
  limiter:           LimiterNode,
  pad:               PadNode,
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
  adc:               AdcDacNode,
  dac:               AdcDacNode,
}
