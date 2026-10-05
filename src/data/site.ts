// Where the app lives online, and the copy of it you can download. Read by the app and by the
// build (vite-offline.ts), so plain constants only — no browser objects here.

/**
 * The app online. A share link made in a downloaded copy points here: a file on one computer is
 * no use to anyone else. A fork published somewhere else changes this.
 */
export const ONLINE_URL = 'https://msvdm.github.io/Learn_Signal-Chain/'

/** The whole app in one .html file, built next to index.html (File → Download the app). */
export const OFFLINE_FILE = 'learn-signal-chain.html'

/** The name the download is saved under. */
export const OFFLINE_FILE_SAVE_AS = 'Learn Signal Chain.html'
