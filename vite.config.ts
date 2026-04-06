import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import UnpluginFonts from 'unplugin-fonts/vite'
import { defineConfig } from 'vite-plus'
import { VitePWA } from 'vite-plugin-pwa'
import { qrcode } from 'vite-plugin-qrcode'
import vitePluginVueDevTools from 'vite-plugin-vue-devtools'
import VueRouter from 'vue-router/vite'
import { analyzer } from 'vite-bundle-analyzer'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  lint: {
    plugins: ['unicorn', 'typescript', 'oxc', 'vue', 'vitest'],
    ignorePatterns: ['.agents/**', '.opencode/**', 'docs/**', 'src/*.d.ts'],
    categories: {
      correctness: 'error',
      // suspicious: 'warn',
      // perf: 'warn',
    },
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    ignorePatterns: ['.agents/**', '.opencode/**', 'docs/**', 'src/*.d.ts'],
    singleQuote: true,
    semi: false,
    experimentalTailwindcss: {
      stylesheet: './src/style.css',
      attributes: [':class'],
    },
  },
  plugins: [
    analyzer(),
    vitePluginVueDevTools(),
    VueRouter({
      dts: 'src/route-map.d.ts',
    }),
    vue(),
    tailwindcss(),
    // @ts-expect-error - this is some vite 8 + ts 6 issue
    UnpluginFonts({
      google: {
        families: [
          {
            name: 'Epilogue',
            styles: 'wght@400..700',
          },
          {
            name: 'Inter',
            styles: 'wght@400..700',
          },
        ],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'SoloFlow Dashboard',
        short_name: 'SoloFlow',
        start_url: '/',
        display: 'standalone',
        background_color: '#0c0e10',
        theme_color: '#0c0e10',
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
    qrcode(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
