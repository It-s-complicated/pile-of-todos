import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import UnpluginFonts from 'unplugin-fonts/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    UnpluginFonts({
      google: {
        families: [
          {
            name: 'IBM Plex Mono',
            styles: 'wght@400;500',
          },
          {
            name: 'Playfair Display',
            styles: 'wght@400..700',
          },
          {
            name: 'Source Sans 3',
            styles: 'wght@400..700',
          },
        ],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Todo App',
        short_name: 'Todo',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#3b82f6',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
