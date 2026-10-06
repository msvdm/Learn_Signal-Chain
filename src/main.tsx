import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// The chain is measured on real sound after every change (decision D9)
import './store/measuring'

// Keep a copy of the app in the browser, so the site opens without internet after one visit.
// Not while developing, and not in the downloaded one-file copy (a file needs no copy).
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { /* works online anyway */ })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
