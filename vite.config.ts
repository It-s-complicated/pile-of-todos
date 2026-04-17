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
    netlify(),
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
        name: 'Pile of Todos',
        short_name: 'Pile of Todos',
        start_url: '/',
        display: 'standalone',
        background_color: '#0c0e10',
        theme_color: '#0c0e10',
        icons: [
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
    include: ['src/**/*.test.ts'],
  },
})
