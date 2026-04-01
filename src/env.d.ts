/// <reference types="vite-plus/client" />

interface ImportMetaEnv {
  readonly VITE_ELECTRIC_SHAPE_URL: string
  readonly VITE_DEVICE_ID: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APPROVED_GITHUB_PROVIDER_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}
