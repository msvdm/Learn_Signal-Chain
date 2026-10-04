// A PNG is a signature followed by chunks: length (4 bytes) · type (4) · data · CRC-32 (4).
// A `tEXt` chunk holds `keyword \0 text` (Latin-1) and every image viewer skips it, so a saved
// picture can carry the chain it shows.

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const latin1 = (s: string) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0xff)

/** True when the bytes start like a PNG file. */
export function isPng(png: Uint8Array): boolean {
  return png.length > 8 && SIGNATURE.every((b, i) => png[i] === b)
}

/** Each chunk's type and where its data sits. */
function* chunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  for (let at = 8; at + 12 <= png.length;) {
    const length = view.getUint32(at)
    const type   = String.fromCharCode(...png.subarray(at + 4, at + 8))
    yield { at, type, data: png.subarray(at + 8, at + 8 + length) }
    at += 12 + length
  }
}

/** The PNG with a `tEXt` chunk added just before its end. `text` must be plain ASCII. */
export function addPngText(png: Uint8Array<ArrayBuffer>, keyword: string, text: string): Uint8Array<ArrayBuffer> {
  const end = isPng(png) ? [...chunks(png)].find((c) => c.type === 'IEND') : undefined
  if (!end) return png
  const body  = latin1(`tEXt${keyword}\0${text}`)
  const chunk = new Uint8Array(body.length + 8)
  const view  = new DataView(chunk.buffer)
  view.setUint32(0, body.length - 4)
  chunk.set(body, 4)
  view.setUint32(body.length + 4, crc32(body))

  const out = new Uint8Array(png.length + chunk.length)
  out.set(png.subarray(0, end.at))
  out.set(chunk, end.at)
  out.set(png.subarray(end.at), end.at + chunk.length)
  return out
}

/** The text of the PNG's `tEXt` chunk named `keyword` (null if it has none). */
export function readPngText(png: Uint8Array, keyword: string): string | null {
  if (!isPng(png)) return null
  for (const c of chunks(png)) {
    if (c.type !== 'tEXt') continue
    const zero = c.data.indexOf(0)
    if (zero < 0 || String.fromCharCode(...c.data.subarray(0, zero)) !== keyword) continue
    let text = ''
    for (const b of c.data.subarray(zero + 1)) text += String.fromCharCode(b)
    return text
  }
  return null
}
