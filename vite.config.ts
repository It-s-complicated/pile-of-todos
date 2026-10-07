import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import UnpluginFonts from 'unplugin-fonts/vite'
import { defineConfig } from 'vite-plus'
import { VitePWA } from 'vite-plugin-pwa'
import { qrcode } from 'vite-plugin-qrcode'
import vitePluginVueDevTools from 'vite-plugin-vue-devtools'
import netlify from '@netlify/vite-plugin'
import VueRouter from 'vue-router/vite'
import { analyzer } from 'vite-bundle-analyzer'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/browser-data/**'],
    },
  },
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
    netlify({
      // This frontend-only app has no Edge Functions to emulate.
      edgeFunctions: { enabled: false },
    }),
    analyzer({ enabled: false }),
    vitePluginVueDevTools(),
    VueRouter({
      dts: 'src/route-map.d.ts',
    }),
    vue(),
    tailwindcss(),
    UnpluginFonts({
      google: {
        families: [
          {
            name: 'Fraunces',
            styles: 'opsz,wght@9..144,600..800',
          },
          {
            name: 'Atkinson Hyperlegible Next',
            styles: 'wght@400..700',
          },
        ],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pile of Todos',
        short_name: 'Pile of Todos',
        start_url: '/',
        display: 'standalone',
        background_color: '#0c0e10',
        theme_color: '#0c0e10',
        shortcuts: [
          {
            name: 'Add task',
            short_name: 'Add task',
            description: 'Capture a new todo',
            url: '/current?add=1',
          },
        ],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
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
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    include: ['src/**/*.test.ts'],
  },
})
