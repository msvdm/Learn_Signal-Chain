import type { ReactNode } from 'react'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'
import { AUDIBLE_HISS_DB, CAREFUL_ROOM_DB, readingsOf } from '../../signal/readings'
import type { HissVerdict, Readings, RoomVerdict } from '../../signal/readings'

// The readings at the bottom of a card (from Intermediate up): the signal leaving it, in plain
// words — "Peaks 12 dB above the average", "Room before clipping: 18 dB — fine", "Hiss: 60 dB
// below the signal — clean". A verdict that needs no attention is plain text; one that does is in
// the health colours.

const VERDICT_COLOR: Record<RoomVerdict | HissVerdict, string> = {
  fine:     'var(--lsc-fg)',
  clean:    'var(--lsc-fg)',
  careful:  'var(--signal-hot-text)',
  audible:  'var(--signal-hot-text)',
  clipping: 'var(--signal-clipping-text)',
  loud:     'var(--signal-clipping-text)',
}

/** As wide as the widest number a reading shows (tabular figures: every digit is as wide). */
const NUMBER_SAMPLE = '000 dB'

const dbText = (db: number) => (isFinite(db) ? `${db} dB` : '—')

/** A reading's wording with its number and verdict filled in, both in bold. */
function wording(template: string, db: string, verdict?: { text: string; color: string }): ReactNode[] {
  return template.split(/\{(\w+)\}/).map((part, i) => {
    if (i % 2 === 0) return part
    if (part === 'db') return <b key={i} style={{ color: 'var(--lsc-fg)' }}>{db}</b>
    if (part === 'verdict' && verdict) return <b key={i} style={{ color: verdict.color }}>{verdict.text}</b>
    return `{${part}}`
  })
}

/**
 * One reading, as tall as its longest wording at this width (the hidden ones in the same grid
 * cell), so a new number or verdict never resizes the card. Kept in place, invisible, for silence.
 */
function Reading({ shown, tip, reserve, children }: {
  shown: boolean
  tip: string
  reserve: ReactNode[][]
  children: ReactNode
}) {
  return (
    <div title={shown ? tip : undefined} style={{ display: 'grid' }}>
      <div style={{ gridArea: '1 / 1', visibility: shown ? 'visible' : 'hidden' }}>{children}</div>
      {reserve.map((text, i) => (
        <div key={i} aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{text}</div>
      ))}
    </div>
  )
}

/**
 * The readings of the signal leaving a card. Wraps to the card's width; never widens it. `hidden`:
 * kept in place, unseen (a source not connected yet — D11), with `status` said over them.
 */
export function SignalReadings({ nodeId, hidden = false, status }: { nodeId: string; hidden?: boolean; status?: string }) {
  const stage    = useStage(nodeId)
  const { t, fmt } = useTranslation()
  const tr       = t.readings
  const readings: Readings | null = stage ? readingsOf(stage.out, stage.domain) : null
  const shown    = readings !== null && !hidden

  const room = (verdict: RoomVerdict) => ({ text: tr.roomVerdict[verdict], color: VERDICT_COLOR[verdict] })
  const hiss = (verdict: HissVerdict) => ({ text: tr.hissVerdict[verdict], color: VERDICT_COLOR[verdict] })
  const roomVerdicts = Object.keys(tr.roomVerdict) as RoomVerdict[]
  const hissVerdicts = Object.keys(tr.hissVerdict) as HissVerdict[]

  return (
    <div
      className="lsc-wrap-text"
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 2,
        fontSize: 'var(--node-text-sm)', lineHeight: 1.35, color: 'var(--lsc-fg-muted)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {hidden && status && (
        <div title={tr.notConnectedTip} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', fontWeight: 700 }}>
          {status}
        </div>
      )}
      <Reading shown={shown} tip={tr.tips.peaks} reserve={[wording(tr.peaks, NUMBER_SAMPLE)]}>
        {wording(tr.peaks, dbText(readings?.peaksAbove ?? 0))}
      </Reading>
      <Reading
        shown={shown}
        tip={fmt(tr.tips.room, { careful: String(CAREFUL_ROOM_DB) })}
        reserve={roomVerdicts.map((v) => wording(tr.room, NUMBER_SAMPLE, room(v)))}
      >
        {wording(tr.room, dbText(readings?.room ?? 0), room(readings?.roomVerdict ?? 'fine'))}
      </Reading>
      <Reading
        shown={shown}
        tip={fmt(tr.tips.hiss, { audible: String(AUDIBLE_HISS_DB) })}
        reserve={hissVerdicts.map((v) => wording(tr.hiss, NUMBER_SAMPLE, hiss(v)))}
      >
        {wording(tr.hiss, dbText(readings?.hissBelow ?? 0), hiss(readings?.hissVerdict ?? 'clean'))}
      </Reading>
    </div>
  )
}
