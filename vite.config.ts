import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { offline } from './vite-offline'
import { worklet } from './vite-worklet'

export default defineConfig({
  plugins: [worklet(), react(), tailwindcss(), offline()],
  base: '/Learn_Signal-Chain/'
})
