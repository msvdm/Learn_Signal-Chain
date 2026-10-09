import type { CardProps } from './cardProps'
import type { GeneratorSound } from '../../data/nodeRegistry'
import { GENERATOR_SOUNDS } from '../../data/nodeRegistry'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import type { NodeIcon } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { ClickIcon, NoiseIcon, SineIcon } from './icons'
import { ChoiceButtons } from '../controls/ChoiceButtons'
import type { Choice } from '../controls/ChoiceButtons'
import { ParamKnob } from '../controls/ParamKnob'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useTranslation } from '../../i18n/useTranslation'

const Icon = NODE_LOOK.generator.icon

/** A picture of each sound (how it moves over time). */
const SOUND_ICONS: Record<GeneratorSound, NodeIcon> = { sine: SineIcon, noise: NoiseIcon, click: ClickIcon }

/** Level knob: from mic level (−60 dBu) to the clip level (+20). */
const LEVEL_MIN = -60
const LEVEL_MAX = 20

/**
 * Generator: a test sound of its own — Sine, Noise or Click (short pulses) — at the level its knob
 * sets. Each sound has its own gap between its peaks and its average (signal/process.ts
 * PEAKS_ABOVE): at the same level, clicks clip long before a sine does. Zoomed out it shows its icon.
 */
export function GeneratorNode({ id }: CardProps) {
  const p                = useParams(id, 'generator')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const text             = t.nodes.generator

  const choices: Choice<GeneratorSound>[] = GENERATOR_SOUNDS.map((value) => {
    const SoundIcon = SOUND_ICONS[value]
    return { value, label: text.sounds[value], icon: <SoundIcon size={22} /> }
  })

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="generator"
      label={useNodeName(id, 'generator')}
      align="center"
      overviewArt={(box) => <OverviewIcon icon={<Icon />} box={box} />}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ChoiceButtons
          choices={choices}
          value={p('sound')}
          onChange={(sound) => updateNodeParams(id, { sound })}
          label={text.sound}
          columns={1}
          item="row"
          // As tall as the card leaves room for: the three buttons share it
          style={{ width: 156, height: 150 }}
        />
        <ParamKnob
          nodeId={id}
          typeKey="generator"
          param="levelDb"
          min={LEVEL_MIN}
          max={LEVEL_MAX}
          step={1}
          label={text.level}
          formatValue={(v) => `${v > 0 ? '+' : ''}${v} dBu`}
          size={72}
          labelBelow
        />
      </div>
    </NodeWrapper>
  )
}
