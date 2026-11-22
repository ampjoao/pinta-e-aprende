/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5174 },
  test: {
    globals: true,
    setupFiles: [fileURLToPath(new URL('./src/test/setup.ts', import.meta.url))],
  },
})
