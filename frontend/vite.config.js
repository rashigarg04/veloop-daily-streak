import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Kisi bhi missing css/module error ko ignore karne ke liye
      external: [],
    },
    chunkSizeWarningLimit: 1600,
  },
})
