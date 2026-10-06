import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { offline } from './vite-offline'
import { worklet } from './vite-worklet'

export default defineConfig({
  plugins: [worklet(), react(), tailwindcss(), offline()],
  base: '/Learn_Signal-Chain/',
  // One script on purpose: the one-file copy inlines it (vite-offline.ts fails the build on a
  // second chunk), so Vite's "split it up" warning at 500 kB is no use here
  build: { chunkSizeWarningLimit: 1500 },
})
