import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { FilePlus, FolderOpen, Save, Link, ImageDown, Download } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'
import { useChainFile } from '../hooks/useChainFile'
import { useChainEmpty } from '../hooks/useChainEmpty'
import { useLatestRef } from '../hooks/useLatestRef'
import { useDismiss } from '../hooks/useDismiss'
import { MOD, pressedInside } from '../utils/shortcut'
import { ConfirmDialog } from './ConfirmDialog'
import { MenuItem, MenuDivider } from './NodeMenu'
import { OFFLINE_FILE, OFFLINE_FILE_SAVE_AS } from '../data/site'

/** This is the downloaded one-file copy, opened from disk: it has nothing to download. */
const isDownloadedCopy = window.location.protocol === 'file:'

/** Save the one-file copy of the app (built next to the site's index.html). */
function downloadApp() {
  const a = document.createElement('a')
  a.href     = `${import.meta.env.BASE_URL}${OFFLINE_FILE}`
  a.download = OFFLINE_FILE_SAVE_AS
  a.click()
}

/**
 * The header's File menu: New (empty canvas), Import…, Export…, Copy a share link, Save as
 * image…, Download the app… (not in the downloaded copy itself). Export and Save as image open the
 * system's Save as window at once — no window of the app's own (saveFileAs). Ctrl / ⌘ + S exports
 * and Ctrl / ⌘ + O imports from anywhere.
 */
export function FileMenu({ onNew, buttonStyle }: {
  /** Ask before clearing the canvas (the header's confirm dialog) */
  onNew: () => void
  buttonStyle: CSSProperties
}) {
  const empty      = useChainEmpty()
  const { t }      = useTranslation()
  const chainFile  = useChainFile()
  const [open, setOpen]     = useState(false)
  const [offerApp, setOfferApp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useDismiss(ref, () => setOpen(false), { open })

  // Ctrl / ⌘ + S and O — instead of the browser's own "Save page" and "Open file"
  const keysRef = useLatestRef({ saveFile: chainFile.saveFile, openChain: chainFile.openChain })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      const key = e.key.toLowerCase()
      if (key !== 's' && key !== 'o') return
      e.preventDefault()
      // (Even while typing: Ctrl / ⌘ + S in the palette search saves too)
      if (pressedInside(e, '[role="dialog"], [role="alertdialog"]')) return
      setOpen(false)
      if (key === 's') void keysRef.current.saveFile()
      else keysRef.current.openChain()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keysRef])

  const act = (fn: () => void) => () => { setOpen(false); fn() }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="lsc-btn-outline"
        style={{
          ...buttonStyle,
          borderColor: open ? 'var(--lsc-accent)' : 'var(--lsc-border)',
          background: open ? 'var(--lsc-accent-bg)' : 'transparent',
        }}
      >
        <FolderOpen size={15} />
        {t.file.menu}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', right: 0, top: '100%', zIndex: 50,
            marginTop: 6, minWidth: 260, padding: 4, borderRadius: 10,
            background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
            boxShadow: 'var(--lsc-shadow-popup)',
          }}
        >
          <MenuItem icon={<FilePlus size={15} />} label={t.file.new} disabled={empty} onClick={act(onNew)} />
          <MenuItem icon={<FolderOpen size={15} />} label={t.file.open} hint={`${MOD}O`} onClick={act(chainFile.openChain)} />
          <MenuItem
            icon={<Save size={15} />} label={t.file.save} hint={`${MOD}S`} disabled={empty}
            onClick={act(() => void chainFile.saveFile())}
          />
          <MenuDivider />
          <MenuItem icon={<Link size={15} />} label={t.file.shareLink} disabled={empty} onClick={act(chainFile.copyShareLink)} />
          <MenuItem
            icon={<ImageDown size={15} />} label={t.file.picture} disabled={empty}
            onClick={act(() => void chainFile.savePicture())}
          />
          {!isDownloadedCopy && (
            <>
              <MenuDivider />
              <MenuItem icon={<Download size={15} />} label={t.file.download} onClick={act(() => setOfferApp(true))} />
            </>
          )}
        </div>
      )}

      {offerApp && (
        <ConfirmDialog
          title={t.file.downloadTitle}
          body={t.file.downloadBody}
          confirmLabel={t.file.downloadConfirm}
          cancelLabel={t.dialog.cancel}
          onConfirm={() => { downloadApp(); setOfferApp(false) }}
          onCancel={() => setOfferApp(false)}
        />
      )}

    </div>
  )
}
