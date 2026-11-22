import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  appType: 'mpa',
  build: {
    rolldownOptions: {
      input: [
        resolve(import.meta.dirname, 'index.html'),
        resolve(import.meta.dirname, 'booking/index.html'),
        resolve(import.meta.dirname, 'my-bookings/index.html'),
        resolve(import.meta.dirname, 'owner/index.html'),
      ],
    },
  },
  server: {
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
