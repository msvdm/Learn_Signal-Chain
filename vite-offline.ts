import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { OFFLINE_FILE } from './src/data/site'

// The app without internet, two ways, made at build time (no extra packages):
// - sw.js: a service worker that keeps a copy of every file of this build, so the site opens
//   offline after one visit (and can be installed as an app).
// - OFFLINE_FILE: the whole app in one .html file — download it, double-click it, no internet. The
//   sound loops the script fetches are in it too, as data: URLs.

/** Files the script fetches, and their media types: in the one-file download they are data: URLs. */
const FETCHED: Record<string, string> = { '.mp3': 'audio/mpeg' }

/** Every file in the public folder, as paths relative to it ('icon.svg', 'sub/x.png'). */
function publicFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name)
      if (statSync(path).isDirectory()) walk(path)
      else out.push(relative(dir, path).replaceAll('\\', '/'))
    }
  }
  try { walk(dir) } catch { /* no public folder */ }
  return out
}

/**
 * Script text that can sit inside <script>…</script>: "<script", "</script" and "<!--" would end
 * or confuse the tag, so their "<" is written as \x3C — the same character in a JS string, a
 * template or a regular expression (the only places they can be in a bundle).
 */
const escapeScript = (code: string) => code.replace(/<(\/?script|!--)/gi, '\\x3C$1')

/** The service worker: keeps this build's files; pages come from the network first, else the copy. */
function serviceWorker(base: string, files: string[], version: string): string {
  return `// Made by vite-offline.ts at build time
const CACHE = 'learn-signal-chain-${version}'
const BASE = ${JSON.stringify(base)}
const FILES = ${JSON.stringify(files)}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => BASE + f))).then(() => self.skipWaiting()),
  )
})

// Older copies of this app go; other apps on the same site keep theirs
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('learn-signal-chain-') && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    // The page itself: the newest when online, the kept copy when not
    event.respondWith(fetch(request).catch(() => caches.match(BASE + 'index.html')))
    return
  }
  // Scripts, styles, icons: their names change with every build, so a kept copy is never stale.
  // ignoreVary: the page asks for its script and styles as cross-origin requests (an Origin
  // header), the copies were kept from plain ones — a server answering "Vary: Origin" would
  // otherwise make them never match.
  event.respondWith(caches.match(request, { ignoreVary: true }).then((kept) => kept ?? fetch(request)))
})
`
}

export function offline(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'learn-signal-chain-offline',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) { config = resolved },
    generateBundle(_options, bundle) {
      const html = bundle['index.html']
      if (!html || html.type !== 'asset') throw new Error('vite-offline: index.html is missing from the build')
      const chunks = Object.values(bundle).filter((f) => f.type === 'chunk')
      if (chunks.length !== 1) {
        throw new Error(`vite-offline: the one-file download needs one script, the build made ${chunks.length}`)
      }
      const script = chunks[0]
      let code = script.code
      for (const file of Object.values(bundle)) {
        const type = Object.entries(FETCHED).find(([ext]) => file.fileName.endsWith(ext))?.[1]
        if (file.type !== 'asset' || !type) continue
        code = code.replaceAll(config.base + file.fileName, `data:${type};base64,${Buffer.from(file.source).toString('base64')}`)
      }
      if (code.includes(`${config.base}assets/`)) throw new Error('vite-offline: the script loads a file the one-file download does not hold')
      const styles = Object.values(bundle).filter((f) => f.type === 'asset' && f.fileName.endsWith('.css'))
      const css    = styles.map((f) => (f.type === 'asset' ? String(f.source) : '')).join('\n')
      if (/<\/style/i.test(css)) throw new Error('vite-offline: a stylesheet contains "</style"')
      if (/url\((?!["']?data:)/i.test(css)) throw new Error('vite-offline: a stylesheet loads a file (url(…)); inline it first')

      // ── The one-file download ──
      const icon = readFileSync(join(config.publicDir, 'icon.svg')).toString('base64')
      let page = String(html.source)
      page = page.replace(/<script\b[^>]*\bsrc="[^"]*"[^>]*><\/script>/, () =>
        `<script type="module">${escapeScript(code)}</script>`)
      page = page.replace(/<link\b[^>]*rel="modulepreload"[^>]*>\s*/g, () => '')
      page = page.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
      page = page.replace(/<link\b[^>]*rel="stylesheet"[^>]*>\s*/g, () => '')
      page = page.replace(/<link\b[^>]*rel="icon"[^>]*>/, () =>
        `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${icon}" />`)
      // An installed app and a phone's home-screen icon need the website; a file on disk has neither
      page = page.replace(/<link\b[^>]*rel="(apple-touch-icon|manifest)"[^>]*>\s*/g, () => '')
      this.emitFile({ type: 'asset', fileName: OFFLINE_FILE, source: page })

      // ── The service worker: every file of this build (not itself, not the download) ──
      const files = [
        ...Object.keys(bundle).filter((f) => f !== OFFLINE_FILE),
        ...publicFiles(config.publicDir),
      ].sort()
      // A new build has new file names (they carry a hash of their content): a new copy is kept
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(config.base, files, version) })
    },
  }
}
