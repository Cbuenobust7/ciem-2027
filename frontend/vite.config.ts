import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5190,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8078',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:8078',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8078',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:8078',
        changeOrigin: true,
      },
    },
  },
})
