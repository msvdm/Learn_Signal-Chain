import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Lock, Trophy } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { useSignalChain } from '../hooks/useSignalChain'
import { JOURNEY_STEPS } from '../data/levels'

const NODE_NAMES: Record<string, string> = {
  eq: 'EQ',
  comp: 'Compressor',
  fader: 'Channel Fader',
  master: 'Master Bus',
}

export function JourneyBanner() {
  const journeyStep = useSignalStore((s) => s.journeyStep)
  const unlockNextNode = useSignalStore((s) => s.unlockNextNode)
  const chain = useSignalChain()

  const allUnlocked = journeyStep >= JOURNEY_STEPS.length
  const currentStep = JOURNEY_STEPS[journeyStep]
  const goalMet = !allUnlocked && currentStep.goalCheck(chain)

  if (allUnlocked) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2 text-xs border-b flex-shrink-0"
        style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.2)' }}
      >
        <Trophy size={14} style={{ color: 'var(--signal-good)' }} />
        <span className="font-semibold" style={{ color: 'var(--signal-good)' }}>
          Full chain unlocked — experiment freely!
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          Master output: {chain.master.out > -60 ? `${chain.master.out >= 0 ? '+' : ''}${chain.master.out.toFixed(1)} dBu` : '-∞ dBu'}
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b flex-shrink-0"
      style={{ background: '#16181d', borderColor: 'var(--node-border)' }}
    >
      {/* Step progress dots */}
      <div className="flex gap-1.5 flex-shrink-0">
        {JOURNEY_STEPS.map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-colors"
            style={{
              background:
                i < journeyStep
                  ? 'var(--signal-good)'
                  : i === journeyStep
                  ? goalMet ? 'var(--signal-good)' : '#4b5563'
                  : '#2e3341',
            }}
          />
        ))}
      </div>

      <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

      {/* Goal text */}
      <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-muted)' }}>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          Goal:{' '}
        </span>
        {currentStep.goalLabel}
      </span>

      {/* Unlock button */}
      <AnimatePresence>
        {goalMet && (
          <motion.button
            key="unlock"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: 1,
              scale: 1,
              boxShadow: [
                '0 0 0 0 rgba(74,222,128,0.4)',
                '0 0 8px 4px rgba(74,222,128,0.25)',
                '0 0 0 0 rgba(74,222,128,0.4)',
              ],
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              boxShadow: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 },
            }}
            onClick={unlockNextNode}
            className="nodrag flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex-shrink-0"
            style={{
              background: 'rgba(74,222,128,0.15)',
              border: '1px solid rgba(74,222,128,0.4)',
              color: 'var(--signal-good)',
            }}
          >
            <CheckCircle size={12} />
            Unlock {NODE_NAMES[currentStep.unlocksNodeId]}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
