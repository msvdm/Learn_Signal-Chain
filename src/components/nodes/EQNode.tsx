import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Activity } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { EQCurve } from '../EQCurve'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { levels } from '../../data/levels'

export function EQNode() {
  const { preamp, eq } = useSignalChain()
  const level = useSignalStore((s) => s.level)
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const updateEQBand = useSignalStore((s) => s.updateEQBand)
  const levelConfig = levels[level]
  const [showCurve, setShowCurve] = useState(false)

  const bandLabels = ['Low', 'Mid', 'High']

  return (
    <>
      <NodeWrapper nodeId="eq" icon={<Activity size={14} />} label="Equalizer (EQ)">
        <div className="space-y-2">
          <SignalMeter db={preamp.out} health={preamp.health} label="Input" />

          {levelConfig.eqMode === 'static' && (
            <div className="rounded-lg bg-slate-50 p-2">
              <svg viewBox="0 0 120 40" className="w-full" style={{ height: 40 }}>
                <line x1="0" y1="20" x2="120" y2="20" stroke="#cbd5e1" strokeWidth="1" />
                <path
                  d="M 0 20 Q 30 10 60 15 Q 90 20 120 20"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
              </svg>
              <p className="text-[10px] text-slate-400 text-center">EQ curve preview</p>
            </div>
          )}

          {(levelConfig.eqMode === 'sliders' || levelConfig.eqMode === 'curve') && (
            <>
              <ControlSlider
                value={nodeState.eqHpfHz}
                min={20}
                max={500}
                label="High-pass filter"
                formatValue={(v) => `${v} Hz`}
                onChange={(v) => updateNodeState({ eqHpfHz: v })}
              />
              {nodeState.eqBands.map((band, i) => (
                <ControlSlider
                  key={i}
                  value={band.gainDb}
                  min={-12}
                  max={12}
                  step={0.5}
                  label={`${bandLabels[i]} (${band.freqHz >= 1000 ? `${band.freqHz / 1000}k` : band.freqHz} Hz)`}
                  formatValue={(v) => `${v >= 0 ? '+' : ''}${v} dB`}
                  onChange={(v) => updateEQBand(i, { gainDb: v })}
                />
              ))}
            </>
          )}

          {levelConfig.eqMode === 'curve' && (
            <button
              className="nodrag w-full rounded-lg border border-slate-200 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={() => setShowCurve(true)}
            >
              Open EQ Curve
            </button>
          )}

          <SignalMeter db={eq.out} health={eq.health} label="Output" />
        </div>
        <Handle type="target" position={Position.Left} id="in" />
        <Handle type="source" position={Position.Right} id="out" />
      </NodeWrapper>

      {showCurve && (
        <EQCurve
          bands={nodeState.eqBands}
          hpfHz={nodeState.eqHpfHz}
          onBandChange={updateEQBand}
          onHpfChange={(v) => updateNodeState({ eqHpfHz: v })}
          onClose={() => setShowCurve(false)}
        />
      )}
    </>
  )
}
