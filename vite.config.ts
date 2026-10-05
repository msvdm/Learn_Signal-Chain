import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { offline } from './vite-offline'

export default defineConfig({
  plugins: [react(), tailwindcss(), offline()],
  base: '/Learn_Signal-Chain/'
})
