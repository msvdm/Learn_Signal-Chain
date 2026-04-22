import { Handle, Position } from '@xyflow/react'
import { SlidersHorizontal } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { motion } from 'framer-motion'

export function FaderNode() {
  const { comp, fader } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)

  const faderPct = ((nodeState.faderDb + 80) / 80) * 100

  return (
    <NodeWrapper nodeId="fader" icon={<SlidersHorizontal size={14} />} label="Channel Fader">
      <div className="space-y-2">
        <SignalMeter db={comp.out} health={comp.health} label="Input" />

        {/* Vertical fader visual */}
        <div className="nodrag flex items-center gap-3 py-1">
          <div className="relative flex-1 h-24 flex items-center justify-center">
            {/* Track */}
            <div className="absolute w-1.5 h-full rounded-full bg-slate-100 border border-slate-200" />
            {/* Unity marker */}
            <div className="absolute right-0 w-3 h-px bg-slate-400" style={{ top: '0%' }} />
            <div className="absolute -right-4 text-[9px] text-slate-400 font-mono" style={{ top: '-4px' }}>0</div>

            {/* Fader cap */}
            <motion.div
              className="absolute w-6 h-4 rounded-sm bg-slate-700 shadow-sm border border-slate-600 cursor-ns-resize z-10"
              style={{ bottom: `${faderPct}%`, marginBottom: -8 }}
            />
          </div>

          {/* Slider as actual input */}
          <input
            type="range"
            min={-80}
            max={0}
            step={1}
            value={nodeState.faderDb}
            onChange={(e) => updateNodeState({ faderDb: Number(e.target.value) })}
            className="nodrag h-24 cursor-pointer"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              appearance: 'slider-vertical' as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              WebkitAppearance: 'slider-vertical' as any,
              accentColor: '#0f172a',
            }}
          />

          <div className="text-center">
            <div className="text-xs font-mono font-semibold text-slate-700">
              {nodeState.faderDb === 0 ? '0' : nodeState.faderDb} dB
            </div>
            {nodeState.faderDb === 0 && (
              <div className="text-[9px] text-slate-400">Unity</div>
            )}
          </div>
        </div>

        <SignalMeter db={fader.out} health={fader.health} label="Output" />
      </div>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
