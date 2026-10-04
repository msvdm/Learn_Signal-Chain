import { useEffect } from 'react'
import { useSignalStore } from '../store/signalStore'
import { LEVELS } from '../data/levels'
import { useTranslation } from '../i18n/useTranslation'
import { useChainEmpty } from '../hooks/useChainEmpty'
import { useChainFile } from '../hooks/useChainFile'
import { useFitView } from '../hooks/useFitView'
import { useGroupActions } from '../hooks/useGroupActions'
import { useLatestRef } from '../hooks/useLatestRef'
import { besideOffset } from '../utils/nodeGroup'
import { readLink, LINK_PREFIX } from '../utils/chainFile'
import type { ParsedChain } from '../utils/chainFile'
import { ConfirmDialog } from './ConfirmDialog'
import { DirectionArrows } from './DirectionArrows'

/**
 * An opened chain (File → Open, a share link): onto an empty canvas it just loads; otherwise a
 * dialog asks whether it replaces the canvas or goes beside what is there. Also opens share links
 * (#chain=…), at start and when the address changes.
 */
export function ChainOpener() {
  const chainOffer      = useSignalStore((s) => s.chainOffer)
  const offerChain      = useSignalStore((s) => s.offerChain)
  const loadChain       = useSignalStore((s) => s.loadChain)
  const complexityLevel = useSignalStore((s) => s.complexityLevel)
  const chainEmpty      = useChainEmpty()
  const { t, fmt }      = useTranslation()
  const { skippedNotice }          = useChainFile()
  const { fitSoon }                = useFitView()
  const { addChain, placedNodes }  = useGroupActions()

  /** The canvas becomes the chain (at the level it was made at). */
  function replaceWithChain(read: ParsedChain) {
    loadChain(read.chain)
    fitSoon()
  }

  /** What opening a chain made at another level does to the level. */
  function levelNote({ chain }: ParsedChain): string {
    if (chain.level === complexityLevel) return ''
    const level = t.levels[chain.level].title
    const up    = LEVELS.indexOf(chain.level) > LEVELS.indexOf(complexityLevel)
    return fmt(up ? t.file.levelAdd : t.file.levelReplace, { level })
  }

  // Onto an empty canvas an opened chain just loads; otherwise the dialog asks
  const actionsRef = useLatestRef({ replaceWithChain, skippedNotice })
  useEffect(() => {
    if (!chainOffer || !chainEmpty) return
    actionsRef.current.replaceWithChain(chainOffer)
    actionsRef.current.skippedNotice(chainOffer)
  }, [chainOffer, chainEmpty, actionsRef])

  // A share link (#chain=…) opens its chain. The address is cleaned first, so a refresh does not
  // open it again.
  const linkBrokenRef = useLatestRef(t.file.linkBroken)
  useEffect(() => {
    function openLink() {
      const { hash, pathname, search } = window.location
      if (!hash.startsWith(LINK_PREFIX)) return
      history.replaceState(null, '', pathname + search)
      readLink(hash).then((read) => {
        if (read === 'broken') useSignalStore.getState().showNotice(linkBrokenRef.current, true)
        else if (read) useSignalStore.getState().offerChain(read)
      })
    }
    openLink()
    window.addEventListener('hashchange', openLink)
    return () => window.removeEventListener('hashchange', openLink)
  }, [linkBrokenRef])

  if (!chainOffer || chainEmpty) return null

  return (
    <ConfirmDialog
      title={chainOffer.chain.name ? fmt(t.file.openTitle, { name: chainOffer.chain.name }) : t.file.openTitleUnnamed}
      body={[
        t.file.openBody,
        levelNote(chainOffer),
        chainOffer.skipped > 0 ? fmt(t.file.skipped, { count: String(chainOffer.skipped) }) : '',
      ].filter(Boolean).join(' ')}
      confirmLabel={t.file.replace}
      cancelLabel={t.dialog.cancel}
      onConfirm={() => replaceWithChain(chainOffer)}
      onCancel={() => offerChain(null)}
    >
      {/* Or beside what is there — the arrows Duplicate uses */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.file.addBeside}</span>
        <DirectionArrows
          labels={{ left: t.file.addLeft, right: t.file.addRight, up: t.file.addUp, down: t.file.addDown }}
          onPick={(dir) => addChain(chainOffer, (group) => besideOffset(group, dir, placedNodes()), true)}
        />
      </div>
    </ConfirmDialog>
  )
}
