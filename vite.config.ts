/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Installable web app that works offline (tablet home screen, desktop "Install app").
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/pwa.ts (skipped inside the native apps)
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Pinta e Aprende',
        short_name: 'Pinta',
        description: 'Pintar e aprender palavras, para crianças pequenas.',
        lang: 'pt-PT',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#fff7e6',
        theme_color: '#ff8a3d',
        categories: ['education', 'kids'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,mp3,json}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
