import { motion } from 'framer-motion'

interface CompressorCurveProps {
  thresholdDb: number
  ratio: number
  makeupGainDb: number
  inputDb: number
  height?: number
}

const SVG_W = 120
const SVG_H = 80
const DB_MIN = -60
const DB_MAX = 0

function xToSvg(db: number): number {
  return ((db - DB_MIN) / (DB_MAX - DB_MIN)) * SVG_W
}

function yToSvg(db: number): number {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db))
  return SVG_H - ((clamped - DB_MIN) / (DB_MAX - DB_MIN)) * SVG_H
}

function computeOutput(inputDb: number, threshold: number, ratio: number, makeupGain: number): number {
  let output: number
  if (inputDb <= threshold) {
    output = inputDb
  } else {
    const gr = (inputDb - threshold) * (1 - 1 / ratio)
    output = inputDb - gr
  }
  return output + makeupGain
}

function buildTransferPath(threshold: number, ratio: number, makeupGain: number): string {
  const points: string[] = []
  for (let db = DB_MIN; db <= DB_MAX; db += 1) {
    const out = computeOutput(db, threshold, ratio, makeupGain)
    points.push(`${xToSvg(db).toFixed(1)},${yToSvg(out).toFixed(1)}`)
  }
  return 'M ' + points.join(' L ')
}

export function CompressorCurve({
  thresholdDb,
  ratio,
  makeupGainDb,
  inputDb,
  height = 80,
}: CompressorCurveProps) {
  const transferPath = buildTransferPath(thresholdDb, ratio, makeupGainDb)
  const threshX = xToSvg(thresholdDb)

  const nowInputDb = Math.max(DB_MIN, Math.min(DB_MAX, inputDb))
  const nowOutputDb = computeOutput(nowInputDb, thresholdDb, ratio, makeupGainDb)
  const nowX = xToSvg(nowInputDb)
  const nowY = yToSvg(nowOutputDb)

  return (
    <div className="rounded-md overflow-hidden" style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height }}
      >
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="var(--lsc-sunken)" />

        {/* 1:1 reference diagonal (dashed) */}
        <line
          x1={xToSvg(DB_MIN)} y1={yToSvg(DB_MIN)}
          x2={xToSvg(DB_MAX)} y2={yToSvg(DB_MAX)}
          stroke="var(--lsc-border)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />

        {/* Threshold vertical line */}
        <line
          x1={threshX} y1={0}
          x2={threshX} y2={SVG_H}
          stroke="var(--lsc-fg-fainter)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />

        {/* Transfer curve */}
        <path
          d={transferPath}
          fill="none"
          stroke="var(--lsc-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* "Now" dot */}
        <motion.circle
          r={4}
          fill="var(--signal-good)"
          stroke="var(--lsc-sunken)"
          strokeWidth="1.5"
          animate={{ cx: nowX, cy: nowY }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </svg>
    </div>
  )
}
