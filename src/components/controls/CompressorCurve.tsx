import { motion } from 'framer-motion'

interface CompressorCurveProps {
  thresholdDb: number
  ratio: number
  makeupGainDb: number
  gainReductionDb: number
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
  gainReductionDb,
  inputDb,
  height = 80,
}: CompressorCurveProps) {
  const transferPath = buildTransferPath(thresholdDb, ratio, makeupGainDb)
  const threshX = xToSvg(thresholdDb)

  // Current "now" dot
  const nowInputDb = Math.max(DB_MIN, Math.min(DB_MAX, inputDb))
  const nowOutputDb = computeOutput(nowInputDb, thresholdDb, ratio, makeupGainDb)
  const nowX = xToSvg(nowInputDb)
  const nowY = yToSvg(nowOutputDb)

  void gainReductionDb  // used by parent for display; curve recomputes it

  return (
    <div className="rounded-md overflow-hidden" style={{ background: '#0d0f13' }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height }}
      >
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#0d0f13" />

        {/* 1:1 reference diagonal (dashed) */}
        <line
          x1={xToSvg(DB_MIN)} y1={yToSvg(DB_MIN)}
          x2={xToSvg(DB_MAX)} y2={yToSvg(DB_MAX)}
          stroke="#2e3341"
          strokeWidth="1"
          strokeDasharray="4 3"
        />

        {/* Threshold vertical line */}
        <line
          x1={threshX} y1={0}
          x2={threshX} y2={SVG_H}
          stroke="#4b5563"
          strokeWidth="1"
          strokeDasharray="3 2"
        />

        {/* Transfer curve */}
        <path
          d={transferPath}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* "Now" dot — animated */}
        <motion.circle
          r={4}
          fill="#4ade80"
          stroke="#0d0f13"
          strokeWidth="1.5"
          animate={{ cx: nowX, cy: nowY }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </svg>
    </div>
  )
}
