import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app is served behind nginx at an arbitrary path, with /api proxied to
// uvicorn, so assets use relative URLs and the client calls `api/...`.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
