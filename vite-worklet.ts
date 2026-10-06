import { readFile } from 'node:fs/promises'
import type { Plugin } from 'vite'
import { transformWithOxc } from 'vite'

// `import source from './file.ts?worklet'`: the file's code as a string, its types taken out — for
// an AudioWorklet, which loads its code itself (audio/measure.ts hands it over as a Blob, so the
// one-file download needs no extra file). The file must import nothing: the string is all it gets.

export function worklet(): Plugin {
  return {
    name: 'learn-signal-chain-worklet',
    enforce: 'pre',
    async load(id) {
      const [file, query] = id.split('?')
      if (query !== 'worklet') return
      this.addWatchFile(file)
      const { code } = await transformWithOxc(await readFile(file, 'utf8'), file, { lang: 'ts' })
      if (/^\s*import\s/m.test(code)) this.error(`${file}: an AudioWorklet's file can import nothing`)
      return `export default ${JSON.stringify(code)}`
    },
  }
}
