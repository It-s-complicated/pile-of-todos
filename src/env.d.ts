/// <reference types="vite-plus/client" />

interface ImportMetaEnv {
  readonly VITE_ELECTRIC_SHAPE_URL: string | undefined
  readonly VITE_ELECTRIC_PROXY_URL: string | undefined
  readonly VITE_ELECTRIC_SOURCE_ID: string | undefined
  readonly VITE_ELECTRIC_SECRET: string | undefined
  readonly VITE_API_BASE_URL: string | undefined
  readonly VITE_DEVICE_ID: string | undefined
  readonly VITE_SUPABASE_URL: string | undefined
  readonly VITE_SUPABASE_ANON_KEY: string | undefined
  readonly VITE_APPROVED_GITHUB_PROVIDER_ID: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}
