import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { FilePlus, FolderOpen, Save, Link, ImageDown } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { useChainFile } from '../hooks/useChainFile'
import { useChainEmpty } from '../hooks/useChainEmpty'
import { useLatestRef } from '../hooks/useLatestRef'
import { useDismiss } from '../hooks/useDismiss'
import { MOD, pressedInside } from '../utils/shortcut'
import { ConfirmDialog } from './ConfirmDialog'
import { MenuItem, MenuDivider } from './NodeMenu'

type Saving = 'file' | 'picture' | null

/**
 * The header's File menu: New (empty canvas), Open…, Save to a file…, Copy a share link,
 * Save as a picture…. Ctrl / ⌘ + S saves and Ctrl / ⌘ + O opens from anywhere.
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
  const [saving, setSaving] = useState<Saving>(null)
  const [name, setName]     = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useDismiss(ref, () => setOpen(false), { open })

  /** Ask for the name first (the last one used is suggested). */
  function startSave(kind: Exclude<Saving, null>) {
    const { nodes, chainName } = useSignalStore.getState()
    if (nodes.length === 0) return
    setName(chainName || t.file.defaultName)
    setSaving(kind)
  }

  function finishSave() {
    const chosen = name.trim() || t.file.defaultName
    if (saving === 'file') chainFile.saveFile(chosen)
    if (saving === 'picture') chainFile.savePicture(chosen)
    setSaving(null)
  }

  // Ctrl / ⌘ + S and O — instead of the browser's own "Save page" and "Open file"
  const keysRef = useLatestRef({ startSave, openChain: chainFile.openChain })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      const key = e.key.toLowerCase()
      if (key !== 's' && key !== 'o') return
      e.preventDefault()
      // (Even while typing: Ctrl / ⌘ + S in the palette search saves too)
      if (pressedInside(e, '[role="dialog"], [role="alertdialog"]')) return
      setOpen(false)
      if (key === 's') keysRef.current.startSave('file')
      else keysRef.current.openChain()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keysRef])

  const act = (fn: () => void) => () => { setOpen(false); fn() }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={t.file.menuHint}
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
          className="absolute right-0 top-full z-50"
          style={{
            marginTop: 6, minWidth: 260, padding: 4, borderRadius: 10,
            background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
            boxShadow: 'var(--lsc-shadow-popup)',
          }}
        >
          <MenuItem icon={<FilePlus size={15} />} label={t.file.new} disabled={empty} onClick={act(onNew)} />
          <MenuItem icon={<FolderOpen size={15} />} label={t.file.open} hint={`${MOD}O`} onClick={act(chainFile.openChain)} />
          <MenuItem
            icon={<Save size={15} />} label={t.file.save} hint={`${MOD}S`} disabled={empty}
            onClick={act(() => startSave('file'))}
          />
          <MenuDivider />
          <MenuItem icon={<Link size={15} />} label={t.file.shareLink} disabled={empty} onClick={act(chainFile.copyShareLink)} />
          <MenuItem
            icon={<ImageDown size={15} />} label={t.file.picture} disabled={empty}
            onClick={act(() => startSave('picture'))}
          />
        </div>
      )}

      {saving && (
        <ConfirmDialog
          title={saving === 'file' ? t.file.saveTitle : t.file.pictureTitle}
          body={saving === 'file' ? t.file.saveBody : t.file.pictureBody}
          confirmLabel={saving === 'file' ? t.file.saveConfirm : t.file.pictureConfirm}
          cancelLabel={t.dialog.cancel}
          onConfirm={finishSave}
          onCancel={() => setSaving(null)}
        >
          <label style={{ display: 'block', marginTop: 12, fontSize: 12, fontWeight: 600, color: 'var(--lsc-fg-muted)' }}>
            {t.file.nameLabel}
            <input
              autoFocus
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finishSave() } }}
              style={{
                display: 'block', width: '100%', height: 34, marginTop: 4, padding: '0 10px',
                borderRadius: 8, border: '1px solid var(--lsc-border)', background: 'var(--lsc-sunken)',
                color: 'var(--lsc-fg)', fontSize: 13, fontWeight: 400,
              }}
            />
          </label>
        </ConfirmDialog>
      )}
    </div>
  )
}
