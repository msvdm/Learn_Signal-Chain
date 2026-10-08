import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { KnobControl } from '../controls/KnobControl'
import { StableText } from '../controls/StableText'

// A free-standing knob, big enough to read zoomed out
const KNOB = 110
// The direction indicator under it
const TRACK_W = 180
const DOT     = 16

function positionLabel(pos: number): string {
  if (pos <= 2)  return 'L'
  if (pos >= 98) return 'R'
  if (pos < 50)  return `L${50 - pos}`
  if (pos > 50)  return `R${pos - 50}`
  return 'C'
}

/**
 * Always sends out a stereo wire.
 * Mono wire in: Pan knob — spreads it over L / R (equal-power, −3 dB each side at centre).
 * Stereo wire in: Balance knob — turning only fades the opposite side.
 * Drawn as a bare knob (no card) with a direction indicator under it: where between the left and
 * the right speaker it goes (decision D11 — no level meter).
 */
export function PanNode({ id }: CardProps) {
  const p                = useParams(id, 'pan')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)

  const panPosition = p('panPosition')

  const label = useNodeName(id, 'pan')

  return (
    <FreeControl
      nodeId={id}
      typeKey="pan"
      label={label}
      portLine={KNOB / 2}
      value={<StableText reserve={['L50', 'R50']} align="center">{positionLabel(panPosition)}</StableText>}
      footer={<Direction position={panPosition} />}
    >
      {/* 0 = full left, 50 = centre, 100 = full right */}
      <KnobControl
        value={panPosition}
        min={0}
        max={100}
        step={1}
        label="L ← → R"
        formatValue={positionLabel}
        onChange={(v) => updateNodeParams(id, { panPosition: v })}
        color="var(--lsc-accent)"
        size={KNOB}
        showReadout={false}
      />
    </FreeControl>
  )
}

/** Where it goes between the speakers: a dot on a short track from L to R, following the knob (not the sound). */
function Direction({ position }: { position: number }) {
  return (
    <div
      style={{
        width: TRACK_W, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 700, lineHeight: 1, color: 'var(--lsc-fg-muted)',
      }}
    >
      <span>L</span>
      <div
        style={{
          position: 'relative', flex: 1, height: 8, borderRadius: 9999,
          background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)',
        }}
      >
        {/* The centre */}
        <div style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 2, marginLeft: -1, background: 'var(--lsc-border)' }} />
        <div
          style={{
            position: 'absolute', left: `${position}%`, top: '50%', width: DOT, height: DOT,
            borderRadius: 9999, background: 'var(--lsc-accent)', transform: 'translate(-50%, -50%)',
            // A ring of the canvas's colour keeps the dot clear of the centre mark
            boxShadow: '0 0 0 2px var(--lsc-canvas)',
            // Eased like the knob's own dot
            transition: 'left 80ms ease-out',
          }}
        />
      </div>
      <span>R</span>
    </div>
  )
}
